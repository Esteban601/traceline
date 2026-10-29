import { ponerTexto } from "@/lib/formato/xlsx-xml";

// =============================================================================
// ITERACIÓN DE MÉTRICAS NIIF S1 46–50 (filas 144–185 del formato 2025; mapeo
// revisado por Esteban: «una fila por métrica intersectorial de NIIF S2 29,
// ligada a cada riesgo u oportunidad de la fila 56»).
//
// La plantilla trae UNA métrica de ejemplo (filas 147–170) dentro de «Riesgo 1»
// y, de la 171 a la 185, los marcadores «Métrica 2», «Riesgo 2», «Oportunidad 1»…
// que dicen cómo se repite. Aquí se sustituye la sección 145–185 por:
//   Riesgos · por riesgo: «Riesgo i: nombre» · por métrica: «Métrica j: nombre»
//   + las 23 filas del bloque (148–170) con la columna K llena;
//   Oportunidades · lo mismo por oportunidad.
// Las filas posteriores se recorren, las celdas combinadas de la sección se
// rehacen por bloque y las de después se desplazan. A nivel XML, como el resto
// del formato (ver lib/formato/xlsx-xml.ts); en la sección no hay imágenes.
// =============================================================================

export const SECCION_METRICAS = { desde: 145, hasta: 185, riesgos: 145, riesgo: 146, metrica: 147, bloqueDesde: 148, bloqueHasta: 170, oportunidades: 177, oportunidad: 178 };

export type MetricaIterada = { nombre: string; valores: Map<number, string> };
export type ElementoIterado = { nombre: string; metricas: MetricaIterada[] };

export const filaXml = (hoja: string, n: number) => hoja.match(new RegExp(`<row r="${n}"(?:\\s[^>]*?)?(?:/>|>[\\s\\S]*?</row>)`))?.[0] ?? null;

function renumerar(fila: string, de: number, a: number): string {
  return fila.replace(new RegExp(`<row r="${de}"`), `<row r="${a}"`).replace(new RegExp(`(<c r="[A-Z]+)${de}"`, "g"), `$1${a}"`);
}

/** Copia de la fila `de` con número `a` y los textos indicados por columna. */
export function clonar(hoja: string, de: number, a: number, textos: Record<string, string>): string {
  const original = filaXml(hoja, de) ?? `<row r="${de}"/>`;
  let fila = renumerar(original, de, a);
  for (const [col, t] of Object.entries(textos)) {
    if (!t) continue;
    fila = ponerTexto(`<sheetData>${fila}</sheetData>`, `${col}${a}`, t).replace(/^<sheetData>|<\/sheetData>$/g, "");
  }
  return fila;
}

/**
 * Sustituye la sección de métricas por su iteración. Devuelve la hoja y cuántas
 * filas se desplazó lo que venía después (delta).
 */
export function expandirMetricas(hoja: string, riesgos: ElementoIterado[], oportunidades: ElementoIterado[]): { xml: string; delta: number } {
  const S = SECCION_METRICAS;
  if (!riesgos.length && !oportunidades.length) return { xml: hoja, delta: 0 };
  const nuevas: string[] = [];
  const mergesNuevos: string[] = [];
  let n = S.desde;
  const push = (de: number, textos: Record<string, string> = {}) => nuevas.push(clonar(hoja, de, n++, textos));

  const iterar = (cabecera: number, filaElemento: number, etiqueta: string, elementos: ElementoIterado[]) => {
    push(cabecera);
    elementos.forEach((e, i) => {
      push(filaElemento, { D: `${etiqueta} ${i + 1}: ${e.nombre}` });
      e.metricas.forEach((m, j) => {
        push(S.metrica, { D: `Métrica ${j + 1}: ${m.nombre}` });
        const inicio = n;
        for (let r = S.bloqueDesde; r <= S.bloqueHasta; r++) push(r, { K: m.valores.get(r) ?? "" });
        // Combinadas de la columna A del bloque (148:156, 157:164, 165:166, 167:168, 169:170), por desplazamiento.
        for (const [a, b] of [[148, 156], [157, 164], [165, 166], [167, 168], [169, 170]]) mergesNuevos.push(`A${inicio + a - S.bloqueDesde}:A${inicio + b - S.bloqueDesde}`);
      });
    });
  };
  iterar(S.riesgos, S.riesgo, "Riesgo", riesgos);
  iterar(S.oportunidades, S.oportunidad, "Oportunidad", oportunidades);
  const fin = n - 1;
  // Columnas G, H e I combinadas en toda la sección (consideraciones del formato).
  for (const col of ["G", "H", "I"]) mergesNuevos.push(`${col}${S.desde}:${col}${fin}`);
  const delta = fin - S.hasta;

  // 1. Quitar la sección original y poner la nueva en su lugar.
  const inicioSec = hoja.indexOf(filaXml(hoja, S.desde)!);
  const ultima = filaXml(hoja, S.hasta)!;
  const finSec = hoja.indexOf(ultima) + ultima.length;
  const antes = hoja.slice(0, inicioSec);
  let despues = hoja.slice(finSec);

  // 2. Recorrer las filas posteriores (solo en sheetData).
  const corte = despues.indexOf("</sheetData>");
  const datos = despues.slice(0, corte).replace(/<row r="(\d+)"/g, (_m, r) => `<row r="${Number(r) + delta}"`).replace(/<c r="([A-Z]+)(\d+)"/g, (_m, c, r) => `<c r="${c}${Number(r) + delta}"`);
  despues = datos + despues.slice(corte);

  // 3. Celdas combinadas: las de la sección se rehacen; las posteriores se desplazan.
  despues = despues.replace(/<mergeCells count="\d+">([\s\S]*?)<\/mergeCells>/, (_m, cuerpo: string) => {
    const refs = [...cuerpo.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g)]
      .map((m) => ({ c1: m[1], r1: Number(m[2]), c2: m[3], r2: Number(m[4]) }))
      .filter((m) => !(m.r1 >= S.desde && m.r1 <= S.hasta))
      .map((m) => (m.r1 > S.hasta ? `${m.c1}${m.r1 + delta}:${m.c2}${m.r2 + delta}` : `${m.c1}${m.r1}:${m.c2}${m.r2}`));
    const todas = [...refs, ...mergesNuevos];
    return `<mergeCells count="${todas.length}">${todas.map((r) => `<mergeCell ref="${r}"/>`).join("")}</mergeCells>`;
  });

  let xml = antes + nuevas.join("") + despues;
  // 4. Dimensión de la hoja.
  xml = xml.replace(/<dimension ref="([A-Z]+\d+):([A-Z]+)(\d+)"/, (_m, a, c, r) => `<dimension ref="${a}:${c}${Number(r) + delta}"`);
  return { xml, delta };
}
