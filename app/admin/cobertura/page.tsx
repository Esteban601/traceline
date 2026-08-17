import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { coberturaDe, type Cobertura } from "@/lib/cobertura";
import { cargarDiscrepancias } from "@/lib/discrepancias";
import type { EstadoSolicitud } from "@/lib/estados";
import { TenantSelector, type TenantOpcionSelector } from "@/components/tenant-selector";
import { limpiarNombreTenant } from "@/lib/tenants";
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

export default async function CoberturaPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  const { tenant: tenantParam } = await searchParams;

  const supabase = await createClient();

  const [{ data: dps, error }, { data: mapeo }, { data: sols }, discrepancias, { data: tenants }] =
    await Promise.all([
      supabase
        .from("datapoints_taxonomia")
        .select("id, codigo, norma, pilar, seccion_indice, descripcion, ods")
        .eq("version_taxonomia", "2025")
        .order("norma")
        .order("pilar")
        .order("codigo"),
      supabase.from("mapeo_solicitud_datapoint").select("solicitud_id, datapoint_id"),
      supabase
        .from("solicitudes")
        .select("id, titulo, estado, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)"),
      cargarDiscrepancias(supabase),
      supabase
        .from("tenants")
        .select("id, nombre, logo_url, prefijo_folio")
        .order("nombre", { ascending: true }),
    ]);

  if (error) {
    throw new Error("No se pudo cargar el catálogo de datapoints.");
  }

  const datapoints = (dps ?? []) as DatapointRow[];

  const tenantsLista = (tenants ?? []) as {
    id: string;
    nombre: string;
    logo_url: string | null;
    prefijo_folio: string;
  }[];
  const tenantsOpc: TenantOpcionSelector[] = tenantsLista.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    logoUrl: t.logo_url,
    prefijoFolio: t.prefijo_folio,
  }));
  const tenantSel =
    tenantParam && tenantsLista.some((t) => t.id === tenantParam) ? tenantParam : null;
  const tenantActivo = tenantSel ? tenantsLista.find((t) => t.id === tenantSel)! : null;

  // La cobertura se mide POR CLIENTE: mezclar emisoras daría un porcentaje que no
  // le corresponde a ninguna. Sin selección se muestra el agregado de la firma.
  type SolLigada = { id: string; titulo: string; estado: EstadoSolicitud };
  const solsRaw = (sols ?? []) as unknown as {
    id: string;
    titulo: string;
    estado: string;
    reporte: { tenant_id: string } | null;
  }[];
  const solById = new Map<string, SolLigada>();
  for (const s of solsRaw) {
    if (tenantSel && s.reporte?.tenant_id !== tenantSel) continue;
    solById.set(s.id, { id: s.id, titulo: s.titulo, estado: s.estado as EstadoSolicitud });
  }

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

  // El Excel de taxonomía se arma desde `mapeo_export` (mapeo fijo celda↔dato,
  // construido por reporte) y esa tabla NO está parametrizada por cliente: la
  // ruta escribe todas las celdas activas que encuentra. Por eso el botón solo
  // se ofrece cuando TODAS esas celdas son del cliente seleccionado; si hubiera
  // una sola de otro, el libro mezclaría emisoras. El `activo` replica el filtro
  // de la ruta para no ofrecer un botón que respondería 422.
  let exportTaxonomiaDisponible = true;
  if (tenantSel) {
    const { data: celdas } = await supabase
      .from("mapeo_export")
      .select("solicitud_id")
      .eq("activo", true)
      .not("solicitud_id", "is", null);
    const delTenant = new Set(solById.keys());
    const mapeadas = (celdas ?? []).filter((c) => c.solicitud_id != null);
    exportTaxonomiaDisponible =
      mapeadas.length > 0 &&
      mapeadas.every((c) => delTenant.has(c.solicitud_id as string));
  }

  return (
    <CoberturaView
      datapoints={filas}
      tenantId={tenantSel}
      tenantNombre={tenantActivo ? limpiarNombreTenant(tenantActivo.nombre) : null}
      exportTaxonomiaDisponible={exportTaxonomiaDisponible}
      selector={<TenantSelector tenants={tenantsOpc} seleccionado={tenantSel} />}
    />
  );
}
