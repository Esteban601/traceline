#!/usr/bin/env node
// -----------------------------------------------------------------------------
// El código ACTUAL de `main` contra la base YA MIGRADA de ensayo (preparación
// del paso 5 del encargo rol auditor).
//
//   node scripts/ensayo/verificar-main.mjs            (BASE_URL, por omisión http://localhost:3002)
//
// Es el estado de la base durante el hueco entre migrar staging y desplegar el
// código, y el de un rollback de código con las migraciones puestas. Requiere
// la app de `main` corriendo contra ensayo y, en el entorno,
// NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY de ensayo.
//
// Qué afirma:
//   A. Cada rol que existe en `main` entra y abre sus pantallas sin error.
//   B. Los roles que no son auditor siguen ESCRIBIENDO: la barrera restrictiva
//      solo debe caerle al auditor. Se escribe por la misma vía que la app (RLS
//      con la sesión del rol) sobre Empresa Demo, con el marcador
//      [verificar-main] en el texto, y se borra al final.
// Los Excel se comparan aparte, con descargar-excel.mjs y comparar-excel.mjs.
// -----------------------------------------------------------------------------
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3002";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Demo2025!";
// Contra una copia de staging las cuentas del seed están rotadas: E2E_CREDENCIALES
// apunta al JSON que deja scripts/despliegue/rotar-cuentas-seed.mjs. No se imprime.
const CREDENCIALES = process.env.E2E_CREDENCIALES ? JSON.parse(fs.readFileSync(process.env.E2E_CREDENCIALES, "utf8")) : {};
const claveDe = (email) => CREDENCIALES[email]?.password ?? PASSWORD;
const TENANT_DEMO = "10000000-0000-0000-0000-000000000001";
const REPORTE_DEMO = "20000000-0000-0000-0000-000000000001";
const SOLICITUD_DEMO = "c0000000-0000-0000-0000-000000000002";
const MARCA = "[verificar-main]";

if (!URL_SB || !ANON || !URL_SB.includes("sqpxcxewoznhpwvhxamy")) {
  console.error("✗ Esta verificación corre solo contra ensayo (NEXT_PUBLIC_SUPABASE_URL de ensayo).");
  process.exit(2);
}
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE)) {
  console.error(`✗ BASE_URL debe ser una app local, no ${BASE}.`);
  process.exit(2);
}

// --limpiar: retira los archivos de prueba del bucket con service_role (el
// usuario de área no puede borrar los suyos, y storage.objects no admite DELETE
// por SQL). Los comentarios se borran con borrar-verificar-main.sql.
if (process.argv.includes("--limpiar")) {
  const svc = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: sols } = await svc.from("solicitudes").select("id").eq("reporte_id", REPORTE_DEMO);
  const rutas = [];
  for (const { id } of sols ?? []) {
    const { data } = await svc.storage.from("evidencias").list(`${TENANT_DEMO}/${id}`, { search: "verificar-main-" });
    for (const f of data ?? []) if (f.name.startsWith("verificar-main-")) rutas.push(`${TENANT_DEMO}/${id}/${f.name}`);
  }
  const rm = rutas.length ? await svc.storage.from("evidencias").remove(rutas) : { data: [], error: null };
  console.log(rm.error ? `✗ ${rm.error.message}` : `✓ ${rm.data.length} de ${rutas.length} archivos de prueba retirados`);
  process.exit(rm.error || rm.data.length !== rutas.length ? 1 : 0);
}

const problemas = [];
function ok(c, m) {
  console.log(`  ${c ? "✓" : "✗"} ${m}`);
  if (!c) problemas.push(m);
  return c;
}

const RUTAS = {
  "analista@irstrat.example": [
    "/admin", "/admin/cobertura", `/admin/solicitudes/${SOLICITUD_DEMO}`, "/admin/usuarios",
    "/admin/bitacora", "/admin/clientes", "/admin/reportes", "/admin/plantillas",
    "/admin/registros", "/admin/objetivos", "/admin/cuestionarios",
  ],
  "admin@irstrat.example": ["/admin", "/admin/usuarios", "/admin/bitacora"],
  "admin.cliente@empresademo.example": [
    "/admin", "/admin/cobertura", `/admin/solicitudes/${SOLICITUD_DEMO}`, "/admin/usuarios",
    "/admin/bitacora", "/portal",
  ],
  "coordinador@empresademo.example": ["/portal"],
  "rh@empresademo.example": ["/portal"],
};

// -----------------------------------------------------------------------------
console.log(`Servidor: ${BASE}\n\n════════ A · Pantallas por rol ════════`);
const nav = await chromium.launch();
for (const [email, rutas] of Object.entries(RUTAS)) {
  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', claveDe(email));
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }),
    page.click('button[type="submit"]'),
  ]);
  console.log(`  ${email} → entra a ${new URL(page.url()).pathname}`);
  for (const ruta of rutas) {
    const resp = await page.goto(`${BASE}${ruta}`, { waitUntil: "load", timeout: 90000 });
    await page.waitForTimeout(800);
    const fin = new URL(page.url()).pathname;
    const cuerpo = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const roto = /Application error|Unhandled Runtime Error|Algo salió mal|Something went wrong/i.test(cuerpo);
    ok(
      (resp?.status() ?? 0) < 500 && !roto && !fin.startsWith("/login"),
      `${email} ${ruta} → ${resp?.status()} · acaba en ${fin}${roto ? " · PANTALLA DE ERROR" : ""}`
    );
  }
  await ctx.close();
}
await nav.close();

// -----------------------------------------------------------------------------
console.log("\n════════ B · Los roles que no son auditor siguen escribiendo ════════");
async function sesion(email) {
  const c = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: claveDe(email) });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { c, id: data.user.id };
}

for (const email of ["analista@irstrat.example", "admin.cliente@empresademo.example", "rh@empresademo.example"]) {
  const { c, id } = await sesion(email);
  const { data: sol } = await c.from("solicitudes").select("id")
    .eq("reporte_id", REPORTE_DEMO).limit(1).single();
  const ins = await c.from("comentarios").insert({
    solicitud_id: sol?.id, autor_id: id, contenido: `${MARCA} comentario de ${email}`,
  }).select("id").single();
  ok(!ins.error && !!ins.data, `${email}: INSERT en comentarios${ins.error ? ` — ${ins.error.message}` : ""}`);

  if (email === "rh@empresademo.example") {
    const ruta = `${TENANT_DEMO}/${sol?.id}/verificar-main-${Date.now()}.txt`;
    const up = await c.storage.from("evidencias").upload(ruta, new Blob([MARCA]), { contentType: "text/plain" });
    ok(!up.error, `${email}: subida a storage${up.error ? ` — ${up.error.message}` : ""}`);
    if (!up.error) {
      // Que el usuario de área pueda o no borrar su archivo no es lo que se
      // prueba: si no puede, lo retira el SQL de limpieza.
      const rm = await c.storage.from("evidencias").remove([ruta]);
      const borrado = !rm.error && (rm.data?.length ?? 0) > 0;
      console.log(`  · ${email}: ${borrado ? "retira su archivo de prueba" : "no retira su archivo; lo retira el SQL de limpieza"}`);
    }
  }
  await c.auth.signOut();
}

console.log(`\n════════ RESULTADO ════════`);
if (problemas.length === 0) console.log("  Todo verde.");
else {
  console.log(`  ${problemas.length} problema(s):`);
  for (const p of problemas) console.log(`   · ${p}`);
}
console.log(`  Los comentarios con ${MARCA} se borran con el SQL de limpieza del ensayo.`);
process.exit(problemas.length === 0 ? 0 : 1);
