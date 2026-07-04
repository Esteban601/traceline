-- =============================================================================
-- Triggers — versionado de evidencia, transición de estado y bitácora automática
--
-- Todas las funciones son SECURITY DEFINER (owner postgres) para poder escribir
-- en bitacora saltándose RLS: la bitácora se puebla SOLO por el sistema, nunca
-- por INSERT directo de la aplicación.
-- =============================================================================

-- Utilidad: tenant_id a partir de una solicitud (para etiquetar la bitácora).
create or replace function public.fn_tenant_de_solicitud(p_solicitud_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.tenant_id
  from public.solicitudes s
  join public.reportes r on r.id = s.reporte_id
  where s.id = p_solicitud_id;
$$;

-- -----------------------------------------------------------------------------
-- evidencias: BEFORE INSERT -> asigna version = max(version)+1 de la solicitud
-- -----------------------------------------------------------------------------
create or replace function public.fn_evidencia_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(max(version), 0) + 1
    into new.version
  from public.evidencias
  where solicitud_id = new.solicitud_id;
  return new;
end;
$$;

create trigger trg_evidencia_before_insert
  before insert on public.evidencias
  for each row execute function public.fn_evidencia_before_insert();

-- -----------------------------------------------------------------------------
-- evidencias: AFTER INSERT
--   * avanza estado 'pendiente'/'solicitado' -> 'recibido'
--     (el cambio de estado dispara su propia entrada de bitácora)
--   * registra 'evidencia_creada' en bitácora
-- -----------------------------------------------------------------------------
create or replace function public.fn_evidencia_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.solicitudes
     set estado = 'recibido'
   where id = new.solicitud_id
     and estado in ('pendiente', 'solicitado');

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
      'nombre_original', new.nombre_original
    )
  );
  return new;
end;
$$;

create trigger trg_evidencia_after_insert
  after insert on public.evidencias
  for each row execute function public.fn_evidencia_after_insert();

-- -----------------------------------------------------------------------------
-- capturas_valor: AFTER INSERT -> registra 'captura_creada'
-- -----------------------------------------------------------------------------
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
      'confirmado', new.confirmado
    )
  );
  return new;
end;
$$;

create trigger trg_captura_after_insert
  after insert on public.capturas_valor
  for each row execute function public.fn_captura_after_insert();

-- -----------------------------------------------------------------------------
-- solicitudes: AFTER UPDATE de estado -> registra 'cambio_estado'
--   usuario_id = auth.uid() (NULL para acciones de sistema/seed, p.ej. la
--   transición automática al subir evidencia).
-- -----------------------------------------------------------------------------
create or replace function public.fn_solicitud_estado_bitacora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado is distinct from old.estado then
    insert into public.bitacora (tenant_id, usuario_id, accion, entidad, entidad_id, detalle)
    values (
      public.fn_tenant_de_solicitud(new.id),
      auth.uid(),
      'cambio_estado',
      'solicitudes',
      new.id,
      jsonb_build_object(
        'estado_anterior', old.estado,
        'estado_nuevo', new.estado,
        'titulo', new.titulo
      )
    );
  end if;
  return new;
end;
$$;

create trigger trg_solicitud_estado_bitacora
  after update on public.solicitudes
  for each row execute function public.fn_solicitud_estado_bitacora();
