import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BLOQUES } from "@/lib/suplemento/bloques";
import { MODELO_POR_DEFECTO, costoUsd, type ClaveModelo, type Esfuerzo, type Uso } from "@/lib/suplemento/modelos";

// =============================================================================
// PASADA DE COHERENCIA DEL SUPLEMENTO — encargo suplemento-calidad, Paso 3 (d).
//
// Cada bloque lo escribe una llamada distinta, y ninguna ve a las demás. Lo que
// solo se nota leyendo el documento entero —un comité con dos nombres, el mismo
// párrafo en dos bloques, «como se describe en la sección X» cuando X no lo
// describe, una frase que anuncia una tabla y termina en pendiente— lo busca
// esta pasada: UNA llamada con el documento completo y salida estructurada.
//
// NO EDITA NADA. Devuelve observaciones para el revisor, que decide.
//
// Cada observación cita un fragmento LITERAL del bloque al que apunta, y eso se
// comprueba en código: una observación cuya cita no está en el bloque se
// descarta y se cuenta. Es la misma regla que las fuentes del generador: lo que
// el modelo afirma de un texto se puede verificar contra el texto.
//
// Los bloques con TEXTO DEL EMISOR (copiados literal de un adjunto) no se
// proponen para reescritura: solo se avisa si chocan con el resto, y la
// sugerencia apunta a los otros bloques.
// =============================================================================

type Cliente = SupabaseClient<Database>;

export const PROMPT_COHERENCIA_VERSION = "coherencia-v1-2026-10-06";
const MODELO: ClaveModelo = MODELO_POR_DEFECTO;
// `medium`: con `high` la prueba de las tres incoherencias las detectó igual,
// pero costó $1.52 y tardó 235 s, casi todo en razonamiento (23 mil tokens de
// salida). Medido en el registro del encargo (Paso 3).
const ESFUERZO: Esfuerzo = (process.env.COHERENCIA_ESFUERZO as Esfuerzo | undefined) ?? "medium";
/** Corte de la llamada: el documento entero es una lectura larga. */
const LIMITE_MS = 6 * 60 * 1000;
/** Una pasada `generando` más vieja que esto se da por muerta (proceso reiniciado). */
const GENERANDO_ABANDONADA_MS = 10 * 60 * 1000;

export const TIPOS = ["terminologia", "repeticion", "referencia_cruzada", "anuncio_de_pendiente", "contradiccion"] as const;
export type TipoObservacion = (typeof TIPOS)[number];

export const ETIQUETA_TIPO: Record<TipoObservacion, string> = {
  terminologia: "Terminología",
  repeticion: "Repetición entre bloques",
  referencia_cruzada: "Referencia cruzada",
  anuncio_de_pendiente: "Anuncia lo que termina en pendiente",
  contradiccion: "Contradicción entre bloques",
};

export type Observacion = {
  tipo: TipoObservacion;
  gravedad: "alta" | "media" | "baja";
  /** Bloques involucrados, el de la cita incluido. */
  bloques: number[];
  bloque_de_la_cita: number;
  /** Fragmento literal del bloque `bloque_de_la_cita`. */
  cita: string;
  observacion: string;
  sugerencia: string;
  /** Algún bloque involucrado es texto del emisor: no se propone reescribirlo. */
  afecta_texto_del_emisor: boolean;
};

export type BloqueParaCoherencia = {
  numero: number;
  titulo: string;
  seccion: string;
  texto: string;
  textoDelEmisor: boolean;
};

export type ResultadoCoherencia =
  | { ok: true; observaciones: Observacion[]; descartadas: number; modelo: ClaveModelo; uso: Uso; costo: number; duracionMs: number }
  | { ok: false; error: string; modelo: ClaveModelo; uso: Uso; costo: number; duracionMs: number };

const SISTEMA = `# Quién eres

Revisas la coherencia de un Suplemento de información a revelar bajo las Normas NIIF S1 y S2 de una emisora mexicana. El documento lo escribieron varias manos —cada bloque por separado— y tu trabajo es encontrar lo que solo se ve leyéndolo entero. No redactas ni corriges: señalas, con precisión, para que un revisor decida.

# Qué buscas (y solo esto)

1. **terminologia**: el mismo órgano, comité, dirección, política o concepto con nombres distintos entre bloques («Comité de Sostenibilidad» y «Comité de Sostenibilidad y Riesgos Climáticos»); términos fuera de la traducción oficial NIIF en español («Scope 2» en vez de «Alcance 2», «gases invernadero» en vez de «gases de efecto invernadero», «riesgos climáticos» donde el resto dice «riesgos relacionados con el clima» de forma sistemática); la emisora llamándose a sí misma de formas distintas a la forma de referencia indicada.
2. **repeticion**: el mismo contenido DESARROLLADO en dos o más bloques —el mismo párrafo, la misma descripción de un proceso, la misma lista de funciones— cuando debería estar en uno y el otro remitir. Mencionar de pasada lo que otro bloque desarrolla NO es repetición.
3. **referencia_cruzada**: el texto remite a otra sección, bloque, tabla o anexo («como se describe en la sección de Estrategia», «véase la tabla siguiente», «según se detalla en el apartado de Métricas») y ese lugar no existe en el documento o no contiene lo que se dice.
4. **anuncio_de_pendiente**: una frase anuncia o promete un contenido («a continuación se presenta», «la tabla siguiente muestra», «se detalla más adelante») y lo que sigue es un marcador [Pendiente: …] o no está.
5. **contradiccion**: dos bloques afirman cosas incompatibles sobre el mismo hecho (una frecuencia, un responsable, una fecha, un alcance).

# Qué NO es una observación

- Los marcadores [Pendiente: …] en sí: son huecos conocidos y el revisor ya los ve. Solo cuentan si algo los ANUNCIA (tipo 4).
- Preferencias de estilo, longitud, orden de párrafos, redacción mejorable.
- Lo que solo está en un bloque y no choca con nada.

# Bloques con TEXTO DEL EMISOR

Los bloques marcados «TEXTO DEL EMISOR» son texto que la emisora escribió y se publica tal cual. Nunca propongas cambiarlos. Solo señala si chocan con el resto del documento (terminología, contradicción, repetición), con \`afecta_texto_del_emisor\` = true y una sugerencia que actúe sobre LOS OTROS bloques.

# Cómo se escribe cada observación

- \`cita\`: un fragmento COPIADO CARÁCTER POR CARÁCTER del bloque \`bloque_de_la_cita\`, de 20 a 250 caracteres, sin puntos suspensivos ni cambios. Se comprueba contra el texto: una cita que no está ahí se descarta.
- \`bloques\`: todos los números de bloque involucrados, incluido el de la cita.
- \`observacion\`: qué es incoherente y con qué, en una o dos frases, nombrando los bloques.
- \`sugerencia\`: qué podría hacer el revisor (unificar el nombre a X, dejar el desarrollo en el bloque N y remitir desde el M, quitar el anuncio). No reescribas párrafos.
- \`gravedad\`: alta si un lector del informe publicado lo notaría como error (contradicción, referencia a algo que no existe, anuncio de algo que no está); media si afecta la consistencia (terminología, repetición); baja si es menor.

Una observación por problema: si el mismo nombre distinto aparece en cinco bloques, es UNA observación con los cinco bloques. Si no hay nada, devuelve la lista vacía. Como máximo 40.`;

const ESQUEMA = {
  type: "object" as const,
  properties: {
    observaciones: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          tipo: { type: "string" as const, enum: [...TIPOS] },
          gravedad: { type: "string" as const, enum: ["alta", "media", "baja"] },
          bloques: { type: "array" as const, items: { type: "integer" as const } },
          bloque_de_la_cita: { type: "integer" as const },
          cita: { type: "string" as const },
          observacion: { type: "string" as const },
          sugerencia: { type: "string" as const },
          afecta_texto_del_emisor: { type: "boolean" as const },
        },
        required: ["tipo", "gravedad", "bloques", "bloque_de_la_cita", "cita", "observacion", "sugerencia", "afecta_texto_del_emisor"],
        additionalProperties: false as const,
      },
    },
  },
  required: ["observaciones"],
  additionalProperties: false as const,
};

export function documentoParaRevision(
  bloques: BloqueParaCoherencia[],
  emisora: { denominacionFormal: string | null; formaDeReferencia: string | null }
): string {
  const partes = [
    "# La emisora",
    "",
    `Denominación formal: «${emisora.denominacionFormal ?? "—"}». Forma de referencia: «${emisora.formaDeReferencia ?? "—"}».`,
    "",
    `# El documento: ${bloques.length} bloques, en orden`,
    "",
  ];
  for (const b of bloques) {
    partes.push(
      `=== Bloque ${b.numero} · ${b.titulo} (${b.seccion})${b.textoDelEmisor ? " · TEXTO DEL EMISOR: se publica tal cual, no se reescribe" : ""}`,
      "",
      b.texto.trim(),
      ""
    );
  }
  partes.push("Devuelve las observaciones con el esquema pedido.");
  return partes.join("\n");
}

const normalizar = (t: string) => t.replace(/\*\*/g, "").replace(/[“”«»"]/g, '"').replace(/[‘’']/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

/** Se queda con las observaciones cuya cita está en el bloque que dicen. */
export function verificarObservaciones(
  crudas: Observacion[],
  bloques: BloqueParaCoherencia[]
): { validas: Observacion[]; descartadas: number } {
  const porNumero = new Map(bloques.map((b) => [b.numero, b]));
  const validas: Observacion[] = [];
  let descartadas = 0;
  for (const o of crudas) {
    const b = porNumero.get(o.bloque_de_la_cita);
    const cita = normalizar(o.cita).replace(/^\.{3}|\.{3}$|…/g, "").trim();
    if (!b || cita.length < 10 || !normalizar(b.texto).includes(cita)) {
      descartadas++;
      continue;
    }
    const involucrados = [...new Set([o.bloque_de_la_cita, ...o.bloques])].filter((n) => porNumero.has(n)).sort((x, y) => x - y);
    validas.push({
      ...o,
      bloques: involucrados,
      afecta_texto_del_emisor: o.afecta_texto_del_emisor || involucrados.some((n) => porNumero.get(n)!.textoDelEmisor),
    });
  }
  return { validas, descartadas };
}

/** La llamada. Sin base de datos: la usan la pasada y la prueba con incoherencias. */
export async function revisarCoherencia(
  bloques: BloqueParaCoherencia[],
  emisora: { denominacionFormal: string | null; formaDeReferencia: string | null },
  apiKey: string
): Promise<ResultadoCoherencia> {
  const inicio = Date.now();
  const vacio: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  const client = new Anthropic({ apiKey });
  const reloj = new AbortController();
  const alarma = setTimeout(() => reloj.abort(), LIMITE_MS);
  let m: Anthropic.Message;
  try {
    const stream = client.messages.stream(
      {
        model: MODELO,
        max_tokens: 32000,
        system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: documentoParaRevision(bloques, emisora) }],
        thinking: { type: "adaptive" },
        output_config: { effort: ESFUERZO, format: { type: "json_schema", schema: ESQUEMA } },
      },
      { timeout: LIMITE_MS, maxRetries: 0, signal: reloj.signal }
    );
    m = await stream.finalMessage();
  } catch (e) {
    const error = reloj.signal.aborted ? `corte por tiempo (${LIMITE_MS / 1000} s)` : e instanceof Error ? e.message : String(e);
    return { ok: false, error, modelo: MODELO, uso: vacio, costo: 0, duracionMs: Date.now() - inicio };
  } finally {
    clearTimeout(alarma);
  }
  const uso: Uso = {
    entrada: m.usage.input_tokens ?? 0,
    cacheEscritura: m.usage.cache_creation_input_tokens ?? 0,
    cacheLectura: m.usage.cache_read_input_tokens ?? 0,
    salida: m.usage.output_tokens ?? 0,
  };
  const costo = costoUsd(MODELO, uso);
  const duracionMs = Date.now() - inicio;
  const crudo = m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
  let lista: Observacion[];
  try {
    lista = (JSON.parse(crudo) as { observaciones: Observacion[] }).observaciones;
    if (!Array.isArray(lista)) throw new Error("sin lista");
  } catch {
    return { ok: false, error: `La respuesta no vino en el esquema pedido (stop_reason: ${m.stop_reason}).`, modelo: MODELO, uso, costo, duracionMs };
  }
  const { validas, descartadas } = verificarObservaciones(lista, bloques);
  return { ok: true, observaciones: validas, descartadas, modelo: MODELO, uso, costo, duracionMs };
}

// -----------------------------------------------------------------------------
// La pasada sobre un documento guardado
// -----------------------------------------------------------------------------

/** Los bloques que van al documento: con texto, sin no_aplica ni no_seleccionado. */
async function bloquesDelDocumento(supabase: Cliente, documentoId: string): Promise<BloqueParaCoherencia[]> {
  const { data } = await supabase
    .from("documentos_bloques")
    .select("numero, titulo, seccion, estado, texto, texto_del_emisor")
    .eq("documento_id", documentoId)
    .order("numero");
  const orden = new Map(BLOQUES.map((b, i) => [b.numero, i]));
  return (data ?? [])
    .filter((b) => b.texto && b.texto.trim() && !["no_aplica", "no_seleccionado", "error"].includes(b.estado))
    .sort((a, b) => (orden.get(a.numero) ?? 0) - (orden.get(b.numero) ?? 0))
    .map((b) => ({ numero: b.numero, titulo: b.titulo, seccion: b.seccion ?? "", texto: b.texto!, textoDelEmisor: b.texto_del_emisor }));
}

export type Reclamo = { ok: true; id: string } | { ok: false; status: number; error: string };

/**
 * Abre una pasada `generando`. El índice único parcial impide dos a la vez por
 * documento; una que lleva más de diez minutos así se da por muerta.
 */
export async function reclamarPasada(
  supabase: Cliente,
  documentoId: string,
  origen: "fin_de_generacion" | "manual",
  perfilId: string
): Promise<Reclamo> {
  const { data: doc } = await supabase.from("documentos_generados").select("id, tenant_id").eq("id", documentoId).maybeSingle();
  if (!doc) return { ok: false, status: 404, error: "El documento no existe o no es visible." };
  const bloques = await bloquesDelDocumento(supabase, documentoId);
  if (bloques.length < 2) return { ok: false, status: 422, error: "El documento no tiene bloques con texto que revisar." };
  const corte = new Date(Date.now() - GENERANDO_ABANDONADA_MS).toISOString();
  await supabase
    .from("observaciones_coherencia")
    .update({ estado: "error", error: "La pasada se interrumpió (proceso reiniciado).", terminado_en: new Date().toISOString() })
    .eq("documento_id", documentoId)
    .eq("estado", "generando")
    .lt("created_at", corte);
  const { data, error } = await supabase
    .from("observaciones_coherencia")
    .insert({ documento_id: documentoId, tenant_id: doc.tenant_id, origen, solicitado_por: perfilId, bloques_revisados: bloques.length, prompt_version: PROMPT_COHERENCIA_VERSION, modelo: MODELO })
    .select("id")
    .single();
  if (error || !data) {
    return error?.code === "23505"
      ? { ok: false, status: 409, error: "Ya hay una pasada de coherencia en curso para este documento." }
      : { ok: false, status: 500, error: `No se pudo abrir la pasada: ${error?.message ?? "sin fila"}` };
  }
  return { ok: true, id: data.id };
}

/** Corre la pasada reclamada y la guarda, con su costo. No toca los bloques. */
export async function completarPasada(supabase: Cliente, pasadaId: string, documentoId: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fin = (cambios: Record<string, unknown>) =>
    supabase.from("observaciones_coherencia").update({ ...cambios, terminado_en: new Date().toISOString() }).eq("id", pasadaId);
  if (!apiKey) {
    await fin({ estado: "error", error: "Falta ANTHROPIC_API_KEY." });
    return;
  }
  try {
    const { data: doc } = await supabase.from("documentos_generados").select("tenant_id").eq("id", documentoId).single();
    const { data: perfil } = await supabase
      .from("perfil_emisor")
      .select("denominacion_formal, forma_de_referencia")
      .eq("tenant_id", doc!.tenant_id)
      .maybeSingle();
    const bloques = await bloquesDelDocumento(supabase, documentoId);
    const r = await revisarCoherencia(
      bloques,
      { denominacionFormal: perfil?.denominacion_formal ?? null, formaDeReferencia: perfil?.forma_de_referencia ?? null },
      apiKey
    );
    const metricas = {
      modelo: r.modelo,
      bloques_revisados: bloques.length,
      tokens_entrada: r.uso.entrada,
      tokens_entrada_cache_escritura: r.uso.cacheEscritura,
      tokens_entrada_cache_lectura: r.uso.cacheLectura,
      tokens_salida: r.uso.salida,
      costo_usd: r.costo,
      duracion_ms: r.duracionMs,
    };
    if (!r.ok) {
      console.error(`[coherencia] documento ${documentoId.slice(0, 8)}: ${r.error.slice(0, 300)}`);
      await fin({ ...metricas, estado: "error", error: r.error.slice(0, 300) });
      return;
    }
    await fin({ ...metricas, estado: "lista", observaciones: r.observaciones, descartadas: r.descartadas, error: null });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[coherencia] documento ${documentoId.slice(0, 8)}: ${error.slice(0, 300)}`);
    await fin({ estado: "error", error: error.slice(0, 300) });
  }
}
