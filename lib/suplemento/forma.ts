// =============================================================================
// FORMA DE REFERENCIA DE LA EMISORA (encargo s1-72-reserva-y-emisora; decisión 7
// de odonnell-alta-real y decisión 4 del encargo).
//
// Cómo se nombra la emisora a sí misma después de la denominación formal: «la
// Compañía», «la Emisora», «la Sociedad»… La elige la emisora en el Perfil
// (sección Identidad); sin elección, «la Compañía».
//
// Los textos fijos (alivios, «No aplica» heredados, hechos de regla, instrucciones
// y ejemplos al modelo) se escriben con la forma por defecto y pasan por
// `enForma` al usarse: con el default no cambia ni un carácter (las respuestas
// reutilizadas conservan su firma); con otra forma, «la Compañía» pasa a ser la
// del Perfil.
//
// El validador de voz (`formasAjenas`) admite la forma del Perfil, la
// denominación formal y el nombre corto, y rechaza las formas genéricas
// distintas de la del Perfil. Solo con mayúscula: «la entidad que informa» o
// «declaradas por la emisora» son sustantivos comunes, no una forma de
// referencia.
// =============================================================================

export const FORMA_POR_DEFECTO = "la Compañía";

/** La forma de referencia del Perfil, o «la Compañía» si no la tiene. */
export function formaDeReferencia(delPerfil: string | null | undefined): string {
  const f = (delPerfil ?? "").trim();
  return f || FORMA_POR_DEFECTO;
}

/** La forma con mayúscula inicial, para abrir oración («La Emisora…»). */
export const conMayuscula = (forma: string) => forma.charAt(0).toUpperCase() + forma.slice(1);

/**
 * Un texto fijo, escrito con «la Compañía», en la forma de la emisora. «La Compañía» al abrir oración lleva la forma
 * con mayúscula. Con la forma por defecto devuelve el mismo texto.
 */
export function enForma(texto: string, forma: string): string {
  if (forma === FORMA_POR_DEFECTO) return texto;
  return texto.replace(/(?<!\p{L})([Ll])a Compañía(?!\p{L})/gu, (_m, l: string) => (l === "L" ? conMayuscula(forma) : forma));
}

/** Formas genéricas con que una emisora se nombra; con mayúscula en el sustantivo. */
const GENERICAS = /(?<!\p{L})(?:[Ll]a (?:Compañía|Emisora|Entidad|Sociedad|Empresa)|(?:[Ee]l|[Dd]el) Emisor)(?!\p{L})/gu;

export type Voz = { forma: string; denominacionFormal?: string | null; nombreCorto?: string | null };

/**
 * Formas genéricas del texto distintas de la del Perfil («la Compañía» cuando el Perfil dice «la Emisora»). La
 * denominación formal y el nombre corto se admiten: se quitan antes de buscar (una «Compañía Minera …» en la
 * denominación no es una forma ajena).
 */
export function formasAjenas(texto: string, voz: Voz): string[] {
  let t = texto;
  for (const s of [voz.denominacionFormal, voz.nombreCorto]) if (s && s.trim()) t = t.split(s.trim()).join(" ");
  const propia = voz.forma.trim().toLowerCase();
  const halladas = (t.match(GENERICAS) ?? []).map((m) => m.replace(/^del /i, "el ").replace(/^\p{Lu}/u, (x) => x.toLowerCase()));
  return [...new Set(halladas.filter((m) => m.toLowerCase() !== propia))];
}

/** El mensaje del validador, igual en los bloques y en las respuestas. */
export const mensajeFormaAjena = (ajenas: string[], forma: string) =>
  `nombra a la emisora como ${ajenas.map((a) => `«${a}»`).join(", ")}; su forma de referencia es «${forma}» (o su denominación o su nombre corto)`;
