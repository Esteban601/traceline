#!/usr/bin/env node
// =============================================================================
// HOJA DE RÚBRICA (encargo 2026-10-06-suplemento-calidad, §2.3 y cierre del
// Paso 5): diez criterios, escala 1–5 y comentario por criterio, para que
// Esteban califique el documento ANTES y DESPUÉS y compare.
//
//   node scripts/suplemento/rubrica-xlsx.mjs <carpeta>
//
// Escribe <carpeta>/Rubrica_suplemento_antes_despues.xlsx. Sin datos de emisoras
// ni credenciales; los documentos se nombran por archivo e id.
// =============================================================================
import ExcelJS from "exceljs";
import path from "node:path";

const [carpeta] = process.argv.slice(2);
if (!carpeta) { console.error("Uso: rubrica-xlsx.mjs <carpeta>"); process.exit(2); }

const CRITERIOS = [
  ["Fidelidad a la fuente", "Cada afirmación dice lo mismo que su fuente: sin cifras, fechas, nombres ni facultades que la fuente no diga; sin conclusiones ni calificativos agregados. Ver las anclas por oración en la pantalla de revisión."],
  ["Cobertura del requisito", "Cada bloque responde los incisos de la norma que le tocan; lo que falta está como pendiente y no se omite en silencio. Ver la cobertura por subrequisito («juicio del generador»)."],
  ["Voz del emisor", "El texto es la revelación de la emisora, en su voz y con su denominación del glosario; no habla de la emisora desde fuera ni la llama «la Entidad»."],
  ["Claridad", "Se entiende a la primera: oraciones completas, sujeto explícito, sin rodeos ni jerga innecesaria; un inversionista lo puede leer."],
  ["Extensión", "Cada bloque dice lo necesario y nada más: ni relleno ni hechos que no responden al requisito (estatutos genéricos, trivia de actas, temas fuera del alcance E5)."],
  ["Coherencia", "El documento no se contradice ni se repite entre secciones; las remisiones llevan a una sección que sí desarrolla el tema; ningún bloque anuncia algo que termina en pendiente."],
  ["Trazabilidad", "Para cada afirmación se puede llegar a su fuente (anclas, fuentes del bloque, libro de hechos); lo que viene de la Carta de la Dirección no sostiene solo una afirmación normativa."],
  ["Pendientes bien formulados", "Cada pendiente tiene el formato [Pendiente: qué falta — solicitud o campo], dice exactamente qué se necesita y solo existe cuando de verdad falta algo o hay una contradicción excluyente."],
  ["Tablas correctas", "Las tablas (riesgos, emisiones, objetivos, métricas) tienen cifras correctas, unidades y nombres del glosario, y coinciden con el texto."],
  ["Sin vocabulario de plataforma", "El texto publicable no menciona solicitudes, evidencias, validaciones, IRStrat, bloques ni ids; eso solo va en notas y fuentes."],
];
const ESCALA = [
  [1, "Inaceptable", "Errores que un auditor o un inversionista detectaría y que obligan a rehacer el bloque."],
  [2, "Deficiente", "Varios problemas; publicable solo con edición sustancial."],
  [3, "Aceptable con reservas", "Cumple en lo esencial; requiere correcciones puntuales antes de publicar."],
  [4, "Bueno", "Cumple; ajustes menores de estilo o detalle."],
  [5, "Publicable", "Se publica tal cual en este criterio."],
];

const wb = new ExcelJS.Workbook();
wb.creator = "TRACELINE";
const borde = { top: { style: "thin", color: { argb: "FFD0D5DD" } }, left: { style: "thin", color: { argb: "FFD0D5DD" } }, bottom: { style: "thin", color: { argb: "FFD0D5DD" } }, right: { style: "thin", color: { argb: "FFD0D5DD" } } };
const encabezado = (row) => row.eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5257" } }; c.alignment = { vertical: "middle", wrapText: true }; c.border = borde; });

// --- Rúbrica ----------------------------------------------------------------
const ws = wb.addWorksheet("Rúbrica", { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }] });
ws.columns = [
  { key: "n", width: 5 }, { key: "criterio", width: 26 }, { key: "mira", width: 60 },
  { key: "antes", width: 11 }, { key: "cAntes", width: 45 }, { key: "despues", width: 11 }, { key: "cDespues", width: 45 }, { key: "dif", width: 11 },
];
ws.mergeCells("A1:H1");
ws.getCell("A1").value = "Rúbrica de calidad del Suplemento NIIF S1/S2 · antes y después del encargo suplemento-calidad";
ws.getCell("A1").font = { bold: true, size: 14 };
ws.mergeCells("A2:H2");
ws.getCell("A2").value = "Califica cada criterio de 1 a 5 (ver hoja «Escala») sobre el documento completo, primero el ANTES y después el DESPUÉS (hoja «Documentos»). Un comentario por criterio: qué viste y en qué bloques. La diferencia y los promedios se calculan solos.";
ws.getCell("A2").alignment = { wrapText: true };
ws.getRow(2).height = 32;
ws.getRow(3).height = 6;
encabezado(ws.addRow(["#", "Criterio", "Qué se mira", "ANTES (1–5)", "Comentario · antes", "DESPUÉS (1–5)", "Comentario · después", "Diferencia"]));
ws.getRow(4).height = 30;
CRITERIOS.forEach(([c, mira], i) => {
  const r = ws.addRow([i + 1, c, mira, null, "", null, "", null]);
  const n = r.number;
  r.getCell(8).value = { formula: `IF(AND(ISNUMBER(D${n}),ISNUMBER(F${n})),F${n}-D${n},"")` };
  r.height = 62;
  r.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.border = borde;
    cell.alignment = { vertical: "top", wrapText: true, horizontal: [1, 4, 6, 8].includes(col) ? "center" : "left" };
    if (col === 4 || col === 6) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E1" } };
  });
  r.getCell(2).font = { bold: true };
  for (const col of ["D", "F"]) ws.getCell(`${col}${n}`).dataValidation = { type: "whole", operator: "between", allowBlank: true, formulae: [1, 5], showErrorMessage: true, errorTitle: "Escala 1–5", error: "La calificación es un entero de 1 a 5." };
});
const p = ws.lastRow.number + 1;
const prom = ws.addRow(["", "Promedio", "", { formula: `IFERROR(AVERAGE(D5:D14),"")` }, "", { formula: `IFERROR(AVERAGE(F5:F14),"")` }, "", { formula: `IF(AND(ISNUMBER(D${p}),ISNUMBER(F${p})),F${p}-D${p},"")` }]);
prom.font = { bold: true };
for (const col of [4, 6, 8]) { prom.getCell(col).numFmt = "0.0"; prom.getCell(col).alignment = { horizontal: "center" }; }
ws.addRow(["", "Calificados", "", { formula: `COUNT(D5:D14)&" de 10"` }, "", { formula: `COUNT(F5:F14)&" de 10"` }]);
ws.addRow([]);
const v = ws.addRow(["", "Veredicto de Manuel", "¿La calificación DESPUÉS es aceptable para cerrar el encargo? (§2.3: el encargo termina cuando lo es)", "", "", "", "", ""]);
v.getCell(2).font = { bold: true };
v.getCell(3).alignment = { wrapText: true };
ws.mergeCells(`D${v.number}:H${v.number}`);
ws.getCell(`D${v.number}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E1" } };
v.height = 34;
const calificador = ws.addRow(["", "Calificó / fecha", "", "", "", "", "", ""]);
calificador.getCell(2).font = { bold: true };
ws.mergeCells(`C${calificador.number}:H${calificador.number}`);
ws.getCell(`C${calificador.number}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E1" } };
ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 1 };

// --- Escala -----------------------------------------------------------------
const we = wb.addWorksheet("Escala");
we.columns = [{ width: 8 }, { width: 26 }, { width: 80 }];
encabezado(we.addRow(["Nivel", "Nombre", "Qué significa"]));
for (const e of ESCALA) we.addRow(e).eachCell((c) => { c.border = borde; c.alignment = { wrapText: true, vertical: "top" }; });

// --- Documentos -------------------------------------------------------------
const wd = wb.addWorksheet("Documentos");
wd.columns = [{ width: 12 }, { width: 38 }, { width: 40 }, { width: 70 }];
encabezado(wd.addRow(["", "Archivo", "Documento", "Qué es"]));
for (const r of [
  ["ANTES", "Suplemento_antes_Paso1.docx", "419dedb5 · versión 1 · 15 sep 2026", "Último documento del demo generado antes del encargo (prompt a5b-v2-2026-09-15, 40 bloques). En el Paso 1 no se generó documento completo. Exportado con el Word actual: el formato es el de hoy, el contenido es el de septiembre."],
  ["DESPUÉS", "Suplemento_despues_corrida2.docx", "98d57a6a · versión 2 · 7 oct 2026", "Corrida 2 del cierre del Paso 5b: libro de hechos v10 y prompt hechos-v4, esfuerzo high, todos los editoriales, catálogo actual. Es el Word que va a la revisión externa."],
]) wd.addRow(r).eachCell((c) => { c.border = borde; c.alignment = { wrapText: true, vertical: "top" }; });

// --- Contexto (no se califica) ------------------------------------------------
const wc = wb.addWorksheet("Contexto");
wc.columns = [{ width: 44 }, { width: 22 }, { width: 22 }];
encabezado(wc.addRow(["Medido por el código (no sustituye la calificación)", "Línea base del Paso 5 (no es el ANTES)", "Corrida 2 (cierre 5b)"]));
for (const r of [
  ["Costo de los bloques (USD)", "11.22", "11.66 (9.02 sin reintentos del validador cruzado)"],
  ["Marcadores de pendiente", "33 en 17 bloques", "13 en 8 bloques"],
  ["Cobertura (cubierto / parcial / pendiente)", "40 / 17 / 2", "51 / 7 / 1"],
  ["Observaciones de coherencia del modelo", "19", "20 (más 8 del validador cruzado)"],
  ["Notas (insumo / revelación voluntaria / decisión del emisor)", "74 / 43 / 15", "36 / 31 / 16"],
]) wc.addRow(r).eachCell((c) => { c.border = borde; c.alignment = { wrapText: true, vertical: "top" }; });

const salida = path.join(carpeta, "Rubrica_suplemento_antes_despues.xlsx");
await wb.xlsx.writeFile(salida);
console.log(`✓ ${salida}`);
