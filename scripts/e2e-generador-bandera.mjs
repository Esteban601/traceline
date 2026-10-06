#!/usr/bin/env node
// =============================================================================
// E2E · bandera y tope del generador por emisora (encargo 2026-10-05,
// generador a producción).
//
//   node scripts/e2e-generador-bandera.mjs [baseUrl]     (default http://localhost:3007)
//
// SOLO contra el stack local, con la app corriendo contra él. No llama al
// modelo: el POST …/generar solo crea la cola del documento, y de …/bloque solo
// se prueba el rechazo.
//
//   1. generador_activo = false → las tres rutas rechazan en el servidor (403):
//      generar, bloque y word.
//   2. generaciones_mes_max = corridas del mes + 1 → una corrida completa pasa y
//      la siguiente se rechaza (429). generaciones_mes_max = 0 → 403.
//   3. La pantalla: con la bandera apagada, Cobertura no ofrece el generador y
//      la página del generador no ofrece generar; /admin/clientes muestra el
//      interruptor con el consumo del mes.
// Restaura las banderas de Empresa Demo al terminar.
// =============================================================================
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3007";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
// Llave PÚBLICA de demostración del stack local de Supabase (la misma de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const CLAVE_DEMO = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
if (!/127\.0\.0\.1|localhost/.test(URL_SB)) { console.error(`✗ Solo contra el stack local, no ${URL_SB}.`); process.exit(2); }

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

// Sesión del admin de IRStrat: mueve las banderas (como /admin/clientes) y llama a las rutas.
const jar = new Map();
const db = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: CLAVE_DEMO });
if (eLogin) throw new Error(`login: ${eLogin.message}`);
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
const ruta = (metodo, camino, cuerpo) =>
  fetch(`${BASE}${camino}`, { method: metodo, headers: { cookie: cookie(), "content-type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined, redirect: "manual" });
const banderas = async (cambios) => { const { error } = await db.from("tenants").update(cambios).eq("id", TENANT); if (error) throw new Error(`banderas: ${error.message}`); };
const corridas = async () => {
  const d = new Date(); const desde = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  const { count } = await db.from("bitacora").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT).eq("accion", "suplemento_documento_abierto").gte("created_at", desde);
  return count ?? 0;
};

const { data: original } = await db.from("tenants").select("generador_activo, generaciones_mes_max").eq("id", TENANT).single();
console.log(`\nEmpresa Demo antes: generador_activo=${original.generador_activo}, generaciones_mes_max=${original.generaciones_mes_max}\n`);
try {
  // 1. Bandera apagada.
  console.log("Bandera apagada");
  await banderas({ generador_activo: false });
  const g = await ruta("POST", `/api/suplemento/${REPORTE}/generar`);
  ok(g.status === 403, `POST generar → ${g.status} «${(await g.json().catch(() => ({}))).error ?? ""}»`);
  const b = await ruta("POST", `/api/suplemento/${REPORTE}/bloque/29`, {});
  ok(b.status === 403, `POST bloque/29 → ${b.status}`);
  const { data: doc } = await db.from("documentos_generados").select("id").eq("reporte_id", REPORTE).limit(1).maybeSingle();
  if (doc) {
    const w = await ruta("GET", `/api/suplemento/${doc.id}/word`);
    ok(w.status === 403, `GET word → ${w.status}`);
  } else {
    console.log("    (sin documento en local: la ruta del Word se prueba en la segunda pasada)");
  }

  // 3. Pantalla con la bandera apagada.
  console.log("Pantalla con la bandera apagada");
  const nav = await chromium.launch();
  const ctx = await nav.newContext();
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, url: BASE })));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/cobertura?reporte=${REPORTE}`, { timeout: 90000 });
  await p.waitForLoadState("networkidle").catch(() => {});
  const enlacesGenerador = await p.locator('a[href*="/admin/cobertura/suplemento"]').count();
  ok(enlacesGenerador === 0, `Cobertura no ofrece el generador (${enlacesGenerador} enlaces)`);
  await p.goto(`${BASE}/admin/cobertura/suplemento?reporte=${REPORTE}`, { timeout: 90000 });
  await p.waitForLoadState("networkidle").catch(() => {});
  const botonesGenerar = await p.getByRole("button", { name: /Generar/ }).count();
  const aviso = await p.getByText(/El generador del suplemento está apagado para esta emisora/).count();
  ok(botonesGenerar === 0 && aviso === 1, `la página del generador no ofrece generar y dice por qué (${botonesGenerar} botones, aviso ${aviso})`);
  await p.goto(`${BASE}/admin/clientes`, { timeout: 90000 });
  await p.waitForLoadState("networkidle").catch(() => {});
  const sw = p.getByRole("switch", { name: /Generador del suplemento para/ });
  ok((await sw.count()) >= 1 && (await sw.first().getAttribute("aria-checked")) === "false", "/admin/clientes muestra el interruptor del generador, apagado");
  const texto = (await sw.first().locator("xpath=..").innerText()).replace(/\s+/g, " ");
  ok(/Este mes: \d+ de \d+ generaciones completas/.test(texto), `y el consumo del mes («${texto.match(/Este mes:[^.]*\./)?.[0] ?? "—"}»)`);
  await nav.close();

  // 2. Tope.
  console.log("Tope mensual");
  const usadas = await corridas();
  await banderas({ generador_activo: true, generaciones_mes_max: usadas + 1 });
  const g1 = await ruta("POST", `/api/suplemento/${REPORTE}/generar`);
  ok(g1.status === 200, `con ${usadas} de ${usadas + 1} usadas, una corrida completa pasa (${g1.status})`);
  ok((await corridas()) === usadas + 1, "y cuenta en la bitácora");
  const g2 = await ruta("POST", `/api/suplemento/${REPORTE}/generar`);
  const j2 = await g2.json().catch(() => ({}));
  ok(g2.status === 429, `la siguiente se rechaza (${g2.status} «${j2.error ?? ""}»)`);
  await banderas({ generaciones_mes_max: 0 });
  const g3 = await ruta("POST", `/api/suplemento/${REPORTE}/generar`);
  ok(g3.status === 403, `generaciones_mes_max = 0 apaga el generador (${g3.status})`);

  // La ruta del Word con la bandera apagada, ya con documento.
  await banderas({ generador_activo: false, generaciones_mes_max: 10 });
  const { data: doc2 } = await db.from("documentos_generados").select("id").eq("reporte_id", REPORTE).limit(1).maybeSingle();
  if (doc2 && !doc) {
    const w = await ruta("GET", `/api/suplemento/${doc2.id}/word`);
    ok(w.status === 403, `GET word con la bandera apagada → ${w.status}`);
  }
} finally {
  await banderas({ generador_activo: original.generador_activo, generaciones_mes_max: original.generaciones_mes_max });
  const { data: fin } = await db.from("tenants").select("generador_activo, generaciones_mes_max").eq("id", TENANT).single();
  console.log(`\n  (Empresa Demo restaurada: generador_activo=${fin.generador_activo}, generaciones_mes_max=${fin.generaciones_mes_max})`);
}
console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ E2E de bandera y tope del generador OK");
process.exit(fallas.length ? 1 : 0);
