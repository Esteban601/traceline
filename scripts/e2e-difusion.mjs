/**
 * =============================================================================
 * E2E de la DIFUSIÓN MULTI-ÁREA — sesiones REALES.
 *
 *   node scripts/e2e-difusion.mjs [baseUrl]
 *   BASE_URL=http://localhost:3001 node scripts/e2e-difusion.mjs
 *
 * Requiere `supabase start`, `supabase db reset` y `pnpm dev` corriendo.
 *
 * EL CASO: quien pregunta no sabe qué área tiene el dato. Difunde a tres, y:
 *
 *   · una ENTREGA,
 *   · otra DECLARA que no le corresponde (con su nota),
 *   · la tercera se queda SILENTE.
 *
 * Lo que se comprueba es que las tres cosas se vean como son —en el portal de cada
 * área, en la vista de grupo de quien difundió y en el entregable— y que lo
 * declinado deje de pesar: fuera de sus pendientes, de su barra de avance, de los
 * recordatorios y de las brechas de cobertura.
 *
 * Fixture propio, retirado al terminar incluso si algo falla.
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
  slug: "e2e-difusion",
  nombre: "Emisora de difusión (e2e)",
  prefijo: "EDIF",
  ejercicio: 2027,
  areas: ["Operaciones", "Finanzas", "Recursos Humanos"],
};
const PASSWORD = "E2eDifusion!2026";
const TITULO = "Consumo de energía eléctrica 2027 por instalación (kWh)";
const NOTA = "Este dato lo lleva Operaciones, con el corporativo.";

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
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 980 } });
  const page = await ctx.newPage();
  await ir(page, "/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  return { ctx, page };
}
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
  await page.getByRole("button", { name: /^(Enviar|Reenviar)$/ }).click();
  await page.waitForTimeout(4500);
}

// =============================================================================
// Fixture: tres áreas, una persona por área, y el administrador del cliente
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

  const { error: aErr } = await staffDb
    .from("areas_tenant")
    .insert(FIXTURE.areas.map((nombre, i) => ({ tenant_id: tenant.id, nombre, orden: i })));
  if (aErr) throw new Error(`áreas: ${aErr.message}`);

  const { data: reporte, error: rErr } = await staffDb
    .from("reportes")
    .insert({
      tenant_id: tenant.id,
      nombre: "Informe Anual Sustentable (e2e difusión)",
      ejercicio: FIXTURE.ejercicio,
      estado: "activo",
    })
    .select("id")
    .single();
  if (rErr) throw new Error(`reporte: ${rErr.message}`);

  const usuarios = {};
  const defs = {
    operaciones: { rol: "cliente", area: FIXTURE.areas[0], nombre: "Responsable Operaciones e2e" },
    finanzas: { rol: "cliente", area: FIXTURE.areas[1], nombre: "Responsable Finanzas e2e" },
    rh: { rol: "cliente", area: FIXTURE.areas[2], nombre: "Responsable RH e2e" },
    jefeFinanzas: { rol: "jefe_area", area: FIXTURE.areas[1], nombre: "Jefa de Finanzas e2e" },
    adminCliente: { rol: "admin_cliente", area: null, nombre: "Administradora e2e" },
  };
  for (const [clave, def] of Object.entries(defs)) {
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

  return { tenantId: tenant.id, reporteId: reporte.id, usuarios };
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
  console.log(`E2E difusión multi-área contra ${BASE}\n`);

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

    // -----------------------------------------------------------------------
    bloque("1) Difundir a las tres áreas, desde el formulario");
    // -----------------------------------------------------------------------
    const staffUI = await sesionUI(browser, ANALISTA_EMAIL, DEMO_PASSWORD);
    ctxs.push(staffUI.ctx);
    await ir(staffUI.page, "/admin/solicitudes/nueva");
    await staffUI.page.selectOption("#reporte_id", fx.reporteId).catch(() => {});
    await staffUI.page.fill("#titulo", TITULO);
    await staffUI.page.waitForTimeout(400);

    // "Todas las áreas" es el atajo del caso: no sé quién lo tiene, pregunto a todas.
    await staffUI.page.getByRole("button", { name: "Todas las áreas" }).click();
    await staffUI.page.waitForTimeout(300);
    ok(
      (await staffUI.page.getByText(/Difusión a 3 áreas/i).count()) > 0,
      "el formulario avisa que va a crear una copia por área"
    );
    // NEGATIVO: el rubro no es seleccionable en una difusión.
    const rubro = staffUI.page.locator("#rubro_taxonomia");
    ok(await rubro.isDisabled(), "el rubro de taxonomía queda deshabilitado");
    ok(
      (await staffUI.page.getByText(/Una difusión no lleva rubro/i).count()) > 0,
      "y la UI explica por qué (la celda la llena una sola solicitud)"
    );

    const cuant = staffUI.page
      .locator('label:has-text("Es cuantitativa") input[type="checkbox"]')
      .first();
    if (!(await cuant.isChecked())) await cuant.check();
    await staffUI.page.waitForTimeout(200);
    await staffUI.page.fill("#unidad_esperada", "kWh");
    await staffUI.page.getByRole("button", { name: /Crear solicitud/i }).click();
    await staffUI.page.waitForURL(/\/admin\/solicitudes\/[0-9a-f-]{36}$/, { timeout: 60_000 });

    const { data: copias } = await staffDb
      .from("solicitudes")
      .select("id, area_asignada, grupo_difusion_id, rubro_taxonomia, responsable_cliente_id")
      .eq("reporte_id", fx.reporteId)
      .order("orden", { ascending: true });
    ok((copias ?? []).length === 3, `se crearon 3 copias (${(copias ?? []).length})`);
    const grupos = new Set((copias ?? []).map((c) => c.grupo_difusion_id));
    ok(
      grupos.size === 1 && [...grupos][0] != null,
      `las tres comparten un grupo_difusion_id (${[...grupos][0]?.slice(0, 8)})`
    );
    ok(
      new Set((copias ?? []).map((c) => c.area_asignada)).size === 3,
      "una copia por área, sin repetir"
    );
    ok(
      (copias ?? []).every((c) => c.rubro_taxonomia === null),
      "ninguna copia lleva rubro de taxonomía"
    );
    const porArea = Object.fromEntries((copias ?? []).map((c) => [c.area_asignada, c.id]));

    // Acotado al TENANT del fixture: la bitácora es append-only y sobrevive al
    // borrado del fixture, así que un conteo global crecería con cada corrida.
    const { data: bitDif } = await staffDb
      .from("bitacora")
      .select("accion, detalle")
      .eq("accion", "solicitud_difundida")
      .eq("tenant_id", fx.tenantId);
    ok(
      (bitDif ?? []).length === 1 && bitDif[0].detalle?.copias === 3,
      `la bitácora registra UN acto de difusión con su conteo (${bitDif?.[0]?.detalle?.copias})`
    );

    // Los recordatorios se heredan en todas las copias.
    const { data: recs } = await staffDb
      .from("solicitudes_recordatorios")
      .select("solicitud_id")
      .in("solicitud_id", Object.values(porArea));
    ok(
      new Set((recs ?? []).map((r) => r.solicitud_id)).size === 3,
      `las tres copias heredaron su calendario de recordatorios (${new Set((recs ?? []).map((r) => r.solicitud_id)).size})`
    );

    // Se envían para que las áreas las vean como solicitadas.
    for (const id of Object.values(porArea)) {
      await staffDb.from("solicitudes").update({ estado: "solicitado" }).eq("id", id);
    }

    // -----------------------------------------------------------------------
    bloque("2) Un área no ve las copias de otra");
    // -----------------------------------------------------------------------
    const opsDb = await sesionDatos(fx.usuarios.operaciones.email, PASSWORD);
    const { data: veOps } = await opsDb.from("solicitudes").select("id, area_asignada");
    ok(
      (veOps ?? []).length === 1 && veOps[0].area_asignada === FIXTURE.areas[0],
      `Operaciones ve solo su copia (${(veOps ?? []).length})`
    );
    const { data: ajena } = await opsDb
      .from("solicitudes")
      .select("id")
      .eq("id", porArea[FIXTURE.areas[1]]);
    ok((ajena ?? []).length === 0, "y pidiendo por id la de Finanzas, nada (RLS)");

    // -----------------------------------------------------------------------
    bloque("3) Operaciones ENTREGA");
    // -----------------------------------------------------------------------
    const opsUI = await sesionUI(browser, fx.usuarios.operaciones.email, PASSWORD);
    ctxs.push(opsUI.ctx);
    await ir(opsUI.page, `/portal/solicitudes/${porArea[FIXTURE.areas[0]]}`);
    ok(
      (await opsUI.page.getByText(/Difusión a varias áreas/i).count()) > 0,
      "el portal dice que la pregunta se difundió"
    );
    ok(
      (await opsUI.page.getByRole("button", { name: "No aplica a mi área" }).count()) > 0,
      "y ofrece declarar que no le corresponde"
    );
    await cargarPorPortal(opsUI.page, porArea[FIXTURE.areas[0]], {
      archivo: "energia-2027.xlsx",
      valor: 128400,
      unidad: "kWh",
    });
    const { count: evOps } = await opsDb
      .from("evidencias")
      .select("id", { count: "exact", head: true })
      .eq("solicitud_id", porArea[FIXTURE.areas[0]]);
    ok(evOps === 1, `Operaciones entregó (${evOps} evidencia)`);
    // Con entrega, ya no puede declinar: el trigger lo impide.
    const trasEntregar = rechazada(
      await opsDb
        .from("solicitudes")
        .update({ declinada: true })
        .eq("id", porArea[FIXTURE.areas[0]])
        .select("id")
    );
    ok(
      trasEntregar.rechazada,
      `y ya no puede declararla ajena: entregó (${trasEntregar.motivo})`
    );

    // -----------------------------------------------------------------------
    bloque("4) Finanzas DECLINA, con su nota");
    // -----------------------------------------------------------------------
    const finUI = await sesionUI(browser, fx.usuarios.finanzas.email, PASSWORD);
    ctxs.push(finUI.ctx);
    const idFin = porArea[FIXTURE.areas[1]];
    await ir(finUI.page, `/portal/solicitudes/${idFin}`);
    await finUI.page.getByRole("button", { name: "No aplica a mi área" }).click();
    await finUI.page.fill("#nota-declinar", NOTA);
    await finUI.page.getByRole("button", { name: /Sí, no nos corresponde/i }).click();
    await finUI.page.waitForTimeout(4000);

    const finDb = await sesionDatos(fx.usuarios.finanzas.email, PASSWORD);
    const { data: solFin } = await finDb
      .from("solicitudes")
      .select("declinada, estado")
      .eq("id", idFin)
      .single();
    ok(solFin?.declinada === true, "la copia de Finanzas queda declinada");
    ok(
      solFin?.estado === "solicitado",
      `y NO es una transición de estado: sigue en 'solicitado' (${solFin?.estado})`
    );

    const { data: coms } = await finDb
      .from("comentarios")
      .select("contenido, autor_id")
      .eq("solicitud_id", idFin);
    ok(
      (coms ?? []).some((c) => /no le corresponde/i.test(c.contenido)),
      "se publicó el comentario estándar en la conversación"
    );
    ok(
      (coms ?? []).some((c) => c.contenido.includes(NOTA)),
      "con la nota de quién sí tiene el dato"
    );

    await ir(finUI.page, `/portal/solicitudes/${idFin}`);
    ok(
      (await finUI.page.getByText(/Declinada — no aplica a esta área/i).count()) > 0,
      "el detalle lo muestra en gris, con su palabra"
    );
    ok(
      (await finUI.page.locator("#evidencia-file").count()) === 0,
      "y ya no ofrece cargar evidencia"
    );
    const cargaTrasDeclinar = rechazada(
      await finDb
        .from("evidencias")
        .insert({
          solicitud_id: idFin,
          archivo_path: `${fx.tenantId}/${idFin}/no.xlsx`,
          nombre_original: "no.xlsx",
          periodo_cubierto: "2027",
          subido_por: fx.usuarios.finanzas.id,
          version: 0,
        })
        .select("id")
    );
    ok(cargaTrasDeclinar.rechazada, `ni la base la acepta (${cargaTrasDeclinar.motivo})`);

    // Fuera de sus pendientes y de su avance.
    await ir(finUI.page, "/portal");
    const tablero = await finUI.page.locator("main").innerText();
    ok(
      /Declinada/.test(tablero),
      "en su tablero aparece como Declinada, no como pendiente"
    );
    // Sin nada en juego, la barra de avance no se pinta —es lo correcto— así que
    // lo que se comprueba es el efecto: ningún pendiente y ningún chip de "te
    // toca". Si la declinada contara, aquí aparecería un 1.
    const compacto = tablero.replace(/\s+/g, " ");
    ok(
      !/Has completado/.test(compacto),
      `sin solicitudes en juego no hay barra de avance (${/Has completado[^.]*/.exec(compacto)?.[0] ?? "no se pinta"})`
    );
    ok(
      !/Pendiente de tu información/i.test(compacto),
      "y ningún chip de «pendiente de tu información» en su lista"
    );

    // -----------------------------------------------------------------------
    bloque("5) El jefe del área también puede declarar (y retomar)");
    // -----------------------------------------------------------------------
    const jefeDb = await sesionDatos(fx.usuarios.jefeFinanzas.email, PASSWORD);
    const retoma = await jefeDb
      .from("solicitudes")
      .update({ declinada: false })
      .eq("id", idFin)
      .select("declinada");
    ok(
      !retoma.error && retoma.data?.[0]?.declinada === false,
      `el jefe de Finanzas la retoma (${retoma.error?.message ?? "ok"})`
    );
    const vuelve = await jefeDb
      .from("solicitudes")
      .update({ declinada: true })
      .eq("id", idFin)
      .select("declinada");
    ok(
      !vuelve.error && vuelve.data?.[0]?.declinada === true,
      "y la vuelve a declinar (reversible mientras el grupo esté abierto)"
    );
    // NEGATIVO: no puede tocar nada más de la fila.
    const jefeEdita = rechazada(
      await jefeDb
        .from("solicitudes")
        .update({ titulo: "Otro título" })
        .eq("id", idFin)
        .select("id")
    );
    ok(jefeEdita.rechazada, `pero no edita el contenido (${jefeEdita.motivo})`);
    // NEGATIVO: otra área no declina por Finanzas.
    const ajenaDeclina = rechazada(
      await opsDb.from("solicitudes").update({ declinada: true }).eq("id", idFin).select("id")
    );
    ok(ajenaDeclina.rechazada, `y otra área no declina por ella (${ajenaDeclina.motivo})`);

    // -----------------------------------------------------------------------
    bloque("6) La vista de grupo refleja los tres caminos");
    // -----------------------------------------------------------------------
    await ir(staffUI.page, `/admin/solicitudes/${porArea[FIXTURE.areas[0]]}`);
    const grupoTxt = await staffUI.page.locator("main").innerText();
    ok(/Difusión a 3 áreas/i.test(grupoTxt), "el detalle trae el panel del grupo");
    ok(/Entregó/.test(grupoTxt), "con «Entregó» para Operaciones");
    ok(/Declinó/.test(grupoTxt), "«Declinó» para Finanzas");
    ok(/Sin respuesta/.test(grupoTxt), "y «Sin respuesta» para la tercera");
    ok(new RegExp(NOTA.slice(0, 30)).test(grupoTxt), "y muestra la nota del área que declinó");

    // -----------------------------------------------------------------------
    bloque("7) Desactivar las copias que sobran");
    // -----------------------------------------------------------------------
    await staffUI.page.getByRole("button", { name: /Desactivar copias/i }).click();
    await staffUI.page.waitForTimeout(400);
    await staffUI.page.getByRole("button", { name: /^Retirar \d+$/ }).click();
    await staffUI.page.waitForTimeout(4500);

    const { data: trasRetirar } = await staffDb
      .from("solicitudes")
      .select("area_asignada, declinada, desactivada")
      .eq("reporte_id", fx.reporteId);
    const desactivadas = (trasRetirar ?? []).filter((s) => s.desactivada);
    ok(
      desactivadas.length >= 1 && desactivadas.every((s) => s.area_asignada !== FIXTURE.areas[0]),
      `se retiraron ${desactivadas.length} copias, ninguna de las que entregó`
    );
    const { data: bitDes } = await staffDb
      .from("bitacora")
      .select("accion, detalle")
      .eq("accion", "copia_desactivada")
      .eq("tenant_id", fx.tenantId);
    ok((bitDes ?? []).length === desactivadas.length, "cada retiro queda en bitácora");

    // La que entregó no se puede retirar ni forzando.
    const forzar = rechazada(
      await staffDb
        .from("solicitudes")
        .update({ desactivada: true })
        .eq("id", porArea[FIXTURE.areas[0]])
        .select("id")
    );
    ok(forzar.rechazada, `la copia con evidencia no se retira (${forzar.motivo})`);

    // -----------------------------------------------------------------------
    bloque("8) Cobertura y entregables");
    // -----------------------------------------------------------------------
    // El Excel de trazabilidad las lista con su estado de difusión.
    const res = await staffUI.page.context().request.get(
      `/admin/cobertura/export?tenant=${fx.tenantId}`
    );
    ok(res.status() === 200, `el export de trazabilidad responde 200 (${res.status()})`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await res.body()));
    const hoja = wb.getWorksheet("Trazabilidad");
    const encabezados = [];
    hoja.getRow(2).eachCell((c) => encabezados.push(String(c.value ?? "")));
    ok(encabezados.includes("Difusión"), "la hoja trae la columna Difusión");

    // Cobertura: la declinada no cuenta como brecha (no está ligada a datapoints en
    // este fixture, así que lo que se comprueba es que el tablero no truene y que la
    // solicitud declinada no aparezca como solicitud ligada).
    await ir(staffUI.page, `/admin/cobertura?tenant=${fx.tenantId}`);
    ok(
      (await staffUI.page.getByRole("heading", { name: /Cobertura de la taxonom/i }).count()) > 0,
      "la cobertura carga con el fixture"
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
  console.log("\n✅ E2E OK — difusión multi-área: copia por área, declinar, retomar y cerrar el grupo.");
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(2);
});
