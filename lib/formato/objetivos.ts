import { clonar, filaXml } from "@/lib/formato/metricas";
import type { ObjetivoFormato, ValorFormato } from "@/lib/formato/llenar";
import { remisionE5 } from "@/lib/suplemento/alivios";

// =============================================================================
// OBJETIVOS POR INCISO Y POR OBJETIVO (encargo formato-respuesta-por-inciso,
// Fase 4). La plantilla 2025 trae un bloque «Objetivo 1» de NIIF S1 51 (filas
// 196–215) y otro de NIIF S2 33–36 (216–268), y los marcadores «Objetivo 2» y
// «…» (269–270) que dicen que se repiten. Antes el demo juntaba los tres
// objetivos en una sola celda por fila y repetía el texto de NIIF S2 33 en cada
// inciso. Aquí: una copia de cada bloque por objetivo climático, cada inciso con
// el campo capturado del objetivo (regla, sin modelo); bajo E5, las filas de NIIF
// S1 51 remiten a su inciso de NIIF S2. A nivel XML, como las métricas de S1
// 46–50 (lib/formato/metricas.ts): las filas posteriores se recorren y las
// celdas combinadas se copian por bloque o se desplazan.
// =============================================================================

export const SECCION_OBJETIVOS = { desde: 196, hasta: 270, s1: { desde: 196, hasta: 215 }, s2: { desde: 216, hasta: 268 } };
const TAM_S1 = SECCION_OBJETIVOS.s1.hasta - SECCION_OBJETIVOS.s1.desde + 1;
const TAM_S2 = SECCION_OBJETIVOS.s2.hasta - SECCION_OBJETIVOS.s2.desde + 1;
const TAM_SECCION = SECCION_OBJETIVOS.hasta - SECCION_OBJETIVOS.desde + 1;

/** Cuántas filas se desplaza lo que viene después de la sección con n objetivos (sin objetivos, la plantilla como está). */
export const deltaObjetivos = (n: number) => (n ? n * (TAM_S1 + TAM_S2) - TAM_SECCION : 0);

/**
 * Fila del mapeo (plantilla) → fila de la hoja exportada: las de después de 185 se desplazan por las métricas de S1
 * 46–50 (`deltaMetricas`) y las de después de 270 además por los objetivos. Las del bloque de un objetivo, con
 * `objetivo` (0 = el primero).
 */
export function filaExportada(fila: number, n: { objetivos: number; deltaMetricas: number }, objetivo = 0): number {
  const { s1, s2, hasta } = SECCION_OBJETIVOS;
  const m = fila > 185 ? n.deltaMetricas : 0;
  if (!n.objetivos || fila < s1.desde) return fila + m;
  if (fila <= s1.hasta) return fila + m + objetivo * TAM_S1;
  if (fila <= s2.hasta) return fila + m + (n.objetivos - 1) * TAM_S1 + objetivo * TAM_S2;
  if (fila <= hasta) return fila + m; // marcadores «Objetivo 2» y «…»: ya no existen
  return fila + m + deltaObjetivos(n.objetivos);
}

const SI_NO: Record<string, string> = { verdadero: "Sí", falso: "No", si: "Sí", sí: "Sí", no: "No" };
const siNo = (v: string | null | undefined) => (v ? SI_NO[v.trim().toLowerCase()] ?? v.trim() : "");
const limpio = (v: string | null | undefined) => (v ?? "").trim();

/**
 * Objetivo de emisiones de GEI (NIIF S2 36 aplica solo a esos): alcances cubiertos o bruto/neto capturados y métrica en
 * tCO2e (decisión 3 de Esteban, Fase 5 de formato-afirmaciones-y-voz). Una sola regla para el Formato y el Excel.
 */
export const esObjetivoDeEmisiones = (o: { metrica?: string | null; alcances?: string | null; bruto_neto?: string | null }) =>
  !!(limpio(o.alcances) || limpio(o.bruto_neto)) && /t\s*CO(?:2|₂)\s*e/i.test(o.metrica ?? "");

/** S1 51 → su inciso de NIIF S2 (remisión del E5) y el campo del objetivo (sin E5). */
const S1_51: Record<number, { par: string; campo: keyof ObjetivoFormato }> = {
  202: { par: "NIIF S2 33 (a)", campo: "metrica" },
  204: { par: "NIIF S2 33", campo: "descripcion" },
  206: { par: "NIIF S2 33 (d)", campo: "periodo_aplicacion" },
  208: { par: "NIIF S2 33 (e)", campo: "periodo_base" },
  210: { par: "NIIF S2 33 (f)", campo: "hito_intermedio" },
  212: { par: "NIIF S2 35", campo: "resultados" },
  214: { par: "NIIF S2 34 (d)", campo: "revisiones" },
};
/** S2 33–36 por inciso: el campo capturado del objetivo. 223 (33(b), propósito) espera su campo (Fase 4, migración). */
const S2_CAMPOS: Record<number, (o: ObjetivoFormato) => string> = {
  217: (o) => o.nombre,
  219: (o) => limpio(o.origen),
  221: (o) => limpio(o.metrica),
  225: (o) => limpio(o.parte_entidad),
  227: (o) => limpio(o.periodo_aplicacion),
  229: (o) => limpio(o.periodo_base),
  231: (o) => limpio(o.hito_intermedio),
  233: (o) => limpio(o.tipo_objetivo),
  235: (o) => limpio(o.alineacion),
  237: (o) => siNo(o.validacion_tercero),
  239: (o) => limpio(o.procesos_revision),
  241: (o) => limpio(o.metricas_supervision),
  243: (o) => limpio(o.revisiones),
  245: (o) => [limpio(o.resultados), limpio(o.analisis_tendencias)].filter(Boolean).join(" "),
};
/** NIIF S2 36 (a)–(d): solo en el bloque de un objetivo de emisiones de GEI. */
const S2_GEI: Record<number, (o: ObjetivoFormato) => string> = {
  247: (o) => limpio(o.gases),
  249: (o) => limpio(o.alcances),
  251: (o) => limpio(o.bruto_neto),
  253: (o) => siNo(o.enfoque_descarbonizacion),
};
/** NIIF S2 36(e): el estado de los créditos de carbono es de la emisora (padre, booleano, incisos), no de cada objetivo. */
const S2_36E = [255, 256, 257, 259, 261, 263, 265, 267];

export type BloqueObjetivo = { nombre: string; s1: Map<number, string>; s2: Map<number, string> };

/** Los valores de la columna K de cada bloque «Objetivo N», desde los campos capturados y el llenado general. */
export function bloquesDeObjetivos(objetivos: ObjetivoFormato[], valores: Map<number, ValorFormato>, e5: boolean): BloqueObjetivo[] {
  const general = (f: number) => valores.get(f)?.texto ?? "";
  return objetivos.map((o) => {
    const s1 = new Map<number, string>([
      [197, o.nombre],
      [199, general(199)],
      [200, limpio(o.origen)],
      ...Object.entries(S1_51).map(([f, x]) => [Number(f), e5 ? remisionE5(x.par) : limpio(o[x.campo] as string | null)] as [number, string]),
    ]);
    const gei = esObjetivoDeEmisiones(o);
    const s2 = new Map<number, string>([
      ...Object.entries(S2_CAMPOS).map(([f, fn]) => [Number(f), fn(o)] as [number, string]),
      ...Object.entries(S2_GEI).map(([f, fn]) => [Number(f), gei ? fn(o) : ""] as [number, string]),
      ...S2_36E.map((f) => [f, gei ? general(f) : ""] as [number, string]),
    ]);
    return { nombre: o.nombre, s1, s2 };
  });
}

/**
 * Sustituye la sección de objetivos (196–270, en coordenadas de la plantilla, ANTES de expandir las métricas) por un
 * bloque de S1 51 y uno de S2 33–36 por objetivo. Devuelve la hoja y el desplazamiento de lo que venía después.
 */
export function expandirObjetivos(hoja: string, bloques: BloqueObjetivo[]): { xml: string; delta: number } {
  const S = SECCION_OBJETIVOS;
  if (!bloques.length) return { xml: hoja, delta: 0 };
  const nuevas: string[] = [];
  let n = S.desde;
  const copiar = (b: { desde: number; hasta: number }, valores: (o: BloqueObjetivo) => Map<number, string>, etiqueta: string) => {
    bloques.forEach((o, i) => {
      for (let r = b.desde; r <= b.hasta; r++) {
        const textos: Record<string, string> = {};
        if (r === b.desde) textos.D = `${etiqueta} ${i + 1}: ${o.nombre}`;
        const k = valores(o).get(r);
        if (k) textos.K = k;
        nuevas.push(clonar(hoja, r, n++, textos));
      }
    });
  };
  copiar(S.s1, (o) => o.s1, "Objetivo");
  copiar(S.s2, (o) => o.s2, "Objetivo");
  const delta = deltaObjetivos(bloques.length);
  const finS1 = S.s1.desde + bloques.length * TAM_S1 - 1;

  // 1. Quitar la sección original y poner la nueva en su lugar.
  const primera = filaXml(hoja, S.desde)!;
  const ultima = filaXml(hoja, S.hasta)!;
  const inicioSec = hoja.indexOf(primera);
  const finSec = hoja.indexOf(ultima) + ultima.length;
  const antes = hoja.slice(0, inicioSec);
  let despues = hoja.slice(finSec);

  // 2. Recorrer las filas posteriores (solo en sheetData).
  const corte = despues.indexOf("</sheetData>");
  const datos = despues.slice(0, corte).replace(/<row r="(\d+)"/g, (_m, r) => `<row r="${Number(r) + delta}"`).replace(/<c r="([A-Z]+)(\d+)"/g, (_m, c, r) => `<c r="${c}${Number(r) + delta}"`);
  despues = datos + despues.slice(corte);

  // 3. Celdas combinadas: las de un bloque se copian por objetivo; las que empiezan antes de la sección y terminan en el
  //    bloque de S1 (E e I desde el encabezado 195) se alargan hasta el último bloque de S1; las de los marcadores se
  //    quitan; las posteriores se desplazan.
  const enBloque = (r1: number, r2: number, b: { desde: number; hasta: number }) => r1 >= b.desde && r2 <= b.hasta;
  const recalc = (cuerpo: string) =>
    [...cuerpo.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g)].flatMap((m) => {
      const [c1, r1, c2, r2] = [m[1], Number(m[2]), m[3], Number(m[4])];
      if (r1 > S.hasta) return [`${c1}${r1 + delta}:${c2}${r2 + delta}`];
      if (r2 < S.desde) return [`${c1}${r1}:${c2}${r2}`];
      if (r1 < S.desde && r2 <= S.s1.hasta) return [`${c1}${r1}:${c2}${finS1}`];
      if (enBloque(r1, r2, S.s1)) return bloques.map((_, i) => `${c1}${r1 + i * TAM_S1}:${c2}${r2 + i * TAM_S1}`);
      if (enBloque(r1, r2, S.s2)) {
        const base = (bloques.length - 1) * TAM_S1;
        return bloques.map((_, i) => `${c1}${r1 + base + i * TAM_S2}:${c2}${r2 + base + i * TAM_S2}`);
      }
      return [];
    });
  despues = despues.replace(/<mergeCells count="\d+">([\s\S]*?)<\/mergeCells>/, (_m, cuerpo: string) => {
    const todas = recalc(cuerpo);
    return `<mergeCells count="${todas.length}">${todas.map((r) => `<mergeCell ref="${r}"/>`).join("")}</mergeCells>`;
  });

  let xml = antes + nuevas.join("") + despues;
  xml = xml.replace(/<dimension ref="([A-Z]+\d+):([A-Z]+)(\d+)"/, (_m, a, c, r) => `<dimension ref="${a}:${c}${Number(r) + delta}"`);
  return { xml, delta };
}
