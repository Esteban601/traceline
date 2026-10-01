import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

export type TipoActividad = Database["public"]["Enums"]["tipo_actividad_auditor"];

export const TIPO_LABEL: Record<TipoActividad, string> = {
  inicio_sesion: "Inicio de sesión",
  vista_matriz: "Vio la matriz",
  vista_cobertura: "Vio Cobertura",
  vista_solicitud: "Vio una solicitud",
  vista_taxonomia: "Vio taxonomía",
  vista_evidencia: "Vio una evidencia",
  descarga_evidencia: "Descargó una evidencia",
  descarga_excel: "Descargó un Excel",
  comentario: "Comentó",
};

/** Una actividad ya resuelta con los nombres que la hacen legible. */
export type Actividad = {
  id: string;
  tenantId: string;
  tenantNombre: string;
  auditorId: string;
  auditorNombre: string;
  tipo: TipoActividad;
  objetoTipo: string | null;
  objetoId: string | null;
  archivo: string | null;
  navegador: string | null;
  createdAt: string;
};

/**
 * Un tramo de la línea de tiempo: o un acto suelto, o VARIAS vistas idénticas
 * consecutivas del mismo objeto agrupadas en una ventana.
 *
 * Por qué agrupar: el registro se escribe en cada render, y el App Router
 * re-renderiza al volver atrás, al cambiar un filtro o al recargar. Una sesión
 * normal deja seis "vio la matriz" en dos minutos, y una línea de tiempo que las
 * enumere entierra los actos que sí dicen algo —una descarga, un comentario—
 * bajo ruido de navegación.
 *
 * El REGISTRO CRUDO NO SE TOCA: la agrupación es de la vista, se hace al leer y
 * cada fila original sigue en la tabla y sale íntegra en el CSV. Un registro de
 * auditoría que se compacta al escribirse ya no es el registro.
 */
export type Tramo = Actividad & { repeticiones: number; hasta: string };

/** Ventana de agrupación. 30 s, como pidió el encargo. */
export const VENTANA_MS = 30_000;

/**
 * Agrupa vistas IDÉNTICAS CONSECUTIVAS del mismo objeto dentro de una ventana.
 *
 * "Idénticas" significa: mismo auditor, mismo tipo, mismo objeto. "Consecutivas"
 * es literal: si entre dos vistas de la matriz hay una descarga, son dos tramos
 * —lo que pasó en medio es justo lo que no se puede perder—. Y la ventana se
 * mide contra la ÚLTIMA vista absorbida, no contra la primera, para que una
 * navegación continua no se parta a los 30 s exactos.
 *
 * Las descargas y los comentarios nunca se agrupan: cada una es un hecho
 * distinto aunque se repita el archivo.
 */
const NO_AGRUPABLES: readonly TipoActividad[] = [
  "descarga_evidencia",
  "descarga_excel",
  "comentario",
  "inicio_sesion",
];

export function agrupar(actos: Actividad[], ventanaMs = VENTANA_MS): Tramo[] {
  const tramos: Tramo[] = [];
  for (const a of actos) {
    const ultimo = tramos[tramos.length - 1];
    const agrupable =
      ultimo &&
      !NO_AGRUPABLES.includes(a.tipo) &&
      ultimo.tipo === a.tipo &&
      ultimo.auditorId === a.auditorId &&
      ultimo.objetoTipo === a.objetoTipo &&
      ultimo.objetoId === a.objetoId &&
      Math.abs(new Date(a.createdAt).getTime() - new Date(ultimo.hasta).getTime()) <=
        ventanaMs;

    if (agrupable) {
      ultimo.repeticiones += 1;
      ultimo.hasta = a.createdAt;
    } else {
      tramos.push({ ...a, repeticiones: 1, hasta: a.createdAt });
    }
  }
  return tramos;
}

export type FiltroActividad = {
  tenantId?: string | null;
  auditorId?: string | null;
  desde?: string | null;
  hasta?: string | null;
};

/**
 * Lee la actividad con service_role.
 *
 * Por qué service_role y no la sesión: `auditor_actividad` solo la lee
 * `fn_is_admin_irstrat()`, y para RESOLVER los nombres hay que cruzar
 * `perfiles_usuario` de OTROS tenants —el auditor pertenece al tenant del
 * cliente—, que la política `perfiles_select` no abre ni al staff salvo por
 * tenant. La autorización la hace la página antes de llamar aquí; esta función
 * no decide quién entra.
 */
export async function leerActividad(
  filtro: FiltroActividad,
  limite = 2000
): Promise<Actividad[]> {
  const db = createAdminClient();

  let q = db
    .from("auditor_actividad")
    // Sin `ip`: no se registra desde el 01/10/2026 (encargo rol auditor §7).
    .select("id, tenant_id, auditor_id, tipo, objeto_tipo, objeto_id, archivo, navegador, created_at")
    .order("created_at", { ascending: false })
    .limit(limite);

  if (filtro.tenantId) q = q.eq("tenant_id", filtro.tenantId);
  if (filtro.auditorId) q = q.eq("auditor_id", filtro.auditorId);
  if (filtro.desde) q = q.gte("created_at", `${filtro.desde}T00:00:00Z`);
  // `hasta` es inclusivo: quien filtra por un día espera ese día completo, no
  // hasta su medianoche inicial.
  if (filtro.hasta) q = q.lte("created_at", `${filtro.hasta}T23:59:59.999Z`);

  const { data, error } = await q;
  if (error) {
    console.error("[auditoria] lectura falló:", error.message);
    return [];
  }

  const filas = data ?? [];
  const tenantIds = [...new Set(filas.map((f) => f.tenant_id))];
  const auditorIds = [...new Set(filas.map((f) => f.auditor_id))];

  const [{ data: tenants }, { data: perfiles }] = await Promise.all([
    db.from("tenants").select("id, nombre").in("id", tenantIds.length ? tenantIds : [""]),
    db
      .from("perfiles_usuario")
      .select("id, nombre, activo")
      .in("id", auditorIds.length ? auditorIds : [""]),
  ]);

  const nombreTenant = new Map((tenants ?? []).map((t) => [t.id, t.nombre]));
  const nombreAuditor = new Map(
    (perfiles ?? []).map((p) => [p.id, p.activo ? p.nombre : `${p.nombre} (desactivado)`])
  );

  return filas.map((f) => ({
    id: f.id,
    tenantId: f.tenant_id,
    tenantNombre: nombreTenant.get(f.tenant_id) ?? "—",
    auditorId: f.auditor_id,
    auditorNombre: nombreAuditor.get(f.auditor_id) ?? "—",
    tipo: f.tipo,
    objetoTipo: f.objeto_tipo,
    objetoId: f.objeto_id,
    archivo: f.archivo,
    navegador: f.navegador,
    createdAt: f.created_at,
  }));
}

/** Emisoras y auditores presentes en el registro, para poblar los filtros. */
export async function opcionesDeFiltro(): Promise<{
  tenants: { id: string; nombre: string }[];
  auditores: { id: string; nombre: string; tenantId: string }[];
}> {
  const db = createAdminClient();
  const { data: perfiles } = await db
    .from("perfiles_usuario")
    .select("id, nombre, tenant_id, activo")
    .eq("rol", "auditor")
    .order("nombre");

  const auditores = (perfiles ?? [])
    .filter((p) => p.tenant_id !== null)
    .map((p) => ({
      id: p.id,
      nombre: p.activo ? p.nombre : `${p.nombre} (desactivado)`,
      tenantId: p.tenant_id as string,
    }));

  const { data: tenants } = await db
    .from("tenants")
    .select("id, nombre")
    .in("id", auditores.length ? [...new Set(auditores.map((a) => a.tenantId))] : [""])
    .order("nombre");

  return { tenants: tenants ?? [], auditores };
}
