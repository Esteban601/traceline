import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { coberturaDe, type Cobertura } from "@/lib/cobertura";
import { cargarDiscrepancias } from "@/lib/discrepancias";
import type { EstadoSolicitud } from "@/lib/estados";
import { CoberturaView, type DatapointCobertura } from "./cobertura-view";

export const metadata: Metadata = { title: "Cobertura de taxonomía" };

type DatapointRow = {
  id: string;
  codigo: string;
  norma: "S1" | "S2";
  pilar: string;
  seccion_indice: string | null;
  descripcion: string;
  ods: string | null;
};

export default async function CoberturaPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  const supabase = await createClient();

  const [{ data: dps, error }, { data: mapeo }, { data: sols }, discrepancias] =
    await Promise.all([
      supabase
        .from("datapoints_taxonomia")
        .select("id, codigo, norma, pilar, seccion_indice, descripcion, ods")
        .eq("version_taxonomia", "2025")
        .order("norma")
        .order("pilar")
        .order("codigo"),
      supabase.from("mapeo_solicitud_datapoint").select("solicitud_id, datapoint_id"),
      supabase.from("solicitudes").select("id, titulo, estado"),
      cargarDiscrepancias(supabase),
    ]);

  if (error) {
    throw new Error("No se pudo cargar el catálogo de datapoints.");
  }

  const datapoints = (dps ?? []) as DatapointRow[];

  type SolLigada = { id: string; titulo: string; estado: EstadoSolicitud };
  const solById = new Map<string, SolLigada>();
  for (const s of sols ?? [])
    solById.set(s.id, { id: s.id, titulo: s.titulo, estado: s.estado as EstadoSolicitud });

  // datapoint_id -> lista de solicitudes mapeadas
  const solsPorDatapoint = new Map<string, SolLigada[]>();
  for (const m of mapeo ?? []) {
    const sol = solById.get(m.solicitud_id);
    if (!sol) continue;
    const arr = solsPorDatapoint.get(m.datapoint_id) ?? [];
    arr.push(sol);
    solsPorDatapoint.set(m.datapoint_id, arr);
  }

  const filas: DatapointCobertura[] = datapoints.map((d) => {
    const ligadas = (solsPorDatapoint.get(d.id) ?? []).sort((a, b) =>
      a.titulo.localeCompare(b.titulo, "es")
    );
    const cobertura: Cobertura = coberturaDe(ligadas.map((s) => s.estado));
    return {
      id: d.id,
      codigo: d.codigo,
      norma: d.norma,
      pilar: d.pilar,
      seccionIndice: d.seccion_indice,
      descripcion: d.descripcion,
      ods: d.ods,
      cobertura,
      discrepancia: discrepancias.porDatapoint.has(d.id),
      solicitudes: ligadas,
    };
  });

  return <CoberturaView datapoints={filas} />;
}
