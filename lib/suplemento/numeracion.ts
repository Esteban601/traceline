// =============================================================================
// NUMERACIÓN DE SECCIONES DEL DOCUMENTO (revisión externa del Excel de
// taxonomía, punto 4; especificación 0.41, §3 y §6.1).
//
// El número de una sección en el Word es su POSICIÓN entre las que van en el
// documento, no el número del bloque en §3: con editoriales apagados o bloques
// fuera por régimen, el índice saltaba (del 19 al 21). Las remisiones «Ver
// sección N» del Excel usan esta misma numeración, así que las dos salen de aquí.
// =============================================================================

/** Número de bloque (§3) → número de sección en el documento, consecutivo desde 1. */
export function numeracionConsecutiva(numerosDeBloque: Iterable<number>): Map<number, number> {
  const orden = [...new Set(numerosDeBloque)].sort((a, b) => a - b);
  return new Map(orden.map((n, i) => [n, i + 1]));
}
