import "server-only";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { costoUsd, type Uso } from "@/lib/suplemento/modelos";
import { MODELO_LIBRO } from "./extraer";
import type { HechoNuevo } from "./tipos";

// =============================================================================
// CONTRADICCIONES ENTRE FUENTES (libro de hechos, Paso 5).
//
// Dos hechos con la misma clave que vienen de fuentes distintas hablan de lo
// mismo. Si dicen cosas incompatibles —una cifra distinta, «aprueba» frente a
// «propone», «propuesta» frente a «impartida»—, el libro NO elige: los marca en
// conflicto, con su explicación, y el bloque pondrá un marcador y una nota. La
// jerarquía de fuentes ordena, no decide (revisión externa del 7 de octubre).
//
// Dos pasos: cifras distintas con la misma unidad se marcan por código; lo
// demás lo juzga UNA llamada con todos los grupos.
// =============================================================================

export type ResultadoConflictos = { grupos: number; enConflicto: number; uso: Uso; costo: number; error?: string };

/**
 * El documento de una fuente: las páginas de un mismo adjunto (adj:<id>:p1,
 * adj:<id>:p2) son UN documento. Dos hechos del mismo documento no se comparan
 * como contradicción: dentro de un acta, el acuerdo resuelve la propuesta que la
 * precede (corrección de la contradicción falsa del acta del Consejo, Paso 5.4).
 */
/** Una explicación que se desmiente a sí misma («no hay contradicción real») no marca nada. */
const SE_DESMIENTE = /no hay (una )?contradicci[oó]n|no (es|son) incompatibles?|son compatibles|no se contradicen|no existe contradicci[oó]n/i;

/** Los números de hecho de la lista ([4], [15]-[4]) se sustituyen por el nombre de su fuente: al revisor no le dicen nada. */
function conFuentes(explicacion: string, lista: HechoNuevo[]): string {
  return explicacion.replace(/\[(\d+)\]/g, (m, n) => (lista[Number(n) - 1] ? `«${lista[Number(n) - 1].fuente_detalle}»` : m));
}

export function documentoDe(fuenteId: string): string {
  return fuenteId.startsWith("adj:") ? fuenteId.split(":").slice(0, 2).join(":") : fuenteId;
}

const ESQUEMA = {
  type: "object",
  properties: {
    grupos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          grupo: { type: "integer" },
          veredicto: { type: "string", enum: ["contradiccion", "compatible"] },
          explicacion: { type: "string" },
        },
        required: ["grupo", "veredicto", "explicacion"],
        additionalProperties: false,
      },
    },
  },
  required: ["grupos"],
  additionalProperties: false,
};

const SISTEMA = `Recibes grupos de hechos de una emisora. Los hechos de un grupo tratan del mismo sujeto y atributo, y vienen de fuentes distintas. Para cada grupo decide:
- «contradiccion»: no pueden ser ciertos a la vez tal como están escritos (otra cifra u otra fecha para lo mismo; otro órgano responsable de la misma función; «aprueba» frente a «propone»; algo que en una fuente ya ocurrió y en otra solo se propuso).
- «compatible»: dicen lo mismo, o uno es más detallado que otro sin negarlo, o tratan aspectos distintos.
Una propuesta y la decisión que la resuelve NO son contradicción: si una fuente dice que algo «se propuso» y otra (o el mismo documento) que «se acordó», «se creó» o «se aprobó», es compatible. Solo hay contradicción si una fuente afirma que ya ocurrió y la otra que sigue pendiente de decidirse.
Juzga solo por los enunciados y extractos; no supongas. La explicación, en una frase, nombra las fuentes y la diferencia.`;

export async function detectarContradicciones(hechos: HechoNuevo[], apiKey: string): Promise<ResultadoConflictos> {
  const vacio: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  const vigentes = hechos.filter((h) => h.estado === "vigente");
  const porClave = new Map<string, HechoNuevo[]>();
  for (const h of vigentes) porClave.set(h.clave, [...(porClave.get(h.clave) ?? []), h]);
  const grupos = [...porClave.values()].filter((g) => new Set(g.map((h) => documentoDe(h.fuente_id))).size > 1);

  let enConflicto = 0;
  const marcar = (g: HechoNuevo[], explicacion: string) => {
    const id = randomUUID();
    for (const h of g) {
      h.estado = "en_conflicto";
      h.grupo_conflicto = id;
      h.conflicto = explicacion;
      enConflicto++;
    }
  };

  // 1. Cifras: misma unidad, valores distintos → contradicción, sin modelo.
  const paraModelo: HechoNuevo[][] = [];
  for (const g of grupos) {
    const conValor = g.filter((h) => h.valor != null);
    const unidades = new Set(conValor.map((h) => (h.unidad ?? "").toLowerCase()));
    const periodos = new Set(conValor.map((h) => h.periodo ?? ""));
    if (conValor.length === g.length && unidades.size === 1 && periodos.size === 1 && new Set(conValor.map((h) => h.valor)).size > 1) {
      marcar(g, `Cifras distintas para lo mismo: ${g.map((h) => `${h.valor}${h.unidad ? ` ${h.unidad}` : ""} (${h.fuente_detalle})`).join(" frente a ")}.`);
    } else {
      paraModelo.push(g);
    }
  }
  if (!paraModelo.length) return { grupos: grupos.length, enConflicto, uso: vacio, costo: 0 };

  // 2. Lo demás: una llamada con todos los grupos.
  const usuario = paraModelo
    .map((g, i) => [`## Grupo ${i + 1} · ${g[0].clave}`, ...g.map((h) => `- (${h.rango_fuente}; ${h.fuente_detalle}) ${h.enunciado} — extracto: «${h.extracto}»`)].join("\n"))
    .join("\n\n");
  try {
    const client = new Anthropic({ apiKey });
    const m = await client.messages
      .stream(
        {
          model: MODELO_LIBRO,
          max_tokens: 16000,
          system: SISTEMA,
          messages: [{ role: "user", content: usuario }],
          output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
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
    const texto = m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const r = JSON.parse(texto) as { grupos: { grupo: number; veredicto: string; explicacion: string }[] };
    for (const v of r.grupos ?? []) {
      const g = paraModelo[v.grupo - 1];
      if (g && v.veredicto === "contradiccion" && !SE_DESMIENTE.test(v.explicacion)) marcar(g, v.explicacion);
    }
    return { grupos: grupos.length, enConflicto, uso, costo: costoUsd(MODELO_LIBRO, uso) };
  } catch (e) {
    return { grupos: grupos.length, enConflicto, uso: vacio, costo: 0, error: e instanceof Error ? e.message.slice(0, 300) : String(e) };
  }
}

// -----------------------------------------------------------------------------
// SEGUNDA PASADA: mismo bloque dueño, claves distintas.
//
// La clave la pone el modelo, y dos fuentes pueden nombrar distinto lo mismo:
// «el Comité evalúa la suficiencia de las competencias del Consejo» y «el
// Consejo evalúa anualmente la suficiencia de las competencias de sus
// miembros» quedaron con claves distintas y la primera pasada no las comparó
// (revisión externa, bloque 15). Aquí se comparan los hechos de cada bloque
// dueño que vienen de fuentes distintas, en UNA llamada para todo el libro, y
// el modelo señala los PARES incompatibles. Los pares que ya comparten clave se
// juzgaron arriba y no se vuelven a mandar.
// -----------------------------------------------------------------------------

const ESQUEMA_PARES = {
  type: "object",
  properties: {
    pares: {
      type: "array",
      items: {
        type: "object",
        properties: {
          bloque: { type: "integer" },
          a: { type: "integer" },
          b: { type: "integer" },
          veredicto: { type: "string", enum: ["contradiccion", "por_conciliar", "compatible"] },
          explicacion: { type: "string" },
        },
        required: ["bloque", "a", "b", "veredicto", "explicacion"],
        additionalProperties: false,
      },
    },
  },
  required: ["pares"],
  additionalProperties: false,
};

const SISTEMA_PARES = `Recibes, agrupados por bloque, hechos de una emisora que vienen de fuentes distintas. Busca pares problemáticos y dales un veredicto:
- «contradiccion»: no pueden ser ciertos a la vez tal como están escritos: otra cifra, fecha o frecuencia para lo mismo; «aprueba» frente a «propone»; algo ya ocurrido en una fuente y solo propuesto en otra.
- «por_conciliar»: pueden ser ciertos los dos, pero atribuyen la MISMA función, responsabilidad o decisión a sujetos distintos sin decir cómo se relacionan (p. ej., una fuente dice que el Comité evalúa las competencias del Consejo y otra que el Consejo se autoevalúa). Un lector del informe preguntaría quién lo hace.
- «compatible»: se complementan, tratan aspectos distintos o uno detalla al otro. También una propuesta y la decisión que la resuelve («se propuso crear» frente a «se crea»).
Devuelve SOLO pares con veredicto «contradiccion» o «por_conciliar»; si escribirías «no hay contradicción», no lo devuelvas. Si no hay pares, la lista vacía.
Para cada par: el número de bloque, los dos números de hecho tal como aparecen ([n]), el veredicto y una frase que nombre las fuentes POR SU NOMBRE (archivo, extracto confirmado, campo del Perfil; nunca por su número) y la diferencia.`;

export async function detectarPorBloque(hechos: HechoNuevo[], apiKey: string): Promise<ResultadoConflictos> {
  const vacio: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  const candidatos = hechos.filter((h) => h.estado === "vigente" && h.bloque_dueno != null);
  const porBloque = new Map<number, HechoNuevo[]>();
  for (const h of candidatos) porBloque.set(h.bloque_dueno!, [...(porBloque.get(h.bloque_dueno!) ?? []), h]);
  const grupos = [...porBloque].filter(([, g]) => new Set(g.map((h) => documentoDe(h.fuente_id))).size > 1);
  if (!grupos.length) return { grupos: 0, enConflicto: 0, uso: vacio, costo: 0 };

  const usuario = grupos
    .map(([n, g]) => [`## Bloque ${n}`, ...g.map((h, i) => `[${i + 1}] (${h.rango_fuente}; ${h.fuente_detalle}) ${h.enunciado}`)].join("\n"))
    .join("\n\n");
  try {
    const client = new Anthropic({ apiKey });
    const m = await client.messages
      .stream(
        {
          model: MODELO_LIBRO,
          max_tokens: 16000,
          system: SISTEMA_PARES,
          messages: [{ role: "user", content: usuario }],
          output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA_PARES } },
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
    const texto = m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const r = JSON.parse(texto) as { pares: { bloque: number; a: number; b: number; veredicto: string; explicacion: string }[] };
    const g = new Map(grupos);
    let enConflicto = 0;
    let pares = 0;
    for (const p of r.pares ?? []) {
      const lista = g.get(p.bloque);
      const ha = lista?.[p.a - 1];
      const hb = lista?.[p.b - 1];
      // Mismo hecho, misma fuente o misma clave (ya juzgada): no es un par nuevo.
      if (!ha || !hb || ha === hb || documentoDe(ha.fuente_id) === documentoDe(hb.fuente_id) || ha.clave === hb.clave) continue;
      // Solo cuenta un veredicto explícito: un par «compatible» no se marca aunque venga.
      if (p.veredicto !== "contradiccion" && p.veredicto !== "por_conciliar") continue;
      if (SE_DESMIENTE.test(p.explicacion)) continue;
      const id = ha.grupo_conflicto ?? hb.grupo_conflicto ?? randomUUID();
      const texto = `[${p.veredicto === "contradiccion" ? "contradicción" : "por conciliar"}] ${conFuentes(p.explicacion, lista!)}`;
      for (const h of [ha, hb]) {
        if (h.estado !== "en_conflicto") enConflicto++;
        h.estado = "en_conflicto";
        h.grupo_conflicto = id;
        h.conflicto = h.conflicto ? `${h.conflicto} ${texto}` : texto;
      }
      pares++;
    }
    return { grupos: pares, enConflicto, uso, costo: costoUsd(MODELO_LIBRO, uso) };
  } catch (e) {
    return { grupos: 0, enConflicto: 0, uso: vacio, costo: 0, error: e instanceof Error ? e.message.slice(0, 300) : String(e) };
  }
}
