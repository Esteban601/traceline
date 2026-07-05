-- =============================================================================
-- Infraestructura para el sistema de correo (Fase 1).
--
--  1. service_role: acceso server-side para procesos SIN sesión de usuario
--     (cron de recordatorios y disparo manual). service_role hace BYPASS de RLS,
--     pero necesita GRANTs de tabla; el esquema inicial solo otorgó a
--     'authenticated'. Aquí se le concede lo mínimo necesario.
--
--  2. fn_log_correo: registra eventos de correo en bitacora. La bitácora es
--     APPEND ONLY y su INSERT está revocado para 'authenticated'; esta función
--     SECURITY DEFINER (owner postgres) permite que tanto las acciones del staff
--     (authenticated) como el cron (service_role) dejen traza sin abrir la tabla.
-- =============================================================================

-- 1. Privilegios de service_role -------------------------------------------------
grant usage on schema public to service_role;
grant select on
  public.solicitudes,
  public.perfiles_usuario,
  public.reportes,
  public.tenants,
  public.comentarios,
  public.mapeo_solicitud_datapoint,
  public.datapoints_taxonomia,
  public.bitacora
  to service_role;
-- El cron cambia estados (p. ej. no aplica hoy, pero deja el margen para operar)
grant update on public.solicitudes to service_role;

-- 2. Log de eventos de correo ----------------------------------------------------
-- entidad = 'correo'. accion ∈ {'solicitud_enviada','recordatorio_enviado','aviso_observacion'}.
-- detalle guarda destinatario (email/nombre/responsable_id), solicitud_ids, etc.
-- created_at (default now()) es el timestamp del evento.
create or replace function public.fn_log_correo(
  p_tenant_id   uuid,
  p_usuario_id  uuid,
  p_accion      text,
  p_entidad_id  uuid,
  p_detalle     jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.bitacora (tenant_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (p_tenant_id, p_usuario_id, p_accion, 'correo', p_entidad_id, coalesce(p_detalle, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.fn_log_correo(uuid, uuid, text, uuid, jsonb)
  to authenticated, service_role;

comment on function public.fn_log_correo is
  'Registra un evento de correo en bitacora (append-only). SECURITY DEFINER: usado por acciones de staff (authenticated) y por el cron (service_role).';
