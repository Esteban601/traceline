import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { costoUsd, MODELOS, type ClaveModelo } from "@/lib/suplemento/modelos";

// =============================================================================
// LECTURA POR VISIÓN — PDF escaneado e imágenes (encargo captura sugerida §2).
//
// Aquí solo se TRANSCRIBE: el modelo copia lo que ve, página por página, sin
// interpretar ni elegir cifras. Elegir la cifra que pide una solicitud es la
// sugerencia (Paso 2), que trabaja sobre este texto guardado y cita su página.
// Separarlo es lo que permite leer el archivo una sola vez (encargo §3).
//
// Modelo: Sonnet 5.5 (decisión del Paso 0). Esfuerzo `low`: transcribir no
// necesita razonar, y el esfuerzo es lo que más mueve el costo de salida.
// `fallbacks: "default"` (beta server-side-fallback-2026-07-01): si el modelo
// declinara una página, el servidor la reintenta con otro dentro de la misma
// llamada; el costo se calcula con el modelo que respondió.
// =============================================================================

export const MODELO_LECTURA: ClaveModelo = "claude-sonnet-5-5";

const SISTEMA = [
  "Eres un transcriptor de documentos de sustento para un informe de sostenibilidad.",
  "Transcribe FIELMENTE todo el texto visible, en el idioma original, sin traducir, resumir, corregir ni interpretar.",
  "Conserva cada número exactamente como aparece: separadores de miles, decimales, signos, porcentajes y unidades.",
  "Las tablas van fila por fila, con las celdas separadas por \" | \" y la fila de encabezados primero.",
  "Si un fragmento no se puede leer, escribe [ilegible] en su lugar; nunca lo reconstruyas.",
  "Si la imagen está girada o torcida, transcribe en el orden de lectura natural del documento.",
].join(" ");

const ESQUEMA = {
  type: "object",
  properties: {
    paginas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pagina: { type: "integer" },
          texto: { type: "string" },
        },
        required: ["pagina", "texto"],
        additionalProperties: false,
      },
    },
  },
  required: ["paginas"],
  additionalProperties: false,
} as const;

export type PaginaTranscrita = { pagina: number; texto: string };
export type ResultadoVision = {
  paginas: PaginaTranscrita[];
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  costoUsd: number;
};

export class LecturaRechazada extends Error {}

/**
 * Transcribe un PDF (bloque `document`) o una imagen (bloque `image`).
 * `numeracion` son las páginas ORIGINALES que corresponden, en orden, a las del
 * archivo enviado (cuando se manda solo un subconjunto de un PDF).
 */
export async function transcribir(
  entrada:
    | { tipo: "pdf"; base64: string; numeracion: number[] }
    | { tipo: "imagen"; base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp" }
): Promise<ResultadoVision> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY para la lectura por visión.");
  const client = new Anthropic({ apiKey });

  const instruccion =
    entrada.tipo === "pdf"
      ? `Transcribe cada página de este PDF. Sus páginas corresponden, en orden, a las páginas ${entrada.numeracion.join(", ")} del documento original: usa ESE número en "pagina".`
      : 'Transcribe esta imagen completa como una sola página con "pagina": 1.';

  const bloqueArchivo: Anthropic.Beta.BetaContentBlockParam =
    entrada.tipo === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: entrada.base64 } }
      : { type: "image", source: { type: "base64", media_type: entrada.mediaType, data: entrada.base64 } };

  const stream = client.beta.messages.stream({
    model: MODELO_LECTURA,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SISTEMA,
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    messages: [{ role: "user", content: [bloqueArchivo, { type: "text", text: instruccion }] }],
  });
  const respuesta = await stream.finalMessage();

  if (respuesta.stop_reason === "refusal") {
    throw new LecturaRechazada(
      `El modelo declinó leer el archivo${respuesta.stop_details?.category ? ` (${respuesta.stop_details.category})` : ""}.`
    );
  }
  if (respuesta.stop_reason === "max_tokens") {
    throw new Error("La transcripción no cupo en la respuesta (max_tokens); el archivo es demasiado denso.");
  }
  const texto = respuesta.content.find((b) => b.type === "text");
  if (!texto || texto.type !== "text") throw new Error("La respuesta de visión no trajo texto.");
  const salida = JSON.parse(texto.text) as { paginas: PaginaTranscrita[] };

  const u = respuesta.usage;
  const modelo = (respuesta.model in MODELOS ? respuesta.model : MODELO_LECTURA) as ClaveModelo;
  return {
    paginas: salida.paginas,
    modelo: respuesta.model,
    tokensEntrada: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    tokensSalida: u.output_tokens ?? 0,
    costoUsd: costoUsd(modelo, {
      entrada: u.input_tokens ?? 0,
      cacheEscritura: u.cache_creation_input_tokens ?? 0,
      cacheLectura: u.cache_read_input_tokens ?? 0,
      salida: u.output_tokens ?? 0,
    }),
  };
}
