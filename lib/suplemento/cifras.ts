import { numerosDe } from "@/lib/evidencias/fuente";

// =============================================================================
// VALIDADOR DE CIFRAS DEL BLOQUE — captura sugerida, Paso 5.
//
// Rechaza cualquier cifra del texto que no esté en lo que el bloque recibió como
// CONFIRMADO: las capturas confirmadas de sus solicitudes (el `valor` que
// entrega el ensamblador solo existe si la solicitud está validada y la captura
// confirmada), la tabla armada por código, los extractos de texto que una
// persona confirmó y los demás datos entregados (perfil, registros, objetivos,
// títulos, requisitos). El contenido CRUDO de las evidencias no cuenta: es
// contexto, y una cifra que solo aparece ahí no la respaldó nadie.
//
// Qué es «cifra»: una secuencia de dígitos que no forma parte de una palabra
// (no cuentan el 2 de «S2» ni el de «CO2e»), ni el número de una etiqueta de la
// norma («Alcance 3», «categoría 15»). Dentro de un marcador
// [Pendiente: …] no se revisa nada. Se compara por valor, con las dos
// convenciones de separadores, así que «1,240» y «1240» son la misma cifra.
// =============================================================================

const RE_PENDIENTE = /\[Pendiente:[^\]]*\]/g;
// Etiquetas de la norma, no cifras: «Alcance 1», «Alcances 1 y 2», «categoría 15».
const RE_ETIQUETA = /\b(Alcances?|[Cc]ategor[íi]as?)\s+\d+(?:\s*(?:,|y|a|e)\s*\d+)*/gu;
const RE_CIFRA = /(?<![\p{L}\p{N}.,])\d+(?:[.,'’]\d+)*(?![\p{L}\p{N}])/gu;

const clave = (n: number) => String(Number(n.toPrecision(12)));
const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Las cifras de un texto con la misma regla que se aplica al bloque. */
function cifrasDe(texto: string): number[] {
  const fuera: number[] = [];
  for (const m of texto.matchAll(RE_CIFRA)) fuera.push(...numerosDe(m[0]));
  return fuera;
}

/** Cifras de `texto` que no aparecen en `corpusPermitido` ni en `extras`. */
export function cifrasSinRespaldo(texto: string, corpusPermitido: string, extras: number[] = []): string[] {
  // El corpus se lee con la MISMA regla que el texto, y sin los uuid de los ids:
  // leído a lo bruto, «sol:86880bcf-…» aportaba dígitos sueltos (un 7, un 4)
  // que dejaban pasar cifras inventadas.
  const permitidas = new Set<string>([...cifrasDe(corpusPermitido.replace(RE_UUID, " ")), ...extras].map(clave));
  const fuera = new Set<string>();
  const limpio = texto.replace(RE_PENDIENTE, " ").replace(RE_ETIQUETA, (e, palabra: string) => palabra);
  for (const m of limpio.matchAll(RE_CIFRA)) {
    const lecturas = numerosDe(m[0]);
    if (!lecturas.some((n) => permitidas.has(clave(n)))) fuera.add(m[0]);
  }
  return [...fuera];
}

/** Copia de los datos del bloque SIN el contenido crudo de las evidencias (lo que sí respalda una cifra). */
export function corpusPermitido(datos: unknown, ...otros: (string | null | undefined)[]): string {
  const copia = JSON.parse(JSON.stringify(datos)) as { solicitudes?: { documento_de_respaldo?: { contenido?: unknown } | null }[] };
  for (const s of copia.solicitudes ?? []) if (s.documento_de_respaldo) delete s.documento_de_respaldo.contenido;
  return [JSON.stringify(copia), ...otros.filter(Boolean)].join("\n");
}
