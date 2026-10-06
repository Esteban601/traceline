#!/usr/bin/env node
// =============================================================================
// E2E · aprobar el Suplemento es solo de IRStrat (hotfix/aprobar-solo-staff).
//
//   node scripts/e2e-aprobar-solo-staff.mjs [baseUrl]      (default http://localhost:3012)
//
// SOLO contra el stack local, con la app corriendo contra él. Documento de
// utilería en borrador sobre Empresa Demo, creado y borrado por psql (en local,
// service_role no escribe en documentos_generados).
//
// El POST directo: el admin del cliente sí tiene en pantalla el formulario
// «Pasar a revisión», que llama a la MISMA server action. Se le cambia el campo
// oculto `estado` y se envía: es una petición real a la acción, sin botón de por
// medio. El servidor tiene que rechazarla y el estado no se mueve.
// =============================================================================
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3012";
const DB_LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const PSQL = process.env.PSQL || "/opt/homebrew/opt/postgresql@17/bin/psql";
const CLAVE = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.error(`✗ Solo contra una app local, no ${BASE}.`); process.exit(2); }

const sql = (q) => execFileSync(PSQL, [DB_LOCAL, "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", q], { encoding: "utf8" }).trim();
const estado = (id) => sql(`select estado from public.documentos_generados where id = '${id}'`);
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };

const nav = await chromium.launch();
async function entrar(email) {
  const page = await (await nav.newContext()).newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', CLAVE);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }), page.click('button[type="submit"]')]);
  return page;
}
/** Envía el formulario «Pasar a revisión» con otro `estado` y devuelve el texto del aviso. */
async function postConEstado(page, docId, destino) {
  await page.goto(`${BASE}/admin/cobertura/suplemento/${docId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const form = page.locator("form", { has: page.getByRole("button", { name: "Pasar a revisión" }) });
  await form.waitFor({ timeout: 60000 });
  await form.locator('input[name="estado"]').evaluate((el, v) => { el.value = v; }, destino);
  await form.getByRole("button", { name: "Pasar a revisión" }).click();
  const aviso = page.locator('[aria-live="polite"] [role="alert"], [aria-live="polite"] [role="status"]').last();
  await aviso.waitFor({ timeout: 30000 }).catch(() => {});
  return (await aviso.innerText().catch(() => "")).replace(/\s+/g, " ");
}

const docId = sql(`insert into public.documentos_generados (tenant_id, reporte_id, estado, version) values ('${TENANT}', '${REPORTE}', 'borrador', ${800 + Math.floor(Math.random() * 99)}) returning id`).split("\n")[0];
try {
  console.log("\nAdmin del cliente");
  const cli = await entrar("admin.cliente@empresademo.example");
  await cli.goto(`${BASE}/admin/cobertura/suplemento/${docId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await cli.getByRole("button", { name: "Pasar a revisión" }).waitFor({ timeout: 60000 });
  ok((await cli.getByRole("button", { name: "Aprobar" }).count()) === 0, "no ve el botón «Aprobar»");

  let aviso = await postConEstado(cli, docId, "aprobado");
  ok(/equipo de IRStrat/.test(aviso), `POST directo con estado=aprobado → rechazo del servidor («${aviso}»)`);
  ok(estado(docId) === "borrador", `el documento sigue en borrador (${estado(docId)})`);

  sql(`update public.documentos_generados set estado = 'borrador' where id = '${docId}'`);
  aviso = await postConEstado(cli, docId, "borrador");
  ok(/equipo de IRStrat/.test(aviso), `POST directo con estado=borrador → rechazo del servidor («${aviso}»)`);

  aviso = await postConEstado(cli, docId, "en_revision");
  ok(estado(docId) === "en_revision", `pasar a revisión sí puede (${estado(docId)}; «${aviso}»)`);

  console.log("\nStaff");
  const staff = await entrar("analista@irstrat.example");
  await staff.goto(`${BASE}/admin/cobertura/suplemento/${docId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const boton = staff.getByRole("button", { name: "Aprobar" });
  await boton.waitFor({ timeout: 60000 });
  ok((await boton.count()) === 1, "ve el botón «Aprobar»");
  await boton.click();
  await staff.locator('[aria-live="polite"] [role="status"]').last().waitFor({ timeout: 30000 }).catch(() => {});
  for (let i = 0; i < 20 && estado(docId) !== "aprobado"; i++) await new Promise((r) => setTimeout(r, 500));
  ok(estado(docId) === "aprobado", `aprueba (${estado(docId)})`);
} finally {
  await nav.close();
  sql(`delete from public.documentos_generados where id = '${docId}'`);
}
console.log(fallas.length ? `\n✗ ${fallas.length} falla(s)` : "\n✓ E2E aprobar-solo-staff OK");
process.exit(fallas.length ? 1 : 0);
