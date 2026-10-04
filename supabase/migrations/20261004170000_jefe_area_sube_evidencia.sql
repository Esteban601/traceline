-- =============================================================================
-- HOTFIX v32.1 · El jefe de área puede entregar evidencia.
--
-- Fallo (en main desde la difusión, 20260826120000): el jefe de área no podía
-- subir evidencia a una solicitud en «pendiente», «solicitado» o «validado». La
-- carga la registra fn_evidencia_after_insert, que mueve el estado de la solicitud
-- con la sesión de quien sube; fn_valida_vb_area solo deja al jefe cambiar el
-- visto bueno y `declinada`, así que rechazaba ese cambio de estado y la carga
-- entera («El jefe de área solo puede dar o retirar el visto bueno…»). En
-- «recibido», «en revisión» u «observaciones» la carga no cambia el estado y sí
-- funcionaba. Lo esperado (lib/roles.ts, manual del cliente): el jefe carga como
-- el responsable de su área, además de dar el visto bueno.
--
-- Corrección, con el patrón que ya usa app.vb_automatico:
--   · fn_evidencia_after_insert marca su cambio de estado con
--     app.estado_por_evidencia (local a la transacción);
--   · fn_valida_vb_area deja pasar ese cambio de `estado` del jefe y nada más.
--     Un UPDATE directo del jefe sobre el estado se sigue rechazando.
--
-- Reemplaza el cuerpo de dos funciones existentes; firmas y triggers sin cambio.
-- Idempotente. Sin cambios de esquema.
-- =============================================================================

create or replace function public.fn_evidencia_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.transicion_automatica', '1', true);
  -- Hotfix v32.1: marca que este cambio de estado lo hace la CARGA de evidencia,
  -- para que fn_valida_vb_area deje entregar al jefe de área.
  perform set_config('app.estado_por_evidencia', '1', true);
  update public.solicitudes
     set estado = case
       when estado in ('pendiente', 'solicitado') then 'recibido'
       when estado = 'validado' then 'en_revision'  -- reapertura por evidencia nueva
       else estado
     end
   where id = new.solicitud_id
     and estado in ('pendiente', 'solicitado', 'validado');
  perform set_config('app.transicion_automatica', '0', true);
  perform set_config('app.estado_por_evidencia', '0', true);

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
      'justificacion', new.justificacion,
      -- Trazabilidad de la carga por IRStrat: la bitácora lo registra igual que
      -- el historial, con el área en cuyo nombre se cargó.
      'cargado_por_staff', new.cargado_por_staff,
      'area_origen', new.area_origen
    )
  );
  return new;
end;
$$;

create or replace function public.fn_valida_vb_area()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cambia_vb boolean;
  v_es_jefe   boolean;
begin
  v_cambia_vb := (new.vb_area_por, new.vb_area_fecha)
                 is distinct from (old.vb_area_por, old.vb_area_fecha);

  -- Lo que un JEFE DE ÁREA puede cambiar de la fila: el visto bueno (este sprint)
  -- y la declaración de "no aplica a mi área" (difusión). Nada más. Se compara el
  -- resto en bloque para que una columna futura quede protegida sin tocar esto.
  --
  -- Hotfix v32.1: el jefe de área también ENTREGA evidencia, como el responsable.
  -- Al cargarla, fn_evidencia_after_insert mueve el estado (solicitado → recibido,
  -- validado → en revisión) con la sesión del jefe, y aquí se rechazaba. Ese cambio
  -- de `estado`, y solo ese, pasa cuando lo marca la carga (app.estado_por_evidencia).
  -- Un UPDATE directo del jefe sobre el estado no lleva la marca y se sigue rechazando.
  if auth.uid() is not null and public.fn_current_rol() = 'jefe_area' then
    if (to_jsonb(new) - 'vb_area_por' - 'vb_area_fecha' - 'declinada'
          - case when coalesce(current_setting('app.estado_por_evidencia', true), '0') = '1'
                 then 'estado' else '' end)
       is distinct from (to_jsonb(old) - 'vb_area_por' - 'vb_area_fecha' - 'declinada'
          - case when coalesce(current_setting('app.estado_por_evidencia', true), '0') = '1'
                 then 'estado' else '' end) then
      raise exception 'El jefe de área solo puede dar o retirar el visto bueno de su área, o declarar que la solicitud no le corresponde.'
        using errcode = 'check_violation';
    end if;
  end if;

  if not v_cambia_vb then
    return new;
  end if;

  -- Revocación automática por evidencia nueva (trg_evidencia_revoca_vb).
  if coalesce(current_setting('app.vb_automatico', true), '0') = '1' then
    return new;
  end if;

  -- Sin sesión (seed, import con service_role, migraciones): no se gatea.
  if auth.uid() is null then
    return new;
  end if;

  -- Una vez validada, la marca queda fija.
  if old.estado in ('validado', 'congelado') then
    raise exception 'La solicitud ya está validada: el visto bueno del área queda fijo.'
      using errcode = 'check_violation';
  end if;

  v_es_jefe := public.fn_es_jefe_de_area(new.id);
  if not v_es_jefe then
    raise exception 'El visto bueno del área solo lo da o retira el jefe de esa área.'
      using errcode = 'check_violation';
  end if;

  if new.vb_area_por is not null then
    if not exists (select 1 from public.evidencias where solicitud_id = new.id) then
      raise exception 'No hay evidencia cargada: no se puede dar visto bueno a una solicitud vacía.'
        using errcode = 'check_violation';
    end if;
    new.vb_area_por   := auth.uid();
    new.vb_area_fecha := now();
  else
    new.vb_area_fecha := null;
  end if;

  return new;
end;
$$;
