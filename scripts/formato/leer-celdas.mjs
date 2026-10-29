#!/usr/bin/env node
// =============================================================================
// Lector de celdas de un .xlsx exportado (Formato electrónico o Excel de
// taxonomía). Sin base ni red. Cierre del encargo 2026-10-26-formato-afirmaciones-
// y-voz (antes scratchpad fase2/celdas.mjs y v5/buscar.cjs).
//
//   node scripts/formato/leer-celdas.mjs <archivo.xlsx> K12 K38 …  [--hoja <nombre>]
//       imprime esas celdas (por defecto, de la hoja «Estructura Formato Electronico»);
//   node scripts/formato/leer-celdas.mjs <archivo.xlsx> --buscar <regex> [--cols 3,11]
//       busca en todas las hojas y lista hoja | celda | contexto.
// =============================================================================
import ExcelJS from "exceljs";

const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const archivo = args[0];
if (!archivo) { console.error("Uso: leer-celdas.mjs <archivo.xlsx> <celda…> [--hoja <nombre>] | --buscar <regex> [--cols 3,11]"); process.exit(2); }
const texto = (v) => (v == null ? "" : typeof v === "object" ? (v.richText ? v.richText.map((x) => x.text).join("") : v.text ?? (v.result != null ? String(v.result) : "")) : String(v));

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(archivo);
const patron = opcion("--buscar");
if (patron) {
  const re = new RegExp(patron, "iu");
  const cols = opcion("--cols")?.split(",");
  for (const ws of wb.worksheets) {
    ws.eachRow((row) => row.eachCell((c) => {
      if (c.isMerged && c.master !== c) return;
      if (cols && !cols.includes(String(c.col))) return;
      const t = texto(c.value).replace(/\s+/g, " ");
      const m = t.match(re);
      if (m) console.log(`${ws.name} | ${c.address} | ${t.slice(Math.max(0, m.index - 60), m.index + 90)}`);
    }));
  }
} else {
  const nombreHoja = opcion("--hoja") ?? "Estructura Formato Electronico";
  const ws = wb.getWorksheet(nombreHoja);
  if (!ws) { console.error(`✗ No hay hoja «${nombreHoja}».`); process.exit(2); }
  const celdas = args.slice(1).filter((a, i, xs) => !a.startsWith("--") && xs[i - 1] !== "--hoja");
  for (const c of celdas) console.log(`${c}\t${texto(ws.getCell(c).value).replace(/\s+/g, " ").trim() || "(vacía)"}`);
}
