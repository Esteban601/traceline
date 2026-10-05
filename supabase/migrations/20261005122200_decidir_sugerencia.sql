-- =============================================================================
-- Decisión sobre una sugerencia (encargo 2026-10-04, captura sugerida — Paso 4).
--
-- fn_decidir_sugerencia(sugerencia, acción, …) confirma, corrige o rechaza una
-- sugerencia en UNA transacción:
--   · cambia su estado (confirmada / corregida / rechazada) con quién y cuándo;
--   · si es numérica y se aceptó, crea la captura en capturas_valor exactamente
--     como una captura manual, con `origen = 'sugerida'` y `sugerencia_id`. Los
--     triggers de capturas_valor corren igual (bitácora `captura_creada`,
--     bloqueo si el reporte está congelado);
--   · escribe la bitácora: sugerencia_confirmada / _corregida / _rechazada.
-- Un extracto de texto aceptado se queda en la sugerencia (decisión 4 del
-- Paso 0); el Excel solo recibe números.
--
-- QUIÉN DECIDE: quien hoy puede capturar (fn_puede_decidir_sugerencia):
--   · ve la solicitud (fn_puede_ver_solicitud: área propia para responsable y
--     jefe; todo el tenant para coordinador y administrador del cliente);
--   · el staff, solo si la emisora tiene `staff_puede_cargar`, porque sin él
--     tampoco puede cargar ni capturar;
--   · el AUDITOR, nunca. La función es SECURITY DEFINER —se salta RLS y con
--     ella la barrera de escritura—, así que el rechazo va explícito y primero.
--
-- También: un índice único de «una visible por solicitud» que cuenta
-- `sin_hallazgo`, el extracto corregido y el origen de la captura.
--
-- Aditiva: columnas nullable o con default, índice nuevo, funciones nuevas.
-- Idempotente. Termina con fn_aplicar_barrera_auditor() (CLAUDE.md §3).
-- =============================================================================

-- Una sola visible por solicitud: sugerida o sin hallazgo.
create unique index if not exists sugerencias_captura_visible_idx
  on public.sugerencias_captura (solicitud_id) where estado in ('sugerida', 'sin_hallazgo');

alter table public.sugerencias_captura
  add column if not exists extracto_final text;
comment on column public.sugerencias_captura.extracto_final is
  'Extracto tal como quedó al corregir una sugerencia de texto. Ya no es literal de la evidencia: lo escribió quien decidió.';

alter table public.capturas_valor
  add column if not exists origen text not null default 'manual';
alter table public.capturas_valor
  add column if not exists sugerencia_id uuid references public.sugerencias_captura (id);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'capturas_valor_origen_check') then
    alter table public.capturas_valor
      add constraint capturas_valor_origen_check check (origen in ('manual', 'sugerida'));
  end if;
end $$;
comment on column public.capturas_valor.origen is
  'manual: la tecleó una persona. sugerida: la propuso la plataforma y una persona la confirmó o corrigió (sugerencia_id).';

-- -----------------------------------------------------------------------------
-- ¿Puede el usuario actual decidir sobre las sugerencias de esta solicitud?
-- -----------------------------------------------------------------------------
create or replace function public.fn_puede_decidir_sugerencia(p_solicitud_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_toggle boolean;
begin
  if auth.uid() is null or public.fn_is_auditor() then
    return false;
  end if;
  if not public.fn_puede_ver_solicitud(p_solicitud_id) then
    return false;
  end if;
  if public.fn_is_staff() then
    select t.staff_puede_cargar into v_toggle
      from public.solicitudes s
      join public.reportes r on r.id = s.reporte_id
      join public.tenants t on t.id = r.tenant_id
     where s.id = p_solicitud_id;
    return coalesce(v_toggle, false);
  end if;
  return true;
end;
$$;

revoke all on function public.fn_puede_decidir_sugerencia(uuid) from public;
grant execute on function public.fn_puede_decidir_sugerencia(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- La decisión.
-- -----------------------------------------------------------------------------
create or replace function public.fn_decidir_sugerencia(
  p_sugerencia_id uuid,
  p_accion        text,
  p_valor         numeric default null,
  p_unidad        text    default null,
  p_periodo       text    default null,
  p_extracto      text    default null,
  p_motivo        text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  s          public.sugerencias_captura%rowtype;
  v_estado   public.estado_sugerencia;
  v_valor    numeric;
  v_unidad   text;
  v_periodo  text;
  v_captura  uuid;
  v_fuente   text;
begin
  if v_uid is null then
    raise exception 'Sesión no válida.' using errcode = '42501';
  end if;
  -- Primero y explícito: esta función se salta RLS, y con ella la barrera.
  if public.fn_is_auditor() then
    raise exception 'El auditor externo no puede decidir sugerencias.' using errcode = '42501';
  end if;
  if p_accion not in ('confirmar', 'corregir', 'rechazar') then
    raise exception 'Acción no válida: %.', p_accion using errcode = '22023';
  end if;

  select * into s from public.sugerencias_captura where id = p_sugerencia_id for update;
  if not found then
    raise exception 'No se encontró la sugerencia.' using errcode = 'P0002';
  end if;
  if not public.fn_puede_decidir_sugerencia(s.solicitud_id) then
    raise exception 'No puedes decidir sobre esta solicitud.' using errcode = '42501';
  end if;
  if s.estado <> 'sugerida' then
    raise exception 'La sugerencia ya no está pendiente (está %).', s.estado using errcode = '55000';
  end if;

  v_estado := case p_accion when 'confirmar' then 'confirmada'::public.estado_sugerencia
                            when 'corregir'  then 'corregida'::public.estado_sugerencia
                            else 'rechazada'::public.estado_sugerencia end;

  if s.tipo = 'numerica' and p_accion in ('confirmar', 'corregir') then
    if p_accion = 'confirmar' then
      -- Lo que se confirma es lo que se mostró: con conversión, la cifra convertida
      -- (la conversión también se confirma; encargo §3).
      v_valor   := coalesce((s.conversion ->> 'valor')::numeric, s.valor);
      v_unidad  := coalesce(s.conversion ->> 'unidad', s.unidad);
      v_periodo := s.periodo;
    else
      if p_valor is null or nullif(trim(coalesce(p_unidad, '')), '') is null then
        raise exception 'Para corregir indica el valor y la unidad.' using errcode = '22023';
      end if;
      v_valor   := p_valor;
      v_unidad  := trim(p_unidad);
      v_periodo := coalesce(nullif(trim(coalesce(p_periodo, '')), ''), s.periodo);
    end if;
    if v_valor is null or v_unidad is null then
      raise exception 'La sugerencia no tiene una cifra que capturar.' using errcode = '22023';
    end if;

    v_fuente := coalesce(s.fuente ->> 'hoja' || '!' || (s.fuente ->> 'celda'),
                         'página ' || (s.fuente ->> 'pagina'),
                         'párrafo ' || (s.fuente ->> 'parrafo'),
                         s.fuente ->> 'tipo');
    insert into public.capturas_valor
      (solicitud_id, evidencia_id, valor, unidad, periodo, capturado_por, confirmado, justificacion, origen, sugerencia_id)
    values
      (s.solicitud_id, s.evidencia_id, v_valor, v_unidad, v_periodo, v_uid, true,
       case when p_accion = 'confirmar'
            then 'Sugerida por la plataforma y confirmada (fuente: ' || coalesce(v_fuente, '—') || ').'
            else 'Sugerida por la plataforma y corregida (fuente: ' || coalesce(v_fuente, '—') || ').' end,
       'sugerida', s.id)
    returning id into v_captura;
  end if;

  if s.tipo = 'texto' and p_accion = 'corregir' and nullif(trim(coalesce(p_extracto, '')), '') is null then
    raise exception 'Para corregir indica el texto.' using errcode = '22023';
  end if;

  update public.sugerencias_captura
     set estado         = v_estado,
         decidido_por   = v_uid,
         decidido_en    = now(),
         valor_final    = case when s.tipo = 'numerica' then v_valor end,
         unidad_final   = case when s.tipo = 'numerica' then v_unidad end,
         extracto_final = case when s.tipo = 'texto' and p_accion = 'corregir' then trim(p_extracto) end,
         motivo_rechazo = case when p_accion = 'rechazar' then nullif(trim(coalesce(p_motivo, '')), '') end
   where id = s.id;

  perform public.fn_log_evento(
    s.tenant_id, v_uid, 'sugerencia_' || v_estado::text, 'sugerencia_captura', s.id,
    jsonb_strip_nulls(jsonb_build_object(
      'solicitud_id', s.solicitud_id,
      'tipo', s.tipo,
      'evidencia_version', s.evidencia_version,
      'valor_sugerido', s.valor,
      'unidad_sugerida', s.unidad,
      'valor', v_valor,
      'unidad', v_unidad,
      'periodo', v_periodo,
      'captura_id', v_captura,
      'motivo', case when p_accion = 'rechazar' then nullif(trim(coalesce(p_motivo, '')), '') end
    ))
  );

  return jsonb_build_object('estado', v_estado, 'captura_id', v_captura);
end;
$$;

revoke all on function public.fn_decidir_sugerencia(uuid, text, numeric, text, text, text, text) from public;
grant execute on function public.fn_decidir_sugerencia(uuid, text, numeric, text, text, text, text) to authenticated;

select public.fn_aplicar_barrera_auditor();
