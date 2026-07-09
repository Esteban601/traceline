-- =============================================================================
-- Módulo de gestión (Fase 1, cierre) — administración desde el panel interno.
--
--  1. perfiles_usuario.activo: permite DESACTIVAR/REACTIVAR usuarios del cliente
--     sin borrarlos (la trazabilidad prohíbe eliminar historia). El bloqueo real
--     de acceso lo aplica la app baneando el usuario en auth.users (GoTrue).
--
--  2. fn_log_evento: registra en bitacora las acciones de gestión del staff
--     (crear/editar/eliminar solicitud, alta/baja de usuario, plantillas). La
--     bitácora es APPEND ONLY y su INSERT está revocado para 'authenticated';
--     esta función SECURITY DEFINER (owner postgres) deja traza sin abrir la
--     tabla, igual que fn_log_correo pero con 'entidad' parametrizable.
--
--  3. plantillas + plantilla_solicitudes: checklists reutilizables, GLOBALES de
--     la firma (sin tenant). Solo staff las ve y gestiona (RLS). Los mapeos a
--     datapoints se guardan como snapshot en un arreglo uuid[] (el catálogo de
--     datapoints es estable y global; una plantilla es una foto, no una relación
--     viva) — así se honran las "dos tablas" del alcance.
-- =============================================================================

-- 1. Usuarios activos/inactivos --------------------------------------------------
alter table public.perfiles_usuario
  add column activo boolean not null default true;

comment on column public.perfiles_usuario.activo is
  'Usuario activo. Desactivar (no eliminar) revoca el acceso; el ban en auth.users lo aplica la app. La trazabilidad prohíbe borrar usuarios.';

-- 2. Log de eventos de gestión ---------------------------------------------------
-- entidad ∈ {'solicitudes','perfiles_usuario','plantillas','reportes'}.
-- accion  p.ej. 'solicitud_creada','solicitud_editada','solicitud_eliminada',
--               'usuario_creado','usuario_desactivado','usuario_reactivado',
--               'plantilla_creada','reporte_creado_desde_plantilla'.
create or replace function public.fn_log_evento(
  p_tenant_id   uuid,
  p_usuario_id  uuid,
  p_accion      text,
  p_entidad     text,
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
  values (p_tenant_id, p_usuario_id, p_accion, p_entidad, p_entidad_id, coalesce(p_detalle, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.fn_log_evento(uuid, uuid, text, text, uuid, jsonb)
  to authenticated, service_role;

comment on function public.fn_log_evento is
  'Registra un evento de gestión en bitacora (append-only). SECURITY DEFINER: usado por acciones de staff (authenticated) y procesos server-side (service_role).';

-- 3. Plantillas de checklist -----------------------------------------------------
create table public.plantillas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  creado_por  uuid references public.perfiles_usuario (id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.plantillas is
  'Checklists reutilizables de solicitudes, globales de la firma (sin tenant). Solo staff (RLS).';

create table public.plantilla_solicitudes (
  id              uuid primary key default gen_random_uuid(),
  plantilla_id    uuid not null references public.plantillas (id) on delete cascade,
  titulo          text not null,
  descripcion     text,
  area_asignada   text,
  es_cuantitativa boolean not null default false,
  unidad_esperada text,
  orden           int not null default 0,
  datapoint_ids   uuid[] not null default '{}',   -- snapshot de mapeo a datapoints
  created_at      timestamptz not null default now()
);

comment on table public.plantilla_solicitudes is
  'Solicitudes de una plantilla (sin estado ni evidencia). datapoint_ids: snapshot del mapeo a la taxonomía.';

create index plantilla_solicitudes_plantilla_idx on public.plantilla_solicitudes (plantilla_id);

-- RLS: plantillas visibles y gestionables SOLO por staff IRStrat.
alter table public.plantillas            enable row level security;
alter table public.plantilla_solicitudes enable row level security;

-- Las tablas nuevas NO quedan cubiertas por el grant "on all tables" de la
-- migración inicial (ese grant es puntual, no futuro): se otorgan aquí.
grant select, insert, update, delete on public.plantillas            to authenticated;
grant select, insert, update, delete on public.plantilla_solicitudes to authenticated;
grant select on public.plantillas, public.plantilla_solicitudes to service_role;

create policy plantillas_staff_all on public.plantillas
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

create policy plantilla_solicitudes_staff_all on public.plantilla_solicitudes
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());
