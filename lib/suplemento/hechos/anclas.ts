// =============================================================================
// ANCLAS POR ORACIÓN (Paso 5b, segunda revisión externa, punto 8).
//
// En modo libro el modelo cierra cada oración que afirma algo con los ids de
// los hechos que la sostienen: «… el 27 de febrero de 2025 [h3][h5].». Aquí se
// separan: el texto publicable sale SIN anclas y las anclas se guardan aparte
// (documentos_bloques.anclas), para que el revisor vea qué hecho sostiene cada
// oración en vez de casar a mano una lista de fuentes con el texto.
//
// Los validadores corren sobre el texto ya limpio: un «[h3]» no es un marcador
// mal formado ni un «3» es una cifra.
// =============================================================================

export type Ancla = { oracion: string; ids: string[] };

// [hN]: hecho del bloque. [Bn.k]: hecho del MAPA del documento al que remite una
// remisión (rúbrica del 5c): la remisión se valida contra ese hecho.
const RACHA = /((?:\s*\[(?:h\d+|B\d+\.\d+)\])+)\s*([.;:]?)/g;

export function separarAnclas(texto: string): { texto: string; anclas: Ancla[]; ids: string[] } {
  const anclas: Ancla[] = [];
  let limpio = "";
  let corte = 0;
  let inicioOracion = 0;
  for (const m of texto.matchAll(RACHA)) {
    const antes = texto.slice(corte, m.index);
    limpio += antes + m[2];
    const ids = [...m[1].matchAll(/\[(h\d+|B\d+\.\d+)\]/g)].map((x) => x[1]);
    // La oración: desde el último fin de oración o salto de línea del texto limpio.
    const desde = Math.max(inicioOracion, limpio.lastIndexOf("\n") + 1);
    const oracion = limpio.slice(desde).trim();
    if (oracion) anclas.push({ oracion, ids: [...new Set(ids)] });
    inicioOracion = limpio.length;
    corte = m.index! + m[0].length;
    // Conserva el espacio que separaba esta oración de la siguiente.
    if (/\s$/.test(m[0]) && !/\s$/.test(limpio)) limpio += " ";
  }
  limpio += texto.slice(corte);
  limpio = limpio.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ");
  return { texto: limpio, anclas, ids: [...new Set(anclas.flatMap((a) => a.ids))] };
}
