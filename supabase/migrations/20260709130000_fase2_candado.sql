-- =============================================================================
-- Fase 2 — Candado de trazabilidad.
--
--  1. Justificación de ajustes: columna justificacion en evidencias y
--     capturas_valor. Al llegar evidencia/captura sobre una solicitud 'validado',
--     el estado regresa automáticamente a 'en_revision' (a nivel BD) y la
--     justificación queda en la bitácora.
--
--  2. Congelamiento de reporte: con el reporte 'congelado', se bloquea a nivel BD
--     el INSERT de evidencias/capturas/comentarios sobre sus solicitudes y
--     cualquier UPDATE de esas solicitudes (incluido cambio de estado). Además se
--     impide descongelar (revertir estado) — es decisión administrativa futura
--     con su propia migración (ver README).
--
--  La lectura y el export siguen funcionando (no se tocan las políticas SELECT).
-- =============================================================================

-- 1. Justificación de ajustes ----------------------------------------------------
alter table public.evidencias      add column justificacion text;
alter table public.capturas_valor  add column justificacion text;

comment on column public.evidencias.justificacion is
  'Motivo del ajuste/reemplazo. Obligatoria (>=20 chars, validado en la app) al reponer evidencia sobre una solicitud ya validada.';
comment on column public.capturas_valor.justificacion is
  'Motivo del ajuste de valor. Acompaña a la evidencia que la origina cuando corrige una solicitud validada.';

-- Reescritura del trigger AFTER INSERT de evidencias: transición de estado según
-- el estado actual (incluye validado -> en_revision) y justificación en bitácora.
create or replace function public.fn_evidencia_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.solicitudes
     set estado = case
       when estado in ('pendiente', 'solicitado') then 'recibido'
       when estado = 'validado' then 'en_revision'  -- reapertura por evidencia nueva
       else estado
     end
   where id = new.solicitud_id
     and estado in ('pendiente', 'solicitado', 'validado');

  insert into public.bitacora (tenant_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (
    public.fn_tenant_de_solicitud(new.solicitud_id),
    new.subido_por,
    'evidencia_creada',
    'evidencias',
    new.id,
    jsonb_build_object(
      'solicitud_id', new.solicitud_id,
      'version', new.version,
      'archivo_path', new.archivo_path,
      'nombre_original', new.nombre_original,
      'justificacion', new.justificacion
    )
  );
  return new;
end;
$$;

-- Reescritura del trigger AFTER INSERT de capturas: justificación en bitácora y
-- reapertura de validadas por captura nueva.
create or replace function public.fn_captura_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bitacora (tenant_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (
    public.fn_tenant_de_solicitud(new.solicitud_id),
    new.capturado_por,
    'captura_creada',
    'capturas_valor',
    new.id,
    jsonb_build_object(
      'solicitud_id', new.solicitud_id,
      'evidencia_id', new.evidencia_id,
      'valor', new.valor,
      'unidad', new.unidad,
      'periodo', new.periodo,
      'confirmado', new.confirmado,
      'justificacion', new.justificacion
    )
  );

  -- Reapertura si la solicitud estaba validada (el cambio de estado se registra
  -- por su propio trigger). Idempotente: solo actúa si estaba 'validado'.
  update public.solicitudes
     set estado = 'en_revision'
   where id = new.solicitud_id
     and estado = 'validado';

  return new;
end;
$$;

-- 2. Congelamiento de reporte — candado a nivel BD ------------------------------

-- Estado del reporte al que pertenece una solicitud (SECURITY DEFINER: los
-- triggers lo consultan sin depender de RLS).
create or replace function public.fn_reporte_estado_de_solicitud(p_solicitud_id uuid)
returns public.estado_reporte
language sql
stable
security definer
set search_path = public
as $$
  select r.estado
  from public.solicitudes s
  join public.reportes r on r.id = s.reporte_id
  where s.id = p_solicitud_id;
$$;

-- Bloqueo de INSERT (evidencias / capturas / comentarios) si el reporte está
-- congelado. Un solo cuerpo reutilizable por las tres tablas (todas tienen
-- solicitud_id).
create or replace function public.fn_bloquea_ins_si_congelado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.fn_reporte_estado_de_solicitud(new.solicitud_id) = 'congelado' then
    raise exception 'El reporte está congelado; la evidencia quedó cerrada para aseguramiento y no admite cambios.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_evidencia_no_si_congelado
  before insert on public.evidencias
  for each row execute function public.fn_bloquea_ins_si_congelado();

create trigger trg_captura_no_si_congelado
  before insert on public.capturas_valor
  for each row execute function public.fn_bloquea_ins_si_congelado();

create trigger trg_comentario_no_si_congelado
  before insert on public.comentarios
  for each row execute function public.fn_bloquea_ins_si_congelado();

-- Bloqueo de UPDATE de solicitudes de un reporte ya congelado (incluye cambios
-- de estado). El acto de congelar actualiza las solicitudes MIENTRAS el reporte
-- aún está 'activo' (ver acción congelarReporte), por lo que ese paso no se
-- bloquea; una vez congelado el reporte, nada de sus solicitudes cambia.
create or replace function public.fn_bloquea_upd_solicitud_congelada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.estado_reporte;
begin
  select estado into v_estado from public.reportes where id = old.reporte_id;
  if v_estado = 'congelado' then
    raise exception 'El reporte está congelado; sus solicitudes quedaron en solo-lectura.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_solicitud_no_upd_si_congelada
  before update on public.solicitudes
  for each row execute function public.fn_bloquea_upd_solicitud_congelada();

-- Impedir descongelar: una vez 'congelado', el estado del reporte no puede
-- revertirse (no se implementa descongelar en esta fase; ver README).
create or replace function public.fn_bloquea_descongelar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.estado = 'congelado' and new.estado is distinct from 'congelado' then
    raise exception 'Un reporte congelado no puede descongelarse (decisión administrativa fuera de alcance).'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_reporte_no_descongelar
  before update on public.reportes
  for each row execute function public.fn_bloquea_descongelar();
