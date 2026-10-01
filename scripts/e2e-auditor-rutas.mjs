/**
 * =============================================================================
 * RUTA POR RUTA con la cuenta AUDITOR del seed — contra el SERVIDOR.
 *
 *   npm run dev            (en otra terminal)
 *   node scripts/e2e-auditor-rutas.mjs [baseUrl]
 *
 * Requiere `supabase start` y `supabase db reset`.
 *
 * QUÉ PRUEBA, y en qué se distingue de e2e-rol-auditor.mjs:
 *
 *   Aquel prueba la BASE: que RLS niegue el INSERT aunque el POST venga forjado.
 *   Este prueba el SERVIDOR: que la ruta rebote ANTES de renderizar nada, que es
 *   lo que el encargo §4 pide —«cada acción prohibida devuelve rechazo del
 *   servidor, no solo botón oculto, probada ruta por ruta»—. Las dos capas son
 *   necesarias y ninguna sustituye a la otra: una URL tecleada no pasa por
 *   ningún botón, y un rebote de UI no detiene un cliente HTTP.
 *
 * La tercera comprobación, la de que el panel no OFREZCA lo que rechazaría, va
 * al final: se abre cada pantalla permitida y se cuenta lo que no debería estar.
 * =============================================================================
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const PASSWORD = "Demo2025!";
// Contra una copia de staging el auditor es de utilería y lleva contraseña
// propia, que llega por el entorno del subshell y no se escribe en ningún lado.
const PASSWORD_AUDITOR = process.env.E2E_PASSWORD_AUDITOR || PASSWORD;

// Todo lo que la prueba toca se acota a la emisora demo del seed. En local es la
// única con datos; en la copia de staging del ensayo no lo es, y «la primera
// solicitud» o «la primera evidencia» podían ser de otra emisora —incluida una
// real—, y la prueba sobrescribe el archivo de la evidencia que elige.
const TENANT_DEMO = "10000000-0000-0000-0000-000000000001";
const REPORTE_DEMO = "20000000-0000-0000-0000-000000000001";

/**
 * Evidencia sobre la que se prueba la descarga de un archivo AUSENTE.
 *
 * La prueba se fabrica su propia avería —borra el objeto del bucket y lo repone
 * al terminar— en vez de apoyarse en una evidencia rota del seed. Antes se
 * apoyaba en la de "Índice de rotación voluntaria 2025", que llevaba meses sin
 * bytes; al arreglar el seed el 30/09/2026 esa prueba se habría puesto verde
 * sola, afirmando algo que ya no estaba comprobando.
 */
const EV_SIN_BYTES =
  "10000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000004/indice_rotacion_2025_DEMO.xlsx";
const CUENTAS = {
  auditor: "auditor.externo@despacho.example",
  adminIrstrat: "admin@irstrat.example",
  adminCliente: "admin.cliente@empresademo.example",
  staff: "analista@irstrat.example",
};

const svc = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });

/** Sesión del admin del cliente: se abre en el bloque F y se reutiliza después. */
let cli = null;

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

/**
 * `supabase db reset` REINICIA los contenedores de auth, storage y realtime. Si
 * la prueba arranca enseguida, GoTrue contesta con un error vacío (`{}`) y
 * Storage con "invalid response from upstream server": los dos son el servicio
 * levantándose, no un fallo del producto, y confunden durante un rato largo
 * porque parecen fallos de permisos. Se espera a que los dos respondan.
 */
async function esperarStack(segundos = 60) {
  const puntos = [`${URL_SB}/auth/v1/health`, `${URL_SB}/storage/v1/version`];
  for (let i = 0; i < segundos; i++) {
    const listos = await Promise.all(
      // Con apikey: en un proyecto alojado /auth/v1/health la exige (401 sin ella).
      puntos.map((u) => fetch(u, { headers: { apikey: ANON } }).then((r) => r.ok).catch(() => false))
    );
    if (listos.every(Boolean)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    "El stack local no respondió a tiempo (auth/storage). ¿Corrió `supabase start`?"
  );
}

async function entrar(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', email === CUENTAS.auditor ? PASSWORD_AUDITOR : PASSWORD);
  await Promise.all([
    // 90 s: la PRIMERA entrada al panel compila todo el árbol de /admin en
    // turbopack, y en frío eso pasa de 20 s con holgura. No es lentitud del
    // producto; es el costo del primer render en desarrollo.
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }),
    page.click('button[type="submit"]'),
  ]);
}

/**
 * Abre una ruta y devuelve DÓNDE ACABÓ el usuario y qué encabezado ve.
 *
 * No se mira el status HTTP, y conviene explicar por qué: en el App Router un
 * `redirect()` o un `notFound()` de un Server Component viaja como carga RSC con
 * status 200, y es el router del cliente el que cambia la URL —después de
 * `domcontentloaded`—. Leer `page.url()` en cuanto carga el documento devuelve
 * la ruta PEDIDA, no la ruta en la que el usuario termina, y da falsos rojos.
 *
 * Así que se espera a que la URL deje de moverse y se lee también el `h1`: la
 * pregunta que importa no es qué código devolvió el servidor, sino qué pantalla
 * acabó viendo el auditor.
 */
async function ir(page, ruta, esperada) {
  const resp = await page.goto(`${BASE}${ruta}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  // Cuando se espera un REBOTE se aguarda a esa URL explícitamente, en vez de
  // muestrear hasta que la dirección "parezca" quieta. El muestreo tenía una
  // carrera: entre que carga el documento y que el router arranca la navegación
  // del `redirect()` hay un hueco en el que la URL todavía es la pedida y no se
  // mueve, así que cualquier ventana de sondeo puede caer dentro del hueco y
  // dar un rojo falso. Si el rebote no llega, el `catch` deja que la aserción
  // reporte dónde se quedó, que es la información útil.
  if (esperada) {
    await page
      .waitForURL((u) => u.pathname === esperada, { timeout: 20000 })
      .catch(() => {});
  }
  // Siempre se espera a `load`, también cuando se aguardaba una URL: sin esto la
  // función volvía en `domcontentloaded` y quien leyera `main` a continuación
  // podía encontrarlo a medio pintar. Costó tres rojos falsos descubrirlo.
  await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
  const u = new URL(page.url());
  const h1 = await page
    .locator("h1")
    .first()
    .innerText({ timeout: 15000 })
    .catch(() => "(sin h1)");
  return { url: u.pathname + u.search, status: resp?.status() ?? 0, h1: h1.replace(/\s+/g, " ").trim() };
}

async function main() {
  console.log(`Servidor: ${BASE}`);
  await esperarStack();
  const nav = await chromium.launch();

  // Datos de apoyo para armar las URLs con ids reales.
  const staffCtx = await nav.newContext();
  const staffPage = await staffCtx.newPage();
  await entrar(staffPage, CUENTAS.staff);

  const { data: sol } = await svc
    .from("solicitudes")
    .select("id")
    .eq("reporte_id", REPORTE_DEMO)
    .limit(1)
    .single()
    .then((r) => r, () => ({ data: null }));
  let solicitudId = sol?.id ?? null;
  if (!solicitudId) {
    // service_role no tiene SELECT en algunas tablas de este proyecto: se saca
    // de la propia matriz del staff, que es la fuente que la UI ya usa.
    const href = await staffPage.getAttribute('a[href^="/admin/solicitudes/"]', "href");
    solicitudId = href?.split("/").pop() ?? null;
  }
  const reporteId = REPORTE_DEMO;

  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  await entrar(page, CUENTAS.auditor);

  // ---------------------------------------------------------------------------
  bloque("A · Dónde aterriza y qué menú ve");

  ok(new URL(page.url()).pathname === "/admin", `entra al panel: ${new URL(page.url()).pathname}`);

  const menu = (await page.locator("nav").first().innerText()).replace(/\s+/g, " ");
  for (const [etq, debe] of [
    ["Matriz", true], ["Cobertura", true], ["Clima", true],
    ["Objetivos", true], ["Cuestionarios", true],
    ["Bitácora", false], ["Usuarios", false],
    ["Clientes", false], ["Reportes", false], ["Plantillas", false],
  ]) {
    const hay = menu.includes(etq);
    ok(hay === debe, `menú ${debe ? "incluye" : "NO incluye"} «${etq}»${hay === debe ? "" : ` (está: ${hay})`}`);
  }

  // ---------------------------------------------------------------------------
  bloque("B · Rutas PERMITIDAS (abren, 200)");

  for (const [ruta, etq] of [
    ["/admin", "matriz"],
    ["/admin/cobertura", "cobertura"],
    ["/admin/registros", "registros de clima"],
    ["/admin/objetivos", "objetivos"],
    ["/admin/cuestionarios", "cuestionarios"],
    [`/admin/solicitudes/${solicitudId}`, "detalle de solicitud"],
  ]) {
    const r = await ir(page, ruta);
    ok(r.url === ruta, `${etq} → ${r.url} · «${r.h1}»`);
  }

  // ---------------------------------------------------------------------------
  bloque("C · Rutas NEGADAS (rebotan o 404, sin renderizar)");

  for (const [ruta, etq] of [
    ["/admin/usuarios", "usuarios"],
    ["/admin/bitacora", "bitácora general"],
    ["/admin/solicitudes/nueva", "alta de solicitud"],
    ["/admin/clientes", "clientes"],
    ["/admin/reportes", "reportes"],
    ["/admin/plantillas", "plantillas"],
  ]) {
    const r = await ir(page, ruta, "/admin");
    ok(r.url === "/admin" && r.h1.includes("Matriz"), `${etq} → acaba en ${r.url} · «${r.h1}»`);
  }

  // La edición responde con notFound(): no rebota a ningún lado, muestra la
  // pantalla de "no encontrado". No se cuentan formularios —el menú lateral
  // tiene dos propios, y contarlos daba un rojo falso—: se comprueba que el
  // formulario DE EDICIÓN no esté, por su encabezado y por sus campos.
  const edit = await ir(page, `/admin/solicitudes/${solicitudId}/editar`);
  const cuerpo = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const campos = await page.locator('input[name="titulo"], textarea[name="descripcion"]').count();
  ok(
    !cuerpo.includes("Editar solicitud") && campos === 0,
    `edición de solicitud → no encontrada («${edit.h1}»), 0 campos del formulario`
  );

  const portal = await ir(page, "/portal", "/admin");
  ok(portal.url === "/admin", `el portal lo devuelve al panel → ${portal.url} · «${portal.h1}»`);

  // ---------------------------------------------------------------------------
  bloque("D · Descargas");

  const excel = await page.request.get(`${BASE}/admin/cobertura/export`);
  ok(excel.status() === 200, `Excel de cobertura → ${excel.status()} (permitido)`);

  const taxo = await page.request.get(
    `${BASE}/admin/cobertura/export-taxonomia?reporte=${reporteId}`
  );
  ok(taxo.status() === 200, `Excel de taxonomía → ${taxo.status()} (permitido)`);

  // Descarga de evidencia. El seed puebla la TABLA pero no sube archivos (un
  // `db reset` recrea la base, no el bucket), así que IRStrat deja uno por la
  // misma vía que usa el producto y el auditor lo pide por la suya.
  const dbStaff = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  await dbStaff.auth.signInWithPassword({ email: CUENTAS.staff, password: PASSWORD });
  const { data: evFila } = await dbStaff
    .from("evidencias")
    .select("id, archivo_path, nombre_original")
    .like("archivo_path", `${TENANT_DEMO}/%`)
    .neq("archivo_path", EV_SIN_BYTES)
    .limit(1)
    .single();
  const puesto = await dbStaff.storage
    .from("evidencias")
    .upload(evFila.archivo_path, new Blob(["evidencia de prueba"]), {
      contentType: "text/plain",
      upsert: true,
    });
  if (puesto.error) {
    ok(false, `no se pudo dejar el archivo de prueba: ${puesto.error.message}`);
  } else {
    const desc = await page.request.get(`${BASE}/portal/descargar/${evFila.id}`, {
      maxRedirects: 0,
    });
    ok(
      desc.status() === 307 || desc.status() === 302,
      `descarga de evidencia → ${desc.status()} (permitida; el portal solo se le cierra como pantalla)`
    );
  }

  // Descarga de un objeto SIN BYTES. El seed inserta trece filas en
  // storage.objects con metadata a mano y ningún archivo detrás; `db reset` las
  // repone y el archivo nunca existió. `createSignedUrl` firma contra la FILA,
  // no contra el contenido, así que antes esto devolvía una firma válida que al
  // abrirse mostraba el 500 crudo de Storage — y quedaba anotada como descarga.
  //
  // Lo que se afirma aquí es lo que se rompió: mensaje propio, y NINGUNA fila de
  // actividad por un archivo que no se entregó.
  const { count: descargasAntes } = await svc
    .from("auditor_actividad")
    .select("*", { count: "exact", head: true })
    .eq("tipo", "descarga_evidencia");

  const { data: sinBytes } = await dbStaff
    .from("evidencias")
    .select("id, archivo_path")
    .eq("archivo_path", EV_SIN_BYTES)
    .single();

  // Se le quita el archivo a propósito: es la condición que se quiere probar.
  const quitado = await dbStaff.storage.from("evidencias").remove([EV_SIN_BYTES]);
  ok(!quitado.error, "se retira el archivo de una evidencia para probar el caso");

  const rota = await page.request.get(`${BASE}/portal/descargar/${sinBytes.id}`);
  const cuerpoRota = await rota.text();
  ok(rota.status() === 404, `evidencia sin archivo → ${rota.status()} (no 307 a una firma inservible)`);
  ok(
    !cuerpoRota.includes("InternalError") && !cuerpoRota.includes("statusCode"),
    "no se le devuelve el JSON crudo de Storage"
  );
  ok(
    cuerpoRota.includes("El archivo no está disponible"),
    "se le devuelve el mensaje propio"
  );

  const { count: descargasDespues } = await svc
    .from("auditor_actividad")
    .select("*", { count: "exact", head: true })
    .eq("tipo", "descarga_evidencia");
  ok(
    descargasDespues === descargasAntes,
    `no se registró la descarga fallida (${descargasAntes} → ${descargasDespues})`
  );

  // Y se repone, para que la base quede como estaba.
  await dbStaff.storage
    .from("evidencias")
    .upload(EV_SIN_BYTES, new Blob(["evidencia repuesta por la prueba"]), {
      contentType: "text/plain",
    });

  const vitrina = await page.request.get(
    `${BASE}/admin/cobertura/suplemento-demo?reporte=${reporteId}&formato=docx`,
    { maxRedirects: 0 }
  );
  ok(vitrina.status() === 403, `vitrina del suplemento → ${vitrina.status()} (negada)`);

  // ---------------------------------------------------------------------------
  bloque("E · Las pantallas no OFRECEN lo que el servidor rechazaría");

  const sinControles = [
    ["/admin", ["Nueva solicitud"]],
    ["/admin/registros", ["Nuevo registro", "Editar", "Desactivar", "Capturar valores"]],
    ["/admin/objetivos", ["Nuevo objetivo", "Editar", "Desactivar"]],
    ["/admin/cuestionarios", ["Guardar sección"]],
    [`/admin/solicitudes/${solicitudId}`, ["Acción ahora", "Subir evidencia"]],
    ["/admin/cobertura", ["Suplemento"]],
  ];
  for (const [ruta, prohibidos] of sinControles) {
    await ir(page, ruta);
    const txt = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const colados = prohibidos.filter((p) => txt.includes(p));
    ok(colados.length === 0, `${ruta} → sin ${prohibidos.length} controles${colados.length ? ` — se colaron: ${colados.join(", ")}` : ""}`);
  }

  // ---------------------------------------------------------------------------
  bloque("F · Nada de esto le cambió al ADMIN DEL CLIENTE");

  const cliCtx = await nav.newContext();
  cli = await cliCtx.newPage();
  await entrar(cli, CUENTAS.adminCliente);
  const menuCli = (await cli.locator("nav").first().innerText()).replace(/\s+/g, " ");
  for (const [etq, debe] of [
    ["Matriz", true], ["Cobertura", true], ["Bitácora", true], ["Usuarios", true],
    ["Clima", false], ["Objetivos", false], ["Cuestionarios", false],
  ]) {
    ok(menuCli.includes(etq) === debe, `admin del cliente: menú ${debe ? "con" : "sin"} «${etq}»`);
  }
  const bitCli = await ir(cli, "/admin/bitacora");
  ok(bitCli.url === "/admin/bitacora", `admin del cliente sigue entrando a su bitácora → ${bitCli.url}`);
  const regCli = await ir(cli, "/admin/registros");
  ok(regCli.url === "/admin", `admin del cliente sigue fuera de clima → ${regCli.url}`);

  // ---------------------------------------------------------------------------
  bloque("G · Cada vista y cada descarga quedó registrada");

  const { data: filas } = await svc
    .from("auditor_actividad")
    .select("tipo, objeto_tipo, archivo, ip, navegador")
    .order("created_at", { ascending: true });

  const porTipo = {};
  for (const f of filas ?? []) porTipo[f.tipo] = (porTipo[f.tipo] ?? 0) + 1;
  console.log(`  registro: ${filas?.length ?? 0} filas — ${JSON.stringify(porTipo)}`);

  for (const t of [
    "inicio_sesion", "vista_matriz", "vista_cobertura",
    "vista_solicitud", "vista_taxonomia", "descarga_excel",
  ]) {
    ok((porTipo[t] ?? 0) > 0, `hay filas de ${t}: ${porTipo[t] ?? 0}`);
  }
  ok((porTipo["vista_taxonomia"] ?? 0) >= 3, `las tres pantallas de taxonomía: ${porTipo["vista_taxonomia"] ?? 0}`);

  // La IP no se registra desde el 01/10/2026 (protección de datos, a petición
  // del cliente): ninguna fila la trae, venga o no x-forwarded-for.
  const conIp = (filas ?? []).filter((f) => f.ip).length;
  const conUA = (filas ?? []).filter((f) => f.navegador).length;
  ok(conUA === (filas?.length ?? 0), `todas traen navegador (${conUA}/${filas?.length ?? 0})`);
  ok(conIp === 0, `ninguna trae IP (${conIp}/${filas?.length ?? 0})`);

  const descargas = (filas ?? []).filter((f) => f.tipo === "descarga_evidencia");
  ok(descargas.length > 0, `descargas de evidencia registradas: ${descargas.length}`);
  ok(
    descargas.every((f) => !!f.archivo),
    `cada descarga guarda el NOMBRE del archivo (no su ruta en el bucket)`
  );


  // ---------------------------------------------------------------------------
  bloque("H · El canal del auditor: escribe, y ahí se acaba");

  const detalle = `/admin/solicitudes/${solicitudId}`;
  await ir(page, detalle);
  ok(
    (await page.getByText("Comentarios del auditor").count()) > 0,
    "el bloque está en el detalle de solicitud"
  );

  const TEXTO = `Prueba e2e ${Date.now()}: ¿de dónde sale este factor?`;
  const caja = page.locator('textarea[name="texto"]').first();
  ok((await caja.count()) > 0, "el auditor tiene caja para comentar");
  await caja.fill(TEXTO);
  await page.getByRole("button", { name: "Comentar" }).first().click();
  await page.waitForTimeout(2500);
  await ir(page, detalle);
  ok((await page.getByText(TEXTO).count()) > 0, "su comentario aparece");
  ok(
    (await page.getByText("Sin responder").count()) > 0,
    "nace con estado «Sin responder»"
  );
  ok(
    (await page.locator('textarea[name="respuesta"]').count()) === 0,
    "al auditor NO se le ofrece responder su propio comentario"
  );
  ok(
    (await page.getByText(/sin responder$/i).count()) === 0 ||
      (await page.locator("text=/\\d+ sin responder/").count()) === 0,
    "al auditor NO se le muestra el contador de pendientes"
  );

  // El bloque también en las tres pantallas de taxonomía.
  for (const [ruta, etq] of [
    ["/admin/registros", "registros de clima"],
    ["/admin/objetivos", "objetivos"],
    ["/admin/cuestionarios", "cuestionarios"],
  ]) {
    await ir(page, ruta);
    if (ruta === "/admin/cuestionarios") {
      // Las secciones vienen plegadas: hay que abrir una para ver las preguntas.
      const acordeon = page.locator("form button[aria-expanded]").first();
      if (await acordeon.count()) {
        await acordeon.click();
        await page.waitForTimeout(500);
      }
    }
    ok(
      (await page.getByText("Comentarios del auditor").count()) > 0,
      `el bloque está en ${etq}`
    );
  }

  // ---------------------------------------------------------------------------
  bloque("I · Quien responde, y el contador que lo empuja");

  const cliPagina = cli ?? null;
  const cliente = cliPagina ?? (await (async () => {
    const c = await (await nav.newContext()).newPage();
    await entrar(c, CUENTAS.adminCliente);
    return c;
  })());

  await ir(cliente, detalle);
  ok(
    (await cliente.getByText(TEXTO).count()) > 0,
    "el admin del cliente ve el comentario del auditor"
  );
  const cajaResp = cliente.locator('textarea[name="respuesta"]').first();
  ok((await cajaResp.count()) > 0, "y sí tiene caja para responder");

  /**
   * El NÚMERO del aviso de la matriz, no cuántos nodos dicen «sin responder».
   * El aviso es un solo chip («N comentarios del auditor externo sin
   * responder»): contar nodos daba 1 antes y 1 después siempre que quedara otro
   * pendiente —p. ej. los que deja e2e-rol-auditor—, y el rojo era de la prueba.
   * Sin chip, el número es 0.
   */
  async function pendientesEnMatriz(pagina) {
    await ir(pagina, "/admin");
    const chip = pagina.locator("text=/\\d+ comentarios? del auditor externo sin responder/").first();
    await chip.waitFor({ timeout: 10000 }).catch(() => {});
    if ((await chip.count()) === 0) return 0;
    return Number((await chip.innerText()).match(/(\d+) comentarios?/)?.[1] ?? NaN);
  }

  const contadorAntes = await pendientesEnMatriz(cliente);
  ok(contadorAntes > 0, `la matriz le avisa de lo que falta por responder (${contadorAntes})`);

  await ir(cliente, detalle);
  await cliente.locator('textarea[name="respuesta"]').first().fill("Respuesta e2e.");
  await cliente.getByRole("button", { name: "Responder" }).first().click();
  await cliente.waitForTimeout(2500);
  await ir(cliente, detalle);
  ok(
    (await cliente.getByText("Respondido por").count()) > 0,
    "tras responder, el estado cambia a «Respondido por …»"
  );

  await ir(page, detalle);
  ok(
    (await page.getByText("Respuesta e2e.").count()) > 0,
    "el auditor ve la respuesta"
  );

  const contadorDespues = await pendientesEnMatriz(cliente);
  ok(
    contadorDespues === contadorAntes - 1,
    `el contador baja al responder (${contadorAntes} → ${contadorDespues})`
  );

  // ---------------------------------------------------------------------------
  bloque("J · /admin/auditoria: solo el ADMINISTRADOR de IRStrat");

  const adminIrs = await (await nav.newContext()).newPage();
  await entrar(adminIrs, CUENTAS.adminIrstrat);

  const vistaAdmin = await ir(adminIrs, "/admin/auditoria", "/admin/auditoria");
  ok(vistaAdmin.url === "/admin/auditoria", `admin de IRStrat entra → «${vistaAdmin.h1}»`);

  const analista = await (await nav.newContext()).newPage();
  await entrar(analista, CUENTAS.staff);
  const vistaAnalista = await ir(analista, "/admin/auditoria", "/admin");
  ok(vistaAnalista.url === "/admin", `el analista rebota → ${vistaAnalista.url}`);

  const vistaCliente = await ir(cliente, "/admin/auditoria", "/admin");
  ok(vistaCliente.url === "/admin", `el admin del cliente rebota → ${vistaCliente.url}`);

  const vistaAuditor = await ir(page, "/admin/auditoria", "/admin");
  ok(vistaAuditor.url === "/admin", `el propio auditor rebota → ${vistaAuditor.url}`);

  // Agrupación: el auditor lleva varias vistas idénticas de la matriz seguidas.
  //
  // Se afirma con LOCALIZADORES y no leyendo `main` de un tirón: la página llega
  // por streaming, así que `load` puede dispararse con la línea de tiempo aún
  // sin pintar. Un `innerText` inmediato daba rojos falsos; un localizador
  // espera a que el nodo exista, que es lo que de verdad se quiere afirmar.
  await ir(adminIrs, "/admin/auditoria", "/admin/auditoria");
  const agrupados = adminIrs.getByText(/×\d+/).first();
  await agrupados.waitFor({ timeout: 15000 }).catch(() => {});
  ok(await agrupados.isVisible().catch(() => false), "la línea de tiempo agrupa vistas repetidas (×N)");

  const resumen = adminIrs.getByText(/\d+ tramos? · \d+ actos? registrados?/);
  await resumen.first().waitFor({ timeout: 15000 }).catch(() => {});
  const textoResumen = await resumen.first().innerText().catch(() => "");
  ok(textoResumen !== "", `dice cuántos tramos resumen cuántos actos crudos: «${textoResumen}»`);

  const csvAdmin = await adminIrs.request.get(`${BASE}/admin/auditoria/csv`);
  ok(csvAdmin.status() === 200, `CSV para el admin de IRStrat → ${csvAdmin.status()}`);
  const csv = await csvAdmin.text();
  const renglones = csv.trim().split(/\r?\n/);
  ok(renglones[0].includes("Auditor"), "el CSV trae encabezado");
  ok(!renglones[0].split(";").includes("IP"), "el CSV ya no trae columna IP");
  ok(
    renglones.length - 1 > 0,
    `el CSV exporta el registro CRUDO, sin agrupar (${renglones.length - 1} filas)`
  );

  const csvAnalista = await analista.request.get(`${BASE}/admin/auditoria/csv`);
  ok(csvAnalista.status() === 403, `CSV para el analista → ${csvAnalista.status()}`);
  const csvAuditor = await page.request.get(`${BASE}/admin/auditoria/csv`);
  ok(csvAuditor.status() === 403, `CSV para el auditor → ${csvAuditor.status()}`);

  // El enlace desde Bitácora, solo para el administrador de la firma.
  await ir(adminIrs, "/admin/bitacora", "/admin/bitacora");
  const enlaceAct = adminIrs.getByRole("link", { name: "Actividad de auditores" });
  await enlaceAct.first().waitFor({ timeout: 15000 }).catch(() => {});
  ok(
    (await enlaceAct.count()) > 0,
    "Bitácora le ofrece el enlace al admin de IRStrat"
  );
  await ir(analista, "/admin/bitacora", "/admin/bitacora");
  ok(
    (await analista.getByRole("link", { name: "Actividad de auditores" }).count()) === 0,
    "y NO se lo ofrece al analista"
  );
  await ir(cliente, "/admin/bitacora", "/admin/bitacora");
  ok(
    (await cliente.getByRole("link", { name: "Actividad de auditores" }).count()) === 0,
    "ni al admin del cliente"
  );

  // ---------------------------------------------------------------------------
  bloque("K · Alta de auditores: solo la firma");

  /**
   * Roles OFRECIDOS por el selector del alta, no texto de la página.
   *
   * La distinción costó un rojo: el cuerpo de /admin/usuarios incluye la LISTA
   * de usuarios, y ahí aparece "Auditor externo" como etiqueta del auditor del
   * seed —que pertenece a esta emisora— aunque el admin del cliente no pueda
   * asignar ese rol. Leer el cuerpo medía quién existe; lo que se quiere medir
   * es qué se puede crear.
   */
  async function rolesOfrecidos(pagina) {
    await ir(pagina, "/admin/usuarios", "/admin/usuarios");
    const alta = pagina.getByRole("button", { name: /Nuevo usuario/i }).first();
    await alta.waitFor({ timeout: 15000 }).catch(() => {});
    if ((await alta.count()) === 0) return null;
    await alta.click();
    const select = pagina.locator("#u-rol");
    await select.waitFor({ timeout: 15000 }).catch(() => {});
    if ((await select.count()) === 0) return null;
    return await select.locator("option").allInnerTexts();
  }

  const rolesStaff = await rolesOfrecidos(analista);
  ok(
    Array.isArray(rolesStaff) && rolesStaff.includes("Auditor externo"),
    `el staff puede asignar «Auditor externo» — ofrece: ${JSON.stringify(rolesStaff)}`
  );

  const rolesCliente = await rolesOfrecidos(cliente);
  ok(
    Array.isArray(rolesCliente) && !rolesCliente.includes("Auditor externo"),
    `el admin del cliente NO puede asignarlo — ofrece: ${JSON.stringify(rolesCliente)}`
  );

  await nav.close();

  console.log(`\n════════ RESULTADO ════════`);
  if (problemas.length === 0) console.log("  Todo verde.");
  else {
    console.log(`  ${problemas.length} problema(s):`);
    for (const p of problemas) console.log(`   · ${p}`);
  }
  process.exit(problemas.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nFALLA:", e.message);
  process.exit(1);
});
