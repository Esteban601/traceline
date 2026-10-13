#!/usr/bin/env node
// =============================================================================
// Hoja de REVISIÓN del Formato electrónico (encargo 2026-10-13, Paso 4): por
// fila del formato, qué se llenó, de dónde salió y si la referencia la
// respondía. Es para la revisión de IRStrat contra el formato de referencia; no
// se entrega a la emisora.
//
//   node --env-file=.env.local --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/formato/revision-formato.mjs <reporte> <salida.xlsx>
//
// Lee con la sesión del staff del seed, los mismos insumos que la ruta de
// descarga (lib/formato/datos.ts). Solo dev. No imprime credenciales. La columna
// «Referencia» dice solo SI la referencia tenía respuesta, nunca cuál.
// =============================================================================
import ExcelJS from "exceljs";
import { createServerClient } from "@supabase/ssr";
import { insumosDelFormato } from "../../lib/formato/datos.ts";
import { llenarFormato, CONCEPTOS_FORMATO } from "../../lib/formato/llenar.ts";

const [reporte, salida] = process.argv.slice(2);
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
];
const cuenta = {};
const conRef = { llenas: 0, vacias: 0 };
for (const c of CONCEPTOS_FORMATO) {
  const v = valores.get(c.fila) ?? { texto: null, origen: "sin respuesta" };
  cuenta[v.origen] = (cuenta[v.origen] ?? 0) + 1;
  if (c.respondidaEnReferencia) conRef[v.texto || v.origen === "logo" ? "llenas" : "vacias"]++;
  const fila = ws.addRow({ fila: c.fila, seccion: c.seccion, tipo: c.tipo ?? "", clasificacion: c.clasificacion, capa: c.capa, datapoint: c.datapoint ?? "", bloque: c.bloque ?? "", origen: v.origen, texto: v.texto ?? "", ref: c.respondidaEnReferencia ? "Sí" : "", regla: c.regla ?? "" });
  fila.alignment = { vertical: "top", wrapText: true };
  if (v.origen === "por decidir") fila.getCell("origen").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEB9C" } };
  if (v.origen === "pendiente") fila.getCell("origen").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
}
ws.getRow(1).font = { bold: true };
ws.views = [{ state: "frozen", ySplit: 1 }];
ws.autoFilter = { from: "A1", to: "K1" };
await wb.xlsx.writeFile(salida);
console.log("por origen:", JSON.stringify(cuenta));
console.log(`filas que la referencia respondía: ${conRef.llenas + conRef.vacias} · llenas aquí ${conRef.llenas} · vacías aquí ${conRef.vacias}`);
console.log(`escrito: ${salida}`);
