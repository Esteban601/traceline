import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { costoUsd, type ClaveModelo, type Uso } from "@/lib/suplemento/modelos";
import { TIPOS_HECHO, type TipoHecho, type UnidadTexto } from "./tipos";

// =============================================================================
// ATOMIZACIÓN DE TEXTOS EN HECHOS (libro de hechos, Paso 5). Sonnet 5.5.
//
// El modelo propone; el código decide. Cada hecho que devuelve trae su extracto
// literal y la fuente de donde dice que salió, y verificar.ts lo busca ahí: lo
// que no está, no entra. El modelo tampoco elige entre fuentes que se
// contradicen —eso lo marca conflictos.ts—: aquí solo separa y clasifica.
//
// La capa estable (reglas + catálogo de bloques con sus requisitos) va con
// caché: es igual en todas las llamadas del libro. Las llamadas van en serie
// para pasarle a cada una las claves ya usadas: el mismo sujeto y atributo con
// la misma clave es lo que permite detectar una contradicción entre fuentes.
// =============================================================================

export const MODELO_LIBRO: ClaveModelo = "claude-sonnet-5-5";
export const PROMPT_LIBRO_VERSION = "libro-v3-2026-10-07";
// v2: lotes más chicos. Con 14 mil caracteres por llamada, dos corridas sobre
// los mismos insumos dieron 135 y 98 hechos: el modelo resumía en vez de separar.
const CARACTERES_POR_LLAMADA = 6000;
const LIMITE_MS = 4 * 60 * 1000;

export type HechoPropuesto = {
  fuente: string;
  extracto: string;
  enunciado: string;
  clave: string;
  tipo: TipoHecho;
  valor: number | null;
  unidad: string | null;
  periodo: string | null;
  bloque_dueno: number;
  bloques_referencia: number[];
};

export type BloqueCatalogo = { numero: number; titulo: string; clase: string; cubre: string; requisitos: { codigo: string; descripcion: string }[] };

const REGLAS = `# Qué haces

Separas en HECHOS las fuentes de una emisora mexicana para el libro del que se redacta su Suplemento NIIF S1 y S2. No redactas el informe: cada hecho es una pieza que luego un bloque usará, con su cita.

# Qué es un hecho

Una sola afirmación verificable: quién, qué, cuánto, cuándo, cada cuánto, quién responde de qué, qué proceso se sigue, qué política existe. Si una frase dice tres cosas, son tres hechos.

# Reglas

1. EXTRACTO LITERAL. Copia carácter por carácter el fragmento de la fuente que sostiene el hecho, de 10 a 300 caracteres, sin puntos suspensivos, sin corregir ni completar. El código lo busca en la fuente: si no está tal cual, el hecho se descarta.
2. ENUNCIADO FIEL. Una oración completa que dice lo mismo que el extracto, con el sujeto explícito («El Comité de Sostenibilidad y Riesgos Climáticos», no «el Comité»), y NADA MÁS: ni conclusiones («el Consejo aprueba las políticas de riesgos» NO permite decir que existe una política de riesgo climático), ni causas, ni calificativos, ni datos de otra fuente.
3. COMPLETO, NO RESUMIDO. Recorre cada fuente oración por oración: TODA afirmación sobre la emisora que trate de clima, sostenibilidad, gobierno corporativo, órganos y responsables, gestión de riesgos, estrategia y modelo de negocio, operación y perímetro, cadena de valor, métricas, objetivos, políticas, capacitación o decisiones se extrae, aunque parezca menor o ya la hayas visto en otra fuente (las repeticiones entre fuentes son justo lo que se compara). Ante la duda, extráela: el filtro viene después. Solo se omiten las cláusulas genéricas sin relación con esos temas —domicilio, duración, asambleas, acciones, capital, utilidades, disolución— y el texto de relleno.
4. CLAVE ESTABLE. «sujeto.atributo» en snake_case, sin acentos: comite_sostenibilidad.frecuencia_sesiones, consejo.aprobacion_objetivos_climaticos, direccion_riesgos.responsabilidad_identificacion. El MISMO sujeto y atributo llevan la MISMA clave aunque vengan de fuentes distintas: así se detectan las contradicciones. Reutiliza las claves que ya se usaron (te las doy) cuando el hecho trate de lo mismo.
5. TIPO Y VALOR. Un tipo de la lista. Si el hecho es una cifra, \`valor\` es el número tal como aparece en el extracto, sin calcular, y \`unidad\` la suya; si no, null. \`periodo\`: el año o periodo al que se refiere, si el extracto lo dice.
6. BLOQUE DUEÑO. El número del bloque del catálogo cuyo requisito responde el hecho: uno solo. \`bloques_referencia\`: hasta tres bloques que podrían mencionarlo en una línea. Los bloques sugeridos de cada fuente son una pista; decide por el requisito.
7. \`fuente\`: el id entre corchetes de la fuente de donde copiaste el extracto, exacto.
8. Sin repetir un hecho dentro de la misma fuente.
9. ACTAS Y RESOLUCIONES. En un acta, el hecho es lo que se ACUERDA o RESUELVE, con la redacción del acuerdo («Se crea el Comité…», «Se aprueba…»). La exposición previa, el orden del día y la propuesta que el MISMO documento resuelve después no se extraen como hechos aparte: «se propuso crear un comité» seguido de «ACUERDO 1. Se crea el Comité» es UN hecho, el del acuerdo. Una propuesta solo es hecho si el documento no la resuelve (por ejemplo, «se recomienda al Consejo aprobar…»), y entonces el enunciado dice que es una propuesta. Lo que dice un mismo documento sobre un mismo sujeto y atributo lleva una sola clave.`;

const NULLABLE = (t: object) => ({ anyOf: [t, { type: "null" }] });
const ESQUEMA = {
  type: "object",
  properties: {
    hechos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fuente: { type: "string" },
          extracto: { type: "string" },
          enunciado: { type: "string" },
          clave: { type: "string" },
          tipo: { type: "string", enum: TIPOS_HECHO },
          valor: NULLABLE({ type: "number" }),
          unidad: NULLABLE({ type: "string" }),
          periodo: NULLABLE({ type: "string" }),
          bloque_dueno: { type: "integer" },
          bloques_referencia: { type: "array", items: { type: "integer" } },
        },
        required: ["fuente", "extracto", "enunciado", "clave", "tipo", "valor", "unidad", "periodo", "bloque_dueno", "bloques_referencia"],
        additionalProperties: false,
      },
    },
  },
  required: ["hechos"],
  additionalProperties: false,
};

function catalogo(bloques: BloqueCatalogo[]): string {
  return [
    "# Catálogo de bloques del Suplemento",
    "",
    "Cada bloque, con lo que cubre y los requisitos que responde. El bloque dueño de un hecho sale de aquí.",
    "",
    ...bloques.map((b) =>
      [
        `## ${b.numero}. ${b.titulo}${b.clase !== "normativo" ? " (editorial)" : ""}`,
        `Cubre: ${b.cubre}`,
        ...b.requisitos.map((r) => `- ${r.codigo}: ${r.descripcion}`),
      ].join("\n")
    ),
  ].join("\n");
}

/** Lotes de fuentes completas, hasta el tope de caracteres por llamada. */
export function lotes(unidades: UnidadTexto[]): UnidadTexto[][] {
  const out: UnidadTexto[][] = [];
  let actual: UnidadTexto[] = [];
  let tam = 0;
  for (const u of unidades) {
    if (actual.length && tam + u.texto.length > CARACTERES_POR_LLAMADA) {
      out.push(actual);
      actual = [];
      tam = 0;
    }
    actual.push(u);
    tam += u.texto.length;
  }
  if (actual.length) out.push(actual);
  return out;
}

export type ResultadoLote = { hechos: HechoPropuesto[]; uso: Uso; costo: number; error?: string };

export async function atomizar(
  lote: UnidadTexto[],
  bloques: BloqueCatalogo[],
  clavesUsadas: string[],
  apiKey: string
): Promise<ResultadoLote> {
  const client = new Anthropic({ apiKey });
  const usuario = [
    clavesUsadas.length ? `# Claves ya usadas en este libro\n\n${clavesUsadas.join(", ")}\n` : "",
    "# Fuentes",
    "",
    ...lote.map((u) => `### [${u.id}] ${u.detalle} — rango ${u.rango}; bloques sugeridos: ${u.sugeridos.join(", ") || "—"}\n${u.texto}\n`),
    "Devuelve los hechos con el esquema pedido.",
  ].join("\n");
  const reloj = new AbortController();
  const alarma = setTimeout(() => reloj.abort(), LIMITE_MS);
  const vacio: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  try {
    const stream = client.messages.stream(
      {
        model: MODELO_LIBRO,
        max_tokens: 32000,
        system: [
          { type: "text", text: REGLAS },
          { type: "text", text: catalogo(bloques), cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: usuario }],
        output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      },
      { timeout: LIMITE_MS, maxRetries: 1, signal: reloj.signal }
    );
    const m = await stream.finalMessage();
    const uso: Uso = {
      entrada: m.usage.input_tokens ?? 0,
      cacheEscritura: m.usage.cache_creation_input_tokens ?? 0,
      cacheLectura: m.usage.cache_read_input_tokens ?? 0,
      salida: m.usage.output_tokens ?? 0,
    };
    const costo = costoUsd(MODELO_LIBRO, uso);
    if (m.stop_reason === "max_tokens") return { hechos: [], uso, costo, error: "la respuesta no cupo (max_tokens)" };
    const texto = m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    try {
      const r = JSON.parse(texto) as { hechos: HechoPropuesto[] };
      return { hechos: Array.isArray(r.hechos) ? r.hechos : [], uso, costo };
    } catch {
      return { hechos: [], uso, costo, error: `respuesta fuera del esquema (stop_reason: ${m.stop_reason})` };
    }
  } catch (e) {
    return { hechos: [], uso: vacio, costo: 0, error: reloj.signal.aborted ? "corte por tiempo" : e instanceof Error ? e.message.slice(0, 300) : String(e) };
  } finally {
    clearTimeout(alarma);
  }
}
