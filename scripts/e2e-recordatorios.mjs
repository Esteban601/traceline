/**
 * =============================================================================
 * E2E de RECORDATORIOS PROGRAMADOS por solicitud — sesiones REALES + cron real.
 *
 *   node scripts/e2e-recordatorios.mjs [baseUrl]
 *   BASE_URL=http://localhost:3001 node scripts/e2e-recordatorios.mjs
 *
 * Requiere `supabase start`, `supabase db reset` y `pnpm dev` corriendo, y
 * CRON_SECRET en .env.local (el mismo que sirve el endpoint).
 *
 * QUÉ FIJA, Y DÓNDE
 * -----------------
 *   · UI (Playwright, sesión iniciada por el formulario): que la sección de
 *     recordatorios exista junto a la fecha límite, que lo que se marca se
 *     guarde, y que sin fecha límite la pantalla lo explique en vez de fingir.
 *   · CRON (POST real al endpoint con su secreto): que dispare el día correcto,
 *     que escriba a los usuarios del ÁREA, que no repita, y que DEJE DE
 *     RECORDAR lo ya validado — que es la mitad del valor de la función.
 *   · DATOS (supabase-js con la sesión de cada quien): que un usuario de área no
 *     pueda cambiar su propio calendario de avisos, y que otro tenant no lo vea.
 *
 * La fecha se fuerza por parámetro del endpoint (`?fecha=`) en vez de mover el
 * reloj de la máquina: es la única pieza del sistema que necesita "otro día", y
 * exponerla detrás del secreto del cron es más honesto que un mock.
 *
 * Fixture propio, retirado al terminar incluso si algo falla.
 * =============================================================================
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";

function envLocal() {
  try {
    return Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
    );
  } catch {
    return {};
  }
}
const ENV = envLocal();

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || ENV.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET || ENV.CRON_SECRET;

const ANALISTA_EMAIL = process.env.ANALISTA_EMAIL || "analista@irstrat.example";
const DEMO_PASSWORD = process.env.ADMIN_PASSWORD || "Demo2025!";

const FIXTURE = {
  slug: "e2e-recordatorios",
  nombre: "Emisora de recordatorios (e2e)",
  prefijo: "EREC",
  ejercicio: 2027,
  area: "Sostenibilidad",
  otraArea: "Finanzas",
};
const PASSWORD = "E2eRecordatorios!2026";

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

/** Fecha local + N días, en YYYY-MM-DD (mismo formato que `date` en Postgres). */
function enDias(n) {
  const f = new Date();
  f.setDate(f.getDate() + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
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
}

async function sesionUI(browser, email, password) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await ir(page, "/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  return { ctx, page };
}

/** Corre el cron de verdad: POST al endpoint con su secreto y la fecha a evaluar. */
async function correrCron(fecha, { secreto = CRON_SECRET } = {}) {
  const res = await fetch(`${BASE}/api/recordatorios?fecha=${fecha}`, {
    method: "POST",
    headers: secreto ? { "x-cron-secret": secreto } : {},
  });
  const cuerpo = await res.json().catch(() => null);
  return { status: res.status, cuerpo };
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
      nombre: "Informe Anual Sustentable (e2e recordatorios)",
      ejercicio: FIXTURE.ejercicio,
      estado: "activo",
    })
    .select("id")
    .single();
  if (rErr) throw new Error(`reporte: ${rErr.message}`);

  // Dos personas EN EL ÁREA (a las dos les toca el correo), una en otra área (no
  // le toca: es la mitad de "al área correcta"), y el administrador del cliente.
  const usuarios = {};
  for (const [clave, def] of Object.entries({
    area1: { rol: "cliente", area: FIXTURE.area, nombre: "Responsable Sostenibilidad e2e" },
    area2: { rol: "cliente", area: FIXTURE.area, nombre: "Analista Sostenibilidad e2e" },
    otraArea: { rol: "cliente", area: FIXTURE.otraArea, nombre: "Responsable Finanzas e2e" },
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

  return { tenantId: tenant.id, reporteId: reporte.id, usuarios };
}

async function limpiarFixture(admin, staffDb, tenantId) {
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
  console.log(`E2E recordatorios programados contra ${BASE}\n`);
  if (!CRON_SECRET) {
    console.error("Falta CRON_SECRET (en el entorno o en .env.local): el cron no se puede probar.");
    process.exit(2);
  }

  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const staffDb = await sesionDatos(ANALISTA_EMAIL, DEMO_PASSWORD);

  const browser = await chromium.launch();
  let tenantId = null;
  const ctxs = [];
  const limite = enDias(3); // la fecha límite de la solicitud: dentro de 3 días

  try {
    const fx = await crearFixture(admin, staffDb);
    tenantId = fx.tenantId;

    // -----------------------------------------------------------------------
    bloque("1) Crear la solicitud con fecha límite y recordatorio de 3 días");
    // -----------------------------------------------------------------------
    const staffUI = await sesionUI(browser, ANALISTA_EMAIL, DEMO_PASSWORD);
    ctxs.push(staffUI.ctx);
    await ir(staffUI.page, "/admin/solicitudes/nueva");

    ok(
      (await staffUI.page.getByText("Recordatorios automáticos").count()) > 0,
      "el formulario trae la sección de recordatorios automáticos"
    );
    // Sin fecha límite todavía: la sección tiene que explicarlo, no ocultarse.
    ok(
      (await staffUI.page.getByText(/Requieren fecha límite/i).count()) > 0,
      "sin fecha límite, la sección explica que no hay cuándo"
    );

    await staffUI.page.selectOption("#reporte_id", fx.reporteId).catch(() => {});
    await staffUI.page.fill("#titulo", "Consumo de agua 2027 por fuente (e2e)");
    // El área es un input con datalist, no un select.
    await staffUI.page.fill("#area_asignada", FIXTURE.area);
    await staffUI.page.fill("#fecha_limite", limite);
    await staffUI.page.waitForTimeout(400);

    // Presets: default 7 y 1 encendidos. Se marca el de 3 (el que se va a probar)
    // y se apagan los otros dos para que el disparo del día sea inequívoco.
    // Por id, no por posición: el formulario tiene otras casillas (es_cuantitativa)
    // y contarlas hacía que la prueba tocara la equivocada — pasó.
    const casilla = (dias) => staffUI.page.locator(`#recordatorio-preset-${dias}`);
    ok(
      (await casilla(7).isChecked()) && (await casilla(1).isChecked()) && !(await casilla(3).isChecked()),
      "los presets nacen con 7 y 1 encendidos, y 3 apagado"
    );
    await casilla(7).uncheck();
    await casilla(1).uncheck();
    await casilla(3).check();

    ok(
      (await staffUI.page.getByText(/3 días antes — se enviaría el/i).count()) > 0,
      "la sección dice la FECHA en que caería, no solo «3 días antes»"
    );

    await staffUI.page.getByRole("button", { name: /Crear solicitud/i }).click();
    await staffUI.page.waitForURL(/\/admin\/solicitudes\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    const solId = new URL(staffUI.page.url()).pathname.split("/").pop();
    ok(!!solId, `la solicitud quedó creada (${solId})`);

    const { data: recs } = await staffDb
      .from("solicitudes_recordatorios")
      .select("id, dias_antes, activo")
      .eq("solicitud_id", solId)
      .order("dias_antes", { ascending: false });
    ok(
      (recs ?? []).length === 1 && recs[0].dias_antes === 3 && recs[0].activo === true,
      `quedó UN recordatorio activo de 3 días (${JSON.stringify(recs)})`
    );

    // El detalle lo muestra, con su fecha y sin envíos todavía.
    ok(
      (await staffUI.page.getByRole("heading", { name: "Recordatorios" }).count()) > 0,
      "el detalle de la solicitud tiene su sección de recordatorios"
    );
    ok(
      (await staffUI.page.getByText("3 días antes").count()) > 0,
      "y lista el de 3 días"
    );

    // -----------------------------------------------------------------------
    bloque("2) El cron protegido: sin secreto no corre");
    // -----------------------------------------------------------------------
    const sinSecreto = await correrCron(enDias(0), { secreto: null });
    ok(sinSecreto.status === 401, `sin x-cron-secret responde 401 (${sinSecreto.status})`);

    // -----------------------------------------------------------------------
    bloque("3) El cron del día: escribe al área, y solo al área");
    // -----------------------------------------------------------------------
    // fecha_limite - 3 = hoy.
    const corrida = await correrCron(enDias(0));
    ok(corrida.status === 200, `el cron responde 200 (${corrida.status})`);
    const prog = corrida.cuerpo?.programados;
    ok(prog?.fechaEvaluada === enDias(0), `evaluó la fecha que se le pidió (${prog?.fechaEvaluada})`);
    ok(prog?.modo === "consola", `sin RESEND_API_KEY el envío es en modo consola (${prog?.modo})`);
    const mio = (prog?.detalles ?? []).find((d) => d.solicitudId === solId);
    ok(!!mio, "el resumen incluye la solicitud del fixture");
    ok(mio?.resultado === "enviado", `resultado 'enviado' (${mio?.resultado})`);
    ok(
      mio?.destinatarios === 2,
      `salió a las DOS personas del área, no a las tres del tenant (${mio?.destinatarios})`
    );

    const { data: bit } = await staffDb
      .from("bitacora")
      .select("accion, detalle, created_at")
      .eq("accion", "recordatorio_programado_enviado")
      .eq("entidad_id", solId);
    const correos = (bit ?? []).map((b) => b.detalle?.email).sort();
    const esperados = [fx.usuarios.area1.email, fx.usuarios.area2.email].sort();
    ok(
      JSON.stringify(correos) === JSON.stringify(esperados),
      `la bitácora registra un envío por persona del área (${correos.join(", ")})`
    );
    ok(
      !correos.includes(fx.usuarios.otraArea.email),
      "y NADA a la persona de otra área"
    );
    const d0 = bit?.[0]?.detalle ?? {};
    ok(
      d0.dias_antes === 3 && d0.fecha_limite === limite && d0.area === FIXTURE.area,
      `el detalle guarda días, plazo y área (${JSON.stringify({ d: d0.dias_antes, f: d0.fecha_limite, a: d0.area })})`
    );

    // El detalle de la solicitud ya lo muestra como enviado.
    await ir(staffUI.page, `/admin/solicitudes/${solId}`);
    ok(
      (await staffUI.page.getByText("Ya enviados").count()) > 0,
      "el detalle muestra el bloque «Ya enviados»"
    );
    ok(
      (await staffUI.page.getByText(fx.usuarios.area1.email).count()) > 0,
      "con el correo al que salió"
    );

    // -----------------------------------------------------------------------
    bloque("4) Idempotencia: el cron dos veces no manda dos correos");
    // -----------------------------------------------------------------------
    const repetida = await correrCron(enDias(0));
    const mio2 = (repetida.cuerpo?.programados?.detalles ?? []).find(
      (d) => d.solicitudId === solId
    );
    ok(mio2?.resultado === "omitido", `la segunda corrida lo omite (${mio2?.resultado})`);
    const { count: bitCount } = await staffDb
      .from("bitacora")
      .select("id", { count: "exact", head: true })
      .eq("accion", "recordatorio_programado_enviado")
      .eq("entidad_id", solId);
    ok(bitCount === 2, `siguen siendo 2 entradas de bitácora, una por persona (${bitCount})`);

    // -----------------------------------------------------------------------
    bloque("5) Otro día: el mismo recordatorio no dispara");
    // -----------------------------------------------------------------------
    const otroDia = await correrCron(enDias(1)); // faltarían 2 días, no 3
    const mio3 = (otroDia.cuerpo?.programados?.detalles ?? []).find(
      (d) => d.solicitudId === solId
    );
    ok(!mio3, "un día que no corresponde no lo toca");

    // -----------------------------------------------------------------------
    bloque("6) Validada: el cron ya no la recuerda");
    // -----------------------------------------------------------------------
    // Se agrega un recordatorio de 1 día (que caería mañana) y se valida la
    // solicitud: el punto es que el ESTADO manda sobre el calendario.
    const { error: addErr } = await staffDb
      .from("solicitudes_recordatorios")
      .insert({ solicitud_id: solId, dias_antes: 1, activo: true });
    ok(!addErr, `se programa además uno de 1 día (${addErr?.message ?? "ok"})`);

    const val = await staffDb
      .from("solicitudes")
      .update({ estado: "validado" })
      .eq("id", solId)
      .select("estado");
    ok(!val.error && val.data?.[0]?.estado === "validado", `la solicitud queda validada (${val.error?.message ?? "ok"})`);

    const trasValidar = await correrCron(enDias(2)); // fecha_limite - 1 = hoy+2
    const mio4 = (trasValidar.cuerpo?.programados?.detalles ?? []).find(
      (d) => d.solicitudId === solId
    );
    ok(!mio4, "el día del recordatorio de 1 día, ya validada, NO se recuerda");
    const { count: bitFinal } = await staffDb
      .from("bitacora")
      .select("id", { count: "exact", head: true })
      .eq("accion", "recordatorio_programado_enviado")
      .eq("entidad_id", solId);
    ok(bitFinal === 2, `y no se agregó ninguna entrada nueva (${bitFinal})`);

    // -----------------------------------------------------------------------
    bloque("7) Quién puede tocar el calendario");
    // -----------------------------------------------------------------------
    const areaDb = await sesionDatos(fx.usuarios.area1.email, PASSWORD);
    const { data: veArea } = await areaDb
      .from("solicitudes_recordatorios")
      .select("id")
      .eq("solicitud_id", solId);
    ok((veArea ?? []).length === 2, `el usuario de área VE su calendario (${(veArea ?? []).length})`);

    const intentoArea = rechazada(
      await areaDb
        .from("solicitudes_recordatorios")
        .update({ activo: false })
        .eq("solicitud_id", solId)
        .select("id")
    );
    ok(intentoArea.rechazada, `pero no lo cambia (${intentoArea.motivo})`);

    const intentoAlta = rechazada(
      await areaDb
        .from("solicitudes_recordatorios")
        .insert({ solicitud_id: solId, dias_antes: 30 })
        .select("id")
    );
    ok(intentoAlta.rechazada, `ni agrega uno nuevo (${intentoAlta.motivo})`);

    const clienteDb = await sesionDatos(fx.usuarios.adminCliente.email, PASSWORD);
    const alta = await clienteDb
      .from("solicitudes_recordatorios")
      .insert({ solicitud_id: solId, dias_antes: 30 })
      .select("id, dias_antes");
    ok(
      !alta.error && alta.data?.[0]?.dias_antes === 30,
      `el administrador del cliente SÍ gestiona los de su tenant (${alta.error?.message ?? "ok"})`
    );

    // Aislamiento: la administradora del tenant demo no ve nada de este fixture.
    const demoDb = await sesionDatos("admin.cliente@empresademo.example", DEMO_PASSWORD);
    const { data: fuga } = await demoDb
      .from("solicitudes_recordatorios")
      .select("id")
      .eq("solicitud_id", solId);
    ok((fuga ?? []).length === 0, `otro tenant no ve estos recordatorios (${(fuga ?? []).length})`);

    // CHECK de la base: un intervalo imposible no entra ni con sesión válida.
    const cero = rechazada(
      await staffDb
        .from("solicitudes_recordatorios")
        .insert({ solicitud_id: solId, dias_antes: 0 })
        .select("id")
    );
    ok(cero.rechazada, `«0 días antes» lo rechaza la base (${cero.motivo})`);
    const duplicado = rechazada(
      await staffDb
        .from("solicitudes_recordatorios")
        .insert({ solicitud_id: solId, dias_antes: 3 })
        .select("id")
    );
    ok(duplicado.rechazada, `y un intervalo repetido también (${duplicado.motivo})`);

    // -----------------------------------------------------------------------
    bloque("8) Sin fecha límite: configurado, pero sin disparo");
    // -----------------------------------------------------------------------
    const { data: solSinFecha } = await staffDb
      .from("solicitudes")
      .insert({
        reporte_id: fx.reporteId,
        titulo: "Solicitud sin plazo (e2e)",
        area_asignada: FIXTURE.area,
        orden: 20,
      })
      .select("id")
      .single();
    await staffDb
      .from("solicitudes_recordatorios")
      .insert({ solicitud_id: solSinFecha.id, dias_antes: 7, activo: true });
    const sinFecha = await correrCron(enDias(0));
    const mio5 = (sinFecha.cuerpo?.programados?.detalles ?? []).find(
      (d) => d.solicitudId === solSinFecha.id
    );
    ok(!mio5, "una solicitud sin fecha límite no dispara nada (y no truena el cron)");
    ok(sinFecha.status === 200, `el cron sigue respondiendo 200 (${sinFecha.status})`);

    // -----------------------------------------------------------------------
    bloque("9) Un correo que NO llegó no silencia a nadie 5 días");
    // -----------------------------------------------------------------------
    // La regla anti-spam del digest lee la bitácora. Si contara los intentos que
    // NO salieron —Resend caído, o buzón de demostración omitido— una caída de un
    // día se convertiría en una semana de silencio. Se prueba con las dos formas
    // de entrada: la que no llegó (no debe bloquear) y la que sí (debe bloquear).
    const { data: solDigest } = await staffDb
      .from("solicitudes")
      .insert({
        reporte_id: fx.reporteId,
        titulo: "Solicitud para el digest (e2e)",
        area_asignada: FIXTURE.otraArea,
        responsable_cliente_id: fx.usuarios.otraArea.id,
        fecha_limite: enDias(30), // lejos: ningún programado dispara por ella
        orden: 30,
      })
      .select("id")
      .single();
    await admin.from("solicitudes").update({ estado: "solicitado" }).eq("id", solDigest.id);

    const enDigest = (cuerpo) =>
      (cuerpo?.digest?.detalles ?? []).find((d) => d.email === fx.usuarios.otraArea.email);

    // (a) intento OMITIDO en la bitácora: la persona sigue en el digest.
    await admin.from("bitacora").insert({
      tenant_id: tenantId,
      entidad: "correo",
      entidad_id: null,
      accion: "recordatorio_enviado",
      detalle: {
        responsable_id: fx.usuarios.otraArea.id,
        email: fx.usuarios.otraArea.email,
        modo: "omitido",
        enviado: false,
        motivo: "dominio reservado (e2e)",
      },
    });
    const conOmitido = await correrCron(enDias(0));
    const d1 = enDigest(conOmitido.cuerpo);
    ok(
      !!d1 && d1.resultado !== "omitido",
      `un intento que no salió no la bloquea (${d1?.resultado ?? "quedó fuera del digest"})`
    );

    // (b) envío REAL en la bitácora: ahora sí queda bloqueada.
    await admin.from("bitacora").insert({
      tenant_id: tenantId,
      entidad: "correo",
      entidad_id: null,
      accion: "recordatorio_enviado",
      detalle: {
        responsable_id: fx.usuarios.otraArea.id,
        email: fx.usuarios.otraArea.email,
        modo: "consola",
        enviado: true,
      },
    });
    const conEnviado = await correrCron(enDias(0));
    const d2 = enDigest(conEnviado.cuerpo);
    ok(
      !d2 || d2.resultado === "omitido",
      `un envío que sí salió la bloquea por la regla de 5 días (${d2?.resultado ?? "ya no aparece"})`
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
  console.log("\n✅ E2E OK — recordatorios programados: calendario, cron, área correcta y silencio al validar.");
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(2);
});
