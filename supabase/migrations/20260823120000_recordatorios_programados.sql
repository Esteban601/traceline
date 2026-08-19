-- =============================================================================
-- solicitudes_recordatorios — recordatorios PROGRAMADOS por solicitud.
--
-- El sistema de Fase 1 ya manda un digest semanal por responsable ("tienes N
-- pendientes"). Esto es lo otro: avisos atados a la FECHA LÍMITE de una solicitud
-- concreta, a N días de que venza. No reemplaza al digest; lo complementa, y
-- reutiliza su transporte (lib/email), sus plantillas y su CRON_SECRET.
--
-- Por qué una tabla y no un campo: los intervalos son varios por solicitud (7, 3
-- y 1 día antes es lo normal), se prenden y apagan por separado, y admiten
-- personalizados. Un array en `solicitudes` habría hecho imposible expresar
-- "apagado pero configurado", que es justo lo que distingue "nunca lo quisieron"
-- de "lo quitaron a propósito".
-- =============================================================================

create table public.solicitudes_recordatorios (
  id           uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes (id) on delete cascade,
  dias_antes   int  not null,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),

  -- Un recordatorio "0 días antes" es el día del vencimiento y no es un aviso
  -- previo; negativo sería recordar algo ya vencido, que es lo que hace el digest.
  constraint solicitudes_recordatorios_dias_positivos check (dias_antes > 0),
  -- Cota superior por sanidad: el campo es de captura libre y 3000 días es un
  -- dedazo, no una intención. Un año cubre cualquier ciclo de reporte anual.
  constraint solicitudes_recordatorios_dias_razonables check (dias_antes <= 365),
  -- Dos filas con el mismo intervalo mandarían dos correos el mismo día.
  constraint solicitudes_recordatorios_unico unique (solicitud_id, dias_antes)
);

comment on table public.solicitudes_recordatorios is
  'Recordatorios programados de una solicitud: avisa a los usuarios de su área N días antes de la fecha límite. Los evalúa el cron diario (fecha_limite - dias_antes = hoy). Sin fecha_limite la configuración existe pero nunca dispara — es válida y deliberada: las solicitudes clonadas de plantilla nacen con los presets y la fecha se pone después.';
comment on column public.solicitudes_recordatorios.dias_antes is
  'Días naturales ANTES de solicitudes.fecha_limite en que se manda el aviso. 1 = el día previo.';
comment on column public.solicitudes_recordatorios.activo is
  'false = configurado y apagado a propósito (distinto de no existir, que es "nunca se configuró"). El cron solo evalúa los activos.';

create index solicitudes_recordatorios_solicitud_idx
  on public.solicitudes_recordatorios (solicitud_id);
-- El cron filtra por activo y cruza contra la fecha límite de la solicitud.
create index solicitudes_recordatorios_activos_idx
  on public.solicitudes_recordatorios (solicitud_id) where activo;

-- -----------------------------------------------------------------------------
-- GRANTS. Tabla NUEVA: el grant "on all tables" de la migración inicial es
-- puntual, no futuro, así que se otorga aquí explícitamente.
--
--   · authenticated → los cuatro comandos; RLS decide las filas.
--   · service_role  → solo SELECT: el cron LEE la configuración y no la modifica.
--     Que un proceso automático pueda apagar recordatorios sería un modo de
--     silenciar el sistema sin que nadie lo decidiera.
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.solicitudes_recordatorios to authenticated;
grant select on public.solicitudes_recordatorios to service_role;

alter table public.solicitudes_recordatorios enable row level security;

-- -----------------------------------------------------------------------------
-- ¿Quién GESTIONA los recordatorios de una solicitud?
--
-- El staff de IRStrat y el administrador del cliente DE ESE TENANT — incluidos
-- los recordatorios de solicitudes de origen 'irstrat'. Es una excepción
-- deliberada a la regla de origen, y la razón es de quién es el correo: a quien
-- se le avisa es a SU gente. La regla de origen protege quién revisa y valida el
-- CONTENIDO; el calendario de avisos internos del cliente no es contenido.
--
-- El usuario de área NO gestiona: ve su configuración (política de lectura) para
-- saber cuándo le van a escribir, y nada más.
--
-- Un reporte CONGELADO queda fuera: sus solicitudes son solo-lectura por candado
-- de base, y programar avisos sobre algo cerrado para aseguramiento es ruido con
-- forma de trazabilidad.
-- -----------------------------------------------------------------------------
create or replace function public.fn_gestiona_recordatorios(p_solicitud_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant  uuid;
  v_estado  text;
begin
  select r.tenant_id, r.estado
    into v_tenant, v_estado
  from public.solicitudes s
  join public.reportes r on r.id = s.reporte_id
  where s.id = p_solicitud_id;

  if v_tenant is null then
    return false;               -- solicitud inexistente
  end if;
  if v_estado = 'congelado' then
    return false;               -- reporte cerrado para aseguramiento
  end if;

  if public.fn_is_staff() then
    return true;
  end if;
  return public.fn_is_admin_cliente() and v_tenant = public.fn_current_tenant();
end;
$$;

comment on function public.fn_gestiona_recordatorios is
  'Autorización de escritura sobre solicitudes_recordatorios: staff de IRStrat o admin_cliente del tenant de la solicitud, y solo si su reporte NO está congelado.';

grant execute on function public.fn_gestiona_recordatorios(uuid) to authenticated, service_role;

-- Lectura: quien puede ver la solicitud puede ver cuándo se le va a recordar.
-- Reutiliza fn_puede_ver_solicitud (staff, tenant, área y responsable), que es la
-- misma función que gobierna la visibilidad de evidencias y comentarios: si un
-- usuario de área no ve la solicitud, tampoco ve su calendario de avisos.
create policy recordatorios_select on public.solicitudes_recordatorios
  for select to authenticated
  using (public.fn_puede_ver_solicitud(solicitud_id));

create policy recordatorios_gestiona on public.solicitudes_recordatorios
  for all to authenticated
  using (public.fn_gestiona_recordatorios(solicitud_id))
  with check (public.fn_gestiona_recordatorios(solicitud_id));
