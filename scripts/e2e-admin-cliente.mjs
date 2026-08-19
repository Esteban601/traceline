/**
 * =============================================================================
 * E2E del rol ADMIN-CLIENTE (tier de autoservicio) — sesiones REALES.
 *
 *   node scripts/e2e-admin-cliente.mjs [baseUrl]
 *   BASE_URL=http://localhost:3001 node scripts/e2e-admin-cliente.mjs
 *
 * Requiere `supabase start`, `supabase db reset` y `pnpm dev` corriendo.
 *
 * QUÉ PRUEBA, Y EN QUÉ CAPA
 * -------------------------
 * Cada afirmación se comprueba donde de verdad se decide:
 *
 *   · UI (Playwright, navegador real, sesión iniciada por el formulario de
 *     login): que la app NO OFREZCA lo que no corresponde —botones ausentes,
 *     zona de carga en gris, secciones fuera del menú, URL directa que rebota— y
 *     que el flujo completo funcione de punta a punta cuando sí corresponde.
 *
 *   · DATOS (supabase-js con la sesión REAL de ese mismo usuario, rol
 *     `authenticated`): que la escritura se rechace aunque nadie pase por la UI.
 *     Esta es la capa que un POST forjado tampoco puede saltar: RLS y los
 *     triggers de `20260820130000_admin_cliente.sql`. Las server actions
 *     delegan aquí, así que un rechazo en esta capa es el rechazo real —
 *     esconder un botón no es una barrera y no se cuenta como tal.
 *
 * Fixture propio (tenant `e2e-autoservicio`) para no tocar Empresa Demo: su
 * export es la referencia de `verify:export` y no debe moverse. Se elimina al
 * terminar, incluso si algo falla.
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

const FIXTURE = {
  slug: "e2e-autoservicio",
  nombre: "Emisora de autoservicio (e2e)",
  prefijo: "EAUT",
  ejercicio: 2027,
  areas: ["RH", "Operaciones"],
  valorInterno: 777,
  valorIrstrat: 1500,
};
const PASSWORD = "E2eAutoservicio!2026";

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

// -----------------------------------------------------------------------------
// Sesiones de datos (supabase-js) — la capa donde se decide de verdad.
// -----------------------------------------------------------------------------
async function sesionDatos(email, password) {
  const c = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login de datos (${email}): ${error.message}`);
  return c;
}

/**
 * ¿La escritura quedó rechazada? RLS puede negar de dos formas legítimas: con
 * error (WITH CHECK / trigger) o filtrando la fila (0 filas afectadas). Las dos
 * cuentan como rechazo; lo que no cuenta es que la fila cambie.
 */
function rechazada(res) {
  if (res.error) return { rechazada: true, motivo: res.error.message };
  const filas = Array.isArray(res.data) ? res.data.length : res.data ? 1 : 0;
  return { rechazada: filas === 0, motivo: filas === 0 ? "0 filas (RLS filtró)" : "PASÓ" };
}

// -----------------------------------------------------------------------------
// Sesiones de UI (Playwright) — login por el formulario real, no cookies forjadas.
// -----------------------------------------------------------------------------
async function sesionUI(browser, email, password) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await ir(page, "/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
  return { ctx, page };
}

/**
 * Navega y espera a que la página esté HIDRATADA, no solo con el HTML en el DOM.
 * Sin esto las pruebas son falsos negativos: los handlers de React aún no están
 * atados (un `setInputFiles` no dispara su onChange y el botón sigue apagado) y
 * las consultas por rol accesible todavía no ven el árbol completo.
 */
async function ir(page, url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Descarga un archivo autenticado reusando las cookies del contexto de UI. */
async function descargarConSesion(ctx, url) {
  const res = await ctx.request.get(url);
  return { status: res.status(), buf: Buffer.from(await res.body()) };
}

function texto(ws, addr) {
  const v = ws?.getCell(addr)?.value;
  if (v == null) return "";
  if (typeof v === "object" && v.richText) return v.richText.map((t) => t.text).join("");
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v);
}

// =============================================================================
// Fixture
// =============================================================================
async function crearFixture(admin, staffDb) {
  // Idempotencia: si quedó de una corrida interrumpida, se retira primero.
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
      // Arranca APAGADO — el default y el comportamiento que se prueba primero.
      staff_puede_cargar: false,
    })
    .select("id")
    .single();
  if (tErr) throw new Error(`tenant: ${tErr.message}`);

  const { error: aErr } = await staffDb
    .from("areas_tenant")
    .insert(FIXTURE.areas.map((nombre, i) => ({ tenant_id: tenant.id, nombre, orden: i })));
  if (aErr) throw new Error(`áreas: ${aErr.message}`);

  const { data: reporte, error: rErr } = await staffDb
    .from("reportes")
    .insert({
      tenant_id: tenant.id,
      nombre: "Informe Anual Sustentable (e2e autoservicio)",
      ejercicio: FIXTURE.ejercicio,
      estado: "activo",
    })
    .select("id")
    .single();
  if (rErr) throw new Error(`reporte: ${rErr.message}`);

  // Usuarios: el administrador del cliente y un responsable de área.
  const usuarios = {};
  for (const [clave, def] of Object.entries({
    adminCliente: {
      email: `admin.${crypto.randomUUID().slice(0, 8)}@${FIXTURE.slug}.example`,
      rol: "admin_cliente",
      area: null,
      nombre: "Administradora e2e",
    },
    area: {
      email: `rh.${crypto.randomUUID().slice(0, 8)}@${FIXTURE.slug}.example`,
      rol: "cliente",
      area: "RH",
      nombre: "Responsable RH e2e",
    },
    // Coordinador designado por IRStrat: el administrador del cliente lo VE pero
    // no lo administra (ni por UI ni en datos).
    coordinador: {
      email: `coord.${crypto.randomUUID().slice(0, 8)}@${FIXTURE.slug}.example`,
      rol: "coordinador",
      area: null,
      nombre: "Coordinacion e2e",
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

  // Solicitud de IRSTRAT (origen 'irstrat' por el default): la que el
  // administrador del cliente verá pero NO podrá revisar ni validar.
  const { data: solIrstrat, error: sErr } = await staffDb
    .from("solicitudes")
    .insert({
      reporte_id: reporte.id,
      titulo: "Inventario GEI Alcance 2 (pedido por IRStrat)",
      area_asignada: "RH",
      es_cuantitativa: true,
      unidad_esperada: "tCO2e",
      rubro_taxonomia: "gei_alcance_2",
      responsable_cliente_id: usuarios.area.id,
      orden: 10,
    })
    .select("id, origen")
    .single();
  if (sErr) throw new Error(`solicitud irstrat: ${sErr.message}`);

  return { tenantId: tenant.id, reporteId: reporte.id, usuarios, solIrstrat };
}

/**
 * Retira el fixture. El borrado de FILAS va con la sesión de STAFF, no con
 * service_role: a `service_role` solo se le concede SELECT sobre estas tablas
 * (ley de la casa), así que un DELETE suyo devolvería 403. Las cuentas de auth
 * sí las borra service_role, que es quien administra GoTrue.
 */
async function limpiarFixture(admin, staffDb, { tenantId }) {
  // Los ARCHIVOS van primero: al borrar el reporte, las filas de `evidencias` se
  // van por cascada y con ellas la única referencia a sus objetos de storage, que
  // quedarían para siempre en el bucket. Se enumeran por carpeta de solicitud,
  // igual que hace `import-gcarso.mjs --limpiar`.
  const { data: solsArchivos } = await staffDb
    .from("solicitudes")
    .select("id, reporte:reportes!inner(tenant_id)")
    .eq("reporte.tenant_id", tenantId);
  for (const s of solsArchivos ?? []) {
    const carpeta = `${tenantId}/${s.id}`;
    const { data: objs } = await admin.storage.from("evidencias").list(carpeta);
    if (objs?.length) {
      await admin.storage.from("evidencias").remove(objs.map((o) => `${carpeta}/${o.name}`));
    }
  }

  // ORDEN OBLIGATORIO. `evidencias.subido_por` y `capturas_valor.capturado_por`
  // apuntan a `perfiles_usuario` con ON DELETE RESTRICT (la cadena de custodia no
  // admite huérfanos), así que borrar primero las cuentas falla en silencio y el
  // tenant queda pegado. Primero el REPORTE —que cascadea solicitudes, evidencias
  // y capturas—, luego las cuentas, y al final las áreas y el tenant.
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
  console.log(`E2E rol admin-cliente contra ${BASE}\n`);

  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const staffDb = await sesionDatos(ANALISTA_EMAIL, DEMO_PASSWORD);
  const adminIrstratDb = await sesionDatos(ADMIN_EMAIL, DEMO_PASSWORD);

  // Reporte del demo, para las pruebas de aislamiento cruzado.
  const { data: repDemo } = await staffDb
    .from("reportes")
    .select("id, tenant:tenants!reportes_tenant_id_fkey!inner(slug)")
    .eq("tenant.slug", "empresa-demo-sab")
    .limit(1)
    .maybeSingle();
  const { data: solDemo } = await staffDb
    .from("solicitudes")
    .select("id, titulo")
    .eq("reporte_id", repDemo?.id ?? "")
    .limit(1)
    .maybeSingle();

  let fixture = null;
  const browser = await chromium.launch();
  try {
    fixture = await crearFixture(admin, staffDb);
    const { tenantId, reporteId, usuarios, solIrstrat } = fixture;

    const acDb = await sesionDatos(usuarios.adminCliente.email, PASSWORD);
    const areaDb = await sesionDatos(usuarios.area.email, PASSWORD);
    const perfil0 = { tenant_id: tenantId };

    // -----------------------------------------------------------------------
    bloque("1) El administrador del cliente entra al PANEL, acotado");
    // -----------------------------------------------------------------------
    const ac = await sesionUI(browser, usuarios.adminCliente.email, PASSWORD);
    ok(
      new URL(ac.page.url()).pathname === "/admin",
      `tras iniciar sesión aterriza en el panel, no en el portal (${new URL(ac.page.url()).pathname})`
    );

    const aside = ac.page.locator("aside");
    for (const label of ["Matriz", "Cobertura", "Bitácora", "Usuarios y áreas"]) {
      ok(
        (await aside.getByRole("link", { name: label, exact: true }).count()) === 1,
        `el menú incluye “${label}”`
      );
    }
    for (const label of ["Clientes", "Reportes", "Plantillas", "Clima", "Objetivos", "Cuestionarios"]) {
      ok(
        (await aside.getByRole("link", { name: label, exact: true }).count()) === 0,
        `el menú NO incluye “${label}” (sección de la firma)`
      );
    }
    ok(
      (await aside.getByText("Emisora de autoservicio (e2e)").count()) > 0,
      "el header del panel lleva la marca de SU cliente, no la de IRStrat"
    );
    ok(
      (await aside.getByText("Administrador del cliente").count()) > 0,
      "el pie del menú declara su rol"
    );

    // -----------------------------------------------------------------------
    bloque("2) Crea una solicitud interna (nace origen 'cliente', con badge)");
    // -----------------------------------------------------------------------
    await ir(ac.page, "/admin/solicitudes/nueva");
    ok(
      (await ac.page.getByRole("heading", { name: "Nueva solicitud interna" }).count()) === 1,
      "el formulario se presenta como “Nueva solicitud interna”"
    );
    ok(
      (await ac.page.locator("#responsable_irstrat_id").count()) === 0,
      "no se ofrece asignar responsable de IRStrat"
    );
    ok(
      (await ac.page.getByText("Mapeo a datapoints").count()) === 0,
      "no se ofrece el mapeo a datapoints (es interno de la firma)"
    );

    const TITULO_INTERNA = "Consumo de combustibles 2027 (interno)";
    await ac.page.fill("#titulo", TITULO_INTERNA);
    await ac.page.fill("#area_asignada", "RH");
    await ac.page.getByLabel("Es cuantitativa (espera un valor)").check();
    await ac.page.fill("#unidad_esperada", "tCO2e");
    await ac.page.selectOption("#rubro_taxonomia", "gei_alcance_1");
    await ac.page.selectOption("#responsable_cliente_id", usuarios.area.id);
    await Promise.all([
      ac.page.waitForURL(/\/admin\/solicitudes\/[0-9a-f-]{36}$/, { timeout: 30_000 }),
      ac.page.getByRole("button", { name: "Crear solicitud" }).click(),
    ]);

    const solInternaId = new URL(ac.page.url()).pathname.split("/").pop();
    ok(
      (await ac.page.getByText("Solicitud interna").first().count()) > 0,
      "el detalle muestra el badge “Solicitud interna”"
    );

    const { data: internaDb } = await staffDb
      .from("solicitudes")
      .select("id, origen, estado, titulo")
      .eq("id", solInternaId)
      .single();
    ok(internaDb?.origen === "cliente", `en la base nace con origen 'cliente' (${internaDb?.origen})`);

    // El administrador del cliente puede EDITAR la suya, y al hacerlo no debe
    // borrar lo que solo el staff escribe. Se comprueba con el responsable de
    // IRStrat: su formulario no lo ofrece, así que llegaría vacío al servidor y un
    // UPDATE que lo incluyera lo dejaría en null con solo guardar una fecha.
    const staffIdParaResp = (await staffDb.auth.getUser()).data.user.id;
    await staffDb
      .from("solicitudes")
      .update({ responsable_irstrat_id: staffIdParaResp })
      .eq("id", solInternaId);
    await ir(ac.page, `/admin/solicitudes/${solInternaId}/editar`);
    await ac.page.fill("#fecha_limite", "2027-06-30");
    await Promise.all([
      ac.page.waitForURL(`**/admin/solicitudes/${solInternaId}`, { timeout: 30_000 }),
      ac.page.getByRole("button", { name: "Guardar cambios" }).click(),
    ]);
    const { data: trasEditar } = await staffDb
      .from("solicitudes")
      .select("responsable_irstrat_id, fecha_limite")
      .eq("id", solInternaId)
      .single();
    ok(
      trasEditar?.fecha_limite === "2027-06-30",
      `al editar la suya, el cambio se guarda (${trasEditar?.fecha_limite})`
    );
    ok(
      trasEditar?.responsable_irstrat_id === staffIdParaResp,
      "y NO borra el responsable de IRStrat que había asignado el staff"
    );

    // Envío: pasa a 'solicitado' con el filtro de origen aplicado.
    await ir(ac.page, `/admin/solicitudes/${solInternaId}`);
    await ac.page.getByRole("button", { name: "Enviar solicitud" }).click();
    await ac.page.waitForTimeout(1500);
    const { data: trasEnvio } = await staffDb
      .from("solicitudes")
      .select("estado")
      .eq("id", solInternaId)
      .single();
    ok(trasEnvio?.estado === "solicitado", `tras “Enviar solicitud” queda solicitada (${trasEnvio?.estado})`);

    // La matriz mezcla los dos orígenes → aparece la columna Origen con ambos.
    await ir(ac.page, "/admin");
    ok(
      (await ac.page.getByRole("columnheader", { name: "Origen" }).count()) === 1,
      "la matriz suma la columna Origen cuando la vista mezcla los dos"
    );
    ok(
      (await ac.page.getByText("Solicitud IRStrat").count()) > 0 &&
        (await ac.page.getByText("Solicitud interna").count()) > 0,
      "la matriz distingue “Solicitud IRStrat” de “Solicitud interna”"
    );

    // -----------------------------------------------------------------------
    bloque("3) Un usuario de área sube evidencia a la solicitud interna");
    // -----------------------------------------------------------------------
    const areaUI = await sesionUI(browser, usuarios.area.email, PASSWORD);
    ok(
      new URL(areaUI.page.url()).pathname === "/portal",
      "el usuario de área sigue entrando al portal simple, sin cambios"
    );
    await ir(areaUI.page, `/portal/solicitudes/${solInternaId}`);
    ok(
      (await areaUI.page.getByText("Solicitud interna").first().count()) > 0,
      "en el portal también ve de dónde viene la petición (badge de origen)"
    );

    await areaUI.page.setInputFiles("#evidencia-file", {
      name: "combustibles-2027.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("periodo,valor\n2027,777\n", "utf8"),
    });
    await areaUI.page.fill("#periodo", String(FIXTURE.ejercicio));
    await areaUI.page.fill("#valor", String(FIXTURE.valorInterno));
    await areaUI.page.fill("#unidad", "tCO2e");
    await areaUI.page.getByRole("button", { name: /^(Enviar|Reenviar)$/ }).click();
    await areaUI.page.waitForTimeout(2500);

    const { data: evsInterna } = await staffDb
      .from("evidencias")
      .select("id, version, cargado_por_staff")
      .eq("solicitud_id", solInternaId);
    ok((evsInterna ?? []).length === 1, `la evidencia quedó registrada (${(evsInterna ?? []).length})`);
    ok(
      evsInterna?.[0]?.cargado_por_staff === false,
      "la carga del área NO se marca como hecha por IRStrat"
    );
    const { data: trasEvidencia } = await staffDb
      .from("solicitudes")
      .select("estado")
      .eq("id", solInternaId)
      .single();
    ok(
      trasEvidencia?.estado === "recibido",
      `la transición automática por evidencia sigue funcionando (${trasEvidencia?.estado})`
    );

    // El usuario de área sigue sin poder validar nada: cargar no es revisar.
    const areaValida = rechazada(
      await areaDb
        .from("solicitudes")
        .update({ estado: "validado" })
        .eq("id", solInternaId)
        .select("id")
    );
    ok(areaValida.rechazada, `el usuario de área no valida su propia entrega (${areaValida.motivo})`);
    const areaObserva = rechazada(
      await areaDb
        .from("comentarios")
        .insert({
          solicitud_id: solInternaId,
          autor_id: usuarios.area.id,
          contenido: "observación que no le corresponde",
          es_observacion: true,
        })
        .select("id")
    );
    ok(
      areaObserva.rechazada,
      `ni registra observaciones formales (${areaObserva.motivo})`
    );

    // -----------------------------------------------------------------------
    bloque("4) El administrador del cliente valida LA SUYA");
    // -----------------------------------------------------------------------
    await ir(ac.page, `/admin/solicitudes/${solInternaId}`);
    await ac.page.getByRole("button", { name: "Poner en revisión" }).click();
    await ac.page.waitForTimeout(1500);
    await ac.page.reload({ waitUntil: "load" });
    await ac.page.waitForLoadState("networkidle").catch(() => {});
    await ac.page.getByRole("button", { name: "Validar" }).click();
    await ac.page.getByRole("button", { name: "Sí, validar" }).click();
    await ac.page.waitForTimeout(2000);

    const { data: validada } = await staffDb
      .from("solicitudes")
      .select("estado")
      .eq("id", solInternaId)
      .single();
    ok(validada?.estado === "validado", `queda validada por el cliente (${validada?.estado})`);

    // Bitácora: el acto queda registrado con el ROL visible.
    const { data: bitInterna } = await staffDb
      .from("bitacora")
      .select("accion, detalle, usuario:perfiles_usuario!bitacora_usuario_id_fkey(nombre, rol)")
      .eq("entidad", "solicitudes")
      .eq("entidad_id", solInternaId)
      .order("created_at", { ascending: false });
    const validadoPorAC = (bitInterna ?? []).some(
      (b) =>
        b.accion === "cambio_estado" &&
        b.detalle?.estado_nuevo === "validado" &&
        b.usuario?.rol === "admin_cliente"
    );
    ok(validadoPorAC, "la bitácora registra la validación con el rol 'admin_cliente'");

    // -----------------------------------------------------------------------
    bloque("5) Su Excel lleva la nota de validación interna");
    // -----------------------------------------------------------------------
    const { status: stExp, buf: bufExp } = await descargarConSesion(
      ac.ctx,
      `/admin/cobertura/export-taxonomia?reporte=${reporteId}`
    );
    ok(stExp === 200, `el administrador del cliente genera SU Excel (HTTP ${stExp})`);
    if (stExp === 200) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(bufExp);
      const gei = wb.getWorksheet("NIIF S2 29(a)(i)");
      ok(
        Number(texto(gei, "C3")) === FIXTURE.valorInterno,
        `C3 (Alcance 1, ${FIXTURE.ejercicio}) = ${FIXTURE.valorInterno}, el valor que validó el cliente`
      );
      ok(
        texto(gei, "E3").includes("(validación interna del cliente)"),
        `la nota de la fila declara la validación interna ("${texto(gei, "E3")}")`
      );
      ok(
        !texto(gei, "E4").includes("validación interna del cliente"),
        "la fila del rubro que pidió IRStrat NO lleva esa salvedad"
      );
    }

    // -----------------------------------------------------------------------
    bloque("6) NO puede validar una solicitud de IRStrat (UI y datos)");
    // -----------------------------------------------------------------------
    await ir(ac.page, `/admin/solicitudes/${solIrstrat.id}`);
    ok(
      (await ac.page.getByText("Solicitud IRStrat").first().count()) > 0,
      "ve la solicitud completa, con su badge de origen"
    );
    ok(
      (await ac.page.getByText(
        "La pidió IRStrat; su revisión y validación son de IRStrat."
      ).count()) > 0,
      "en vez de botones, la UI dice de quién es la revisión"
    );
    for (const label of ["Validar", "Poner en revisión", "Solicitar corrección"]) {
      ok(
        (await ac.page.getByRole("button", { name: label, exact: true }).count()) === 0,
        `no se pinta el botón “${label}”`
      );
    }
    ok(
      (await ac.page.getByRole("link", { name: "Editar solicitud" }).count()) === 0,
      "tampoco se ofrece editarla: la redactó IRStrat"
    );

    const { data: antesIr } = await staffDb
      .from("solicitudes")
      .select("estado")
      .eq("id", solIrstrat.id)
      .single();
    const intentoIr = rechazada(
      await acDb
        .from("solicitudes")
        .update({ estado: "validado" })
        .eq("id", solIrstrat.id)
        .select("id")
    );
    ok(intentoIr.rechazada, `en datos, la transición se rechaza (${intentoIr.motivo})`);
    const { data: despuesIr } = await staffDb
      .from("solicitudes")
      .select("estado")
      .eq("id", solIrstrat.id)
      .single();
    ok(
      despuesIr?.estado === antesIr?.estado,
      `el estado de la solicitud de IRStrat queda intacto (${despuesIr?.estado})`
    );

    // El editar directo por URL tampoco: la página rebota a "no encontrada".
    await ir(ac.page, `/admin/solicitudes/${solIrstrat.id}/editar`);
    ok(
      (await ac.page.getByText("Solicitud no encontrada").count()) > 0,
      "la URL directa de edición de una solicitud de IRStrat rebota"
    );

    // -----------------------------------------------------------------------
    bloque("7) NO puede crear staff, ni salir de su tenant");
    // -----------------------------------------------------------------------
    await ir(ac.page, "/admin/usuarios");
    await ac.page.getByRole("button", { name: "Nuevo usuario" }).click();
    const opcionesRol = await ac.page.locator("#u-rol option").allTextContents();
    ok(
      opcionesRol.length === 2 &&
        opcionesRol.includes("Responsable de área") &&
        opcionesRol.includes("Administrador del cliente"),
      `los roles ofrecidos son solo los suyos (${opcionesRol.join(", ")})`
    );
    ok(
      !opcionesRol.some((o) => /analista|irstrat|coordinador/i.test(o)),
      "ni staff ni coordinador aparecen como opción"
    );
    // Al coordinador —designación de IRStrat— lo VE pero no lo administra: la
    // fila aparece sin acciones, porque la server action y RLS lo rechazarían.
    const filaCoordinador = ac.page.locator("li").filter({
      hasText: usuarios.coordinador.email,
    });
    ok((await filaCoordinador.count()) === 1, "ve al coordinador de su cliente en la lista");
    ok(
      (await filaCoordinador.getByRole("button", { name: "Desactivar" }).count()) === 0 &&
        (await filaCoordinador.getByRole("button", { name: "Invitar" }).count()) === 0,
      "sin botones para administrarlo (el rol coordinador lo designa IRStrat)"
    );
    const intentoCoordinador = rechazada(
      await acDb
        .from("perfiles_usuario")
        .update({ activo: false })
        .eq("id", usuarios.coordinador.id)
        .select("id")
    );
    ok(
      intentoCoordinador.rechazada,
      `en datos, desactivar a un coordinador se rechaza (${intentoCoordinador.motivo})`
    );

    const intentoStaff = rechazada(
      await acDb
        .from("perfiles_usuario")
        .insert({
          id: crypto.randomUUID(),
          tenant_id: null,
          rol: "analista",
          nombre: "Intruso",
          email: `intruso.${crypto.randomUUID().slice(0, 6)}@e2e.example`,
        })
        .select("id")
    );
    ok(intentoStaff.rechazada, `en datos, crear un perfil de staff se rechaza (${intentoStaff.motivo})`);

    // No puede ENUMERAR al equipo de IRStrat: solo verá el nombre de quien
    // aparezca en su propia evidencia (y aquí todavía no ha aparecido nadie).
    const { data: staffVisible } = await acDb
      .from("perfiles_usuario")
      .select("id, email")
      .is("tenant_id", null);
    ok(
      (staffVisible ?? []).length === 0,
      `no puede listar los perfiles de IRStrat (${(staffVisible ?? []).length} visibles)`
    );

    // Una invitación es un cambio de contraseña diferido: no puede emitir una
    // contra un perfil que no administra. Ni de IRStrat…
    const staffId = (await staffDb.auth.getUser()).data.user.id;
    const ligaContraStaff = rechazada(
      await acDb
        .from("invitaciones")
        .insert({
          perfil_id: staffId,
          tenant_id: perfil0.tenant_id,
          token_hash: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
          expira_en: new Date(Date.now() + 3600_000).toISOString(),
        })
        .select("id")
    );
    ok(
      ligaContraStaff.rechazada,
      `no puede emitirse una liga de acceso contra una cuenta de IRStrat (${ligaContraStaff.motivo})`
    );
    // …ni contra el coordinador de su propio cliente.
    const ligaContraCoordinador = rechazada(
      await acDb
        .from("invitaciones")
        .insert({
          perfil_id: usuarios.coordinador.id,
          tenant_id: perfil0.tenant_id,
          token_hash: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
          expira_en: new Date(Date.now() + 3600_000).toISOString(),
        })
        .select("id")
    );
    ok(
      ligaContraCoordinador.rechazada,
      `ni contra un coordinador, que no administra (${ligaContraCoordinador.motivo})`
    );

    const { data: tenantsVisibles } = await acDb.from("tenants").select("slug");
    ok(
      (tenantsVisibles ?? []).length === 1 && tenantsVisibles[0].slug === FIXTURE.slug,
      `solo ve su propio cliente (${(tenantsVisibles ?? []).map((t) => t.slug).join(", ")})`
    );

    const intentoOtroTenant = rechazada(
      await acDb
        .from("perfiles_usuario")
        .insert({
          id: crypto.randomUUID(),
          tenant_id: repDemo ? (await staffDb.from("reportes").select("tenant_id").eq("id", repDemo.id).single()).data.tenant_id : null,
          rol: "cliente",
          nombre: "Intruso ajeno",
          email: `ajeno.${crypto.randomUUID().slice(0, 6)}@e2e.example`,
        })
        .select("id")
    );
    ok(
      intentoOtroTenant.rechazada,
      `en datos, sembrar un usuario en OTRO cliente se rechaza (${intentoOtroTenant.motivo})`
    );

    if (solDemo) {
      await ir(ac.page, `/admin/solicitudes/${solDemo.id}`);
      ok(
        (await ac.page.getByText("Solicitud no encontrada").count()) > 0,
        "la URL directa de una solicitud de Empresa Demo rebota"
      );
    }
    for (const ruta of ["/admin/clientes", "/admin/reportes", "/admin/plantillas", "/admin/registros"]) {
      await ir(ac.page, ruta);
      ok(
        new URL(ac.page.url()).pathname === "/admin",
        `${ruta} devuelve a su matriz (llegó a ${new URL(ac.page.url()).pathname})`
      );
    }

    // Aislamiento al revés: el usuario de área del demo no ve nada del fixture.
    const demoRh = await sesionDatos("rh@empresademo.example", DEMO_PASSWORD);
    const { data: verInterna } = await demoRh
      .from("solicitudes")
      .select("id")
      .eq("id", solInternaId);
    ok(
      (verInterna ?? []).length === 0,
      "un usuario de Empresa Demo no ve la solicitud interna del otro cliente"
    );

    // -----------------------------------------------------------------------
    bloque("8) Gestión de áreas del propio cliente");
    // -----------------------------------------------------------------------
    await ir(ac.page, "/admin/usuarios");
    await ac.page.fill("#area-nueva", "Legal");
    await ac.page.getByRole("button", { name: "Agregar área" }).click();
    await ac.page.waitForTimeout(1500);
    const { data: areasTrasAlta } = await staffDb
      .from("areas_tenant")
      .select("nombre, activo")
      .eq("tenant_id", tenantId);
    ok(
      (areasTrasAlta ?? []).some((a) => a.nombre === "Legal"),
      "crea un área nueva en su catálogo"
    );

    // Renombrar propaga a solicitudes y perfiles (fn_renombrar_area).
    const { data: areaRh } = await staffDb
      .from("areas_tenant")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("nombre", "RH")
      .single();
    const rename = await acDb.rpc("fn_renombrar_area", {
      p_area_id: areaRh.id,
      p_nombre: "Capital Humano",
    });
    ok(!rename.error, `renombra “RH” → “Capital Humano” (${rename.error?.message ?? "ok"})`);
    const { data: solRenombrada } = await staffDb
      .from("solicitudes")
      .select("area_asignada")
      .eq("id", solInternaId)
      .single();
    const { data: perfilRenombrado } = await staffDb
      .from("perfiles_usuario")
      .select("area")
      .eq("id", usuarios.area.id)
      .single();
    ok(
      solRenombrada?.area_asignada === "Capital Humano" &&
        perfilRenombrado?.area === "Capital Humano",
      "el nombre nuevo se propaga a las solicitudes y a los perfiles (la visibilidad por área no se rompe)"
    );

    // Un área de OTRO cliente no se puede tocar.
    const { data: areaDemo } = await staffDb
      .from("areas_tenant")
      .select("id")
      .neq("tenant_id", tenantId)
      .limit(1)
      .single();
    const renameAjeno = await acDb.rpc("fn_renombrar_area", {
      p_area_id: areaDemo.id,
      p_nombre: "Secuestrada",
    });
    ok(
      !!renameAjeno.error,
      `renombrar un área de otro cliente se rechaza (${renameAjeno.error?.message ?? "PASÓ"})`
    );

    // -----------------------------------------------------------------------
    bloque("9) El staff sigue pudiendo todo lo suyo");
    // -----------------------------------------------------------------------
    const staffUI = await sesionUI(browser, ANALISTA_EMAIL, DEMO_PASSWORD);
    await ir(staffUI.page, `/admin/solicitudes/${solIrstrat.id}`);
    // La solicitud de IRStrat está 'pendiente': lo que toca desde ahí es
    // enviarla, y eso es justo lo que el administrador del cliente no puede hacer
    // con ella. La revisión y la validación llegan al final, cuando ya hay
    // evidencia (bloque 14).
    await staffUI.page.getByRole("button", { name: "Enviar solicitud" }).click();
    await staffUI.page.waitForTimeout(2000);
    const { data: staffEnvio } = await staffDb
      .from("solicitudes")
      .select("estado")
      .eq("id", solIrstrat.id)
      .single();
    ok(
      staffEnvio?.estado === "solicitado",
      `el staff sí mueve la solicitud de IRStrat (${staffEnvio?.estado})`
    );

    const intentoStaffSobreInterna = rechazada(
      await staffDb
        .from("solicitudes")
        .update({ estado: "en_revision" })
        .eq("id", solInternaId)
        .select("id")
    );
    ok(
      intentoStaffSobreInterna.rechazada,
      `y NO puede transicionar la interna del cliente (${intentoStaffSobreInterna.motivo})`
    );
    ok(
      (await staffUI.page.locator("aside").getByRole("link", { name: "Clientes", exact: true }).count()) === 1,
      "el menú del staff conserva sus secciones (Clientes)"
    );

    // Y el acto del staff se le atribuye A ÉL en la bitácora del cliente, con su
    // nombre y su rol. Sin la rama de bitácora en `perfiles_staff_visible_al_cliente`,
    // esta entrada se le mostraba al cliente como «Sistema»: no un dato que falta,
    // una atribución falsa.
    await ir(ac.page, "/admin/bitacora");
    ok(
      (await ac.page.getByText("Analista IRStrat · IRStrat · Analista").count()) > 0,
      "en la bitácora del cliente, el acto de IRStrat lleva su nombre y su rol"
    );
    const filasBitacora = ac.page.locator("li").filter({ hasText: "Cambio de estado" });
    ok(
      (await filasBitacora.filter({ hasText: "Sistema" }).count()) === 0,
      "y ningún cambio de estado hecho por una persona aparece como “Sistema”"
    );

    // -----------------------------------------------------------------------
    bloque("10) Toggle “carga por IRStrat” — apagado (default)");
    // -----------------------------------------------------------------------
    await ir(staffUI.page, `/admin/solicitudes/${solIrstrat.id}`);
    ok(
      (await staffUI.page.getByText("La carga de evidencia corresponde al cliente.").count()) > 0,
      "la zona de carga está presente, en gris, con su leyenda"
    );
    ok(
      (await staffUI.page.getByRole("button", { name: "Cargar archivo" }).count()) === 0,
      "y sin botón para cargar"
    );
    const cargaApagada = rechazada(
      await staffDb
        .from("evidencias")
        .insert({
          solicitud_id: solIrstrat.id,
          version: 0,
          archivo_path: `${tenantId}/${solIrstrat.id}/forzada.txt`,
          nombre_original: "forzada.txt",
          periodo_cubierto: String(FIXTURE.ejercicio),
          area_origen: "Capital Humano",
          subido_por: (await staffDb.auth.getUser()).data.user.id,
        })
        .select("id")
    );
    ok(cargaApagada.rechazada, `un POST de carga del staff se rechaza (${cargaApagada.motivo})`);

    const toggleAnalista = rechazada(
      await staffDb
        .from("tenants")
        .update({ staff_puede_cargar: true })
        .eq("id", tenantId)
        .select("id")
    );
    ok(
      toggleAnalista.rechazada,
      `el analista no puede mover el toggle (${toggleAnalista.motivo})`
    );
    // Ni saltárselo dando de alta un cliente que ya nazca con la carga habilitada.
    const altaConTogglePuesto = rechazada(
      await staffDb
        .from("tenants")
        .insert({
          nombre: "Emisora con atajo (e2e)",
          slug: `e2e-atajo-${crypto.randomUUID().slice(0, 8)}`,
          prefijo_folio: "EATJ",
          activo: true,
          staff_puede_cargar: true,
        })
        .select("id")
    );
    ok(
      altaConTogglePuesto.rechazada,
      `ni dar de alta un cliente que nazca con la carga habilitada (${altaConTogglePuesto.motivo})`
    );

    // -----------------------------------------------------------------------
    bloque("11) Toggle encendido por el admin de IRStrat");
    // -----------------------------------------------------------------------
    const adminUI = await sesionUI(browser, ADMIN_EMAIL, DEMO_PASSWORD);
    await ir(adminUI.page, "/admin/clientes");
    const conmutador = adminUI.page.getByRole("switch", {
      name: `Carga de evidencia por IRStrat para ${FIXTURE.nombre}`,
    });
    ok((await conmutador.count()) === 1, "el admin de IRStrat ve el switch en la ficha del cliente");
    await conmutador.click();
    await adminUI.page.getByRole("button", { name: "Sí, habilitar" }).click();
    await adminUI.page.waitForTimeout(2000);

    const { data: tenantTras } = await staffDb
      .from("tenants")
      .select("staff_puede_cargar")
      .eq("id", tenantId)
      .single();
    ok(tenantTras?.staff_puede_cargar === true, "el toggle queda encendido");

    const { data: bitToggle } = await staffDb
      .from("bitacora")
      .select("accion")
      .eq("tenant_id", tenantId)
      .eq("accion", "tenant_carga_staff_habilitada");
    ok(
      (bitToggle ?? []).length === 1,
      "la bitácora registra que IRStrat habilitó la carga para este cliente"
    );

    // El analista NO ve el switch (misma pantalla, otro rol).
    await ir(staffUI.page, "/admin/clientes");
    ok(
      (await staffUI.page.getByRole("switch").count()) === 0,
      "el analista no ve ningún switch de carga (es acción de administrador)"
    );

    // -----------------------------------------------------------------------
    bloque("12) Carga del staff con trazabilidad obligatoria e inborrable");
    // -----------------------------------------------------------------------
    await ir(staffUI.page, `/admin/solicitudes/${solIrstrat.id}`);
    await staffUI.page.getByRole("button", { name: "Cargar archivo" }).click();
    ok(
      (await staffUI.page.getByText("hecha por IRStrat en nombre del área").count()) > 0,
      "el formulario avisa que la autoría quedará registrada"
    );
    await staffUI.page.setInputFiles(`#carga-panel-file-${solIrstrat.id}`, {
      name: "alcance2-2027.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("periodo,valor\n2027,1500\n", "utf8"),
    });
    await staffUI.page.selectOption(`#carga-area-${solIrstrat.id}`, "Capital Humano");
    await staffUI.page.fill(`#carga-periodo-${solIrstrat.id}`, String(FIXTURE.ejercicio));
    await staffUI.page.fill(`#carga-valor-${solIrstrat.id}`, String(FIXTURE.valorIrstrat));
    await staffUI.page.fill(`#carga-unidad-${solIrstrat.id}`, "tCO2e");
    await staffUI.page.getByRole("button", { name: "Cargar evidencia" }).click();
    await staffUI.page.waitForTimeout(3000);

    const { data: evStaff } = await staffDb
      .from("evidencias")
      .select("id, cargado_por_staff, area_origen, subido_por")
      .eq("solicitud_id", solIrstrat.id);
    ok((evStaff ?? []).length === 1, `la evidencia del staff quedó registrada (${(evStaff ?? []).length})`);
    ok(
      evStaff?.[0]?.cargado_por_staff === true,
      "la marca `cargado_por_staff` la puso la base, no el formulario"
    );
    ok(
      evStaff?.[0]?.area_origen === "Capital Humano",
      `queda registrada el área en cuyo nombre se cargó (${evStaff?.[0]?.area_origen})`
    );

    await staffUI.page.reload({ waitUntil: "load" });
    await staffUI.page.waitForLoadState("networkidle").catch(() => {});
    // El NOMBRE tiene que estar: un historial que dice "Cargado por — (IRStrat)"
    // no sirve para aseguramiento.
    ok(
      (await staffUI.page
        .getByText("Cargado por Analista IRStrat (IRStrat) en nombre de Capital Humano")
        .count()) > 0,
      "el historial dice “Cargado por [nombre] (IRStrat) en nombre de [área]”, con el nombre real"
    );

    // Sin `?.`, un fallo de la carga tiraría un TypeError que se llevaría por
    // delante los bloques 13 y 14 — justo la cobertura del toggle.
    const { data: bitCarga } = evStaff?.[0]?.id
      ? await staffDb
          .from("bitacora")
          .select("detalle")
          .eq("entidad", "evidencias")
          .eq("entidad_id", evStaff[0].id)
          .single()
      : { data: null };
    ok(
      bitCarga?.detalle?.cargado_por_staff === true &&
        bitCarga?.detalle?.area_origen === "Capital Humano",
      "la bitácora lo registra igual (cargado_por_staff + área)"
    );

    // El cliente también lo ve en su portal: no hay autoría oculta.
    await ir(areaUI.page, `/portal/solicitudes/${solIrstrat.id}`);
    // La frase PRINCIPAL del portal tiene que decir la verdad: «Entregaste» sobre
    // una carga de IRStrat sería falso en el lugar más visible, con la corrección
    // en letra chica debajo.
    ok(
      (await areaUI.page
        .getByText(/IRStrat cargó .* en nombre de Capital Humano/)
        .count()) > 0,
      "el portal dice que la cargó IRStrat en nombre del área, no «Entregaste»"
    );
    ok(
      (await areaUI.page.getByText("Analista IRStrat (IRStrat)").count()) > 0,
      "y nombra a quién de IRStrat la cargó"
    );
    const encabezado = await areaUI.page.locator("h2").allTextContents();
    ok(
      encabezado.some((h) => h.includes("Entregas registradas")) &&
        !encabezado.some((h) => /Tus entregas|Lo que entregaste/.test(h)),
      `el encabezado no se atribuye la lista al cliente (${encabezado.join(" | ")})`
    );
    // La cifra viaja pegada a esa evidencia: si la carga fue de IRStrat, la
    // capturó IRStrat. «Reportaste» ahí es la misma falsedad, una línea abajo.
    ok(
      (await areaUI.page.getByText("Cifra registrada:").count()) > 0 &&
        (await areaUI.page.getByText("Reportaste:").count()) === 0,
      "la cifra de una carga de IRStrat no se le atribuye al cliente («Cifra registrada», no «Reportaste»)"
    );

    // -----------------------------------------------------------------------
    bloque("13) Apagar de nuevo: nada de lo cargado pierde su marca");
    // -----------------------------------------------------------------------
    const apagar = await adminIrstratDb
      .from("tenants")
      .update({ staff_puede_cargar: false })
      .eq("id", tenantId)
      .select("id");
    // `error: null` no basta: un UPDATE que RLS filtra devuelve 0 filas sin error,
    // y esta aserción tiene que distinguir "lo apagó" de "no tocó nada".
    ok(
      !apagar.error && (apagar.data ?? []).length === 1,
      `el admin de IRStrat apaga el toggle (${apagar.error?.message ?? `${(apagar.data ?? []).length} fila(s)`})`
    );

    const { data: evTrasApagar } = await staffDb
      .from("evidencias")
      .select("id, cargado_por_staff, area_origen")
      .eq("solicitud_id", solIrstrat.id);
    ok(
      evTrasApagar?.[0]?.cargado_por_staff === true &&
        evTrasApagar?.[0]?.area_origen === "Capital Humano",
      "la evidencia ya cargada conserva su marca de autoría"
    );
    await ir(staffUI.page, `/admin/solicitudes/${solIrstrat.id}`);
    ok(
      (await staffUI.page.getByText(/Cargado por .+ \(IRStrat\) en nombre de/).count()) > 0,
      "y el historial la sigue mostrando"
    );
    ok(
      (await staffUI.page.getByText("La carga de evidencia corresponde al cliente.").count()) > 0,
      "la zona de carga vuelve a estar bloqueada"
    );
    const cargaTrasApagar = rechazada(
      await staffDb
        .from("evidencias")
        .insert({
          solicitud_id: solIrstrat.id,
          version: 0,
          archivo_path: `${tenantId}/${solIrstrat.id}/otra.txt`,
          nombre_original: "otra.txt",
          periodo_cubierto: String(FIXTURE.ejercicio),
          area_origen: "Capital Humano",
          subido_por: (await staffDb.auth.getUser()).data.user.id,
        })
        .select("id")
    );
    ok(
      cargaTrasApagar.rechazada,
      `y una carga nueva del staff se rechaza otra vez (${cargaTrasApagar.motivo})`
    );

    // -----------------------------------------------------------------------
    bloque("14) La validación por origen no cambia con el toggle");
    // -----------------------------------------------------------------------
    const acSobreIrstratOtraVez = rechazada(
      await acDb
        .from("solicitudes")
        .update({ estado: "validado" })
        .eq("id", solIrstrat.id)
        .select("id")
    );
    ok(
      acSobreIrstratOtraVez.rechazada,
      `el cliente sigue sin poder validar lo que cargó IRStrat (${acSobreIrstratOtraVez.motivo})`
    );
    // Y IRStrat sí la revisa y la valida, por la UI y con la evidencia ya cargada.
    await ir(staffUI.page, `/admin/solicitudes/${solIrstrat.id}`);
    await staffUI.page.getByRole("button", { name: "Poner en revisión" }).click();
    await staffUI.page.waitForTimeout(1500);
    await ir(staffUI.page, `/admin/solicitudes/${solIrstrat.id}`);
    await staffUI.page.getByRole("button", { name: "Validar" }).click();
    await staffUI.page.getByRole("button", { name: "Sí, validar" }).click();
    await staffUI.page.waitForTimeout(2000);
    const { data: validadaIr } = await staffDb
      .from("solicitudes")
      .select("estado")
      .eq("id", solIrstrat.id)
      .single();
    ok(
      validadaIr?.estado === "validado",
      `y IRStrat sí la revisa y la valida (${validadaIr?.estado})`
    );

    await ac.ctx.close();
    await areaUI.ctx.close();
    await staffUI.ctx.close();
    await adminUI.ctx.close();
  } catch (e) {
    ok(false, `la corrida falló: ${e.message}`);
    console.error(e);
  } finally {
    await browser.close();
    if (fixture) {
      await limpiarFixture(admin, staffDb, fixture);
      console.log("\n  (fixture e2e eliminado)");
    }
  }

  console.log(
    problemas.length === 0
      ? "\n✅ E2E OK — rol admin-cliente, regla de origen, aislamiento y toggle de carga por IRStrat."
      : `\n❌ ${problemas.length} problema(s):\n - ${problemas.join("\n - ")}`
  );
  process.exit(problemas.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(2);
});
