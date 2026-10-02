/**
 * =============================================================================
 * E2E de la VITRINA del Suplemento, encendida y apagada por emisora.
 *
 *   npm run dev            (en otra terminal; o dev:local)
 *   node scripts/e2e-vitrina.mjs [baseUrl]
 *
 * Requiere `supabase start` y el seed (Empresa Demo, es_demo = true). Prueba
 * contra el SERVIDOR, con sesiones reales del staff y del admin del cliente.
 *
 * Desde el 01/10/2026 la vitrina depende de `es_demo AND vitrina_habilitada`
 * (encargo mockup AINDA, Fase 0). Lo que se afirma:
 *
 *   A. Encendida: el botón «Suplemento S1 y S2» está en Cobertura, el Word se
 *      descarga (200) y la descarga queda en la bitácora.
 *   B. Apagada: el botón no está, Word y PDF responden 404 —para el staff y para
 *      el admin del cliente— y NO se escribe ninguna fila de bitácora.
 *   C. Al final se vuelve a encender: la prueba deja la base como la encontró,
 *      aunque falle a la mitad.
 * =============================================================================
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const PASSWORD = "Demo2025!";
const TENANT_DEMO = "10000000-0000-0000-0000-000000000001";
const REPORTE_DEMO = "20000000-0000-0000-0000-000000000001";
const CUENTAS = {
  staff: "analista@irstrat.example",
  adminCliente: "admin.cliente@empresademo.example",
};

if (!/127\.0\.0\.1|localhost/.test(URL_SB)) {
  console.error(`✗ Esta prueba apaga la vitrina de Empresa Demo: solo corre contra el stack local, no contra ${URL_SB}.`);
  process.exit(2);
}

const problemas = [];
let seccion = "";
function bloque(t) {
  seccion = t;
  console.log(`\n════════ ${t} ════════`);
}
function ok(c, m) {
  console.log(`  ${c ? "✓" : "✗"} ${m}`);
  if (!c) problemas.push(`[${seccion}] ${m}`);
  return c;
}

async function sesionDb(email) {
  const c = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function entrar(nav, email) {
  const pagina = await (await nav.newContext()).newPage();
  await pagina.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await pagina.fill('input[type="email"]', email);
  await pagina.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    pagina.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }),
    pagina.click('button[type="submit"]'),
  ]);
  return pagina;
}

/** Filas «suplemento_demo_descargado» del reporte demo, vistas por el staff. */
async function descargasEnBitacora(staffDb) {
  const { count, error } = await staffDb
    .from("bitacora")
    .select("id", { count: "exact", head: true })
    .eq("accion", "suplemento_demo_descargado")
    .eq("entidad_id", REPORTE_DEMO);
  if (error) throw new Error(`bitácora: ${error.message}`);
  return count ?? 0;
}

async function ponerVitrina(staffDb, valor) {
  const { error } = await staffDb
    .from("tenants")
    .update({ vitrina_habilitada: valor })
    .eq("id", TENANT_DEMO);
  if (error) throw new Error(`vitrina_habilitada = ${valor}: ${error.message}`);
}

async function hayBoton(pagina) {
  await pagina.goto(`${BASE}/admin/cobertura?tenant=${TENANT_DEMO}&reporte=${REPORTE_DEMO}`, {
    waitUntil: "load",
    timeout: 90000,
  });
  const boton = pagina.getByRole("button", { name: /Suplemento S1 y S2/ });
  await boton.first().waitFor({ timeout: 8000 }).catch(() => {});
  return (await boton.count()) > 0;
}

const url = (formato) =>
  `${BASE}/admin/cobertura/suplemento-demo?reporte=${REPORTE_DEMO}&formato=${formato}`;

let staffDb = null;

async function main() {
  console.log(`Servidor: ${BASE}`);
  staffDb = await sesionDb(CUENTAS.staff);
  const nav = await chromium.launch();
  const staff = await entrar(nav, CUENTAS.staff);
  const cliente = await entrar(nav, CUENTAS.adminCliente);

  // ---------------------------------------------------------------------------
  bloque("A · Encendida (el default)");
  await ponerVitrina(staffDb, true);
  ok(await hayBoton(staff), "el botón «Suplemento S1 y S2» está en Cobertura");
  // Sin esto, «no lo ve con la vitrina apagada» pasaría también si nunca lo viera.
  ok(await hayBoton(cliente), "y el admin del cliente también lo ve");

  const antesA = await descargasEnBitacora(staffDb);
  const word = await staff.request.get(url("docx"));
  ok(word.status() === 200, `Word → ${word.status()}`);
  const despuesA = await descargasEnBitacora(staffDb);
  ok(despuesA === antesA + 1, `la descarga queda en la bitácora (${antesA} → ${despuesA})`);

  // ---------------------------------------------------------------------------
  bloque("B · Apagada (vitrina_habilitada = false)");
  await ponerVitrina(staffDb, false);
  ok(!(await hayBoton(staff)), "el botón ya no está en Cobertura (staff)");
  ok(!(await hayBoton(cliente)), "ni para el admin del cliente");

  const antesB = await descargasEnBitacora(staffDb);
  for (const [quien, pagina] of [["staff", staff], ["admin del cliente", cliente]]) {
    for (const formato of ["docx", "pdf"]) {
      const r = await pagina.request.get(url(formato));
      ok(r.status() === 404, `${quien} · ${formato} → ${r.status()} (se esperaba 404)`);
    }
  }
  const despuesB = await descargasEnBitacora(staffDb);
  ok(despuesB === antesB, `ninguna fila de bitácora por las descargas negadas (${antesB} → ${despuesB})`);

  await nav.close();
}

main()
  .catch((e) => {
    console.error("\nFALLA:", e.message);
    problemas.push(`[${seccion}] FALLA: ${e.message}`);
  })
  .finally(async () => {
    // -------------------------------------------------------------------------
    bloque("C · Se vuelve a encender");
    if (staffDb) {
      try {
        await ponerVitrina(staffDb, true);
        const { data } = await staffDb.from("tenants").select("vitrina_habilitada").eq("id", TENANT_DEMO).single();
        ok(data?.vitrina_habilitada === true, "Empresa Demo queda con la vitrina encendida");
      } catch (e) {
        ok(false, `no se pudo volver a encender: ${e.message}`);
      }
    }
    console.log(`\n════════ RESULTADO ════════`);
    if (problemas.length === 0) console.log("  Todo verde.");
    else {
      console.log(`  ${problemas.length} problema(s):`);
      for (const p of problemas) console.log(`   · ${p}`);
    }
    process.exit(problemas.length === 0 ? 0 : 1);
  });
