// =============================================================================
// GLOSARIO DE VOCABULARIO DE PLATAFORMA (CLAUDE.md §5). ÚNICA FUENTE.
//
// Decisión de Esteban del 26 de octubre de 2026 (encargo formato-afirmaciones-
// y-voz): el validador toma el glosario de CLAUDE.md §5 y nada más. Todo lo que
// decide si un texto publicable habla con voz de plataforma lee de aquí: el
// generador de bloques, las respuestas por datapoint, los prompts que listan las
// palabras, las celdas que arma el código (Formato electrónico, métricas
// iteradas) y los e2e. `scripts/e2e-respuestas-validadores.mjs` comprueba que
// esta lista y la de CLAUDE.md §5 sean la misma; ninguna otra copia existe.
//
// Cada término lleva sus variantes en la expresión. Fuera a propósito, porque
// son voz legítima de una emisora: «validación» («la validación del informe
// anual»), «captura» («captura de carbono»), «recibidos» («intereses
// recibidos»).
// =============================================================================

/** Letra antes o después: los límites de palabra de JS no conocen los acentos. */
const P = (cuerpo: string) => new RegExp(`(?<!\\p{L})(?:${cuerpo})(?!\\p{L})`, "iu");

export const GLOSARIO_PLATAFORMA: { termino: string; re: RegExp }[] = [
  { termino: "solicitud", re: P("solicitud(?:es)?") },
  { termino: "evidencia", re: P("evidencias?") },
  { termino: "expediente", re: P("expedientes?") },
  { termino: "entregado", re: P("entregad[oa]s?") },
  { termino: "recibido", re: P("recibid[oa]") },
  { termino: "validado", re: P("validad[oa]s?") },
  { termino: "IRStrat", re: P("IRStrat") },
  { termino: "plataforma", re: P("plataformas?") },
  { termino: "bloque", re: P("bloques?") },
  { termino: "datapoint", re: P("datapoints?") },
  { termino: "suplemento", re: P("suplementos?") },
  { termino: "registros de clima", re: P("registros? de clima") },
  { termino: "memoria de cálculo", re: P("memorias? de c[aá]lculo") },
  // Identificadores internos: prefijos de fuente y uuids.
  { termino: "ids", re: /(?<!\p{L})(?:sol|reg|obj|cue|perfil|reporte|evi|adj):|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu },
];

/** Los términos, para los prompts y las rúbricas (se listan, no se copian). */
export const TERMINOS_PLATAFORMA = GLOSARIO_PLATAFORMA.map((t) => t.termino);

/** El marcador de pendiente: lo único que puede nombrar una solicitud o un campo. */
const RE_PENDIENTE = /\[Pendiente:[^\]]*\]/g;

/**
 * Términos del glosario presentes FUERA del marcador de pendiente. Devuelve los
 * términos (no las variantes encontradas), para decírselo al modelo en el
 * reintento: un reintento que solo dice "hubo un error" repite el mismo fallo.
 */
export function vocabularioProhibidoEn(texto: string): string[] {
  const sinMarcadores = texto.replace(RE_PENDIENTE, " ");
  return GLOSARIO_PLATAFORMA.filter((t) => t.re.test(sinMarcadores)).map((t) => t.termino);
}
