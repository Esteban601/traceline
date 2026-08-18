import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { coberturaDe, type Cobertura } from "@/lib/cobertura";
import { cargarDiscrepancias } from "@/lib/discrepancias";
import type { EstadoSolicitud } from "@/lib/estados";
import type { OrigenSolicitud } from "@/lib/origen";
import { TenantSelector, type TenantOpcionSelector } from "@/components/tenant-selector";
import { ParamSelect } from "@/components/ui/param-select";
import { limpiarNombreTenant } from "@/lib/tenants";
import { CoberturaView, type DatapointCobertura } from "./cobertura-view";

export const metadata: Metadata = { title: "Cobertura de taxonomía" };

type DatapointRow = {
  id: string;
  codigo: string;
  norma: "S1" | "S2";
  marco: "NIIF" | "VERT";
  pilar: string;
  seccion_indice: string | null;
  descripcion: string;
  ods: string | null;
};

export default async function CoberturaPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; reporte?: string }>;
}) {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  // El administrador del cliente ve SU cobertura: RLS acota datapoints ligados,
  // solicitudes y reportes a su tenant, y el selector de cliente no aparece
  // porque solo hay uno visible.
  const soyStaff = esStaff(perfil);

  const { tenant: tenantParam, reporte: reporteParam } = await searchParams;

  const supabase = await createClient();

  const [
    { data: dps, error },
    { data: mapeo },
    { data: sols },
    discrepancias,
    { data: tenants },
    { data: reportes },
  ] = await Promise.all([
      supabase
        .from("datapoints_taxonomia")
        .select("id, codigo, norma, marco, pilar, seccion_indice, descripcion, ods")
        .eq("version_taxonomia", "2025")
        .order("norma")
        .order("pilar")
        .order("codigo"),
      supabase.from("mapeo_solicitud_datapoint").select("solicitud_id, datapoint_id"),
      supabase
        .from("solicitudes")
        .select("id, titulo, estado, origen, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)"),
      cargarDiscrepancias(supabase),
      supabase
        .from("tenants")
        .select("id, nombre, logo_url, prefijo_folio")
        .order("nombre", { ascending: true }),
      supabase
        .from("reportes")
        .select("id, nombre, ejercicio, tenant_id")
        .order("ejercicio", { ascending: false })
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
  const reportesLista = (reportes ?? []) as {
    id: string;
    nombre: string;
    ejercicio: number;
    tenant_id: string;
  }[];

  const tenantSel =
    tenantParam && tenantsLista.some((t) => t.id === tenantParam) ? tenantParam : null;
  const tenantActivo = tenantSel ? tenantsLista.find((t) => t.id === tenantSel)! : null;

  // La cobertura se mide POR CLIENTE: mezclar emisoras daría un porcentaje que no
  // le corresponde a ninguna. Sin selección se muestra el agregado de la firma.
  type SolLigada = {
    id: string;
    titulo: string;
    estado: EstadoSolicitud;
    origen: OrigenSolicitud;
  };
  const solsRaw = (sols ?? []) as unknown as {
    id: string;
    titulo: string;
    estado: string;
    origen: OrigenSolicitud;
    reporte: { tenant_id: string } | null;
  }[];
  const solById = new Map<string, SolLigada>();
  for (const s of solsRaw) {
    if (tenantSel && s.reporte?.tenant_id !== tenantSel) continue;
    solById.set(s.id, {
      id: s.id,
      titulo: s.titulo,
      estado: s.estado as EstadoSolicitud,
      // El origen decide QUIÉN validó (regla dura), y por tanto cómo se rotula la
      // trazabilidad del valor que alimenta la celda.
      origen: s.origen,
    });
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
      marco: d.marco,
      pilar: d.pilar,
      seccionIndice: d.seccion_indice,
      descripcion: d.descripcion,
      ods: d.ods,
      cobertura,
      discrepancia: discrepancias.porDatapoint.has(d.id),
      solicitudes: ligadas,
    };
  });

  // El Excel de taxonomía se genera POR REPORTE (el mapeo ya no está atado a un
  // cliente). Los reportes ofrecidos siguen al selector de cliente; si con el
  // filtro puesto solo queda uno, se elige solo — que es el caso normal.
  const reportesVisibles = reportesLista.filter(
    (r) => !tenantSel || r.tenant_id === tenantSel
  );
  const reporteParamValido =
    reporteParam && reportesVisibles.some((r) => r.id === reporteParam)
      ? reporteParam
      : null;
  const reporteSel =
    reporteParamValido ?? (reportesVisibles.length === 1 ? reportesVisibles[0].id : null);

  const nombreTenant = new Map(tenantsLista.map((t) => [t.id, limpiarNombreTenant(t.nombre)]));
  // El nombre del cliente en la etiqueta del reporte solo sirve para desempatar
  // entre emisoras. Con una sola visible —el caso del administrador del cliente—
  // repetirlo en cada opción es ruido.
  const variosClientes = new Set(reportesVisibles.map((r) => r.tenant_id)).size > 1;

  return (
    <CoberturaView
      datapoints={filas}
      tenantId={tenantSel}
      tenantNombre={tenantActivo ? limpiarNombreTenant(tenantActivo.nombre) : null}
      reporteId={reporteSel}
      soyStaff={soyStaff}
      selector={
        <>
          <TenantSelector
            tenants={tenantsOpc}
            seleccionado={tenantSel}
            limpiar={["reporte"]}
          />
          <ParamSelect
            param="reporte"
            etiqueta="Reporte"
            valor={reporteSel}
            placeholder="Elige un reporte"
            opciones={reportesVisibles.map((r) => ({
              value: r.id,
              // Siempre con el nombre del reporte: este selector decide de QUÉ
              // cliente sale el Excel, así que dos opciones indistinguibles
              // producirían un entregable equivocado sin aviso.
              label: variosClientes
                ? `${nombreTenant.get(r.tenant_id) ?? "—"} · ${r.nombre} · ${r.ejercicio}`
                : `${r.nombre} · ${r.ejercicio}`,
            }))}
          />
        </>
      }
    />
  );
}
