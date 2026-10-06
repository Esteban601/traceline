#!/usr/bin/env node
// =============================================================================
// E2E · tope de 20 avisos inmediatos por emisora y hora (encargo
// 2026-10-06-sistema-de-alertas, Paso 3).
//
//   E2E_CORREOS=<jsonl> E2E_CRON_SECRET=<secreto local> node scripts/e2e-alertas-tope.mjs [baseUrl]
//
// SOLO contra el stack local, con la app de la rama corriendo con
// `EMAIL_TRANSPORTE=archivo`, `EMAIL_ARCHIVO` = E2E_CORREOS y `CRON_SECRET` =
// E2E_CRON_SECRET.
//
// Precarga en la bitácora 20 avisos «enviados» de Empresa Demo en la última
// hora (filas de utilería, por psql). Entonces:
//   1. Un comentario del auditor NO sale suelto al admin con dirección
//      entregable: queda en `correos_retenidos` y en la bitácora como
//      `retenido`. Lo omitido (`.example`) no se retiene: se omite como siempre.
//   2. El job de 10 minutos (`/api/evidencias/procesar`) lo manda AGRUPADO:
//      un correo «… · 1 aviso de la última hora», el retenido queda con
//      `agrupado_en` y la bitácora con `avisos_agrupados` enviado.
//   3. Una segunda vuelta del job no manda nada (ya no hay pendientes).
// Borra todo al terminar, incluidas las 20 filas de utilería.
// =============================================================================
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3010";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DB_LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const PSQL = process.env.PSQL || "/opt/homebrew/opt/postgresql@17/bin/psql";
const ARCHIVO = process.env.E2E_CORREOS;
const CRON = process.env.E2E_CRON_SECRET;
const TENANT = "10000000-0000-0000-0000-000000000001";
const SOLICITUD = "c0000000-0000-0000-0000-000000000002";
const DOM = "alertas-e2e.mx";
const MARCA = "e2e-tope-utileria";
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.error(`✗ Solo contra una app local, no ${BASE}.`); process.exit(2); }
if (!ARCHIVO?.startsWith("/") || !CRON) { console.error("✗ Faltan E2E_CORREOS (ruta absoluta) o E2E_CRON_SECRET."); process.exit(2); }

const svc = createClient("http://127.0.0.1:54321", SERVICE, { auth: { persistSession: false } });
const sql = (q) => execFileSync(PSQL, [DB_LOCAL, "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", q], { encoding: "utf8" }).trim();
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };
const correos = () => (fs.existsSync(ARCHIVO) ? fs.readFileSync(ARCHIVO, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const job = () => fetch(`${BASE}/api/evidencias/procesar?maximo=1`, { method: "POST", headers: { "x-cron-secret": CRON } }).then((r) => r.json().catch(() => ({})));

const PASS = `E2e-${crypto.randomBytes(12).toString("hex")}`;
const U = {
  admin: { email: `admin.tope@${DOM}`, rol: "admin_cliente", nombre: "[E2E] Admin tope" },
  auditor: { email: `auditor.tope@${DOM}`, rol: "auditor", nombre: "[E2E] Auditor tope" },
};
const ids = {};
const nav = await chromium.launch();
try {
  for (const [k, u] of Object.entries(U)) {
    const { data, error } = await svc.auth.admin.createUser({ email: u.email, password: PASS, email_confirm: true });
    if (error) throw new Error(`alta ${k}: ${error.message}`);
    ids[k] = data.user.id;
    sql(`insert into public.perfiles_usuario (id, tenant_id, rol, area, nombre, email, activo) values ('${ids[k]}', '${TENANT}', '${u.rol}', null, '${u.nombre}', '${u.email}', true)`);
  }
  // Ventana limpia (las corridas previas de los e2e dejan avisos de la última
  // hora) y luego exactamente 20 avisos «enviados»: la emisora está en el tope.
  sql(`update public.bitacora set created_at = created_at - interval '2 hours' where tenant_id = '${TENANT}' and accion in ('aviso_comentario_auditor','aviso_respuesta_auditor','aviso_documento_aprobado','avisos_agrupados') and created_at > now() - interval '1 hour'`);
  sql(`insert into public.bitacora (tenant_id, accion, entidad, detalle) select '${TENANT}', 'aviso_comentario_auditor', 'correo', jsonb_build_object('modo','enviado','marca','${MARCA}') from generate_series(1,20)`);

  console.log("\n1. En el tope: el aviso se retiene");
  let antes = correos().length;
  const page = await (await nav.newContext()).newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', U.auditor.email);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }), page.click('button[type="submit"]')]);
  await page.goto(`${BASE}/admin/solicitudes/${SOLICITUD}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const TEXTO = `Comentario e2e tope ${Date.now()}`;
  await page.locator('textarea[name="texto"]').first().fill(TEXTO);
  await page.getByRole("button", { name: "Comentar" }).first().click();
  await page.getByText(TEXTO).first().waitFor({ timeout: 30000 });
  let retenido = null;
  for (let i = 0; i < 40 && !retenido; i++) {
    retenido = sql(`select id from public.correos_retenidos where destinatario_id = '${ids.admin}' and agrupado_en is null`) || null;
    if (!retenido) await espera(500);
  }
  await espera(1000);
  const nuevos = correos().slice(antes);
  ok(!!retenido, "el aviso al admin quedó en correos_retenidos");
  ok(!nuevos.some((c) => c.para === U.admin.email), "y no salió suelto");
  ok(nuevos.filter((c) => c.para.endsWith(".example")).every((c) => c.omitido), `lo omitido no se retiene: se omite (${nuevos.filter((c) => c.para.endsWith(".example")).length})`);
  const { data: com } = await svc.from("comentarios_auditor").select("id").eq("texto", TEXTO).single();
  const { data: filas } = await svc.from("bitacora").select("detalle").eq("accion", "aviso_comentario_auditor").eq("entidad_id", com.id);
  const fAdmin = (filas ?? []).find((f) => f.detalle?.destinatario_id === ids.admin);
  ok(fAdmin?.detalle?.modo === "retenido", `bitácora del admin: ${fAdmin?.detalle?.modo}`);

  console.log("\n2. El job de 10 minutos lo manda agrupado");
  antes = correos().length;
  const r1 = await job();
  await espera(500);
  const agrupado = correos().slice(antes).find((c) => c.para === U.admin.email);
  ok(agrupado && !agrupado.omitido && agrupado.asunto === "Empresa Demo SAB · 1 aviso de la última hora", `un correo agrupado al admin («${agrupado?.asunto}»)`);
  ok(agrupado?.html.includes("Comentario del auditor externo") && agrupado?.html.includes(`/admin/solicitudes/${SOLICITUD}`), "con el aviso, su asunto y su enlace");
  ok(sql(`select count(*) from public.correos_retenidos where destinatario_id = '${ids.admin}' and agrupado_en is not null`) === "1", "el retenido queda marcado como agrupado");
  const { data: fAg } = await svc.from("bitacora").select("detalle").eq("accion", "avisos_agrupados").eq("detalle->>destinatario_id", ids.admin);
  ok((fAg ?? []).length === 1 && fAg[0].detalle.modo === "enviado" && fAg[0].detalle.avisos === 1 && !JSON.stringify(fAg[0].detalle).includes("@"), "bitácora avisos_agrupados: enviado, 1 aviso, sin dirección");
  ok(!("error" in (r1.agrupados ?? {})), `la ruta del job informa el agrupado (${JSON.stringify(r1.agrupados ?? null)})`);
  if (agrupado) fs.writeFileSync(ARCHIVO.replace(/\.jsonl$/, ".agrupado.json"), JSON.stringify(agrupado), { mode: 0o600 });

  console.log("\n3. Segunda vuelta del job");
  antes = correos().length;
  await job();
  await espera(500);
  ok(!correos().slice(antes).some((c) => c.para === U.admin.email), "no manda nada más");
} finally {
  await nav.close();
  const lista = Object.values(ids).map((i) => `'${i}'`).join(",");
  try {
    sql(`delete from public.bitacora where detalle->>'marca' = '${MARCA}'`);
    if (lista) sql(`delete from public.correos_retenidos where destinatario_id in (${lista}); delete from public.comentarios_auditor where autor_id in (${lista}); delete from public.auditor_actividad where auditor_id in (${lista});`);
  } catch (e) { console.error(`  (limpieza SQL: ${e.message.split("\n")[0]})`); }
  for (const id of Object.values(ids)) await svc.auth.admin.deleteUser(id);
  console.log(`\n  (limpieza: filas de utilería en bitácora = ${sql(`select count(*) from public.bitacora where detalle->>'marca' = '${MARCA}'`)}; perfiles = ${sql(`select count(*) from public.perfiles_usuario where email like '%.tope@${DOM}'`)})`);
}
console.log(fallas.length ? `\n✗ ${fallas.length} falla(s)` : "\n✓ E2E del tope de avisos OK");
process.exit(fallas.length ? 1 : 0);
