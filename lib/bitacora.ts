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
