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
// TRES VOTOS, CONSOLIDADOS POR PAR (estabilidad, cierre del 5b): una sola
// llamada daba 14 grupos en una corrida y 5 en la otra; armar los grupos por
// código perdía c2 y c4 (oraciones largas con poco traslape). Ahora el modelo ve
// lo mismo que en la v7 —los hechos de cada bloque dueño de más de un
// documento, y los de una misma clave en bloques distintos— en tres llamadas
// independientes. Un PAR de hechos queda en tensión si al menos dos votos lo
// ponen en un mismo grupo; su veredicto es el de la mayoría de esos votos (en
// empate, el más severo). Los grupos son la unión de pares y llevan el veredicto
// más severo de sus pares. Lo que aparece en un solo voto, no entra. Las
// páginas de un mismo PDF son un documento: dentro de un acta, el acuerdo
// resuelve su propuesta.
// =============================================================================

export type ResultadoConflictos = { grupos: number; excluyentes: number; conciliados: number; enConflicto: number; porConciliar?: number; uso: Uso; costo: number; error?: string };

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
          grupo: { type: "string" },
          veredicto: { type: "string", enum: ["excluyente", "compatible", "secuencia"] },
          hechos: { type: "array", items: { type: "string" } },
          explicacion: { type: "string" },
          conciliacion: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["grupo", "veredicto", "hechos", "explicacion", "conciliacion"],
        additionalProperties: false,
      },
    },
  },
  required: ["decisiones"],
  additionalProperties: false,
};

const SISTEMA = `Recibes hechos de una emisora agrupados por bloque del informe; cada uno con su id (H1, H2…), su rango de fuente y su fuente. Busca los grupos de hechos que un lector vería en tensión —hablan de lo mismo y dicen algo distinto— y decide UNA vez cada uno. Devuelve SOLO los grupos en tensión, cada uno con un nombre corto en «grupo» (G1, G2…):
- «excluyente»: no pueden ser ciertos a la vez y no existe una redacción que respete ambos. Tres casos que SIEMPRE son excluyentes:
  1. otra cifra, fecha o frecuencia para lo mismo;
  2. la MISMA facultad atribuida a dos órganos: «el Comité aprueba la estrategia» frente a «el Comité la propone y el Consejo la aprueba» (solo uno aprueba);
  3. algo que una fuente da por HECHO (se impartió, se contrató, se aprobó) y que los documentos solo registran como propuesta o recomendación, sin ningún documento que registre que ocurrió: falta la constancia.
- «secuencia»: momentos de una misma cronología que los DOCUMENTOS registran —el acta de una sesión registra la propuesta y otra acta registra la instalación o el acuerdo que la resolvió—. Solo es secuencia si un documento registra el paso posterior; si el paso posterior solo lo afirma una respuesta o un campo del Perfil, es el caso 3 de «excluyente». Escribe en «conciliacion» la oración que los ordena.
- «compatible»: pueden ser ciertos los dos porque hablan de funciones distintas sobre el mismo asunto (el Comité evalúa y propone, el Consejo decide) o porque uno solo es más detallado. Escribe en «conciliacion» UNA oración que diga ambos sin agregar nada que no esté en los hechos.

En «hechos», los ids que están en tensión (al menos dos, de fuentes distintas). En «explicacion», una frase que nombre las fuentes POR SU NOMBRE (archivo, extracto confirmado, campo del Perfil; nunca por su id) y la diferencia. Para «excluyente», «conciliacion» es null.`;

const VOTOS = 3;
type Decision = { grupo: string; veredicto: "excluyente" | "compatible" | "secuencia"; hechos: string[]; explicacion: string; conciliacion: string | null };

/**
 * Lo que ve el modelo, como en la v7 (la que acertó c1–c4): los hechos de cada
 * bloque dueño que vienen de más de un documento, y los de una misma clave en
 * bloques distintos. Orden determinista.
 */
export function secciones(hechos: HechoNuevo[]): { titulo: string; hechos: HechoNuevo[] }[] {
  const vigentes = hechos.filter((h) => h.estado === "vigente" && h.bloque_dueno != null);
  const orden = (h: HechoNuevo) => h.oracion ?? `${h.fuente_id}|${h.clave}`;
  const out: { titulo: string; hechos: HechoNuevo[] }[] = [];
  const porBloque = new Map<number, HechoNuevo[]>();
  for (const h of vigentes) porBloque.set(h.bloque_dueno!, [...(porBloque.get(h.bloque_dueno!) ?? []), h]);
  for (const [n, g] of [...porBloque].sort((a, b) => a[0] - b[0]))
    if (new Set(g.map((h) => documentoDe(h.fuente_id))).size > 1) out.push({ titulo: `Bloque ${n}`, hechos: [...g].sort((a, b) => orden(a).localeCompare(orden(b))) });
  const porClave = new Map<string, HechoNuevo[]>();
  for (const h of vigentes) porClave.set(h.clave, [...(porClave.get(h.clave) ?? []), h]);
  for (const [clave, g] of [...porClave].sort((a, b) => a[0].localeCompare(b[0])))
    if (new Set(g.map((h) => h.bloque_dueno)).size > 1 && new Set(g.map((h) => documentoDe(h.fuente_id))).size > 1) out.push({ titulo: `Misma clave en bloques distintos · ${clave}`, hechos: g });
  return out;
}

const SEVERIDAD = { excluyente: 3, secuencia: 2, compatible: 1 } as const;

export async function decidirContradicciones(hechos: HechoNuevo[], apiKey: string): Promise<ResultadoConflictos> {
  const vacio: Uso = { entrada: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0 };
  const secs = secciones(hechos);
  if (!secs.length) return { grupos: 0, excluyentes: 0, conciliados: 0, enConflicto: 0, uso: vacio, costo: 0 };

  const ids = new Map<string, HechoNuevo>();
  const idDe = new Map<HechoNuevo, string>();
  for (const sec of secs) for (const h of sec.hechos) if (!idDe.has(h)) { const id = `H${idDe.size + 1}`; idDe.set(h, id); ids.set(id, h); }
  const usuario = secs
    .map((sec) => [`## ${sec.titulo}`, ...sec.hechos.map((h) => `[${idDe.get(h)}] (${h.rango_fuente}; ${h.fuente_detalle}) ${h.enunciado}`)].join("\n"))
    .join("\n\n");

  const client = new Anthropic({ apiKey });
  const votar = async (): Promise<{ decisiones: Decision[]; uso: Uso }> => {
    const m = await client.messages
      .stream(
        {
          model: MODELO_LIBRO,
          max_tokens: 16000,
          system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: usuario }],
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
    return { decisiones: (JSON.parse(texto) as { decisiones: Decision[] }).decisiones ?? [], uso };
  };

  try {
    const votos = await Promise.allSettled(Array.from({ length: VOTOS }, votar));
    const validos = votos.filter((v): v is PromiseFulfilledResult<{ decisiones: Decision[]; uso: Uso }> => v.status === "fulfilled").map((v) => v.value);
    const uso = validos.reduce<Uso>((a, v) => ({ entrada: a.entrada + v.uso.entrada, cacheEscritura: a.cacheEscritura + v.uso.cacheEscritura, cacheLectura: a.cacheLectura + v.uso.cacheLectura, salida: a.salida + v.uso.salida }), vacio);
    const costo = costoUsd(MODELO_LIBRO, uso);
    if (!validos.length) return { grupos: 0, excluyentes: 0, conciliados: 0, enConflicto: 0, uso, costo, error: "ningún voto válido" };

    // Votos por PAR de hechos: en cada voto, dos hechos del mismo grupo en tensión
    // reciben el veredicto de ese grupo (de documentos distintos, siempre).
    type Voto = { veredicto: Decision["veredicto"]; d: Decision };
    const porPar = new Map<string, Voto[]>();
    for (const v of validos) {
      const vistos = new Set<string>();
      for (const d of v.decisiones) {
        const hs = [...new Set(d.hechos)].filter((id) => ids.has(id)).sort();
        for (let i = 0; i < hs.length; i++)
          for (let j = i + 1; j < hs.length; j++) {
            if (documentoDe(ids.get(hs[i])!.fuente_id) === documentoDe(ids.get(hs[j])!.fuente_id)) continue;
            const k = `${hs[i]}|${hs[j]}`;
            if (vistos.has(k)) continue;
            vistos.add(k);
            porPar.set(k, [...(porPar.get(k) ?? []), { veredicto: d.veredicto, d }]);
          }
      }
    }
    // Un par queda en tensión si lo ven al menos dos votos; su veredicto, el de
    // la mayoría de esos votos (empate: el más severo).
    const mayoria = Math.min(2, validos.length);
    const pares: { a: string; b: string; veredicto: Decision["veredicto"]; votos: Voto[] }[] = [];
    for (const [k, vs] of porPar) {
      if (vs.length < mayoria) continue;
      const cuenta = new Map<Decision["veredicto"], number>();
      for (const v of vs) cuenta.set(v.veredicto, (cuenta.get(v.veredicto) ?? 0) + 1);
      const max = Math.max(...cuenta.values());
      const veredicto = [...cuenta.entries()].filter(([, n]) => n === max).map(([x]) => x).sort((x, y) => SEVERIDAD[y] - SEVERIDAD[x])[0];
      const [a, b] = k.split("|");
      pares.push({ a, b, veredicto, votos: vs });
    }
    // Grupos: unión de pares con el MISMO veredicto (un hecho compartido no
    // arrastra un grupo compatible a excluyente). Primero los menos severos, para
    // que un hecho que también está en un grupo excluyente termine en él.
    const grupos: (typeof pares)[] = [];
    for (const veredicto of ["compatible", "secuencia", "excluyente"] as const) {
      const padre = new Map<string, string>();
      const raiz = (x: string): string => ((padre.get(x) ?? x) === x ? x : raiz(padre.get(x)!));
      const deEste = pares.filter((p) => p.veredicto === veredicto);
      for (const p of deEste) { padre.set(p.a, padre.get(p.a) ?? p.a); padre.set(p.b, padre.get(p.b) ?? p.b); padre.set(raiz(p.a), raiz(p.b)); }
      const porRaiz = new Map<string, typeof pares>();
      for (const p of deEste) porRaiz.set(raiz(p.a), [...(porRaiz.get(raiz(p.a)) ?? []), p]);
      grupos.push(...porRaiz.values());
    }

    let excluyentes = 0, conciliados = 0, enConflicto = 0, decididos = 0, porConciliar = 0;
    for (const ps of grupos) {
      const veredictoGrupo = ps.map((p) => p.veredicto).sort((x, y) => SEVERIDAD[y] - SEVERIDAD[x])[0];
      // FIRME solo si al menos un par lleva ese veredicto con TODOS los votos.
      // Si no, el libro no lo decide de forma estable: «por_conciliar» (decisión
      // de Esteban al cerrar el 5b; el caso «Alcance 3 frente a perímetro»).
      const firme = ps.some((p) => p.veredicto === veredictoGrupo && p.votos.length === validos.length && p.votos.every((v) => v.veredicto === veredictoGrupo));
      const decidido = veredictoGrupo === "excluyente" && ps.every((p) => p.veredicto !== "excluyente" || p.votos.every((v) => SE_DESMIENTE.test(v.d.explicacion))) ? "compatible" : veredictoGrupo;
      const veredicto: HechoNuevo["veredicto"] = firme ? decidido : "por_conciliar";
      const miembros = [...new Set(ps.flatMap((p) => [p.a, p.b]))].map((id) => ids.get(id)!);
      const d = ps.find((p) => p.veredicto === veredictoGrupo)!.votos.find((v) => v.veredicto === veredictoGrupo)!.d;
      const explicacion = d.explicacion.replace(/\bH(\d+)\b/g, (x) => (ids.get(x) ? `«${ids.get(x)!.fuente_detalle}»` : x));
      const resumenVotos = [...new Set(ps.map((p) => p.votos.map((v) => v.veredicto).join("/")))].join("; ");
      const grupo = randomUUID();
      for (const h of miembros) {
        h.grupo_conflicto = grupo;
        h.veredicto = veredicto;
        h.conflicto = `${explicacion} (votos por par: ${resumenVotos})`;
        if (veredicto === "excluyente") {
          if (h.estado !== "en_conflicto") enConflicto++;
          h.estado = "en_conflicto";
          h.conciliacion = null;
        } else if (veredicto === "por_conciliar") {
          // Sigue vigente: no hay decisión que imponer, y un hecho ya excluyente no se rebaja.
          if (h.estado === "en_conflicto") h.veredicto = "excluyente";
          h.conciliacion = null;
        } else h.conciliacion = d.conciliacion ?? null;
      }
      decididos++;
      if (veredicto === "excluyente") excluyentes++;
      else if (veredicto === "por_conciliar") porConciliar++;
      else conciliados++;
    }
    const fallidos = votos.length - validos.length;
    return { grupos: decididos, excluyentes, conciliados, enConflicto, porConciliar, uso, costo, ...(fallidos ? { error: `${fallidos} de ${VOTOS} votos fallaron` } : {}) };
  } catch (e) {
    return { grupos: 0, excluyentes: 0, conciliados: 0, enConflicto: 0, uso: vacio, costo: 0, error: e instanceof Error ? e.message.slice(0, 300) : String(e) };
  }
}
