import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DatapointOpcion } from "./datapoint-selector";
import type {
  ReporteOpcion,
  RubroOpcion,
  StaffOpcion,
  UsuarioOpcion,
} from "./solicitud-form";

export type OpcionesFormulario = {
  reportes: ReporteOpcion[];
  usuariosCliente: UsuarioOpcion[];
  staff: StaffOpcion[];
  areas: { tenant_id: string; area: string }[];
  datapoints: DatapointOpcion[];
  rubros: RubroOpcion[];
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
    { data: rubrosRaw },
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
      .select("id, codigo, descripcion, norma, marco")
      .eq("activo", true)
      .order("codigo", { ascending: true }),
    db.from("solicitudes").select("area_asignada, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)"),
    db
      .from("rubros_taxonomia")
      .select("clave, etiqueta, grupo, orden")
      .eq("activo", true)
      // El orden final lo pone RANGO_GRUPO abajo: ordenar por la clave dejaría
      // 'gei_alcance3' antes que 'gei_alcances' (alfabético), al revés de la
      // plantilla impresa.
      .order("orden", { ascending: true }),
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

  // Etiqueta del grupo para que el <select> se lea sin conocer las claves.
  const GRUPO_LABEL: Record<string, string> = {
    gei_alcances: "GEI · Alcances",
    gei_alcance3: "GEI · Alcance 3",
  };
  // Los alcances van primero, como en la plantilla oficial.
  const RANGO_GRUPO: Record<string, number> = { gei_alcances: 0, gei_alcance3: 1 };
  const rubros: RubroOpcion[] = (
    (rubrosRaw ?? []) as { clave: string; etiqueta: string; grupo: string; orden: number }[]
  )
    .slice()
    .sort(
      (a, b) =>
        (RANGO_GRUPO[a.grupo] ?? 99) - (RANGO_GRUPO[b.grupo] ?? 99) || a.orden - b.orden
    )
    .map((r) => ({
      clave: r.clave,
      etiqueta: r.etiqueta,
      grupoLabel: GRUPO_LABEL[r.grupo] ?? r.grupo,
    }));

  return {
    reportes: (reportes ?? []) as ReporteOpcion[],
    usuariosCliente,
    staff,
    areas,
    // `norma` se sustituye por 'VERT' en los de la extensión: en el selector,
    // un VERT rotulado 'S1' se leería como parte de la norma.
    datapoints: ((datapoints ?? []) as (DatapointOpcion & { marco?: string })[]).map((d) => ({
      ...d,
      norma: d.marco === "VERT" ? "VERT" : d.norma,
    })) as DatapointOpcion[],
    rubros,
  };
}
