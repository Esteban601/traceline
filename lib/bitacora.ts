import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

export type AccionCorreo =
  | "solicitud_enviada"
  | "recordatorio_enviado"
  // Recordatorio PROGRAMADO de una solicitud (N días antes de su fecha límite).
  // Va aparte del digest porque es lo que hace idempotente al cron y porque en la
  // bitácora se lee distinto: "faltan 3 días para esta solicitud", no "tienes N".
  | "recordatorio_programado_enviado"
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
  | "registro_valores_capturados"
  | "objetivo_creado"
  | "objetivo_editado"
  | "objetivo_desactivado"
  | "objetivo_reactivado"
  | "cuestionario_respondido"
  // Descarga del Suplemento NIIF S1/S2 como documento de Word.
  | "suplemento_word_descargado"
  // Perfil del emisor (Suplemento S1/S2): lo institucional que alimenta el
  // documento. Se registra por sección para saber qué se actualizó y cuándo.
  | "perfil_emisor_actualizado"
  | "perfil_organigrama_subido"
  | "perfil_adjunto_subido"
  | "perfil_adjunto_eliminado"
  | "reporte_regimen_actualizado"
  // Generador del suplemento: cada bloque generado cuesta dinero y lo escribió
  // un modelo. Queda quién, cuándo, con qué modelo y cuánto costó.
  | "suplemento_bloque_generado"
  | "suplemento_documento_abierto"
  | "suplemento_documento_estado"
  | "tenant_creado"
  | "tenant_desactivado"
  | "tenant_reactivado"
  | "tenant_logo_actualizado"
  | "tenant_logo_eliminado"
  // Toggle "carga por IRStrat", por cliente (solo el rol admin de la firma).
  | "tenant_carga_staff_habilitada"
  | "tenant_carga_staff_deshabilitada"
  // Áreas del cliente (catálogo por tenant).
  | "area_creada"
  | "area_editada"
  | "area_desactivada"
  | "area_reactivada"
  | "invitacion_creada"
  | "invitacion_usada"
  // Visto bueno del ÁREA (doble verificación). La revocación automática la
  // registra la BASE (fn_evidencia_revoca_vb), no la aplicación: si dependiera de
  // una server action, una carga hecha por otra vía la dejaría sin rastro.
  | "vb_area_dado"
  | "vb_area_retirado"
  | "vb_area_revocado"
  // Difusión multi-área: un acto de quien pregunta ("se difundió a N áreas"), y
  // los dos de la respuesta — el área que declara que no le corresponde, y quien
  // difundió retirando las copias que sobraron.
  | "solicitud_difundida"
  | "solicitud_declinada"
  | "solicitud_retomada"
  | "copia_desactivada";

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
      | "registros_clima"
      | "objetivos"
      | "cuestionarios_respuestas"
      | "perfil_emisor"
      | "documentos_generados"
      | "tenants"
      | "areas_tenant"
      | "invitaciones";
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
