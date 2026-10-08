import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { costoUsd, type ClaveModelo, type Uso } from "@/lib/suplemento/modelos";
import { TIPOS_HECHO, type TipoHecho, type UnidadTexto } from "./tipos";
import type { Oracion } from "./oraciones";

// =============================================================================
// CLASIFICACIÓN DE ORACIONES EN HECHOS (libro de hechos, Paso 5b). Sonnet 5.5.
//
// v4 (libro estable): el CÓDIGO parte las fuentes en oraciones numeradas
// (oraciones.ts) y el modelo solo dice cuáles son hechos pertinentes y los
// clasifica —enunciado, clave, tipo, valor, bloque dueño, alcance—. No elige
// dónde empieza un hecho ni copia extractos: el extracto ES la oración. Así dos
// corridas sobre los mismos insumos comparan el mismo universo de oraciones, y
// la única variación posible es la decisión de pertinencia (segunda revisión
// externa, punto 10).
//
// Sin temperatura: Sonnet 5.5 ya no la acepta («`temperature` is deprecated for
// this model»). La estabilidad sale de la división determinista, de una
// decisión por oración y del esfuerzo bajo.
//
// La capa estable (reglas + catálogo de bloques con sus requisitos) va con
// caché. Las llamadas van en serie para pasarle a cada una las claves ya usadas.
// =============================================================================

export const MODELO_LIBRO: ClaveModelo = "claude-sonnet-5-5";
export const PROMPT_LIBRO_VERSION = "libro-v12-2026-10-08";
const CARACTERES_POR_LLAMADA = 6000;
const LIMITE_MS = 4 * 60 * 1000;

export type Alcance = "clima" | "entidad" | "sostenibilidad_general" | "generico";

export type HechoPropuesto = {
  oracion: string;
  enunciado: string;
  clave: string;
  tipo: TipoHecho;
  valor: number | null;
  unidad: string | null;
  periodo: string | null;
  bloque_dueno: number;
  bloques_referencia: number[];
  alcance: Alcance;
};

export type BloqueCatalogo = { numero: number; titulo: string; clase: string; cubre: string; plantilla: boolean; requisitos: { codigo: string; descripcion: string }[] };

/** Validado, perfil y narrativo: el modelo clasifica TODAS sus oraciones; solo los adjuntos se filtran por pertinencia. */
export const esObligatoria = (u: UnidadTexto) => u.rango !== "adjunto";

/** Una fuente ya partida en oraciones, con lo que el modelo necesita saber de ella. */
export type FuenteEnOraciones = { unidad: UnidadTexto; oraciones: Oracion[] };

const REGLAS = `# Qué haces

Clasificas las ORACIONES de las fuentes de una emisora mexicana para el libro de hechos del que se redacta su Suplemento NIIF S1 y S2. Cada oración ya viene numerada con su id entre corchetes. Tú decides cuáles son hechos y los clasificas; no redactas el informe.

# Qué devuelves

Cada fuente dice si es OBLIGATORIA o FILTRADA:
- OBLIGATORIA (respuestas confirmadas, campos del Perfil, Carta de la Dirección): una entrada por CADA oración, sin excepción; ya son respuestas a lo que el informe pregunta.
- FILTRADA (documentos adjuntos: actas, estatutos, políticas): una entrada solo por cada oración que sea un HECHO PERTINENTE —una afirmación sobre la emisora que algún bloque del catálogo necesita para responder un requisito—. Las demás no se devuelven: títulos, órdenes del día, fórmulas de cierre, cláusulas genéricas (domicilio, duración, asambleas, acciones, capital, utilidades, disolución, designación de delegados para formalizar acuerdos) y frases sin contenido.

El id de la oración va EXACTO en \`oracion\`.

Una entrada por oración, nunca dos. Si una oración dice varias cosas, el enunciado las resume sin agregar nada.

# Reglas de cada entrada

1. ENUNCIADO FIEL: una oración completa que dice lo mismo que la oración de la fuente, con el sujeto explícito («El Comité de Sostenibilidad y Riesgos Climáticos», no «el Comité»), y NADA MÁS: ni conclusiones, ni causas, ni calificativos, ni datos de otra oración.
2. EN UN ACTA, EL ACUERDO: lo que se acuerda o resuelve es el hecho. La exposición previa o la propuesta que el mismo documento resuelve después no se devuelve.
3. CLAVE ESTABLE: «sujeto.atributo» en snake_case sin acentos (comite_sostenibilidad.frecuencia_sesiones). El mismo sujeto y atributo llevan la misma clave aunque vengan de fuentes distintas; reutiliza las claves ya usadas que te doy.
4. TIPO Y VALOR: un tipo de la lista; si el hecho es una cifra, \`valor\` es el número tal como aparece en la oración, sin calcular, con su \`unidad\`; si no, null. \`periodo\`: el año o periodo al que se refiere, si la oración lo dice.
5. BLOQUE DUEÑO: el número del bloque cuyo requisito RESPONDE el hecho, uno solo. Un hecho que solo es contexto de un bloque no lo hace su dueño. Los bloques marcados «(plantilla)» son texto fijo: nunca son dueños. \`bloques_referencia\`: hasta tres bloques que podrían mencionarlo en una línea.
6. ALCANCE: «clima» si sirve para revelar riesgos y oportunidades relacionados con el clima o su gobierno, estrategia, gestión, métricas u objetivos (los órganos que los supervisan incluidos); «entidad» si es un dato propio de la emisora que da contexto al informe: quién es, qué hace, su perímetro, sus cifras de negocio (cartera, plantilla total, sucursales) y la composición de su Consejo y sus comités; «sostenibilidad_general» si trata otro tema de sostenibilidad (ética, denuncias, diversidad, personas, agua, residuos); «generico» si es una cláusula que tendría cualquier emisora (facultades legales del Consejo, formalidades de estatutos o de acta) y no dice nada propio de esta.`;

const NULLABLE = (t: object) => ({ anyOf: [t, { type: "null" }] });
const ESQUEMA = {
  type: "object",
  properties: {
    hechos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          oracion: { type: "string" },
          enunciado: { type: "string" },
          clave: { type: "string" },
          tipo: { type: "string", enum: TIPOS_HECHO },
          valor: NULLABLE({ type: "number" }),
          unidad: NULLABLE({ type: "string" }),
          periodo: NULLABLE({ type: "string" }),
          bloque_dueno: { type: "integer" },
          bloques_referencia: { type: "array", items: { type: "integer" } },
          alcance: { type: "string", enum: ["clima", "entidad", "sostenibilidad_general", "generico"] },
        },
        required: ["oracion", "enunciado", "clave", "tipo", "valor", "unidad", "periodo", "bloque_dueno", "bloques_referencia", "alcance"],
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
      [`## ${b.numero}. ${b.titulo}${b.plantilla ? " (plantilla)" : b.clase !== "normativo" ? " (editorial)" : ""}`, `Cubre: ${b.cubre}`, ...b.requisitos.map((r) => `- ${r.codigo}: ${r.descripcion}`)].join("\n")
    ),
  ].join("\n");
}

/** Lotes deterministas: fuentes completas en su orden, hasta el tope de caracteres por llamada. */
export function lotes(fuentes: FuenteEnOraciones[]): FuenteEnOraciones[][] {
  const out: FuenteEnOraciones[][] = [];
  let actual: FuenteEnOraciones[] = [];
  let tam = 0;
  for (const f of fuentes) {
    const largo = f.oraciones.reduce((a, o) => a + o.texto.length, 0);
    if (actual.length && tam + largo > CARACTERES_POR_LLAMADA) {
      out.push(actual);
      actual = [];
      tam = 0;
    }
    actual.push(f);
    tam += largo;
  }
  if (actual.length) out.push(actual);
  return out;
}

export type ResultadoLote = { hechos: HechoPropuesto[]; uso: Uso; costo: number; error?: string };

export async function clasificar(lote: FuenteEnOraciones[], bloques: BloqueCatalogo[], clavesUsadas: string[], apiKey: string): Promise<ResultadoLote> {
  const client = new Anthropic({ apiKey });
  const usuario = [
    clavesUsadas.length ? `# Claves ya usadas en este libro\n\n${[...clavesUsadas].sort().join(", ")}\n` : "",
    "# Fuentes",
    "",
    ...lote.map((f) =>
      [`## ${f.unidad.detalle} — ${esObligatoria(f.unidad) ? "OBLIGATORIA" : "FILTRADA"}; rango ${f.unidad.rango}; bloques sugeridos: ${f.unidad.sugeridos.join(", ") || "—"}`, ...f.oraciones.map((o) => `[${o.id}] ${o.texto}`), ""].join("\n")
    ),
    "Devuelve los hechos pertinentes con el esquema pedido.",
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
        output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
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
