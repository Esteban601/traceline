-- =============================================================================
-- Rol ADMIN-CLIENTE (tier de autoservicio) — 2/2: modelo, permisos y candados.
--
-- LEY DE LA CASA: cada tabla/columna nueva declara sus GRANTS y sus políticas;
-- la regla se aplica en la BASE (RLS + triggers) y se refleja en la UI, nunca
-- solo en la UI.
--
-- Contenido:
--   1. Helpers de identidad: fn_is_admin_cliente().
--   2. solicitudes.origen ('irstrat' | 'cliente'): quién pidió la información.
--      De él depende QUIÉN puede revisar/observar/validar (regla dura).
--   3. tenants.staff_puede_cargar: toggle por cliente (solo rol 'admin' de
--      IRStrat) que habilita a IRStrat a cargar evidencia en nombre de un área.
--   4. evidencias.cargado_por_staff: marca de autoría INBORRABLE, la calcula el
--      trigger — el toggle habilita la capacidad, nunca oculta quién cargó.
--   5. RLS de admin_cliente: escribe solicitudes/áreas/usuarios de SU tenant y
--      lee lo que su cobertura y su export necesitan. Nada cross-tenant.
--   6. Triggers: regla de origen para las transiciones de estado y para las
--      observaciones; gate del toggle de carga staff; gate del toggle mismo.
--
-- Lo que admin_cliente NO puede, y se aplica aquí: congelar reportes, crear
-- staff, escribir taxonomía/mapeo/plantillas/clientes, ni ver otro tenant.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helper de identidad
-- -----------------------------------------------------------------------------
-- Mismo patrón que fn_is_staff(): SECURITY DEFINER para leer perfiles_usuario sin
-- recursar sobre su propio RLS. Exige `activo`: un administrador desactivado no
-- conserva sus poderes ni por un request de gracia.
create or replace function public.fn_is_admin_cliente()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles_usuario
    where id = auth.uid()
      and tenant_id is not null
      and activo
      and rol = 'admin_cliente'
  );
$$;

comment on function public.fn_is_admin_cliente is
  'true si el usuario actual es administrador DEL CLIENTE (rol admin_cliente, activo, con tenant). No es staff: fn_is_staff() sigue siendo false para él.';

grant execute on function public.fn_is_admin_cliente() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. solicitudes.origen — quién pidió la información
-- -----------------------------------------------------------------------------
create type public.origen_solicitud as enum ('irstrat', 'cliente');

comment on type public.origen_solicitud is
  'Quién originó la solicitud: ''irstrat'' (la pidió la firma) o ''cliente'' (la creó el administrador del cliente para su equipo).';

-- Backfill implícito por el DEFAULT: todo lo que existe hoy lo pidió IRStrat.
-- Es un hecho histórico, no una suposición: hasta esta migración no había otra
-- vía de crear solicitudes que el panel interno.
alter table public.solicitudes
  add column origen public.origen_solicitud not null default 'irstrat';

comment on column public.solicitudes.origen is
  'REGLA DURA de validación: las de origen ''irstrat'' solo las revisa/observa/valida el staff; las de origen ''cliente'', solo el admin_cliente de ese tenant. El otro lado las VE pero no las transiciona (trigger trg_solicitud_origen_transicion).';

create index solicitudes_origen_idx on public.solicitudes (origen);

-- Las plantillas de checklist son de la firma: lo que se clona nace 'irstrat'
-- por el DEFAULT de la columna. No hace falta columna en plantilla_solicitudes.

-- -----------------------------------------------------------------------------
-- 3. tenants.staff_puede_cargar — toggle "carga por IRStrat", por cliente
-- -----------------------------------------------------------------------------
-- DEFAULT false = el comportamiento de hoy se conserva: la carga de evidencia
-- corresponde al cliente. Encenderlo es una decisión explícita del rol 'admin'
-- de IRStrat (trigger trg_tenant_toggle_carga_staff).
alter table public.tenants
  add column staff_puede_cargar boolean not null default false;

comment on column public.tenants.staff_puede_cargar is
  'Habilita al staff de IRStrat a cargar evidencia en solicitudes de este cliente, en nombre de un área. Solo lo cambia el rol ''admin'' de IRStrat. Apagado (default) = la carga es del cliente. Encendido NO oculta la autoría: evidencias.cargado_por_staff es inborrable.';

-- -----------------------------------------------------------------------------
-- 4. evidencias.cargado_por_staff — autoría inborrable
-- -----------------------------------------------------------------------------
-- No es configurable ni la escribe la aplicación: la calcula el trigger a partir
-- de quién está insertando. El toggle habilita la CAPACIDAD de cargar; la marca
-- de quién cargó no depende de ninguna preferencia.
alter table public.evidencias
  add column cargado_por_staff boolean not null default false;

comment on column public.evidencias.cargado_por_staff is
  'true = la cargó el staff de IRStrat en nombre del área (area_origen). La calcula fn_evidencia_marca_carga(); la aplicación no puede fijarla ni borrarla. Apagar el toggle del cliente NO retira esta marca de lo ya cargado.';

-- -----------------------------------------------------------------------------
-- 5. RLS — matriz de permisos de admin_cliente
-- -----------------------------------------------------------------------------

-- 5.1 solicitudes: crea y edita las SUYAS (origen 'cliente') dentro de su tenant.
--     No puede tocar las de IRStrat (ni sus campos ni su estado) ni marcar una
--     suya como 'irstrat' (el WITH CHECK fija el origen).
create policy solicitudes_admin_cliente_insert on public.solicitudes
  for insert to authenticated
  with check (
    public.fn_is_admin_cliente()
    and origen = 'cliente'
    and exists (
      select 1 from public.reportes r
      where r.id = reporte_id
        and r.tenant_id = public.fn_current_tenant()
        and r.estado = 'activo'
    )
  );

create policy solicitudes_admin_cliente_update on public.solicitudes
  for update to authenticated
  using (
    public.fn_is_admin_cliente()
    and origen = 'cliente'
    and exists (
      select 1 from public.reportes r
      where r.id = reporte_id and r.tenant_id = public.fn_current_tenant()
    )
  )
  with check (
    public.fn_is_admin_cliente()
    and origen = 'cliente'
    and exists (
      select 1 from public.reportes r
      where r.id = reporte_id and r.tenant_id = public.fn_current_tenant()
    )
  );

-- Sin política de DELETE a propósito: la trazabilidad no admite que el cliente
-- borre solicitudes. Corregir es editar; retirar es un acto de IRStrat.

-- 5.2 perfiles_usuario: da de alta y desactiva usuarios de SU tenant, y solo con
--     rol 'cliente' (responsable de área) o 'admin_cliente'. JAMÁS staff
--     (tenant_id null queda fuera por el predicado), jamás de otro tenant, y
--     tampoco toca a un 'coordinador' (ese rol lo asigna IRStrat).
create policy perfiles_admin_cliente_insert on public.perfiles_usuario
  for insert to authenticated
  with check (
    public.fn_is_admin_cliente()
    and tenant_id is not null
    and tenant_id = public.fn_current_tenant()
    and rol in ('cliente', 'admin_cliente')
  );

create policy perfiles_admin_cliente_update on public.perfiles_usuario
  for update to authenticated
  using (
    public.fn_is_admin_cliente()
    and tenant_id is not null
    and tenant_id = public.fn_current_tenant()
    and rol in ('cliente', 'admin_cliente')
  )
  with check (
    public.fn_is_admin_cliente()
    and tenant_id is not null
    and tenant_id = public.fn_current_tenant()
    and rol in ('cliente', 'admin_cliente')
  );

-- 5.3 areas_tenant: crea y edita (incluido activo=false) las áreas de su tenant.
--     Sin DELETE: el nombre del área vive como texto en solicitudes y evidencias.
create policy areas_tenant_admin_cliente_insert on public.areas_tenant
  for insert to authenticated
  with check (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

create policy areas_tenant_admin_cliente_update on public.areas_tenant
  for update to authenticated
  using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant())
  with check (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

-- 5.4 invitaciones: la liga de un solo uso es la vía de acceso de los usuarios
--     que da de alta. Solo de su tenant; el canje sigue siendo del servidor.
--
--     CUIDADO — una invitación es un cambio de contraseña diferido: el canje corre
--     con service_role y hace `updateUserById(perfil_id, {password})`. Por eso el
--     `perfil_id` NO puede ser cualquiera: si solo se acotara `tenant_id`, quien
--     pudiera insertar una fila podría emitirse una liga contra un perfil ajeno
--     —incluido uno de IRStrat— y quedarse con esa cuenta. Se cierra en dos
--     capas: aquí (RLS) y en la acción de canje, que revuelve a comprobar que el
--     perfil pertenezca al tenant de la invitación.
create policy invitaciones_admin_cliente_select on public.invitaciones
  for select to authenticated
  using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

create policy invitaciones_admin_cliente_insert on public.invitaciones
  for insert to authenticated
  with check (
    public.fn_is_admin_cliente()
    and tenant_id = public.fn_current_tenant()
    -- El destinatario tiene que ser alguien a quien SÍ administra: de su tenant y
    -- con rol de área o administrador. Ni staff, ni el coordinador que designa
    -- IRStrat, ni un perfil de otra emisora.
    and exists (
      select 1 from public.perfiles_usuario p
      where p.id = perfil_id
        and p.tenant_id = public.fn_current_tenant()
        and p.rol in ('cliente', 'admin_cliente')
    )
  );

-- Consistencia perfil↔tenant para TODOS (staff incluido), como política
-- RESTRICTIVA: se suma con AND a cualquier permisiva, así que ninguna vía de
-- inserción puede emitir una liga cruzada, ni por error de tipeo del staff.
create or replace function public.fn_perfil_es_del_tenant(p_perfil uuid, p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles_usuario
    where id = p_perfil and tenant_id is not null and tenant_id = p_tenant
  );
$$;

comment on function public.fn_perfil_es_del_tenant is
  'true si ese perfil pertenece a ese tenant. Sostiene la política restrictiva de invitaciones: una liga de acceso nunca puede apuntar a un perfil de otro cliente (ni a uno de IRStrat, que no tiene tenant).';

grant execute on function public.fn_perfil_es_del_tenant(uuid, uuid) to authenticated;

create policy invitaciones_perfil_del_tenant on public.invitaciones
  as restrictive for insert to authenticated
  with check (public.fn_perfil_es_del_tenant(perfil_id, tenant_id));

-- 5.5 LECTURA de taxonomía. Decisión explícita y documentada en el README: el
--     tier de autoservicio incluye "su cobertura con export de su Excel", y esa
--     vista ES el catálogo de la norma. Se abre en SOLO LECTURA al administrador
--     del cliente; los usuarios de área ('cliente') siguen sin verla, y la
--     ESCRITURA del catálogo y del mapeo NIIF sigue siendo exclusiva del staff.
create policy datapoints_admin_cliente_select on public.datapoints_taxonomia
  for select to authenticated
  using (public.fn_is_admin_cliente());

create policy rubros_taxonomia_admin_cliente_select on public.rubros_taxonomia
  for select to authenticated
  using (public.fn_is_admin_cliente());

create policy mapeo_export_admin_cliente_select on public.mapeo_export
  for select to authenticated
  using (public.fn_is_admin_cliente());

-- El mapeo N:N solicitud↔datapoint se lee SOLO para las solicitudes que ya puede
-- ver (su tenant). Escribirlo sigue siendo del staff: el administrador del
-- cliente redacta en lenguaje cliente, no decide el mapeo a la norma.
create policy mapeo_sol_dp_admin_cliente_select on public.mapeo_solicitud_datapoint
  for select to authenticated
  using (public.fn_is_admin_cliente() and public.fn_puede_ver_solicitud(solicitud_id));

-- 5.6 LECTURA de las tablas que alimentan su Excel (registros de clima,
--     objetivos y cuestionarios), acotada a los reportes de su tenant. Sin
--     lectura, su export saldría con hojas vacías y no sería "su" documento.
create policy registros_clima_admin_cliente_select on public.registros_clima
  for select to authenticated
  using (
    public.fn_is_admin_cliente()
    and exists (
      select 1 from public.reportes r
      where r.id = reporte_id and r.tenant_id = public.fn_current_tenant()
    )
  );

create policy registros_clima_valores_admin_cliente_select on public.registros_clima_valores
  for select to authenticated
  using (
    public.fn_is_admin_cliente()
    and exists (
      select 1
      from public.registros_clima rc
      join public.reportes r on r.id = rc.reporte_id
      where rc.id = registro_id and r.tenant_id = public.fn_current_tenant()
    )
  );

create policy objetivos_admin_cliente_select on public.objetivos
  for select to authenticated
  using (
    public.fn_is_admin_cliente()
    and exists (
      select 1 from public.reportes r
      where r.id = reporte_id and r.tenant_id = public.fn_current_tenant()
    )
  );

create policy objetivos_detalle_admin_cliente_select on public.objetivos_detalle
  for select to authenticated
  using (
    public.fn_is_admin_cliente()
    and exists (
      select 1
      from public.objetivos o
      join public.reportes r on r.id = o.reporte_id
      where o.id = objetivo_id and r.tenant_id = public.fn_current_tenant()
    )
  );

create policy cuestionarios_admin_cliente_select on public.cuestionarios_respuestas
  for select to authenticated
  using (
    public.fn_is_admin_cliente()
    and exists (
      select 1 from public.reportes r
      where r.id = reporte_id and r.tenant_id = public.fn_current_tenant()
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Triggers — los candados
-- -----------------------------------------------------------------------------

-- 6.1 Bandera de TRANSICIÓN AUTOMÁTICA.
--     Los triggers de evidencia/captura avanzan el estado por sí mismos
--     ('pendiente'→'recibido', 'validado'→'en_revision'). Esas transiciones son
--     del sistema, no una revisión, y deben poder ocurrir con cualquier usuario
--     que tenga derecho a cargar. Se marcan con un ajuste LOCAL a la transacción
--     para que el candado de origen las distinga de un acto de revisión, y se
--     limpian en cuanto termina el UPDATE (ventana mínima).
create or replace function public.fn_evidencia_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.transicion_automatica', '1', true);
  update public.solicitudes
     set estado = case
       when estado in ('pendiente', 'solicitado') then 'recibido'
       when estado = 'validado' then 'en_revision'  -- reapertura por evidencia nueva
       else estado
     end
   where id = new.solicitud_id
     and estado in ('pendiente', 'solicitado', 'validado');
  perform set_config('app.transicion_automatica', '0', true);

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

  perform set_config('app.transicion_automatica', '1', true);
  update public.solicitudes
     set estado = 'en_revision'
   where id = new.solicitud_id
     and estado = 'validado';
  perform set_config('app.transicion_automatica', '0', true);

  return new;
end;
$$;

-- 6.2 REGLA DURA de validación por origen (candado a nivel de base de datos).
--     Origen 'irstrat' → solo staff revisa/observa/valida.
--     Origen 'cliente' → solo el admin_cliente de ese tenant (RLS ya acota el
--     tenant; aquí se acota el LADO).
--     Excepciones deliberadas: el congelamiento (acto de IRStrat sobre el
--     reporte entero) y las transiciones automáticas por llegada de evidencia.
create or replace function public.fn_valida_origen_transicion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado is not distinct from old.estado then
    return new;   -- edición de campos: la gobierna RLS, no esta regla
  end if;

  -- Sin sesión de usuario (seed, migraciones, service_role): no se gatea. Esos
  -- caminos ya son privilegiados por diseño y quedan documentados en el README.
  if auth.uid() is null then
    return new;
  end if;

  -- Congelar es un acto de IRStrat sobre el reporte, no una revisión. Se
  -- permite al staff sobre cualquier origen y se le niega a todos los demás.
  if new.estado = 'congelado' then
    if public.fn_is_staff() then
      return new;
    end if;
    raise exception 'Congelar un reporte es una acción de IRStrat.'
      using errcode = 'check_violation';
  end if;

  -- Transición automática del sistema al llegar evidencia/captura.
  if coalesce(current_setting('app.transicion_automatica', true), '0') = '1' then
    return new;
  end if;

  if old.origen = 'irstrat' and not public.fn_is_staff() then
    raise exception 'Las solicitudes de IRStrat solo las revisa y valida el equipo de IRStrat.'
      using errcode = 'check_violation';
  end if;

  if old.origen = 'cliente' and not public.fn_is_admin_cliente() then
    raise exception 'Las solicitudes internas del cliente solo las revisa y valida su administrador.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_solicitud_origen_transicion
  before update on public.solicitudes
  for each row execute function public.fn_valida_origen_transicion();

-- 6.3 Observación formal: la formula el lado dueño del origen. Cierra además un
--     hueco previo — la política de comentarios permitía a cualquiera con acceso
--     marcar es_observacion, aunque la UI nunca lo ofreciera.
create or replace function public.fn_valida_observacion_origen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origen public.origen_solicitud;
begin
  if not new.es_observacion or auth.uid() is null then
    return new;
  end if;

  select origen into v_origen from public.solicitudes where id = new.solicitud_id;

  if v_origen = 'irstrat' and not public.fn_is_staff() then
    raise exception 'Solo IRStrat registra observaciones formales en sus solicitudes.'
      using errcode = 'check_violation';
  end if;
  if v_origen = 'cliente' and not public.fn_is_admin_cliente() then
    raise exception 'Solo el administrador del cliente registra observaciones en las solicitudes internas.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_comentario_observacion_origen
  before insert on public.comentarios
  for each row execute function public.fn_valida_observacion_origen();

-- 6.4 Carga de evidencia por el staff: gate del toggle + marca de autoría.
--     Con el toggle APAGADO un INSERT de staff se rechaza en la base, no solo en
--     la UI. La marca se CALCULA aquí: la aplicación no puede fijarla ni
--     falsearla, y apagar el toggle después no retira la marca de lo ya cargado.
create or replace function public.fn_evidencia_marca_carga()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_habilitado boolean;
begin
  -- Sin sesión (seed / service_role): se respeta lo insertado, sin gate.
  if auth.uid() is null then
    return new;
  end if;

  if public.fn_is_staff() then
    select t.staff_puede_cargar
      into v_habilitado
    from public.solicitudes s
    join public.reportes r on r.id = s.reporte_id
    join public.tenants  t on t.id = r.tenant_id
    where s.id = new.solicitud_id;

    if not coalesce(v_habilitado, false) then
      raise exception 'La carga de evidencia corresponde al cliente: IRStrat no la tiene habilitada para esta emisora.'
        using errcode = 'check_violation';
    end if;

    if new.area_origen is null or btrim(new.area_origen) = '' then
      raise exception 'Indica el área en cuyo nombre se carga la evidencia.'
        using errcode = 'check_violation';
    end if;

    new.cargado_por_staff := true;
  else
    new.cargado_por_staff := false;
  end if;

  return new;
end;
$$;

create trigger trg_evidencia_marca_carga
  before insert on public.evidencias
  for each row execute function public.fn_evidencia_marca_carga();

-- 6.5 El toggle solo lo mueve el rol 'admin' de IRStrat (ni analista, ni
--     admin_cliente). La UI lo esconde; esto lo impide.
-- Cubre INSERT **y** UPDATE. Solo con UPDATE, un analista podía dar de alta un
-- cliente ya con `staff_puede_cargar = true` y saltarse la regla completa: el
-- alta es otra forma de "cambiarlo".
create or replace function public.fn_valida_toggle_carga_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cambia boolean;
begin
  if tg_op = 'INSERT' then
    v_cambia := coalesce(new.staff_puede_cargar, false);   -- nacer encendido es un cambio
  else
    v_cambia := new.staff_puede_cargar is distinct from old.staff_puede_cargar;
  end if;

  if not v_cambia then
    return new;
  end if;
  -- Sin sesión (seed / service_role / migraciones): no se gatea.
  if auth.uid() is null then
    return new;
  end if;
  if public.fn_is_staff() and public.fn_current_rol() = 'admin' then
    return new;
  end if;
  raise exception 'Habilitar o deshabilitar la carga por IRStrat es una acción de administrador de IRStrat.'
    using errcode = 'check_violation';
end;
$$;

create trigger trg_tenant_toggle_carga_staff
  before insert or update on public.tenants
  for each row execute function public.fn_valida_toggle_carga_staff();

-- -----------------------------------------------------------------------------
-- 7. Renombrar un área del cliente — operación de integridad, no un UPDATE suelto
--
-- El nombre del área vive en TRES lugares: el catálogo (`areas_tenant.nombre`),
-- las solicitudes (`solicitudes.area_asignada`) y los perfiles
-- (`perfiles_usuario.area`). De que los tres coincidan EXACTAMENTE depende qué
-- ve cada usuario de área (`fn_puede_ver_solicitud`). Renombrar solo el catálogo
-- dejaría a la gente sin ver su propio trabajo, en silencio.
--
-- Por eso el renombrado es una función: cambia los tres a la vez, en una
-- transacción, y se niega cuando no puede hacerlo completo — un reporte
-- CONGELADO tiene sus solicitudes en solo-lectura por candado de BD, así que ahí
-- la propagación es imposible y el rename queda prohibido con un mensaje que dice
-- qué hacer en su lugar.
--
-- SECURITY DEFINER (salta RLS para tocar las tres tablas), así que la
-- autorización la comprueba ella misma: staff, o el admin_cliente DE ESE tenant.
-- -----------------------------------------------------------------------------
create or replace function public.fn_renombrar_area(p_area_id uuid, p_nombre text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant     uuid;
  v_actual     text;
  v_nuevo      text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_congelados int;
  v_sols       int;
  v_perfiles   int;
begin
  if v_nuevo = '' then
    raise exception 'El nombre del área no puede estar vacío.'
      using errcode = 'check_violation';
  end if;
  if length(v_nuevo) > 60 then
    raise exception 'El nombre del área no puede exceder 60 caracteres.'
      using errcode = 'check_violation';
  end if;

  select tenant_id, nombre into v_tenant, v_actual
  from public.areas_tenant where id = p_area_id;

  if v_tenant is null then
    raise exception 'El área no existe.' using errcode = 'check_violation';
  end if;

  if not (
    public.fn_is_staff()
    or (public.fn_is_admin_cliente() and public.fn_current_tenant() = v_tenant)
  ) then
    raise exception 'No puedes renombrar áreas de este cliente.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_nuevo = v_actual then
    return jsonb_build_object('cambiado', false, 'solicitudes', 0, 'usuarios', 0);
  end if;

  if exists (
    select 1 from public.areas_tenant
    where tenant_id = v_tenant
      and lower(nombre) = lower(v_nuevo)
      and id <> p_area_id
  ) then
    raise exception 'Ya existe un área con ese nombre en este cliente.'
      using errcode = 'unique_violation';
  end if;

  select count(*) into v_congelados
  from public.solicitudes s
  join public.reportes r on r.id = s.reporte_id
  where r.tenant_id = v_tenant
    and r.estado = 'congelado'
    and s.area_asignada = v_actual;

  if v_congelados > 0 then
    raise exception
      'El área "%" aparece en % solicitud(es) de un reporte congelado, que es solo-lectura. Desactívala y crea una nueva en su lugar.',
      v_actual, v_congelados
      using errcode = 'check_violation';
  end if;

  update public.areas_tenant set nombre = v_nuevo where id = p_area_id;

  update public.solicitudes s
     set area_asignada = v_nuevo
   where s.area_asignada = v_actual
     and exists (
       select 1 from public.reportes r
       where r.id = s.reporte_id and r.tenant_id = v_tenant
     );
  get diagnostics v_sols = row_count;

  update public.perfiles_usuario
     set area = v_nuevo
   where tenant_id = v_tenant and area = v_actual;
  get diagnostics v_perfiles = row_count;

  insert into public.bitacora (tenant_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (
    v_tenant, auth.uid(), 'area_editada', 'areas_tenant', p_area_id,
    jsonb_build_object(
      'nombre', v_nuevo,
      'nombre_anterior', v_actual,
      'solicitudes_actualizadas', v_sols,
      'usuarios_actualizados', v_perfiles
    )
  );

  return jsonb_build_object('cambiado', true, 'solicitudes', v_sols, 'usuarios', v_perfiles);
end;
$$;

comment on function public.fn_renombrar_area is
  'Renombra un área del cliente y propaga el nombre a solicitudes.area_asignada y perfiles_usuario.area del mismo tenant (de esa coincidencia exacta depende la visibilidad por área). Se niega si un reporte congelado usa el nombre. Autorización propia: staff o admin_cliente del tenant.';

grant execute on function public.fn_renombrar_area(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. El cliente puede LEER el nombre de quien actuó desde IRStrat
--
-- La trazabilidad exige nombrar a quien hizo cada cosa: "Cargado por [nombre]
-- (IRStrat) en nombre de [área]", "esta observación la escribió tal persona". Con
-- `perfiles_select` tal como estaba, un usuario del cliente no podía leer un
-- perfil de staff (tenant_id NULL) y esos nombres salían como "—": un historial
-- que no dice quién no sirve para aseguramiento, y el hueco ya existía para las
-- observaciones antes de este sprint.
--
-- Se abre lo MÍNIMO: no "los perfiles de IRStrat", sino **los que aparecen en lo
-- que este usuario ya puede ver** — quien subió una evidencia suya, quien capturó
-- un valor suyo, quien escribió un comentario en una de sus solicitudes. RLS es a
-- nivel de FILA, no de columna: una política de "todo el staff" habría dejado
-- enumerar por REST el equipo completo de la firma con sus correos y sus roles, y
-- eso no es lo que hace falta para poner un nombre en un historial.
--
-- Es solo lectura y no alcanza datos de ninguna otra emisora: `fn_puede_ver_solicitud`
-- acota cada EXISTS a las solicitudes del propio usuario.
-- -----------------------------------------------------------------------------

-- Índices para los EXISTS de la política (y para los joins de autoría en general).
create index if not exists evidencias_subido_por_idx on public.evidencias (subido_por);
create index if not exists capturas_valor_capturado_por_idx on public.capturas_valor (capturado_por);
create index if not exists comentarios_autor_idx on public.comentarios (autor_id);
create index if not exists bitacora_usuario_idx on public.bitacora (usuario_id);

create policy perfiles_staff_visible_al_cliente on public.perfiles_usuario
  for select to authenticated
  using (
    tenant_id is null
    and activo
    and public.fn_current_tenant() is not null
    and (
      exists (
        select 1 from public.evidencias e
        where e.subido_por = perfiles_usuario.id
          and public.fn_puede_ver_solicitud(e.solicitud_id)
      )
      or exists (
        select 1 from public.capturas_valor v
        where v.capturado_por = perfiles_usuario.id
          and public.fn_puede_ver_solicitud(v.solicitud_id)
      )
      or exists (
        select 1 from public.comentarios c
        where c.autor_id = perfiles_usuario.id
          and public.fn_puede_ver_solicitud(c.solicitud_id)
      )
      -- La BITÁCORA también nombra a quien actuó, y buena parte de los actos de
      -- IRStrat solo dejan rastro ahí: crear una solicitud, cambiar su estado,
      -- congelar un reporte, mover el toggle de carga. Sin esta rama, esas
      -- entradas se le mostraban al cliente como «Sistema» — que no es un dato
      -- que falte, es una atribución falsa, peor que el "—" que se vino a
      -- arreglar. `bitacora_select` acota el subquery a su propio tenant.
      or exists (
        select 1 from public.bitacora b
        where b.usuario_id = perfiles_usuario.id
          and b.tenant_id = public.fn_current_tenant()
      )
    )
  );
