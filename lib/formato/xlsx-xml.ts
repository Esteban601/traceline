// =============================================================================
// EDICIÓN DE UN .xlsx A NIVEL XML (revisión externa del Formato electrónico,
// punto 1; encargo 2026-10-13, Paso 4).
//
// El formato de la BMV trae 23 tablas-plantilla como IMÁGENES EN CELDA: celdas
// `t="e" vm="N"` cuyo valor de respaldo es `#VALUE!` y cuya imagen vive en
// xl/richData/* y xl/metadata.xml. Una librería que reescribe el libro (ExcelJS,
// openpyxl) descarta esas partes y deja el texto literal «#VALUE!» en 23 celdas
// de concepto. Aquí no se reescribe el libro: se cambia el XML de las celdas que
// se tocan y todo lo demás del zip se copia byte a byte (como la vitrina del Word).
//
// Funciones puras sobre el texto XML de una hoja; sin dependencias.
// =============================================================================

export const escaparXml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** «K» → 11, «AA» → 27. */
export function numeroDeColumna(letras: string): number {
  let n = 0;
  for (const ch of letras.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

const partir = (ref: string) => {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) throw new Error(`referencia inválida: ${ref}`);
  return { col: m[1], fila: Number(m[2]) };
};

const RE_CELDA = (ref: string) => new RegExp(`<c r="${ref}"(?:\\s[^>]*?)?(?:/>|>[\\s\\S]*?</c>)`);
const estiloDe = (celda: string) => celda.match(/\ss="(\d+)"/)?.[1] ?? null;

/** Celda de texto en línea (no toca sharedStrings). Conserva el estilo de la celda que sustituye. */
export function celdaTexto(ref: string, texto: string, estilo: string | null): string {
  return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ""} t="inlineStr"><is><t xml:space="preserve">${escaparXml(texto)}</t></is></c>`;
}

/**
 * Escribe un texto en la celda `ref` de la hoja. Si la fila o la celda no
 * existen, las crea en su lugar (filas y celdas ordenadas, como exige el
 * formato). Nunca toca una celda con imagen (`vm=`): lanza.
 */
export function ponerTexto(hoja: string, ref: string, texto: string, estilo?: string | null): string {
  const { col, fila } = partir(ref);
  const reFila = new RegExp(`<row r="${fila}"(\\s[^>]*?)?(/>|>([\\s\\S]*?)</row>)`);
  const mFila = hoja.match(reFila);
  if (!mFila) {
    // Fila nueva, antes de la primera fila mayor (o al final de sheetData).
    const nueva = `<row r="${fila}">${celdaTexto(ref, texto, estilo ?? null)}</row>`;
    const mayor = [...hoja.matchAll(/<row r="(\d+)"/g)].find((m) => Number(m[1]) > fila);
    if (mayor?.index != null) return hoja.slice(0, mayor.index) + nueva + hoja.slice(mayor.index);
    if (hoja.includes("<sheetData/>")) return hoja.replace("<sheetData/>", () => `<sheetData>${nueva}</sheetData>`);
    return hoja.replace("</sheetData>", () => `${nueva}</sheetData>`);
  }
  const abre = `<row r="${fila}"${mFila[1] ?? ""}>`;
  let cuerpo = mFila[3] ?? "";
  const existente = cuerpo.match(RE_CELDA(ref));
  if (existente) {
    if (/\svm="/.test(existente[0])) throw new Error(`la celda ${ref} lleva una imagen (vm=) y no se toca`);
    const nueva = celdaTexto(ref, texto, estilo ?? estiloDe(existente[0]));
    cuerpo = cuerpo.replace(existente[0], () => nueva);
  } else {
    const n = numeroDeColumna(col);
    const despues = [...cuerpo.matchAll(/<c r="([A-Z]+)\d+"/g)].find((m) => numeroDeColumna(m[1]) > n);
    const nueva = celdaTexto(ref, texto, estilo ?? null);
    cuerpo = despues?.index != null ? cuerpo.slice(0, despues.index) + nueva + cuerpo.slice(despues.index) : cuerpo + nueva;
  }
  // Una fila que declaraba «spans» más cortos que la celda nueva no es un error para Excel; se deja.
  // Reemplazo con función: el texto puede traer «$&» y similares.
  return hoja.replace(mFila[0], () => `${abre}${cuerpo}</row>`);
}

/** Deja la celda vacía conservando su estilo (si existe). No toca imágenes. */
export function vaciarCelda(hoja: string, ref: string): string {
  const m = hoja.match(RE_CELDA(ref));
  if (!m || /\svm="/.test(m[0])) return hoja;
  const s = estiloDe(m[0]);
  return hoja.replace(m[0], () => `<c r="${ref}"${s ? ` s="${s}"` : ""}/>`);
}

/** Referencias de las celdas de una columna desde una fila. */
export function celdasDeColumna(hoja: string, col: string, desde: number): string[] {
  return [...hoja.matchAll(new RegExp(`<c r="(${col}(\\d+))"`, "g"))].filter((m) => Number(m[2]) >= desde).map((m) => m[1]);
}

/** Índices de sharedStrings usados por las celdas `t="s"` de una hoja. */
export function indicesCompartidos(hoja: string): number[] {
  return [...hoja.matchAll(/<c [^>]*t="s"[^>]*>\s*<v>(\d+)<\/v>/g)].map((m) => Number(m[1]));
}

/**
 * Deja vacíos los <si> de sharedStrings que ninguna hoja usa (sin reindexar:
 * las celdas siguen apuntando a los mismos índices). Así no queda en el archivo
 * el texto de una celda que se vació.
 */
export function vaciarCompartidosSinUso(sst: string, usados: Set<number>): { xml: string; vaciados: number } {
  let i = -1;
  let vaciados = 0;
  const xml = sst.replace(/<si>[\s\S]*?<\/si>|<si\/>/g, (si) => {
    i++;
    if (usados.has(i) || si === "<si><t></t></si>" || si === "<si/>") return si;
    vaciados++;
    return "<si><t></t></si>";
  });
  return { xml, vaciados };
}

/**
 * Celdas de una columna cuyo texto lleva «[» (validador de entrega). Lo que se
 * prohíbe es el marcador de pendiente: «[Pendiente» falla siempre; otro «[» solo
 * pasa si cada valor (separados por «; ») es EXACTAMENTE una opción de las listas
 * del propio formato (decisión de Esteban: «[815200] Finanzas - …» es un valor).
 */
export function celdasConCorchete(hoja: string, col: string, opciones: Set<string> = new Set()): string[] {
  const desesc = (t: string) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  return [...hoja.matchAll(new RegExp(`<c r="(${col}\\d+)"[^>]*><is><t[^>]*>([\\s\\S]*?)</t></is></c>`, "g"))]
    .filter((m) => {
      const t = desesc(m[2]);
      if (!t.includes("[")) return false;
      if (/\[Pendiente/i.test(t)) return true;
      return !t.split(/;\s*/).every((v) => opciones.has(v.trim()));
    })
    .map((m) => m[1]);
}

/** Opciones de las listas «▫ a ▫ b» del formato, desde sus cadenas compartidas. */
export function opcionesDeListas(sharedStrings: string): Set<string> {
  const out = new Set<string>();
  for (const si of sharedStrings.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    const t = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    if (t.includes("▫")) for (const o of t.split("▫")) if (o.trim()) out.add(o.trim().replace(/\s+/g, " "));
  }
  return out;
}

/**
 * Validador de entrega: las celdas con imagen siguen enlazadas a su rich value y
 * ningún «#VALUE!» quedó como texto suelto. Devuelve los problemas (vacío = ok).
 */
export function validarImagenesEnCelda(hojas: Record<string, string>, partes: string[], esperadas: number): string[] {
  const problemas: string[] = [];
  for (const p of ["xl/metadata.xml", "xl/richData/rdrichvalue.xml", "xl/richData/richValueRel.xml"]) if (!partes.includes(p)) problemas.push(`falta ${p}`);
  let conImagen = 0;
  for (const [nombre, xml] of Object.entries(hojas)) {
    for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = m[2];
      const cuerpo = m[3] ?? "";
      const tieneVm = /\svm="/.test(attrs);
      if (tieneVm) conImagen++;
      if (/#VALUE!/.test(cuerpo) && !tieneVm) problemas.push(`${nombre}!${m[1]}: «#VALUE!» sin imagen enlazada`);
    }
  }
  if (conImagen !== esperadas) problemas.push(`celdas con imagen: ${conImagen}, se esperaban ${esperadas}`);
  return problemas;
}
