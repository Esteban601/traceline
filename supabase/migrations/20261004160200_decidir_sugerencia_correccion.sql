-- =============================================================================
-- Corrección de fn_puede_decidir_sugerencia y fn_decidir_sugerencia (encargo
-- 2026-10-04, captura sugerida — Paso 4). La encontró el e2e del paso.
--
-- 1. HUECO DE PERMISOS. fn_puede_ver_solicitud devuelve NULL —no false— cuando
--    un responsable o jefe de área mira una solicitud de OTRA área que no tiene
--    responsable asignado (`area_igual OR responsable = uid` → `false OR NULL`).
--    En una política de RLS un NULL niega, por eso el resto del esquema no lo
--    nota; pero en `if not fn_puede_ver_solicitud(...)` un NULL no entra, y
--    fn_puede_decidir_sugerencia terminaba en `true`. En local, un responsable
--    de Operaciones pudo confirmar una sugerencia de RH. Ahora un NULL es «no».
--    No se tocó nada en staging: estas funciones solo existen en local y dev.
-- 2. MENSAJES. Los SQLSTATE 22023, P0002 y 55000 los devuelve PostgREST como
--    500 y el usuario veía «Something went wrong». Pasan a PT400, PT404 y PT409
--    (PostgREST responde ese estado HTTP con el mensaje). 42501 se queda (403).
--
-- Reemplaza el cuerpo de dos funciones propias de 20261004150100; la firma no
-- cambia. Idempotente.
-- =============================================================================

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
  -- coalesce: fn_puede_ver_solicitud devuelve NULL (no false) para un rol de
  -- área frente a otra área sin responsable asignado (`false OR NULL`). En RLS
  -- un NULL niega; en un IF, `not NULL` no entra y la función seguía a `true`.
  if not coalesce(public.fn_puede_ver_solicitud(p_solicitud_id), false) then
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
    raise exception 'Acción no válida: %.', p_accion using errcode = 'PT400';
  end if;

  select * into s from public.sugerencias_captura where id = p_sugerencia_id for update;
  if not found then
    raise exception 'No se encontró la sugerencia.' using errcode = 'PT404';
  end if;
  if not coalesce(public.fn_puede_decidir_sugerencia(s.solicitud_id), false) then
    raise exception 'No puedes decidir sobre esta solicitud.' using errcode = '42501';
  end if;
  if s.estado <> 'sugerida' then
    raise exception 'La sugerencia ya no está pendiente (está %).', s.estado using errcode = 'PT409';
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
        raise exception 'Para corregir indica el valor y la unidad.' using errcode = 'PT400';
      end if;
      v_valor   := p_valor;
      v_unidad  := trim(p_unidad);
      v_periodo := coalesce(nullif(trim(coalesce(p_periodo, '')), ''), s.periodo);
    end if;
    if v_valor is null or v_unidad is null then
      raise exception 'La sugerencia no tiene una cifra que capturar.' using errcode = 'PT400';
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
    raise exception 'Para corregir indica el texto.' using errcode = 'PT400';
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
