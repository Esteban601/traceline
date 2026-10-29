import { createHash } from "node:crypto";
import { conPerimetro } from "@/lib/reporte/cifra";
import { BOOLEANOS_FORMATO, clausulasDelTema, validarBooleano } from "@/lib/formato/booleanos";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BLOQUES, datapointsExentos } from "@/lib/suplemento/bloques";
import { PADRE_DE, noAplicaHeredado } from "@/lib/suplemento/catalogo-incisos";
import { aplicarGlosario, leerGlosario, type EntradaGlosario } from "@/lib/suplemento/glosario";
import { costoUsd, type Uso } from "@/lib/suplemento/modelos";
import { TERMINOS_PLATAFORMA, vocabularioProhibidoEn } from "@/lib/suplemento/vocabulario";
import { oracionesDe } from "@/lib/suplemento/hechos/oraciones";
import { NEGACION } from "@/lib/suplemento/hechos/tipos";
import { HECHO_RAZON } from "@/lib/suplemento/hechos/razones";
import { numerosDe } from "@/lib/evidencias/fuente";
import { numeracionConsecutiva } from "@/lib/suplemento/numeracion";
import { preguntasDe } from "@/lib/cuestionarios";
import { leerAlivios, type Alivios } from "@/lib/perfil-emisor";
import { ALCANCE_E5, E4_EN_DECLARACION, ORACION_E4, ORACION_E5, textoAlivio } from "@/lib/suplemento/alivios";
import { ensamblarReporte } from "@/lib/reporte/ensamblar";
import mapeoFormato from "@/docs/suplemento-s1s2/mapeo-formato-electronico.json" with { type: "json" };

// =============================================================================
// RESPUESTAS POR DATAPOINT (encargo 2026-10-13-excel-respuestas-narrativas,
// Paso 2). Al aprobar un documento del Suplemento, cada código del catálogo
// recibe una respuesta para el Excel de taxonomía y, si alimenta conceptos text
// o text block del Formato electrónico, otra para el formato. Se guardan en
// `respuestas_datapoint`; los dos Excel las leen de ahí.
//
// EL MODELO NUNCA DECIDE QUÉ SE RESPONDE (Paso 0). El código decide, en orden:
//   1. «No aplica» por un alivio vigente (C4) o heredado del catálogo (36(c),
//      36(e)) — regla;
//   2. el padre de incisos (25(a), 36(a)–(d), 36(e)) se responde con los hechos
//      de sus hijos, o «no aplica» si todos sus hijos lo son;
//   3. con bloque dueño en el documento aprobado y cobertura con hechos — el
//      modelo resume ese bloque (agrupado por bloque: una llamada por bloque);
//   4. NIIF S1 sin bloque dueño con el alivio E5 vigente — «no aplica», con la
//      remisión a su par de NIIF S2 cuando el mapeo del formato lo tiene;
//   5. sin bloque dueño, con captura confirmada — la respuesta sale de la
//      captura, sin modelo (decisión de Esteban del 13 de octubre de 2026);
//   6. lo demás — «Pendiente», con el marcador del Word.
//
// LONGITUD (decisión de Esteban del 13 de octubre de 2026): taxonomía, hasta
// cuatro oraciones; formato, hasta seis oraciones y 900 caracteres.
//
// VALIDADORES, sin modelo, sobre cada respuesta: cifras solo de la sección
// aprobada o de los hechos del requisito; hechos citados entre los entregados;
// la declaración negativa del requisito presente; longitud; sin vocabulario de
// plataforma ni marcadores; glosario aplicado (sustituye y anota). Lo que no
// pasa vuelve una vez al modelo con el motivo; si vuelve a fallar, la respuesta
// son las oraciones del bloque aprobado ancladas a los hechos del requisito
// (origen «bloque»), que ya pasaron los validadores del generador.
// =============================================================================

type Db = SupabaseClient<Database>;
export type Destino = "taxonomia" | "formato";
export type EstadoRespuesta = "respuesta" | "pendiente" | "no_aplica";
export type OrigenRespuesta = "modelo" | "captura" | "bloque" | "regla";

export const MODELO_RESPUESTAS = "claude-sonnet-5-5" as const;
export const PROMPT_RESPUESTAS = "respuestas-v1-20261013";
export const LIMITES: Record<Destino, { oraciones: number; caracteres: number | null }> = {
  taxonomia: { oraciones: 4, caracteres: null },
  formato: { oraciones: 6, caracteres: 900 },
};

// Los textos de los alivios (E5, E4, C3, C4) viven en lib/suplemento/alivios.ts (única fuente, Fase 5).
export { ORACION_E5, ALCANCE_E5, E4_EN_DECLARACION, ORACION_E4 } from "@/lib/suplemento/alivios";

/** La declaración de cumplimiento del bloque 2 aprobado: su párrafo, tal cual (bloque de plantilla, sin hechos). */
export function declaracionDeCumplimiento(textoBloque2: string | null): string | null {
  return (textoBloque2 ?? "").split(/\n+/).map((p) => p.trim()).find((p) => /de conformidad con las Normas NIIF S1/i.test(p)) ?? null;
}

/**
 * «No aplica» heredado, en voz de la emisora. El motivo de noAplicaHeredado es
 * para el revisor (nombra el cuestionario y dice «la emisora»); el Excel publica.
 */
const NOTA_CUESTIONARIO_36E = "Respuesta de la emisora en el cuestionario S2 36(e).";
/** La respuesta de texto del cuestionario 36(e) para un código de inciso («NIIF S2 36 (e)(i)»), o null. */
export function respuestaDeCuestionario36e(codigo: string, cuestionarios: { hoja: string; pregunta_orden: number; respuesta: string | null }[]): string | null {
  const sin = (x: string) => x.replace(/^NIIF\s*/, "").replace(/\s+/g, "");
  if (!/^NIIF S2 36 ?\(e\)\((i|ii|iii|iv)\)$/.test(codigo)) return null;
  const ordenes = preguntasDe("S2 36(e)").filter((q) => q.control === "texto" && sin(q.inciso) === sin(codigo)).map((q) => q.orden);
  const textos = cuestionarios
    // Una respuesta que solo dice «No aplica…» no responde el inciso: toma el «No aplica» de regla, con una sola
    // redacción (encargo formato-respuesta-por-inciso, Fase 1; K540 decía «No aplica:» y las demás «No aplica.»).
    .filter((c) => c.hoja === "S2 36(e)" && ordenes.includes(c.pregunta_orden) && c.respuesta?.trim() && !/^no aplica\b/i.test(c.respuesta.trim()))
    .sort((a, b) => a.pregunta_orden - b.pregunta_orden)
    .map((c) => c.respuesta!.trim());
  return textos.length ? textos.join(" ") : null;
}

/** El padre que remite a sus incisos («NIIF S2 36 (e)(i)» … «(iv)» → «NIIF S2 36 (e)(i) a (iv)»). */
export function remisionAIncisos(hijos: string[]): string {
  const ultimo = hijos[hijos.length - 1].match(/\([^()]*\)$/)?.[0] ?? hijos[hijos.length - 1];
  return `La información correspondiente a este requisito se revela en sus incisos, conforme a ${hijos[0]} a ${ultimo}.`;
}

export function textoNoAplicaHeredado(codigo: string): string {
  if (codigo === "NIIF S2 36 (c)") return "No aplica. Ningún objetivo de emisiones de la Compañía es neto, por lo que no hay un objetivo bruto asociado que revelar por separado.";
  if (codigo.startsWith("NIIF S2 36 (e)")) return "No aplica. La Compañía no prevé usar créditos de carbono para alcanzar sus objetivos de emisiones.";
  return "No aplica. El requisito no aplica a la Compañía en este periodo.";
}

export type FilaRespuesta = {
  destino: Destino;
  clave: string;
  tipo_campo: string;
  estado: EstadoRespuesta;
  origen: OrigenRespuesta;
  texto: string | null;
  valor: Record<string, unknown> | null;
  bloque: number | null;
  bloque_version: number | null;
  hechos: string[];
  notas: string[];
  modelo: string | null;
  prompt_version: string | null;
  uso: Uso;
  costo_usd: number;
};

const sinCodigoNorma = (c: string) => c.replace(/\s+/g, "").toLowerCase();
const marcador = (falta: string, donde: string) => `[Pendiente: ${falta} — ${donde}]`;
const USO_CERO: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };

// -----------------------------------------------------------------------------
// Mapeo del formato: qué datapoints alimentan conceptos text / text block, y el
// par NIIF S2 de cada párrafo de NIIF S1 (regla S1→S2 de la revisión de Esteban).
// -----------------------------------------------------------------------------
type ConceptoMapeo = { fila?: number; tipo?: string | null; clasificacion?: string; datapoint?: string | null; bloque?: number | null; parrafos?: string[]; alivioE5?: boolean };
const CONCEPTOS = (mapeoFormato as { conceptos: ConceptoMapeo[] }).conceptos;

export const DATAPOINTS_FORMATO_TEXTO: Set<string> = new Set(
  CONCEPTOS.filter((c) => /^text/.test(c.tipo ?? "") && c.datapoint).map((c) => c.datapoint as string)
);

/**
 * Conceptos del formato que comparten datapoint pero piden cosas distintas
 * (cuarta lectura): 97 (rendimiento financiero) y 99 (flujos de efectivo) salen
 * de NIIF S2 16(d). Cada uno se redacta con su enfoque, en dos oraciones, desde
 * los hechos de la cobertura de ese datapoint; nunca se copian ni se remiten.
 */
/**
 * B65(c) por celda (encargo formato-afirmaciones-y-voz, Fase 3): las cinco celdas de efectos financieros de cada tipo
 * (transición, físicos, oportunidades), cada una con su efecto y sin repetir oraciones entre ellas. Suman a los hechos
 * del código los del bloque 10 que remiten al bloque del tipo y las declaraciones negativas generales del bloque 10.
 */
const B65C_EFECTOS = [
  (de: string) => `cómo ${de} han afectado a la situación financiera (activos, pasivos y patrimonio) durante el periodo sobre el que se informa`,
  (de: string) => `cómo ${de} han afectado al rendimiento financiero (ingresos, gastos y resultados) durante el periodo sobre el que se informa`,
  (de: string) => `cómo ${de} han afectado a los flujos de efectivo durante el periodo sobre el que se informa`,
  (de: string) => `los efectos financieros previstos de ${de} sobre la situación financiera, el rendimiento y los flujos de efectivo a corto, mediano y largo plazo, incluidos los planes de disposición de activos (NIIF S2 16(c)) si los hechos los mencionan`,
  (de: string) => `para cuáles de ${de} existe un riesgo significativo de un ajuste material en los importes en libros de los activos y pasivos durante el siguiente periodo`,
];
/** Lo que cada una de las cinco celdas tiene que nombrar (validador). */
const B65C_EFECTO_RE = [
  { nombre: "la situación financiera", re: /situaci[oó]n financiera|activos?|pasivos?|patrimonio|balance/i },
  { nombre: "el rendimiento financiero", re: /rendimiento|ingresos?|gastos?|resultados?|margen/i },
  { nombre: "los flujos de efectivo", re: /flujos? de efectivo/i },
  { nombre: "los efectos previstos", re: /previst|se espera|prev[eé]|podr[ií]a|plazo/i },
  { nombre: "el riesgo de ajuste material", re: /ajuste material|importes? en libros/i },
];
/** El tipo que cada grupo de cinco celdas tiene que nombrar (validador), en el orden de B65C_TIPOS. */
const B65C_TIPO_RE = [
  { nombre: "riesgos de transición", re: /de transici[oó]n/i },
  { nombre: "riesgos físicos", re: /f[ií]sic[oa]s/i },
  { nombre: "oportunidades", re: /oportunidad/i },
];
const B65C_TIPOS = [
  { inciso: "b", bloque: 34, desplazamiento: 0, de: "los riesgos de transición relacionados con el clima" },
  { inciso: "c", bloque: 35, desplazamiento: 23, de: "los riesgos físicos relacionados con el clima" },
  { inciso: "d", bloque: 36, desplazamiento: 46, de: "las oportunidades relacionadas con el clima" },
];
/**
 * Planes de disposición de activos (NIIF S2 16(c); regla de Esteban, encargo formato-afirmaciones-y-voz): van a la
 * celda de efectos previstos del tipo de riesgo que el hecho nombra como motivo («zonas de inundación» → físico),
 * nunca por el bloque al que remite. Si no nombra riesgo, o nombra los dos, no entra en B65(c) y se lista como hecho
 * sin tipo para clasificación de IRStrat (hoja «Avisos» de la revisión).
 */
export const PLAN_DISPOSICION_RE = /disposici[oó]n de activos|reubic|desinversi[oó]n|venta de (activos|sucursales|inmuebles)|cierre definitivo/i;
const MOTIVO_FISICO_RE = /inundaci|hurac[aá]n|cicl[oó]n|tormenta|sequ[ií]a|estr[eé]s h[ií]drico|olas? de calor|incendio|nivel del mar|deslave|riesgos? f[ií]sicos?|fen[oó]menos? meteorol/i;
const MOTIVO_TRANSICION_RE = /riesgos? de transici[oó]n|transici[oó]n energ|precio del carbono|impuesto al carbono|activos varados|intensiv[oa]s? en carbono|descarboniz/i;
/** Bloque del tipo de riesgo que el plan de disposición nombra como motivo (35 físico, 34 transición), o null. */
export function tipoDeDisposicion(enunciado: string): 34 | 35 | null {
  const fisico = MOTIVO_FISICO_RE.test(enunciado);
  const transicion = MOTIVO_TRANSICION_RE.test(enunciado);
  return fisico === transicion ? null : fisico ? 35 : 34;
}
/** Hechos vigentes de planes de disposición que no nombran un tipo de riesgo: para clasificación de IRStrat. */
export function disposicionesSinTipo<H extends { estado: string; enunciado: string }>(hechos: H[]): H[] {
  return hechos.filter((h) => h.estado === "vigente" && PLAN_DISPOSICION_RE.test(h.enunciado) && tipoDeDisposicion(h.enunciado) == null);
}

export const CONCEPTOS_B65C: { fila: number; codigo: string; enfoque: string; prestadosDe: number }[] = B65C_TIPOS.flatMap((t) =>
  [354, 356, 358, 360, 361].map((f, i) => ({ fila: f + t.desplazamiento, codigo: `NIIF S2 29 (${t.inciso}) · B65 (c)`, enfoque: B65C_EFECTOS[i](t.de), prestadosDe: t.bloque }))
);

/**
 * NIIF S2 29(e) por tipo (encargo formato-respuesta-por-inciso, Fase 1): la plantilla pide el despliegue de capital
 * aplicado a los riesgos de transición (fila 350), a los físicos (373) y a las oportunidades (396). Antes las tres
 * repetían el párrafo: los mismos 31.4 millones en los tres tipos, y en el de riesgos físicos una inversión que no lo
 * es. Cada celda recibe solo los hechos de despliegue de capital del libro de su tipo (dueños del bloque 34, 35 o 36, o
 * que remiten a él); sin ninguno, la celda queda vacía. El total del párrafo sigue en la fila 414.
 */
const DESPLIEGUE_RE = /gasto de capital|se capitaliz|capitalizaron|invirti|inversi[oó]n (ambiental|de \d|en )|inversi[oó]n \d|financiaci[oó]n:? \d|; financiaci[oó]n|destin[oó] [\d.,]+ millones/i;
export const CONCEPTOS_29E: { fila: number; bloque: 34 | 35 | 36; de: string; tipo: { nombre: string; re: RegExp } }[] = B65C_TIPOS.map((t, i) => ({
  fila: 350 + t.desplazamiento,
  bloque: t.bloque as 34 | 35 | 36,
  de: t.de,
  tipo: B65C_TIPO_RE[i],
}));
/**
 * Tablas por horizonte de 16(d) (filas 97 rendimiento y 99 flujos; ajuste 3 de Esteban, Fase 2): una respuesta por
 * plazo (`fila:97:corto`…) solo con los hechos del código que nombran ese plazo; donde no hay hecho, la línea no va.
 * Antes la tabla repetía el mismo texto en los tres plazos.
 */
export const HORIZONTES_TABLA = [
  { clave: "corto", nombre: "Corto plazo", re: /corto plazo/i },
  { clave: "mediano", nombre: "Mediano plazo", re: /mediano plazo|medio plazo/i },
  { clave: "largo", nombre: "Largo plazo", re: /largo plazo/i },
] as const;
export const TABLAS_POR_HORIZONTE: { fila: number; codigo: string; pide: string; pregunta: number }[] = [
  { fila: 95, codigo: "NIIF S2 16(c)(i)(ii)", pide: "cómo se espera que cambie la situación financiera", pregunta: 94 },
  { fila: 97, codigo: "NIIF S2 16(d)", pide: "el efecto previsto sobre el rendimiento financiero (margen, ingresos, gastos y resultados)", pregunta: 96 },
  { fila: 99, codigo: "NIIF S2 16(d)", pide: "el efecto previsto sobre los flujos de efectivo (los importes que los hechos dan como ahorro o gasto esperado)", pregunta: 98 },
  { fila: 111, codigo: "NIIF S2 22(a)(iii)", pide: "la capacidad de la Compañía para ajustar o adaptar su estrategia y modelo de negocio", pregunta: 110 },
];
/**
 * Plazos que la emisora declaró en NIIF S2 10(d) («Corto plazo: Hasta 1 año», «Mediano plazo: Más de 1 año y hasta 5
 * años», «Largo plazo: Más de 5 años»): el máximo en años del corto y del mediano. Sin los tres, null (regla de Esteban
 * antes de la Fase 4: sin plazos declarados, la tabla queda vacía).
 */
export function plazosDeclarados(enunciados: string[]): { corto: number; mediano: number } | null {
  const de = (n: string) => enunciados.map((e) => e.trim()).find((e) => new RegExp(`^${n} plazo:`, "i").test(e))?.split(/Justificaci/i)[0] ?? null;
  const [c, m, l] = [de("Corto"), de("Mediano"), de("Largo")];
  if (!c || !m || !l) return null;
  const anios = (t: string) => [...t.matchAll(/(\d+(?:\.\d+)?)\s*años?/gi)].map((x) => Number(x[1]));
  const [corto, mediano] = [Math.max(...anios(c)), Math.max(...anios(m))];
  return Number.isFinite(corto) && Number.isFinite(mediano) && mediano > corto ? { corto, mediano } : null;
}
/**
 * Plazos en que cae un hecho: los que nombra («mediano plazo») y, si está fechado, los de cada año posterior al
 * ejercicio que menciona, según los plazos declarados («hasta 2028» con ejercicio 2025 → 3 años → mediano).
 */
export function horizontesDeHecho(enunciado: string, ejercicio: number, plazos: { corto: number; mediano: number }): Set<"corto" | "mediano" | "largo"> {
  const s = new Set<"corto" | "mediano" | "largo">();
  for (const h of HORIZONTES_TABLA) if (h.re.test(enunciado)) s.add(h.clave);
  for (const m of enunciado.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)) {
    const d = Number(m[1]) - ejercicio;
    if (d > 0) s.add(d <= plazos.corto ? "corto" : d <= plazos.mediano ? "mediano" : "largo");
  }
  return s;
}
/**
 * Opción A de Esteban (Fase 4): un hecho de las celdas de efectos previstos por tipo (B65(c): filas 360, 383 y 406; K639,
 * K662 y K685) que cae en un plazo entra solo a la tabla del inciso que nombra, en su texto o en su clave: situación
 * financiera → 95 (16(c)), resultados o rendimiento → 97, flujos de efectivo → 99. Si no nombra ninguno, no entra.
 */
const FILAS_EFECTOS_PREVISTOS = [360, 383, 406];
const RUTA_A_TABLA: { fila: number; re: RegExp }[] = [
  { fila: 95, re: /situaci[oó]n[ _]financiera/i },
  { fila: 97, re: /(?<!\p{L})(resultados?|rendimiento)(?!\p{L})/iu },
  { fila: 99, re: /flujos?[ _]de[ _]efectivo/i },
];
export const tablaDeEfectoPrevisto = (texto: string): number | null => {
  const t = RUTA_A_TABLA.filter((r) => r.re.test(texto));
  return t.length === 1 ? t[0].fila : null;
};
/** K576 (rama «No» de 36(e)): la razón propia de no usar créditos, con el modelo; dos intentos y, si no, la regla. */
export const CLAVE_RAZON_36E = "fila:257";
const esClaveDeHorizonte = (codigo: string) => TABLAS_POR_HORIZONTE.some((t) => HORIZONTES_TABLA.some((h) => codigo === `fila:${t.fila}:${h.clave}`));
/** Palabras que afirman un flujo de efectivo; en una celda por efecto, solo si un hecho las sustenta (ajuste 2, K89). */
const FLUJO_RE = /(?<!\p{L})(salidas?|pagos?|pagad[oa]s?|pag[oó]|desembols\p{L}*)(?!\p{L})/iu;
/** La razón de no dar información cuantitativa (NIIF S2 19–21): va en 21(a), no en las síntesis. */
const NO_CUANTIFICA_RE = /no proporciona informaci[oó]n cuantitativa|no cuantific|no son identificables por separado/i;
/** Lo que no es despliegue de capital: importes registrados como gasto, o la aclaración de que algo no se incluye. */
const GASTO_NO_CAPITAL_RE = /registrad[oa]s? como gasto|se registr[oó] como gasto|gastos? de (operaci[oó]n|administraci[oó]n)|primas?|no se incluy|no incluye/i;
/** Dos oraciones que comparten ≥ 70 % de sus palabras (de más de 3 letras): la misma oración parafraseada. */
export function seParecen(a: string, b: string): boolean {
  const palabras = (t: string) => new Set(t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const [x, y] = [palabras(a), palabras(b)];
  const comunes = [...x].filter((w) => y.has(w)).length;
  return Math.min(x.size, y.size) >= 4 && comunes / Math.min(x.size, y.size) >= 0.7;
}
/** Cifras de un texto, sin separadores de miles («12.3», «2000»), para comprobar que salen de los hechos. */
const cifrasDe = (t: string) => new Set((t.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((x) => x.replace(/,/g, "")));

/**
 * `porEfecto` (16(a) por efecto, encargo formato-respuesta-por-inciso, Fase 2): la celda responde un solo efecto del
 * párrafo; no recibe las declaraciones negativas generales (van en la síntesis, fila 84), no cae al respaldo con
 * oraciones del bloque (sin respuesta validada queda vacía) y no se parece a otra celda del mismo párrafo.
 */
export const CONCEPTOS_FORMATO_CON_ENFOQUE: { fila: number; codigo: string; enfoque: string; noRepite?: string; prestadosDe?: number; porEfecto?: boolean; conNegativas?: boolean; sinHechos?: RegExp; distintaDe?: string[]; sinFechados?: boolean; soloHechos?: RegExp }[] = [
  // NIIF S2 29(a)(iii) por inciso (Fase 5): K596 el enfoque, K597 los datos de entrada y supuestos, K599 la razón (solo
  // con un hecho que la dé; si no, vacía y el marcador de §5 en el Excel). K601 (cambios) sale del cuestionario de GEI.
  { fila: 317, codigo: "NIIF S2 29 (a)(iii)", porEfecto: true, enfoque: "el enfoque de medición de las emisiones de GEI: la norma o el protocolo, el enfoque de consolidación y los factores de emisión. Sin los datos de entrada ni los supuestos, que van en la fila 318" },
  // K597 recibe también las declaraciones negativas: una exclusión del inventario (fugas de refrigerantes, HFC) es un
  // supuesto de la medición (Esteban, 29/10; antes la regla de las celdas por efecto la dejaba fuera).
  { fila: 318, codigo: "NIIF S2 29 (a)(iii)", porEfecto: true, conNegativas: true, enfoque: "los datos de entrada y los supuestos de la medición de las emisiones de GEI (cantidades, estimaciones y exclusiones del inventario, con su razón si los hechos la dan). Sin la norma, el enfoque de consolidación ni los factores, que van en la fila 317" },
  { fila: 320, codigo: "NIIF S2 29 (a)(iii)", porEfecto: true, soloHechos: /(?<!\p{L})(porque|raz[oó]n|debido a|eligi[oó]|se eligi[oó]|a fin de|con el fin de)(?!\p{L})/iu, enfoque: "la razón por la que la Compañía eligió su enfoque de medición, sus datos de entrada y sus supuestos, tal como la dan los hechos" },
  // Gobernanza por inciso (Fase 3): K36 sin la remuneración (va en K38/K39); K43 el papel de la gerencia, sin la
  // supervisión del cargo (K47, 6(b)(i)) ni los controles (K52, 6(b)(ii)), que antes parafraseaba.
  { fila: 36, codigo: "NIIF S2 6 (a)(v)", porEfecto: true, sinHechos: /remuneraci[oó]n/i, enfoque: "cómo el órgano de gobierno supervisa el establecimiento de los objetivos relacionados con el clima y el seguimiento de su avance. Sin la remuneración, que va en las filas 38 y 39" },
  { fila: 43, codigo: "NIIF S2 6(b)", porEfecto: true, distintaDe: ["NIIF S2 6(b)(i)", "NIIF S2 6(b)(ii)"], enfoque: "el papel de la gerencia en la gestión de los riesgos y oportunidades relacionados con el clima: qué funciones de dirección los gestionan y de qué se encarga cada una. Sin cómo se supervisa a esos cargos (fila 47, NIIF S2 6(b)(i)) ni los controles y procedimientos (fila 52, NIIF S2 6(b)(ii))" },
  // 16(d) por efecto (Fase 2, ajuste 3 de Esteban): K96 rendimiento previsto, con la razón de no cuantificar (NIIF S2 21);
  // K98 flujos previstos, sin ella. Las tablas por horizonte (97 y 99) van aparte: TABLAS_POR_HORIZONTE.
  // Con plazos declarados en 10(d), la fila de la pregunta lleva solo lo que no está fechado en un plazo (`sinFechados`);
  // lo fechado va en su tabla por plazo (95, 97, 99, 111), sin repetirse (regla de Esteban antes de la Fase 4).
  { fila: 94, codigo: "NIIF S2 16(c)(i)(ii)", porEfecto: true, conNegativas: true, sinFechados: true, enfoque: "cómo se espera que cambie la situación financiera y con qué fuentes de financiación, con lo que no está fechado en un plazo; lo de cada plazo va en la tabla de la fila 95" },
  { fila: 96, codigo: "NIIF S2 16(d)", porEfecto: true, conNegativas: true, sinFechados: true, enfoque: "los efectos previstos sobre el rendimiento financiero (margen, ingresos, gastos y resultados) que no están fechados en un plazo, y la razón por la que la Compañía no da información cuantitativa adicional si los hechos la dan; lo de cada plazo va en la tabla de la fila 97" },
  { fila: 98, codigo: "NIIF S2 16(d)", porEfecto: true, sinFechados: true, enfoque: "los efectos previstos sobre los flujos de efectivo que no están fechados en un plazo, sin inferir flujos que los hechos no dan. Sin el efecto sobre el margen ni la razón de no cuantificar, que van en la fila 96; lo de cada plazo va en la tabla de la fila 99" },
  { fila: 110, codigo: "NIIF S2 22(a)(iii)", porEfecto: true, conNegativas: true, sinFechados: true, enfoque: "la capacidad de la Compañía para ajustar o adaptar su estrategia y modelo de negocio, con lo que no está fechado en un plazo; lo de cada plazo va en la tabla de la fila 111" },
  // Encargo 2026-10-24-deuda-s2-formato, decisiones (b) y (c): síntesis que no repiten la fila que da el detalle.
  // Encargo formato-respuesta-por-inciso, Fase 2: 16(a) por efecto (K85 situación, K87 rendimiento, K89 flujos), con
  // los hechos del párrafo repartidos; ninguna repite una oración de otra del párrafo (ni de la síntesis K84).
  { fila: 85, codigo: "NIIF S2 16(a)", porEfecto: true, enfoque: "los efectos sobre la situación financiera (activos, pasivos y patrimonio) durante el periodo: qué importes se capitalizaron o reconocieron en el balance y en qué partida. Sin los importes registrados como gasto, que van en la fila 87, y sin la declaración general de que no hubo ajustes, que va en la fila 84" },
  { fila: 87, codigo: "NIIF S2 16(a)", porEfecto: true, enfoque: "los efectos sobre el rendimiento financiero (ingresos, gastos y resultados) durante el periodo: qué importes se registraron como gasto o ingreso y en qué rubro. Sin los importes capitalizados, que van en la fila 85, y sin la declaración general de que no hubo ajustes, que va en la fila 84" },
  // Ajuste 2 de Esteban (Fase 2): sin inferir flujos; la forma es «Los importes del periodo relacionados con … fueron …;
  // la Compañía no identificó otros efectos en sus flujos de efectivo».
  { fila: 89, codigo: "NIIF S2 16(a)", porEfecto: true, enfoque: "los efectos sobre los flujos de efectivo durante el periodo, con esta forma: «Los importes del periodo relacionados con [lo que dan los hechos] fueron [importes]; la Compañía no identificó otros efectos en sus flujos de efectivo.» No los llames salidas, pagos ni desembolsos si los hechos no lo dicen; sin repetir en qué partida se reconocieron (eso va en las filas 85 y 87) y sin la declaración general de que no hubo ajustes, que va en la fila 84" },
  { fila: 84, codigo: "NIIF S2 16(a)", noRepite: "NIIF S2 16(a)", enfoque: "una síntesis de los efectos financieros actuales: si hubo efectos que reconocer y dónde, sin el detalle de importes por partida, que va en la fila 85" },
  { fila: 64, codigo: "NIIF S2 14 (a)(i)a(v)", noRepite: "NIIF S2 14 (a)(i)a(v)", enfoque: "una síntesis de cómo la estrategia y la toma de decisiones responden a los riesgos y oportunidades relacionados con el clima, sin el detalle de cambios, esfuerzos y planes, que va en la fila 65" },
  ...CONCEPTOS_B65C,
];
const FILAS_CON_ENFOQUE = new Set(CONCEPTOS_FORMATO_CON_ENFOQUE.map((c) => c.fila));

/**
 * Hechos que un código PADRE suma a los de sus incisos, por clave, de los libros del documento (uno por clave,
 * del libro de su bloque primero). Mecanismo general, no solo del demo: el libro arma `cadena_valor.*` desde el
 * Perfil para cualquier emisora (decisión (e) del encargo deuda-s2-formato).
 */
export const HECHOS_DEL_PADRE: Record<string, RegExp[]> = {
  // Sin `modelo_negocio.*`: sus subclaves las extrae el modelo del texto libre del Perfil y mezclan cambios al modelo
  // (respuesta, NIIF S2 14) con efectos (13); los de 13 ya llegan por los incisos (K59, revisión del 25/10).
  "NIIF S2 13 (a)a(b)": [/^cadena_valor\./],
};

/**
 * Conceptos de texto del formato con bloque dueño y sin datapoint en el catálogo
 * (declaración de cumplimiento, juicios, S2 13, S2 22…): se responden desde su
 * bloque con la clave `fila:N`, solo para el formato (revisión externa, punto 4).
 */
export const CONCEPTOS_FORMATO_SIN_DATAPOINT: { fila: number; bloque: number; parrafos: string[] }[] = CONCEPTOS.filter(
  (c) => c.clasificacion === "concepto" && !c.datapoint && c.bloque != null && /^text|\(sin tipo\)/.test(c.tipo ?? "(sin tipo)") && !FILAS_CON_ENFOQUE.has(c.fila!)
).map((c) => ({ fila: c.fila!, bloque: c.bloque!, parrafos: c.parrafos ?? [] }));

/**
 * Requisitos dados de alta en el catálogo DESPUÉS de aprobarse un documento
 * (encargo 2026-10-24-deuda-s2-formato): la cobertura aprobada de su bloque no
 * los trae, así que se responden con los hechos vigentes de los libros del
 * documento cuya clave coincide (uno por clave, del libro del bloque dueño si lo
 * tiene), sin regenerar el documento. En un documento generado después del
 * alta, la cobertura del bloque manda y esto no se usa. No se usa con
 * documentos de clientes (registro del encargo).
 */
export const HECHOS_POR_CLAVE: Record<string, RegExp[]> = {
  // La razón de que no haya cifras: emisora.compromiso_transparencia_limitaciones (decisión de Esteban, Fase 3).
  "NIIF S2 21(a)": [/^riesgos_transicion\.efectos_registrados_2025$/, /^efectos_financieros\./, HECHO_RAZON["NIIF S2 21(a)"].clave],
};

/**
 * Alta posterior a la aprobación, por CONTENIDO: los hechos vigentes del bloque dueño cuyo enunciado trata lo que pide
 * el requisito. Las claves cambian de un libro a otro; el contenido no. B65(e), conexiones con los estados financieros
 * (Fase 3 del encargo formato-afirmaciones-y-voz): dónde se registraron los efectos (capitalización, gasto), los
 * ajustes reconocidos o no y la estimación sujeta a ajuste material.
 */
export const HECHOS_POR_ENUNCIADO: Record<string, RegExp> = {
  "NIIF S2 B65 inciso (e)": /capitaliz|registr\w* como gasto|gasto de operaci|estimaci[oó]n preventiva|importes? (?:en libros|de los estados financieros)|reconocer ajustes/i,
};

// HECHO_RAZON (la razón de un requisito que está en un hecho concreto) vive en hechos/razones.ts: la misma
// ruta la usa el generador del bloque. La descripción la pide y el validador rechaza la respuesta que no cita
// ese hecho; DEGRADA si el hecho no está entre los del requisito.
export { HECHO_RAZON };

/** NIIF S1 (sin espacios) → código NIIF S2 del catálogo que lo responde en el formato. */
export const PAR_S2_DE_S1: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const c of CONCEPTOS) {
    if (!c.alivioE5 || !c.datapoint?.startsWith("NIIF S2")) continue;
    for (const p of c.parrafos ?? []) if (/^NIIF S1/.test(p) && !m.has(sinCodigoNorma(p))) m.set(sinCodigoNorma(p), c.datapoint);
  }
  // Pares que el mapeo no da (sus filas del Formato son tabla o fila combinada sin alivio E5): S1 30(a)y(b) se
  // responde con la tabla de S2 10(a)–(c), S1 40(a) con S2 21(a) y las métricas de S1 46–50 con las de S2 29
  // (decisión de Esteban y revisión externa v5, Fase 5). S1 33(c) remite a S2 6(a)(iv), las compensaciones que
  // considera el órgano de gobernanza (revisión externa v5.1).
  for (const [s1, s2] of [["NIIF S1 30(a)y(b)", "NIIF S2 10(a), (b)y(c)"], ["NIIF S1 40(a)", "NIIF S2 21(a)"], ["NIIF S1 46 a 50", "NIIF S2 29"], ["NIIF S1 33(c)", "NIIF S2 6 (a)(iv)"]]) {
    if (!m.has(sinCodigoNorma(s1))) m.set(sinCodigoNorma(s1), s2);
  }
  return m;
})();

// -----------------------------------------------------------------------------
// Validadores (exportados para la prueba)
// -----------------------------------------------------------------------------
const NIEGA = /(?<!\p{L})(?:no|ningun[oa]?|ningún|nul[oa]s?|sin|tampoco|ni|nunca)(?!\p{L})/iu;

/**
 * Voz: las respuestas van en TERCERA persona («la Compañía»). Formas de primera del plural que se rechazan
 * (decisión de Esteban, encargo deuda-s2-formato): pronombres y posesivos, futuro («iremos», «reportaremos»),
 * «nos» + verbo y los auxiliares frecuentes. No toca palabras como «extremos» o «mínimos».
 */
const PRIMERA_PLURAL = /(?<!\p{L})(?:nosotr[oa]s|nuestr[oa]s?|hemos|somos|estamos|tenemos|podemos|debemos|vamos|seguimos|contamos|buscamos|\p{L}*(?:aremos|eremos|iremos)|nos\s+\p{L}+(?:amos|emos|imos))(?!\p{L})/giu;
export function primeraPersonaPlural(texto: string): string[] {
  return [...new Set((texto.match(PRIMERA_PLURAL) ?? []).map((x) => x.toLowerCase()))];
}

export type HechoDeRequisito = { id: string; local: string; tipo: string; enunciado: string; extracto: string; valor: number | null; unidad: string | null };

/**
 * Reglas de forma que no necesitan al modelo; también deciden si una respuesta guardada se puede reutilizar
 * (revisión externa v5, Fase 5):
 *   · una respuesta que no es booleano no abre con «Sí.» ni «No.» (el booleano vecino ya lo dice; K126/K135/K137);
 *   · una celda de B65(c) nombra su tipo de riesgo (K640 decía «riesgos climáticos» en la fila de transición).
 */
export function erroresDeForma(texto: string, codigo: string): string[] {
  const errores: string[] = [];
  const esBooleano = BOOLEANOS_FORMATO.some((b) => `fila:${b.fila}` === codigo);
  if (!esBooleano && /^(Sí|No)\.\s/.test(texto.trim())) errores.push("abre con «Sí.» o «No.»: esta respuesta no es una pregunta de sí o no; empieza por lo que afirma");
  // Voz de la emisora: no habla del material con que se redacta (encargo formato-respuesta-por-inciso, Fase 2, K89).
  if (/(?<!\p{L})los hechos (no |describen|dan |disponibles|del requisito)/iu.test(texto)) errores.push("habla de «los hechos»: la respuesta es la voz de la emisora; di lo que la Compañía revela");
  const b65 = CONCEPTOS_B65C.findIndex((c) => `fila:${c.fila}` === codigo);
  if (b65 >= 0) {
    const tipo = B65C_TIPO_RE[Math.floor(b65 / 5)];
    if (!tipo.re.test(texto)) errores.push(`no nombra el tipo de esta celda (${tipo.nombre}); di «${tipo.nombre}», no «riesgos climáticos» en general`);
  }
  return errores;
}

const MILES = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 4 });
/** Un entero que puede ser un año (un hecho «año base: 2025»): no lleva separador. */
const esAnio = (x: number) => Number.isInteger(x) && x >= 1900 && x <= 2100;
/**
 * Las cifras de los hechos con separador de miles (revisión externa v5, K606: «488000 litros»). Solo las que vienen
 * de un hecho de cifra (valor ≥ 1,000 que no es un año): así no se toca un año, un código de norma ni un párrafo.
 */
export function conSeparadoresDeMiles(texto: string, hechos: { valor: number | null }[]): string {
  let t = texto;
  for (const v of new Set(hechos.map((h) => h.valor).filter((x): x is number => x != null && Math.abs(Number(x)) >= 1000 && !esAnio(Number(x))))) {
    const crudo = String(Number(v));
    t = t.replace(new RegExp(`(?<![\\d.,])${crudo.replace(".", "\\.")}(?![\\d,]|\\.\\d)`, "g"), MILES.format(Number(v)));
  }
  return t;
}

export function validarRespuesta(
  texto: string,
  destino: Destino,
  ctx: { codigo: string; textoBloque: string; hechos: HechoDeRequisito[]; citados: string[] }
): string[] {
  const errores: string[] = [];
  const t = texto.trim();
  if (!t) return ["respuesta vacía"];
  const lim = LIMITES[destino];
  const n = oracionesDe(t).length;
  if (n > lim.oraciones) errores.push(`tiene ${n} oraciones; el máximo para ${destino} es ${lim.oraciones}`);
  if (lim.caracteres && t.length > lim.caracteres) errores.push(`tiene ${t.length} caracteres; el máximo para ${destino} es ${lim.caracteres}`);
  if (/\[Pendiente/i.test(t)) errores.push("lleva un marcador [Pendiente: …]; el documento está aprobado y el requisito tiene hechos");
  const nos = primeraPersonaPlural(t);
  if (nos.length) errores.push(`está en primera persona del plural (${nos.join(", ")}); va en tercera persona, como «la Compañía»`);
  const prohibidas = vocabularioProhibidoEn(t);
  if (prohibidas.length) errores.push(`usa vocabulario de proceso interno: ${prohibidas.join(", ")}`);
  const permitidos = numerosDe([ctx.textoBloque, ctx.codigo, ...ctx.hechos.flatMap((h) => [h.enunciado, h.extracto, h.valor != null ? String(h.valor) : ""])].join("\n"));
  const fuera = numerosDe(t).filter((x) => !permitidos.some((p) => Math.abs(p - x) <= Math.abs(x) * 1e-9 + 1e-9));
  if (fuera.length) errores.push(`cifras que no están en la sección ni en los hechos: ${fuera.join(", ")}`);
  const locales = new Set(ctx.hechos.map((h) => h.local));
  const ajenos = ctx.citados.filter((c) => !locales.has(c));
  if (ajenos.length) errores.push(`cita hechos que no se entregaron para este requisito: ${ajenos.join(", ")}`);
  if (ctx.hechos.length && !ctx.citados.length) errores.push("no cita ningún hecho");
  // La negación del hecho se detecta con NEGACION en la fuente; en la respuesta
  // el modelo la parafrasea («no identificó», «sin efectos»), así que basta una
  // marca de negación del español.
  if (ctx.hechos.some((h) => h.tipo === "declaracion_negativa") && !NEGACION.test(t) && !NIEGA.test(t)) {
    errores.push("omite la declaración negativa del requisito (la emisora declara una ausencia que el requisito pide)");
  }
  return errores;
}

/** Oraciones del bloque aprobado ancladas a los hechos del requisito (respaldo sin modelo). */
export function oracionesAncladas(anclas: Ancla[], hechos: string[], max: number): string {
  const ids = new Set(hechos);
  const out: string[] = [];
  for (const a of anclas) {
    if (out.length >= max) break;
    if (a.hechos.some((h) => h.hecho && ids.has(h.hecho)) && !out.includes(a.oracion)) out.push(a.oracion);
  }
  return out.join(" ");
}

/**
 * «1,240 tCO2e (ejercicio 2025).» Sin decir de dónde salió la cifra (glosario de CLAUDE.md §5). Con perímetro
 * declarado, dentro de la respuesta: «…(ejercicio 2025); perímetro: …».
 */
export function respuestaDeCaptura(valor: number, unidad: string | null, periodo: string | number, perimetro?: string | null): string {
  const v = valor.toLocaleString("en-US", { maximumFractionDigits: 3 });
  return `${conPerimetro(`${v}${unidad ? ` ${unidad}` : ""} (ejercicio ${periodo})`, perimetro)}.`;
}

/**
 * «Ver sección N · título», con N la numeración consecutiva del Word
 * (especificación 0.41): `numeracion` sale de numeracionConsecutiva sobre los
 * bloques que van en el documento. Sin ella, el número del bloque.
 */
export const remision = (numero: number, numeracion?: Map<number, number>) => {
  const b = BLOQUES.find((x) => x.numero === numero);
  return b ? `Ver sección ${numeracion?.get(numero) ?? numero} · ${b.titulo}` : null;
};

/** El texto sin la remisión que añade el código (para reutilizarlo con la numeración vigente). */
export const sinRemision = (t: string) => t.replace(/\s*Ver sección \d+ · [^.]*\.?\s*$/u, "").trim();

/**
 * Una respuesta como va en un Excel exportado (CLAUDE.md §5, 1.10): la base
 * guarda `[Pendiente: … — …]`; el Excel de taxonomía lo escribe en texto plano.
 * Ninguna celda exportada empieza con «[».
 */
export function pendienteEnTextoPlano(texto: string): string {
  // Un código de lista del formato («[815200] Finanzas - …») es el valor literal de la opción y conserva su «[»
  // (decisión de Esteban); el validador de entrega lo acepta solo si coincide con una opción del formato.
  return texto.replace(/\[Pendiente:\s*([^\]]*)\]/g, "Pendiente: $1").replace(/^\[+(?!\d{6}\])\s*/, "").trim();
}

/** Para el Formato electrónico: un pendiente deja la celda vacía. */
export function paraFormatoElectronico(estado: EstadoRespuesta, texto: string | null): string | null {
  return estado === "pendiente" || !texto ? null : pendienteEnTextoPlano(texto);
}

/**
 * «No aplica · E5»: la oración del alivio y, si hay par de NIIF S2, a cuál remite. Texto aprobado por Esteban
 * el 24/10/2026 (encargo deuda-s2-formato): sin vocabulario de plataforma (§5).
 */
export function textoNoAplicaE5(parS2: string | null): string {
  return parS2 ? `${ORACION_E5} ${textoAlivio("E5", "requisito", parS2)}` : textoAlivio("E5", "requisito");
}

// -----------------------------------------------------------------------------
// Insumos del documento aprobado
// -----------------------------------------------------------------------------
type Cobertura = { codigo: string; estado: string; bloque: number | null; hechos: string[]; comentario?: string };
type Ancla = { oracion: string; hechos: { id: string; hecho: string | null }[] };
type VersionAprobada = { numero: number; version: number; texto: string; cobertura: Cobertura[]; anclas: Ancla[]; libro_id: string | null };
type HechoLibro = { id: string; clave: string; libro_id: string; tipo: string; enunciado: string; extracto: string; valor: number | null; unidad: string | null; estado: string; bloque_dueno: number | null; bloques_referencia: number[] | null };
type Previa = {
  documento_id: string;
  destino: Destino; clave: string; texto: string | null; bloque: number | null; bloque_version: number | null; prompt_version: string | null;
  hechos: string[]; notas: string[]; costo_usd: number; tokens_entrada: number; tokens_cache_escritura: number; tokens_cache_lectura: number; tokens_salida: number;
};

type Plan =
  | { codigo: string; via: "regla"; estado: "no_aplica" | "pendiente" | "respuesta"; texto: string; notas?: string[] }
  | { codigo: string; via: "captura"; texto: string; valor: Record<string, unknown> }
  | { codigo: string; via: "bloque"; bloque: number; hechos: string[] };

export type ResultadoRespuestas = { filas: FilaRespuesta[]; costo: number; uso: Uso; porOrigen: Record<string, number>; porEstado: Record<string, number> };

/**
 * Arma las respuestas de un documento APROBADO sin escribir nada. `db` lee con
 * la sesión de quien la llama (staff); la escritura la hace guardarRespuestas.
 */
export async function generarRespuestas(db: Db, documentoId: string, opciones: { apiKey?: string; latido?: () => Promise<boolean> } = {}): Promise<ResultadoRespuestas> {
  const { data: doc } = await db
    .from("documentos_generados")
    .select("id, tenant_id, reporte_id, version, estado, alivios, regimen, versiones_aprobadas")
    .eq("id", documentoId)
    .maybeSingle();
  if (!doc) throw new Error("El documento no existe o no es visible.");
  if (doc.estado !== "aprobado") throw new Error("Las respuestas solo se generan desde un documento aprobado.");
  const aprobadas = (doc.versiones_aprobadas ?? {}) as Record<string, { id: string; version: number }>;
  const ids = Object.values(aprobadas).map((v) => v.id);

  const [{ data: versiones }, { data: previas }, { data: catalogo }, { data: perfil }, { data: enlaces }] = await Promise.all([
    db.from("documentos_bloques_versiones").select("id, numero, version, texto, respaldo, libro_id").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    // REGENERACIÓN POR CAMBIO DE BLOQUE (Paso 5): las respuestas del modelo de
    // este documento o del último aprobado del reporte se reutilizan (sin llamada)
    // si su bloque tiene el MISMO texto aprobado y la misma versión de prompt;
    // solo cambia lo que el código añade, como la remisión. Al reaprobar con un
    // bloque cambiado, solo se regeneran las respuestas de ese bloque.
    db.from("respuestas_datapoint").select("documento_id, destino, clave, origen, texto, bloque, bloque_version, prompt_version, hechos, notas, costo_usd, tokens_entrada, tokens_cache_escritura, tokens_cache_lectura, tokens_salida").eq("reporte_id", doc.reporte_id).eq("origen", "modelo"),
    db.from("datapoints_taxonomia").select("id, codigo, descripcion").eq("activo", true),
    db.from("perfil_emisor").select("glosario").eq("tenant_id", doc.tenant_id).maybeSingle(),
    db.from("mapeo_solicitud_datapoint").select("datapoint_id, solicitud:solicitudes!inner(id, reporte_id, titulo)").eq("solicitud.reporte_id", doc.reporte_id),
  ]);

  const porBloque = new Map<number, VersionAprobada>();
  for (const v of versiones ?? []) {
    const r = (v.respaldo ?? {}) as { cobertura?: Cobertura[]; anclas?: Ancla[] };
    porBloque.set(v.numero, { numero: v.numero, version: v.version, texto: v.texto, cobertura: r.cobertura ?? [], anclas: r.anclas ?? [], libro_id: v.libro_id });
  }
  const numeracion = numeracionConsecutiva(porBloque.keys());
  // Una respuesta previa vale si su bloque tiene hoy el mismo texto aprobado que cuando se generó.
  const deOtros = ((previas ?? []) as Previa[]).filter((p) => p.documento_id !== documentoId && p.bloque != null && p.bloque_version != null);
  const textoPrevio = new Map<string, string>();
  for (const docId of [...new Set(deOtros.map((p) => p.documento_id))]) {
    const { data: vs } = await db.from("documentos_bloques_versiones").select("numero, version, texto").eq("documento_id", docId).in("numero", [...new Set(deOtros.filter((p) => p.documento_id === docId).map((p) => p.bloque!))]);
    for (const x of vs ?? []) textoPrevio.set(`${docId}|${x.numero}|${x.version}`, x.texto);
  }
  const vigente = (p: Previa) => {
    const v = p.bloque != null ? porBloque.get(p.bloque) : null;
    if (!v) return false;
    if (p.documento_id === documentoId) return p.bloque_version === v.version;
    return textoPrevio.get(`${p.documento_id}|${p.bloque}|${p.bloque_version}`) === v.texto;
  };
  // Las del propio documento mandan sobre las del aprobado anterior.
  const previaDe = new Map<string, Previa>();
  for (const p of ((previas ?? []) as Previa[]).filter(vigente).sort((a, b) => Number(a.documento_id === documentoId) - Number(b.documento_id === documentoId))) previaDe.set(`${p.destino}|${p.clave}`, p);
  const libros = [...new Set([...porBloque.values()].map((v) => v.libro_id).filter((x): x is string => !!x))];
  const hechos = new Map<string, HechoLibro>();
  for (const l of libros) {
    const { data } = await db.from("hechos").select("id, clave, libro_id, tipo, enunciado, extracto, valor, unidad, estado, bloque_dueno, bloques_referencia").eq("libro_id", l);
    for (const h of data ?? []) hechos.set(h.id, h as HechoLibro);
  }
  const glosario: EntradaGlosario[] = leerGlosario(perfil?.glosario);
  const alivios: Alivios = doc.regimen === "primer_anio" ? leerAlivios(doc.alivios) : {};
  const exentos = datapointsExentos(alivios);
  // Capturas y «no aplica» heredado: la misma resolución del Excel y del
  // generador (ensamblador), con la misma construcción que generar-bloque.
  const ens = await ensamblarReporte(db, doc.reporte_id);
  if (!ens.ok) throw new Error(`No se pudo ensamblar el reporte (${ens.causa}).`);
  const heredados = noAplicaHeredado({
    brutoNeto: ens.objetivos
      .filter((o) => o.ambito === "climatico" && /emisi|gei|co2/i.test(`${o.tipo_objetivo ?? ""} ${o.metrica ?? ""} ${o.nombre}`))
      .map((o) => ens.detallePorObjetivo.get(o.id)?.bruto_neto ?? null),
    respuestasCreditos: ens.cuestionarios
      .filter((q) => q.hoja === "S2 36(e)")
      .sort((a, b) => a.pregunta_orden - b.pregunta_orden)
      .map((q) => q.respuesta),
  });
  const solsPorDatapoint = new Map<string, { id: string; titulo: string }[]>();
  for (const e of (enlaces ?? []) as unknown as { datapoint_id: string; solicitud: { id: string; titulo: string } }[]) {
    solsPorDatapoint.set(e.datapoint_id, [...(solsPorDatapoint.get(e.datapoint_id) ?? []), e.solicitud]);
  }

  const codigos = ((catalogo ?? []) as { id: string; codigo: string; descripcion: string }[]).filter((c) => c.codigo.startsWith("NIIF"));
  const descripcion = new Map(codigos.map((c) => [c.codigo, c.descripcion]));
  const hijosDe = new Map<string, string[]>();
  for (const [hijo, padre] of Object.entries(PADRE_DE)) hijosDe.set(padre, [...(hijosDe.get(padre) ?? []), hijo]);

  /** La cobertura del código en el documento: bloque que lo responde y sus hechos (sigue los «asignado»). */
  const coberturaDe = (codigo: string): { bloque: number; estado: string; hechos: string[] } | null => {
    for (const b of BLOQUES.filter((x) => x.datapoints.includes(codigo))) {
      const v = porBloque.get(b.numero);
      if (!v) continue;
      const c = v.cobertura.find((x) => x.codigo === codigo);
      if (c?.estado === "asignado" && c.bloque != null) {
        const destino = porBloque.get(c.bloque)?.cobertura.find((x) => x.codigo === codigo);
        if (destino) return { bloque: c.bloque, estado: destino.estado, hechos: destino.hechos };
      }
      if (c) return { bloque: b.numero, estado: c.estado, hechos: c.hechos };
      return { bloque: b.numero, estado: "sin_cobertura", hechos: [] };
    }
    return null;
  };

  /** Hechos vigentes de los libros del documento cuya clave coincide: uno por clave, del libro indicado primero. */
  const hechosPorClave = (claves: RegExp[], libro: string | null | undefined): string[] => {
    if (!claves.length) return [];
    const unoPorClave = new Map<string, HechoLibro>();
    const candidatos = [...hechos.values()]
      .filter((x) => x.estado === "vigente" && claves.some((re) => re.test(x.clave)))
      .sort((a, b) => Number(b.libro_id === libro) - Number(a.libro_id === libro));
    for (const x of candidatos) if (!unoPorClave.has(x.clave)) unoPorClave.set(x.clave, x);
    return [...unoPorClave.values()].map((x) => x.id);
  };

  const planDe = (codigo: string): Plan => {
    // NIIF S1 72: la declaración de cumplimiento real (Fase 3; nunca «No aplica»): la del bloque 2 aprobado, con el
    // alcance del E5 y el E4 si están vigentes. Sin declaración en el bloque 2, pendiente.
    if (codigo === "NIIF S1 72") {
      const decl = declaracionDeCumplimiento(porBloque.get(2)?.texto ?? null);
      if (!decl) return { codigo, via: "regla", estado: "pendiente", texto: "[Pendiente: declaración explícita y sin reservas de cumplimiento con NIIF S1 y NIIF S2 — sección Declaración de cumplimiento]" };
      return { codigo, via: "regla", estado: "respuesta", texto: [decl, alivios.E5 ? ALCANCE_E5 : null, alivios.E4 ? (alivios.E5 ? E4_EN_DECLARACION : ORACION_E4) : null].filter(Boolean).join(" ") };
    }
    // Alcance 3 aplica y se difiere: «No revelado · alivio C4», como el Formato (revisión externa v5).
    if (exentos.has(codigo)) return { codigo, via: "regla", estado: "no_aplica", texto: textoAlivio("C4", "requisito") };
    // 36(e) por inciso: la respuesta de texto que la emisora capturó en el cuestionario, la misma que su hoja del Excel
    // (revisión externa v5: la fila 276 decía «No aplica» y su hoja respondía); sin respuesta, el «No aplica» heredado.
    const delCuestionario = respuestaDeCuestionario36e(codigo, ens.cuestionarios);
    if (delCuestionario) return { codigo, via: "regla", estado: "respuesta", texto: delCuestionario, notas: [NOTA_CUESTIONARIO_36E] };
    const h = heredados.get(codigo);
    if (h?.estado === "no_aplica") return { codigo, via: "regla", estado: "no_aplica", texto: textoNoAplicaHeredado(codigo), notas: [h.motivo] };
    const hijos = hijosDe.get(codigo);
    if (hijos) {
      const planes = hijos.map(planDe);
      // 36(e) en un solo estado (decisión de Esteban, encargo formato-respuesta-por-inciso): si algún inciso responde
      // desde el cuestionario, el padre remite a sus incisos; «No aplica» solo si ninguno responde.
      const noAplica = (p: Plan) => p.via === "regla" && p.estado === "no_aplica";
      const delCuest = (p: Plan) => p.via === "regla" && !!p.notas?.includes(NOTA_CUESTIONARIO_36E);
      if (planes.every((p) => noAplica(p) || delCuest(p)) && planes.some(delCuest)) {
        return { codigo, via: "regla", estado: "respuesta", texto: remisionAIncisos(hijos) };
      }
      if (planes.every(noAplica)) {
        return { codigo, via: "regla", estado: "no_aplica", texto: (planes.find(noAplica) as { texto: string }).texto };
      }
      const conBloque = planes.filter((p): p is Extract<Plan, { via: "bloque" }> => p.via === "bloque");
      if (conBloque.length) {
        const bloque = conBloque[0].bloque;
        // La razón de no cuantificar va solo en NIIF S2 21(a) (K100), no en la síntesis de 16(b)–(d) (K91; Fase 6).
        const sinRazon = (id: string) => !(codigo === "NIIF S2 16 (b)a(d)" && NO_CUANTIFICA_RE.test(hechos.get(id)?.enunciado ?? ""));
        return { codigo, via: "bloque", bloque, hechos: [...new Set([...conBloque.flatMap((p) => p.hechos), ...hechosPorClave(HECHOS_DEL_PADRE[codigo] ?? [], porBloque.get(bloque)?.libro_id)])].filter(sinRazon) };
      }
    }
    const cob = coberturaDe(codigo);
    if (cob && cob.estado === "no_aplica") {
      return { codigo, via: "regla", estado: "no_aplica", texto: textoNoAplicaHeredado(codigo), notas: h?.motivo ? [h.motivo] : [] };
    }
    if (cob && (cob.estado === "cubierto" || cob.estado === "parcial") && cob.hechos.length) {
      return { codigo, via: "bloque", bloque: cob.bloque, hechos: cob.hechos };
    }
    // Alta posterior a la aprobación: los hechos vigentes del libro del bloque dueño, por clave.
    if (cob?.estado === "sin_cobertura" && HECHOS_POR_CLAVE[codigo]) {
      const porClave = hechosPorClave(HECHOS_POR_CLAVE[codigo], porBloque.get(cob.bloque)?.libro_id);
      if (porClave.length) return { codigo, via: "bloque", bloque: cob.bloque, hechos: porClave };
    }
    // …o por contenido, entre los hechos del bloque dueño.
    if (cob?.estado === "sin_cobertura" && HECHOS_POR_ENUNCIADO[codigo]) {
      const libro = porBloque.get(cob.bloque)?.libro_id;
      const porEnunciado = [...hechos.values()]
        .filter((x) => x.estado === "vigente" && x.libro_id === libro && x.bloque_dueno === cob.bloque && HECHOS_POR_ENUNCIADO[codigo].test(x.enunciado))
        .map((x) => x.id);
      if (porEnunciado.length) return { codigo, via: "bloque", bloque: cob.bloque, hechos: porEnunciado };
    }
    if (cob) {
      const b = BLOQUES.find((x) => x.numero === cob.bloque);
      return { codigo, via: "regla", estado: "pendiente", texto: marcador(`respuesta del requisito ${codigo} en la sección aprobada`, `sección ${cob.bloque} · ${b?.titulo ?? ""}`) };
    }
    const sinBloque = !BLOQUES.some((x) => x.datapoints.includes(codigo));
    if (sinBloque && codigo.startsWith("NIIF S1") && alivios.E5) {
      const par = PAR_S2_DE_S1.get(sinCodigoNorma(codigo));
      return { codigo, via: "regla", estado: "no_aplica", texto: textoNoAplicaE5(par ?? null) };
    }
    const catId = codigos.find((c) => c.codigo === codigo)?.id;
    const sols = catId ? solsPorDatapoint.get(catId) ?? [] : [];
    for (const s of sols) {
      const e = ens.entregaPorSolicitud.get(s.id);
      const sol = ens.solicitudes.find((x) => x.id === s.id);
      if (e?.estado === "entregado" && e.valor != null && sol?.es_cuantitativa) {
        return {
          codigo,
          via: "captura",
          texto: respuestaDeCaptura(e.valor, sol.unidad_esperada, ens.reporte.ejercicio, sol.nota_alcance),
          valor: { valor: e.valor, unidad: sol.unidad_esperada, periodo: ens.reporte.ejercicio, solicitud: sol.titulo },
        };
      }
    }
    if (h?.estado === "pendiente") return { codigo, via: "regla", estado: "pendiente", texto: `[Pendiente: ${h.motivo}]` };
    return {
      codigo,
      via: "regla",
      estado: "pendiente",
      texto: sols.length
        ? marcador(`captura confirmada o sección del suplemento que responda ${codigo}`, `solicitud ${sols[0].titulo}`)
        : marcador(`información que responda ${codigo}`, "sin solicitud en el reporte ni sección del suplemento"),
    };
  };

  const planes = codigos.map((c) => planDe(c.codigo));
  // Códigos padre: síntesis propia del párrafo, sin copiar a sus incisos (el validador lo exige).
  for (const p of planes) {
    const hijos = hijosDe.get(p.codigo);
    if (!hijos || p.via !== "bloque") continue;
    const extra = HECHOS_DEL_PADRE[p.codigo] ? " Incluye también lo que dicen los hechos de la cadena de valor. No describe acciones de respuesta (cambios al modelo de negocio, límites, recursos o planes), que van en NIIF S2 14." : "";
    descripcion.set(p.codigo, `${descripcion.get(p.codigo)} Es el código que agrupa ${hijos.join(", ")}: da una síntesis propia del párrafo completo, sin copiar oraciones de las respuestas de esos incisos, que van en otras filas.${extra}`);
  }
  // HECHO_RAZON: la descripción pide la razón solo si su hecho está entre los del requisito.
  for (const p of planes) {
    const razon = HECHO_RAZON[p.codigo];
    if (razon && p.via === "bloque" && p.hechos.some((id) => razon.clave.test(hechos.get(id)?.clave ?? ""))) descripcion.set(p.codigo, `${descripcion.get(p.codigo)} ${razon.pide}`);
  }
  // Plazos declarados en 10(d) y en qué plazo cae cada hecho (filas de pregunta `sinFechados` y tablas por plazo).
  const plazos = plazosDeclarados((coberturaDe("NIIF S2 10(d)")?.hechos ?? []).map((id) => hechos.get(id)?.enunciado ?? ""));
  const fechado = (id: string) => !!plazos && horizontesDeHecho(hechos.get(id)?.enunciado ?? "", ens.reporte.ejercicio, plazos).size > 0;
  // Un hecho no fechado va a una sola fila de pregunta `sinFechados` del mismo código: la primera (K98 repetía en otras
  // palabras el escenario de altas emisiones de K96).
  const yaAsignados = new Map<string, Set<string>>();
  // Conceptos con enfoque propio (97/99): los hechos de la cobertura de su datapoint, redactados con su enfoque.
  for (const c of [...CONCEPTOS_FORMATO_CON_ENFOQUE].sort((a, b) => a.fila - b.fila)) {
    // El bloque y los hechos del código: los de su plan (un padre los reúne de sus incisos) o los de su cobertura.
    const plan = planes.find((p) => p.codigo === c.codigo);
    const cob = plan?.via === "bloque" ? { bloque: plan.bloque, hechos: plan.hechos, estado: "cubierto" } : coberturaDe(c.codigo);
    // B65(c): más los hechos del bloque 10 que remiten al bloque del tipo y sus declaraciones negativas generales
    // (sin referencias), uno por enunciado.
    // Los planes de disposición de activos siguen otra regla (PLAN_DISPOSICION_RE): solo en la celda de efectos
    // previstos y solo del tipo de riesgo que nombran como motivo, con o sin referencia al bloque del tipo.
    const previstos = c.prestadosDe != null && CONCEPTOS_B65C.findIndex((x) => x.fila === c.fila) % 5 === 3;
    const disposicionAqui = (x: HechoLibro) => previstos && tipoDeDisposicion(x.enunciado) === c.prestadosDe;
    const prestados = c.prestadosDe == null ? [] : (() => {
      const vistos = new Set<string>();
      return [...hechos.values()]
        .filter((x) => x.estado === "vigente" && x.bloque_dueno === 10 && x.libro_id === porBloque.get(10)?.libro_id)
        .filter((x) => PLAN_DISPOSICION_RE.test(x.enunciado)
          ? disposicionAqui(x)
          : (x.bloques_referencia ?? []).includes(c.prestadosDe!) || (x.tipo === "declaracion_negativa" && !(x.bloques_referencia ?? []).length))
        .filter((x) => !vistos.has(x.enunciado) && vistos.add(x.enunciado))
        .map((x) => x.id);
    })();
    const propios = c.porEfecto ? (cob?.hechos ?? []).filter((id) => (c.conNegativas || hechos.get(id)?.tipo !== "declaracion_negativa") && !(c.sinHechos && c.sinHechos.test(hechos.get(id)?.enunciado ?? "")) && !(c.soloHechos && !c.soloHechos.test(hechos.get(id)?.enunciado ?? "")) && !(c.sinFechados && (fechado(id) || yaAsignados.get(c.codigo)?.has(id)))) : c.prestadosDe == null || !cob ? cob?.hechos ?? [] : cob.hechos.filter((id) => {
      const x = hechos.get(id);
      return !x || !PLAN_DISPOSICION_RE.test(x.enunciado) || disposicionAqui(x);
    });
    if (!cob || !["cubierto", "parcial"].includes(cob.estado) || !(propios.length + prestados.length)) continue;
    if (c.sinFechados) yaAsignados.set(c.codigo, new Set([...(yaAsignados.get(c.codigo) ?? []), ...propios]));
    const clave = `fila:${c.fila}`;
    const otras = [
      ...CONCEPTOS_FORMATO_CON_ENFOQUE.filter((x) => x.codigo === c.codigo && x.fila !== c.fila && (!x.noRepite || !c.noRepite)).map((x) => `la fila ${x.fila}`),
      ...(c.noRepite ? [`la respuesta de ${c.noRepite}`] : []),
    ];
    descripcion.set(clave, c.prestadosDe != null
      ? `Concepto del Formato electrónico (fila ${c.fila}) de ${c.codigo}: responde SOLO ${c.enfoque}, en una o dos oraciones, y nombra explícitamente ${B65C_EFECTO_RE[CONCEPTOS_B65C.findIndex((x) => x.fila === c.fila) % 5].nombre}. Si los hechos no muestran ese efecto, dilo en una oración breve sobre ese efecto, apoyada en el hecho que lo declara; no repitas la declaración general de que no se identificaron efectos que reconocer, que ya da otra celda del inciso. No compartas ninguna oración con ${otras.join(", ")}, que responden los otros efectos del mismo inciso, ni describas dónde se concentra la exposición. Sin cifras que no estén en los hechos.`
      : c.noRepite
      ? `Concepto del Formato electrónico (fila ${c.fila}) de ${c.codigo}: responde SOLO ${c.enfoque}, en una o dos oraciones. No compartas ninguna oración con ${otras.join(", ")}, que da el detalle en otra fila. Sin cifras que no estén en los hechos.`
      : `Concepto del Formato electrónico (fila ${c.fila}) de ${c.codigo}: responde SOLO ${c.enfoque}, en dos oraciones. No compartas ninguna oración con ${otras.join(", ")}, que responde otro efecto del mismo párrafo: reparte los hechos según el efecto que describen. Sin cifras que no estén en los hechos.`);
    planes.push({ codigo: clave, via: "bloque", bloque: cob.bloque, hechos: [...new Set([...propios, ...prestados])] });
  }
  // 29(e) por tipo: los hechos de despliegue de capital del libro del bloque del tipo, uno por enunciado; sin ninguno,
  // no hay pedido y la celda queda vacía.
  {
    const plan = planes.find((p) => p.codigo === "NIIF S2 29 (e)");
    const cob = plan?.via === "bloque" ? { bloque: plan.bloque } : coberturaDe("NIIF S2 29 (e)");
    for (const c of cob ? CONCEPTOS_29E : []) {
      const libro = porBloque.get(c.bloque)?.libro_id;
      const vistos = new Set<string>();
      const hs = [...hechos.values()]
        .filter((x) => x.estado === "vigente" && x.libro_id === libro && (x.bloque_dueno === c.bloque || (x.bloques_referencia ?? []).includes(c.bloque)))
        .filter((x) => DESPLIEGUE_RE.test(x.enunciado) && !vistos.has(x.enunciado) && vistos.add(x.enunciado))
        .map((x) => x.id);
      if (!libro || !hs.length) continue;
      const clave = `fila:${c.fila}`;
      const otras = CONCEPTOS_29E.filter((x) => x.fila !== c.fila).map((x) => x.tipo.nombre).join(" ni a las ");
      descripcion.set(clave, `Concepto del Formato electrónico (fila ${c.fila}) de NIIF S2 29 (e): responde SOLO el gasto de capital, la financiación o la inversión que la Compañía aplicó en el ejercicio a ${c.de} y que se capitalizó o invirtió, con sus importes, en una oración, y nombra «${c.tipo.nombre}». No incluyas importes registrados como gasto (gasto de operación, primas, mediciones), saldos de cartera de crédito ni deuda emitida, ni lo aplicado a las ${otras}, ni digas lo que no se incluye. Sin cifras que no estén en los hechos. Es una respuesta aparte de la de NIIF S2 29 (e): en el JSON va con «codigo» exactamente «${clave}» y destino «formato».`);
      planes.push({ codigo: clave, via: "bloque", bloque: cob!.bloque, hechos: hs });
    }
  }
  // Tablas por horizonte (95, 97, 99, 111): un pedido por plazo con los hechos del código que caen en él (lo nombran o
  // están fechados en él según los plazos declarados en 10(d)); sin plazos declarados o sin hechos, nada.
  for (const t of plazos ? TABLAS_POR_HORIZONTE : []) {
    const plan = planes.find((p) => p.codigo === t.codigo);
    const cob = plan?.via === "bloque" ? { bloque: plan.bloque, hechos: plan.hechos } : coberturaDe(t.codigo);
    if (!cob) continue;
    // Más los hechos de efectos previstos que la ruta manda a esta tabla (opción A), sin repetir los del código.
    const ruteados = [...new Set(FILAS_EFECTOS_PREVISTOS.flatMap((f) => { const p = planes.find((x) => x.codigo === `fila:${f}`); return p?.via === "bloque" ? p.hechos : []; }))]
      .filter((id) => !(cob.hechos ?? []).includes(id))
      .filter((id) => { const x = hechos.get(id); return !!x && tablaDeEfectoPrevisto(`${x.enunciado} ${x.clave ?? ""}`) === t.fila; });
    for (const h of HORIZONTES_TABLA) {
      const hs = [...(cob.hechos ?? []), ...ruteados].filter((id) => horizontesDeHecho(hechos.get(id)?.enunciado ?? "", ens.reporte.ejercicio, plazos!).has(h.clave));
      if (!hs.length) continue;
      const clave = `fila:${t.fila}:${h.clave}`;
      const otros = HORIZONTES_TABLA.filter((x) => x.clave !== h.clave).map((x) => x.nombre.toLowerCase()).join(" ni del ");
      descripcion.set(clave, `Concepto del Formato electrónico (fila ${t.fila}, ${h.nombre.toLowerCase()}) de ${t.codigo}: responde SOLO ${t.pide} en el ${h.nombre.toLowerCase()} (${h.clave === "corto" ? `hasta ${plazos!.corto} año(s)` : h.clave === "mediano" ? `más de ${plazos!.corto} y hasta ${plazos!.mediano} años` : `más de ${plazos!.mediano} años`} desde el cierre del ejercicio), en una oración, con lo que dicen los hechos de ese plazo. No digas nada del ${otros}; no repitas texto de esos plazos. Es una respuesta aparte: en el JSON va con «codigo» exactamente «${clave}» y destino «formato».`);
      planes.push({ codigo: clave, via: "bloque", bloque: cob.bloque, hechos: hs });
    }
  }
  // K576: la razón de no usar créditos de carbono, desde los hechos del bloque de objetivos que tratan créditos o
  // compensaciones, sin repetir la respuesta de 36(e)(i) (fila 259).
  {
    const cob = coberturaDe("NIIF S2 36 (e)(i)") ?? coberturaDe("NIIF S2 36 (a)");
    const libro = cob ? porBloque.get(cob.bloque)?.libro_id : null;
    const hs = [...hechos.values()].filter((x) => x.estado === "vigente" && x.libro_id === libro && /cr[eé]ditos? de carbono|compensaci/i.test(x.enunciado));
    const vistos = new Set<string>();
    const ids = hs.filter((x) => !vistos.has(x.enunciado) && vistos.add(x.enunciado)).map((x) => x.id);
    if (cob && ids.length) {
      descripcion.set(CLAVE_RAZON_36E, `Pregunta «¿Por qué?» del Formato electrónico (fila 257), rama «No» de «¿Se tiene el uso previsto de los créditos de carbono?»: da en una oración la razón por la que la Compañía no prevé usar créditos de carbono para alcanzar sus objetivos de emisiones. No repitas palabra por palabra los medios que ya enumera la respuesta de NIIF S2 36 (e)(i) (eficiencia energética, generación distribuida, renovación de la flota): dilo en una oración propia, sin «No aplica». Es una respuesta aparte: en el JSON va con «codigo» exactamente «${CLAVE_RAZON_36E}» y destino «formato».`);
      planes.push({ codigo: CLAVE_RAZON_36E, via: "bloque", bloque: cob.bloque, hechos: ids });
    }
  }
  // Booleanos del formato (D1 de Esteban, encargo formato-afirmaciones-y-voz): una respuesta propia por fila que abre
  // con «Sí.» o «No.» y cita el hecho que contesta la pregunta. Recibe solo los hechos del código que tratan el tema
  // de la pregunta: así no se le pide repetir una negación de otro asunto (K592: «no hace uso de C5»). Sin ninguno,
  // no hay respuesta y la celda queda vacía (pendiente).
  for (const b of BOOLEANOS_FORMATO) {
    const plan = planes.find((p) => p.codigo === b.codigo);
    const cob = plan?.via === "bloque" ? { bloque: plan.bloque, hechos: plan.hechos, estado: "cubierto" } : coberturaDe(b.codigo);
    if (!cob || !["cubierto", "parcial"].includes(cob.estado)) continue;
    const delTema = cob.hechos.filter((id) => clausulasDelTema(hechos.get(id)?.enunciado ?? "", b.tema).length);
    if (!delTema.length) continue;
    const clave = `fila:${b.fila}`;
    descripcion.set(clave, `Pregunta de sí o no del Formato electrónico (fila ${b.fila}) de ${b.codigo}: «${b.pregunta}» La respuesta abre con «Sí.» o con «No.», que contesta exactamente esa pregunta según los hechos, y sigue con una o dos oraciones que lo sostienen, citando el hecho que trata de ${b.trata}. No contestes otra pregunta del mismo párrafo. Es una respuesta aparte de la de ${b.codigo}: en el JSON va con «codigo» exactamente «${clave}» y destino «formato».`);
    planes.push({ codigo: clave, via: "bloque", bloque: cob.bloque, hechos: delTema });
  }
  // Conceptos del formato sin datapoint: desde su bloque aprobado, con todos los hechos de su cobertura.
  for (const c of CONCEPTOS_FORMATO_SIN_DATAPOINT) {
    const v = porBloque.get(c.bloque);
    const hs = v ? [...new Set(v.cobertura.flatMap((x) => x.hechos))] : [];
    if (!hs.length) continue;
    const clave = `fila:${c.fila}`;
    const de = codigos.filter((x) => c.parrafos.some((p) => sinCodigoNorma(x.codigo).startsWith(sinCodigoNorma(p)))).map((x) => `${x.codigo}: ${x.descripcion}`);
    descripcion.set(clave, `Concepto del Formato electrónico (fila ${c.fila}), párrafos ${c.parrafos.join(", ")}.${de.length ? ` ${de.join(" ")}` : ""}`);
    planes.push({ codigo: clave, via: "bloque", bloque: c.bloque, hechos: hs });
  }
  const filas: FilaRespuesta[] = [];
  const destinosDe = (codigo: string): Destino[] =>
    codigo.startsWith("fila:") ? ["formato"] : DATAPOINTS_FORMATO_TEXTO.has(codigo) ? ["taxonomia", "formato"] : ["taxonomia"];
  const base = (destino: Destino, clave: string): Omit<FilaRespuesta, "estado" | "origen" | "texto"> => ({
    destino, clave, tipo_campo: destino === "formato" ? "text block" : "text", valor: null, bloque: null, bloque_version: null,
    hechos: [], notas: [], modelo: null, prompt_version: null, uso: USO_CERO, costo_usd: 0,
  });

  for (const p of planes) {
    if (p.via === "bloque") continue;
    for (const d of destinosDe(p.codigo)) {
      if (p.via === "regla") filas.push({ ...base(d, p.codigo), estado: p.estado, origen: "regla", texto: p.texto, notas: p.notas ?? [] });
      else filas.push({ ...base(d, p.codigo), estado: "respuesta", origen: "captura", texto: p.texto, valor: p.valor, tipo_campo: d === "formato" ? "text block" : "valor" });
    }
  }

  // --- Modelo, agrupado por bloque -----------------------------------------------------
  const porBloqueModelo = new Map<number, Extract<Plan, { via: "bloque" }>[]>();
  for (const p of planes) if (p.via === "bloque") porBloqueModelo.set(p.bloque, [...(porBloqueModelo.get(p.bloque) ?? []), p]);
  let uso: Uso = { ...USO_CERO };
  const apiKey = opciones.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const trabajos = [...porBloqueModelo.entries()].map(([numero, ps]) => async () => {
    if (opciones.latido && !(await opciones.latido())) throw new Error("La reserva de las respuestas pasó a otra corrida.");
    const v = porBloque.get(numero)!;
    const r = await responderBloque(v, ps, { hechos, descripcion, glosario, destinosDe, apiKey, numeracion, previaDe });
    uso = sumar(uso, r.uso);
    filas.push(...r.filas);
  });
  await enParalelo(trabajos, 4);

  const costo = costoUsd(MODELO_RESPUESTAS, uso);
  const cuenta = (k: "origen" | "estado") => filas.reduce<Record<string, number>>((a, f) => ((a[`${f.destino}:${f[k]}`] = (a[`${f.destino}:${f[k]}`] ?? 0) + 1), a), {});
  return { filas, costo, uso, porOrigen: cuenta("origen"), porEstado: cuenta("estado") };
}

const sumar = (a: Uso, b: Uso): Uso => ({ entrada: a.entrada + b.entrada, cacheEscritura: a.cacheEscritura + b.cacheEscritura, cacheLectura: a.cacheLectura + b.cacheLectura, salida: a.salida + b.salida });

async function enParalelo(trabajos: (() => Promise<void>)[], n: number): Promise<void> {
  let i = 0;
  const hilo = async () => {
    while (i < trabajos.length) await trabajos[i++]();
  };
  await Promise.all(Array.from({ length: Math.min(n, trabajos.length) }, hilo));
}

// -----------------------------------------------------------------------------
// Una llamada por bloque
// -----------------------------------------------------------------------------
const SISTEMA = `Redactas respuestas breves a requisitos de revelación de las Normas NIIF S1 y S2 para el Excel de taxonomía y el Formato electrónico que presenta una emisora. Cada respuesta resume fielmente lo que ya dice una sección APROBADA del informe de la emisora; no redactas desde cero.

Reglas:
1. Es la voz de la emisora, en tercera persona («la Compañía»), en español formal. Responde exactamente el requisito indicado; no repitas la pregunta ni la cites.
2. Usa solo lo que dicen la sección aprobada y los hechos entregados para ese requisito. Cifras, fechas, porcentajes y nombres, idénticos a como aparecen ahí. No calcules, no redondees, no agregues contexto propio.
3. Longitud: destino «taxonomia», de dos a cuatro oraciones; destino «formato», hasta seis oraciones y no más de 900 caracteres. Si los hechos son pocos, una o dos oraciones bastan.
4. Si entre los hechos del requisito hay uno de tipo declaracion_negativa (la emisora declara una ausencia: «no usa», «ninguna»), la respuesta la incluye con su negación.
5. Prohibido el vocabulario del proceso interno: ${TERMINOS_PLATAFORMA.join(", ")}, «la sección aprobada». No escribas remisiones a otras secciones: el sistema añade la remisión.
6. Nombres de órganos, comités y áreas: los canónicos del glosario de la emisora.
7. En «hechos», los ids (h1, h2…) de los hechos en que se apoya cada respuesta; al menos uno.

Devuelve JSON con una respuesta por cada requisito y destino pedidos.`;

const ESQUEMA = {
  type: "object",
  properties: {
    respuestas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          codigo: { type: "string" },
          destino: { type: "string", enum: ["taxonomia", "formato"] },
          texto: { type: "string" },
          hechos: { type: "array", items: { type: "string" } },
        },
        required: ["codigo", "destino", "texto", "hechos"],
        additionalProperties: false,
      },
    },
  },
  required: ["respuestas"],
  additionalProperties: false,
};

type Pedido = { codigo: string; destino: Destino; hechos: HechoDeRequisito[]; uuids: string[] };
type Salida = { codigo: string; destino: Destino; texto: string; hechos: string[] };

async function responderBloque(
  v: VersionAprobada,
  planes: Extract<Plan, { via: "bloque" }>[],
  ctx: {
    hechos: Map<string, HechoLibro>;
    descripcion: Map<string, string>;
    glosario: EntradaGlosario[];
    destinosDe: (c: string) => Destino[];
    apiKey?: string;
    numeracion?: Map<number, number>;
    previaDe?: Map<string, Previa>;
  }
): Promise<{ filas: FilaRespuesta[]; uso: Uso }> {
  // Ids locales por bloque: h1, h2… en el orden en que aparecen.
  const local = new Map<string, string>();
  const pedidos: Pedido[] = [];
  for (const p of planes) {
    const hs: HechoDeRequisito[] = [];
    for (const id of p.hechos) {
      const h = ctx.hechos.get(id);
      if (!h || h.estado === "descartado") continue;
      if (!local.has(id)) local.set(id, `h${local.size + 1}`);
      hs.push({ id, local: local.get(id)!, tipo: h.tipo, enunciado: h.enunciado, extracto: h.extracto, valor: h.valor, unidad: h.unidad });
    }
    for (const d of ctx.destinosDe(p.codigo)) pedidos.push({ codigo: p.codigo, destino: d, hechos: hs, uuids: hs.map((h) => h.id) });
  }
  const titulo = BLOQUES.find((b) => b.numero === v.numero)?.titulo ?? `Sección ${v.numero}`;
  // Versión de prompt CON FIRMA del pedido (encargo deuda-s2-formato, Fase 3): la descripción del requisito y
  // los hechos que recibe. Una respuesta previa solo se reutiliza si su pedido es el mismo; si cambia la
  // descripción (una síntesis nueva) o los hechos (un padre que suma claves), se genera de nuevo.
  // También el TEXTO de los hechos (encargo formato-afirmaciones-y-voz, Fase 3): si un enunciado cambia (p. ej. el
  // concepto publicable de una cifra), la respuesta que lo citaba se vuelve a pedir.
  const promptDe = (p: Pedido) =>
    `${PROMPT_RESPUESTAS}·${createHash("sha256").update(`${ctx.descripcion.get(p.codigo) ?? ""}|${[...p.uuids].sort().join(",")}|${p.hechos.map((h) => h.enunciado).sort().join("\n")}`).digest("hex").slice(0, 10)}`;
  let uso: Uso = { ...USO_CERO };
  const finales = new Map<string, { texto: string; citados: string[]; origen: OrigenRespuesta; notas: string[] }>();
  const clave = (p: { codigo: string; destino: Destino }) => `${p.destino}|${p.codigo}`;

  // Reutilizables: misma versión aprobada del bloque y misma versión de prompt.
  const reutilizadas = new Map<string, Previa>();
  for (const p of pedidos) {
    const prev = ctx.previaDe?.get(clave(p));
    // La vigencia (mismo texto aprobado del bloque) ya se comprobó al armar previaDe. Los requisitos que se
    // responden por clave de hechos (HECHOS_POR_CLAVE) no se reutilizan: sus hechos cambian sin que cambie el bloque.
    // Tampoco una que ya no pasa las reglas de forma (erroresDeForma): se regenera sola, sin tocar las demás.
    if (prev?.texto && prev.bloque === v.numero && prev.prompt_version === promptDe(p) && !HECHOS_POR_CLAVE[p.codigo] && !HECHOS_POR_ENUNCIADO[p.codigo] && !erroresDeForma(prev.texto, p.codigo).length) reutilizadas.set(clave(p), prev);
  }
  const llamados = pedidos.filter((p) => !reutilizadas.has(clave(p)));
  let pendientes = llamados;
  const motivos = new Map<string, string[]>();
  // Tres intentos: el segundo y el tercero reciben el motivo del rechazo (B65(c) por celda lo necesita, Fase 3).
  for (let intento = 1; intento <= 3 && pendientes.length && ctx.apiKey; intento++) {
    let salida: Salida[] = [];
    try {
      const r = await llamar(v, titulo, pendientes, ctx, motivos, ctx.apiKey);
      uso = sumar(uso, r.uso);
      salida = r.respuestas;
    } catch (e) {
      for (const p of pendientes) motivos.set(clave(p), [`falló la llamada: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`]);
      continue;
    }
    const siguientes: Pedido[] = [];
    for (const p of pendientes) {
      const s = salida.find((x) => x.codigo === p.codigo && x.destino === p.destino);
      if (!s) {
        motivos.set(clave(p), ["faltó la respuesta de este requisito"]);
        siguientes.push(p);
        continue;
      }
      const g = aplicarGlosario(conSeparadoresDeMiles(s.texto.trim(), p.hechos), ctx.glosario);
      const notasExtra: string[] = [];
      const errores = [...validarRespuesta(g.texto, p.destino, { codigo: p.codigo, textoBloque: v.texto, hechos: p.hechos, citados: s.hechos }), ...erroresDeForma(g.texto, p.codigo)];
      const razon = HECHO_RAZON[p.codigo];
      const deLaRazon = razon ? p.hechos.filter((h) => razon.clave.test(ctx.hechos.get(h.id)?.clave ?? "")) : [];
      if (deLaRazon.length && !deLaRazon.some((h) => s.hechos.includes(h.local))) errores.push(`no da la razón que pide el requisito: debe apoyarse en el hecho ${deLaRazon[0].local} y citarlo`);
      // Conceptos con enfoque del mismo datapoint (97/99): ninguna oración compartida con el anterior.
      const yo = CONCEPTOS_FORMATO_CON_ENFOQUE.find((c) => `fila:${c.fila}` === p.codigo);
      const norm = (o: string) => o.toLowerCase().replace(/\s+/g, " ").trim();
      const repetidasDe = (previa: string | null) => (previa ? oracionesDe(g.texto).filter((o) => oracionesDe(previa).some((q) => norm(q) === norm(o))) : []);
      // También contra la síntesis del mismo código (84 para 16(a)): ninguna celda del párrafo repite una oración de otra.
      for (const otro of CONCEPTOS_FORMATO_CON_ENFOQUE.filter((c) => yo && !yo.noRepite && c.codigo === yo.codigo && c.fila !== yo.fila && (c.fila < yo.fila || c.noRepite))) {
        const repetidas = repetidasDe(finales.get(`formato|fila:${otro.fila}`)?.texto ?? reutilizadas.get(`formato|fila:${otro.fila}`)?.texto ?? null);
        if (repetidas.length) errores.push(`repite oraciones de la respuesta de la fila ${otro.fila} (${repetidas.length}); esta fila responde otro efecto y no puede copiarla`);
        // Por efecto (16(a)): tampoco parafraseada (K85 repetía casi igual la declaración general de K84).
        const previa = finales.get(`formato|fila:${otro.fila}`)?.texto ?? reutilizadas.get(`formato|fila:${otro.fila}`)?.texto ?? null;
        const parafraseadas = yo?.porEfecto && previa ? oracionesDe(g.texto).filter((o) => oracionesDe(previa).some((q) => seParecen(o, q))) : [];
        if (parafraseadas.length) errores.push(`repite casi igual una oración de la fila ${otro.fila}; esta fila responde solo su efecto, con oraciones propias`);
      }
      // Por efecto: tampoco repite ni parafrasea la respuesta de los códigos vecinos que nombra (K43 frente a K47 y K52).
      for (const otro of yo?.distintaDe ?? []) {
        const k = `formato|${otro}`;
        const suya = finales.get(k)?.texto ?? reutilizadas.get(k)?.texto ?? salida.find((x) => x.codigo === otro && x.destino === "formato")?.texto ?? ctx.previaDe?.get(k)?.texto ?? null;
        if (suya && oracionesDe(g.texto).some((o) => oracionesDe(suya).some((q) => q === o || seParecen(o, q)))) errores.push(`repite o parafrasea una oración de la respuesta de ${otro}; esta fila responde solo su parte`);
      }
      // Por plazo: ninguna oración igual o parafraseada a la de otro plazo de la misma tabla ni a la fila de su pregunta.
      if (esClaveDeHorizonte(p.codigo)) {
        const base = p.codigo.replace(/:[a-z]+$/, "");
        const pregunta = TABLAS_POR_HORIZONTE.find((t) => `fila:${t.fila}` === base)?.pregunta;
        const kp = `formato|fila:${pregunta}`;
        const dePregunta = finales.get(kp)?.texto ?? reutilizadas.get(kp)?.texto ?? null;
        if (dePregunta && oracionesDe(g.texto).some((o) => oracionesDe(dePregunta).some((q) => q === o || seParecen(o, q)))) errores.push(`repite o parafrasea la fila ${pregunta}, que responde lo no fechado; el plazo lleva solo lo suyo`);
        for (const h of HORIZONTES_TABLA.filter((x) => `${base}:${x.clave}` !== p.codigo)) {
          const k = `formato|${base}:${h.clave}`;
          const otra = finales.get(k)?.texto ?? reutilizadas.get(k)?.texto ?? null;
          if (otra && oracionesDe(g.texto).some((o) => oracionesDe(otra).some((q) => q === o || seParecen(o, q)))) errores.push(`repite o parafrasea el texto del ${h.nombre.toLowerCase()}; cada plazo lleva solo lo suyo`);
        }
      }
      // 21(a) (K100): la razón de 19(a)/(b) de la declaración de criterio (Fase 6, revisión externa v5.2).
      if (p.codigo === "NIIF S2 21(a)" && p.hechos.some((h) => NO_CUANTIFICA_RE.test(h.enunciado)) && !(/identificables? por separado/i.test(g.texto) && /incertidumbre/i.test(g.texto))) {
        errores.push("no da la razón de NIIF S2 19(a) y 19(b) de la declaración de criterio (efectos no identificables por separado; incertidumbre de medición): es la razón de esta celda; la limitación de los próximos periodos va como oración complementaria");
      }
      // K576: ni igual ni parafraseada a la respuesta de 36(e)(i), ni con «No aplica».
      if (p.codigo === CLAVE_RAZON_36E) {
        const k = "formato|NIIF S2 36 (e)(i)";
        const deI = finales.get(k)?.texto ?? reutilizadas.get(k)?.texto ?? salida.find((x) => x.codigo === "NIIF S2 36 (e)(i)" && x.destino === "formato")?.texto ?? ctx.previaDe?.get(k)?.texto ?? null;
        if (/^no aplica/i.test(g.texto)) errores.push("empieza con «No aplica»: da la razón");
        if (deI && oracionesDe(g.texto).some((o) => oracionesDe(deI).some((q) => q === o || seParecen(o, q)))) errores.push("repite o parafrasea la respuesta de NIIF S2 36 (e)(i); da la razón en una oración propia");
      }
      // Por efecto o por plazo: «salida», «pago» o «desembolso» solo si un hecho lo dice (ajuste 2 de Esteban, K89).
      if ((yo?.porEfecto || esClaveDeHorizonte(p.codigo)) && FLUJO_RE.test(g.texto) && !p.hechos.some((h) => FLUJO_RE.test(h.enunciado))) {
        errores.push(`dice «${g.texto.match(FLUJO_RE)![0]}» y ningún hecho lo sustenta; da los importes del periodo sin llamarlos así`);
      }
      // Código padre: ninguna oración de las respuestas de sus incisos (de esta corrida, reutilizadas o previas).
      for (const hijo of Object.keys(PADRE_DE).filter((h) => PADRE_DE[h] === p.codigo)) {
        const k = `${p.destino}|${hijo}`;
        const deHijo = finales.get(k)?.texto ?? reutilizadas.get(k)?.texto ?? salida.find((x) => x.codigo === hijo && x.destino === p.destino)?.texto ?? ctx.previaDe?.get(k)?.texto ?? null;
        const repetidas = repetidasDe(deHijo);
        // También parafraseadas (K91 repetía K92 con otras palabras; revisión externa v5.2).
        const parafraseadas = deHijo ? oracionesDe(g.texto).filter((o) => oracionesDe(deHijo).some((q) => q !== o && seParecen(o, q))) : [];
        if (repetidas.length || parafraseadas.length) errores.push(`repite oraciones de la respuesta de su inciso ${hijo} (${repetidas.length + parafraseadas.length}); el código padre da una síntesis propia`);
      }
      // B65(c) por celda: nombra su efecto y no se parece (≥ 70 % de las palabras) a otra celda del mismo inciso.
      const b65 = CONCEPTOS_B65C.findIndex((c) => `fila:${c.fila}` === p.codigo);
      if (b65 >= 0) {
        const efecto = B65C_EFECTO_RE[b65 % 5];
        if (!efecto.re.test(g.texto)) errores.push(`no nombra su efecto (${efecto.nombre}); esta celda responde solo ese efecto`);
        // Ajuste de Esteban (Fase 3): los planes de disposición de activos (16(c)) van en los efectos previstos, no en
        // el riesgo de ajuste material.
        if (b65 % 5 === 4 && /disposici[oó]n de activos|reubicaci[oó]n/i.test(g.texto)) errores.push("menciona planes de disposición de activos; van en la celda de efectos previstos (NIIF S2 16(c)), no en la del riesgo de ajuste material");
        // Y la de efectos previstos que recibe un plan de disposición de su tipo lo dice.
        if (b65 % 5 === 3 && p.hechos.some((h) => PLAN_DISPOSICION_RE.test(h.enunciado)) && !/disposici[oó]n|reubic|desinvers|venta de/i.test(g.texto)) errores.push("omite el plan de disposición de activos de sus hechos (NIIF S2 16(c)); esta celda lo incluye");
        // Por oración: una oración que NO nombra el efecto de esta celda y comparte ≥ 70 % de sus palabras con una
        // oración de otra celda del inciso (la declaración general copiada). Dos negaciones paralelas, cada una con su
        // efecto («…en su situación financiera», «…en su rendimiento financiero»), no son repetición.
        const palabras = (t: string) => new Set(t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3));
        const parecidas = (a: string, b: string) => {
          const [x, y] = [palabras(a), palabras(b)];
          const comunes = [...x].filter((w) => y.has(w)).length;
          return Math.min(x.size, y.size) >= 4 && comunes / Math.min(x.size, y.size) >= 0.7;
        };
        const hermanas = CONCEPTOS_B65C.filter((c) => c.codigo === CONCEPTOS_B65C[b65].codigo && c.fila < CONCEPTOS_B65C[b65].fila)
          .map((c) => ({ fila: c.fila, texto: finales.get(`formato|fila:${c.fila}`)?.texto ?? reutilizadas.get(`formato|fila:${c.fila}`)?.texto ?? "" }));
        const repetida = (o: string) => !efecto.re.test(o) && hermanas.some((h) => oracionesDe(h.texto).some((q) => parecidas(o, q)));
        // La declaración general repetida se retira si lo que queda responde el efecto de la celda; si no, se rechaza.
        const propias = oracionesDe(g.texto).filter((o) => !repetida(o));
        if (propias.length && propias.length < oracionesDe(g.texto).length && efecto.re.test(propias.join(" "))) {
          g.texto = propias.join(" ");
          notasExtra.push("Se retiró una oración que repetía la de otra celda del inciso.");
        } else if (propias.length < oracionesDe(g.texto).length) {
          const filas = hermanas.filter((h) => oracionesDe(g.texto).some((o) => repetida(o) && oracionesDe(h.texto).some((q) => parecidas(o, q)))).map((h) => h.fila);
          errores.push(`repite casi igual una oración de la fila ${filas.join(" y ")}; responde solo ${efecto.nombre}, en una oración propia`);
        }
      }
      // 29(e) por tipo: nombra su tipo y no trae una cifra que no esté en sus hechos (así no repite el importe de otro tipo).
      const de29e = CONCEPTOS_29E.find((c) => `fila:${c.fila}` === p.codigo);
      if (de29e) {
        if (!de29e.tipo.re.test(g.texto)) errores.push(`no nombra el tipo de esta celda (${de29e.tipo.nombre})`);
        const propiasCifras = cifrasDe(p.hechos.map((h) => h.enunciado).join(" "));
        const ajenas = [...cifrasDe(g.texto)].filter((x) => !propiasCifras.has(x));
        if (ajenas.length) errores.push(`trae cifras que no están en sus hechos (${ajenas.join(", ")}); esta celda da solo el despliegue de capital de ${de29e.tipo.nombre}`);
        // Ajuste de Esteban (Fase 1): capitalizado sí, gasto no, con el criterio de K85; y solo lo de su tipo, sin aclarar
        // lo que no se incluye.
        if (GASTO_NO_CAPITAL_RE.test(g.texto)) errores.push("menciona importes registrados como gasto o lo que no se incluye; esta celda da solo lo capitalizado o invertido de su tipo");
      }
      // Booleanos (D1): «Sí.»/«No.», el hecho que contesta, y ni el resto ni la celda vecina (la respuesta del código) en contra.
      const bool = BOOLEANOS_FORMATO.find((b) => `fila:${b.fila}` === p.codigo);
      if (bool) {
        const k = `taxonomia|${bool.codigo}`;
        const vecina = finales.get(k)?.texto ?? reutilizadas.get(k)?.texto ?? salida.find((x) => x.codigo === bool.codigo && x.destino === "taxonomia")?.texto ?? ctx.previaDe?.get(k)?.texto ?? null;
        errores.push(...validarBooleano(g.texto, { pregunta: bool, hechos: p.hechos, citados: s.hechos, vecina: vecina ? sinRemision(vecina) : null }));
      }
      // Síntesis (84, 64): ninguna oración de la respuesta que da el detalle, sea de esta corrida o reutilizada.
      if (yo?.noRepite) {
        const k = `formato|${yo.noRepite}`;
        const detalle = finales.get(k)?.texto ?? reutilizadas.get(k)?.texto ?? salida.find((x) => x.codigo === yo.noRepite && x.destino === "formato")?.texto ?? ctx.previaDe?.get(k)?.texto ?? null;
        const repetidas = repetidasDe(detalle);
        if (repetidas.length) errores.push(`repite oraciones de la respuesta de ${yo.noRepite} (${repetidas.length}); esta fila es una síntesis y no puede copiar el detalle`);
      }
      if (errores.length) {
        motivos.set(clave(p), errores);
        // K576: dos intentos; si el validador la rechaza dos veces, la regla (opción 1, en el llenado del Formato).
        if (!(p.codigo === CLAVE_RAZON_36E && intento >= 2)) siguientes.push(p);
        continue;
      }
      const notas = [...g.cambios.map((c) => `Glosario: «${c.variante}» → «${c.canonico}» (${c.veces}).`), ...notasExtra];
      if (intento > 1) notas.push(`Aceptada en el reintento; el primer intento falló: ${(motivos.get(clave(p)) ?? []).join("; ")}`);
      finales.set(clave(p), { texto: g.texto, citados: s.hechos, origen: "modelo", notas });
    }
    pendientes = siguientes;
  }

  const filas: FilaRespuesta[] = [];
  const porRespuesta = llamados.length ? costoUsd(MODELO_RESPUESTAS, uso) / llamados.length : 0;
  const rem = remision(v.numero, ctx.numeracion);
  for (const p of pedidos) {
    const prev = reutilizadas.get(clave(p));
    if (prev) {
      filas.push({
        destino: p.destino,
        clave: p.codigo,
        tipo_campo: p.destino === "formato" ? "text block" : "text",
        estado: "respuesta",
        origen: "modelo",
        texto: conSeparadoresDeMiles(p.destino === "taxonomia" && rem ? `${sinRemision(prev.texto!)} ${rem}.` : prev.texto!, p.hechos),
        valor: null,
        bloque: v.numero,
        bloque_version: v.version,
        hechos: prev.hechos,
        notas: prev.notas,
        modelo: MODELO_RESPUESTAS,
        prompt_version: promptDe(p),
        uso: { entrada: prev.tokens_entrada, cacheEscritura: prev.tokens_cache_escritura, cacheLectura: prev.tokens_cache_lectura, salida: prev.tokens_salida },
        costo_usd: Number(prev.costo_usd),
      });
      continue;
    }
    let f = finales.get(clave(p));
    // B65(c) por celda y 29(e) por tipo: sin respuesta validada, la celda queda pendiente (vacía en el Formato); las
    // oraciones del bloque no responden el efecto ni el tipo de la celda.
    // Un código padre tampoco cae al respaldo: sus oraciones del bloque repiten las de sus incisos (K91, Fase 6).
    if (!f && ([...CONCEPTOS_B65C, ...CONCEPTOS_29E, ...CONCEPTOS_FORMATO_CON_ENFOQUE.filter((c) => c.porEfecto)].some((c) => `fila:${c.fila}` === p.codigo) || esClaveDeHorizonte(p.codigo) || p.codigo === CLAVE_RAZON_36E || Object.values(PADRE_DE).includes(p.codigo))) {
      filas.push({ ...{ destino: p.destino, clave: p.codigo, tipo_campo: "text block" as const, valor: null, bloque: v.numero, bloque_version: v.version, hechos: [], modelo: null, prompt_version: promptDe(p), uso: USO_CERO, costo_usd: 0 }, estado: "pendiente", origen: "bloque", texto: null, notas: [`Sin respuesta: el modelo no pasó los validadores: ${(motivos.get(clave(p)) ?? ["sin llave del modelo"]).join("; ")}`] });
      continue;
    }
    if (!f) {
      // Respaldo sin modelo: las oraciones del bloque aprobado ancladas a estos hechos.
      const max = LIMITES[p.destino].oraciones;
      let texto = oracionesAncladas(v.anclas, p.uuids, max);
      if (!texto) texto = oracionesDe(v.texto.split(/\n+/)[0] ?? "").slice(0, Math.min(2, max)).join(" ");
      if (LIMITES[p.destino].caracteres && texto.length > LIMITES[p.destino].caracteres!) texto = oracionesDe(texto).slice(0, 2).join(" ");
      f = { texto, citados: [], origen: "bloque", notas: [`Respaldo con oraciones del bloque aprobado; el modelo no pasó los validadores: ${(motivos.get(clave(p)) ?? ["sin llave del modelo"]).join("; ")}`] };
    }
    const porLocal = new Map(p.hechos.map((h) => [h.local, h.id]));
    const hechosCitados = f.origen === "modelo" ? f.citados.map((c) => porLocal.get(c)).filter((x): x is string => !!x) : p.uuids;
    filas.push({
      destino: p.destino,
      clave: p.codigo,
      tipo_campo: p.destino === "formato" ? "text block" : "text",
      estado: "respuesta",
      origen: f.origen,
      texto: p.destino === "taxonomia" && rem ? `${f.texto} ${rem}.` : f.texto,
      valor: null,
      bloque: v.numero,
      bloque_version: v.version,
      hechos: hechosCitados,
      notas: f.notas,
      modelo: f.origen === "modelo" ? MODELO_RESPUESTAS : null,
      // También en el respaldo: la firma es del pedido, no de quién lo respondió.
      prompt_version: promptDe(p),
      uso: { entrada: Math.round(uso.entrada / llamados.length), cacheEscritura: Math.round(uso.cacheEscritura / llamados.length), cacheLectura: Math.round(uso.cacheLectura / llamados.length), salida: Math.round(uso.salida / llamados.length) },
      costo_usd: Math.round(porRespuesta * 10_000) / 10_000,
    });
  }
  return { filas, uso };
}

async function llamar(
  v: VersionAprobada,
  titulo: string,
  pedidos: Pedido[],
  ctx: { descripcion: Map<string, string>; glosario: EntradaGlosario[] },
  motivos: Map<string, string[]>,
  apiKey: string
): Promise<{ respuestas: Salida[]; uso: Uso }> {
  const glosario = ctx.glosario.length ? `\n\nGlosario de la emisora (canónico = variantes):\n${ctx.glosario.map((e) => `- ${e.canonico}${e.variantes.length ? ` = ${e.variantes.join("; ")}` : ""}`).join("\n")}` : "";
  const requisitos = [...new Set(pedidos.map((p) => p.codigo))].map((codigo) => {
    const ps = pedidos.filter((p) => p.codigo === codigo);
    const hs = ps[0].hechos;
    const previos = ps.flatMap((p) => (motivos.get(`${p.destino}|${p.codigo}`) ?? []).map((m) => `  - (${p.destino}) ${m}`));
    return [
      `## ${codigo} — destinos: ${ps.map((p) => p.destino).join(", ")}`,
      `Requisito: ${ctx.descripcion.get(codigo) ?? codigo}`,
      "Hechos:",
      ...hs.map((h) => `- ${h.local} [${h.tipo}] ${h.enunciado}${h.valor != null ? ` (valor: ${h.valor}${h.unidad ? ` ${h.unidad}` : ""})` : ""} — «${h.extracto}»`),
      ...(previos.length ? ["Tu respuesta anterior se rechazó por:", ...previos] : []),
    ].join("\n");
  });
  const client = new Anthropic({ apiKey });
  const m = await client.messages
    .stream(
      {
        model: MODELO_RESPUESTAS,
        max_tokens: 8000,
        system: [{ type: "text", text: SISTEMA + glosario, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `# Sección ${v.numero} · ${titulo} (texto aprobado)\n\n${v.texto}\n\n# Requisitos\n\n${requisitos.join("\n\n")}`,
          },
        ],
        output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
      },
      { timeout: 180_000, maxRetries: 1 }
    )
    .finalMessage();
  const uso: Uso = {
    entrada: m.usage.input_tokens ?? 0,
    cacheEscritura: m.usage.cache_creation_input_tokens ?? 0,
    cacheLectura: m.usage.cache_read_input_tokens ?? 0,
    salida: m.usage.output_tokens ?? 0,
  };
  const r = JSON.parse(m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("")) as { respuestas: Salida[] };
  return { respuestas: r.respuestas ?? [], uso };
}

// -----------------------------------------------------------------------------
// Guardado y reserva (molde del cierre)
// -----------------------------------------------------------------------------
export const RESPUESTAS_ABANDONADAS_MS = 20 * 60 * 1000;

/** Reserva la generación de respuestas del documento; null si ya hay una viva. */
export async function reclamarRespuestas(db: Db, documentoId: string): Promise<string | null> {
  const corte = new Date(Date.now() - RESPUESTAS_ABANDONADAS_MS).toISOString();
  const reserva = crypto.randomUUID();
  const { data } = await db
    .from("documentos_generados")
    .update({ respuestas_estado: "en_cola", respuestas_resultado: { reserva }, respuestas_actualizado_en: new Date().toISOString() })
    .eq("id", documentoId)
    .eq("estado", "aprobado")
    .or(`respuestas_estado.is.null,respuestas_estado.in.(listo,error),respuestas_actualizado_en.lt.${corte}`)
    .select("id");
  return data?.length ? reserva : null;
}

/**
 * Escribe las filas con service role: upsert de las de este documento, borra las
 * que ya no salen y las de documentos anteriores del mismo reporte (los Excel
 * leen siempre el último aprobado).
 */
export async function guardarRespuestas(admin: Db, documentoId: string, filas: FilaRespuesta[]): Promise<void> {
  const { data: doc } = await admin.from("documentos_generados").select("tenant_id, reporte_id, version").eq("id", documentoId).single();
  if (!doc) throw new Error("documento");
  const registros = filas.map((f) => ({
    tenant_id: doc.tenant_id,
    reporte_id: doc.reporte_id,
    documento_id: documentoId,
    version_documento: doc.version,
    destino: f.destino,
    clave: f.clave,
    tipo_campo: f.tipo_campo,
    estado: f.estado,
    origen: f.origen,
    texto: f.texto,
    valor: f.valor as never,
    bloque: f.bloque,
    bloque_version: f.bloque_version,
    hechos: f.hechos as never,
    notas: f.notas as never,
    modelo: f.modelo,
    prompt_version: f.prompt_version,
    tokens_entrada: f.uso.entrada,
    tokens_cache_escritura: f.uso.cacheEscritura,
    tokens_cache_lectura: f.uso.cacheLectura,
    tokens_salida: f.uso.salida,
    costo_usd: f.costo_usd,
  }));
  for (let i = 0; i < registros.length; i += 200) {
    const { error } = await admin.from("respuestas_datapoint").upsert(registros.slice(i, i + 200), { onConflict: "documento_id,destino,clave" });
    if (error) throw new Error(`guardar respuestas: ${error.message}`);
  }
  for (const destino of ["taxonomia", "formato"] as const) {
    const claves = registros.filter((r) => r.destino === destino).map((r) => r.clave);
    const { data: viejas } = await admin.from("respuestas_datapoint").select("id, clave").eq("documento_id", documentoId).eq("destino", destino);
    const sobran = (viejas ?? []).filter((x) => !claves.includes(x.clave)).map((x) => x.id);
    if (sobran.length) await admin.from("respuestas_datapoint").delete().in("id", sobran);
  }
  const { error } = await admin.from("respuestas_datapoint").delete().eq("reporte_id", doc.reporte_id).neq("documento_id", documentoId);
  if (error) throw new Error(`reemplazar respuestas anteriores: ${error.message}`);
}

/**
 * Corre una generación reservada y deja su estado. `db` es la sesión del staff
 * (lee y marca el estado); `admin` escribe las filas. No lanza: un fallo queda
 * en «error».
 */
export async function completarRespuestas(db: Db, admin: Db, documentoId: string, reserva: string): Promise<ResultadoRespuestas | null> {
  const marcar = async (respuestas_estado: "ejecutando" | "listo" | "error", resultado: Record<string, unknown> = {}) => {
    const { data } = await db
      .from("documentos_generados")
      .update({ respuestas_estado, respuestas_resultado: { ...resultado, reserva } as never, respuestas_actualizado_en: new Date().toISOString() })
      .eq("id", documentoId)
      .eq("respuestas_resultado->>reserva", reserva)
      .select("id");
    return !!data?.length;
  };
  if (!(await marcar("ejecutando"))) return null;
  try {
    const r = await generarRespuestas(db, documentoId, { latido: () => marcar("ejecutando") });
    if (!(await marcar("ejecutando"))) return null;
    await guardarRespuestas(admin, documentoId, r.filas);
    await marcar("listo", { costo_usd: r.costo, por_origen: r.porOrigen, por_estado: r.porEstado, filas: r.filas.length });
    return r;
  } catch (e) {
    await marcar("error", { error: (e instanceof Error ? e.message : String(e)).slice(0, 300) });
    return null;
  }
}
