-- =============================================================================
-- Rol auditor — identidad, LECTURA de su tenant y EXCLUSIÓN de toda escritura.
--
-- Contexto que explica la forma de esta migración
-- -----------------------------------------------------------------------------
-- El modelo de RLS de la plataforma se escribió con una LISTA NEGATIVA: la
-- política de solicitudes dice «los roles acotados por área ven lo suyo; los
-- demás roles del tenant, todo su tenant», y fn_puede_ver_solicitud termina con
-- un `return true` para cualquier rol que no sea 'cliente' ni 'jefe_area'. Lo
-- mismo vale para las políticas de INSERT de evidencias, capturas y comentarios,
-- que solo piden «puedes ver la solicitud y firmas con tu propio id».
--
-- Consecuencia: un rol NUEVO nace con permisos, no sin ellos. Para el auditor
-- eso acierta en la lectura —queremos justo «todo su tenant»— y falla en la
-- escritura: con solo agregar el valor al enum, un auditor podría SUBIR
-- EVIDENCIA, capturar valores y comentar. Ese es el hueco que cierra esta
-- migración.
--
-- Por eso la exclusión NO se hace reescribiendo cada política permisiva de
-- escritura (que obligaría a tocar políticas vigentes y a acertar una por una),
-- sino con una política RESTRICTIVA por tabla y por comando. Una restrictiva se
-- combina con AND contra todas las permisivas: mientras exista, ninguna política
-- futura —escrita por quien sea, sin acordarse de este rol— puede darle
-- escritura al auditor. La regla queda en un solo lugar y es la que manda.
--
-- Ese «un solo lugar» es fn_aplicar_barrera_auditor(), abajo: la barrera se
-- encapsula en una función para que toda migración que cree una tabla o un
-- bucket pueda heredarla con una línea. Ver CLAUDE.md §3.
--
-- DEUDA TÉCNICA, acordada con Manuel al aprobar el Paso 0: invertir el modelo a
-- LISTA POSITIVA (que cada rol declare lo que puede, y lo no declarado se
-- niegue) queda para el ciclo, no para este hotfix. Se anota en la
-- especificación y en CLAUDE.md §3. Mientras no se haga, la barrera restrictiva
-- de abajo es lo que sostiene la garantía.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Identidad
-- -----------------------------------------------------------------------------
-- fn_is_auditor: mismo molde que fn_is_staff y fn_is_admin_cliente. Exige
-- `activo` porque el cierre de un proceso de aseguramiento DESACTIVA la cuenta
-- (no la borra, para que auditor_actividad siga refiriendo a la persona); si la
-- función no mirara `activo`, desactivar no quitaría el acceso.
create or replace function public.fn_is_auditor()
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
      and rol = 'auditor'
      and activo
  );
$$;

comment on function public.fn_is_auditor is
  'true si la sesión es un auditor externo ACTIVO de un tenant. Gobierna su lectura ampliada y, sobre todo, su exclusión de toda escritura.';

grant execute on function public.fn_is_auditor() to authenticated, service_role;

-- fn_is_admin_irstrat: el encargo pide que auditor_actividad la lea SOLO el
-- administrador de IRStrat, no el analista. La distinción YA existía en los
-- datos —staff es `tenant_id is null` y el rol sigue siendo 'admin' o
-- 'analista'— pero no tenía función que la expresara: en la base solo había
-- fn_is_staff(), que mete a los dos en el mismo saco. El equivalente en TypeScript
-- (esAdminIrstrat en lib/roles.ts) existía desde antes y no es una barrera.
-- Esta función es ese helper que faltaba; no cambia ningún permiso existente.
create or replace function public.fn_is_admin_irstrat()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles_usuario
    where id = auth.uid()
      and tenant_id is null
      and rol = 'admin'
      and activo
  );
$$;

comment on function public.fn_is_admin_irstrat is
  'true si la sesión es ADMINISTRADOR de IRStrat (staff con rol admin), no analista ni coordinador. Espejo en base de esAdminIrstrat de lib/roles.ts.';

grant execute on function public.fn_is_admin_irstrat() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. EXCLUSIÓN DE ESCRITURA — la pieza central
-- -----------------------------------------------------------------------------
-- Una restrictiva de INSERT, otra de UPDATE y otra de DELETE sobre CADA tabla
-- de public con RLS. Se recorre el catálogo en vez de listar las tablas a mano
-- a propósito: la garantía que se quiere dar es «ninguna», y una lista escrita
-- a mano solo puede prometer «ninguna de las que me acordé».
--
-- SELECT queda fuera de la barrera: el auditor es un rol de lectura y las
-- restrictivas de lectura se tratan aparte (punto 4, bitácora).
--
-- comentarios_auditor se excluye por nombre: es la ÚNICA tabla donde el auditor
-- sí escribe, y la crea la migración siguiente. Sin esta excepción, reaplicar
-- esta migración después de aquella dejaría al auditor sin su propio canal.
-- La barrera vive en una FUNCIÓN, no en un bloque suelto, por una razón de
-- mantenimiento: la garantía «el auditor no escribe en ninguna tabla» solo se
-- sostiene mientras cada tabla nueva la herede. Si la regla estuviera escrita
-- una sola vez aquí, la primera migración futura que cree una tabla abriría un
-- hueco sin que nadie lo notara —la tabla nace con sus políticas permisivas y
-- sin barrera—. Con una función, esa migración termina llamándola y el hueco no
-- llega a existir. Queda como regla en CLAUDE.md §3.
--
-- Es idempotente y convergente: se puede llamar cuantas veces se quiera y el
-- catálogo de políticas termina igual. Devuelve cuántas políticas dejó puestas,
-- que es lo que permite verificarla desde una prueba.
create or replace function public.fn_aplicar_barrera_auditor()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  n integer := 0;
begin
  for t in
    select c.relname as tabla
    from pg_class c
    join pg_namespace n2 on n2.oid = c.relnamespace
    where n2.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      -- Las dos tablas del propio rol se excluyen: comentarios_auditor porque
      -- es donde el auditor SÍ escribe, y auditor_actividad porque ya trae sus
      -- propias restrictivas con `false`, que son más estrictas que esta.
      and c.relname not in ('comentarios_auditor', 'auditor_actividad')
    order by c.relname
  loop
    execute format('drop policy if exists %I on public.%I', 'auditor_sin_insert_' || t.tabla, t.tabla);
    execute format('drop policy if exists %I on public.%I', 'auditor_sin_update_' || t.tabla, t.tabla);
    execute format('drop policy if exists %I on public.%I', 'auditor_sin_delete_' || t.tabla, t.tabla);

    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated
         with check (not public.fn_is_auditor())',
      'auditor_sin_insert_' || t.tabla, t.tabla);

    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated
         using (not public.fn_is_auditor()) with check (not public.fn_is_auditor())',
      'auditor_sin_update_' || t.tabla, t.tabla);

    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated
         using (not public.fn_is_auditor())',
      'auditor_sin_delete_' || t.tabla, t.tabla);

    n := n + 3;
  end loop;

  -- Storage. La barrera NO se acota a un bucket: el auditor no escribe en
  -- ninguno (ni evidencias, ni logos, ni vitrina, ni los que vengan). Su lectura
  -- de archivos sigue por evidencias_tenant_select, que solo mira la carpeta del
  -- tenant y no toca estas políticas. Por eso un bucket nuevo tampoco necesita
  -- nada propio: ya nace cubierto.
  drop policy if exists auditor_sin_insert_storage on storage.objects;
  drop policy if exists auditor_sin_update_storage on storage.objects;
  drop policy if exists auditor_sin_delete_storage on storage.objects;

  create policy auditor_sin_insert_storage on storage.objects
    as restrictive for insert to authenticated
    with check (not public.fn_is_auditor());

  create policy auditor_sin_update_storage on storage.objects
    as restrictive for update to authenticated
    using (not public.fn_is_auditor()) with check (not public.fn_is_auditor());

  create policy auditor_sin_delete_storage on storage.objects
    as restrictive for delete to authenticated
    using (not public.fn_is_auditor());

  return n + 3;
end;
$$;

comment on function public.fn_aplicar_barrera_auditor is
  'Pone (o repone) la barrera restrictiva que impide al rol auditor INSERT/UPDATE/DELETE en toda tabla de public con RLS y en storage.objects. Idempotente y convergente. LLÁMALA AL FINAL DE TODA MIGRACIÓN QUE CREE UNA TABLA O UN BUCKET — ver CLAUDE.md §3.';

-- No se otorga a `authenticated`: crear políticas no es una operación de
-- aplicación. La ejecutan las migraciones, que corren como el dueño del esquema.
revoke all on function public.fn_aplicar_barrera_auditor() from public;

-- Limpieza ÚNICA de los nombres de la primera versión de esta migración
-- («<tabla>_auditor_no_*»). Se retiraron porque sobre la tabla `comentarios`
-- producían «comentarios_auditor_no_delete», idéntico al de una política real de
-- la tabla `comentarios_auditor` y con otro significado: en una capa de
-- seguridad, dos objetos distintos no se llaman igual.
--
-- Va aquí y no dentro de la función a propósito. Es deuda de una versión
-- anterior, no parte de la barrera; dentro de la función se ejecutaría en cada
-- llamada futura, llenando de NOTICE cada migración que la use y sugiriendo que
-- esos nombres son algo que sigue vivo.
do $$
declare t record;
begin
  for t in
    select c.relname as tabla
    from pg_class c join pg_namespace n2 on n2.oid = c.relnamespace
    where n2.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists %I on public.%I', t.tabla || '_auditor_no_insert', t.tabla);
    execute format('drop policy if exists %I on public.%I', t.tabla || '_auditor_no_update', t.tabla);
    execute format('drop policy if exists %I on public.%I', t.tabla || '_auditor_no_delete', t.tabla);
  end loop;
  drop policy if exists storage_auditor_no_insert on storage.objects;
  drop policy if exists storage_auditor_no_update on storage.objects;
  drop policy if exists storage_auditor_no_delete on storage.objects;
end $$;

select public.fn_aplicar_barrera_auditor();

-- -- 3. LECTURA — lo que el auditor necesita y hoy no ve
-- -----------------------------------------------------------------------------
-- Lo que YA ve sin política nueva, por ser de tenant: tenants, perfiles_usuario,
-- reportes, areas_tenant, solicitudes (rama «los demás roles, todo su tenant»),
-- evidencias, capturas_valor, comentarios y solicitudes_recordatorios. No se
-- tocan: funcionan y ampliarlas sería reescribir políticas vigentes en un
-- hotfix.
--
-- Lo que sigue son las tablas abiertas hoy al staff y al admin_cliente, que el
-- auditor necesita para Cobertura, el Excel de taxonomía y las tres pantallas de
-- lectura (registros de clima, objetivos, cuestionarios). Se agregan políticas
-- PERMISIVAS nuevas en vez de ampliar las de admin_cliente: las permisivas se
-- combinan con OR, así que agregar no cambia el alcance de nadie más, y quitar
-- el rol es borrar estas filas del catálogo y nada más.

-- Idempotencia: la migración debe poder reaplicarse sin error (encargo §4).
drop policy if exists datapoints_auditor_select              on public.datapoints_taxonomia;
drop policy if exists rubros_taxonomia_auditor_select        on public.rubros_taxonomia;
drop policy if exists mapeo_export_auditor_select            on public.mapeo_export;
drop policy if exists mapeo_sol_dp_auditor_select            on public.mapeo_solicitud_datapoint;
drop policy if exists registros_clima_auditor_select         on public.registros_clima;
drop policy if exists registros_clima_valores_auditor_select on public.registros_clima_valores;
drop policy if exists objetivos_auditor_select               on public.objetivos;
drop policy if exists objetivos_detalle_auditor_select       on public.objetivos_detalle;
drop policy if exists cuestionarios_auditor_select           on public.cuestionarios_respuestas;

create policy datapoints_auditor_select on public.datapoints_taxonomia
  for select to authenticated
  using (public.fn_is_auditor());

create policy rubros_taxonomia_auditor_select on public.rubros_taxonomia
  for select to authenticated
  using (public.fn_is_auditor());

create policy mapeo_export_auditor_select on public.mapeo_export
  for select to authenticated
  using (public.fn_is_auditor());

create policy mapeo_sol_dp_auditor_select on public.mapeo_solicitud_datapoint
  for select to authenticated
  using (public.fn_is_auditor() and public.fn_puede_ver_solicitud(solicitud_id));

create policy registros_clima_auditor_select on public.registros_clima
  for select to authenticated
  using (
    public.fn_is_auditor()
    and exists (
      select 1 from public.reportes r
      where r.id = reporte_id and r.tenant_id = public.fn_current_tenant()
    )
  );

create policy registros_clima_valores_auditor_select on public.registros_clima_valores
  for select to authenticated
  using (
    public.fn_is_auditor()
    and exists (
      select 1
      from public.registros_clima rc
      join public.reportes r on r.id = rc.reporte_id
      where rc.id = registro_id and r.tenant_id = public.fn_current_tenant()
    )
  );

create policy objetivos_auditor_select on public.objetivos
  for select to authenticated
  using (
    public.fn_is_auditor()
    and exists (
      select 1 from public.reportes r
      where r.id = reporte_id and r.tenant_id = public.fn_current_tenant()
    )
  );

create policy objetivos_detalle_auditor_select on public.objetivos_detalle
  for select to authenticated
  using (
    public.fn_is_auditor()
    and exists (
      select 1
      from public.objetivos o
      join public.reportes r on r.id = o.reporte_id
      where o.id = objetivo_id and r.tenant_id = public.fn_current_tenant()
    )
  );

create policy cuestionarios_auditor_select on public.cuestionarios_respuestas
  for select to authenticated
  using (
    public.fn_is_auditor()
    and exists (
      select 1 from public.reportes r
      where r.id = reporte_id and r.tenant_id = public.fn_current_tenant()
    )
  );

-- -----------------------------------------------------------------------------
-- 4. La bitácora general NO es del auditor
-- -----------------------------------------------------------------------------
-- bitacora_select es de tenant («staff, o filas del propio tenant»), así que sin
-- esta barrera el auditor leería la bitácora COMPLETA de la emisora: quién entró,
-- a qué hora, qué correos se mandaron, qué cambió cada quien. El encargo lo
-- excluye y la razón es de fondo: el auditor viene a verificar el expediente de
-- sostenibilidad, no a vigilar la operación interna de su cliente.
--
-- Lo que sí ve de trazabilidad va donde corresponde: quién subió y cuándo, y
-- quién validó y cuándo, están en evidencias y solicitudes, que ya lee.
drop policy if exists bitacora_auditor_no_select on public.bitacora;   -- nombre anterior
drop policy if exists auditor_sin_lectura_bitacora on public.bitacora;
create policy auditor_sin_lectura_bitacora on public.bitacora
  as restrictive for select to authenticated
  using (not public.fn_is_auditor());

-- -----------------------------------------------------------------------------
-- 5. La observación formal sigue sin ser del auditor
-- -----------------------------------------------------------------------------
-- HALLAZGO del Paso 1: el trigger que se pidió YA EXISTÍA. La migración
-- 20260820130000 creó fn_valida_observacion_origen, que además es más fina que
-- «solo staff»: exige staff en las solicitudes de origen 'irstrat' y
-- admin_cliente en las de origen 'cliente'. Escribir un trigger nuevo que dijera
-- «solo staff» habría AFLOJADO esa regla quitándole al admin_cliente lo suyo.
--
-- Así que se refuerza el existente en vez de competir con él. La cláusula es
-- REDUNDANTE por diseño —el auditor ya no puede insertar en `comentarios` por la
-- barrera del punto 2, así que este camino es inalcanzable— y se pone igual por
-- dos razones: si algún día se le abriera `comentarios` al auditor, la
-- prohibición de la observación formal no se iría con el cambio; y el error que
-- devuelve nombra el rol, que es mejor diagnóstico que un rechazo de RLS.
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

  if public.fn_is_auditor() then
    raise exception 'El auditor externo no registra observaciones formales.'
      using errcode = 'check_violation';
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
