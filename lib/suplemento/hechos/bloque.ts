import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BLOQUES, bloqueSeleccionado, type Bloque } from "@/lib/suplemento/bloques";
import { ORDEN_RANGO, type RangoFuente } from "./tipos";

// =============================================================================
// EL BLOQUE DESDE EL LIBRO DE HECHOS (encargo suplemento-calidad, Paso 5.3).
//
// Un bloque recibe SOLO:
//   · sus hechos (los que el libro le asignó como dueño), con id corto (h1, h2…),
//     rango de fuente, enunciado, extracto literal y fuente; los que están en
//     contradicción, con su grupo y su explicación;
//   · referencias de una línea a hechos de otros bloques que lo mencionan, para
//     remitir y no repetir.
// Nada de adjuntos completos ni de contenido crudo: la duplicación entre
// bloques y las inferencias de la revisión externa nacían ahí.
//
// Si el bloque dueño de un hecho no va en el documento (editorial apagado), el
// hecho pasa al primer bloque seleccionado que lo refiere; si ninguno, se queda
// fuera.
// =============================================================================

type Db = SupabaseClient<Database>;

export type HechoDelBloque = {
  id: string; // corto, el que cita el modelo: h1, h2…
  hechoId: string;
  rango: RangoFuente;
  enunciado: string;
  extracto: string;
  fuente: string;
  fuenteId: string;
  tipo: string;
  valor: number | null;
  unidad: string | null;
  contradiccion: { grupo: string; explicacion: string } | null;
};

export type ReferenciaDelBloque = { texto: string; bloque: number; titulo: string };

export type InsumoDelBloque = {
  libroId: string;
  hechos: HechoDelBloque[];
  referencias: ReferenciaDelBloque[];
};

const LARGO_REFERENCIA = 160;

export async function insumoDelBloque(db: Db, libroId: string, bloque: Bloque, incluidos: string[] | null): Promise<InsumoDelBloque> {
  const { data } = await db
    .from("hechos")
    .select("id, enunciado, extracto, fuente_detalle, fuente_id, tipo, valor, unidad, rango_fuente, bloque_dueno, bloques_referencia, grupo_conflicto, conflicto, estado")
    .eq("libro_id", libroId)
    .neq("estado", "descartado");
  const seleccionado = (n: number) => bloqueSeleccionado(BLOQUES.find((b) => b.numero === n)!, incluidos);
  const duenoEfectivo = (h: { bloque_dueno: number | null; bloques_referencia: number[] }): number | null => {
    if (h.bloque_dueno != null && seleccionado(h.bloque_dueno)) return h.bloque_dueno;
    return [...h.bloques_referencia].sort((a, b) => a - b).find(seleccionado) ?? null;
  };

  const propios = (data ?? [])
    .filter((h) => duenoEfectivo(h) === bloque.numero)
    .sort((a, b) => ORDEN_RANGO[a.rango_fuente as RangoFuente] - ORDEN_RANGO[b.rango_fuente as RangoFuente]);
  // Grupos de contradicción con nombre corto (c1, c2…).
  const grupos = new Map<string, string>();
  for (const h of propios) if (h.grupo_conflicto && !grupos.has(h.grupo_conflicto)) grupos.set(h.grupo_conflicto, `c${grupos.size + 1}`);

  const hechos: HechoDelBloque[] = propios.map((h, i) => ({
    id: `h${i + 1}`,
    hechoId: h.id,
    rango: h.rango_fuente as RangoFuente,
    enunciado: h.enunciado,
    extracto: h.extracto,
    fuente: h.fuente_detalle,
    fuenteId: h.fuente_id,
    tipo: h.tipo,
    valor: h.valor == null ? null : Number(h.valor),
    unidad: h.unidad,
    contradiccion: h.grupo_conflicto ? { grupo: grupos.get(h.grupo_conflicto)!, explicacion: h.conflicto ?? "" } : null,
  }));

  const referencias: ReferenciaDelBloque[] = (data ?? [])
    .filter((h) => (h.bloques_referencia ?? []).includes(bloque.numero))
    .map((h) => ({ h, dueno: duenoEfectivo(h) }))
    .filter((x): x is { h: (typeof x)["h"]; dueno: number } => x.dueno != null && x.dueno !== bloque.numero)
    .map(({ h, dueno }) => ({
      texto: h.enunciado.length > LARGO_REFERENCIA ? `${h.enunciado.slice(0, LARGO_REFERENCIA)}…` : h.enunciado,
      bloque: dueno,
      titulo: BLOQUES.find((b) => b.numero === dueno)!.titulo,
    }));

  return { libroId, hechos, referencias };
}

// -----------------------------------------------------------------------------
// Cobertura por subrequisito: validación por código.
// -----------------------------------------------------------------------------

export type Cobertura = {
  codigo: string;
  estado: "cubierto" | "parcial" | "pendiente" | "asignado";
  bloque: number | null;
  hechos: string[];
  comentario: string;
};

export function validarCobertura(
  cobertura: Cobertura[],
  requisitos: string[],
  numero: number,
  idsHechos: Set<string>,
  incluidos: string[] | null,
  texto: string
): string[] {
  const errores: string[] = [];
  const vistos = new Map<string, number>();
  for (const c of cobertura) vistos.set(c.codigo, (vistos.get(c.codigo) ?? 0) + 1);
  for (const r of requisitos) {
    const n = vistos.get(r) ?? 0;
    if (n === 0) errores.push(`falta el requisito ${r} en la cobertura`);
    if (n > 1) errores.push(`el requisito ${r} aparece ${n} veces en la cobertura`);
  }
  for (const c of cobertura) {
    if (!requisitos.includes(c.codigo)) {
      errores.push(`${c.codigo} no es un requisito de este bloque`);
      continue;
    }
    if (c.estado === "cubierto" || c.estado === "parcial") {
      if (!c.hechos.length) errores.push(`${c.codigo} «${c.estado}» sin hechos que lo sostengan`);
      const ajenos = c.hechos.filter((h) => !idsHechos.has(h));
      if (ajenos.length) errores.push(`${c.codigo} cita hechos que no se entregaron: ${ajenos.join(", ")}`);
    }
    if (c.estado === "asignado") {
      const destino = BLOQUES.find((b) => b.numero === c.bloque);
      if (!destino || destino.numero === numero) errores.push(`${c.codigo} «asignado» a un bloque inválido (${c.bloque})`);
      else if (!destino.datapoints.includes(c.codigo)) errores.push(`${c.codigo} «asignado» al bloque ${destino.numero}, que no responde ese requisito`);
      else if (!bloqueSeleccionado(destino, incluidos)) errores.push(`${c.codigo} «asignado» al bloque ${destino.numero}, que no va en este documento`);
    }
    if (c.estado === "pendiente" && !/\[Pendiente:/.test(texto)) errores.push(`${c.codigo} «pendiente» pero el texto no lleva ningún marcador [Pendiente: …]`);
  }
  return errores;
}
