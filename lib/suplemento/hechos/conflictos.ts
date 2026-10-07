import "server-only";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { costoUsd, type Uso } from "@/lib/suplemento/modelos";
import { MODELO_LIBRO } from "./extraer";
import type { HechoNuevo } from "./tipos";

// =============================================================================
// CONTRADICCIONES DECIDIDAS UNA SOLA VEZ, EN EL LIBRO (Paso 5b).
//
// Segunda revisión externa: «Hoy el libro dice 0 y el bloque dice 4». Desde
// aquí decide UNA instancia —el libro— y el bloque solo recibe el veredicto:
//   · excluyente: los dos hechos no pueden ser ciertos a la vez y no hay
//     redacción compatible con ambos → marcador de pendiente y nota;
//   · compatible: pueden serlo los dos (el Comité evalúa y propone, el Consejo
//     decide) → se redacta conciliado, con la redacción que da el libro, y va a
//     notas;
//   · secuencia: son momentos de una misma cronología (propuesta → creación →
//     instalación → sesiones) → también se redacta conciliado.
// El umbral de pendiente es «excluyente»: lo demás no llena el texto de
// marcadores triviales.
//
// Qué se compara: los hechos de un mismo bloque dueño que vienen de documentos
// distintos, y los de una misma clave en bloques distintos. Las páginas de un
// mismo PDF son un documento: dentro de un acta, el acuerdo resuelve su
// propuesta. Una sola llamada para todo el libro.
// =============================================================================

export type ResultadoConflictos = { grupos: number; excluyentes: number; conciliados: number; enConflicto: number; uso: Uso; costo: number; error?: string };

/** El documento de una fuente: las páginas de un mismo adjunto son UN documento. */
export function documentoDe(fuenteId: string): string {
  return fuenteId.startsWith("adj:") ? fuenteId.split(":").slice(0, 2).join(":") : fuenteId;
}

/** Una explicación que se desmiente a sí misma no sostiene un veredicto «excluyente». */
const SE_DESMIENTE = /no hay (una )?contradicci[oó]n|no (es|son) incompatibles?|son compatibles|no se contradicen|no existe contradicci[oó]n/i;

const ESQUEMA = {
  type: "object",
  properties: {
    decisiones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hechos: { type: "array", items: { type: "string" } },
          veredicto: { type: "string", enum: ["excluyente", "compatible", "secuencia"] },
          explicacion: { type: "string" },
          conciliacion: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["hechos", "veredicto", "explicacion", "conciliacion"],
        additionalProperties: false,
      },
    },
  },
  required: ["decisiones"],
  additionalProperties: false,
};

const SISTEMA = `Recibes hechos de una emisora agrupados por bloque del informe; cada uno con su id (H1, H2…), su rango de fuente y su fuente. Busca los grupos de hechos que un lector vería en tensión —hablan de lo mismo y dicen algo distinto— y decide UNA vez:

- «excluyente»: no pueden ser ciertos a la vez y no existe una redacción que respete ambos. Tres casos que SIEMPRE son excluyentes:
  1. otra cifra, fecha o frecuencia para lo mismo;
  2. la MISMA facultad atribuida a dos órganos: «el Comité aprueba la estrategia» frente a «el Comité la propone y el Consejo la aprueba» (solo uno aprueba);
  3. algo que una fuente da por HECHO (se impartió, se contrató, se aprobó) y que los documentos solo registran como propuesta o recomendación, sin ningún documento que registre que ocurrió: falta la constancia.
- «secuencia»: momentos de una misma cronología que los DOCUMENTOS registran —el acta de una sesión registra la propuesta y otra acta registra la instalación o el acuerdo que la resolvió—. Solo es secuencia si un documento registra el paso posterior; si el paso posterior solo lo afirma una respuesta o un campo del Perfil, es el caso 3 de «excluyente». Escribe en «conciliacion» la oración que los ordena.
- «compatible»: pueden ser ciertos los dos porque hablan de funciones distintas sobre el mismo asunto (el Comité evalúa y propone, el Consejo decide) o porque uno solo es más detallado. Escribe en «conciliacion» UNA oración que diga ambos sin agregar nada que no esté en los hechos.

Devuelve SOLO los grupos en tensión; si no hay ninguno, la lista vacía. En «explicacion», una frase que nombre las fuentes POR SU NOMBRE (archivo, extracto confirmado, campo del Perfil; nunca por su id) y la diferencia. Para «excluyente», «conciliacion» es null.`;

export async function decidirContradicciones(hechos: HechoNuevo[], apiKey: string): Promise<ResultadoConflictos> {
  const vacio: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  const vigentes = hechos.filter((h) => h.estado === "vigente" && h.bloque_dueno != null);
  const secciones: { titulo: string; hechos: HechoNuevo[] }[] = [];
  const porBloque = new Map<number, HechoNuevo[]>();
  for (const h of vigentes) porBloque.set(h.bloque_dueno!, [...(porBloque.get(h.bloque_dueno!) ?? []), h]);
  for (const [n, g] of [...porBloque].sort((a, b) => a[0] - b[0])) {
    if (new Set(g.map((h) => documentoDe(h.fuente_id))).size > 1) secciones.push({ titulo: `Bloque ${n}`, hechos: g });
  }
  const porClave = new Map<string, HechoNuevo[]>();
  for (const h of vigentes) porClave.set(h.clave, [...(porClave.get(h.clave) ?? []), h]);
  for (const [clave, g] of [...porClave].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (new Set(g.map((h) => h.bloque_dueno)).size > 1 && new Set(g.map((h) => documentoDe(h.fuente_id))).size > 1) secciones.push({ titulo: `Misma clave en bloques distintos · ${clave}`, hechos: g });
  }
  if (!secciones.length) return { grupos: 0, excluyentes: 0, conciliados: 0, enConflicto: 0, uso: vacio, costo: 0 };

  const ids = new Map<string, HechoNuevo>();
  const idDe = new Map<HechoNuevo, string>();
  for (const s of secciones) for (const h of s.hechos) if (!idDe.has(h)) { const id = `H${idDe.size + 1}`; idDe.set(h, id); ids.set(id, h); }
  const usuario = secciones
    .map((s) => [`## ${s.titulo}`, ...s.hechos.map((h) => `[${idDe.get(h)}] (${h.rango_fuente}; ${h.fuente_detalle}) ${h.enunciado}`)].join("\n"))
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
          // «high»: una sola llamada por libro, y de su veredicto depende si un bloque marca pendiente o concilia.
          output_config: { effort: "high", format: { type: "json_schema", schema: ESQUEMA } },
        },
        { timeout: 240_000, maxRetries: 1 }
      )
      .finalMessage();
    const uso: Uso = {
      entrada: m.usage.input_tokens ?? 0,
      cacheEscritura: m.usage.cache_creation_input_tokens ?? 0,
      cacheLectura: m.usage.cache_read_input_tokens ?? 0,
      salida: m.usage.output_tokens ?? 0,
    };
    const texto = m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const r = JSON.parse(texto) as { decisiones: { hechos: string[]; veredicto: "excluyente" | "compatible" | "secuencia"; explicacion: string; conciliacion: string | null }[] };
    let excluyentes = 0;
    let conciliados = 0;
    let enConflicto = 0;
    let grupos = 0;
    for (const d of r.decisiones ?? []) {
      const miembros = [...new Set(d.hechos)].map((id) => ids.get(id)).filter((h): h is HechoNuevo => !!h);
      if (miembros.length < 2 || new Set(miembros.map((h) => documentoDe(h.fuente_id))).size < 2) continue;
      // Un «excluyente» cuya explicación dice que no hay contradicción no se sostiene: pasa a compatible sin conciliación.
      const veredicto = d.veredicto === "excluyente" && SE_DESMIENTE.test(d.explicacion) ? "compatible" : d.veredicto;
      const explicacion = d.explicacion.replace(/\bH(\d+)\b/g, (x) => (ids.get(x) ? `«${ids.get(x)!.fuente_detalle}»` : x));
      const grupo = miembros.find((h) => h.grupo_conflicto)?.grupo_conflicto ?? randomUUID();
      for (const h of miembros) {
        h.grupo_conflicto = grupo;
        h.veredicto = veredicto;
        h.conflicto = explicacion;
        if (veredicto === "excluyente") {
          if (h.estado !== "en_conflicto") enConflicto++;
          h.estado = "en_conflicto";
        } else {
          h.conciliacion = d.conciliacion ?? null;
        }
      }
      grupos++;
      if (veredicto === "excluyente") excluyentes++;
      else conciliados++;
    }
    return { grupos, excluyentes, conciliados, enConflicto, uso, costo: costoUsd(MODELO_LIBRO, uso) };
  } catch (e) {
    return { grupos: 0, excluyentes: 0, conciliados: 0, enConflicto: 0, uso: vacio, costo: 0, error: e instanceof Error ? e.message.slice(0, 300) : String(e) };
  }
}
