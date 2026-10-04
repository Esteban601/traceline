#!/usr/bin/env node
// =============================================================================
// PREPARA LA REVISIÓN DEL PASO 4 (captura sugerida) en el stack LOCAL.
//
//   CRON_SECRET=… node scripts/captura-sugerida/preparar-revision.mjs [baseUrl]
//
// Crea en Empresa Demo cinco solicitudes «[Revisión Paso 4]», sube a cada una un
// archivo del conjunto de prueba con la cuenta del área (el mismo camino que la
// aplicación) y deja que la cola lea y sugiera con el modelo (unos $0.05 en
// total). Al final imprime la tabla de solicitudes, qué muestra cada una y qué
// cuenta decide, para revisarlas con las cuentas del demo.
//
// Casos:
//   R1 · Operaciones · Excel con conversión kWh → MWh y candidatos
//   R2 · Operaciones · PDF con la fuente en la página 2 (enlace #page=2)
//   R3 · RH          · PDF escaneado (lectura por visión; decide el jefe de RH)
//   R4 · Finanzas    · Word con el requisito en tres párrafos (extracto)
//   R5 · Finanzas    · Código de ética que no cubre el requisito (sin hallazgo)
// Empresa ficticia; sin datos reales. Solo contra el stack local.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || "http://localhost:3003";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const CLAVE_DEMO = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const CRON = process.env.CRON_SECRET;
if (!/127\.0\.0\.1|localhost/.test(URL_SB)) { console.error("✗ Solo contra el stack local."); process.exit(2); }
if (!CRON) { console.error("✗ Falta CRON_SECRET."); process.exit(2); }

const MIME = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
const CASOS = [
  { id: "R1", area: "Operaciones", sube: "operaciones@empresademo.example", archivo: "x01_electricidad_2025.xlsx",
    titulo: "Consumo de electricidad 2025", cuantitativa: true, unidad: "MWh", decide: "operaciones@ (responsable) · admin.cliente@ · coordinador@" },
  { id: "R2", area: "Operaciones", sube: "operaciones@empresademo.example", archivo: "p01_informe_energia.pdf",
    titulo: "Consumo de electricidad 2025 (informe)", cuantitativa: true, unidad: "kWh", decide: "operaciones@ (responsable) · admin.cliente@ · coordinador@" },
  { id: "R3", area: "RH", sube: "rh@empresademo.example", archivo: "p07_escaneado_torcido.pdf",
    titulo: "Horas de capacitación 2025", cuantitativa: true, unidad: "horas", decide: "jefe.rh@ (jefe) · rh@ · admin.cliente@ · coordinador@" },
  { id: "R4", area: "Finanzas", sube: "finanzas@empresademo.example", archivo: "t02_gobierno_disperso.docx",
    titulo: "Cómo y con qué frecuencia se informa al Consejo sobre los riesgos climáticos", cuantitativa: false,
    codigos: ["NIIF S2 6 (a)(iii)", "NIIF S2 6 (a)(iv)"], decide: "finanzas@ · admin.cliente@ · coordinador@" },
  { id: "R5", area: "Finanzas", sube: "finanzas@empresademo.example", archivo: "t03_codigo_etica.docx",
    titulo: "Procesos para identificar, evaluar y priorizar los riesgos climáticos", cuantitativa: false,
    codigos: ["NIIF S2 25 (a)(i)a(v)"], decide: "— (sin hallazgo: no hay nada que decidir)" },
];

async function sesion(email) {
  const c = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: CLAVE_DEMO });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { c, id: data.user.id };
}
const staff = await sesion("analista@irstrat.example");
const sesiones = {};
const marca = "[Revisión Paso 4]";

const { data: m } = await staff.c.from("solicitudes").select("orden").eq("reporte_id", REPORTE).order("orden", { ascending: false }).limit(1).maybeSingle();
let orden = (m?.orden ?? 0) + 1;
const creadas = [];
for (const k of CASOS) {
  const { data: sol, error } = await staff.c.from("solicitudes").insert({
    reporte_id: REPORTE, titulo: `${marca} ${k.titulo}`, descripcion: `Solicitud de prueba para revisar la captura sugerida (${k.id}).`,
    area_asignada: k.area, es_cuantitativa: k.cuantitativa, unidad_esperada: k.unidad ?? null, estado: "solicitado", orden: orden++,
  }).select("id").single();
  if (error) throw new Error(`${k.id}: ${error.message}`);
  if (k.codigos?.length) {
    const { data: dps } = await staff.c.from("datapoints_taxonomia").select("id, codigo").in("codigo", k.codigos);
    if ((dps ?? []).length !== k.codigos.length) throw new Error(`${k.id}: algún código no está en el catálogo`);
    await staff.c.from("mapeo_solicitud_datapoint").insert(dps.map((d) => ({ solicitud_id: sol.id, datapoint_id: d.id })));
  }
  sesiones[k.sube] ??= await sesion(k.sube);
  const quien = sesiones[k.sube];
  const ruta = `${TENANT}/${sol.id}/${Date.now()}-${k.archivo}`;
  const { error: eUp } = await quien.c.storage.from("evidencias").upload(ruta, fs.readFileSync(path.join(AQUI, "conjunto", k.archivo)), { contentType: MIME[k.archivo.split(".").pop()] });
  if (eUp) throw new Error(`${k.id} subida: ${eUp.message}`);
  const { error: eEv } = await quien.c.from("evidencias").insert({
    solicitud_id: sol.id, archivo_path: ruta, nombre_original: k.archivo, subido_por: quien.id, version: 0, periodo_cubierto: "2025", area_origen: k.area,
  });
  if (eEv) throw new Error(`${k.id} evidencia: ${eEv.message}`);
  creadas.push({ ...k, solicitudId: sol.id });
}

for (let vuelta = 0; vuelta < 10; vuelta++) {
  await fetch(`${BASE}/api/evidencias/procesar?maximo=3`, { method: "POST", headers: { "x-cron-secret": CRON } });
  const { count } = await staff.c.from("evidencias_contenido").select("id", { count: "exact", head: true })
    .in("solicitud_id", creadas.map((c) => c.solicitudId)).in("estado", ["pendiente", "procesando"]);
  if (!count) break;
}

const { data: sugs } = await staff.c.from("sugerencias_captura").select("solicitud_id, tipo, estado, valor, unidad, conversion, confianza, costo_usd")
  .in("solicitud_id", creadas.map((c) => c.solicitudId)).in("estado", ["sugerida", "sin_hallazgo", "fallida"]);
let costo = 0;
console.log(`\n${"Caso".padEnd(5)}${"Área".padEnd(13)}${"Muestra".padEnd(44)}Decide`);
for (const c of creadas) {
  const s = (sugs ?? []).find((x) => x.solicitud_id === c.solicitudId);
  costo += Number(s?.costo_usd ?? 0);
  const muestra = !s ? "(sin sugerencia todavía)"
    : s.estado === "sin_hallazgo" ? "sin hallazgo: no cubre el requisito"
    : s.tipo === "texto" ? `extracto (${s.confianza})`
    : `${s.conversion ? `${s.conversion.valor} ${s.conversion.unidad} ← ` : ""}${Number(s.valor)} ${s.unidad} (${s.confianza})`;
  console.log(`${c.id.padEnd(5)}${c.area.padEnd(13)}${muestra.slice(0, 42).padEnd(44)}${c.decide}`);
  console.log(`     portal: ${BASE}/portal/solicitudes/${c.solicitudId}`);
  console.log(`     panel:  ${BASE}/admin/solicitudes/${c.solicitudId}`);
}
console.log(`\ncosto de lectura y sugerencia de estos casos: ~$${costo.toFixed(4)} (sugerencia; la lectura de PDF escaneado va aparte)`);
