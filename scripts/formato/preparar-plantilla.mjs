#!/usr/bin/env node
// =============================================================================
// Prepara la PLANTILLA del Formato electrónico NIIF S1/S2 desde el formato de
// referencia (encargo 2026-10-13-excel-respuestas-narrativas, Paso 4).
//
//   node --env-file=.env.local scripts/formato/preparar-plantilla.mjs <formato.xlsx> <salida.xlsx> [--subir]
//
// El formato de referencia es el de una emisora real con sus respuestas: no se
// versiona (CLAUDE.md §4) y sus respuestas no salen de él. La plantilla:
//   · «Estructura Formato Electronico»: estructura, tipos, fuentes y
//     consideraciones intactos; la columna K (Respuesta) vacía desde la fila 4;
//   · «Tabla NIIF»: encabezados (filas 1–2), sin datos;
//   · la hoja de métricas SASB de la industria de la referencia se sustituye por
//     «Métricas SASB» con la nota de Fase C;
//   · «Consideraciones»: tal cual (texto fijo de IRStrat).
// Comprueba que no quede el nombre de la emisora de referencia en ninguna celda.
// La plantilla tampoco se versiona: vive en Storage (bucket `documentos`, ruta
// RUTA_PLANTILLA) y la lee el export con service role. Con --subir la sube a
// dev (solo dev). No imprime contenido de celdas ni credenciales.
// =============================================================================
import fs from "node:fs";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

export const RUTA_PLANTILLA = "plantillas/formato-electronico/2025/plantilla.xlsx";
const args = process.argv.slice(2);
const subir = args.includes("--subir");
const [entrada, salida] = args.filter((a) => !a.startsWith("--"));
if (!entrada || !salida) { console.error("Uso: preparar-plantilla.mjs <formato.xlsx> <salida.xlsx> [--subir]"); process.exit(2); }

const texto = (v) => (v == null ? "" : typeof v === "object" && v.richText ? v.richText.map((x) => x.text).join("") : typeof v === "object" ? "" : String(v));
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(entrada);

const est = wb.getWorksheet("Estructura Formato Electronico");
if (!est) throw new Error("falta la hoja «Estructura Formato Electronico»");
let vaciadas = 0;
est.eachRow((row, n) => {
  if (n < 4) return;
  const c = row.getCell(11);
  if (c.value != null && texto(c.value) !== "") vaciadas++;
  c.value = null;
});

const tn = wb.getWorksheet("Tabla NIIF");
let filasTabla = 0;
if (tn) {
  tn.eachRow((row, n) => {
    if (n < 3) return;
    row.eachCell((c) => { c.value = null; });
    filasTabla++;
  });
}

const sasb = wb.worksheets.find((w) => /^Métricas SASB/.test(w.name));
if (sasb) wb.removeWorksheet(sasb.id);
const nueva = wb.addWorksheet("Métricas SASB");
nueva.getCell("A1").value = "Métricas por industria (SASB)";
nueva.getCell("A1").font = { bold: true, size: 13 };
nueva.getCell("A2").value = "Métricas por industria: pendiente de catálogo SASB (Fase C).";
nueva.getColumn(1).width = 80;

// Ninguna celda con el nombre de la emisora de referencia.
let menciones = 0;
wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => { if (/autl[aá]n/i.test(texto(c.value))) menciones++; })));
if (menciones) { console.error(`✗ quedan ${menciones} celdas con el nombre de la emisora de referencia`); process.exit(1); }

await wb.xlsx.writeFile(salida);
const huella = createHash("sha256").update(fs.readFileSync(salida)).digest("hex");
console.log(`plantilla: respuestas vaciadas ${vaciadas} · filas de «Tabla NIIF» vaciadas ${filasTabla} · hoja SASB sustituida ${!!sasb} · menciones de la emisora 0 · sha256 ${huella.slice(0, 12)}`);

if (subir) {
  const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!URL_SB.includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ --subir solo contra el proyecto dev."); process.exit(2); }
  const db = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error } = await db.storage.from("documentos").upload(RUTA_PLANTILLA, fs.readFileSync(salida), {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });
  if (error) { console.error(`✗ subir: ${error.message}`); process.exit(1); }
  console.log(`subida a documentos/${RUTA_PLANTILLA} (dev)`);
}
