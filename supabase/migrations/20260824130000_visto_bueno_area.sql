-- =============================================================================
-- VISTO BUENO DEL ÁREA — la doble verificación de la cadena real del cliente.
--
-- Cómo se recaba de verdad la información en una emisora: la gente del área
-- carga, su JEFE revisa que lo cargado sea lo que el área quiere entregar, y
-- encima va la validación final (IRStrat o el administrador del cliente, según el
-- origen). Hasta hoy la plataforma solo modelaba el primero y el tercero; el
-- segundo ocurría por WhatsApp y no dejaba rastro.
--
-- DECISIÓN: COLUMNAS, NO TABLA.
-- El visto bueno es un hecho de ESTADO ACTUAL —¿está firmada hoy, y por quién?—,
-- de un solo valor (un área, un jefe) y consultado en cada listado. Su HISTORIAL
-- ya tiene dónde vivir: `bitacora`, que es append-only y donde quedan las tres
-- clases de acto (dar, retirar y la revocación automática). Una tabla aparte
-- duplicaría ese registro y volvería la pregunta más frecuente —"¿tiene visto
-- bueno?"— en un `order by ... limit 1` por solicitud. La misma razón por la que
-- `solicitudes.estado` es una columna y su historia está en la bitácora.
--
-- LO QUE ESTO NO ES: no es un estado. La máquina de estados no cambia, la
-- validación final NO lo exige y el export oficial sigue mirando solo `validado`.
-- Es una marca paralela: dice que el área respalda lo entregado, no que el dato
-- esté aceptado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Las columnas
-- -----------------------------------------------------------------------------
alter table public.solicitudes
  add column vb_area_por   uuid references public.perfiles_usuario (id) on delete restrict,
  add column vb_area_fecha timestamptz;

comment on column public.solicitudes.vb_area_por is
  'Jefe de área que dio el visto bueno del ÁREA (no la validación final). NULL = sin visto bueno. ON DELETE RESTRICT: una firma no puede quedar huérfana — es el mismo criterio que evidencias.subido_por.';
comment on column public.solicitudes.vb_area_fecha is
  'Cuándo se dio el visto bueno vigente. La calcula el trigger, no la aplicación.';

-- Las dos columnas viajan juntas: media firma no es una firma.
alter table public.solicitudes
  add constraint solicitudes_vb_area_completo
  check ((vb_area_por is null) = (vb_area_fecha is null));

-- -----------------------------------------------------------------------------
-- 2. GRANTS
-- -----------------------------------------------------------------------------
-- Ninguno nuevo: el grant de la migración inicial es a nivel TABLA para
-- `authenticated` y cubre las columnas que se agreguen después (lo que exige
-- grant explícito son las tablas nuevas). Quién puede escribirlas lo deciden la
-- política y el trigger de abajo; `service_role` conserva su UPDATE sobre
-- `solicitudes` (lo usa el import), y el trigger no lo gatea porque no hay sesión.

-- -----------------------------------------------------------------------------
-- 3. ¿Quién es jefe DEL área de esta solicitud?
-- -----------------------------------------------------------------------------
create or replace function public.fn_es_jefe_de_area(p_solicitud_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_area   text;
begin
  select r.tenant_id, s.area_asignada
    into v_tenant, v_area
  from public.solicitudes s
  join public.reportes r on r.id = s.reporte_id
  where s.id = p_solicitud_id;

  if v_tenant is null or v_area is null then
    -- Solicitud inexistente, o sin área: no hay jefe de la nada.
    return false;
  end if;

  return exists (
    select 1
    from public.perfiles_usuario p
    where p.id = auth.uid()
      and p.rol = 'jefe_area'
      and p.activo
      and p.tenant_id = v_tenant
      and p.area is not distinct from v_area
  );
end;
$$;

comment on function public.fn_es_jefe_de_area is
  'true si la sesión es un jefe de área ACTIVO del mismo tenant y de la misma área que la solicitud. Es la autorización del visto bueno de área: ni otra área, ni otro tenant, ni un jefe desactivado.';

grant execute on function public.fn_es_jefe_de_area(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Visibilidad del jefe de área: SU área, como el responsable de área
-- -----------------------------------------------------------------------------
-- Sin esto, 'jefe_area' caería en la rama "otros roles del tenant" y vería TODAS
-- las áreas de la emisora — exactamente lo contrario del rol. Se corrige en los
-- dos lugares donde vive la regla: la función compartida y la política de SELECT.
create or replace function public.fn_puede_ver_solicitud(p_solicitud_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_area   text;
  v_resp   uuid;
  u_tenant uuid;
begin
  if public.fn_is_staff() then
    return true;
  end if;

  select r.tenant_id, s.area_asignada, s.responsable_cliente_id
    into v_tenant, v_area, v_resp
  from public.solicitudes s
  join public.reportes r on r.id = s.reporte_id
  where s.id = p_solicitud_id;

  if v_tenant is null then
    return false;  -- solicitud inexistente
  end if;

  u_tenant := public.fn_current_tenant();
  if u_tenant is null or u_tenant <> v_tenant then
    return false;  -- otro tenant
  end if;

  -- Roles ACOTADOS A SU ÁREA: el responsable de área y su jefe.
  if public.fn_current_rol() in ('cliente', 'jefe_area') then
    return (v_area is not distinct from public.fn_current_area())
        or (v_resp = auth.uid());
  end if;

  -- coordinador y admin_cliente: todo su tenant
  return true;
end;
$$;

drop policy if exists solicitudes_select on public.solicitudes;
create policy solicitudes_select on public.solicitudes
  for select to authenticated
  using (
    public.fn_is_staff()
    or (
      exists (
        select 1 from public.reportes r
        where r.id = reporte_id and r.tenant_id = public.fn_current_tenant()
      )
      and (
        -- Los roles acotados por área ven lo suyo; los demás roles del tenant,
        -- todo su tenant.
        public.fn_current_rol() not in ('cliente', 'jefe_area')
        or area_asignada is not distinct from public.fn_current_area()
        or responsable_cliente_id = auth.uid()
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 5. El jefe de área puede ESCRIBIR el visto bueno de su área
-- -----------------------------------------------------------------------------
-- RLS no distingue columnas: esta política habilita el UPDATE de la fila y el
-- trigger del punto 6 es el que acota QUÉ puede cambiar (solo las dos columnas
-- del visto bueno). Las dos piezas son necesarias; ninguna sobra.
create policy solicitudes_jefe_area_vb on public.solicitudes
  for update to authenticated
  using (public.fn_es_jefe_de_area(id))
  with check (public.fn_es_jefe_de_area(id));

-- -----------------------------------------------------------------------------
-- 6. Reglas duras del visto bueno (BEFORE UPDATE)
-- -----------------------------------------------------------------------------
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

  -- 6.a Si la SESIÓN es de un jefe de área, lo ÚNICO que puede cambiar de la fila
  --     es el visto bueno. Su política de UPDATE le abre la fila completa; esto la
  --     cierra a dos columnas. Se compara el resto de la fila en bloque para que
  --     una columna futura quede protegida sin tocar este trigger.
  if auth.uid() is not null and public.fn_current_rol() = 'jefe_area' then
    if (to_jsonb(new) - 'vb_area_por' - 'vb_area_fecha')
       is distinct from (to_jsonb(old) - 'vb_area_por' - 'vb_area_fecha') then
      raise exception 'El jefe de área solo puede dar o retirar el visto bueno de su área.'
        using errcode = 'check_violation';
    end if;
  end if;

  if not v_cambia_vb then
    return new;
  end if;

  -- 6.b Revocación automática por evidencia nueva (trigger del punto 7).
  if coalesce(current_setting('app.vb_automatico', true), '0') = '1' then
    return new;
  end if;

  -- 6.c Sin sesión (seed, import con service_role, migraciones): no se gatea.
  if auth.uid() is null then
    return new;
  end if;

  -- 6.d Una vez validada, la marca queda fija: el visto bueno del área es lo que
  --     había CUANDO se validó, y moverlo después reescribiría el expediente.
  --     (Congelado ya lo impide el candado de Fase 2 sobre cualquier UPDATE.)
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
    -- SE DA. No se firma el vacío: sin evidencia no hay nada que respaldar.
    if not exists (select 1 from public.evidencias where solicitud_id = new.id) then
      raise exception 'No hay evidencia cargada: no se puede dar visto bueno a una solicitud vacía.'
        using errcode = 'check_violation';
    end if;
    -- La firma la calcula la BASE, no la aplicación: quién firma es quien está
    -- en la sesión, y cuándo, ahora. Igual que `evidencias.cargado_por_staff`.
    new.vb_area_por   := auth.uid();
    new.vb_area_fecha := now();
  else
    -- SE RETIRA: las dos columnas van juntas.
    new.vb_area_fecha := null;
  end if;

  return new;
end;
$$;

create trigger trg_solicitud_vb_area
  before update on public.solicitudes
  for each row execute function public.fn_valida_vb_area();

-- -----------------------------------------------------------------------------
-- 7. Evidencia nueva REVOCA el visto bueno (misma filosofía que el candado de
--    validaciones: si el respaldo cambió, la firma anterior ya no lo cubre)
-- -----------------------------------------------------------------------------
create or replace function public.fn_evidencia_revoca_vb()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vb_por   uuid;
  v_vb_fecha timestamptz;
  v_tenant   uuid;
begin
  select s.vb_area_por, s.vb_area_fecha, r.tenant_id
    into v_vb_por, v_vb_fecha, v_tenant
  from public.solicitudes s
  join public.reportes r on r.id = s.reporte_id
  where s.id = new.solicitud_id;

  if v_vb_por is null then
    return new;   -- no había firma que revocar
  end if;

  -- La marca del sistema pasa por el mismo trigger de validación: se avisa que
  -- este cambio es automático para que no exija sesión de jefe de área.
  perform set_config('app.vb_automatico', '1', true);
  update public.solicitudes
     set vb_area_por = null, vb_area_fecha = null
   where id = new.solicitud_id;
  perform set_config('app.vb_automatico', '0', true);

  perform public.fn_log_evento(
    v_tenant,
    null,                       -- acto del SISTEMA, no de una persona
    'vb_area_revocado',
    'solicitudes',
    new.solicitud_id,
    jsonb_build_object(
      'motivo', 'evidencia_nueva',
      'evidencia_id', new.id,
      'version', new.version,
      'vb_previo_por', v_vb_por,
      'vb_previo_fecha', v_vb_fecha,
      'solicitud_id', new.solicitud_id
    )
  );

  return new;
end;
$$;

comment on function public.fn_evidencia_revoca_vb is
  'Al llegar evidencia nueva, retira el visto bueno del área y lo registra en bitácora. El jefe tiene que volver a revisar: la firma anterior respaldaba otro archivo.';

-- Se dispara DESPUÉS de trg_evidencia_after_insert (orden alfabético del nombre),
-- que es el que avanza el estado: así la bitácora queda en orden de lectura.
create trigger trg_evidencia_revoca_vb
  after insert on public.evidencias
  for each row execute function public.fn_evidencia_revoca_vb();

-- -----------------------------------------------------------------------------
-- 8. El administrador del cliente también da de alta JEFES de área
-- -----------------------------------------------------------------------------
-- Las políticas del sprint anterior enumeraban los roles que puede crear; sin
-- agregar 'jefe_area' podría verlo en el selector y recibir un rechazo de RLS.
drop policy if exists perfiles_admin_cliente_insert on public.perfiles_usuario;
create policy perfiles_admin_cliente_insert on public.perfiles_usuario
  for insert to authenticated
  with check (
    public.fn_is_admin_cliente()
    and tenant_id is not null
    and tenant_id = public.fn_current_tenant()
    and rol in ('cliente', 'jefe_area', 'admin_cliente')
  );

drop policy if exists perfiles_admin_cliente_update on public.perfiles_usuario;
create policy perfiles_admin_cliente_update on public.perfiles_usuario
  for update to authenticated
  using (
    public.fn_is_admin_cliente()
    and tenant_id is not null
    and tenant_id = public.fn_current_tenant()
    and rol in ('cliente', 'jefe_area', 'admin_cliente')
  )
  with check (
    public.fn_is_admin_cliente()
    and tenant_id is not null
    and tenant_id = public.fn_current_tenant()
    and rol in ('cliente', 'jefe_area', 'admin_cliente')
  );

drop policy if exists invitaciones_admin_cliente_insert on public.invitaciones;
create policy invitaciones_admin_cliente_insert on public.invitaciones
  for insert to authenticated
  with check (
    public.fn_is_admin_cliente()
    and tenant_id = public.fn_current_tenant()
    and exists (
      select 1 from public.perfiles_usuario p
      where p.id = perfil_id
        and p.tenant_id = public.fn_current_tenant()
        and p.rol in ('cliente', 'jefe_area', 'admin_cliente')
    )
  );
