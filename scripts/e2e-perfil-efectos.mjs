#!/usr/bin/env node
// =============================================================================
// E2E · sección «Efectos financieros» del Perfil del emisor (encargo
// 2026-10-29-perfil-declaraciones-alta, Fase 1). Navegador real (Playwright) y
// sesión real del staff, contra el stack LOCAL y `next dev` en el puerto dado.
//
//   node scripts/e2e-perfil-efectos.mjs [baseUrl]      (por omisión http://localhost:3016)
//
//   1. La sección existe, con sus dos campos, sus ayudas y los ejemplos con la
//      elección entre corchetes.
//   2. Con un solo campo escrito la sección sigue «Vacía»; un adjunto no la
//      completa (la regla está en la pantalla: completa = los dos textos).
//   3. Guardar desde la pantalla escribe los dos campos en `perfil_emisor`, y
//      al recargar la pantalla muestra lo guardado y la sección «Con datos».
//   4. Vaciar un campo y guardar lo deja en NULL (no en cadena vacía).
//   5. Restauración: los dos campos vuelven a lo que tenían antes de la prueba,
//      comprobado contra la base. Si Empresa Demo no tenía fila de perfil (el
//      seed local no la trae), la fila que creó la pantalla se borra.
// La base se lee y se restaura con psql del stack local: ahí service_role no
// tiene INSERT/UPDATE/DELETE sobre perfil_emisor.
// =============================================================================
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3016";
const TENANT = "10000000-0000-0000-0000-000000000001"; // Empresa Demo del seed local
const CAMPOS = ["criterio_cuantificacion", "congruencia_estados_financieros"];
const PRUEBA = {
  criterio_cuantificacion: "La Compañía no proporciona información cuantitativa (texto de prueba e2e).",
  congruencia_estados_financieros: "Los datos y supuestos son congruentes con los estados financieros (texto de prueba e2e).",
};
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.error("✗ Solo contra el servidor local."); process.exit(2); }

const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atc", sql], { env: { ...process.env, PGPASSWORD: "postgres" }, encoding: "utf8" }).trim();
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };
/** La fila de perfil de Empresa Demo (solo los dos campos), o null si no existe. */
const leer = () => {
  const j = psql(`select json_build_object(${CAMPOS.map((c) => `'${c}', ${c}`).join(", ")}) from perfil_emisor where tenant_id = '${TENANT}'`);
  return j ? JSON.parse(j) : null;
};

const antes = leer();
console.log(antes ? "Empresa Demo tiene fila de perfil: se restauran los dos campos al terminar." : "Empresa Demo sin fila de perfil: la que cree la pantalla se borra al terminar.");

const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

/** Abre la pantalla con la sección desplegada y los campos manuales visibles. */
async function abrir() {
  await page.goto(`/admin/perfil?tenant=${TENANT}&seccion=efectos`, { waitUntil: "networkidle", timeout: 60_000 });
  const tarjeta = page.locator("div").filter({ has: page.getByRole("button", { name: /Efectos financieros/ }) }).last();
  const plegados = tarjeta.getByRole("button", { name: "Capturar o complementar manualmente" });
  if (await plegados.count()) await plegados.first().click();
  await page.locator('textarea[name="criterio_cuantificacion"]').waitFor({ timeout: 15_000 });
  return tarjeta;
}
const chip = async () => (await page.getByRole("button", { name: /Efectos financieros/ }).innerText()).trim();
async function guardarCon(valores) {
  for (const c of CAMPOS) await page.locator(`textarea[name="${c}"]`).fill(valores[c] ?? "");
  const form = page.locator("form").filter({ has: page.locator('textarea[name="criterio_cuantificacion"]') });
  await form.getByRole("button", { name: /Guardar sección/ }).click();
  await page.getByRole("button", { name: /Efectos financieros/ }).filter({ hasText: "Actualizada" }).waitFor({ timeout: 30_000 });
}

try {
  console.log(`Base: ${BASE} · Empresa Demo (${TENANT})`);
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.fill("#email", "admin@irstrat.example");
  await page.fill("#password", "Demo2025!");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }), page.click('button[type="submit"]')]);

  console.log("\n1. La sección y sus ayudas");
  await abrir();
  const ph1 = await page.locator('textarea[name="criterio_cuantificacion"]').getAttribute("placeholder");
  const ph2 = await page.locator('textarea[name="congruencia_estados_financieros"]').getAttribute("placeholder");
  ok(/\[proporciona \/ no proporciona\]/.test(ph1 ?? ""), "ejemplo del criterio con la elección entre corchetes");
  ok(/\[son \/ no son del todo\]/.test(ph2 ?? ""), "ejemplo de la congruencia con la elección entre corchetes");
  ok(await page.getByText(/NIIF S2 19\s+y 20/).count() > 0, "ayuda del criterio cita NIIF S2 19 y 20");
  ok(await page.getByText(/NIIF S2 B65\(e\)/).count() > 0, "ayuda de la congruencia cita NIIF S2 B65(e)");

  console.log("\n2. Completa solo con los dos textos");
  await guardarCon({ criterio_cuantificacion: PRUEBA.criterio_cuantificacion, congruencia_estados_financieros: "" });
  await abrir();
  ok(/Vacía/.test(await chip()), "un solo campo escrito: la sección sigue «Vacía»");
  // Un adjunto de la sección (solo la fila: el CHECK ampliado la admite) no la completa.
  let adj = null;
  try {
    adj = psql(`insert into perfil_emisor_adjuntos (tenant_id, seccion, archivo_path, nombre_original, mime, tamano) values ('${TENANT}', 'efectos', '${TENANT}/perfil/efectos/e2e-${Date.now()}.pdf', 'e2e.pdf', 'application/pdf', 1) returning id`).split("\n")[0];
  } catch (e) { adj = null; console.log(`    ${String(e.stderr ?? e.message).split("\n")[0]}`); }
  ok(!!adj, "el CHECK admite seccion = 'efectos'");
  await abrir();
  ok(/Vacía/.test(await chip()), "con un adjunto y un solo campo: sigue «Vacía»");
  if (adj) psql(`delete from perfil_emisor_adjuntos where id = '${adj}'`);

  console.log("\n3. Guardar los dos y recargar");
  await guardarCon(PRUEBA);
  const guardado = leer();
  for (const c of CAMPOS) ok(guardado[c] === PRUEBA[c], `${c} guardado en la base`);
  await abrir();
  for (const c of CAMPOS) ok((await page.locator(`textarea[name="${c}"]`).inputValue()) === PRUEBA[c], `${c} se muestra al recargar`);
  ok(/Con datos/.test(await chip()), "la sección dice «Con datos»");

  console.log("\n4. Vaciar un campo");
  await guardarCon({ ...PRUEBA, congruencia_estados_financieros: "" });
  ok(leer()?.congruencia_estados_financieros === null, "el campo vacío queda en NULL");
} catch (e) {
  fallas.push(`excepción: ${e.message}`);
  console.log(`  ✗ excepción: ${e.message}`);
} finally {
  console.log("\n5. Restauración");
  if (!antes) {
    psql(`delete from perfil_emisor where tenant_id = '${TENANT}'`);
    ok(leer() === null, "la fila de perfil que creó la prueba, borrada (Empresa Demo vuelve a no tener)");
  } else {
    const lit = (v) => (v === null ? "null" : `$e2e$${v}$e2e$`);
    psql(`update perfil_emisor set ${CAMPOS.map((c) => `${c} = ${lit(antes[c])}`).join(", ")} where tenant_id = '${TENANT}'`);
    const despues = leer();
    ok(CAMPOS.every((c) => despues?.[c] === antes[c]), "los dos campos, iguales a antes de la prueba");
  }
  await browser.close();
}

console.log(fallas.length ? `\n✗ ${fallas.length} falla(s).` : "\n✓ Perfil · efectos financieros en orden.");
process.exit(fallas.length ? 1 : 0);
