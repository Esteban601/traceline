#!/usr/bin/env node
// =============================================================================
// Hoja de REVISIÓN del Formato electrónico (encargo 2026-10-13, Paso 4): por
// fila del formato, qué se llenó, de dónde salió y si la referencia la
// respondía. Es para la revisión de IRStrat contra el formato de referencia; no
// se entrega a la emisora.
//
//   node --env-file=.env.local --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/formato/revision-formato.mjs <reporte> <salida.xlsx> [plantilla.xlsx]
//
// Con la plantilla local (fuera de git), cada fila lleva la pregunta del formato
// (columna D) y la hoja «Por decidir» lista las que esperan una decisión de
// Esteban, con la pregunta exacta y por qué no se llenó.
//
// Lee con la sesión del staff del seed, los mismos insumos que la ruta de
// descarga (lib/formato/datos.ts). Solo dev. No imprime credenciales. La columna
// «Referencia» dice solo SI la referencia tenía respuesta, nunca cuál.
// =============================================================================
import ExcelJS from "exceljs";
import { createServerClient } from "@supabase/ssr";
import { insumosDelFormato } from "../../lib/formato/datos.ts";
import { llenarFormato, CONCEPTOS_FORMATO } from "../../lib/formato/llenar.ts";

const [reporte, salida, plantilla] = process.argv.slice(2);
if (!reporte || !salida) { console.error("Uso: revision-formato.mjs <reporte> <salida.xlsx>"); process.exit(2); }
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!URL_SB.includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ Solo contra el proyecto dev."); process.exit(2); }
const jar = new Map();
const db = createServerClient(URL_SB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
const { error } = await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: process.env.STAFF_PASSWORD || "Demo2025!" });
if (error) { console.error(`✗ login: ${error.message}`); process.exit(2); }

const ins = await insumosDelFormato(db, reporte);
if (!ins.ok) { console.error(`✗ ${ins.error}`); process.exit(1); }
const valores = llenarFormato(ins.datos);
const preguntas = new Map();
if (plantilla) {
  const p = new ExcelJS.Workbook();
  await p.xlsx.readFile(plantilla);
  const e = p.getWorksheet("Estructura Formato Electronico");
  const t = (v) => (v == null ? "" : typeof v === "object" && v.richText ? v.richText.map((x) => x.text).join("") : typeof v === "object" ? "" : String(v));
  e.eachRow((row, n) => preguntas.set(n, t(row.getCell(4).value).replace(/\s+/g, " ").trim()));
}
// La fila de opciones («▫ Sí, totalmente ▫ …») no trae la pregunta: está en la anterior.
const preguntaDe = (fila) => {
  const d = preguntas.get(fila) ?? "";
  if (/^▫/.test(d)) return `${preguntas.get(fila - 1) || "(sin pregunta en la fila anterior)"} — opciones: ${d}`;
  return d || `(sin etiqueta propia; ver la fila ${fila - 1} del formato)`;
};
const MOTIVO = (c, v) =>
  v.origen !== "por decidir" ? "" :
  c.fila >= 144 && c.fila <= 185 ? "Métricas S1 46–50: la iteración por métrica de NIIF S2 29 (una fila por métrica, ligada a cada riesgo de la fila 56) no está implementada en el llenado; no espera una decisión" :
  /^enumeración/.test(c.tipo ?? "") ? "Enumeración: la lista de opciones no viene en el formato y no hay un dato capturado que la responda" :
  c.tipo === "tabla" ? "Tabla sin fuente de datos definida para su estructura (columna O)" :
  c.tipo === "porcentaje" ? "Porcentaje sin captura que lo responda" :
  c.capa === "regla primer año" ? "Regla de segundo año: aún no aplica" :
  /3 · revisión \(regla\)/.test(c.capa) ? "Regla de la revisión sin valor determinable por código" :
  c.tipo === "booleano" ? "Booleano de un requisito de NIIF S1 que el alivio E5 deja sin respuesta propia" :
  !c.datapoint ? "Concepto sin datapoint ni respuesta de su bloque" : "Sin respuesta en el documento aprobado";

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Revisión");
ws.columns = [
  { header: "Fila", key: "fila", width: 7 },
  { header: "Sección", key: "seccion", width: 10 },
  { header: "Tipo", key: "tipo", width: 18 },
  { header: "Clasificación", key: "clasificacion", width: 22 },
  { header: "Capa del mapeo", key: "capa", width: 22 },
  { header: "Datapoint", key: "datapoint", width: 24 },
  { header: "Bloque", key: "bloque", width: 8 },
  { header: "Origen del valor", key: "origen", width: 16 },
  { header: "Respuesta (columna K)", key: "texto", width: 90 },
  { header: "Referencia respondida", key: "ref", width: 12 },
  { header: "Regla del mapeo", key: "regla", width: 60 },
  { header: "Pregunta del formato (columna D)", key: "pregunta", width: 80 },
  { header: "Nota", key: "nota", width: 50 },
];
const pd = wb.addWorksheet("Por decidir");
pd.columns = [
  { header: "#", key: "n", width: 5 },
  { header: "Fila", key: "fila", width: 7 },
  { header: "Sección", key: "seccion", width: 10 },
  { header: "Tipo", key: "tipo", width: 18 },
  { header: "Datapoint", key: "datapoint", width: 24 },
  { header: "Pregunta del formato", key: "pregunta", width: 90 },
  { header: "Por qué no se llenó", key: "motivo", width: 60 },
  { header: "Decisión de Esteban", key: "decision", width: 50 },
];
let nPd = 0;
const cuenta = {};
const conRef = { llenas: 0, vacias: 0 };
for (const c of CONCEPTOS_FORMATO) {
  const v = valores.get(c.fila) ?? { texto: null, origen: "sin respuesta" };
  cuenta[v.origen] = (cuenta[v.origen] ?? 0) + 1;
  if (c.respondidaEnReferencia) conRef[v.texto || v.origen === "logo" ? "llenas" : "vacias"]++;
  const fila = ws.addRow({ fila: c.fila, seccion: c.seccion, tipo: c.tipo ?? "", clasificacion: c.clasificacion, capa: c.capa, datapoint: c.datapoint ?? "", bloque: c.bloque ?? "", origen: v.origen, texto: v.texto ?? "", ref: c.respondidaEnReferencia ? "Sí" : "", regla: c.regla ?? "", pregunta: preguntas.size ? preguntaDe(c.fila) : "", nota: v.nota ?? "" });
  if (v.origen === "por decidir") {
    const r = pd.addRow({ n: ++nPd, fila: c.fila, seccion: c.seccion, tipo: c.tipo ?? "", datapoint: c.datapoint ?? "", pregunta: preguntaDe(c.fila), motivo: MOTIVO(c, v) });
    r.alignment = { vertical: "top", wrapText: true };
  }
  fila.alignment = { vertical: "top", wrapText: true };
  if (v.origen === "por decidir") fila.getCell("origen").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEB9C" } };
  if (v.origen === "pendiente") fila.getCell("origen").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
}
ws.getRow(1).font = { bold: true };
ws.views = [{ state: "frozen", ySplit: 1 }];
ws.autoFilter = { from: "A1", to: "M1" };
pd.getRow(1).font = { bold: true };
pd.views = [{ state: "frozen", ySplit: 1 }];
await wb.xlsx.writeFile(salida);
console.log("por origen:", JSON.stringify(cuenta));
console.log(`filas que la referencia respondía: ${conRef.llenas + conRef.vacias} · llenas aquí ${conRef.llenas} · vacías aquí ${conRef.vacias}`);
console.log(`por decidir: ${nPd}`);
console.log(`escrito: ${salida}`);
