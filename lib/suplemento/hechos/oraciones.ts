// =============================================================================
// DIVISIÓN DETERMINISTA EN ORACIONES (libro de hechos estable, Paso 5b).
//
// Dos corridas del libro sobre los mismos insumos deben dar el mismo conjunto
// de hechos (segunda revisión externa, punto 10). Para eso el modelo ya no
// decide dónde empieza y termina un hecho: el CÓDIGO parte cada fuente en
// oraciones numeradas, y el modelo solo dice cuáles son hechos pertinentes y
// los clasifica. El extracto de un hecho ES su oración, y su identidad entre
// corridas es `<fuente>#<n>`.
//
// Reglas, en orden:
//   1. En un PDF, los párrafos que el ancho de página cortó en líneas se rehacen
//      (una línea casi tan larga como la más larga de la página continúa).
//   2. Cada párrafo se parte en oraciones: punto, signo de cierre o punto y coma
//      seguidos de mayúscula, número, comilla o paréntesis de apertura.
//   3. Una enumeración dentro de una oración («(a) …; (b) …») se parte por
//      inciso: cada función de un comité es un hecho distinto.
// Nada de esto depende del modelo ni del orden en que lleguen las fuentes.
// =============================================================================

export type Oracion = { id: string; texto: string };

const CORTE_ORACION = /(?<=[.!?…])\s+(?=[«"“(¿¡]?[A-ZÁÉÍÓÚÑ0-9])/u;
const CORTE_INCISO = /;\s+(?=(?:y\s+)?\(?[a-zivx]{1,4}\)\s)/u;

/** Párrafos de un texto de PDF (líneas cortadas por el ancho de página). */
export function parrafosDeTexto(texto: string): string[] {
  const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lineas.length) return [];
  const ancho = Math.max(...lineas.map((l) => l.length));
  const out: string[] = [];
  let actual: string[] = [];
  for (const l of lineas) {
    actual.push(l);
    if (l.length < ancho * 0.75) {
      out.push(actual.join(" "));
      actual = [];
    }
  }
  if (actual.length) out.push(actual.join(" "));
  return out;
}

/** Oraciones de un párrafo, con las enumeraciones partidas por inciso. */
export function oracionesDe(parrafo: string): string[] {
  const limpio = parrafo.replace(/(\w)-\s+(\w)/g, "$1$2").replace(/\s+/g, " ").trim();
  if (!limpio) return [];
  return limpio
    .split(CORTE_ORACION)
    .flatMap((o) => o.split(CORTE_INCISO))
    .map((o) => o.trim())
    .filter((o) => o.length >= 12);
}

/**
 * Oraciones numeradas de una fuente. `pdf`: el texto viene en líneas de página
 * y se rehacen párrafos; si no, cada salto de línea doble (o simple) separa
 * párrafos tal como vienen.
 */
export function dividir(fuenteId: string, texto: string, opciones: { pdf?: boolean } = {}): Oracion[] {
  const parrafos = opciones.pdf ? parrafosDeTexto(texto) : texto.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const out: Oracion[] = [];
  for (const p of parrafos) for (const o of oracionesDe(p)) out.push({ id: `${fuenteId}#${out.length + 1}`, texto: o });
  return out;
}
