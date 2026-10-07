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
Juzga solo por los enunciados y extractos; no supongas. La explicación, en una frase, nombra las fuentes y la diferencia.`;

export async function detectarContradicciones(hechos: HechoNuevo[], apiKey: string): Promise<ResultadoConflictos> {
  const vacio: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  const vigentes = hechos.filter((h) => h.estado === "vigente");
  const porClave = new Map<string, HechoNuevo[]>();
  for (const h of vigentes) porClave.set(h.clave, [...(porClave.get(h.clave) ?? []), h]);
  const grupos = [...porClave.values()].filter((g) => new Set(g.map((h) => h.fuente_id)).size > 1);

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
      if (g && v.veredicto === "contradiccion") marcar(g, v.explicacion);
    }
    return { grupos: grupos.length, enConflicto, uso, costo: costoUsd(MODELO_LIBRO, uso) };
  } catch (e) {
    return { grupos: grupos.length, enConflicto, uso: vacio, costo: 0, error: e instanceof Error ? e.message.slice(0, 300) : String(e) };
  }
}
