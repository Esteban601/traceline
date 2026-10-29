// =============================================================================
// HECHOS QUE DAN LA RAZÓN DE UN REQUISITO (encargo 2026-10-24-deuda-s2-formato).
//
// Algunos requisitos piden una RAZÓN que está en un hecho cuyo dueño es otro
// bloque. NIIF S2 21(a) (bloque 10) pide por qué no hay información cuantitativa
// de los efectos financieros previstos; la razón es el compromiso de transparencia
// de la Carta de la Dirección (dueño, el bloque 1). Decisión de Esteban, Fase 3.
//
// La misma ruta para las respuestas (lib/suplemento/respuestas.ts) y para el
// generador del bloque (lib/suplemento/hechos/bloque.ts): el hecho se busca por
// clave en todos los libros del documento, uno por clave, del libro del bloque
// primero, y se entrega con su fuente y su bloque de origen. No se copia ni se
// reasigna en el libro: un hecho tiene un solo dueño, y `bloques_referencia` lo
// daría como remisión, no como hecho citable.
//
// Las claves las pone el modelo al armar cada libro, así que la expresión cubre
// las variantes vistas: `emisora.compromiso_transparencia_limitaciones` (libros
// del 8 y 11/10) y `emisora.carta_compromiso_transparencia` (libro del 14/10).
// =============================================================================

/**
 * Requisitos cuya respuesta debe dar una RAZÓN que está en un hecho concreto. DEGRADA: si el hecho no está en
 * ningún libro del documento, no se pide ni se exige (el bloque deja su pendiente; la respuesta sale de los demás
 * hechos). `pide` va en la descripción de la respuesta; `uso`, junto al hecho que recibe el bloque.
 */
export const HECHO_RAZON: Record<string, { clave: RegExp; pide: string; uso: string }> = {
  "NIIF S2 21(a)": {
    clave: /^emisora\.(?:carta_)?compromiso_transparencia(?:_limitaciones)?$/,
    // Fase 6 de formato-respuesta-por-inciso (revisión externa v5.2): la razón es la de 19(a)/(b) de la declaración de
    // criterio de cuantificación; la limitación de transparencia va como oración complementaria.
    pide: "Da como razón de que no haya información cuantitativa la de la declaración de criterio de cuantificación (NIIF S2 19(a) y 19(b): los efectos no son identificables por separado y la incertidumbre de medición es tan alta que la información no sería útil), y cítala. Agrega, en una oración complementaria, la limitación que la Compañía reconoce (cuantificar los efectos financieros es una tarea de los próximos periodos), y cita ese hecho.",
    uso: "Es la razón de que no haya información cuantitativa sobre los efectos financieros previstos (NIIF S2 21(a)). Úsalo para eso, en la misma oración que un hecho propio de otro rango que la sostenga (por ejemplo, que no se identificaron efectos que reconocer), y ancla los dos.",
  },
};

export type HechoCandidato = { id: string; clave: string | null; libro_id: string; estado: string };

/**
 * Hechos que un bloque toma prestados para dar la razón de sus requisitos: por cada requisito con `HECHO_RAZON`,
 * un hecho vigente cuya clave coincide, del libro preferido primero (las variantes de clave de distintos libros son
 * el mismo hecho: se toma uno). No presta si el bloque ya tiene como propio un hecho que coincide (`esPropio`).
 */
export function hechosPrestados<T extends HechoCandidato>(requisitos: string[], candidatos: T[], libroPreferido: string, esPropio: (h: T) => boolean): T[] {
  const vigentes = candidatos
    .filter((h) => h.estado === "vigente" && h.clave)
    .sort((a, b) => Number(b.libro_id === libroPreferido) - Number(a.libro_id === libroPreferido));
  const out: T[] = [];
  for (const r of requisitos) {
    const razon = HECHO_RAZON[r];
    if (!razon) continue;
    const coinciden = vigentes.filter((h) => razon.clave.test(h.clave!));
    if (!coinciden.length || coinciden.some(esPropio)) continue;
    if (!out.includes(coinciden[0])) out.push(coinciden[0]);
  }
  return out;
}

/** El `uso` del hecho prestado: el de los requisitos del bloque cuya clave coincide. */
export function usoDelPrestado(requisitos: string[], clave: string): string {
  return requisitos.map((r) => HECHO_RAZON[r]).filter((x) => x && x.clave.test(clave)).map((x) => x!.uso).join(" ");
}
