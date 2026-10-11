import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { costoUsd, type Uso } from "@/lib/suplemento/modelos";
import { MODELO_LIBRO } from "./extraer";
import { normalizar } from "./verificar";
import type { HechoNuevo } from "./tipos";

// =============================================================================
// ORGANIGRAMA ESTRUCTURADO (libro de hechos, Paso 5b).
//
// Segunda revisión externa, bloque 18: el libro redujo la imagen del
// organigrama a dos rótulos y el bloque terminó diciendo que las direcciones
// estaban dentro del Comité. Aquí la imagen del Perfil se lee como ESTRUCTURA
// —nodo, padre, nivel— y cada nodo es un hecho del bloque 18: «la Dirección de
// Riesgos depende de la Dirección General».
//
// Verificación: el nombre de cada nodo tiene que estar en la transcripción de
// alguna imagen del Perfil que ya leyó la cola, o en el texto de gobierno del
// Perfil. Un nodo que no aparece en ninguna fuente de texto se descarta.
// =============================================================================

type Db = SupabaseClient<Database>;

const ESQUEMA = {
  type: "object",
  properties: {
    nodos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          padre: { anyOf: [{ type: "string" }, { type: "null" }] },
          nivel: { type: "integer" },
          tipo: { type: "string", enum: ["organo", "comite", "direccion", "area"] },
        },
        required: ["nombre", "padre", "nivel", "tipo"],
        additionalProperties: false,
      },
    },
  },
  required: ["nodos"],
  additionalProperties: false,
};

const SISTEMA = `Lees el organigrama de una emisora. Devuelve cada caja como un nodo: su nombre EXACTO tal como aparece en la imagen, el nombre exacto de la caja de la que depende (null para la raíz), su nivel (0 la raíz) y su tipo. Sigue las líneas: una dirección que cuelga de la Dirección General depende de ella aunque esté dibujada cerca de un comité. No inventes cajas ni nombres; el texto de notas al pie no es un nodo.`;

export type ResultadoOrganigrama = { hechos: HechoNuevo[]; uso: Uso; costo: number; error?: string };

export async function organigramaEnHechos(db: Db, tenantId: string, apiKey: string): Promise<ResultadoOrganigrama> {
  const vacio: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  const { data: perfil } = await db.from("perfil_emisor").select("organigrama_path, gobierno_texto").eq("tenant_id", tenantId).maybeSingle();
  if (!perfil?.organigrama_path) return { hechos: [], uso: vacio, costo: 0 };
  const { data: blob, error } = await db.storage.from("documentos").download(perfil.organigrama_path);
  if (error || !blob) return { hechos: [], uso: vacio, costo: 0, error: `organigrama: ${error?.message ?? "sin datos"}` };
  const ext = perfil.organigrama_path.toLowerCase().split(".").pop();
  const media = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";

  // Lo que sí es texto: las transcripciones de las imágenes del Perfil y el texto de gobierno.
  const { data: imgs } = await db.from("perfil_emisor_adjuntos_contenido").select("contenido").eq("tenant_id", tenantId).eq("tipo", "imagen").eq("estado", "extraido");
  const transcrito = normalizar(
    [...(imgs ?? []).map((i) => ((i.contenido as unknown as { paginas?: { texto: string }[] })?.paginas ?? []).map((p) => p.texto).join(" ")), perfil.gobierno_texto ?? ""].join(" ")
  );

  try {
    const client = new Anthropic({ apiKey });
    const m = await client.messages
      .stream(
        {
          model: MODELO_LIBRO,
          max_tokens: 8000,
          system: SISTEMA,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: media, data: Buffer.from(await blob.arrayBuffer()).toString("base64") } },
                { type: "text", text: "Devuelve los nodos del organigrama con el esquema pedido." },
              ],
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
    const texto = m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const r = JSON.parse(texto) as { nodos: { nombre: string; padre: string | null; nivel: number; tipo: string }[] };
    const slug = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);
    const hechos: HechoNuevo[] = (r.nodos ?? []).map((n) => {
      const nombre = n.nombre.replace(/\s+/g, " ").trim();
      const enTexto = transcrito.includes(normalizar(nombre));
      return {
        clave: `organigrama.${slug(nombre)}`,
        enunciado: n.padre ? `En el organigrama, «${nombre}» depende de «${n.padre.replace(/\s+/g, " ").trim()}» (nivel ${n.nivel}).` : `En el organigrama, «${nombre}» es el órgano superior (nivel ${n.nivel}).`,
        tipo: "composicion",
        valor: null,
        unidad: null,
        periodo: null,
        rango_fuente: "perfil",
        fuente_tipo: "perfil",
        fuente_id: "perfil:organigrama_path",
        fuente_detalle: "Perfil del emisor, organigrama (imagen)",
        extracto: nombre,
        verificado: enTexto,
        verificacion: enTexto ? "nombre: está en la transcripción de la imagen o en el texto de gobierno" : "descartado: el nombre no está en ninguna transcripción ni en el texto de gobierno",
        bloque_dueno: 18,
        bloques_referencia: [],
        estado: enTexto ? "vigente" : "descartado",
        oracion: `perfil:organigrama_path#${slug(nombre)}`,
        alcance: "clima",
      };
    });
    return { hechos, uso, costo: costoUsd(MODELO_LIBRO, uso) };
  } catch (e) {
    return { hechos: [], uso: vacio, costo: 0, error: `organigrama: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}` };
  }
}
