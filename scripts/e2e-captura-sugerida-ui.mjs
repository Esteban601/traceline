#!/usr/bin/env node
// =============================================================================
// E2E EN NAVEGADOR de la captura sugerida (Paso 4): subida firmada, bloque y botones.
//
//   CRON_SECRET=… node scripts/e2e-captura-sugerida-ui.mjs [baseUrl]   (default :3003)
//
// SOLO contra el stack local, con la app corriendo con ANTHROPIC_API_KEY y el
// mismo CRON_SECRET: la lectura y la sugerencia de UNA evidencia llaman al
// modelo (unos $0.01).
//
//   1. operaciones@ sube x01 (Excel) desde el formulario del PORTAL: el archivo
//      va directo a storage con URL firmada y la acción solo registra la fila.
//      Un archivo de más de 25 MB se rechaza al elegirlo, con el mensaje propio.
//   2. La cola lee y sugiere (endpoint del cron). El portal muestra «Valor
//      sugerido» con la cifra, la confianza, la fuente (hoja y celda), los
//      candidatos y los botones.
//   3. El auditor abre la misma solicitud en el PANEL: ve el bloque y NO tiene
//      botones.
//   4. operaciones@ confirma desde la pantalla: el bloque dice quién confirmó.
//      El administrador del cliente carga desde el PANEL, también con URL firmada.
//   5. Ninguna de esas páginas deja errores en la consola del navegador.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || "http://localhost:3003";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const CLAVE_DEMO = "Demo2025!";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const CRON = process.env.CRON_SECRET;
if (!/127\.0\.0\.1|localhost/.test(URL_SB)) { console.error("✗ Solo contra el stack local."); process.exit(2); }
if (!CRON) { console.error("✗ Falta CRON_SECRET."); process.exit(2); }

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

// La solicitud de prueba la crea el staff, como en el resto de los e2e.
const staff = createClient(URL_SB, ANON, { auth: { persistSession: false } });
await staff.auth.signInWithPassword({ email: "analista@irstrat.example", password: CLAVE_DEMO });
const marca = `[e2e-ui-sugerencias ${new Date().toISOString().slice(0, 16)}]`;
const { data: m } = await staff.from("solicitudes").select("orden").eq("reporte_id", REPORTE).order("orden", { ascending: false }).limit(1).maybeSingle();
const { data: sol, error: eSol } = await staff.from("solicitudes").insert({
  reporte_id: REPORTE, titulo: "Consumo de electricidad 2025 (prueba de pantalla)", descripcion: marca,
  area_asignada: "Operaciones", es_cuantitativa: true, unidad_esperada: "kWh", estado: "solicitado", orden: (m?.orden ?? 0) + 1,
}).select("id").single();
if (eSol) throw new Error(eSol.message);

const archivo = path.join(AQUI, "captura-sugerida", "conjunto", "x01_electricidad_2025.xlsx");
const grande = path.join(AQUI, "..", ".e2e-grande-30mb.bin");
fs.writeFileSync(grande, Buffer.alloc(30 * 1024 * 1024, 1));

const nav = await chromium.launch();
const errores = [];
async function entrar(email) {
  const ctx = await nav.newContext();
  const p = await ctx.newPage();
  p.on("console", (msg) => { if (msg.type() === "error") errores.push(`${email}: ${msg.text().slice(0, 160)}`); });
  p.on("pageerror", (e) => errores.push(`${email}: ${String(e).slice(0, 160)}`));
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"]', CLAVE_DEMO);
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }), p.click('button[type="submit"]')]);
  return p;
}
const listo = async (p) => { await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(2000); };

try {
  // 1. Subida firmada desde el portal.
  console.log("Subida desde el portal");
  const op = await entrar("operaciones@empresademo.example");
  await op.goto(`${BASE}/portal/solicitudes/${sol.id}`, { timeout: 90000 });
  await listo(op);
  const subidas = [];
  op.on("request", (r) => { if (r.method() !== "GET" && /\/storage\/v1\/object\/upload\/sign\//.test(r.url())) subidas.push(r.url()); });
  await op.setInputFiles("#evidencia-file", grande);
  await op.waitForTimeout(800);
  ok((await op.getByText("El archivo supera 25 MB; comprímalo o divídalo.").count()) > 0, "un archivo de 30 MB se rechaza al elegirlo, con el mensaje propio");
  await op.setInputFiles("#evidencia-file", archivo);
  await op.waitForTimeout(800);
  await op.fill("#periodo", "2025");
  const area = op.locator('input[placeholder="Ej. Operaciones"]');
  if (await area.count()) await area.first().fill("Operaciones");
  await op.getByRole("button", { name: /^(Enviar|Reenviar)$/ }).click();
  await op.getByText(/recibimos tu archivo/i).first().waitFor({ timeout: 60000 }).catch(() => {});
  ok(subidas.length === 1, `el archivo viajó directo a storage con URL firmada (${subidas.length} subida firmada)`);
  const { data: evs } = await staff.from("evidencias").select("id, version, nombre_original").eq("solicitud_id", sol.id);
  ok(evs?.length === 1 && evs[0].nombre_original === "x01_electricidad_2025.xlsx", "la acción registró la evidencia con su nombre original");

  // 2. Lectura y sugerencia.
  console.log("Sugerencia en pantalla");
  for (let i = 0; i < 6; i++) {
    await fetch(`${BASE}/api/evidencias/procesar?maximo=3`, { method: "POST", headers: { "x-cron-secret": CRON } });
    const { count } = await staff.from("sugerencias_captura").select("id", { count: "exact", head: true }).eq("solicitud_id", sol.id);
    if (count) break;
  }
  await op.reload();
  await listo(op);
  const bloque = op.locator('section[aria-label="Valor sugerido"]');
  ok((await bloque.count()) === 1, "el portal muestra «Valor sugerido» bajo la evidencia vigente");
  const texto = (await bloque.innerText()).replace(/\s+/g, " ");
  ok(/376,300/.test(texto) && /kWh/.test(texto), `con la cifra y la unidad («${texto.match(/[\d,.]+ kWh[^·]*/)?.[0]?.trim() ?? texto.slice(0, 60)}»)`);
  ok(/Confianza (alta|media|baja)/.test(texto), "con la confianza en palabras");
  ok(/Hoja «Energía», celda B14/.test(texto), "con la fuente: hoja y celda");
  ok(/Otras cifras posibles/.test(texto), "con los candidatos desplegables");
  ok((await bloque.getByRole("button", { name: "Confirmar" }).count()) === 1, "el responsable del área ve Confirmar / Corregir / Rechazar");

  // 3. El auditor, en el panel.
  console.log("Auditor");
  const aud = await entrar("auditor.externo@despacho.example");
  await aud.goto(`${BASE}/admin/solicitudes/${sol.id}`, { timeout: 90000 });
  await listo(aud);
  const bloqueAud = aud.locator('section[aria-label="Valor sugerido"]');
  ok((await bloqueAud.count()) === 1, "el auditor ve el bloque en el panel");
  ok((await bloqueAud.getByRole("button").count()) === 0, "y no tiene ningún botón");

  // 4. Confirmar desde la pantalla.
  console.log("Confirmar");
  await bloque.getByRole("button", { name: "Confirmar" }).click();
  await op.getByText(/Sugerencia confirmada/).first().waitFor({ timeout: 30000 }).catch(() => {});
  await op.reload();
  await listo(op);
  const tras = (await op.locator('section[aria-label="Valor sugerido"]').innerText()).replace(/\s+/g, " ");
  ok(/Confirmada por/.test(tras), `el bloque dice quién confirmó («${tras.match(/Confirmada por[^·]*/)?.[0]?.trim() ?? "—"}»)`);
  const { data: caps } = await staff.from("capturas_valor").select("valor, unidad, origen").eq("solicitud_id", sol.id);
  ok(caps?.some((c) => c.origen === "sugerida" && Number(c.valor) === 376300), "la captura quedó con origen «sugerida»");

  // 4b. Carga desde el PANEL (administrador del cliente), también con URL firmada.
  console.log("Carga desde el panel");
  const { data: sol2, error: eSol2 } = await staff.from("solicitudes").insert({
    reporte_id: REPORTE, titulo: "Política ambiental (prueba de pantalla)", descripcion: marca,
    area_asignada: "Finanzas", es_cuantitativa: false, estado: "solicitado", orden: (m?.orden ?? 0) + 2,
  }).select("id").single();
  if (eSol2) throw new Error(eSol2.message);
  const adm = await entrar("admin.cliente@empresademo.example");
  await adm.goto(`${BASE}/admin/solicitudes/${sol2.id}`, { timeout: 90000 });
  await listo(adm);
  const firmadasPanel = [];
  adm.on("request", (r) => { if (r.method() !== "GET" && /\/storage\/v1\/object\/upload\/sign\//.test(r.url())) firmadasPanel.push(r.url()); });
  await adm.getByRole("button", { name: "Cargar archivo" }).click();
  await adm.setInputFiles(`#carga-panel-file-${sol2.id}`, path.join(AQUI, "captura-sugerida", "conjunto", "w01_politica_ambiental.docx"));
  const selArea = adm.locator(`#carga-area-${sol2.id}`);
  if ((await selArea.evaluate((e) => e.tagName)) === "SELECT") await selArea.selectOption("Finanzas"); else await selArea.fill("Finanzas");
  await adm.fill(`#carga-periodo-${sol2.id}`, "2025");
  await adm.getByRole("button", { name: "Cargar evidencia" }).click();
  await adm.getByText(/Evidencia v1 registrada/).first().waitFor({ timeout: 60000 }).catch(() => {});
  const { data: evs2 } = await staff.from("evidencias").select("nombre_original").eq("solicitud_id", sol2.id);
  ok(firmadasPanel.length === 1 && evs2?.length === 1, `el panel sube con URL firmada y registra la evidencia (${firmadasPanel.length} firmada, ${evs2?.length ?? 0} registrada)`);

  // 5. Consola.
  ok(errores.length === 0, `consola limpia en portal y panel (${errores.length} errores${errores.length ? `: ${errores.slice(0, 2).join(" | ")}` : ""})`);
} finally {
  await nav.close();
  fs.rmSync(grande, { force: true });
}
console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ E2E de pantalla OK");
process.exit(fallas.length ? 1 : 0);
