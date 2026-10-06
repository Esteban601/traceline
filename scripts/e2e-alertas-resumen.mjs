#!/usr/bin/env node
// =============================================================================
// E2E · resumen diario (encargo 2026-10-06-sistema-de-alertas, Paso 2).
//
//   E2E_CORREOS=<jsonl> E2E_CRON_SECRET=<secreto local> node scripts/e2e-alertas-resumen.mjs [baseUrl]
//
// SOLO contra el stack local, con la app de la rama corriendo con
// `EMAIL_TRANSPORTE=archivo`, `EMAIL_ARCHIVO` = E2E_CORREOS y `CRON_SECRET` =
// E2E_CRON_SECRET (un valor local de prueba). Dispara la corrida por la ruta del
// cron con `?fecha=`: el «hoy» evaluado es MAÑANA, así que el «ayer» de las
// secciones nuevas es hoy, cuando se crea la utilería.
//
// Utilería en Empresa Demo (por psql, como dueño de la base; triggers apagados
// con session_replication_role para fijar estados y fechas sin pasar por la
// máquina de estados): un jefe de RH que además es responsable, un usuario de
// RH, un admin del cliente, un staff y un auditor, @alertas-e2e.mx; seis
// solicitudes «[E2E alertas]».
//
// Afirma:
//   1. Día con novedades: el jefe recibe cinco secciones (pendientes,
//      observaciones, validadas ayer, VB pendiente, sugerencias); el admin,
//      evidencias por validar y la línea de sugerencias por área; el staff, un
//      correo combinado «… · Resumen diario · N emisoras». Bitácora
//      `resumen_diario` por destinatario, con secciones y sin dirección.
//   2. Interruptor: el usuario de RH apaga su resumen en «Mi cuenta» → no recibe
//      resumen; un comentario del auditor le sigue llegando al admin que lo
//      apagó (los inmediatos no se apagan).
//   3. Idempotencia: la misma fecha otra vez no manda nada nuevo.
//   4. Día sin novedades (dos días después): ningún resumen a la utilería.
// Restaura `es_demo` y borra todo al terminar.
// =============================================================================
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3010";
const URL_SB = "http://127.0.0.1:54321";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DB_LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const PSQL = process.env.PSQL || "/opt/homebrew/opt/postgresql@17/bin/psql";
const ARCHIVO = process.env.E2E_CORREOS;
const CRON = process.env.E2E_CRON_SECRET;
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const DOM = "alertas-e2e.mx";
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.error(`✗ Solo contra una app local, no ${BASE}.`); process.exit(2); }
if (!ARCHIVO?.startsWith("/") || !CRON) { console.error("✗ Faltan E2E_CORREOS (ruta absoluta) o E2E_CRON_SECRET."); process.exit(2); }

const svc = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
const sql = (q) => execFileSync(PSQL, [DB_LOCAL, "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", q], { encoding: "utf8" }).trim();
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };
const correos = () => (fs.existsSync(ARCHIVO) ? fs.readFileSync(ARCHIVO, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const diaMx = (offset) => { const d = new Date(Date.now() - 6 * 3600 * 1000); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };
const MANANA = diaMx(1), PASADO = diaMx(3);
async function correr(fecha) {
  const r = await fetch(`${BASE}/api/recordatorios?fecha=${fecha}`, { method: "POST", headers: { "x-cron-secret": CRON } });
  const j = await r.json();
  if (r.status !== 200) throw new Error(`cron ${r.status}: ${j.error}`);
  return j.digest;
}

const PASS = `E2e-${crypto.randomBytes(12).toString("hex")}`;
const U = {
  jefe: { email: `jefe@${DOM}`, rol: "jefe_area", tenant: TENANT, area: "RH", nombre: "[E2E] Jefe RH" },
  usuario: { email: `rh@${DOM}`, rol: "cliente", tenant: TENANT, area: "RH", nombre: "[E2E] Usuario RH" },
  admin: { email: `admin@${DOM}`, rol: "admin_cliente", tenant: TENANT, area: null, nombre: "[E2E] Admin cliente" },
  staff: { email: `staff@${DOM}`, rol: "analista", tenant: null, area: null, nombre: "[E2E] Staff" },
  auditor: { email: `auditor@${DOM}`, rol: "auditor", tenant: TENANT, area: null, nombre: "[E2E] Auditor" },
};
const ids = {};
const sols = {};
const nav = await chromium.launch();
async function entrar(email) {
  const page = await (await nav.newContext()).newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }), page.click('button[type="submit"]')]);
  return page;
}
const tOrig = sql(`select es_demo from public.tenants where id = '${TENANT}'`) === "t";
// El tope de 20 avisos por emisora y hora (Paso 3) cuenta los avisos de la
// última hora, y las corridas previas de los e2e los dejan: se corren atrás dos
// horas los de Empresa Demo para empezar con la ventana limpia. Solo en local.
sql(`update public.bitacora set created_at = created_at - interval '2 hours' where tenant_id = '${TENANT}' and accion in ('aviso_comentario_auditor','aviso_respuesta_auditor','aviso_documento_aprobado','avisos_agrupados') and created_at > now() - interval '1 hour'`);

try {
  // ── Utilería
  for (const [k, u] of Object.entries(U)) {
    const { data, error } = await svc.auth.admin.createUser({ email: u.email, password: PASS, email_confirm: true });
    if (error) throw new Error(`alta ${k}: ${error.message}`);
    ids[k] = data.user.id;
    sql(`insert into public.perfiles_usuario (id, tenant_id, rol, area, nombre, email, activo) values ('${ids[k]}', ${u.tenant ? `'${u.tenant}'` : "null"}, '${u.rol}', ${u.area ? `'${u.area}'` : "null"}, '${u.nombre}', '${u.email}', true)`);
  }
  sql(`update public.tenants set es_demo = false where id = '${TENANT}'`);
  const nueva = (clave, estado, origen, responsable) => {
    sols[clave] = sql(`set session_replication_role = replica; insert into public.solicitudes (reporte_id, titulo, area_asignada, estado, origen, responsable_cliente_id, fecha_limite) values ('${REPORTE}', '[E2E alertas] ${clave}', 'RH', '${estado}', '${origen}', ${responsable ? `'${responsable}'` : "null"}, current_date + 10) returning id`).split("\n").find((l) => /^[0-9a-f-]{36}$/.test(l));
  };
  nueva("pendiente", "solicitado", "irstrat", ids.jefe);
  nueva("observada", "observaciones", "irstrat", ids.jefe);
  nueva("validada", "validado", "irstrat", ids.jefe);
  nueva("recibida-cliente", "recibido", "cliente", ids.usuario);
  nueva("recibida-irstrat", "recibido", "irstrat", ids.usuario);
  sql(`insert into public.bitacora (tenant_id, accion, entidad, entidad_id, detalle) values ('${TENANT}', 'cambio_estado', 'solicitudes', '${sols.validada}', '{"estado_anterior":"recibido","estado_nuevo":"validado"}')`);
  for (const k of ["recibida-cliente", "recibida-irstrat"]) {
    sql(`set session_replication_role = replica; insert into public.evidencias (solicitud_id, version, archivo_path, nombre_original, subido_por) values ('${sols[k]}', 1, '${TENANT}/${sols[k]}/e2e.pdf', 'e2e.pdf', '${ids.usuario}')`);
    // Con los triggers apagados, la fila que deja la carga se escribe a mano.
    sql(`insert into public.bitacora (tenant_id, usuario_id, accion, entidad, detalle) values ('${TENANT}', '${ids.usuario}', 'evidencia_creada', 'evidencias', '{"solicitud_id":"${sols[k]}"}')`);
  }
  const ev = sql(`select id from public.evidencias where solicitud_id = '${sols["recibida-cliente"]}' limit 1`);
  sql(`set session_replication_role = replica; insert into public.sugerencias_captura (solicitud_id, tenant_id, evidencia_id, contenido_id, evidencia_version, tipo, estado) values ('${sols.pendiente}', '${TENANT}', '${ev}', gen_random_uuid(), 1, 'numerica', 'sugerida')`);

  // ── 1. Día con novedades
  console.log(`\n1. Día con novedades (hoy evaluado ${MANANA})`);
  let antes = correos().length;
  let d = await correr(MANANA);
  await espera(500);
  let nuevos = correos().slice(antes);
  const de = (email) => nuevos.filter((c) => c.para === email);
  const secciones = (c) => [...c.html.matchAll(/font-size:15px;font-weight:700;color:#0E4F47;">\s*([^<]+?)\s*<span/g)].map((m) => m[1].trim());
  const jefe = de(U.jefe.email)[0];
  ok(jefe && !jefe.omitido && jefe.asunto === "Empresa Demo SAB · Resumen diario", `jefe: un resumen, asunto «${jefe?.asunto}»`);
  ok(JSON.stringify(secciones(jefe ?? { html: "" })) === JSON.stringify(["Observaciones por atender", "Pendientes de entrega", "Validadas ayer", "Visto bueno pendiente", "Sugerencias de captura por decidir"]), `jefe: cinco secciones (${secciones(jefe ?? { html: "" }).join(" · ")})`);
  const admin = de(U.admin.email)[0];
  ok(admin && JSON.stringify(secciones(admin)) === JSON.stringify(["Evidencias por validar", "Sugerencias de captura por decidir"]), `admin: evidencias y sugerencias (${admin ? secciones(admin).join(" · ") : "sin correo"})`);
  ok(admin?.html.includes("RH: 1 sugerencia por decidir") && !admin?.html.includes("[E2E alertas] pendiente"), "admin: sugerencias como conteo por área, sin ítems");
  ok(admin?.html.includes("[E2E alertas] recibida-cliente") && !admin?.html.includes("[E2E alertas] recibida-irstrat"), "admin: solo evidencias de origen cliente");
  const staff = de(U.staff.email)[0];
  ok(staff && /^TRACELINE · Resumen diario · \d+ emisoras?$/.test(staff.asunto) && staff.html.includes("[E2E alertas] recibida-irstrat"), `staff: correo combinado («${staff?.asunto}») con la de origen IRStrat`);
  ok(!nuevos.some((c) => c.para === U.auditor.email), "el auditor no recibe resumen");
  ok(de(U.usuario.email).length === 1 && JSON.stringify(secciones(de(U.usuario.email)[0])) === JSON.stringify(["Sugerencias de captura por decidir"]), "usuario de RH: solo sugerencias (sus solicitudes están en recibido)");
  const { data: filas } = await svc.from("bitacora").select("detalle").eq("accion", "resumen_diario").eq("detalle->>fecha", MANANA).in("detalle->>destinatario_id", Object.values(ids));
  ok((filas ?? []).length === 4 && filas.every((f) => f.detalle.modo === "enviado" && f.detalle.secciones && !JSON.stringify(f.detalle).includes("@")), `bitácora: 4 filas resumen_diario enviadas, con secciones y sin dirección (${(filas ?? []).length})`);
  fs.writeFileSync(ARCHIVO.replace(/\.jsonl$/, ".resumen-completo.json"), JSON.stringify({ jefe, admin, staff }, null, 1), { mode: 0o600 });

  // ── 2. Interruptor
  console.log("\n2. Interruptor «Recibir resumen diario»");
  const pu = await entrar(U.usuario.email);
  await pu.goto(`${BASE}/portal/cuenta`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const sw = pu.getByRole("switch", { name: "Recibir resumen diario" });
  ok((await sw.getAttribute("aria-checked")) === "true", "«Mi cuenta» del portal: encendido por defecto");
  await sw.click();
  await pu.waitForFunction(() => document.querySelector('[role="switch"]')?.getAttribute("aria-checked") === "false", null, { timeout: 30000 });
  ok(sql(`select recibe_resumen_diario from public.perfiles_usuario where id = '${ids.usuario}'`) === "f", "apagado en la base");
  ok(sql(`select count(*) from public.bitacora where accion = 'preferencia_resumen_diario' and usuario_id = '${ids.usuario}'`) === "1", "la preferencia queda en bitácora");
  const pa = await entrar(U.admin.email);
  await pa.goto(`${BASE}/admin/cuenta`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await pa.getByRole("switch", { name: "Recibir resumen diario" }).click();
  await pa.waitForFunction(() => document.querySelector('[role="switch"]')?.getAttribute("aria-checked") === "false", null, { timeout: 30000 });
  ok(sql(`select recibe_resumen_diario from public.perfiles_usuario where id = '${ids.admin}'`) === "f", "«Mi cuenta» del panel: el admin lo apaga");
  const paud = await entrar(U.auditor.email);
  await paud.goto(`${BASE}/admin/cuenta`, { waitUntil: "domcontentloaded", timeout: 90000 });
  ok(await paud.getByRole("switch", { name: "Recibir resumen diario" }).isDisabled(), "al auditor el interruptor le aparece deshabilitado");
  const { error: eAud } = await (async () => { const c = createClient(URL_SB, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0", { auth: { persistSession: false } }); await c.auth.signInWithPassword({ email: U.auditor.email, password: PASS }); return c.rpc("fn_set_resumen_diario", { p_recibir: false }); })();
  ok(!!eAud && /auditor/.test(eAud.message), "y la base lo rechaza en una llamada directa");
  // Nueva novedad para el día siguiente, y corrida: los que apagaron no reciben.
  antes = correos().length;
  // Una sola sugerencia viva por solicitud: se corre un día la que hay, para que
  // sea la novedad del «ayer» siguiente.
  sql(`update public.sugerencias_captura set created_at = created_at + interval '1 day' where solicitud_id = '${sols.pendiente}'`);
  d = await correr(diaMx(2));
  await espera(500);
  nuevos = correos().slice(antes);
  ok(!nuevos.some((c) => c.para === U.usuario.email) && !nuevos.some((c) => c.para === U.admin.email), "con el resumen apagado, ni el usuario ni el admin reciben resumen");
  ok(d.apagados >= 2, `la corrida los cuenta como apagados (${d.apagados})`);
  antes = correos().length;
  const TEXTO = `Comentario e2e resumen ${Date.now()}`;
  await paud.goto(`${BASE}/admin/solicitudes/${sols["recibida-cliente"]}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await paud.locator('textarea[name="texto"]').first().fill(TEXTO);
  await paud.getByRole("button", { name: "Comentar" }).first().click();
  await paud.getByText(TEXTO).first().waitFor({ timeout: 30000 });
  for (let i = 0; i < 40 && !correos().slice(antes).some((c) => c.para === U.admin.email); i++) await espera(500);
  ok(correos().slice(antes).some((c) => c.para === U.admin.email && /Comentario del auditor/.test(c.asunto) && !c.omitido), "el admin con el resumen apagado sigue recibiendo el aviso inmediato");

  // ── 3. Idempotencia
  console.log("\n3. La misma fecha otra vez");
  antes = correos().length;
  d = await correr(MANANA);
  await espera(500);
  // Solo resúmenes: el aviso inmediato del paso 2 (al staff) sale con after() y puede llegar tarde.
  const repetidos = correos().slice(antes).filter((c) => /Resumen diario/.test(c.asunto) && Object.values(U).some((u) => u.email === c.para));
  ok(repetidos.length === 0, `ningún resumen nuevo a la utilería (ya tenían el de esa fecha: ${d.yaEnviados}${repetidos.length ? `; llegaron: ${repetidos.map((c) => `${c.para} «${c.asunto}»`).join(", ")}` : ""})`);

  // ── 4. Día sin novedades
  console.log(`\n4. Día sin novedades (hoy evaluado ${PASADO})`);
  antes = correos().length;
  d = await correr(PASADO);
  await espera(500);
  const aUtileria = correos().slice(antes).filter((c) => /Resumen diario/.test(c.asunto) && Object.values(U).some((u) => u.email === c.para));
  ok(aUtileria.length === 0, `ningún resumen a la utilería (${aUtileria.length}): pendientes bloqueados por los 5 días y sin novedad de ayer`);
  const { count: filasVacio } = await svc.from("bitacora").select("id", { count: "exact", head: true }).eq("accion", "resumen_diario").eq("detalle->>fecha", PASADO).in("detalle->>destinatario_id", Object.values(ids));
  ok(filasVacio === 0, `y ninguna fila de bitácora para ese día (${filasVacio})`);
  fs.writeFileSync(ARCHIVO.replace(/\.jsonl$/, ".resumen-vacio.json"), JSON.stringify({ fecha: PASADO, corrida: d, correos_a_utileria: aUtileria.length }, null, 1), { mode: 0o600 });
} finally {
  await nav.close();
  const lista = Object.values(ids).map((i) => `'${i}'`).join(",");
  const lsol = Object.values(sols).filter(Boolean).map((i) => `'${i}'`).join(",");
  try {
    if (lsol) sql(`set session_replication_role = replica; delete from public.sugerencias_captura where solicitud_id in (${lsol}); delete from public.evidencias where solicitud_id in (${lsol}); delete from public.comentarios_auditor where objeto_id in (${lsol}); delete from public.solicitudes where id in (${lsol});`);
    if (lista) sql(`delete from public.auditor_actividad where auditor_id in (${lista});`);
  } catch (e) { console.error(`  (limpieza SQL: ${e.message.split("\n")[0]})`); }
  sql(`update public.tenants set es_demo = ${tOrig} where id = '${TENANT}'`);
  for (const id of Object.values(ids)) await svc.auth.admin.deleteUser(id);
  console.log(`\n  (limpieza: es_demo = ${sql(`select es_demo from public.tenants where id = '${TENANT}'`)}; utilería que queda = ${sql(`select count(*) from public.perfiles_usuario where email like '%@${DOM}'`)} perfiles, ${sql(`select count(*) from public.solicitudes where titulo like '[E2E alertas]%'`)} solicitudes)`);
}
console.log(fallas.length ? `\n✗ ${fallas.length} falla(s)` : "\n✓ E2E del resumen diario OK");
process.exit(fallas.length ? 1 : 0);
