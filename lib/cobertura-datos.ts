import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { coberturaDe } from "@/lib/cobertura";
import { cargarDiscrepancias } from "@/lib/discrepancias";
import type { EstadoSolicitud } from "@/lib/estados";
import type { OrigenSolicitud } from "@/lib/origen";
import type { DatapointCobertura } from "@/lib/cobertura-vista";

// =============================================================================
// CARGA de los datos de cobertura (servidor). El tipo y los agregados de
// presentación viven en lib/cobertura-vista.ts, que también corre en el cliente.
//
// Datos de COBERTURA, en un solo lugar: los usa el tablero (/admin/cobertura) y
// el informe para imprimir (/admin/cobertura/informe).
//
// Están juntos a propósito. Si cada vista calculara lo suyo, tarde o temprano el
// PDF diría un porcentaje distinto del que se ve en pantalla — y de las dos
// cifras, la que el cliente archiva es la del PDF. Un informe que contradice al
// tablero es peor que no tener informe.
// =============================================================================

export type TenantOpcion = {
  id: string;
  nombre: string;
  logo_url: string | null;
  prefijo_folio: string;
  es_demo: boolean;
};
export type ReporteOpcion = {
  id: string;
  nombre: string;
  ejercicio: number;
  tenant_id: string;
};

export type DatosCobertura = {
  filas: DatapointCobertura[];
  tenants: TenantOpcion[];
  reportes: ReporteOpcion[];
  /** Cliente resuelto a partir del parámetro (null = agregado de la firma). */
  tenantSel: string | null;
  tenantActivo: TenantOpcion | null;
  /** Reporte resuelto: el del parámetro, o el único visible del cliente. */
  reporteSel: string | null;
  reportesVisibles: ReporteOpcion[];
};

/**
 * Carga y calcula la cobertura con el cliente de SESIÓN: RLS acota datapoints
 * ligados, solicitudes y reportes a lo que cada quien puede ver, así que el
 * administrador del cliente obtiene SU cobertura con la misma función.
 */
export async function cargarCobertura(
  db: SupabaseClient<Database>,
  params: { tenant?: string; reporte?: string }
): Promise<DatosCobertura> {
  const [
    { data: dps, error },
    { data: mapeo },
    { data: sols },
    discrepancias,
    { data: tenants },
    { data: reportes },
  ] = await Promise.all([
    db
      .from("datapoints_taxonomia")
      .select("id, codigo, norma, marco, pilar, seccion_indice, descripcion, ods")
      .eq("version_taxonomia", "2025")
      .order("norma")
      .order("pilar")
      .order("codigo"),
    db.from("mapeo_solicitud_datapoint").select("solicitud_id, datapoint_id"),
    db
      .from("solicitudes")
      .select(
        "id, titulo, estado, origen, declinada, desactivada, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)"
      ),
    cargarDiscrepancias(db),
    db
      .from("tenants")
      .select("id, nombre, logo_url, prefijo_folio, es_demo")
      .order("nombre", { ascending: true }),
    db
      .from("reportes")
      .select("id, nombre, ejercicio, tenant_id")
      .order("ejercicio", { ascending: false })
      .order("nombre", { ascending: true }),
  ]);

  if (error) {
    throw new Error("No se pudo cargar el catálogo de datapoints.");
  }

  const datapoints = (dps ?? []) as {
    id: string;
    codigo: string;
    norma: "S1" | "S2";
    marco: "NIIF" | "GRI";
    pilar: string;
    seccion_indice: string | null;
    descripcion: string;
    ods: string | null;
  }[];

  const tenantsLista = (tenants ?? []) as TenantOpcion[];
  const reportesLista = (reportes ?? []) as ReporteOpcion[];

  const tenantSel =
    params.tenant && tenantsLista.some((t) => t.id === params.tenant) ? params.tenant : null;
  const tenantActivo = tenantSel ? (tenantsLista.find((t) => t.id === tenantSel) ?? null) : null;

  // La cobertura se mide POR CLIENTE: mezclar emisoras daría un porcentaje que no
  // le corresponde a ninguna. Sin selección se muestra el agregado de la firma.
  type SolLigada = DatapointCobertura["solicitudes"][number];
  const solsRaw = (sols ?? []) as unknown as {
    id: string;
    titulo: string;
    estado: string;
    origen: OrigenSolicitud;
    declinada: boolean;
    desactivada: boolean;
    reporte: { tenant_id: string } | null;
  }[];
  const solById = new Map<string, SolLigada>();
  for (const s of solsRaw) {
    if (tenantSel && s.reporte?.tenant_id !== tenantSel) continue;
    // Una copia de difusión que el área declaró ajena —o que quien difundió
    // retiró— NO es una brecha de evidencia: es un "no aplica". Contarla dejaría
    // el datapoint en rojo por una pregunta que ya se respondió, y con la peor de
    // las lecturas: que falta información cuando lo que falta es nada.
    if (s.declinada || s.desactivada) continue;
    solById.set(s.id, {
      id: s.id,
      titulo: s.titulo,
      estado: s.estado as EstadoSolicitud,
      origen: s.origen,
    });
  }

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
    return {
      id: d.id,
      codigo: d.codigo,
      norma: d.norma,
      marco: d.marco,
      pilar: d.pilar,
      seccionIndice: d.seccion_indice,
      descripcion: d.descripcion,
      ods: d.ods,
      cobertura: coberturaDe(ligadas.map((s) => s.estado)),
      discrepancia: discrepancias.porDatapoint.has(d.id),
      solicitudes: ligadas,
    };
  });

  const reportesVisibles = reportesLista.filter((r) => !tenantSel || r.tenant_id === tenantSel);
  const reporteParamValido =
    params.reporte && reportesVisibles.some((r) => r.id === params.reporte)
      ? params.reporte
      : null;
  const reporteSel =
    reporteParamValido ?? (reportesVisibles.length === 1 ? reportesVisibles[0].id : null);

  return {
    filas,
    tenants: tenantsLista,
    reportes: reportesLista,
    tenantSel,
    tenantActivo,
    reporteSel,
    reportesVisibles,
  };
}
