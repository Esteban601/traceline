import type { HechoPropuesto as Clasificado } from "./extraer";
import { numerosDe } from "@/lib/evidencias/fuente";
import { TIPOS_HECHO, type HechoNuevo, type UnidadTexto } from "./tipos";

// =============================================================================
// VERIFICACIÓN DE UN HECHO PROPUESTO (libro de hechos, Paso 5).
//
// La trazabilidad deja de ser autoinforme del modelo: un hecho entra al libro
// solo si su extracto está, tal cual, en la fuente que dice. «Tal cual» admite
// lo que no cambia el contenido: mayúsculas, espacios y saltos de línea, comillas
// y guiones tipográficos, y el guion de un corte de línea. Nada más.
//
// Además: una cifra tiene que estar en su extracto (el modelo no calcula), y el
// bloque dueño tiene que existir. Lo que no pasa se guarda DESCARTADO con su
// motivo: el conteo de descartes es lo que dice cuánto se inventaba.
// =============================================================================

export function normalizar(t: string): string {
  return t
    .normalize("NFKC")
    .replace(/­/g, "")
    .replace(/(\w)-\s*\n\s*(\w)/g, "$1$2")
    .replace(/[“”«»„"]/g, '"')
    .replace(/[‘’‚']/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Quita los repetidos: misma fuente, mismo extracto y misma clave. */
export function sinRepetidos(hs: HechoNuevo[]): HechoNuevo[] {
  const visto = new Set<string>();
  return hs.filter((h) => {
    const k = `${h.fuente_id}|${h.clave}|${normalizar(h.extracto)}`;
    if (visto.has(k)) return false;
    visto.add(k);
    return true;
  });
}

// -----------------------------------------------------------------------------
// LIBRO ESTABLE (Paso 5b): el hecho viene de una ORACIÓN partida por código. El
// extracto es la oración misma; lo que se verifica es que la oración sea una de
// las entregadas, que la cifra esté en ella y que el dueño exista.
// -----------------------------------------------------------------------------

export function verificarClasificado(
  p: Clasificado,
  oraciones: Map<string, { texto: string; unidad: UnidadTexto }>
): HechoNuevo {
  const o = oraciones.get(p.oracion);
  const base: HechoNuevo = {
    clave: (p.clave || "sin_clave").toLowerCase().replace(/[^a-z0-9_.]+/g, "_").slice(0, 120),
    enunciado: (p.enunciado ?? "").trim(),
    tipo: TIPOS_HECHO.includes(p.tipo) ? p.tipo : "otro",
    valor: typeof p.valor === "number" && Number.isFinite(p.valor) ? p.valor : null,
    unidad: p.unidad ?? null,
    periodo: p.periodo ?? null,
    rango_fuente: o?.unidad.rango ?? "adjunto",
    fuente_tipo: o?.unidad.fuenteTipo ?? "adjunto",
    fuente_id: o?.unidad.id ?? p.oracion.split("#")[0],
    fuente_detalle: o?.unidad.detalle ?? p.oracion,
    extracto: o?.texto ?? "",
    verificado: false,
    verificacion: "",
    bloque_dueno: Number.isInteger(p.bloque_dueno) && p.bloque_dueno >= 1 && p.bloque_dueno <= 40 ? p.bloque_dueno : null,
    bloques_referencia: [...new Set((p.bloques_referencia ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= 40 && n !== p.bloque_dueno))].slice(0, 3),
    estado: "descartado",
    oracion: p.oracion,
    alcance: p.alcance ?? null,
  };
  const descartar = (motivo: string): HechoNuevo => ({ ...base, verificacion: `descartado: ${motivo}` });
  if (!o) return descartar(`la oración «${p.oracion}» no es una de las entregadas`);
  if (!base.enunciado) return descartar("sin enunciado");
  // Un cero dicho con palabras («ninguna proporción», «no se registraron») está en la oración aunque no haya numeral.
  const ceroDicho = base.valor === 0 && /(?<!\p{L})(ningun[oa]?|ningún|no|nul[oa]|cero)(?!\p{L})/iu.test(o.texto);
  if (base.tipo === "cifra" && base.valor != null && !ceroDicho && !numerosDe(o.texto).some((n) => Math.abs(n - base.valor!) <= Math.abs(base.valor!) * 1e-9 + 1e-9)) {
    return descartar(`la cifra ${base.valor} no está en la oración`);
  }
  if (base.bloque_dueno == null) return descartar("sin bloque dueño válido");
  return { ...base, verificado: true, verificacion: "oración: partida por código de la fuente", estado: "vigente" };
}
