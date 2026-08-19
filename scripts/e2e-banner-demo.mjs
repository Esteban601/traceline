/**
 * =============================================================================
 * E2E de la ETIQUETA DE DEMOSTRACIÓN por tenant — sesiones REALES.
 *
 *   node scripts/e2e-banner-demo.mjs [baseUrl]
 *   BASE_URL=http://localhost:3001 node scripts/e2e-banner-demo.mjs
 *
 * Requiere `supabase start`, `supabase db reset` y `pnpm dev` corriendo.
 *
 * POR QUÉ EXISTE
 * --------------
 * La franja "Entorno de demostración — datos ilustrativos" era del AMBIENTE
 * (NEXT_PUBLIC_STAGING). Desde que Grupo Carso opera en ese mismo despliegue, una
 * franja global le miente: sus datos son reales y su entregable es oficial. La
 * etiqueta pasó a ser del TENANT (`tenants.es_demo`), y esta prueba fija las dos
 * direcciones del error, que no son simétricas:
 *
 *   · falta la franja en la demo  → un prospecto cree que los datos son de alguien
 *   · sobra la franja en un real  → el cliente lee "ilustrativos" sobre su verdad
 *
 * Se prueba con un fixture propio (emisora REAL, `es_demo = false`) y con la
 * Empresa Demo del seed, sin escribir nada en esta última: su export es la
 * referencia de `verify:export`. Lo que se cambia —el flag, para probar la
 * guarda— se revierte en el mismo bloque.
 * =============================================================================
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import ExcelJS from "exceljs";
import crypto from "node:crypto";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@irstrat.example";
const ANALISTA_EMAIL = process.env.ANALISTA_EMAIL || "analista@irstrat.example";
const DEMO_PASSWORD = process.env.ADMIN_PASSWORD || "Demo2025!";
const DEMO_AREA_EMAIL = process.env.DEMO_AREA_EMAIL || "rh@empresademo.example";
const DEMO_ADMIN_CLIENTE_EMAIL =
  process.env.DEMO_ADMIN_CLIENTE_EMAIL || "admin.cliente@empresademo.example";

/**
 * ¿Este despliegue debe traer noindex? Es propiedad de la URL, no del tenant:
 * cualquier host que no sea el dominio definitivo lo lleva. Local no (para no
 * exigir la config var en dev); un host remoto sí.
 */
const ESPERA_NOINDEX =
  process.env.ESPERA_NOINDEX === "true" || !/localhost|127\.0\.0\.1/.test(BASE);

const FIXTURE = {
  slug: "e2e-emisora-real",
  nombre: "Emisora real (e2e banner)",
  prefijo: "EBAN",
  ejercicio: 2027,
  area: "Sostenibilidad",
};
const PASSWORD = "E2eBannerDemo!2026";

// La franja: se busca por su texto, que es lo que lee una persona.
const FRANJA = /Entorno de demostraci[oó]n/i;

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

async function sesionDatos(email, password) {
  const c = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login de datos (${email}): ${error.message}`);
  return c;
}

/** RLS y triggers niegan de dos formas legítimas: con error, o filtrando la fila. */
function rechazada(res) {
  if (res.error) return { rechazada: true, motivo: res.error.message };
  const filas = Array.isArray(res.data) ? res.data.length : res.data ? 1 : 0;
  return { rechazada: filas === 0, motivo: filas === 0 ? "0 filas (RLS filtró)" : "PASÓ" };
}

async function ir(page, url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function sesionUI(browser, email, password) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await ir(page, "/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
  return { ctx, page };
}

/** ¿Se ve la franja en esta pantalla? Cuenta el nodo, no el HTML crudo. */
async function tieneFranja(page) {
  return (await page.getByRole("note").filter({ hasText: FRANJA }).count()) > 0;
}

async function descargar(ctx, url) {
  const res = await ctx.request.get(url);
  return { status: res.status(), buf: Buffer.from(await res.body()) };
}

/**
 * ¿El libro lleva la marca [DEMO] en algún pie?
 *
 * Recorre SOLO las filas que existen (`eachRow`) y solo la columna A, donde va el
 * pie. Un barrido por índice (`getCell("A" + r)` hasta rowCount) materializa cada
 * celda que toca: en las hojas grandes de la plantilla eso se lleva el heap de
 * Node por delante — costó una corrida.
 */
async function libroConMarcaDemo(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  let marca = false;
  wb.eachSheet((ws) => {
    if (marca) return;
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (marca) return;
      const v = row.getCell(1).value;
      if (v == null) return;
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      if (s.includes("[DEMO]")) marca = true;
    });
  });
  return marca;
}

// =============================================================================
// Fixture: una emisora REAL (es_demo = false, el default) con su gente y su reporte
// =============================================================================
async function crearFixture(admin, staffDb) {
  const { data: previo } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", FIXTURE.slug)
    .maybeSingle();
  if (previo) await limpiarFixture(admin, staffDb, { tenantId: previo.id });

  const { data: tenant, error: tErr } = await staffDb
    .from("tenants")
    .insert({
      nombre: FIXTURE.nombre,
      slug: FIXTURE.slug,
      prefijo_folio: FIXTURE.prefijo,
      activo: true,
      // `es_demo` NO se envía: se prueba que el DEFAULT deja al cliente en real.
    })
    .select("id, es_demo")
    .single();
  if (tErr) throw new Error(`tenant: ${tErr.message}`);

  const { error: aErr } = await staffDb
    .from("areas_tenant")
    .insert({ tenant_id: tenant.id, nombre: FIXTURE.area, orden: 0 });
  if (aErr) throw new Error(`áreas: ${aErr.message}`);

  const { data: reporte, error: rErr } = await staffDb
    .from("reportes")
    .insert({
      tenant_id: tenant.id,
      nombre: "Informe Anual Sustentable (e2e banner)",
      ejercicio: FIXTURE.ejercicio,
      estado: "activo",
    })
    .select("id")
    .single();
  if (rErr) throw new Error(`reporte: ${rErr.message}`);

  const usuarios = {};
  for (const [clave, def] of Object.entries({
    adminCliente: {
      email: `admin.${crypto.randomUUID().slice(0, 8)}@${FIXTURE.slug}.example`,
      rol: "admin_cliente",
      area: null,
      nombre: "Administradora real e2e",
    },
    area: {
      email: `area.${crypto.randomUUID().slice(0, 8)}@${FIXTURE.slug}.example`,
      rol: "cliente",
      area: FIXTURE.area,
      nombre: "Responsable real e2e",
    },
  })) {
    const { data: creado, error } = await admin.auth.admin.createUser({
      email: def.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nombre: def.nombre },
    });
    if (error) throw new Error(`auth ${def.email}: ${error.message}`);
    const { error: pErr } = await staffDb.from("perfiles_usuario").insert({
      id: creado.user.id,
      tenant_id: tenant.id,
      rol: def.rol,
      area: def.area,
      nombre: def.nombre,
      email: def.email,
      activo: true,
    });
    if (pErr) throw new Error(`perfil ${def.email}: ${pErr.message}`);
    usuarios[clave] = { id: creado.user.id, ...def };
  }

  // Una solicitud con rubro y su captura validada: sin celdas llenas el libro no
  // tendría hojas tocadas y el pie —lo que se está probando— no se escribiría.
  const { data: sol, error: sErr } = await staffDb
    .from("solicitudes")
    .insert({
      reporte_id: reporte.id,
      titulo: "Inventario GEI Alcance 1 (e2e banner)",
      area_asignada: FIXTURE.area,
      es_cuantitativa: true,
      unidad_esperada: "tCO2e",
      rubro_taxonomia: "gei_alcance_1",
      responsable_cliente_id: usuarios.area.id,
      orden: 10,
    })
    .select("id")
    .single();
  if (sErr) throw new Error(`solicitud: ${sErr.message}`);

  return { tenantId: tenant.id, reporteId: reporte.id, solId: sol.id, usuarios, esDemo: tenant.es_demo };
}

async function limpiarFixture(admin, staffDb, { tenantId }) {
  const { data: sols } = await staffDb
    .from("solicitudes")
    .select("id, reporte:reportes!inner(tenant_id)")
    .eq("reporte.tenant_id", tenantId);
  for (const s of sols ?? []) {
    const carpeta = `${tenantId}/${s.id}`;
    const { data: objs } = await admin.storage.from("evidencias").list(carpeta);
    if (objs?.length) {
      await admin.storage.from("evidencias").remove(objs.map((o) => `${carpeta}/${o.name}`));
    }
  }
  // Orden obligatorio (ON DELETE RESTRICT en la cadena de custodia): reporte,
  // cuentas, áreas, tenant.
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

// =============================================================================
// Main
// =============================================================================
async function main() {
  console.log(`E2E etiqueta de demostración por tenant contra ${BASE}\n`);

  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const staffDb = await sesionDatos(ANALISTA_EMAIL, DEMO_PASSWORD);
  const adminIrstratDb = await sesionDatos(ADMIN_EMAIL, DEMO_PASSWORD);

  const browser = await chromium.launch();
  let fixture = null;
  let tenantIdFixture = null;
  const sesiones = [];

  try {
    // -----------------------------------------------------------------------
    bloque("1) El estado de la base: quién es demo y quién no");
    // -----------------------------------------------------------------------
    const { data: demoTenant } = await staffDb
      .from("tenants")
      .select("id, nombre, es_demo")
      .ilike("nombre", "%[DEMO]%")
      .maybeSingle();
    ok(demoTenant?.es_demo === true, `la Empresa Demo quedó marcada es_demo (${demoTenant?.nombre})`);

    const { data: reales } = await staffDb
      .from("tenants")
      .select("nombre, es_demo")
      .not("nombre", "ilike", "%[DEMO]%");
    ok(
      (reales ?? []).every((t) => t.es_demo === false),
      `ninguna emisora real quedó marcada (${(reales ?? []).length} revisada(s))`
    );

    fixture = await crearFixture(admin, staffDb);
    tenantIdFixture = fixture.tenantId;
    ok(fixture.esDemo === false, "un cliente nuevo nace REAL (default de la columna)");

    const { data: repDemo } = await staffDb
      .from("reportes")
      .select("id")
      .eq("tenant_id", demoTenant.id)
      .limit(1)
      .single();

    // -----------------------------------------------------------------------
    bloque("2) Sesiones de la emisora REAL: sin franja, ni en portal ni en panel");
    // -----------------------------------------------------------------------
    const realArea = await sesionUI(browser, fixture.usuarios.area.email, PASSWORD);
    sesiones.push(realArea);
    ok(new URL(realArea.page.url()).pathname.startsWith("/portal"), "el usuario de área entra al portal");
    ok(!(await tieneFranja(realArea.page)), "su portal NO lleva la franja de demostración");
    await ir(realArea.page, `/portal/solicitudes/${fixture.solId}`);
    ok(!(await tieneFranja(realArea.page)), "tampoco el detalle de una solicitud");

    const realAdmin = await sesionUI(browser, fixture.usuarios.adminCliente.email, PASSWORD);
    sesiones.push(realAdmin);
    ok(new URL(realAdmin.page.url()).pathname.startsWith("/admin"), "su administrador entra al panel");
    ok(!(await tieneFranja(realAdmin.page)), "su PANEL NO lleva la franja");
    await ir(realAdmin.page, "/admin/cobertura");
    ok(!(await tieneFranja(realAdmin.page)), "tampoco su cobertura");

    // -----------------------------------------------------------------------
    bloque("3) Sesiones de la EMPRESA DEMO: la franja sí está");
    // -----------------------------------------------------------------------
    const demoArea = await sesionUI(browser, DEMO_AREA_EMAIL, DEMO_PASSWORD);
    sesiones.push(demoArea);
    ok(await tieneFranja(demoArea.page), "el portal de la demo lleva la franja");

    const demoAdmin = await sesionUI(browser, DEMO_ADMIN_CLIENTE_EMAIL, DEMO_PASSWORD);
    sesiones.push(demoAdmin);
    ok(new URL(demoAdmin.page.url()).pathname.startsWith("/admin"), "su administradora entra al panel");
    ok(await tieneFranja(demoAdmin.page), "el PANEL de la demo lleva la franja");

    // -----------------------------------------------------------------------
    bloque("4) Sin sesión no hay tenant, y el noindex no depende de él");
    // -----------------------------------------------------------------------
    const anon = await browser.newContext({ baseURL: BASE });
    const anonPage = await anon.newPage();
    await ir(anonPage, "/login");
    ok(!(await tieneFranja(anonPage)), "/login no lleva franja (no hay tenant del que decirlo)");
    const robots = await anonPage
      .locator('meta[name="robots"]')
      .first()
      .getAttribute("content")
      .catch(() => null);
    if (ESPERA_NOINDEX) {
      ok(
        /noindex/.test(robots ?? "") && /nofollow/.test(robots ?? ""),
        `el noindex sigue siendo GLOBAL, sin sesión incluida (${robots ?? "ausente"})`
      );
    } else {
      console.log(`  · local: noindex no aplica (robots=${robots ?? "ausente"})`);
    }
    await anon.close();

    // -----------------------------------------------------------------------
    bloque("5) El Excel de cada quien: [DEMO] solo en el de la demo");
    // -----------------------------------------------------------------------
    const libroReal = await descargar(
      realAdmin.ctx,
      `/admin/cobertura/export-taxonomia?reporte=${fixture.reporteId}`
    );
    ok(libroReal.status === 200, `el export de la emisora real responde 200 (${libroReal.status})`);
    ok(
      !(await libroConMarcaDemo(libroReal.buf)),
      "su libro NO lleva la marca [DEMO] en ningún pie"
    );

    const libroDemo = await descargar(
      demoAdmin.ctx,
      `/admin/cobertura/export-taxonomia?reporte=${repDemo.id}`
    );
    ok(libroDemo.status === 200, `el export de la demo responde 200 (${libroDemo.status})`);
    ok(await libroConMarcaDemo(libroDemo.buf), "el libro de la demo SÍ lleva la marca [DEMO]");

    // -----------------------------------------------------------------------
    bloque("6) Guarda: quién puede mover la etiqueta");
    // -----------------------------------------------------------------------
    const clienteDb = await sesionDatos(fixture.usuarios.adminCliente.email, PASSWORD);
    const intentoCliente = rechazada(
      await clienteDb
        .from("tenants")
        .update({ es_demo: true })
        .eq("id", fixture.tenantId)
        .select("id")
    );
    ok(
      intentoCliente.rechazada,
      `el administrador del cliente no marca su emisora como demo (${intentoCliente.motivo})`
    );

    const intentoAnalista = rechazada(
      await staffDb
        .from("tenants")
        .update({ es_demo: true })
        .eq("id", fixture.tenantId)
        .select("id")
    );
    ok(
      intentoAnalista.rechazada,
      `el analista de IRStrat tampoco (${intentoAnalista.motivo})`
    );

    // Y el alta: nacer marcada es otra forma de marcarla.
    const altaAnalista = rechazada(
      await staffDb
        .from("tenants")
        .insert({
          nombre: "Emisora que nace demo (e2e)",
          slug: `${FIXTURE.slug}-nace-demo`,
          prefijo_folio: "EBAX",
          activo: true,
          es_demo: true,
        })
        .select("id")
    );
    ok(altaAnalista.rechazada, `ni da de alta una emisora que nazca marcada (${altaAnalista.motivo})`);

    const admOk = await adminIrstratDb
      .from("tenants")
      .update({ es_demo: true })
      .eq("id", fixture.tenantId)
      .select("id, es_demo");
    ok(
      !admOk.error && admOk.data?.[0]?.es_demo === true,
      `el administrador de IRStrat sí la mueve (${admOk.error?.message ?? "ok"})`
    );

    // Y con el flag encendido, la MISMA emisora real ahora sí se anuncia: la
    // franja sigue a la columna, no a un nombre ni a una variable de ambiente.
    await ir(realAdmin.page, "/admin");
    ok(
      await tieneFranja(realAdmin.page),
      "con la etiqueta puesta, esa misma sesión ya muestra la franja"
    );
    const libroMarcado = await descargar(
      realAdmin.ctx,
      `/admin/cobertura/export-taxonomia?reporte=${fixture.reporteId}`
    );
    ok(
      await libroConMarcaDemo(libroMarcado.buf),
      "y su libro ya sale con [DEMO] (el pie sigue la columna, no el nombre)"
    );

    const vuelta = await adminIrstratDb
      .from("tenants")
      .update({ es_demo: false })
      .eq("id", fixture.tenantId)
      .select("id, es_demo");
    ok(
      !vuelta.error && vuelta.data?.[0]?.es_demo === false,
      "y la retira igual (la etiqueta no es de ida sola)"
    );
  } finally {
    for (const s of sesiones) await s.ctx.close().catch(() => {});
    await browser.close();
    if (tenantIdFixture) {
      await limpiarFixture(admin, staffDb, { tenantId: tenantIdFixture });
      console.log("\n  (fixture e2e eliminado)");
    }
  }

  if (problemas.length) {
    console.log(`\n✗ ${problemas.length} fallo(s):`);
    for (const p of problemas) console.log(`   · ${p}`);
    process.exit(1);
  }
  console.log("\n✅ E2E OK — la etiqueta de demostración es del tenant, no del ambiente.");
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(2);
});
