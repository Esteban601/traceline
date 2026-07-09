import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DatapointOpcion } from "./datapoint-selector";
import type {
  ReporteOpcion,
  StaffOpcion,
  UsuarioOpcion,
} from "./solicitud-form";

export type OpcionesFormulario = {
  reportes: ReporteOpcion[];
  usuariosCliente: UsuarioOpcion[];
  staff: StaffOpcion[];
  areas: { tenant_id: string; area: string }[];
  datapoints: DatapointOpcion[];
};

/**
 * Carga todas las opciones para el formulario de solicitud (crear/editar):
 * reportes, usuarios cliente activos, staff, áreas por tenant y el catálogo de
 * datapoints. El formulario filtra responsables y áreas por el tenant del
 * reporte seleccionado. Se ejecuta como el staff (RLS lo permite ver todo).
 */
export async function cargarOpcionesFormulario(): Promise<OpcionesFormulario> {
  const db = await createClient();

  const [
    { data: reportes },
    { data: perfiles },
    { data: datapoints },
    { data: sols },
  ] = await Promise.all([
    db.from("reportes").select("id, nombre, ejercicio, tenant_id").order("ejercicio", {
      ascending: false,
    }),
    db
      .from("perfiles_usuario")
      .select("id, nombre, tenant_id, area, rol, activo")
      .order("nombre", { ascending: true }),
    db
      .from("datapoints_taxonomia")
      .select("id, codigo, descripcion, norma")
      .eq("activo", true)
      .order("codigo", { ascending: true }),
    db.from("solicitudes").select("area_asignada, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)"),
  ]);

  const perfilesAll = (perfiles ?? []) as {
    id: string;
    nombre: string;
    tenant_id: string | null;
    area: string | null;
    rol: string;
    activo: boolean;
  }[];

  // Usuarios cliente ACTIVOS (tenant != null). El staff (tenant null) va aparte.
  const usuariosCliente: UsuarioOpcion[] = perfilesAll
    .filter((p) => p.tenant_id !== null && p.activo)
    .map((p) => ({ id: p.id, nombre: p.nombre, tenant_id: p.tenant_id, area: p.area }));

  const staff: StaffOpcion[] = perfilesAll
    .filter((p) => p.tenant_id === null)
    .map((p) => ({ id: p.id, nombre: p.nombre }));

  // Áreas por tenant: unión de áreas de usuarios y de solicitudes existentes.
  const areasSet = new Map<string, Set<string>>();
  const push = (tenant: string | null, area: string | null) => {
    if (!tenant || !area) return;
    if (!areasSet.has(tenant)) areasSet.set(tenant, new Set());
    areasSet.get(tenant)!.add(area);
  };
  for (const p of perfilesAll) push(p.tenant_id, p.area);
  for (const s of (sols ?? []) as { area_asignada: string | null; reporte: { tenant_id: string } | null }[]) {
    push(s.reporte?.tenant_id ?? null, s.area_asignada);
  }
  const areas: { tenant_id: string; area: string }[] = [];
  for (const [tenant, set] of areasSet) for (const area of set) areas.push({ tenant_id: tenant, area });

  return {
    reportes: (reportes ?? []) as ReporteOpcion[],
    usuariosCliente,
    staff,
    areas,
    datapoints: (datapoints ?? []) as DatapointOpcion[],
  };
}
