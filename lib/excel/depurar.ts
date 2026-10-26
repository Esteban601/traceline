import type ExcelJS from "exceljs";
import type { Alivios } from "@/lib/perfil-emisor";
import { ORACION_E4, ORACION_E5 } from "@/lib/suplemento/respuestas";

// =============================================================================
// EXCEL DE TAXONOMÍA: SOLO PREGUNTAS Y RESPUESTAS (regla de Esteban, 26 de
// octubre de 2026; encargo formato-afirmaciones-y-voz).
//
// El libro lleva las preguntas de la taxonomía y sus respuestas, nada más: sin
// hoja «Leyenda», sin filas de título, sin pies, sin columnas auxiliares («Notas
// / Brechas», «Tipo de dato», «Sección», «UN SDG»), sin filas separadoras
// («RIESGOS», «Oportunidades») y sin las imágenes de la plantilla. Lo que esas
// notas decían y hay que decir va DENTRO de una respuesta: los marcadores
// «Pendiente: …» de CLAUDE.md §5 en la celda que falta, el alivio E5 en los
// encabezados de pilar de NIIF S1, C3 y C4 en la cifra que los invoca y E4 en la
// declaración de cumplimiento (lo escribe la ruta antes de llamar aquí).
//
// ExcelJS no desplaza las celdas combinadas al quitar filas o columnas: se
// separan antes y se vuelven a combinar con sus coordenadas nuevas.
// =============================================================================

type Rango = { top: number; left: number; bottom: number; right: number };

const textoDe = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v) return v.result == null ? "" : String(v.result);
    return "";
  }
  return String(v);
};
export const textoCelda = (c: ExcelJS.Cell) => textoDe(c.value).replace(/\s+/g, " ").trim();

function combinadas(ws: ExcelJS.Worksheet): Rango[] {
  const merges = (ws as unknown as { _merges: Record<string, { model: Rango }> })._merges ?? {};
  return Object.values(merges).map((m) => ({ ...m.model }));
}

/** Quita filas (números 1-based) y columnas (1-based) conservando las combinadas que sobreviven. */
export function quitar(ws: ExcelJS.Worksheet, filas: number[], columnas: number[] = []): void {
  if (!filas.length && !columnas.length) return;
  const rangos = combinadas(ws);
  // spliceRows no lleva consigo el nivel de esquema, el alto ni la visibilidad de la fila: se guardan y se
  // reponen en la fila nueva (los incisos hijos de la taxonomía van agrupados bajo su padre).
  const quitadas = new Set(filas);
  const props: { nueva: number; outlineLevel?: number; height?: number; hidden?: boolean }[] = [];
  for (let f = 1, nueva = 1; f <= ws.rowCount; f++) {
    if (quitadas.has(f)) continue;
    const row = ws.getRow(f);
    props.push({ nueva, outlineLevel: row.outlineLevel, height: row.height, hidden: row.hidden });
    nueva++;
  }
  for (const r of rangos) ws.unMergeCells(r.top, r.left, r.bottom, r.right);
  for (const f of [...quitadas].sort((a, b) => b - a)) ws.spliceRows(f, 1);
  for (const c of [...new Set(columnas)].sort((a, b) => b - a)) ws.spliceColumns(c, 1);
  for (const p of props) {
    const row = ws.getRow(p.nueva);
    row.outlineLevel = p.outlineLevel ?? 0;
    if (p.height) row.height = p.height;
    row.hidden = !!p.hidden;
  }
  const antes = (lista: number[], n: number) => lista.filter((x) => x < n).length;
  const dentro = (lista: number[], a: number, b: number) => lista.filter((x) => x >= a && x <= b).length;
  for (const r of rangos) {
    const top = r.top - antes(filas, r.top);
    const bottom = r.bottom - antes(filas, r.top) - dentro(filas, r.top, r.bottom);
    const left = r.left - antes(columnas, r.left);
    const right = r.right - antes(columnas, r.left) - dentro(columnas, r.left, r.right);
    if (bottom < top || right < left || (bottom === top && right === left)) continue;
    ws.mergeCells(top, left, bottom, right);
  }
}

/** Fila sin ningún texto. */
const vacia = (ws: ExcelJS.Worksheet, n: number) => {
  const row = ws.getRow(n);
  let algo = false;
  row.eachCell({ includeEmpty: false }, (c) => {
    if (textoCelda(c)) algo = true;
  });
  return !algo;
};

/** Columnas auxiliares (por su encabezado en las filas 1–4): ni pregunta ni respuesta. */
const AUXILIARES = new Set(["Notas / Brechas", "Notas", "Tipo de dato"]);
/** Filas separadoras de la plantilla: agrupan, no preguntan. */
const SEPARADORAS = new Set(["RIESGOS", "OPORTUNIDADES", "Riesgos", "Oportunidades"]);

/**
 * Hoja de datos (todas menos la de taxonomía): sin fila de título (la 1), sin columnas auxiliares, sin filas
 * separadoras y sin filas vacías.
 */
export function depurarHojaDeDatos(ws: ExcelJS.Worksheet): void {
  const columnas: number[] = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    for (let f = 1; f <= 4; f++) if (AUXILIARES.has(textoCelda(ws.getCell(f, c)))) columnas.push(c);
  }
  const filas = [1];
  for (let f = 2; f <= ws.rowCount; f++) {
    const a = textoCelda(ws.getCell(f, 1));
    const resto = new Set<string>();
    ws.getRow(f).eachCell({ includeEmpty: false }, (c) => {
      if (Number(c.col) > 1 && textoCelda(c)) resto.add(textoCelda(c));
    });
    const separadora = SEPARADORAS.has(a) && [...resto].every((t) => t === a);
    if (separadora || vacia(ws, f)) filas.push(f);
  }
  quitar(ws, filas, [...new Set(columnas)]);
}

/**
 * Hoja «Taxonomía NIIF S1 S2»: quedan el código y el requisito (la pregunta) y la respuesta. Se quitan las columnas
 * «Sección» (A) y «UN SDG» (C), las imágenes de la plantilla y las filas sin requisito ni respuesta.
 */
export function depurarHojaTaxonomia(ws: ExcelJS.Worksheet): void {
  (ws as unknown as { _media: unknown[] })._media = [];
  const filas: number[] = [];
  for (let f = 2; f <= ws.rowCount; f++) if (!textoCelda(ws.getCell(`D${f}`)) && !textoCelda(ws.getCell(`E${f}`))) filas.push(f);
  quitar(ws, filas, [1, 3]);
}

export function soloPreguntasYRespuestas(wb: ExcelJS.Workbook, hojaTaxonomia: string): void {
  const leyenda = wb.getWorksheet("Leyenda");
  if (leyenda) wb.removeWorksheet(leyenda.id);
  for (const ws of wb.worksheets) {
    if (ws.name === hojaTaxonomia) depurarHojaTaxonomia(ws);
    else depurarHojaDeDatos(ws);
  }
}

/** Encabezados de pilar de NIIF S1 en la hoja de taxonomía (columna D, filas sin código). */
const PILARES_S1 = new Set(["gobernanza (s1)", "estrategia", "gestión del riesgo", "métricas y objetivos", "declaración de cumplimiento"]);
const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Los alivios que no tienen celda propia, dentro de las respuestas de la hoja de taxonomía (antes de quitar
 * columnas; B código, D requisito, E respuesta):
 *   · E5: la oración en la respuesta de cada encabezado de pilar de NIIF S1, como en el Formato electrónico, y fuera
 *     de las respuestas de sus requisitos;
 *   · E4: la oración al final de la respuesta de la declaración de cumplimiento (NIIF S1 72).
 * C3 y C4 ya van en la cifra que los invoca («No revelado · alivio C3»).
 */
export function enunciarAlivios(ws: ExcelJS.Worksheet, alivios: Alivios): void {
  let finS1 = ws.rowCount;
  for (let f = 2; f <= ws.rowCount; f++) {
    if (textoCelda(ws.getCell(`B${f}`)).startsWith("NIIF S2")) {
      finS1 = f - 1;
      break;
    }
  }
  for (let f = 2; f <= finS1; f++) {
    const codigo = textoCelda(ws.getCell(`B${f}`));
    const e = ws.getCell(`E${f}`);
    const respuesta = textoCelda(e);
    if (alivios.E5) {
      if (!codigo && PILARES_S1.has(norm(textoCelda(ws.getCell(`D${f}`))))) {
        e.value = ORACION_E5;
        e.alignment = { vertical: "top", wrapText: true };
      } else if (respuesta.startsWith(ORACION_E5)) {
        e.value = respuesta.slice(ORACION_E5.length).trim() || "No aplica en este periodo por el alivio E5.";
      }
    }
    if (alivios.E4 && codigo === "NIIF S1 72") {
      const actual = textoCelda(e);
      if (actual && actual !== "En preparación" && !actual.includes("párrafo E4")) e.value = `${actual} ${ORACION_E4}`;
    }
  }
}
