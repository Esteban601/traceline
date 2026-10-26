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
import { leerAlivios, type Alivios } from "@/lib/perfil-emisor";
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

/** Oración fija del alivio E5 (redacción de la casa; no reproduce la norma). */
export const ORACION_E5 =
  "En este primer periodo anual de aplicación, la Compañía se acoge a la exención del párrafo E5 de la NIIF S1 y revela únicamente información sobre los riesgos y oportunidades relacionados con el clima.";

/** El alcance del cumplimiento con el alivio E5, para la declaración de NIIF S1 72 (redacción de la casa). */
export const ALCANCE_E5 =
  "En este primer periodo anual de aplicación, el cumplimiento comprende la información sobre los riesgos y oportunidades relacionados con el clima, en el alcance que permite la exención del párrafo E5 de la NIIF S1.";
/** El E4 en la declaración de NIIF S1 72, después del alcance del E5: «En este primer periodo…» una sola vez (Esteban, Fase 3). */
export const E4_EN_DECLARACION =
  "Asimismo, se acoge a la exención del párrafo E4 de la NIIF S1 y publica su información financiera relacionada con la sostenibilidad después de sus estados financieros.";

/** La declaración de cumplimiento del bloque 2 aprobado: su párrafo, tal cual (bloque de plantilla, sin hechos). */
export function declaracionDeCumplimiento(textoBloque2: string | null): string | null {
  return (textoBloque2 ?? "").split(/\n+/).map((p) => p.trim()).find((p) => /de conformidad con las Normas NIIF S1/i.test(p)) ?? null;
}

/** Oración fija del alivio E4 (redacción de la casa): va en la respuesta de la declaración de cumplimiento del Excel. */
export const ORACION_E4 =
  "En este primer periodo anual de aplicación, la Compañía se acoge a la exención del párrafo E4 de la NIIF S1 y publica su información financiera relacionada con la sostenibilidad después de sus estados financieros.";

/**
 * «No aplica» heredado, en voz de la emisora. El motivo de noAplicaHeredado es
 * para el revisor (nombra el cuestionario y dice «la emisora»); el Excel publica.
 */
export function textoNoAplicaHeredado(codigo: string): string {
  if (codigo === "NIIF S2 36 (c)") return "No aplica. Ningún objetivo de emisiones de la Compañía es neto, por lo que no hay un objetivo bruto asociado que revelar por separado.";
  if (codigo.startsWith("NIIF S2 36 (e)")) return "No aplica. La Compañía no prevé usar créditos de carbono para alcanzar sus objetivos de emisiones.";
  return "No aplica. El requisito no aplica a la Compañía en este periodo.";
}

const TITULO_ALIVIO: Record<string, string> = {
  C4: "En este primer periodo anual de aplicación, la Compañía se acoge a la exención del párrafo C4 de la NIIF S2 y no revela sus emisiones de Alcance 3.",
};

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
const B65C_TIPOS = [
  { inciso: "b", bloque: 34, desplazamiento: 0, de: "los riesgos de transición relacionados con el clima" },
  { inciso: "c", bloque: 35, desplazamiento: 23, de: "los riesgos físicos relacionados con el clima" },
  { inciso: "d", bloque: 36, desplazamiento: 46, de: "las oportunidades relacionadas con el clima" },
];
export const CONCEPTOS_B65C: { fila: number; codigo: string; enfoque: string; prestadosDe: number }[] = B65C_TIPOS.flatMap((t) =>
  [354, 356, 358, 360, 361].map((f, i) => ({ fila: f + t.desplazamiento, codigo: `NIIF S2 29 (${t.inciso}) · B65 (c)`, enfoque: B65C_EFECTOS[i](t.de), prestadosDe: t.bloque }))
);

export const CONCEPTOS_FORMATO_CON_ENFOQUE: { fila: number; codigo: string; enfoque: string; noRepite?: string; prestadosDe?: number }[] = [
  { fila: 97, codigo: "NIIF S2 16(d)", enfoque: "los efectos previstos sobre el rendimiento financiero (resultados, margen, ingresos y gastos)" },
  { fila: 99, codigo: "NIIF S2 16(d)", enfoque: "los efectos previstos sobre los flujos de efectivo (entradas y salidas de efectivo, como ahorros, gastos o desembolsos)" },
  // Encargo 2026-10-24-deuda-s2-formato, decisiones (b) y (c): síntesis que no repiten la fila que da el detalle.
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
  return parS2 ? `${ORACION_E5} La información correspondiente a este requisito, en lo relativo al clima, se revela conforme a ${parS2}.` : ORACION_E5;
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
    if (exentos.has(codigo)) {
      const alivio = Object.keys(alivios).find((k) => TITULO_ALIVIO[k]) ?? "C4";
      return { codigo, via: "regla", estado: "no_aplica", texto: `No aplica. ${TITULO_ALIVIO[alivio]}` };
    }
    const h = heredados.get(codigo);
    if (h?.estado === "no_aplica") return { codigo, via: "regla", estado: "no_aplica", texto: textoNoAplicaHeredado(codigo), notas: [h.motivo] };
    const hijos = hijosDe.get(codigo);
    if (hijos) {
      const planes = hijos.map(planDe);
      if (planes.every((p) => p.via === "regla" && p.estado === "no_aplica")) {
        return { codigo, via: "regla", estado: "no_aplica", texto: (planes[0] as { texto: string }).texto };
      }
      const conBloque = planes.filter((p): p is Extract<Plan, { via: "bloque" }> => p.via === "bloque");
      if (conBloque.length) {
        const bloque = conBloque[0].bloque;
        return { codigo, via: "bloque", bloque, hechos: [...new Set([...conBloque.flatMap((p) => p.hechos), ...hechosPorClave(HECHOS_DEL_PADRE[codigo] ?? [], porBloque.get(bloque)?.libro_id)])] };
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
  // Conceptos con enfoque propio (97/99): los hechos de la cobertura de su datapoint, redactados con su enfoque.
  for (const c of CONCEPTOS_FORMATO_CON_ENFOQUE) {
    // El bloque y los hechos del código: los de su plan (un padre los reúne de sus incisos) o los de su cobertura.
    const plan = planes.find((p) => p.codigo === c.codigo);
    const cob = plan?.via === "bloque" ? { bloque: plan.bloque, hechos: plan.hechos, estado: "cubierto" } : coberturaDe(c.codigo);
    // B65(c): más los hechos del bloque 10 que remiten al bloque del tipo y sus declaraciones negativas generales
    // (sin referencias), uno por enunciado.
    const prestados = c.prestadosDe == null ? [] : (() => {
      const vistos = new Set<string>();
      return [...hechos.values()]
        .filter((x) => x.estado === "vigente" && x.bloque_dueno === 10 && x.libro_id === porBloque.get(10)?.libro_id)
        .filter((x) => (x.bloques_referencia ?? []).includes(c.prestadosDe!) || (x.tipo === "declaracion_negativa" && !(x.bloques_referencia ?? []).length))
        .filter((x) => !vistos.has(x.enunciado) && vistos.add(x.enunciado))
        .map((x) => x.id);
    })();
    if (!cob || !["cubierto", "parcial"].includes(cob.estado) || !(cob.hechos.length + prestados.length)) continue;
    const clave = `fila:${c.fila}`;
    const otras = [
      ...CONCEPTOS_FORMATO_CON_ENFOQUE.filter((x) => x.codigo === c.codigo && x.fila !== c.fila && !x.noRepite).map((x) => `la fila ${x.fila}`),
      ...(c.noRepite ? [`la respuesta de ${c.noRepite}`] : []),
    ];
    descripcion.set(clave, c.prestadosDe != null
      ? `Concepto del Formato electrónico (fila ${c.fila}) de ${c.codigo}: responde SOLO ${c.enfoque}, en una o dos oraciones, y nombra explícitamente ${B65C_EFECTO_RE[CONCEPTOS_B65C.findIndex((x) => x.fila === c.fila) % 5].nombre}. Si los hechos no muestran ese efecto, dilo en una oración breve sobre ese efecto, apoyada en el hecho que lo declara; no repitas la declaración general de que no se identificaron efectos que reconocer, que ya da otra celda del inciso. No compartas ninguna oración con ${otras.join(", ")}, que responden los otros efectos del mismo inciso, ni describas dónde se concentra la exposición. Sin cifras que no estén en los hechos.`
      : c.noRepite
      ? `Concepto del Formato electrónico (fila ${c.fila}) de ${c.codigo}: responde SOLO ${c.enfoque}, en una o dos oraciones. No compartas ninguna oración con ${otras.join(", ")}, que da el detalle en otra fila. Sin cifras que no estén en los hechos.`
      : `Concepto del Formato electrónico (fila ${c.fila}) de ${c.codigo}: responde SOLO ${c.enfoque}, en dos oraciones. No compartas ninguna oración con ${otras.join(", ")}, que responde otro efecto del mismo párrafo: reparte los hechos según el efecto que describen. Sin cifras que no estén en los hechos.`);
    planes.push({ codigo: clave, via: "bloque", bloque: cob.bloque, hechos: [...new Set([...cob.hechos, ...prestados])] });
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
    if (prev?.texto && prev.bloque === v.numero && prev.prompt_version === promptDe(p) && !HECHOS_POR_CLAVE[p.codigo] && !HECHOS_POR_ENUNCIADO[p.codigo]) reutilizadas.set(clave(p), prev);
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
      const g = aplicarGlosario(s.texto.trim(), ctx.glosario);
      const notasExtra: string[] = [];
      const errores = validarRespuesta(g.texto, p.destino, { codigo: p.codigo, textoBloque: v.texto, hechos: p.hechos, citados: s.hechos });
      const razon = HECHO_RAZON[p.codigo];
      const deLaRazon = razon ? p.hechos.filter((h) => razon.clave.test(ctx.hechos.get(h.id)?.clave ?? "")) : [];
      if (deLaRazon.length && !deLaRazon.some((h) => s.hechos.includes(h.local))) errores.push(`no da la razón que pide el requisito: debe apoyarse en el hecho ${deLaRazon[0].local} y citarlo`);
      // Conceptos con enfoque del mismo datapoint (97/99): ninguna oración compartida con el anterior.
      const yo = CONCEPTOS_FORMATO_CON_ENFOQUE.find((c) => `fila:${c.fila}` === p.codigo);
      const norm = (o: string) => o.toLowerCase().replace(/\s+/g, " ").trim();
      const repetidasDe = (previa: string | null) => (previa ? oracionesDe(g.texto).filter((o) => oracionesDe(previa).some((q) => norm(q) === norm(o))) : []);
      for (const otro of CONCEPTOS_FORMATO_CON_ENFOQUE.filter((c) => yo && !yo.noRepite && !c.noRepite && c.codigo === yo.codigo && c.fila < yo.fila)) {
        const repetidas = repetidasDe(finales.get(`formato|fila:${otro.fila}`)?.texto ?? reutilizadas.get(`formato|fila:${otro.fila}`)?.texto ?? null);
        if (repetidas.length) errores.push(`repite oraciones de la respuesta de la fila ${otro.fila} (${repetidas.length}); esta fila responde otro efecto y no puede copiarla`);
      }
      // Código padre: ninguna oración de las respuestas de sus incisos (de esta corrida, reutilizadas o previas).
      for (const hijo of Object.keys(PADRE_DE).filter((h) => PADRE_DE[h] === p.codigo)) {
        const k = `${p.destino}|${hijo}`;
        const repetidas = repetidasDe(finales.get(k)?.texto ?? reutilizadas.get(k)?.texto ?? salida.find((x) => x.codigo === hijo && x.destino === p.destino)?.texto ?? ctx.previaDe?.get(k)?.texto ?? null);
        if (repetidas.length) errores.push(`repite oraciones de la respuesta de su inciso ${hijo} (${repetidas.length}); el código padre da una síntesis propia`);
      }
      // B65(c) por celda: nombra su efecto y no se parece (≥ 70 % de las palabras) a otra celda del mismo inciso.
      const b65 = CONCEPTOS_B65C.findIndex((c) => `fila:${c.fila}` === p.codigo);
      if (b65 >= 0) {
        const efecto = B65C_EFECTO_RE[b65 % 5];
        if (!efecto.re.test(g.texto)) errores.push(`no nombra su efecto (${efecto.nombre}); esta celda responde solo ese efecto`);
        // Ajuste de Esteban (Fase 3): los planes de disposición de activos (16(c)) van en los efectos previstos, no en
        // el riesgo de ajuste material.
        if (b65 % 5 === 4 && /disposici[oó]n de activos|reubicaci[oó]n/i.test(g.texto)) errores.push("menciona planes de disposición de activos; van en la celda de efectos previstos (NIIF S2 16(c)), no en la del riesgo de ajuste material");
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
        siguientes.push(p);
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
        texto: p.destino === "taxonomia" && rem ? `${sinRemision(prev.texto!)} ${rem}.` : prev.texto,
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
    // B65(c) por celda: sin respuesta validada, la celda queda pendiente (vacía en el Formato); las oraciones del
    // bloque no responden el efecto de la celda.
    if (!f && CONCEPTOS_B65C.some((c) => `fila:${c.fila}` === p.codigo)) {
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
