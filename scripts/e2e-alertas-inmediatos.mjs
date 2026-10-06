#!/usr/bin/env node
// =============================================================================
// E2E · avisos inmediatos (encargo 2026-10-06-sistema-de-alertas, Paso 1).
//
//   E2E_CORREOS=<ruta absoluta del jsonl> node scripts/e2e-alertas-inmediatos.mjs [baseUrl]
//
// SOLO contra el stack local, con la app de la rama corriendo con
// `EMAIL_TRANSPORTE=archivo` y `EMAIL_ARCHIVO` = la misma ruta que E2E_CORREOS.
// Las acciones se disparan por la INTERFAZ (las server actions reales, con su
// `after()`); los correos se leen del archivo del transporte de prueba.
//
// Utilería sobre Empresa Demo, con direcciones @alertas-e2e.mx (entregables
// para el criterio de omisión; con el transporte de prueba nada sale a la red):
// un admin del cliente activo, otro INACTIVO, un staff y un auditor. Las cuentas
// del seed (@*.example) quedan como destinatarios que deben omitirse.
//
// Afirma, por evento: destinatarios correctos; ninguno a `.example` ni a
// inactivos (omitidos y registrados); una fila de bitácora por destinatario con
// su id, el evento, el modo y SIN dirección. Y que en una emisora de
// demostración el comentario del auditor no le escribe al staff.
// Restaura `es_demo` y borra la utilería al terminar, aunque falle.
// =============================================================================
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3010";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
// Llave PÚBLICA de demostración del stack local (la misma de `dev:local`).
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DB_LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const PSQL = process.env.PSQL || "/opt/homebrew/opt/postgresql@17/bin/psql";
const ARCHIVO = process.env.E2E_CORREOS;
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const SOLICITUD = "c0000000-0000-0000-0000-000000000002";
const DOMINIO = "alertas-e2e.mx";

if (!/127\.0\.0\.1|localhost/.test(URL_SB)) { console.error(`✗ Solo contra el stack local, no ${URL_SB}.`); process.exit(2); }
if (!ARCHIVO || !ARCHIVO.startsWith("/")) { console.error("✗ E2E_CORREOS debe ser la ruta absoluta del archivo del transporte de prueba."); process.exit(2); }

const svc = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };
const sql = (q) => execFileSync(PSQL, [DB_LOCAL, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", q], { encoding: "utf8" }).trim();

const PASS = `E2e-${crypto.randomBytes(12).toString("hex")}`;
const U = {
  admin: { email: `admin@${DOMINIO}`, rol: "admin_cliente", tenant: TENANT, nombre: "[E2E] Admin alertas", activo: true },
  inactivo: { email: `inactivo@${DOMINIO}`, rol: "admin_cliente", tenant: TENANT, nombre: "[E2E] Admin inactivo", activo: false },
  staff: { email: `staff@${DOMINIO}`, rol: "analista", tenant: null, nombre: "[E2E] Staff alertas", activo: true },
  auditor: { email: `auditor@${DOMINIO}`, rol: "auditor", tenant: TENANT, nombre: "[E2E] Auditor alertas", activo: true },
};

const leerCorreos = () =>
  fs.existsSync(ARCHIVO) ? fs.readFileSync(ARCHIVO, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
async function esperarCorreos(desde, n, ms = 30000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const nuevos = leerCorreos().slice(desde);
    if (nuevos.length >= n) { await new Promise((r) => setTimeout(r, 1500)); return leerCorreos().slice(desde); }
    await new Promise((r) => setTimeout(r, 500));
  }
  return leerCorreos().slice(desde);
}
async function filasBitacora(accion, entidadId) {
  const { data } = await svc.from("bitacora").select("detalle").eq("accion", accion).eq("entidad_id", entidadId);
  return (data ?? []).map((f) => f.detalle);
}

const nav = await chromium.launch();
async function entrar(email) {
  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }), page.click('button[type="submit"]')]);
  return page;
}

const { data: tOrig } = await svc.from("tenants").select("es_demo").eq("id", TENANT).single();
// El tope de 20 avisos por emisora y hora (Paso 3) cuenta los avisos de la
// última hora, y las corridas previas de los e2e los dejan: se corren atrás dos
// horas los de Empresa Demo para empezar con la ventana limpia. Solo en local.
sql(`update public.bitacora set created_at = created_at - interval '2 hours' where tenant_id = '${TENANT}' and accion in ('aviso_comentario_auditor','aviso_respuesta_auditor','aviso_documento_aprobado','avisos_agrupados') and created_at > now() - interval '1 hour'`);
const ids = {};
let documentoId = null;
try {
  // ── Utilería
  for (const [k, u] of Object.entries(U)) {
    const { data, error } = await svc.auth.admin.createUser({ email: u.email, password: PASS, email_confirm: true });
    if (error) throw new Error(`alta ${k}: ${error.message}`);
    ids[k] = data.user.id;
    // En el stack local, service_role no escribe en perfiles_usuario (deuda de
    // permisos local ≠ alojado, especificación §10): la utilería va por psql,
    // como dueño de la base. Solo lee la app; el e2e escribe su utilería.
    sql(`insert into public.perfiles_usuario (id, tenant_id, rol, area, nombre, email, activo) values ('${data.user.id}', ${u.tenant ? `'${u.tenant}'` : "null"}, '${u.rol}', null, '${u.nombre}', '${u.email}', ${u.activo})`);
  }
  // Emisora REAL para que el staff entre en el reparto del comentario.
  sql(`update public.tenants set es_demo = false where id = '${TENANT}'`);
  const { data: staffSeed } = await svc.from("perfiles_usuario").select("id, email, activo").is("tenant_id", null);
  const { data: adminsSeed } = await svc.from("perfiles_usuario").select("id, email, activo").eq("tenant_id", TENANT).eq("rol", "admin_cliente");

  // ── 1. Comentario del auditor
  console.log("\n1. Comentario del auditor → admin del cliente y staff");
  let antes = leerCorreos().length;
  const pa = await entrar(U.auditor.email);
  await pa.goto(`${BASE}/admin/solicitudes/${SOLICITUD}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const TEXTO = `Comentario e2e de alertas ${Date.now()}`;
  await pa.locator('textarea[name="texto"]').first().fill(TEXTO);
  await pa.getByRole("button", { name: "Comentar" }).first().click();
  await pa.getByText(TEXTO).first().waitFor({ timeout: 30000 });
  const esperados1 = [...adminsSeed, ...staffSeed];
  let correos = await esperarCorreos(antes, esperados1.length);
  const { data: com } = await svc.from("comentarios_auditor").select("id").eq("texto", TEXTO).single();
  const para = (email) => correos.find((c) => c.para === email);
  ok(correos.length === esperados1.length, `un correo (o su omisión registrada) por destinatario: ${correos.length} de ${esperados1.length}`);
  ok(para(U.admin.email) && !para(U.admin.email).omitido && para(U.admin.email).asunto === "Empresa Demo SAB · Comentario del auditor externo", `admin del cliente: enviado, asunto «${para(U.admin.email)?.asunto}»`);
  ok(para(U.staff.email) && !para(U.staff.email).omitido, "staff: enviado");
  ok(para(U.inactivo.email)?.omitido && para(U.inactivo.email).motivo === "usuario inactivo", "admin INACTIVO: omitido por «usuario inactivo»");
  ok(correos.filter((c) => c.para.endsWith(".example")).every((c) => c.omitido), `direcciones .example: omitidas (${correos.filter((c) => c.para.endsWith(".example")).length})`);
  ok(!correos.some((c) => c.para === U.auditor.email), "el auditor no recibe el aviso de su propio comentario");
  ok(para(U.admin.email)?.html.includes(TEXTO) && para(U.admin.email)?.html.includes(`/admin/solicitudes/${SOLICITUD}`), "el correo trae el comentario y el enlace a la solicitud en el panel");
  let filas = await filasBitacora("aviso_comentario_auditor", com.id);
  ok(filas.length === esperados1.length, `bitácora: una fila por destinatario (${filas.length})`);
  ok(filas.every((d) => d.destinatario_id && d.evento?.tipo === "comentario_auditor" && ["enviado", "omitido", "fallido"].includes(d.modo)), "cada fila trae destinatario_id, evento y modo");
  ok(filas.every((d) => !JSON.stringify(d).includes("@")), "ninguna fila guarda una dirección");
  ok(filas.find((d) => d.destinatario_id === ids.inactivo)?.modo === "omitido", "la fila del inactivo dice omitido");
  ok(filas.find((d) => d.destinatario_id === ids.admin)?.modo === "enviado", "la del admin activo dice enviado");

  // ── 2. Respuesta al auditor
  console.log("\n2. Respuesta → el auditor que escribió");
  antes = leerCorreos().length;
  const pc = await entrar(U.admin.email);
  await pc.goto(`${BASE}/admin/solicitudes/${SOLICITUD}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const RESP = `Respuesta e2e ${Date.now()}`;
  // El formulario de respuesta DE ESTE comentario: cada uno es un <li> con el suyo,
  // y en local puede haber otros sin responder.
  const fila = pc.locator("li", { hasText: TEXTO }).first();
  await fila.waitFor({ timeout: 30000 });
  await fila.locator('textarea[name="respuesta"]').fill(RESP);
  await fila.getByRole("button", { name: "Responder" }).click();
  await pc.getByText(RESP).first().waitFor({ timeout: 30000 });
  correos = await esperarCorreos(antes, 1);
  const { data: respondido } = await svc.from("comentarios_auditor").select("id").eq("respuesta", RESP).single();
  ok(correos.length === 1 && correos[0].para === U.auditor.email && !correos[0].omitido, `un solo correo, al auditor, enviado (${correos.length})`);
  ok(correos[0]?.asunto === "Empresa Demo SAB · Respondieron tu comentario", `asunto «${correos[0]?.asunto}»`);
  ok(correos[0]?.html.includes(RESP), "trae la respuesta");
  filas = await filasBitacora("aviso_respuesta_auditor", respondido.id);
  ok(filas.length === 1 && filas[0].destinatario_id === ids.auditor && filas[0].modo === "enviado", "bitácora: una fila, del auditor, enviado");

  // ── 3. Documento aprobado
  console.log("\n3. Documento aprobado → admin del cliente");
  documentoId = sql(`insert into public.documentos_generados (tenant_id, reporte_id, estado, version) values ('${TENANT}', '${REPORTE}', 'en_revision', ${900 + Math.floor(Math.random() * 99)}) returning id`).split("\n")[0];
  antes = leerCorreos().length;
  const ps = await entrar(U.staff.email);
  await ps.goto(`${BASE}/admin/cobertura/suplemento/${documentoId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await ps.getByRole("button", { name: "Aprobar" }).click();
  await ps.getByText("Documento aprobado").first().waitFor({ timeout: 30000 }).catch(() => {});
  const esperados3 = adminsSeed.length;
  correos = await esperarCorreos(antes, esperados3);
  ok(correos.length === esperados3, `un correo (o su omisión) por admin del cliente: ${correos.length} de ${esperados3}`);
  const ad = correos.find((c) => c.para === U.admin.email);
  ok(ad && !ad.omitido && ad.asunto === "Empresa Demo SAB · Suplemento NIIF S1/S2 aprobado", `admin: enviado, asunto «${ad?.asunto}»`);
  ok(ad?.html.includes(`/admin/cobertura/suplemento/${documentoId}`), "enlace directo al documento");
  ok(correos.find((c) => c.para === U.inactivo.email)?.omitido, "inactivo: omitido");
  ok(!correos.some((c) => c.para === U.staff.email), "el staff que aprobó no recibe el aviso");
  filas = await filasBitacora("aviso_documento_aprobado", documentoId);
  ok(filas.length === esperados3 && filas.every((d) => !JSON.stringify(d).includes("@")), `bitácora: ${filas.length} filas, sin direcciones`);

  // ── 4. Emisora de demostración: el staff no entra
  console.log("\n4. Emisora de demostración: el comentario no le escribe al staff");
  sql(`update public.tenants set es_demo = true where id = '${TENANT}'`);
  antes = leerCorreos().length;
  const TEXTO2 = `Comentario demo e2e ${Date.now()}`;
  await pa.goto(`${BASE}/admin/solicitudes/${SOLICITUD}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await pa.locator('textarea[name="texto"]').first().fill(TEXTO2);
  await pa.getByRole("button", { name: "Comentar" }).first().click();
  await pa.getByText(TEXTO2).first().waitFor({ timeout: 30000 });
  correos = await esperarCorreos(antes, adminsSeed.length);
  ok(correos.length === adminsSeed.length && !correos.some((c) => c.para === U.staff.email), `solo los admins del cliente (${correos.length}); ningún staff`);
} finally {
  await nav.close();
  try { sql(`update public.tenants set es_demo = ${tOrig.es_demo} where id = '${TENANT}'`); } catch (e) { console.error(`  (es_demo: ${e.message.split("\n")[0]})`); }
  const lista = Object.values(ids).map((i) => `'${i}'`).join(",");
  try {
    if (documentoId) sql(`delete from public.documentos_generados where id = '${documentoId}'`);
    if (lista) {
      sql(`delete from public.comentarios_auditor where autor_id in (${lista}); delete from public.auditor_actividad where auditor_id in (${lista});`);
    }
  } catch (e) { console.error(`  (limpieza SQL: ${e.message.split("\n")[0]})`); }
  for (const id of Object.values(ids)) await svc.auth.admin.deleteUser(id);
  const { data: tFin } = await svc.from("tenants").select("es_demo").eq("id", TENANT).single();
  const { count: quedan } = await svc.from("perfiles_usuario").select("id", { count: "exact", head: true }).ilike("email", `%@${DOMINIO}`);
  console.log(`\n  (limpieza: es_demo de Empresa Demo = ${tFin.es_demo}; perfiles de utilería que quedan = ${quedan})`);
}
console.log(fallas.length ? `\n✗ ${fallas.length} falla(s)` : "\n✓ E2E de avisos inmediatos OK");
process.exit(fallas.length ? 1 : 0);
