/**
 * =============================================================================
 * E2E del ROL AUDITOR — la frontera, probada contra la BASE con sesiones reales.
 *
 *   node scripts/e2e-rol-auditor.mjs
 *
 * Requiere `supabase start` y `supabase db reset` (la cuenta auditor sale del
 * seed). No necesita el servidor de Next: lo que se prueba aquí es RLS, no la
 * interfaz. El Paso 2 del encargo agrega la prueba ruta por ruta contra el
 * servidor, que es otra cosa y no sustituye a esta.
 *
 * LO QUE SE AFIRMA, y por qué cada afirmación:
 *
 *   A. El auditor LEE todo su tenant. Se compara contra el conteo de
 *      service_role: «ve algo» no basta, tiene que ver LO MISMO.
 *   B. No ve NADA de otro tenant. Se levanta una segunda emisora de utilería.
 *   C. No ESCRIBE en ninguna tabla. Una por una, incluido storage.
 *   D. No lee la bitácora general, aunque sea de su tenant.
 *   E. Sí escribe en su canal propio, y ahí tampoco puede editar ni responderse.
 *   F. auditor_actividad la lee el ADMIN de IRStrat y nadie más.
 *
 * Nota sobre la contraseña: es la del seed local (`Demo2025!`), documentada en
 * README-SCHEMA.md y versionada. No es una credencial: es utilería de una base
 * que se recrea con un comando.
 * =============================================================================
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const PASSWORD = "Demo2025!";
const TENANT_DEMO = "10000000-0000-0000-0000-000000000001";
const REPORTE_DEMO = "20000000-0000-0000-0000-000000000001";
const AUDITOR_ID = "a0000000-0000-0000-0000-000000000007";

const CUENTAS = {
  auditor: "auditor.externo@despacho.example",
  adminCliente: "admin.cliente@empresademo.example",
  areaRH: "rh@empresademo.example",
  analista: "analista@irstrat.example",
  adminIrstrat: "admin@irstrat.example",
};

const svc = createClient(URL, SERVICE, { auth: { persistSession: false } });
let RUTA_PRUEBA = null;

const problemas = [];
let seccion = "";
function bloque(t) {
  seccion = t;
  console.log(`\n════════ ${t} ════════`);
}
function ok(cond, mensaje) {
  console.log(`  ${cond ? "✓" : "✗"} ${mensaje}`);
  if (!cond) problemas.push(`[${seccion}] ${mensaje}`);
  return cond;
}

async function sesion(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

/** RLS niega de dos formas legítimas: con error, o devolviendo cero filas. */
function negado(res) {
  if (res.error) return { no: true, motivo: res.error.message.slice(0, 72) };
  const filas = Array.isArray(res.data) ? res.data.length : res.data ? 1 : 0;
  return { no: filas === 0, motivo: filas === 0 ? "0 filas (RLS filtró)" : "PASÓ — hueco" };
}
async function niega(res, etiqueta) {
  const r = negado(await res);
  return ok(r.no, `${etiqueta} → ${r.motivo}`);
}
async function cuenta(cli, tabla, filtro = (q) => q) {
  const { count, error } = await filtro(cli.from(tabla).select("*", { count: "exact", head: true }));
  if (error) return { n: -1, error: error.message };
  return { n: count ?? 0 };
}

// -----------------------------------------------------------------------------
// Utilería: una SEGUNDA emisora, para que «nada de otro tenant» sea comprobable.
// -----------------------------------------------------------------------------
const OTRO = {
  tenant: crypto.randomUUID(),
  reporte: crypto.randomUUID(),
  solicitud: crypto.randomUUID(),
  slug: `e2e-auditor-ajena-${Date.now()}`,
};

// El alta la hace una sesión de STAFF, no service_role: en este proyecto
// service_role solo tiene SELECT sobre `tenants` (las altas pasan por una
// sesión de IRStrat). La utilería se monta por el mismo camino que la
// aplicación, que además es el que conviene ejercitar.
let staff = null;

async function montarOtroTenant() {
  await staff.from("tenants").insert({
    id: OTRO.tenant, nombre: "Emisora ajena (e2e auditor)", slug: OTRO.slug,
    prefijo_folio: "AJEN", activo: true,
  }).throwOnError();
  await staff.from("reportes").insert({
    id: OTRO.reporte, tenant_id: OTRO.tenant, nombre: "Informe ajeno (e2e)",
    ejercicio: 2027, estado: "activo",
  }).throwOnError();
  await staff.from("solicitudes").insert({
    id: OTRO.solicitud, reporte_id: OTRO.reporte, titulo: "Solicitud de otra emisora",
    descripcion: "No debe verla el auditor de Empresa Demo.", area_asignada: "Finanzas",
    es_cuantitativa: false, estado: "solicitado", orden: 1,
  }).throwOnError();
}

// comentarios_auditor y auditor_actividad NO se limpian: son append-only por
// diseño y nadie tiene DELETE sobre ellas, ni el staff. `supabase db reset` es
// lo que las vacía, y que la prueba no pueda borrarlas es en sí una afirmación.
async function desmontarOtroTenant() {
  if (!staff) return;
  if (RUTA_PRUEBA) await staff.storage.from("evidencias").remove([RUTA_PRUEBA]);
  await staff.from("solicitudes").delete().eq("id", OTRO.solicitud);
  await staff.from("reportes").delete().eq("id", OTRO.reporte);
  await staff.from("tenants").delete().eq("id", OTRO.tenant);
}

// =============================================================================
async function main() {
  console.log(`Base: ${URL}`);

  const aud = await sesion(CUENTAS.auditor);
  const adminCli = await sesion(CUENTAS.adminCliente);
  const area = await sesion(CUENTAS.areaRH);
  const analista = await sesion(CUENTAS.analista);
  const adminIrs = await sesion(CUENTAS.adminIrstrat);
  staff = adminIrs;

  await montarOtroTenant();

  // ---------------------------------------------------------------------------
  bloque("A · Lee TODO su tenant (no una parte)");

  // La referencia es lo que ve IRStrat, no service_role: en este proyecto
  // service_role ni siquiera tiene SELECT sobre evidencias o capturas_valor
  // (endurecimiento previo), y la pregunta que importa es si el auditor ve lo
  // mismo que el equipo que ya lo ve todo.
  const solsSvc = await cuenta(staff, "solicitudes", (q) => q.eq("reporte_id", REPORTE_DEMO));
  const solsAud = await cuenta(aud, "solicitudes", (q) => q.eq("reporte_id", REPORTE_DEMO));
  const solsArea = await cuenta(area, "solicitudes", (q) => q.eq("reporte_id", REPORTE_DEMO));
  ok(solsSvc.n > 0, `la emisora demo tiene ${solsSvc.n} solicitudes`);
  ok(solsAud.n === solsSvc.n, `auditor ve ${solsAud.n}/${solsSvc.n} solicitudes (todas las áreas)`);
  ok(solsArea.n > 0 && solsArea.n < solsSvc.n,
     `contraste: el responsable de RH ve ${solsArea.n}/${solsSvc.n} (solo su área) — el filtro por área existe y el auditor lo rebasa por diseño`);

  for (const t of ["evidencias", "capturas_valor", "comentarios"]) {
    const s = await cuenta(staff, t);
    const a = await cuenta(aud, t);
    ok(a.n === s.n && s.n > 0, `${t}: auditor ve ${a.n}/${s.n}`);
  }

  for (const t of ["registros_clima", "registros_clima_valores", "objetivos",
                   "objetivos_detalle", "cuestionarios_respuestas"]) {
    const s = await cuenta(staff, t);
    const a = await cuenta(aud, t);
    ok(a.n === s.n && s.n > 0, `${t}: auditor ve ${a.n}/${s.n} (política nueva)`);
  }

  for (const t of ["datapoints_taxonomia", "rubros_taxonomia", "mapeo_export"]) {
    const a = await cuenta(aud, t);
    ok(a.n > 0, `${t}: auditor ve ${a.n} filas del catálogo (lo necesita Cobertura y el Excel)`);
  }

  // El seed puebla la TABLA evidencias pero no sube archivos (db reset recrea la
  // base, no el bucket). Así que IRStrat deja uno y el auditor lo descarga: es
  // la cadena que va a usar el despacho.
  const { data: solStorage } = await staff.from("solicitudes")
    .select("id").eq("reporte_id", REPORTE_DEMO).limit(1).single();
  RUTA_PRUEBA = `${TENANT_DEMO}/${solStorage.id}/e2e-auditor-${Date.now()}.txt`;
  const puesto = await staff.storage.from("evidencias")
    .upload(RUTA_PRUEBA, new Blob(["evidencia de prueba"]), { contentType: "text/plain" });
  if (puesto.error) {
    ok(false, `storage: IRStrat no pudo dejar el archivo de prueba — ${puesto.error.message}`);
  } else {
    const dl = await aud.storage.from("evidencias").download(RUTA_PRUEBA);
    ok(!dl.error, `storage: el auditor descarga la evidencia de su tenant${dl.error ? ` — ${dl.error.message}` : ""}`);
  }

  // ---------------------------------------------------------------------------
  bloque("B · No ve NADA de otra emisora");

  await niega(aud.from("solicitudes").select("id").eq("reporte_id", OTRO.reporte),
              "solicitudes de la emisora ajena");
  await niega(aud.from("reportes").select("id").eq("id", OTRO.reporte), "reporte ajeno");
  await niega(aud.from("tenants").select("id").eq("id", OTRO.tenant), "tenant ajeno");

  const tenantsAud = await cuenta(aud, "tenants");
  ok(tenantsAud.n === 1, `tenants visibles para el auditor: ${tenantsAud.n} (solo el suyo)`);

  // ---------------------------------------------------------------------------
  bloque("C · No ESCRIBE en ninguna tabla");

  const { data: solDemo } = await staff.from("solicitudes")
    .select("id").eq("reporte_id", REPORTE_DEMO).limit(1).single();

  await niega(aud.from("evidencias").insert({
    solicitud_id: solDemo.id, version: 99, archivo_path: `${TENANT_DEMO}/${solDemo.id}/intruso.pdf`,
    nombre_original: "intruso.pdf", subido_por: AUDITOR_ID,
  }).select(), "INSERT en evidencias");

  await niega(aud.from("capturas_valor").insert({
    solicitud_id: solDemo.id, valor: 1, unidad: "t", periodo: "2025", capturado_por: AUDITOR_ID,
  }).select(), "INSERT en capturas_valor");

  await niega(aud.from("comentarios").insert({
    solicitud_id: solDemo.id, autor_id: AUDITOR_ID, contenido: "comentario por el canal equivocado",
  }).select(), "INSERT en comentarios");

  await niega(aud.from("comentarios").insert({
    solicitud_id: solDemo.id, autor_id: AUDITOR_ID,
    contenido: "observación formal falsificada", es_observacion: true,
  }).select(), "INSERT en comentarios con es_observacion = true");

  await niega(aud.from("solicitudes").update({ estado: "validado" }).eq("id", solDemo.id).select(),
              "UPDATE de solicitudes (validar)");
  await niega(aud.from("solicitudes").update({ nota_alcance: "tocado" }).eq("id", solDemo.id).select(),
              "UPDATE de solicitudes (cualquier columna)");
  await niega(aud.from("solicitudes").delete().eq("id", solDemo.id).select(), "DELETE de solicitudes");
  await niega(aud.from("comentarios").delete().neq("id", crypto.randomUUID()).select(), "DELETE de comentarios");
  await niega(aud.from("perfiles_usuario").update({ nombre: "yo mismo" }).eq("id", AUDITOR_ID).select(),
              "UPDATE de su propio perfil");
  await niega(aud.from("registros_clima").insert({
    reporte_id: REPORTE_DEMO, tipo: "riesgo", nombre: "riesgo inventado", orden: 99,
  }).select(), "INSERT en registros_clima");
  await niega(aud.from("objetivos").insert({
    reporte_id: REPORTE_DEMO, nombre: "objetivo inventado", orden: 99,
  }).select(), "INSERT en objetivos");
  await niega(aud.from("cuestionarios_respuestas").insert({
    reporte_id: REPORTE_DEMO, hoja: "X", pregunta_orden: 99, respuesta: "inventada",
  }).select(), "INSERT en cuestionarios_respuestas");
  await niega(aud.from("auditor_actividad").insert({
    tenant_id: TENANT_DEMO, auditor_id: AUDITOR_ID, tipo: "vista_matriz",
  }).select(), "INSERT en auditor_actividad (escribir su propio registro)");

  const up = await aud.storage.from("evidencias")
    .upload(`${TENANT_DEMO}/${solDemo.id}/intruso-${Date.now()}.txt`, new Blob(["x"]));
  ok(!!up.error, `subida a storage → ${up.error ? up.error.message.slice(0, 60) : "PASÓ — hueco"}`);

  // ---------------------------------------------------------------------------
  bloque("D · La bitácora general NO es suya");

  const bitSvc = await cuenta(staff, "bitacora", (q) => q.eq("tenant_id", TENANT_DEMO));
  const bitCli = await cuenta(adminCli, "bitacora");
  const bitAud = await cuenta(aud, "bitacora");
  ok(bitSvc.n > 0, `la emisora demo tiene ${bitSvc.n} actos en bitácora`);
  ok(bitCli.n > 0, `el admin del cliente sigue viéndola (${bitCli.n}) — no se rompió a nadie`);
  ok(bitAud.n === 0, `el auditor ve ${bitAud.n} (ninguno)`);

  // ---------------------------------------------------------------------------
  bloque("E · Su canal propio: comenta, y ahí se acaba lo que puede");

  const ins = await aud.from("comentarios_auditor").insert({
    objeto_tipo: "solicitud", objeto_id: solDemo.id,
    tenant_id: TENANT_DEMO, autor_id: AUDITOR_ID,
    texto: "¿De dónde sale el factor de emisión de esta cifra?",
  }).select().single();
  ok(!ins.error && !!ins.data, `comenta una solicitud${ins.error ? ` — ${ins.error.message}` : ""}`);
  const comentarioId = ins.data?.id;
  ok(ins.data?.respondido_en === null, "nace SIN responder");

  const { data: rc } = await staff.from("registros_clima").select("id").limit(1).single();
  const insRC = await aud.from("comentarios_auditor").insert({
    objeto_tipo: "registro_clima", objeto_id: rc.id, tenant_id: TENANT_DEMO,
    autor_id: AUDITOR_ID, texto: "¿Qué horizonte cubre este riesgo?",
  }).select().single();
  ok(!insRC.error, `comenta un registro de clima${insRC.error ? ` — ${insRC.error.message}` : ""}`);

  await niega(aud.from("comentarios_auditor").insert({
    objeto_tipo: "solicitud", objeto_id: OTRO.solicitud, tenant_id: OTRO.tenant,
    autor_id: AUDITOR_ID, texto: "comentario sobre emisora ajena",
  }).select(), "comentar un objeto de OTRA emisora");

  await niega(aud.from("comentarios_auditor")
    .update({ texto: "reescrito" }).eq("id", comentarioId).select(),
    "reescribir su propio comentario");
  await niega(aud.from("comentarios_auditor")
    .update({ respuesta: "me respondo solo" }).eq("id", comentarioId).select(),
    "responderse a sí mismo");
  await niega(aud.from("comentarios_auditor").delete().eq("id", comentarioId).select(),
    "borrar su comentario");
  await niega(area.from("comentarios_auditor").select("id").eq("id", comentarioId),
    "el responsable de área lo lee");

  const resp = await adminCli.from("comentarios_auditor")
    .update({ respuesta: "Del factor SEMARNAT 2024; se anexa la memoria de cálculo." })
    .eq("id", comentarioId).select().single();
  ok(!resp.error, `el admin del cliente responde${resp.error ? ` — ${resp.error.message}` : ""}`);
  ok(resp.data?.respondido_por === "a0000000-0000-0000-0000-000000000005",
     "la base fija respondido_por (no la aplicación)");
  ok(!!resp.data?.respondido_en, "la base fija respondido_en");

  await niega(adminCli.from("comentarios_auditor")
    .update({ respuesta: "otra respuesta encima" }).eq("id", comentarioId).select(),
    "responder dos veces el mismo comentario");

  const { data: visto } = await aud.from("comentarios_auditor")
    .select("respuesta, respondido_en").eq("id", comentarioId).single();
  ok(!!visto?.respuesta, "el auditor ve la respuesta");

  const pendAud = await cuenta(aud, "comentarios_auditor", (q) => q.is("respondido_en", null));
  const pendCli = await cuenta(adminCli, "comentarios_auditor", (q) => q.is("respondido_en", null));
  ok(pendCli.n === pendAud.n && pendCli.n > 0,
     `pendientes sin responder: ${pendCli.n} (el contador de la matriz; su ocultamiento al auditor es del Paso 2, no de RLS)`);

  // ---------------------------------------------------------------------------
  bloque("F · auditor_actividad: solo el ADMINISTRADOR de IRStrat");

  await svc.from("auditor_actividad").insert({
    tenant_id: TENANT_DEMO, auditor_id: AUDITOR_ID, tipo: "vista_matriz",
    ip: "187.190.0.1", navegador: "e2e",
  }).throwOnError();

  const actAdm = await cuenta(adminIrs, "auditor_actividad");
  const actAna = await cuenta(analista, "auditor_actividad");
  const actCli = await cuenta(adminCli, "auditor_actividad");
  const actAud = await cuenta(aud, "auditor_actividad");
  ok(actAdm.n > 0, `admin de IRStrat ve ${actAdm.n}`);
  ok(actAna.n === 0, `analista de IRStrat ve ${actAna.n} — fn_is_admin_irstrat distingue`);
  ok(actCli.n === 0, `admin del cliente ve ${actCli.n}`);
  ok(actAud.n === 0, `el propio auditor ve ${actAud.n}`);

  // ---------------------------------------------------------------------------
  await desmontarOtroTenant();

  console.log(`\n════════ RESULTADO ════════`);
  if (problemas.length === 0) {
    console.log("  Todo verde.");
  } else {
    console.log(`  ${problemas.length} problema(s):`);
    for (const p of problemas) console.log(`   · ${p}`);
  }
  process.exit(problemas.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("\nFALLA:", e.message);
  try { await desmontarOtroTenant(); } catch {}
  process.exit(1);
});
