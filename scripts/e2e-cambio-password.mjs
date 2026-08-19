/**
 * =============================================================================
 * E2E del CAMBIO FORZADO DE CONTRASEÑA — sesiones REALES.
 *
 *   node scripts/e2e-cambio-password.mjs [baseUrl]
 *   BASE_URL=http://localhost:3001 node scripts/e2e-cambio-password.mjs
 *
 * Requiere `supabase start`, `supabase db reset` y `pnpm dev` corriendo.
 *
 * QUÉ FIJA
 * --------
 * Una contraseña temporal que se entrega FUERA de la plataforma (impresa en un
 * manual, dictada) la conoce alguien más que su dueño. `debe_cambiar_password`
 * hace que sirva para una sola cosa: entrar a cambiarla. La prueba recorre el
 * ciclo completo y, sobre todo, comprueba las dos cosas que lo hacen valer:
 *
 *   · con el flag encendido NINGUNA otra vista se renderiza (portal, panel y una
 *     ruta profunda, no solo la home);
 *   · una vez establecida la definitiva, la TEMPORAL deja de servir — se prueba
 *     contra el servidor de auth, no mirando la UI.
 *
 * Fixture propio (`e2e-cambio-password`), retirado al terminar incluso si falla.
 * =============================================================================
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import crypto from "node:crypto";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ANALISTA_EMAIL = process.env.ANALISTA_EMAIL || "analista@irstrat.example";
const DEMO_PASSWORD = process.env.ADMIN_PASSWORD || "Demo2025!";

const FIXTURE = {
  slug: "e2e-cambio-password",
  nombre: "Emisora de cambio forzado (e2e)",
  prefijo: "ECPW",
  area: "Sostenibilidad",
};
// La definitiva que establece la persona en la prueba.
const DEFINITIVA = "E2eDefinitiva!2026";

const problemas = [];
let seccion = "";
function bloque(titulo) {
  seccion = titulo;
  console.log(`\n════════ ${titulo} ════════`);
}
function ok(cond, mensaje) {
  console.log(`  ${cond ? "✓" : "✗"} ${mensaje}`);
  if (!cond) problemas.push(`[${seccion}] ${mensaje}`);
  return cond;
}

/** Temporal en el formato que se imprime: XXXX-xxxx-0000, sin caracteres ambiguos. */
function passwordLegible() {
  const MAY = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const MIN = "abcdefghijkmnpqrstuvwxyz";
  const NUM = "23456789";
  const b = crypto.randomBytes(12);
  const bloque4 = (abc, desde) =>
    Array.from({ length: 4 }, (_, i) => abc[b[desde + i] % abc.length]).join("");
  return `${bloque4(MAY, 0)}-${bloque4(MIN, 4)}-${bloque4(NUM, 8)}`;
}

async function sesionDatos(email, password) {
  const c = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login de datos (${email}): ${error.message}`);
  return c;
}

/** ¿El servidor de auth acepta estas credenciales? Sin mirar la UI. */
async function autenticaContra(email, password) {
  const c = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  return { ok: !error && !!data?.session, motivo: error?.message ?? "sesión emitida" };
}

async function ir(page, url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function main() {
  console.log(`E2E cambio forzado de contraseña contra ${BASE}\n`);

  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const staffDb = await sesionDatos(ANALISTA_EMAIL, DEMO_PASSWORD);

  const temporal = passwordLegible();
  const email = `sostenibilidad.${crypto.randomUUID().slice(0, 8)}@${FIXTURE.slug}.example`;

  const browser = await chromium.launch();
  let tenantId = null;
  const ctxs = [];

  try {
    // -----------------------------------------------------------------------
    bloque("1) Alta con contraseña temporal y cambio forzado");
    // -----------------------------------------------------------------------
    const { data: previo } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", FIXTURE.slug)
      .maybeSingle();
    if (previo) await limpiar(admin, staffDb, previo.id);

    const { data: tenant, error: tErr } = await staffDb
      .from("tenants")
      .insert({
        nombre: FIXTURE.nombre,
        slug: FIXTURE.slug,
        prefijo_folio: FIXTURE.prefijo,
        activo: true,
      })
      .select("id")
      .single();
    if (tErr) throw new Error(`tenant: ${tErr.message}`);
    tenantId = tenant.id;

    const { error: aErr } = await staffDb
      .from("areas_tenant")
      .insert({ tenant_id: tenantId, nombre: FIXTURE.area, orden: 0 });
    if (aErr) throw new Error(`áreas: ${aErr.message}`);

    const { data: creado, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: temporal,
      email_confirm: true,
      user_metadata: { nombre: "Jefatura de sostenibilidad (e2e)" },
    });
    if (authErr) throw new Error(`auth: ${authErr.message}`);

    // Rol con panel a propósito: así se prueba que el flag corta AMBOS lados
    // (portal y panel), no solo el que le tocaría por rol.
    const { error: pErr } = await staffDb.from("perfiles_usuario").insert({
      id: creado.user.id,
      tenant_id: tenantId,
      rol: "admin_cliente",
      area: null,
      nombre: "Jefatura de sostenibilidad (e2e)",
      email,
      activo: true,
      debe_cambiar_password: true,
    });
    if (pErr) throw new Error(`perfil: ${pErr.message}`);

    ok(
      /^[A-Z]{4}-[a-z]{4}-[0-9]{4}$/.test(temporal),
      `la temporal se entrega legible, en bloques XXXX-xxxx-0000 (${temporal})`
    );
    ok(!/[IlO01]/.test(temporal), "sin caracteres confundibles (I, l, O, 0, 1)");

    const { data: perfilAlta } = await staffDb
      .from("perfiles_usuario")
      .select("debe_cambiar_password")
      .eq("id", creado.user.id)
      .single();
    ok(perfilAlta?.debe_cambiar_password === true, "la cuenta nace marcada para cambio forzado");

    // -----------------------------------------------------------------------
    bloque("2) Con el flag encendido, no hay otra vista que /restablecer");
    // -----------------------------------------------------------------------
    const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
    ctxs.push(ctx);
    const page = await ctx.newPage();
    await ir(page, "/login");
    await page.fill("#email", email);
    await page.fill("#password", temporal);
    await page.click('button[type="submit"]');
    // Se espera el destino FINAL, no "cualquier cosa que no sea /login": el
    // ingreso resuelve el destino en la acción, y un `waitForURL` laxo mediría la
    // primera navegación en vez de dónde acaba la persona.
    const llego = await page
      .waitForURL((u) => u.pathname === "/restablecer", { timeout: 60_000 })
      .then(() => true)
      .catch(() => false);
    await page.waitForLoadState("networkidle").catch(() => {});
    ok(llego, `entrar con la temporal cae en /restablecer (${new URL(page.url()).pathname})`);
    ok(
      (await page.getByText(/Cambia tu contraseña para continuar/i).count()) > 0,
      "y la pantalla dice que el cambio es para continuar, no que una liga venció"
    );

    // Su panel, su portal y una ruta profunda: las tres rebotan.
    for (const ruta of ["/admin", "/portal", "/admin/cobertura"]) {
      await ir(page, ruta);
      ok(
        new URL(page.url()).pathname === "/restablecer",
        `${ruta} rebota a /restablecer (${new URL(page.url()).pathname})`
      );
    }

    // -----------------------------------------------------------------------
    bloque("3) Establece la definitiva: el flag se apaga");
    // -----------------------------------------------------------------------
    await ir(page, "/restablecer");
    await page.fill("#password", DEFINITIVA);
    await page.fill("#confirmacion", DEFINITIVA);
    await Promise.all([
      page.waitForURL((u) => u.pathname === "/login", { timeout: 60_000 }),
      page.getByRole("button", { name: /Guardar contraseña/i }).click(),
    ]);
    ok(
      page.url().includes("listo=password"),
      `al guardar vuelve al ingreso con acuse (${page.url().split("?")[1] ?? "sin query"})`
    );

    const { data: perfilTras } = await staffDb
      .from("perfiles_usuario")
      .select("debe_cambiar_password")
      .eq("id", creado.user.id)
      .single();
    ok(perfilTras?.debe_cambiar_password === false, "el flag quedó apagado");

    // -----------------------------------------------------------------------
    bloque("4) La temporal ya no sirve; la definitiva sí y ya no rebota");
    // -----------------------------------------------------------------------
    const conTemporal = await autenticaContra(email, temporal);
    ok(!conTemporal.ok, `la temporal deja de autenticar (${conTemporal.motivo})`);

    const conDefinitiva = await autenticaContra(email, DEFINITIVA);
    ok(conDefinitiva.ok, `la definitiva autentica (${conDefinitiva.motivo})`);

    const ctx2 = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
    ctxs.push(ctx2);
    const page2 = await ctx2.newPage();
    await ir(page2, "/login");
    await page2.fill("#email", email);
    await page2.fill("#password", DEFINITIVA);
    await Promise.all([
      page2.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }),
      page2.click('button[type="submit"]'),
    ]);
    await page2.waitForLoadState("networkidle").catch(() => {});
    ok(
      new URL(page2.url()).pathname === "/admin",
      `con la definitiva entra a su panel, sin rebote (${new URL(page2.url()).pathname})`
    );
  } finally {
    for (const c of ctxs) await c.close().catch(() => {});
    await browser.close();
    if (tenantId) {
      await limpiar(admin, staffDb, tenantId);
      console.log("\n  (fixture e2e eliminado)");
    }
  }

  if (problemas.length) {
    console.log(`\n✗ ${problemas.length} fallo(s):`);
    for (const p of problemas) console.log(`   · ${p}`);
    process.exit(1);
  }
  console.log("\n✅ E2E OK — la contraseña temporal solo sirve para cambiarla.");
}

async function limpiar(admin, staffDb, tenantId) {
  const rep = await staffDb.from("reportes").delete().eq("tenant_id", tenantId).select("id");
  if (rep.error) console.error(`  ⚠️  reportes: ${rep.error.message}`);
  const { data: perfiles } = await admin
    .from("perfiles_usuario")
    .select("id")
    .eq("tenant_id", tenantId);
  for (const p of perfiles ?? []) {
    const r = await admin.auth.admin.deleteUser(p.id);
    if (r.error) console.error(`  ⚠️  cuenta ${p.id}: ${r.error.message}`);
  }
  const ar = await staffDb.from("areas_tenant").delete().eq("tenant_id", tenantId).select("id");
  if (ar.error) console.error(`  ⚠️  áreas: ${ar.error.message}`);
  const del = await staffDb.from("tenants").delete().eq("id", tenantId).select("id");
  if (del.error) console.error(`  ⚠️  no se pudo retirar el fixture: ${del.error.message}`);
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(2);
});
