import type JSZip from "jszip";
import { celdaTexto } from "@/lib/formato/xlsx-xml";

// =============================================================================
// Operaciones de libro sobre el zip del Formato electrónico (encargo
// 2026-10-13, Paso 4): ubicar una hoja por su nombre y agregar una hoja nueva
// (la Leyenda) sin reescribir el libro. Ver lib/formato/xlsx-xml.ts.
// =============================================================================

const TIPO_HOJA = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";
const REL_HOJA = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet";

/** Ruta en el zip de la hoja con ese nombre (p. ej. «xl/worksheets/sheet2.xml»). */
export async function rutaDeHoja(zip: JSZip, nombre: string): Promise<string | null> {
  const wb = await zip.file("xl/workbook.xml")!.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const esc = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rid = wb.match(new RegExp(`<sheet name="${esc}"[^>]*r:id="(rId\\d+)"`))?.[1];
  const destino = rid && rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1];
  return destino ? `xl/${destino.replace(/^\/?xl\//, "")}` : null;
}

/**
 * Agrega al final una hoja de dos columnas con texto en línea. Registra la parte
 * en workbook.xml, en sus relaciones y en [Content_Types].xml.
 */
export async function agregarHoja(zip: JSZip, nombre: string, filas: [string, string][], anchos: [number, number] = [34, 110]): Promise<void> {
  const existentes = Object.keys(zip.files).map((n) => n.match(/^xl\/worksheets\/sheet(\d+)\.xml$/)?.[1]).filter(Boolean).map(Number);
  const n = Math.max(0, ...existentes) + 1;
  const ruta = `xl/worksheets/sheet${n}.xml`;
  const cuerpo = filas
    .map(([a, b], i) => `<row r="${i + 1}">${celdaTexto(`A${i + 1}`, a, null)}${b ? celdaTexto(`B${i + 1}`, b, null) : ""}</row>`)
    .join("");
  zip.file(
    ruta,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><cols><col min="1" max="1" width="${anchos[0]}" customWidth="1"/><col min="2" max="2" width="${anchos[1]}" customWidth="1"/></cols><sheetData>${cuerpo}</sheetData></worksheet>`
  );
  const rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const ids = [...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  const rid = `rId${Math.max(0, ...ids) + 1}`;
  zip.file("xl/_rels/workbook.xml.rels", rels.replace("</Relationships>", () => `<Relationship Id="${rid}" Type="${REL_HOJA}" Target="worksheets/sheet${n}.xml"/></Relationships>`));
  const wb = await zip.file("xl/workbook.xml")!.async("string");
  const sheetIds = [...wb.matchAll(/sheetId="(\d+)"/g)].map((m) => Number(m[1]));
  zip.file("xl/workbook.xml", wb.replace("</sheets>", () => `<sheet name="${nombre}" sheetId="${Math.max(0, ...sheetIds) + 1}" r:id="${rid}"/></sheets>`));
  const ct = await zip.file("[Content_Types].xml")!.async("string");
  zip.file("[Content_Types].xml", ct.replace("</Types>", () => `<Override PartName="/${ruta}" ContentType="${TIPO_HOJA}"/></Types>`));
}
