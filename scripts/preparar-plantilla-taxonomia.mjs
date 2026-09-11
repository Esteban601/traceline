#!/usr/bin/env node
// -----------------------------------------------------------------------------
// PREPARA assets/taxonomia-base.xlsx PARA QUE LA COLUMNA D SEA DINÁMICA.
//
// Hace tres cosas, una sola vez:
//
//  1. Renombra la hoja «Fondo I» a «Taxonomía NIIF S1 S2». El nombre venía de un
//     cliente (Fondo de Fondos) y la plantilla es de la firma, no suya.
//
//  2. Pone al día los códigos de la columna B. Nueve cambiaron de nombre en la
//     auditoría del catálogo; si la plantilla sigue con los viejos, el export no
//     encuentra su descripción y la fila se reporta como huérfana.
//
//  3. VACÍA la celda D de la fila PRINCIPAL de cada código —la que hoy trae el
//     requisito— porque a partir de ahora la escribe el export desde
//     `datapoints_taxonomia`. Las demás filas del mismo código NO se tocan: no
//     repiten el requisito, son preguntas de captura ("No ¿Por qué?", "Si ¿Cómo
//     se integran…?") y son contenido propio de la plantilla.
//
// Se deja como script y no como edición manual para que quede constancia de qué
// se tocó y se pueda repetir sobre una plantilla nueva.
//
//   node scripts/preparar-plantilla-taxonomia.mjs [--revisar]
// -----------------------------------------------------------------------------
import ExcelJS from "exceljs";
import path from "node:path";

const PLANTILLA = path.join(process.cwd(), "assets", "taxonomia-base.xlsx");
const HOJA_VIEJA = "Fondo I";
export const HOJA_TAXONOMIA = "Taxonomía NIIF S1 S2";
const SOLO_REVISAR = process.argv.includes("--revisar");

/** Los nueve códigos que renombró la auditoría (migración 20260915120000). */
const RENOMBRES = {
  "IFRS S1 2023-06-26 40 a": "NIIF S1 40(a)",
  "NIIF S2 29 (b) B64 y B65 inciso (a)": "NIIF S2 29 (b)",
  "NIIF S2 29 (b) B64 y B65 inciso (b)": "NIIF S2 29 (b) · B65 (b)",
  "NIIF S2 29 (b) B64 y B65 inciso (c)": "NIIF S2 29 (b) · B65 (c)",
  "NIIF S2 29 (c) B64 y B65 inciso (b)": "NIIF S2 29 (c) · B65 (b)",
  "NIIF S2 29 (c) B64 y B65 inciso (c)": "NIIF S2 29 (c) · B65 (c)",
  "NIIF S2 29 (d) B64 y B65 inciso (a)": "NIIF S2 29 (d)",
  "NIIF S2 29 (d) B64 y B65 inciso (b)": "NIIF S2 29 (d) · B65 (b)",
  "NIIF S2 29 (d) B64 y B65 inciso (c)": "NIIF S2 29 (d) · B65 (c)",
};

const texto = (v) =>
  v === null || v === undefined
    ? ""
    : typeof v === "object" && "richText" in v
      ? v.richText.map((r) => r.text).join("")
      : typeof v === "object" && "result" in v
        ? String(v.result)
        : String(v);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(PLANTILLA);

const ws = wb.getWorksheet(HOJA_TAXONOMIA) ?? wb.getWorksheet(HOJA_VIEJA);
if (!ws) throw new Error(`No se encontró «${HOJA_VIEJA}» ni «${HOJA_TAXONOMIA}».`);

const acciones = { renombreHoja: false, codigos: [], vaciadas: [] };

if (ws.name === HOJA_VIEJA) {
  if (!SOLO_REVISAR) ws.name = HOJA_TAXONOMIA;
  acciones.renombreHoja = true;
}

// Primera fila de cada código: es la que lleva el requisito.
const vistos = new Set();
ws.eachRow((fila, nf) => {
  if (nf === 1) return;
  const crudo = texto(ws.getCell(`B${nf}`).value);
  const cod = norm(crudo);
  if (!cod) return;

  const nuevo = RENOMBRES[cod];
  if (nuevo) {
    if (!SOLO_REVISAR) ws.getCell(`B${nf}`).value = nuevo;
    acciones.codigos.push([nf, cod, nuevo]);
  }
  const clave = nuevo ?? cod;

  if (vistos.has(clave)) return; // fila de pregunta, no se toca
  vistos.add(clave);

  const d = ws.getCell(`D${nf}`);
  if (norm(texto(d.value))) {
    if (!SOLO_REVISAR) d.value = null;
    acciones.vaciadas.push([nf, clave]);
  }
});

console.log(`hoja: ${acciones.renombreHoja ? `«${HOJA_VIEJA}» → «${HOJA_TAXONOMIA}»` : "ya estaba renombrada"}`);
console.log(`códigos actualizados en la columna B: ${acciones.codigos.length}`);
for (const [f, v, n] of acciones.codigos) console.log(`   fila ${String(f).padStart(3)}: «${v}» → «${n}»`);
console.log(`celdas D vaciadas (una por código, pasan a ser dinámicas): ${acciones.vaciadas.length}`);

if (SOLO_REVISAR) { console.log("\n(--revisar: no se escribió nada)"); process.exit(0); }
await wb.xlsx.writeFile(PLANTILLA);
console.log("\nplantilla escrita.");
