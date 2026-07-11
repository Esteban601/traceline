import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

export type AccionCorreo =
  | "solicitud_enviada"
  | "recordatorio_enviado"
  | "aviso_observacion";

/**
 * Registra un evento de correo en la bitácora (append-only) vía fn_log_correo
 * (SECURITY DEFINER). Funciona tanto con el cliente de sesión (staff) como con
 * el cliente admin (service_role). Devuelve el id del registro o null si falla.
 */
export async function logCorreo(
  db: SupabaseClient<Database>,
  params: {
    tenantId: string | null;
    usuarioId: string | null;
    accion: AccionCorreo;
    entidadId: string | null;
    detalle: Record<string, unknown>;
  }
): Promise<string | null> {
  // Los args uuid se generan como `string` (Postgres no expone nullability),
  // pero la función acepta NULL en runtime. Se castea lo nullable.
  const { data, error } = await db.rpc("fn_log_correo", {
    p_tenant_id: params.tenantId as unknown as string,
    p_usuario_id: params.usuarioId as unknown as string,
    p_accion: params.accion,
    p_entidad_id: params.entidadId as unknown as string,
    p_detalle: params.detalle as unknown as Json,
  });
  if (error) {
    console.error("[bitacora] fn_log_correo falló:", error.message);
    return null;
  }
  return (data as unknown as string) ?? null;
}

export type AccionEvento =
  | "solicitud_creada"
  | "solicitud_editada"
  | "solicitud_eliminada"
  | "usuario_creado"
  | "usuario_desactivado"
  | "usuario_reactivado"
  | "plantilla_creada"
  | "reporte_creado_desde_plantilla"
  | "reporte_congelado"
  | "registro_creado"
  | "registro_editado"
  | "registro_desactivado"
  | "registro_reactivado"
  | "registro_valores_capturados";

/**
 * Registra un evento de gestión (crear/editar/eliminar solicitud, alta/baja de
 * usuario, plantillas) en la bitácora vía fn_log_evento (SECURITY DEFINER). La
 * bitácora es append-only con INSERT revocado a 'authenticated'; esta función es
 * la única vía para que las acciones del staff dejen traza. Devuelve el id o null.
 */
export async function logEvento(
  db: SupabaseClient<Database>,
  params: {
    tenantId: string | null;
    usuarioId: string | null;
    accion: AccionEvento;
    entidad:
      | "solicitudes"
      | "perfiles_usuario"
      | "plantillas"
      | "reportes"
      | "registros_clima";
    entidadId: string | null;
    detalle: Record<string, unknown>;
  }
): Promise<string | null> {
  const { data, error } = await db.rpc("fn_log_evento", {
    p_tenant_id: params.tenantId as unknown as string,
    p_usuario_id: params.usuarioId as unknown as string,
    p_accion: params.accion,
    p_entidad: params.entidad,
    p_entidad_id: params.entidadId as unknown as string,
    p_detalle: params.detalle as unknown as Json,
  });
  if (error) {
    console.error("[bitacora] fn_log_evento falló:", error.message);
    return null;
  }
  return (data as unknown as string) ?? null;
}
