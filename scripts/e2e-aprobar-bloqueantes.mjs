#!/usr/bin/env node
// =============================================================================
// E2E · un documento con bloques seleccionados sin terminar no se aprueba
// (hallazgo del Paso 4 del encargo suplemento-calidad).
//
//   node scripts/e2e-aprobar-bloqueantes.mjs [baseUrl]      (default http://localhost:3016)
//
// SOLO contra el stack local, con la app de la rama corriendo contra él. No
// llama al modelo. Documento de utilería de Empresa Demo creado y borrado por
// psql, con cuatro bloques:
//   · 5 borrador con texto (listo);
//   · 9 el que se va moviendo de estado;
//   · 6 no_aplica y 7 no_seleccionado, sin texto: no cuentan.
// Para cada estado del 9 que debe bloquear —en_cola, generando, error,
// pendiente_adjunto, borrador sin texto, borrador con un pendiente—:
//   · la pantalla deshabilita «Aprobar» y dice el motivo con el número de bloque;
//   · un POST directo a la acción (el formulario «Pasar a revisión» con
//     estado=aprobado, la técnica de e2e-aprobar-solo-staff) se rechaza con el
//     mismo motivo y el documento sigue en borrador.
// Con el 9 terminado y sin pendientes, «Aprobar» se habilita y aprueba.
// =============================================================================
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3016";
const CLAVE = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.error(`✗ Solo contra una app local, no ${BASE}.`); process.exit(2); }

const sql = (q) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", q], {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
  }).trim();
const estado = (id) => sql(`select estado from public.documentos_generados where id = '${id}'`);
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };

const nav = await chromium.launch();
const page = await (await nav.newContext()).newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', "admin@irstrat.example");
await page.fill('input[type="password"]', CLAVE);
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }), page.click('button[type="submit"]')]);

const version = Number(sql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id = '${REPORTE}'`));
const doc = sql(`insert into public.documentos_generados (tenant_id, reporte_id, estado, version) values ('${TENANT}', '${REPORTE}', 'borrador', ${version}) returning id`).split("\n")[0];
const fila = (n, clave, estadoB, texto) =>
  sql(`insert into public.documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado, texto, pendientes) values ('${doc}', ${n}, '${clave}', 'Bloque ${n}', 'I · Introducción', 'es', '${estadoB}', ${texto ? `'${texto}'` : "null"}, '[]')`);
fila(5, "conexiones", "borrador", "Texto terminado del bloque cinco.");
fila(6, "juicios_incertidumbres", "no_aplica", null);
fila(7, "materialidad", "no_seleccionado", null);
fila(9, "priorizacion_riesgos", "en_cola", null);

async function abrir() {
  await page.goto(`${BASE}/admin/cobertura/suplemento/${doc}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByRole("button", { name: "Aprobar", exact: true }).waitFor({ timeout: 60000 });
}
/** El formulario «Pasar a revisión» con estado=aprobado: la acción real, sin el botón deshabilitado. */
async function postAprobar() {
  const form = page.locator("form", { has: page.getByRole("button", { name: "Pasar a revisión" }) });
  await form.locator('input[name="estado"]').evaluate((el) => { el.value = "aprobado"; });
  await form.getByRole("button", { name: "Pasar a revisión" }).click();
  const aviso = page.locator('[aria-live="polite"] [role="alert"], [aria-live="polite"] [role="status"]').last();
  await aviso.waitFor({ timeout: 30000 }).catch(() => {});
  return (await aviso.innerText().catch(() => "")).replace(/\s+/g, " ");
}

const CASOS = [
  { nombre: "en cola", sql: `estado = 'en_cola', texto = null`, motivo: /1 en cola \(9\)/ },
  { nombre: "generándose", sql: `estado = 'generando', texto = null`, motivo: /1 generándose \(9\)/ },
  { nombre: "con error", sql: `estado = 'error', texto = null`, motivo: /1 con error \(9\)/ },
  { nombre: "esperando adjunto", sql: `estado = 'pendiente_adjunto', texto = null`, motivo: /1 espera su documento adjunto \(9\)/ },
  { nombre: "borrador sin texto", sql: `estado = 'borrador', texto = null`, motivo: /1 sin texto \(9\)/ },
  {
    nombre: "borrador con un pendiente",
    sql: `estado = 'borrador', texto = 'Texto con [Pendiente: dato — solicitud X].', pendientes = '[{"campo":"bloque","motivo":"[Pendiente: dato — solicitud X]"},{"campo":"nota_revision","motivo":"una nota no bloquea"}]'`,
    motivo: /1 con pendientes \(9\)/,
  },
];

try {
  for (const c of CASOS) {
    console.log(`\nBloque 9 ${c.nombre}`);
    sql(`update public.documentos_bloques set ${c.sql} where documento_id = '${doc}' and numero = 9`);
    await abrir();
    const boton = page.getByRole("button", { name: "Aprobar", exact: true });
    const motivo = (await page.locator("[data-motivo-bloqueo]").innerText().catch(() => "")).trim();
    ok(await boton.isDisabled(), "«Aprobar» deshabilitado");
    ok(c.motivo.test(motivo) && c.motivo.test((await boton.getAttribute("title")) ?? ""), `motivo en pantalla y en el botón: «${motivo}»`);
    ok(!/\(5|, 5|\(6|\(7/.test(motivo), "no menciona el 5 (listo) ni el 6 y el 7 (no aplica, no seleccionado)");
    const aviso = await postAprobar();
    ok(c.motivo.test(aviso), `POST directo rechazado por el servidor: «${aviso}»`);
    ok(estado(doc) === "borrador", `el documento sigue en borrador (${estado(doc)})`);
  }

  console.log("\nBloque 9 terminado, sin pendientes (solo una nota al revisor)");
  sql(`update public.documentos_bloques set estado = 'borrador', texto = 'Texto terminado del bloque nueve.', pendientes = '[{"campo":"nota_revision","motivo":"una nota no bloquea"}]' where documento_id = '${doc}' and numero = 9`);
  await abrir();
  const boton = page.getByRole("button", { name: "Aprobar", exact: true });
  ok(!(await boton.isDisabled()), "«Aprobar» habilitado");
  await boton.click();
  const fin = Date.now() + 30000;
  while (Date.now() < fin && estado(doc) !== "aprobado") await new Promise((r) => setTimeout(r, 1000));
  ok(estado(doc) === "aprobado", `aprobado (${estado(doc)})`);
} finally {
  await nav.close();
  sql(`delete from public.documentos_generados where id = '${doc}'`);
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ E2E aprobar-bloqueantes OK");
process.exit(fallas.length ? 1 : 0);
