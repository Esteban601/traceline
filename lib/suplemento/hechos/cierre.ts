import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BLOQUES } from "@/lib/suplemento/bloques";
import { costoUsd, type Uso } from "@/lib/suplemento/modelos";
import { MODELO_LIBRO } from "./extraer";
import { validarCruzado } from "./cruzado";

// =============================================================================
// CIERRE DE PENDIENTES POR CÓDIGO, VERIFICADO (Paso 5c; verificación autorizada
// por Esteban el 8 de octubre de 2026).
//
// Si un bloque marca pendiente algo que otro bloque afirma con un hecho del que
// es DUEÑO, Sonnet 5.5 lee el pendiente y el texto del bloque dueño y dice si lo
// RESPONDE, lo responde en PARTE o NO lo responde (con las señales de palabras
// solas acertaba 3 de 5). Después, por código:
//   · «responde»: el marcador se sustituye por una remisión al bloque dueño
//     (toda la oración → «Esta información se presenta en la sección «…».»;
//     dentro de una oración → «(véase la sección «…»)»);
//   · «parcial»: el pendiente se queda y la remisión va como nota al revisor;
//   · «no responde»: nada cambia.
// El bloque se guarda con origen «automatica» (versión en el historial) y la
// nota lleva la verificación. Idempotente: un marcador cerrado ya no está.
// =============================================================================

type Db = SupabaseClient<Database>;
export type Veredicto = "responde" | "parcial" | "no_responde";
export type Cierre = { bloque: number; dueno: number; marcador: string; veredicto: Veredicto; razon: string };
export type ResultadoCierre = { cierres: Cierre[]; uso: Uso; costo: number };

const tituloDe = (n: number) => BLOQUES.find((b) => b.numero === n)?.titulo ?? `bloque ${n}`;
const normal = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** El texto con el marcador sustituido por la remisión. Exportada para la prueba. */
export function sustituirMarcador(texto: string, marcador: string, titulo: string): string {
  const i = texto.indexOf(marcador);
  if (i < 0) return texto;
  const inicio = Math.max(texto.lastIndexOf(". ", i) + 2, texto.lastIndexOf("\n", i) + 1, 0);
  const finPunto = texto.indexOf(".", i + marcador.length);
  const fin = finPunto < 0 ? texto.length : finPunto + 1;
  const resto = `${texto.slice(inicio, i)}${texto.slice(i + marcador.length, fin)}`.replace(/[\s.,;:]+/g, " ").trim();
  if (resto.split(" ").filter(Boolean).length < 4) {
    return `${texto.slice(0, inicio)}Esta información se presenta en la sección «${titulo}».${texto.slice(fin)}`;
  }
  const antes = texto.slice(0, i).replace(/\s+(?:de|del|a|al|en|con|por|para|sobre)\s*$/i, "");
  return `${antes} (véase la sección «${titulo}»)${texto.slice(i + marcador.length)}`.replace(/\s+\)/g, ")").replace(/\(\s+/g, "(");
}

const ESQUEMA = {
  type: "object",
  properties: {
    veredicto: { type: "string", enum: ["responde", "parcial", "no_responde"] },
    razon: { type: "string" },
  },
  required: ["veredicto", "razon"],
  additionalProperties: false,
};

const SISTEMA = `Revisas un informe de sostenibilidad. Un bloque dejó un PENDIENTE (lo que dice que falta). Otro bloque del mismo informe dice algo parecido. Decide si un lector que va a esa sección encuentra lo que el requisito detrás del pendiente necesita:
- «responde»: la sección da lo CENTRAL que se pide (el dato, la definición, la escala o la descripción), aunque el pendiente pida además algo accesorio (una justificación, un matiz, una aclaración sobre un defecto de la fuente). Remitir ahí deja el requisito atendido.
- «parcial»: la sección da algo del tema, pero falta una parte CENTRAL de lo que se pide (por ejemplo, el pendiente pide dos cosas sustantivas y solo está una).
- «no_responde»: habla del mismo tema pero no da lo que se pide, o habla de otra cosa.
Juzga por el sentido, no por palabras en común. En «razon», una oración que diga qué da y qué falta.`;

/** Verificación de un cierre. Exportada para la prueba de los casos. */
export async function verificarCierre(
  pendiente: string,
  titulo: string,
  textoDueno: string,
  apiKey: string
): Promise<{ veredicto: Veredicto; razon: string; uso: Uso }> {
  const client = new Anthropic({ apiKey });
  const m = await client.messages
    .stream(
      {
        model: MODELO_LIBRO,
        max_tokens: 4000,
        system: SISTEMA,
        messages: [
          {
            role: "user",
            content: `# Pendiente\n\n${pendiente}\n\n# Texto de la sección «${titulo}»\n\n${textoDueno.replace(/\[Pendiente:[^\]]*\]/g, "[pendiente]").slice(0, 12000)}\n\n¿Lo responde?`,
          },
        ],
        output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      },
      { timeout: 120_000, maxRetries: 1 }
    )
    .finalMessage();
  const uso: Uso = {
    entrada: m.usage.input_tokens ?? 0,
    cacheEscritura: m.usage.cache_creation_input_tokens ?? 0,
    cacheLectura: m.usage.cache_read_input_tokens ?? 0,
    salida: m.usage.output_tokens ?? 0,
  };
  const r = JSON.parse(m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("")) as { veredicto: Veredicto; razon: string };
  return { ...r, uso };
}

export async function cerrarPendientes(db: Db, documentoId: string): Promise<ResultadoCierre> {
  const vacio: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { cierres: [], uso: vacio, costo: 0 };
  const candidatos = (await validarCruzado(db, documentoId)).filter((d) => d.tipo === "pendiente_de_afirmado" && d.duenoAfirma && d.marcador && d.otroBloque != null);
  const { data: filas } = await db.from("documentos_bloques").select("numero, texto, pendientes").eq("documento_id", documentoId);
  const textoDe = new Map((filas ?? []).map((f) => [f.numero, f.texto ?? ""]));
  let uso = vacio;
  const cierres: Cierre[] = [];
  const porBloque = new Map<number, typeof candidatos>();
  for (const d of candidatos) porBloque.set(d.bloque, [...(porBloque.get(d.bloque) ?? []), d]);
  for (const [numero, ds] of porBloque) {
    const fila = (filas ?? []).find((f) => f.numero === numero);
    if (!fila?.texto) continue;
    let texto = fila.texto;
    const notas: { campo: string; motivo: string; cubeta: string; etiqueta: null }[] = [];
    const cerrados: string[] = [];
    for (const d of ds) {
      if (!texto.includes(d.marcador!)) continue;
      const titulo = tituloDe(d.otroBloque!);
      let v: Awaited<ReturnType<typeof verificarCierre>>;
      try {
        v = await verificarCierre(d.marcador!, titulo, textoDe.get(d.otroBloque!) ?? "", apiKey);
      } catch {
        continue; // sin verificación no se cierra
      }
      uso = { entrada: uso.entrada + v.uso.entrada, cacheEscritura: uso.cacheEscritura + v.uso.cacheEscritura, cacheLectura: uso.cacheLectura + v.uso.cacheLectura, salida: uso.salida + v.uso.salida };
      cierres.push({ bloque: numero, dueno: d.otroBloque!, marcador: d.marcador!, veredicto: v.veredicto, razon: v.razon });
      if (v.veredicto === "responde") {
        texto = sustituirMarcador(texto, d.marcador!, titulo);
        cerrados.push(d.marcador!);
        notas.push({
          campo: "nota_revision",
          cubeta: "decision_emisor",
          etiqueta: null,
          motivo: `Cierre automático: el pendiente «${d.marcador!.slice(0, 160)}» se sustituyó por una remisión al bloque ${d.otroBloque} («${titulo}»). Verificación (Sonnet 5.5): responde — ${v.razon}`,
        });
      } else if (v.veredicto === "parcial") {
        notas.push({
          campo: "nota_revision",
          cubeta: "decision_emisor",
          etiqueta: null,
          motivo: `Remisión posible: el bloque ${d.otroBloque} («${titulo}») responde en parte el pendiente «${d.marcador!.slice(0, 160)}». Verificación (Sonnet 5.5): parcial — ${v.razon}. El pendiente se queda.`,
        });
      }
    }
    if (!notas.length) continue;
    const pendientes = ((fila.pendientes ?? []) as { campo: string; motivo: string }[]).filter(
      (p) => p.campo !== "bloque" || !cerrados.some((m) => normal(m).includes(normal(p.motivo).replace(/^\[?pendiente:\s*/, "").slice(0, 60)))
    );
    await db
      .from("documentos_bloques")
      .update({ texto, pendientes: [...pendientes, ...notas] as never, origen_texto: "automatica", updated_at: new Date().toISOString() })
      .eq("documento_id", documentoId)
      .eq("numero", numero);
  }
  return { cierres, uso, costo: costoUsd(MODELO_LIBRO, uso) };
}
