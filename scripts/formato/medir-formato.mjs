#!/usr/bin/env node
// =============================================================================
// MEDICIÓN DEL FORMATO ELECTRÓNICO Y DEL EXCEL DE TAXONOMÍA (encargo
// 2026-10-26-formato-afirmaciones-y-voz). Sin base ni modelo.
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/formato/medir-formato.mjs <formato.xlsx> <taxonomia.xlsx> [K…]
//
// Imprime las celdas K pedidas del Formato (por defecto K38, K592, K643 y K12),
// cuántas celdas K llevan la oración del alivio E5 y cuáles, y las celdas con
// vocabulario de plataforma según el glosario oficial (lib/suplemento/
// vocabulario.ts, el de CLAUDE.md §5) en TODAS las hojas de los dos libros (CLAUDE.md 1.13, Fase 5): en el Formato,
// toda celda de texto de toda hoja (la columna K aparte, por ser la respuesta); en el Excel de taxonomía, toda celda
// fuera de la fila 1. Con la excepción de CLAUDE.md §5 para el marcador «Pendiente: …» en texto plano.
// =============================================================================
import ExcelJS from "exceljs";
import { vocabularioEnCeldaExportada } from "../../lib/suplemento/vocabulario.ts";
import { ORACION_E5 } from "../../lib/suplemento/alivios.ts";

const [formato, taxonomia, ...celdas] = process.argv.slice(2);
const pedidas = celdas.length ? celdas : ["K38", "K592", "K643", "K12"];
const texto = (v) => (v == null ? "" : typeof v === "object" ? (v.richText ? v.richText.map((t) => t.text).join("") : v.text ?? (v.result != null ? String(v.result) : "")) : String(v));

const wf = new ExcelJS.Workbook();
await wf.xlsx.readFile(formato);
const est = wf.getWorksheet("Estructura Formato Electronico");
console.log("== Celdas");
for (const c of pedidas) console.log(`${c} [${texto(est.getCell(`A${c.slice(1)}`).value).slice(0, 60)}]: ${texto(est.getCell(c).value) || "(vacía)"}`);

const conE5 = [];
const vocFormato = [];
est.eachRow((row, n) => {
  const t = texto(row.getCell("K").value);
  if (!t) return;
  if (t.includes(ORACION_E5)) conE5.push(`K${n}`);
  const v = vocabularioEnCeldaExportada(t);
  if (v.length) vocFormato.push(`K${n} (${v.join(", ")})`);
});
console.log(`\n== Oración E5 en el Formato: ${conE5.length} celdas\n${conE5.join(" ")}`);
console.log(`\n== Vocabulario de plataforma en el Formato (columna K): ${vocFormato.length} celdas\n${vocFormato.join("\n")}`);
// Todas las hojas del Formato: lo que no es la columna K de la estructura (etiquetas de la plantilla, «Tabla NIIF»,
// «Métricas SASB», «Consideraciones»…). Cuenta igual: es lo que la emisora entrega.
const vocOtras = [];
for (const ws of wf.worksheets) {
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (ws === est && cell.col === 11) return;
      if (cell.isMerged && cell.master !== cell) return;
      const t = texto(cell.value);
      if (t.length < 3) return;
      const v = vocabularioEnCeldaExportada(t);
      if (v.length) vocOtras.push(`${ws.name}!${cell.address} (${v.join(", ")}): ${t.replace(/\s+/g, " ").slice(0, 90)}`);
    });
  });
}
console.log(`\n== Vocabulario de plataforma en el resto del Formato (todas las hojas): ${vocOtras.length} celdas\n${vocOtras.join("\n")}`);

const wt = new ExcelJS.Workbook();
await wt.xlsx.readFile(taxonomia);
const vocTax = [];
for (const ws of wt.worksheets) {
  ws.eachRow((row, n) => {
    if (n === 1) return;
    row.eachCell((cell) => {
      const t = texto(cell.value);
      if (t.length < 3) return;
      const v = vocabularioEnCeldaExportada(t);
      if (v.length) vocTax.push(`${ws.name}!${cell.address} (${v.join(", ")}): ${t.slice(0, 90)}`);
    });
  });
}
console.log(`\n== Vocabulario de plataforma en el Excel de taxonomía: ${vocTax.length} celdas`);
const porHoja = vocTax.reduce((a, x) => ((a[x.split("!")[0]] = (a[x.split("!")[0]] ?? 0) + 1), a), {});
console.log(JSON.stringify(porHoja));
if (process.env.DETALLE) console.log(vocTax.join("\n"));
