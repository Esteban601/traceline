#!/usr/bin/env node
// =============================================================================
// E2E DE LA DECISIÓN SOBRE SUGERENCIAS (captura sugerida, Paso 4).
//
//   node scripts/e2e-captura-sugerida.mjs [baseUrl]      (default http://localhost:3003)
//
// SOLO contra el stack local (aborta si la URL de Supabase no es local), con la
// app de la rama corriendo contra él (para el export de Excel). No llama al
// modelo: las sugerencias se siembran con service_role —que es como las escribe
// la cola— y las lecturas de las evidencias de prueba se marcan `omitido` para
// que ningún barrido las mande a la API.
//
// Comprueba, con la sesión REAL de cada cuenta del demo:
//   1. Decisión por rol: responsable de área confirma, jefe de área corrige,
//      coordinador rechaza, administrador del cliente corrige un extracto, staff
//      solo con `staff_puede_cargar` (rechazado sin él; se restaura al final).
//      Cada aceptación numérica crea la captura con origen «sugerida» y su
//      sugerencia_id; la bitácora registra sugerencia_confirmada/_corregida/_rechazada.
//   2. Rechazos: el auditor VE las sugerencias y la base le niega decidir; un
//      responsable no decide sobre otra área; no se decide dos veces.
//   3. Nueva versión: la sugerida pasa a obsoleta en el mismo INSERT de la
//      evidencia; una decisión ya tomada se conserva.
//   4. Excel: confirmar no cambia el libro mientras la solicitud no esté
//      validada; al validar, la cifra confirmada aparece.
//   5. Subida con URL firmada: con la firma entra un archivo pequeño; el bucket
//      rechaza uno de 26 MB aunque la firma sea válida; el auditor no sube.
// =============================================================================
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3003";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
// Llaves PÚBLICAS de demostración del stack local de Supabase (las mismas de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICIO_LOCAL = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const CLAVE_DEMO = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
// GEI Alcance 3, categoría 15 (Operaciones, en revisión): su rubro alimenta la celda B18 del libro.
const SOL_EXCEL = "c3000000-0000-0000-0000-000000000115";

if (!/127\.0\.0\.1|localhost/.test(URL_SB)) { console.error(`✗ Solo contra el stack local, no ${URL_SB}.`); process.exit(2); }

const fallas = [];
const ok = (cond, msg) => { if (!cond) fallas.push(msg); console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); };
const svc = createClient(URL_SB, SERVICIO_LOCAL, { auth: { persistSession: false } });

async function sesion(email) {
  const c = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: CLAVE_DEMO });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { c, id: data.user.id, email };
}

const marca = `[e2e-sugerencias ${new Date().toISOString().slice(0, 16)}]`;
const staff = await sesion("analista@irstrat.example");
const adminIrstrat = await sesion("admin@irstrat.example");
const responsable = await sesion("operaciones@empresademo.example"); // cliente · Operaciones
const jefe = await sesion("jefe.rh@empresademo.example");            // jefe_area · RH
const coordinador = await sesion("coordinador@empresademo.example");
const adminCliente = await sesion("admin.cliente@empresademo.example");
const auditor = await sesion("auditor.externo@despacho.example");
const finanzas = await sesion("finanzas@empresademo.example");
const rh = await sesion("rh@empresademo.example");

async function solicitud(titulo, area, cuantitativa = true, unidad = null) {
  const { data: m } = await staff.c.from("solicitudes").select("orden").eq("reporte_id", REPORTE).order("orden", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await staff.c.from("solicitudes").insert({
    reporte_id: REPORTE, titulo, descripcion: `${marca} ${titulo}`, area_asignada: area,
    es_cuantitativa: cuantitativa, unidad_esperada: unidad, estado: "solicitado", orden: (m?.orden ?? 0) + 1,
  }).select("id").single();
  if (error) throw new Error(`solicitud ${titulo}: ${error.message}`);
  return data.id;
}

/** Sube un archivo pequeño como `quien` y deja su lectura en `omitido` (sin modelo). */
async function evidencia(quien, solicitudId, nombre) {
  const ruta = `${TENANT}/${solicitudId}/${Date.now()}-${nombre}`;
  const { error: eUp } = await quien.c.storage.from("evidencias").upload(ruta, Buffer.from(`e2e ${nombre}`), { contentType: "text/csv" });
  if (eUp) throw new Error(`subida ${nombre}: ${eUp.message}`);
  const { data, error } = await quien.c.from("evidencias").insert({
    solicitud_id: solicitudId, archivo_path: ruta, nombre_original: nombre, subido_por: quien.id, version: 0, periodo_cubierto: "2025",
  }).select("id, version").single();
  if (error) throw new Error(`evidencia ${nombre}: ${error.message}`);
  await svc.from("evidencias_contenido").update({ estado: "omitido", mensaje: "e2e: sin lectura" }).eq("evidencia_id", data.id);
  return data;
}

/** Siembra una sugerencia como la escribe la cola (service_role). */
async function sugerencia(solicitudId, ev, campos) {
  const { data: cont } = await svc.from("evidencias_contenido").select("id").eq("evidencia_id", ev.id).single();
  const { data, error } = await svc.from("sugerencias_captura").insert({
    solicitud_id: solicitudId, tenant_id: TENANT, evidencia_id: ev.id, contenido_id: cont.id, evidencia_version: ev.version,
    estado: "sugerida", confianza: "alta", modelo: "e2e", prompt_version: "e2e", ...campos,
  }).select("id").single();
  if (error) throw new Error(`sugerencia: ${error.message}`);
  return data.id;
}

const decidir = (quien, id, accion, extra = {}) =>
  quien.c.rpc("fn_decidir_sugerencia", { p_sugerencia_id: id, p_accion: accion, ...extra });
const fila = async (id) => (await svc.from("sugerencias_captura").select("*").eq("id", id).single()).data;
// Con la sesión del staff: service_role no lee capturas_valor en este proyecto (deuda anotada en la especificación §10).
const capturaDe = async (id) => (await staff.c.from("capturas_valor").select("valor, unidad, periodo, origen, sugerencia_id, capturado_por").eq("sugerencia_id", id)).data ?? [];
const bitacora = async (id) => ((await svc.from("bitacora").select("accion").eq("entidad_id", id)).data ?? []).map((b) => b.accion);

const NUM = (valor, unidad, extra = {}) => ({
  tipo: "numerica", valor, unidad, periodo: "2025", cita: String(valor),
  fuente: { tipo: "celda", hoja: "Datos", celda: "B2" }, candidatos: [], ...extra,
});

console.log(`\n${marca}\n`);
let toggleOriginal = null;
try {
  // ---------------------------------------------------------------- preparación
  const sOper = await solicitud("Consumo eléctrico (e2e)", "Operaciones", true, "MWh");
  const sOper2 = await solicitud("Diésel (e2e)", "Operaciones", true, "L");
  const sRH = await solicitud("Horas de capacitación (e2e)", "RH", true, "horas");
  const sFin = await solicitud("CAPEX climático (e2e)", "Finanzas", true, "MXN");
  const sTxt = await solicitud("Política ambiental (e2e)", "Finanzas", false);
  const sStaff = await solicitud("Agua extraída (e2e)", "Operaciones", true, "m3");

  const eOper = await evidencia(responsable, sOper, "energia.csv");
  const eOper2 = await evidencia(responsable, sOper2, "diesel.csv");
  // La sube el responsable de RH: hoy el jefe de área no puede subir evidencia
  // (trg_solicitud_vb_area rechaza el cambio de estado que provoca la carga;
  // hallazgo previo, fuera de este encargo). Decidir no toca la solicitud.
  const eRH = await evidencia(rh, sRH, "capacitacion.csv");
  const eFin = await evidencia(finanzas, sFin, "capex.csv");
  const eTxt = await evidencia(adminCliente, sTxt, "politica.csv");
  const eStaff = await evidencia(responsable, sStaff, "agua.csv");

  const gOper = await sugerencia(sOper, eOper, NUM(376300, "kWh", {
    conversion: { valor: 376.3, unidad: "MWh", factor: 0.001, origen: "tabla", explicacion: "1 kWh = 0.001 MWh" },
  }));
  const gOper2 = await sugerencia(sOper2, eOper2, NUM(18900, "L"));
  const gRH = await sugerencia(sRH, eRH, NUM(15840, "horas"));
  const gFin = await sugerencia(sFin, eFin, NUM(1250000, "MXN"));
  const gTxt = await sugerencia(sTxt, eTxt, {
    tipo: "texto", extracto: "La empresa se compromete a reducir sus emisiones un 30 % al 2030.",
    cobertura: "Cubre: meta de reducción · No cubre: nada", fuente: { cubre_requisito: "si", fragmentos: [] },
  });
  const gStaff = await sugerencia(sStaff, eStaff, NUM(48210, "m3"));

  // ------------------------------------------------------------ 2. rechazos
  console.log("Rechazos");
  const { count: veAuditor } = await auditor.c.from("sugerencias_captura").select("id", { count: "exact", head: true }).in("id", [gOper, gRH, gFin, gTxt]);
  ok(veAuditor === 4, `el auditor ve las sugerencias de su emisora (${veAuditor} de 4)`);
  const rAud = await decidir(auditor, gOper, "confirmar");
  ok(rAud.error && /auditor externo no puede decidir/.test(rAud.error.message), `la base rechaza al auditor: «${rAud.error?.message}»`);
  const { data: puedeAud } = await auditor.c.rpc("fn_puede_decidir_sugerencia", { p_solicitud_id: sOper });
  ok(puedeAud === false, "fn_puede_decidir_sugerencia es false para el auditor (no ve botones)");
  const rOtraArea = await decidir(responsable, gRH, "confirmar");
  ok(rOtraArea.error && rOtraArea.error.code === "42501", `un responsable de Operaciones no decide sobre RH: «${rOtraArea.error?.message}»`);
  const rStaffSin = await decidir(staff, gStaff, "confirmar");
  ok(rStaffSin.error && rStaffSin.error.code === "42501", `el staff sin «carga por IRStrat» no decide: «${rStaffSin.error?.message}»`);

  // ------------------------------------------------------- 1. decisión por rol
  console.log("Decisión por rol");
  const r1 = await decidir(responsable, gOper, "confirmar");
  const c1 = await capturaDe(gOper);
  ok(!r1.error && (await fila(gOper)).estado === "confirmada", "responsable de área confirma");
  ok(c1.length === 1 && Number(c1[0].valor) === 376.3 && c1[0].unidad === "MWh" && c1[0].origen === "sugerida" && c1[0].capturado_por === responsable.id,
    `la captura lleva la cifra CONVERTIDA, origen sugerida y su autor (${c1[0]?.valor} ${c1[0]?.unidad}, ${c1[0]?.origen})`);
  ok((await bitacora(gOper)).includes("sugerencia_confirmada"), "bitácora: sugerencia_confirmada");

  const r2 = await decidir(jefe, gRH, "corregir", { p_valor: 15900, p_unidad: "horas", p_periodo: "2025" });
  const f2 = await fila(gRH);
  const c2 = await capturaDe(gRH);
  ok(!r2.error && f2.estado === "corregida" && Number(f2.valor_final) === 15900, `jefe de área corrige (${r2.error?.message ?? "ok"})`);
  ok(c2.length === 1 && Number(c2[0].valor) === 15900 && c2[0].origen === "sugerida", "la captura lleva el valor corregido");
  ok((await bitacora(gRH)).includes("sugerencia_corregida"), "bitácora: sugerencia_corregida");

  const r3 = await decidir(coordinador, gFin, "rechazar", { p_motivo: "Es el CAPEX total, no el alineado." });
  const f3 = await fila(gFin);
  ok(!r3.error && f3.estado === "rechazada" && f3.motivo_rechazo?.startsWith("Es el CAPEX"), `coordinador rechaza con motivo (${r3.error?.message ?? "ok"})`);
  ok((await capturaDe(gFin)).length === 0, "rechazar no crea captura");
  ok((await bitacora(gFin)).includes("sugerencia_rechazada"), "bitácora: sugerencia_rechazada");

  const r4 = await decidir(adminCliente, gTxt, "corregir", { p_extracto: "La empresa reducirá sus emisiones un 30 % al 2030 (base 2022)." });
  const f4 = await fila(gTxt);
  ok(!r4.error && f4.estado === "corregida" && f4.extracto_final?.includes("base 2022"), `administrador del cliente corrige un extracto (${r4.error?.message ?? "ok"})`);
  ok((await capturaDe(gTxt)).length === 0, "un extracto no crea captura numérica");

  const { data: t0 } = await svc.from("tenants").select("staff_puede_cargar").eq("id", TENANT).single();
  toggleOriginal = t0.staff_puede_cargar;
  const { error: eTog } = await adminIrstrat.c.from("tenants").update({ staff_puede_cargar: true }).eq("id", TENANT);
  if (eTog) throw new Error(`toggle: ${eTog.message}`);
  const r5 = await decidir(staff, gStaff, "confirmar");
  ok(!r5.error && (await capturaDe(gStaff)).length === 1, `staff con «carga por IRStrat» confirma (${r5.error?.message ?? "ok"})`);

  const rDoble = await decidir(coordinador, gOper, "rechazar");
  ok(rDoble.error && /ya no está pendiente/.test(rDoble.error.message), `no se decide dos veces: «${rDoble.error?.message}»`);

  // --------------------------------------------------------- 3. nueva versión
  console.log("Nueva versión");
  await evidencia(responsable, sOper2, "diesel-v2.csv");
  ok((await fila(gOper2)).estado === "obsoleta", "la sugerida pasa a obsoleta al subir la versión 2");
  await evidencia(responsable, sOper, "energia-v2.csv");
  ok((await fila(gOper)).estado === "confirmada", "la decisión ya tomada se conserva al subir otra versión");

  // ------------------------------------------------------------------ 4. Excel
  console.log("Excel");
  const jar = new Map();
  const ssr = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
  await ssr.auth.signInWithPassword({ email: "admin@irstrat.example", password: CLAVE_DEMO });
  const cookie = [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
  const libro = async () => {
    const r = await fetch(`${BASE}/admin/cobertura/export-taxonomia?reporte=${REPORTE}`, { headers: { cookie } });
    if (!r.ok) throw new Error(`export HTTP ${r.status}`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
    const celdas = new Map();
    wb.eachSheet((ws) => ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (c) => {
      let v = c.value;
      if (v && typeof v === "object") v = v.richText ? v.richText.map((t) => t.text).join("") : v.result ?? v.text ?? JSON.stringify(v);
      // El pie lleva la fecha y hora de generación: se normaliza.
      celdas.set(`${ws.name}!${c.address}`, String(v).replace(/Generado por TRACELINE — .*/, "Generado por TRACELINE — <fecha>"));
    })));
    return celdas;
  };
  const difs = (a, b) => [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k));

  const aEstado = async (e) => { const { error } = await staff.c.from("solicitudes").update({ estado: e }).eq("id", SOL_EXCEL); if (error) throw new Error(`estado ${e}: ${error.message}`); };
  const { data: solEx } = await staff.c.from("solicitudes").select("estado").eq("id", SOL_EXCEL).single();
  // Repetible: si una corrida anterior la dejó validada, se regresa a revisión
  // antes de tomar el libro base (y al final se restaura el estado original).
  if (solEx.estado === "validado") await aEstado("en_revision");
  const antes = await libro();
  const eEx = await evidencia(responsable, SOL_EXCEL, "energia-e2e.csv");
  const gEx = await sugerencia(SOL_EXCEL, eEx, NUM(412345, "kWh"));
  const rEx = await decidir(responsable, gEx, "confirmar");
  ok(!rEx.error, `se confirma la sugerencia de la solicitud ligada al libro (${rEx.error?.message ?? "ok"})`);
  const trasConfirmar = await libro();
  const d1 = difs(antes, trasConfirmar);
  ok(d1.length === 0, `confirmar sin validar NO cambia el Excel (${d1.length} celdas distintas${d1.length ? `: ${d1.slice(0, 3).join(", ")}` : ""})`);
  const estadoActual = (await staff.c.from("solicitudes").select("estado").eq("id", SOL_EXCEL).single()).data.estado;
  if (estadoActual === "recibido") await aEstado("en_revision");
  await aEstado("validado");
  const trasValidar = await libro();
  const d2 = difs(trasConfirmar, trasValidar);
  const aparece = d2.some((k) => /412[,.]?345/.test(trasValidar.get(k) ?? ""));
  ok(aparece, `al validar, la cifra confirmada aparece en el Excel (${d2.length} celdas cambiaron)`);
  if (solEx.estado !== "validado") await aEstado(solEx.estado === "recibido" ? "en_revision" : solEx.estado);
  console.log(`    (la solicitud ${SOL_EXCEL} vuelve a «${solEx.estado === "recibido" ? "en_revision" : solEx.estado}»; conserva la evidencia y la captura de prueba en el stack local)`);

  // ------------------------------------------------------- 5. subida firmada
  console.log("Subida con URL firmada");
  const sFirma = await solicitud("Subida firmada (e2e)", "Operaciones", false);
  const firmar = async () => {
    const ruta = `${TENANT}/${sFirma}/${Date.now()}-prueba.bin`;
    const { data, error } = await responsable.c.storage.from("evidencias").createSignedUploadUrl(ruta);
    if (error) throw new Error(`firma: ${error.message}`);
    return data;
  };
  const firma1 = await firmar();
  const { error: eChico } = await responsable.c.storage.from("evidencias").uploadToSignedUrl(firma1.path, firma1.token, Buffer.alloc(1024, 1), { contentType: "application/octet-stream" });
  ok(!eChico, `con la firma entra un archivo de 1 KB (${eChico?.message ?? "ok"})`);
  const firma2 = await firmar();
  const { error: eGrande } = await responsable.c.storage.from("evidencias").uploadToSignedUrl(firma2.path, firma2.token, Buffer.alloc(26 * 1024 * 1024, 1), { contentType: "application/octet-stream" });
  ok(Boolean(eGrande), `el bucket rechaza 26 MB aunque la firma sea válida: «${eGrande?.message ?? "lo aceptó"}»`);
  const { data: firmaAud, error: eFirmaAud } = await auditor.c.storage.from("evidencias").createSignedUploadUrl(`${TENANT}/${sFirma}/${Date.now()}-auditor.bin`);
  let subeAuditor = false;
  if (firmaAud) subeAuditor = !(await auditor.c.storage.from("evidencias").uploadToSignedUrl(firmaAud.path, firmaAud.token, Buffer.alloc(10, 1))).error;
  ok(!subeAuditor, `el auditor no sube con firma (${eFirmaAud?.message ?? "firma emitida, subida rechazada"})`);
} finally {
  if (toggleOriginal !== null) {
    await adminIrstrat.c.from("tenants").update({ staff_puede_cargar: toggleOriginal }).eq("id", TENANT);
    const { data } = await svc.from("tenants").select("staff_puede_cargar").eq("id", TENANT).single();
    console.log(`\n  (carga por IRStrat restaurada a ${data.staff_puede_cargar})`);
  }
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ E2E de sugerencias OK");
process.exit(fallas.length ? 1 : 0);
