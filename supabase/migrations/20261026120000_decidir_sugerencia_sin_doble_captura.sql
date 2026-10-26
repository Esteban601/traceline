-- =============================================================================
-- Sin doble captura al decidir una sugerencia (encargo 2026-10-26-carga-lectura-
-- primero). Con la carga en dos momentos (archivo → lectura → cifra), quien
-- carga puede escribir la cifra a mano en el paso 3 si la lectura tarda, falla o
-- no encuentra nada; si la sugerencia llega después, confirmarla insertaba una
-- segunda captura de la misma evidencia. Ahora, con una captura confirmada de
-- esa evidencia, confirmar o corregir responde PT409 (409) con el mensaje que
-- muestra la pantalla, sin insertar ni cambiar la sugerencia.
--
-- Además, `service_role` lee `capturas_valor`: la generación de la sugerencia y
-- el resumen diario (service role) comprueban si la evidencia ya tiene cifra.
-- En dev el permiso ya existe (comprobado el 26/10/2026; aquí es no-op); en
-- staging no se ha comprobado. En el stack local faltaba, y la consulta
-- devolvía «sin cifra» en silencio.
--
-- Reemplaza el cuerpo de fn_decidir_sugerencia (20261005122500); la firma, los
-- permisos y el resto del cuerpo no cambian. Idempotente. No crea tablas: la
-- barrera se llama igual, por la regla de CLAUDE.md §3.
-- =============================================================================

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

  -- Sin doble captura (encargo carga-lectura-primero): si la evidencia ya tiene
  -- una cifra confirmada —el paso 3 manual mientras la lectura corría—, una
  -- sugerencia numérica no se confirma ni se corrige; la sugerencia queda como
  -- está. Rechazarla sí se puede.
  if s.tipo = 'numerica' and p_accion in ('confirmar', 'corregir') and exists (
       select 1 from public.capturas_valor c
        where c.evidencia_id = s.evidencia_id and c.confirmado) then
    raise exception 'Esta evidencia ya tiene una cifra confirmada.' using errcode = 'PT409';
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

grant select on public.capturas_valor to service_role;

select public.fn_aplicar_barrera_auditor();
