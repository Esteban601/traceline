import "server-only";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import sharp from "sharp";
import heicConvert from "heic-convert";
import { PDFDocument } from "pdf-lib";
import { extractTextItems, getDocumentProxy, type StructuredTextItem } from "unpdf";
import { CELDAS_MAX, PAGINAS_MAX, type FormatoImagen } from "./tipos";
import { transcribir } from "./vision";

// =============================================================================
// EXTRACCIÓN DE CONTENIDO por tipo de archivo (encargo captura sugerida, Paso 1).
//
// Devuelve contenido ESTRUCTURADO con lo que la sugerencia necesita para citar
// su fuente: referencia de celda en Excel, número de página en PDF, número de
// párrafo o de tabla/fila/columna en Word. No interpreta ni elige cifras.
//
// Solo lo que no tiene capa de texto pasa por el modelo (PDF escaneado,
// imágenes): Excel, Word y PDF con texto se leen en el servidor, sin costo.
// =============================================================================

export type CeldaExtraida = { ref: string; valor: number | string | boolean; texto?: string; formato?: string };
export type HojaExtraida = { nombre: string; filas: number; columnas: number; celdas: CeldaExtraida[] };
export type PaginaExtraida = { pagina: number; texto: string; origen: "texto" | "vision" };
export type BloqueWord =
  | { tipo: "parrafo"; n: number; texto: string; titulo?: boolean }
  | { tipo: "tabla"; n: number; filas: string[][] };

export type Contenido =
  | { tipo: "excel" | "csv"; hojas: HojaExtraida[] }
  | { tipo: "pdf"; paginas: PaginaExtraida[]; paginas_total: number }
  | { tipo: "word"; bloques: BloqueWord[] }
  | { tipo: "imagen"; paginas: PaginaExtraida[] };

export type ResultadoExtraccion = {
  contenido: Contenido;
  paginas: number | null;
  hojas: number | null;
  truncado: boolean;
  modelo: string | null;
  tokensEntrada: number;
  tokensSalida: number;
  costoUsd: number;
};

const SIN_COSTO = { modelo: null, tokensEntrada: 0, tokensSalida: 0, costoUsd: 0 };

// -----------------------------------------------------------------------------
// Excel y CSV (exceljs, ya en el proyecto)
// -----------------------------------------------------------------------------
function valorDeCelda(v: ExcelJS.CellValue): number | string | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return valorDeCelda(v.result as ExcelJS.CellValue);
    if ("hyperlink" in v && "text" in v) return String(v.text);
    if ("error" in v) return null;
  }
  return null;
}

function hojasDeLibro(libro: ExcelJS.Workbook): { hojas: HojaExtraida[]; truncado: boolean } {
  let total = 0;
  let truncado = false;
  const hojas: HojaExtraida[] = [];
  for (const h of libro.worksheets) {
    const celdas: CeldaExtraida[] = [];
    h.eachRow({ includeEmpty: false }, (fila) => {
      fila.eachCell({ includeEmpty: false }, (c) => {
        // De una celda combinada solo cuenta la maestra.
        if (c.isMerged && c.master && c.master.address !== c.address) return;
        const valor = valorDeCelda(c.value);
        if (valor === null || valor === "") return;
        if (total >= CELDAS_MAX) { truncado = true; return; }
        total++;
        const celda: CeldaExtraida = { ref: c.address, valor };
        const texto = c.text;
        if (texto && texto !== String(valor)) celda.texto = texto;
        const formato = c.numFmt;
        if (formato && formato !== "General") celda.formato = formato;
        celdas.push(celda);
      });
    });
    hojas.push({ nombre: h.name, filas: h.rowCount, columnas: h.columnCount, celdas });
  }
  return { hojas, truncado };
}

async function extraerExcel(archivo: Buffer): Promise<ResultadoExtraccion> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(archivo as unknown as ArrayBuffer);
  const { hojas, truncado } = hojasDeLibro(libro);
  return { contenido: { tipo: "excel", hojas }, paginas: null, hojas: hojas.length, truncado, ...SIN_COSTO };
}

async function extraerCsv(archivo: Buffer, nombre: string): Promise<ResultadoExtraccion> {
  const libro = new ExcelJS.Workbook();
  const hoja = await libro.csv.read(Readable.from(archivo));
  // La hoja de un CSV se llama como el archivo: es la fuente que se va a citar.
  hoja.name = nombre.replace(/\.[^.]+$/, "").slice(0, 31);
  const { hojas, truncado } = hojasDeLibro(libro);
  return { contenido: { tipo: "csv", hojas }, paginas: null, hojas: 1, truncado, ...SIN_COSTO };
}

// -----------------------------------------------------------------------------
// PDF: capa de texto en el servidor (unpdf); las páginas sin texto, a visión.
// -----------------------------------------------------------------------------

/** Menos de esto en caracteres visibles y la página se trata como escaneada. */
const MIN_CARACTERES_TEXTO = 25;
/** Páginas escaneadas por llamada de visión: acota la salida de cada respuesta. */
const PAGINAS_POR_LLAMADA = 10;

/**
 * Reconstruye el ORDEN DE LECTURA de una página a partir de las posiciones: el
 * orden en que el PDF dibuja el texto no es el de lectura (una tabla puede
 * dibujarse por columnas, o una cifra en dos trazos). Se agrupa por renglón (y),
 * se ordena por x, y dentro del renglón se pega sin espacio lo que está
 * contiguo y se separa con " | " lo que está lejos (columnas de tabla).
 */
export function lineasEnOrden(items: StructuredTextItem[]): string {
  const visibles = items.filter((i) => i.str.trim() !== "");
  visibles.sort((a, b) => b.y - a.y || a.x - b.x);
  const renglones: StructuredTextItem[][] = [];
  for (const it of visibles) {
    const r = renglones[renglones.length - 1];
    const tolerancia = Math.max(2, (it.fontSize || 10) * 0.4);
    if (r && Math.abs(r[0].y - it.y) <= tolerancia) r.push(it);
    else renglones.push([it]);
  }
  return renglones
    .map((r) => {
      r.sort((a, b) => a.x - b.x);
      let linea = "";
      let finAnterior: number | null = null;
      for (const it of r) {
        const tam = it.fontSize || 10;
        if (finAnterior !== null) {
          const hueco = it.x - finAnterior;
          linea += hueco < tam * 0.3 ? "" : hueco > tam * 2 ? " | " : " ";
        }
        linea += it.str.trim();
        finAnterior = it.x + it.width;
      }
      return linea;
    })
    .join("\n");
}

async function extraerPdf(archivo: Buffer): Promise<ResultadoExtraccion> {
  const datos = new Uint8Array(archivo);
  const doc = await getDocumentProxy(datos.slice());
  const { totalPages, items } = await extractTextItems(doc);
  const leidas = Math.min(totalPages, PAGINAS_MAX);

  const paginas: PaginaExtraida[] = [];
  const escaneadas: number[] = [];
  for (let n = 1; n <= leidas; n++) {
    const texto = lineasEnOrden(items[n - 1] ?? []);
    if (texto.replace(/\s/g, "").length >= MIN_CARACTERES_TEXTO) paginas.push({ pagina: n, texto, origen: "texto" });
    else escaneadas.push(n);
  }

  let costo = { ...SIN_COSTO } as Omit<ResultadoExtraccion, "contenido" | "paginas" | "hojas" | "truncado">;
  if (escaneadas.length) {
    const original = await PDFDocument.load(datos);
    for (let i = 0; i < escaneadas.length; i += PAGINAS_POR_LLAMADA) {
      const lote = escaneadas.slice(i, i + PAGINAS_POR_LLAMADA);
      const sub = await PDFDocument.create();
      const copiadas = await sub.copyPages(original, lote.map((n) => n - 1));
      copiadas.forEach((p) => sub.addPage(p));
      const r = await transcribir({ tipo: "pdf", base64: Buffer.from(await sub.save()).toString("base64"), numeracion: lote });
      for (const p of r.paginas) {
        if (lote.includes(p.pagina)) paginas.push({ pagina: p.pagina, texto: p.texto, origen: "vision" });
      }
      costo = {
        modelo: r.modelo,
        tokensEntrada: costo.tokensEntrada + r.tokensEntrada,
        tokensSalida: costo.tokensSalida + r.tokensSalida,
        costoUsd: Math.round((costo.costoUsd + r.costoUsd) * 10_000) / 10_000,
      };
    }
  }
  paginas.sort((a, b) => a.pagina - b.pagina);
  return {
    contenido: { tipo: "pdf", paginas, paginas_total: totalPages },
    paginas: totalPages,
    hojas: null,
    truncado: totalPages > PAGINAS_MAX,
    ...costo,
  };
}

// -----------------------------------------------------------------------------
// Word (.docx): mammoth a HTML, y de ahí párrafos y tablas en orden.
// -----------------------------------------------------------------------------
const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
function textoPlano(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#39|amp|lt|gt|quot|nbsp);/g, (m, e: string) =>
      ENTIDADES[e] ?? (e.startsWith("#") ? String.fromCodePoint(Number(e.slice(1))) : m))
    .replace(/[ \t]+/g, " ")
    .trim();
}

async function extraerWord(archivo: Buffer): Promise<ResultadoExtraccion> {
  const { value: html } = await mammoth.convertToHtml({ buffer: archivo });
  const bloques: BloqueWord[] = [];
  let nParrafo = 0;
  let nTabla = 0;
  // Una tabla se consume entera (sus párrafos internos no cuentan como párrafos).
  const re = /<(p|h[1-6])(?:\s[^>]*)?>([\s\S]*?)<\/\1>|<table(?:\s[^>]*)?>([\s\S]*?)<\/table>/gi;
  for (const m of html.matchAll(re)) {
    if (m[3] !== undefined) {
      const filas = [...m[3].matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/gi)].map((f) =>
        [...f[1].matchAll(/<t[dh](?:\s[^>]*)?>([\s\S]*?)<\/t[dh]>/gi)].map((c) => textoPlano(c[1]))
      );
      bloques.push({ tipo: "tabla", n: ++nTabla, filas });
    } else {
      const texto = textoPlano(m[2]);
      if (!texto) continue;
      bloques.push({ tipo: "parrafo", n: ++nParrafo, texto, ...(m[1].startsWith("h") ? { titulo: true } : {}) });
    }
  }
  return { contenido: { tipo: "word", bloques }, paginas: null, hojas: null, truncado: false, ...SIN_COSTO };
}

// -----------------------------------------------------------------------------
// Imágenes: HEIC → JPEG (heic-convert), orientación EXIF y tamaño (sharp), visión.
// -----------------------------------------------------------------------------
/** Lado mayor tras reducir: legible para transcribir y acota el costo por imagen. */
const LADO_MAX = 2000;

async function extraerImagen(archivo: Buffer, formato: FormatoImagen): Promise<ResultadoExtraccion> {
  let entrada = archivo;
  if (formato === "heic") {
    const convertida = await heicConvert({ buffer: archivo, format: "JPEG", quality: 0.9 });
    entrada = Buffer.from(convertida instanceof Uint8Array ? convertida : new Uint8Array(convertida));
  }
  const jpeg = await sharp(entrada)
    .rotate()
    .resize({ width: LADO_MAX, height: LADO_MAX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const r = await transcribir({ tipo: "imagen", base64: jpeg.toString("base64"), mediaType: "image/jpeg" });
  const paginas: PaginaExtraida[] = r.paginas.map((p) => ({ pagina: 1, texto: p.texto, origen: "vision" as const }));
  return {
    contenido: { tipo: "imagen", paginas },
    paginas: 1,
    hojas: null,
    truncado: false,
    modelo: r.modelo,
    tokensEntrada: r.tokensEntrada,
    tokensSalida: r.tokensSalida,
    costoUsd: r.costoUsd,
  };
}

export async function extraerContenido(
  archivo: Buffer,
  nombre: string,
  clase: { tipo: "excel" | "csv" | "pdf" | "word" } | { tipo: "imagen"; formato: FormatoImagen }
): Promise<ResultadoExtraccion> {
  switch (clase.tipo) {
    case "excel": return extraerExcel(archivo);
    case "csv": return extraerCsv(archivo, nombre);
    case "pdf": return extraerPdf(archivo);
    case "word": return extraerWord(archivo);
    case "imagen": return extraerImagen(archivo, clase.formato);
  }
}
