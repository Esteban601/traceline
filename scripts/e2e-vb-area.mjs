/**
 * =============================================================================
 * E2E del VISTO BUENO DEL ÁREA (doble verificación) — sesiones REALES.
 *
 *   node scripts/e2e-vb-area.mjs [baseUrl]
 *   BASE_URL=http://localhost:3001 node scripts/e2e-vb-area.mjs
 *
 * Requiere `supabase start`, `supabase db reset` y `pnpm dev` corriendo.
 *
 * LA CADENA QUE SE PRUEBA, en el orden en que ocurre en el cliente:
 *
 *   el área carga → el JEFE del área da su visto bueno → llega evidencia nueva y
 *   el visto bueno SE REVOCA solo → el jefe vuelve a firmar → encima va la
 *   validación final (admin_cliente o IRStrat, según el origen).
 *
 * Y el camino que también tiene que funcionar: validar SIN visto bueno. El visto
 * bueno acompaña la validación, no la condiciona; cuando no se dio, la UI lo dice.
 *
 * Cada afirmación se comprueba donde se decide: la UI (que no ofrezca lo que no
 * corresponde y que el flujo funcione), y los DATOS con la sesión real de cada
 * quien (RLS + triggers de 20260824130000, que es la barrera que un POST forjado
 * tampoco salta).
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

const ANALISTA_EMAIL = process.env.ANALISTA_EMAIL || "analista@irstrat.example";
const DEMO_PASSWORD = process.env.ADMIN_PASSWORD || "Demo2025!";

const FIXTURE = {
  slug: "e2e-visto-bueno",
  nombre: "Emisora de doble verificación (e2e)",
  prefijo: "EVBA",
  ejercicio: 2027,
  area: "Producción",
  otraArea: "Finanzas",
};
const PASSWORD = "E2eVistoBueno!2026";

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
  await page.waitForTimeout(300);
}

async function sesionUI(browser, email, password) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  await ir(page, "/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  return { ctx, page };
}

/** Sube evidencia por el PORTAL, como lo hace la gente del área. */
async function cargarPorPortal(page, solicitudId, { archivo, valor, unidad }) {
  await ir(page, `/portal/solicitudes/${solicitudId}`);
  await page.setInputFiles("#evidencia-file", {
    name: archivo,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(`PK respaldo e2e ${archivo}`, "utf8"),
  });
  await page.waitForTimeout(400);
  await page.fill("#periodo", "2027");
  const v = page.locator("#valor");
  if ((await v.count()) > 0 && valor != null) await v.fill(String(valor));
  const u = page.locator("#unidad");
  if ((await u.count()) > 0 && unidad && (await u.inputValue()) === "") await u.fill(unidad);
  const just = page.locator("#justificacion");
  if (await just.count()) {
    await just.fill("Reemplazo de la versión anterior con el desglose completo (e2e).");
  }
  await page.getByRole("button", { name: /^(Enviar|Reenviar)$/ }).click();
  await page.waitForTimeout(4500);
}

// =============================================================================
// Fixture
// =============================================================================
async function crearFixture(admin, staffDb) {
  const { data: previo } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", FIXTURE.slug)
    .maybeSingle();
  if (previo) await limpiarFixture(admin, staffDb, previo.id);

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

  const { error: aErr } = await staffDb.from("areas_tenant").insert([
    { tenant_id: tenant.id, nombre: FIXTURE.area, orden: 0 },
    { tenant_id: tenant.id, nombre: FIXTURE.otraArea, orden: 1 },
  ]);
  if (aErr) throw new Error(`áreas: ${aErr.message}`);

  const { data: reporte, error: rErr } = await staffDb
    .from("reportes")
    .insert({
      tenant_id: tenant.id,
      nombre: "Informe Anual Sustentable (e2e visto bueno)",
      ejercicio: FIXTURE.ejercicio,
      estado: "activo",
    })
    .select("id")
    .single();
  if (rErr) throw new Error(`reporte: ${rErr.message}`);

  const usuarios = {};
  for (const [clave, def] of Object.entries({
    subordinado: { rol: "cliente", area: FIXTURE.area, nombre: "Responsable Producción e2e" },
    jefe: { rol: "jefe_area", area: FIXTURE.area, nombre: "Jefa de Producción e2e" },
    jefeOtra: { rol: "jefe_area", area: FIXTURE.otraArea, nombre: "Jefe de Finanzas e2e" },
    adminCliente: { rol: "admin_cliente", area: null, nombre: "Administradora e2e" },
  })) {
    const email = `${clave.toLowerCase()}.${crypto.randomUUID().slice(0, 8)}@${FIXTURE.slug}.example`;
    const { data: creado, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nombre: def.nombre },
    });
    if (error) throw new Error(`auth ${email}: ${error.message}`);
    const { error: pErr } = await staffDb.from("perfiles_usuario").insert({
      id: creado.user.id,
      tenant_id: tenant.id,
      rol: def.rol,
      area: def.area,
      nombre: def.nombre,
      email,
      activo: true,
    });
    if (pErr) throw new Error(`perfil ${email}: ${pErr.message}`);
    usuarios[clave] = { id: creado.user.id, email, ...def };
  }

  // Dos solicitudes del área de Producción, una por origen: la interna la valida
  // el administrador del cliente, la de IRStrat la valida el staff. El visto bueno
  // del área es el mismo para las dos — no depende del origen.
  const base = {
    reporte_id: reporte.id,
    area_asignada: FIXTURE.area,
    es_cuantitativa: true,
    unidad_esperada: "t",
    responsable_cliente_id: usuarios.subordinado.id,
  };
  const { data: solIrstrat, error: s1 } = await staffDb
    .from("solicitudes")
    .insert({ ...base, titulo: "Residuos peligrosos 2027 (pedido por IRStrat)", orden: 10 })
    .select("id, origen")
    .single();
  if (s1) throw new Error(`solicitud irstrat: ${s1.message}`);

  // La de otra área: sirve para probar que el jefe de Producción no la ve.
  const { data: solOtraArea, error: s3 } = await staffDb
    .from("solicitudes")
    .insert({
      reporte_id: reporte.id,
      titulo: "Gasto ambiental 2027 (Finanzas)",
      area_asignada: FIXTURE.otraArea,
      orden: 30,
    })
    .select("id")
    .single();
  if (s3) throw new Error(`solicitud otra área: ${s3.message}`);

  // La hoja "Trazabilidad" del export se recorre POR DATAPOINT: una solicitud sin
  // mapeo no aparece en el libro. Se ligan dos datapoints —uno por solicitud— para
  // poder comprobar la columna del visto bueno en sus dos estados.
  const { data: dps } = await staffDb
    .from("datapoints_taxonomia")
    .select("id")
    .eq("version_taxonomia", "2025")
    .order("codigo", { ascending: true })
    .limit(2);
  const datapoints = (dps ?? []).map((d) => d.id);
  if (datapoints[0]) {
    const { error } = await staffDb
      .from("mapeo_solicitud_datapoint")
      .insert({ solicitud_id: solIrstrat.id, datapoint_id: datapoints[0] });
    if (error) console.error(`  ⚠️  mapeo irstrat: ${error.message}`);
  }

  return {
    tenantId: tenant.id,
    reporteId: reporte.id,
    usuarios,
    solIrstrat: solIrstrat.id,
    solOtraArea: solOtraArea.id,
    datapointLibre: datapoints[1] ?? null,
  };
}

async function limpiarFixture(admin, staffDb, tenantId) {
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
  // Orden obligatorio (ON DELETE RESTRICT en la cadena de custodia, y ahora
  // también en `solicitudes.vb_area_por`): reporte, cuentas, áreas, tenant.
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
  console.log(`E2E visto bueno del área contra ${BASE}\n`);

  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const staffDb = await sesionDatos(ANALISTA_EMAIL, DEMO_PASSWORD);

  const browser = await chromium.launch();
  let tenantId = null;
  const ctxs = [];

  try {
    const fx = await crearFixture(admin, staffDb);
    tenantId = fx.tenantId;

    const jefeDb = await sesionDatos(fx.usuarios.jefe.email, PASSWORD);
    const otroJefeDb = await sesionDatos(fx.usuarios.jefeOtra.email, PASSWORD);
    const subDb = await sesionDatos(fx.usuarios.subordinado.email, PASSWORD);
    const clienteDb = await sesionDatos(fx.usuarios.adminCliente.email, PASSWORD);

    // -----------------------------------------------------------------------
    bloque("1) El jefe de área ve LO SUYO y nada más");
    // -----------------------------------------------------------------------
    const { data: veJefe } = await jefeDb.from("solicitudes").select("id, area_asignada");
    ok(
      (veJefe ?? []).length > 0 && (veJefe ?? []).every((s) => s.area_asignada === FIXTURE.area),
      `solo ve solicitudes de su área (${(veJefe ?? []).length} de ${FIXTURE.area})`
    );
    ok(
      !(veJefe ?? []).some((s) => s.id === fx.solOtraArea),
      "la solicitud de otra área no aparece en su lista"
    );
    const { data: directa } = await jefeDb
      .from("solicitudes")
      .select("id")
      .eq("id", fx.solOtraArea);
    ok((directa ?? []).length === 0, "ni pidiéndola por id (RLS, no la UI)");

    const jefeUI = await sesionUI(browser, fx.usuarios.jefe.email, PASSWORD);
    ctxs.push(jefeUI.ctx);
    ok(
      new URL(jefeUI.page.url()).pathname.startsWith("/portal"),
      `el jefe de área entra al PORTAL, no al panel (${new URL(jefeUI.page.url()).pathname})`
    );
    await ir(jefeUI.page, "/admin");
    ok(
      new URL(jefeUI.page.url()).pathname === "/portal",
      "y /admin lo rebota a su portal"
    );

    // -----------------------------------------------------------------------
    bloque("2) Sin evidencia no se firma");
    // -----------------------------------------------------------------------
    await ir(jefeUI.page, `/portal/solicitudes/${fx.solIrstrat}`);
    ok(
      (await jefeUI.page.getByRole("button", { name: "Dar visto bueno" }).count()) === 0,
      "la UI no ofrece el botón sin evidencia cargada"
    );
    ok(
      (await jefeUI.page.getByText(/Todavía no hay evidencia cargada/i).count()) > 0,
      "y explica por qué en vez de esconder la sección"
    );
    const sinEvidencia = rechazada(
      await jefeDb
        .from("solicitudes")
        .update({ vb_area_por: fx.usuarios.jefe.id, vb_area_fecha: new Date().toISOString() })
        .eq("id", fx.solIrstrat)
        .select("id")
    );
    ok(sinEvidencia.rechazada, `y la base lo rechaza igual (${sinEvidencia.motivo})`);

    // -----------------------------------------------------------------------
    bloque("3) El área entrega y el jefe da el visto bueno");
    // -----------------------------------------------------------------------
    const subUI = await sesionUI(browser, fx.usuarios.subordinado.email, PASSWORD);
    ctxs.push(subUI.ctx);
    await cargarPorPortal(subUI.page, fx.solIrstrat, {
      archivo: "residuos-2027-v1.xlsx",
      valor: 128.4,
      unidad: "t",
    });
    const { count: nEv } = await subDb
      .from("evidencias")
      .select("id", { count: "exact", head: true })
      .eq("solicitud_id", fx.solIrstrat);
    ok(nEv === 1, `el subordinado cargó su evidencia (${nEv})`);

    ok(
      (await subUI.page.getByText("Sin visto bueno del área").count()) > 0,
      "el subordinado ve que su entrega aún no tiene visto bueno"
    );

    await ir(jefeUI.page, `/portal/solicitudes/${fx.solIrstrat}`);
    // La entrega es de su subordinado: la página no puede decirle «Entregaste».
    ok(
      (await jefeUI.page.getByText(/Responsable Producción e2e.*entregó/).count()) > 0 &&
        (await jefeUI.page.getByText(/Entregaste/).count()) === 0,
      "al jefe la página le dice quién de su área entregó, no «Entregaste»"
    );
    const btnVB = jefeUI.page.getByRole("button", { name: "Dar visto bueno" });
    ok((await btnVB.count()) > 0, "ahora el jefe sí ve el botón");
    await btnVB.first().click();
    await jefeUI.page.getByRole("button", { name: /^Dar visto bueno$/ }).last().click();
    await jefeUI.page.waitForTimeout(4000);

    const { data: solTrasVB } = await jefeDb
      .from("solicitudes")
      .select("vb_area_por, vb_area_fecha, estado")
      .eq("id", fx.solIrstrat)
      .single();
    ok(
      solTrasVB?.vb_area_por === fx.usuarios.jefe.id && solTrasVB?.vb_area_fecha != null,
      "la firma quedó con el id del jefe y su fecha (las calcula la base)"
    );
    ok(
      solTrasVB?.estado === "recibido",
      `el visto bueno NO es una transición: el estado sigue en 'recibido' (${solTrasVB?.estado})`
    );

    const { data: bitVB } = await staffDb
      .from("bitacora")
      .select("accion, detalle, usuario_id")
      .eq("entidad_id", fx.solIrstrat)
      .eq("accion", "vb_area_dado");
    ok((bitVB ?? []).length === 1, `la bitácora registra el visto bueno (${(bitVB ?? []).length})`);
    ok(
      bitVB?.[0]?.usuario_id === fx.usuarios.jefe.id && bitVB?.[0]?.detalle?.rol === "jefe_area",
      "con su autor y su rol"
    );

    // -----------------------------------------------------------------------
    bloque("4) Las DOS marcas, en las dos vistas");
    // -----------------------------------------------------------------------
    await ir(subUI.page, `/portal/solicitudes/${fx.solIrstrat}`);
    ok(
      (await subUI.page.getByText(/Jefa de Producción e2e/).count()) > 0,
      "el portal del subordinado nombra a quien dio el visto bueno"
    );
    ok(
      (await subUI.page.getByText("Pendiente de validación").count()) > 0,
      "y muestra la validación como pendiente (son dos marcas, no una)"
    );

    const clienteUI = await sesionUI(browser, fx.usuarios.adminCliente.email, PASSWORD);
    ctxs.push(clienteUI.ctx);
    await ir(clienteUI.page, `/admin/solicitudes/${fx.solIrstrat}`);
    ok(
      (await clienteUI.page.getByText("Visto bueno del área").count()) > 0 &&
        (await clienteUI.page.getByText(/Jefa de Producción e2e/).count()) > 0,
      "el panel muestra la misma marca a quien revisa"
    );
    await ir(clienteUI.page, "/admin");
    ok(
      (await clienteUI.page.getByText("Con visto bueno del área").count()) > 0,
      "y la matriz lo indica en la fila (indicador compacto)"
    );

    // -----------------------------------------------------------------------
    bloque("5) Evidencia nueva REVOCA el visto bueno");
    // -----------------------------------------------------------------------
    await cargarPorPortal(subUI.page, fx.solIrstrat, {
      archivo: "residuos-2027-v2.xlsx",
      valor: 131.9,
      unidad: "t",
    });
    const { data: trasNueva } = await jefeDb
      .from("solicitudes")
      .select("vb_area_por, vb_area_fecha")
      .eq("id", fx.solIrstrat)
      .single();
    ok(
      trasNueva?.vb_area_por === null && trasNueva?.vb_area_fecha === null,
      "el visto bueno se retiró solo al llegar la versión nueva"
    );
    const { data: bitRev } = await staffDb
      .from("bitacora")
      .select("accion, detalle, usuario_id")
      .eq("entidad_id", fx.solIrstrat)
      .eq("accion", "vb_area_revocado");
    ok((bitRev ?? []).length === 1, `queda en bitácora (${(bitRev ?? []).length})`);
    ok(
      bitRev?.[0]?.detalle?.motivo === "evidencia_nueva" &&
        bitRev?.[0]?.detalle?.vb_previo_por === fx.usuarios.jefe.id,
      "con el motivo y de quién era la firma revocada"
    );
    ok(
      bitRev?.[0]?.usuario_id === null,
      "y sin autor humano: la revocación es del sistema, no de una persona"
    );

    // -----------------------------------------------------------------------
    bloque("6) El jefe vuelve a firmar y encima va la validación");
    // -----------------------------------------------------------------------
    await ir(jefeUI.page, `/portal/solicitudes/${fx.solIrstrat}`);
    await jefeUI.page.getByRole("button", { name: "Dar visto bueno" }).first().click();
    await jefeUI.page.getByRole("button", { name: /^Dar visto bueno$/ }).last().click();
    await jefeUI.page.waitForTimeout(4000);
    const { data: refirmada } = await jefeDb
      .from("solicitudes")
      .select("vb_area_por")
      .eq("id", fx.solIrstrat)
      .single();
    ok(refirmada?.vb_area_por === fx.usuarios.jefe.id, "vuelve a quedar firmada");

    // La valida IRStrat (es de origen 'irstrat'), por su panel.
    const staffUI = await sesionUI(browser, ANALISTA_EMAIL, DEMO_PASSWORD);
    ctxs.push(staffUI.ctx);
    await ir(staffUI.page, `/admin/solicitudes/${fx.solIrstrat}`);
    const enRev = staffUI.page.getByRole("button", { name: /Poner en revisi/i });
    if (await enRev.count()) {
      await enRev.first().click();
      await staffUI.page.waitForTimeout(3000);
      await ir(staffUI.page, `/admin/solicitudes/${fx.solIrstrat}`);
    }
    await staffUI.page.getByRole("button", { name: /^Validar$/ }).first().click();
    const confirmar = staffUI.page.getByRole("button", { name: /Validar|Sí, validar/i }).last();
    await confirmar.click();
    await staffUI.page.waitForTimeout(4000);
    await ir(staffUI.page, `/admin/solicitudes/${fx.solIrstrat}`);

    const { data: validada } = await staffDb
      .from("solicitudes")
      .select("estado, vb_area_por")
      .eq("id", fx.solIrstrat)
      .single();
    ok(validada?.estado === "validado", `la solicitud quedó validada (${validada?.estado})`);
    ok(
      validada?.vb_area_por === fx.usuarios.jefe.id,
      "y el visto bueno del área se conserva: son dos verificaciones, no una que reemplaza a la otra"
    );
    const marcas = await staffUI.page.locator("main").innerText();
    ok(
      /Jefa de Producción e2e/.test(marcas) && /Validación IRStrat/.test(marcas),
      "el detalle muestra las dos marcas cumplidas"
    );

    // Ya validada: la marca queda fija.
    const trasValidar = rechazada(
      await jefeDb
        .from("solicitudes")
        .update({ vb_area_por: null, vb_area_fecha: null })
        .eq("id", fx.solIrstrat)
        .select("id")
    );
    ok(
      trasValidar.rechazada,
      `el jefe ya no puede retirarlo después de validada (${trasValidar.motivo})`
    );

    // -----------------------------------------------------------------------
    bloque("7) Validar SIN visto bueno: procede, y se dice");
    // -----------------------------------------------------------------------
    // Solicitud interna del cliente, sin firma del área en ningún momento.
    const { data: solInterna, error: siErr } = await clienteDb
      .from("solicitudes")
      .insert({
        reporte_id: fx.reporteId,
        titulo: "Consumo de agua 2027 (interna del cliente)",
        area_asignada: FIXTURE.area,
        es_cuantitativa: true,
        unidad_esperada: "m3",
        responsable_cliente_id: fx.usuarios.subordinado.id,
        origen: "cliente",
        orden: 20,
      })
      .select("id, origen")
      .single();
    ok(!siErr && solInterna?.origen === "cliente", `la interna se creó (${siErr?.message ?? "ok"})`);
    if (fx.datapointLibre) {
      const { error } = await staffDb
        .from("mapeo_solicitud_datapoint")
        .insert({ solicitud_id: solInterna.id, datapoint_id: fx.datapointLibre });
      if (error) console.error(`  ⚠️  mapeo interna: ${error.message}`);
    }

    await cargarPorPortal(subUI.page, solInterna.id, {
      archivo: "agua-2027.xlsx",
      valor: 9800,
      unidad: "m3",
    });
    // El admin_cliente la valida sin que nadie haya firmado.
    await ir(clienteUI.page, `/admin/solicitudes/${solInterna.id}`);
    const enRev2 = clienteUI.page.getByRole("button", { name: /Poner en revisi/i });
    if (await enRev2.count()) {
      await enRev2.first().click();
      await clienteUI.page.waitForTimeout(3000);
      await ir(clienteUI.page, `/admin/solicitudes/${solInterna.id}`);
    }
    await clienteUI.page.getByRole("button", { name: /^Validar$/ }).first().click();
    await clienteUI.page.getByRole("button", { name: /Validar|Sí, validar/i }).last().click();
    await clienteUI.page.waitForTimeout(4000);
    await ir(clienteUI.page, `/admin/solicitudes/${solInterna.id}`);

    const { data: internaVal } = await clienteDb
      .from("solicitudes")
      .select("estado, vb_area_por")
      .eq("id", solInterna.id)
      .single();
    ok(
      internaVal?.estado === "validado" && internaVal?.vb_area_por === null,
      `la validación procede sin visto bueno (${internaVal?.estado}, vb=${internaVal?.vb_area_por})`
    );
    const textoInterna = await clienteUI.page.locator("main").innerText();
    ok(
      /Sin visto bueno del área/.test(textoInterna),
      "y la pantalla lo dice: «Sin visto bueno del área», no lo esconde"
    );

    // -----------------------------------------------------------------------
    bloque("8) Negativos: quién NO puede firmar ni validar");
    // -----------------------------------------------------------------------
    const { data: solLibre, error: slErr } = await staffDb
      .from("solicitudes")
      .insert({
        reporte_id: fx.reporteId,
        titulo: "Emisiones fugitivas 2027 (para negativos)",
        area_asignada: FIXTURE.area,
        responsable_cliente_id: fx.usuarios.subordinado.id,
        orden: 40,
      })
      .select("id")
      .single();
    if (slErr) throw new Error(`solicitud para negativos: ${slErr.message}`);
    await cargarPorPortal(subUI.page, solLibre.id, { archivo: "fugitivas-2027.xlsx" });

    const otroJefe = rechazada(
      await otroJefeDb
        .from("solicitudes")
        .update({ vb_area_por: fx.usuarios.jefeOtra.id, vb_area_fecha: new Date().toISOString() })
        .eq("id", solLibre.id)
        .select("id")
    );
    ok(otroJefe.rechazada, `el jefe de OTRA área no puede firmarla (${otroJefe.motivo})`);

    const subFirma = rechazada(
      await subDb
        .from("solicitudes")
        .update({ vb_area_por: fx.usuarios.subordinado.id, vb_area_fecha: new Date().toISOString() })
        .eq("id", solLibre.id)
        .select("id")
    );
    ok(subFirma.rechazada, `el responsable de área tampoco: no es su firma (${subFirma.motivo})`);

    const jefeValida = rechazada(
      await jefeDb
        .from("solicitudes")
        .update({ estado: "validado" })
        .eq("id", solLibre.id)
        .select("id")
    );
    ok(jefeValida.rechazada, `el jefe de área NO valida (${jefeValida.motivo})`);

    const jefeEdita = rechazada(
      await jefeDb
        .from("solicitudes")
        .update({ titulo: "Título cambiado por el jefe" })
        .eq("id", solLibre.id)
        .select("id")
    );
    ok(jefeEdita.rechazada, `ni edita el contenido de la solicitud (${jefeEdita.motivo})`);

    // Y sí puede lo suyo, sobre la misma fila: la prueba de que los rechazos de
    // arriba no son un "no puede tocar nada".
    const jefeFirma = await jefeDb
      .from("solicitudes")
      .update({ vb_area_por: fx.usuarios.jefe.id, vb_area_fecha: new Date().toISOString() })
      .eq("id", solLibre.id)
      .select("vb_area_por");
    ok(
      !jefeFirma.error && jefeFirma.data?.[0]?.vb_area_por === fx.usuarios.jefe.id,
      `el jefe del área sí firma esa misma solicitud (${jefeFirma.error?.message ?? "ok"})`
    );

    // No puede firmar en nombre de otro: la base fija el autor.
    await jefeDb
      .from("solicitudes")
      .update({ vb_area_por: null, vb_area_fecha: null })
      .eq("id", solLibre.id);
    await jefeDb
      .from("solicitudes")
      .update({ vb_area_por: fx.usuarios.jefeOtra.id, vb_area_fecha: new Date().toISOString() })
      .eq("id", solLibre.id);
    const { data: suplantada } = await jefeDb
      .from("solicitudes")
      .select("vb_area_por")
      .eq("id", solLibre.id)
      .single();
    ok(
      suplantada?.vb_area_por === fx.usuarios.jefe.id,
      "firmar 'en nombre de' otro no funciona: la base escribe quién está en la sesión"
    );

    // -----------------------------------------------------------------------
    bloque("9) El Excel de trazabilidad trae la columna");
    // -----------------------------------------------------------------------
    const res = await clienteUI.ctx.request.get(
      `/admin/cobertura/export?tenant=${fx.tenantId}`
    );
    ok(res.status() === 200, `el export de trazabilidad responde 200 (${res.status()})`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await res.body()));
    const hoja = wb.getWorksheet("Trazabilidad");
    const encabezados = [];
    hoja.getRow(2).eachCell((c) => encabezados.push(String(c.value ?? "")));
    ok(
      encabezados.includes("Visto bueno del área"),
      `la hoja de trazabilidad trae la columna (${encabezados.length} columnas)`
    );
    const iVB = encabezados.indexOf("Visto bueno del área") + 1;
    const celdas = [];
    hoja.eachRow({ includeEmpty: false }, (row, n) => {
      if (n > 2) celdas.push(String(row.getCell(iVB).value ?? ""));
    });
    ok(
      celdas.some((c) => /Jefa de Producción e2e/.test(c)),
      "con el nombre de quien firmó"
    );
    ok(
      celdas.some((c) => c === "Sin visto bueno del área"),
      "y lo dice explícitamente cuando no se dio (una celda vacía se leería como 'no aplica')"
    );
  } finally {
    for (const c of ctxs) await c.close().catch(() => {});
    await browser.close();
    if (tenantId) {
      await limpiarFixture(admin, staffDb, tenantId);
      console.log("\n  (fixture e2e eliminado)");
    }
  }

  if (problemas.length) {
    console.log(`\n✗ ${problemas.length} fallo(s):`);
    for (const p of problemas) console.log(`   · ${p}`);
    process.exit(1);
  }
  console.log("\n✅ E2E OK — visto bueno del área: cadena completa, revocación automática y doble marca.");
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(2);
});
