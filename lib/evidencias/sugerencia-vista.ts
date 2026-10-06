import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

// =============================================================================
// SUGERENCIA PARA LA PANTALLA — captura sugerida, Paso 4.
//
// Carga, con la sesión del usuario (RLS decide qué ve), lo que el bloque
// «Valor sugerido» / «Extracto sugerido» necesita sobre la evidencia MÁS
// RECIENTE de la solicitud:
//   · la sugerencia visible (`sugerida` o `sin_hallazgo`) de esa evidencia;
//   · si no hay visible, la última decidida sobre esa evidencia, para decir qué
//     se hizo con ella;
//   · si quien mira puede decidir (fn_puede_decidir_sugerencia: la misma regla
//     que la base aplica al decidir; el auditor recibe false).
// Lo que se manda al cliente es plano y serializable.
// =============================================================================

type Db = Awaited<ReturnType<typeof createClient>>;

export type FuenteVista = {
  tipo: "celda" | "pagina" | "parrafo" | "tabla" | "imagen";
  hoja?: string | null;
  celda?: string | null;
  pagina?: number | null;
  parrafo?: number | null;
  tabla?: number | null;
  fila?: number | null;
  columna?: number | null;
};

export type ConversionVista = { valor: number; unidad: string; factor: number; origen: "tabla" | "modelo"; explicacion: string };

export type LecturaVista = {
  valor: number;
  unidad: string;
  periodo: string | null;
  fuente: FuenteVista | null;
  cita: string | null;
  nota?: string | null;
  conversion: ConversionVista | null;
  origen?: "principal" | "candidato" | "segunda_opinion";
};

export type SugerenciaVista = {
  id: string;
  evidenciaId: string;
  evidenciaVersion: number;
  nombreArchivo: string | null;
  tipo: "numerica" | "texto";
  estado: "sugerida" | "sin_hallazgo" | "confirmada" | "corregida" | "rechazada";
  confianza: "alta" | "media" | "baja" | null;
  motivo: string | null;
  principal: LecturaVista | null;
  candidatos: LecturaVista[];
  fragmentos: { fuente: FuenteVista; texto: string; recortado?: boolean }[];
  extracto: string | null;
  cobertura: string | null;
  decision: null | {
    cuando: string;
    quien: string | null;
    valorFinal: number | null;
    unidadFinal: string | null;
    extractoFinal: string | null;
    motivoRechazo: string | null;
  };
};

export type BloqueSugerencia = {
  sugerencia: SugerenciaVista | null;
  puedeDecidir: boolean;
  unidadEsperada: string | null;
};

type EstadoSugerencia = Database["public"]["Enums"]["estado_sugerencia"];
const VISIBLES: EstadoSugerencia[] = ["sugerida", "sin_hallazgo"];
const DECIDIDAS: EstadoSugerencia[] = ["confirmada", "corregida", "rechazada"];

export async function cargarSugerencia(
  db: Db,
  solicitud: { id: string; unidad_esperada: string | null },
  ultimaEvidencia: { id: string; nombre_original: string } | null
): Promise<BloqueSugerencia> {
  const vacio: BloqueSugerencia = { sugerencia: null, puedeDecidir: false, unidadEsperada: solicitud.unidad_esperada };
  if (!ultimaEvidencia) return vacio;

  const { data: filas } = await db
    .from("sugerencias_captura")
    .select(
      "id, evidencia_id, evidencia_version, tipo, estado, valor, unidad, periodo, fuente, cita, conversion, candidatos, confianza, motivo, extracto, cobertura, decidido_por, decidido_en, valor_final, unidad_final, extracto_final, motivo_rechazo, created_at"
    )
    .eq("solicitud_id", solicitud.id)
    .eq("evidencia_id", ultimaEvidencia.id)
    .in("estado", [...VISIBLES, ...DECIDIDAS])
    .order("created_at", { ascending: false })
    .limit(5);
  const lista = filas ?? [];
  const fila = lista.find((f) => VISIBLES.includes(f.estado)) ?? lista.find((f) => DECIDIDAS.includes(f.estado));
  if (!fila) return vacio;

  const { data: puede } = await db.rpc("fn_puede_decidir_sugerencia", { p_solicitud_id: solicitud.id });

  let quien: string | null = null;
  if (fila.decidido_por) {
    const { data: p } = await db.from("perfiles_usuario").select("nombre").eq("id", fila.decidido_por).maybeSingle();
    quien = p?.nombre?.replace(/\[DEMO\]\s*/i, "") ?? null;
  }

  const fuenteTexto = (fila.fuente ?? null) as unknown as
    | (FuenteVista & { fragmentos?: undefined })
    | { cubre_requisito: string | null; fragmentos: { fuente: FuenteVista; texto: string; recortado?: boolean }[] }
    | null;
  const esTexto = fila.tipo === "texto";

  return {
    puedeDecidir: Boolean(puede),
    unidadEsperada: solicitud.unidad_esperada,
    sugerencia: {
      id: fila.id,
      evidenciaId: fila.evidencia_id,
      evidenciaVersion: fila.evidencia_version,
      nombreArchivo: ultimaEvidencia.nombre_original,
      tipo: fila.tipo as "numerica" | "texto",
      estado: fila.estado as SugerenciaVista["estado"],
      confianza: fila.confianza as SugerenciaVista["confianza"],
      motivo: fila.motivo,
      principal:
        !esTexto && fila.valor !== null
          ? {
              valor: Number(fila.valor),
              unidad: fila.unidad ?? "",
              periodo: fila.periodo,
              fuente: fuenteTexto as FuenteVista | null,
              cita: fila.cita,
              conversion: (fila.conversion ?? null) as unknown as ConversionVista | null,
            }
          : null,
      candidatos: esTexto ? [] : ((fila.candidatos ?? []) as unknown as LecturaVista[]),
      fragmentos: esTexto && fuenteTexto && "fragmentos" in fuenteTexto ? fuenteTexto.fragmentos ?? [] : [],
      extracto: fila.extracto,
      cobertura: fila.cobertura,
      decision: fila.decidido_en
        ? {
            cuando: fila.decidido_en,
            quien,
            valorFinal: fila.valor_final === null ? null : Number(fila.valor_final),
            unidadFinal: fila.unidad_final,
            extractoFinal: fila.extracto_final,
            motivoRechazo: fila.motivo_rechazo,
          }
        : null,
    },
  };
}
