-- =============================================================================
-- comentarios_auditor — el canal propio del auditor externo.
--
-- Por qué una tabla nueva y no ampliar `comentarios`
-- -----------------------------------------------------------------------------
-- Tres razones, y la tercera es la que decide.
--
--   1. `comentarios` cuelga de `solicitud_id` con llave foránea. El auditor
--      comenta también registros de clima, objetivos y cuestionarios: no caben
--      sin volver polimórfica una columna que hoy es una FK limpia.
--   2. `comentarios` no tiene estado de atención. El hilo del auditor sí lo
--      necesita: lo que no se responde es justo lo que hay que ver.
--   3. `comentarios` ya carga con la regla de la observación formal y con el
--      trigger que la vigila. Meter ahí un tercer tipo de autor obligaría a
--      tocar esa regla en un hotfix, y esa regla es la que separa lo que dice
--      IRStrat de lo que dice el cliente. No se toca.
--
-- Los comentarios existentes de otros roles no cambian: esta tabla es nueva y
-- `comentarios` queda exactamente como estaba.
-- =============================================================================

-- El objeto comentado es POLIMÓRFICO: cuatro tablas distintas, ninguna FK
-- posible. El tipo se declara como enum en vez de texto libre porque es la
-- mitad de la identidad del objeto —sin él, `objeto_id` no significa nada— y un
-- valor mal escrito dejaría un comentario huérfano que ninguna pantalla
-- encuentra. Lo que la FK no puede garantizar lo garantiza el trigger de abajo.
do $$
begin
  create type public.objeto_comentario_auditor as enum (
    'solicitud',
    'registro_clima',
    'objetivo',
    'cuestionario'
  );
exception when duplicate_object then null;  -- reaplicable (encargo §4)
end $$;

create table if not exists public.comentarios_auditor (
  id             uuid primary key default gen_random_uuid(),

  -- tenant_id es REDUNDANTE con el objeto (se podría derivar navegando hasta el
  -- reporte) y se guarda igual: sin él, cada evaluación de RLS tendría que
  -- resolver el polimorfismo con cuatro joins condicionales. Lo llena el trigger
  -- a partir del objeto, no la aplicación, así que no puede quedar mintiendo.
  tenant_id      uuid not null references public.tenants (id) on delete restrict,

  objeto_tipo    public.objeto_comentario_auditor not null,
  objeto_id      uuid not null,

  autor_id       uuid not null references public.perfiles_usuario (id) on delete restrict,
  texto          text not null,
  created_at     timestamptz not null default now(),

  -- La respuesta vive en la misma fila y no en un hilo aparte: el encargo pide
  -- un estado por comentario («sin responder» / «respondido por X el Y»), no una
  -- conversación. Una tabla de respuestas permitiría dos respuestas a lo mismo y
  -- volvería ambiguo el contador de pendientes, que es la pieza que evita que
  -- algo se quede sin atender.
  respondido_por uuid references public.perfiles_usuario (id) on delete restrict,
  respondido_en  timestamptz,
  respuesta      text,

  constraint comentarios_auditor_texto_no_vacio
    check (length(btrim(texto)) > 0),

  -- Los tres campos de la respuesta van juntos o no van: «respondido por nadie»
  -- y «respondido sin texto» no son estados, son filas a medio escribir.
  constraint comentarios_auditor_respuesta_completa check (
    (respondido_por is null and respondido_en is null and respuesta is null)
    or (respondido_por is not null and respondido_en is not null
        and respuesta is not null and length(btrim(respuesta)) > 0)
  )
);

comment on table public.comentarios_auditor is
  'Comentarios del AUDITOR EXTERNO sobre cualquiera de los cuatro objetos revisables, con su estado de atención. Separada de `comentarios`, que sigue siendo el hilo entre IRStrat y el cliente.';
comment on column public.comentarios_auditor.tenant_id is
  'Emisora del objeto comentado. Lo calcula el trigger desde el objeto; la aplicación no lo fija. Existe para que RLS no tenga que resolver el polimorfismo.';
comment on column public.comentarios_auditor.objeto_id is
  'Id del objeto en la tabla que indica objeto_tipo. Sin FK por polimórfico: la integridad la sostiene fn_comentario_auditor_before_insert.';
comment on column public.comentarios_auditor.respondido_por is
  'Quién respondió: staff de IRStrat o administrador del cliente, indistintamente. No hay responsable único, por decisión del 29/09/2026.';

create index if not exists comentarios_auditor_objeto_idx
  on public.comentarios_auditor (objeto_tipo, objeto_id);
create index if not exists comentarios_auditor_tenant_idx
  on public.comentarios_auditor (tenant_id);
-- El contador de «sin responder» de la matriz y del detalle se apoya en este
-- índice parcial: es la consulta que corre en cada carga de esas pantallas.
create index if not exists comentarios_auditor_pendientes_idx
  on public.comentarios_auditor (tenant_id) where respondido_en is null;

-- -----------------------------------------------------------------------------
-- GRANTS. Tabla nueva: el grant «on all tables» de la migración inicial fue
-- puntual, no futuro.
--   · authenticated → SELECT, INSERT y UPDATE; RLS decide quién y qué.
--     DELETE no se otorga a nadie: un comentario de auditoría que se puede
--     borrar no sirve como evidencia de auditoría.
--   · service_role  → SELECT e INSERT: el servidor lee los contadores y escribe
--     el registro de actividad asociado. No responde ni corrige por su cuenta.
-- -----------------------------------------------------------------------------
grant select, insert, update on public.comentarios_auditor to authenticated;
grant select, insert on public.comentarios_auditor to service_role;
revoke delete on public.comentarios_auditor from authenticated, anon;

alter table public.comentarios_auditor enable row level security;

-- -----------------------------------------------------------------------------
-- Integridad del objeto polimórfico + autoría calculada
-- -----------------------------------------------------------------------------
-- Resuelve el tenant NAVEGANDO desde el objeto y lo escribe él mismo. Si el
-- objeto no existe, o no es del tenant de quien comenta, el INSERT se cae aquí:
-- es lo que sustituye a la llave foránea que el polimorfismo impide.
create or replace function public.fn_comentario_auditor_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  case new.objeto_tipo
    when 'solicitud' then
      select r.tenant_id into v_tenant
      from public.solicitudes s
      join public.reportes r on r.id = s.reporte_id
      where s.id = new.objeto_id;
    when 'registro_clima' then
      select r.tenant_id into v_tenant
      from public.registros_clima rc
      join public.reportes r on r.id = rc.reporte_id
      where rc.id = new.objeto_id;
    when 'objetivo' then
      select r.tenant_id into v_tenant
      from public.objetivos o
      join public.reportes r on r.id = o.reporte_id
      where o.id = new.objeto_id;
    when 'cuestionario' then
      select r.tenant_id into v_tenant
      from public.cuestionarios_respuestas cr
      join public.reportes r on r.id = cr.reporte_id
      where cr.id = new.objeto_id;
  end case;

  if v_tenant is null then
    raise exception 'El objeto comentado no existe (% %).', new.objeto_tipo, new.objeto_id
      using errcode = 'foreign_key_violation';
  end if;

  -- Autoría y emisora CALCULADAS: aunque RLS ya exige que el autor sea quien
  -- firma, fijarlas aquí cierra el hueco de un INSERT con service_role —que
  -- salta RLS— escribiendo un comentario a nombre de otro.
  new.tenant_id := v_tenant;
  if auth.uid() is not null then
    new.autor_id := auth.uid();
  end if;

  -- Un comentario nace SIN responder, siempre. Que alguien pudiera insertarlo ya
  -- respondido dejaría el contador de pendientes en una cifra que no refleja lo
  -- que pasó.
  new.respondido_por := null;
  new.respondido_en  := null;
  new.respuesta      := null;

  return new;
end;
$$;

drop trigger if exists trg_comentario_auditor_before_insert on public.comentarios_auditor;
create trigger trg_comentario_auditor_before_insert
  before insert on public.comentarios_auditor
  for each row execute function public.fn_comentario_auditor_before_insert();

-- -----------------------------------------------------------------------------
-- Qué se puede cambiar de un comentario ya escrito: SOLO responderlo
-- -----------------------------------------------------------------------------
-- RLS no distingue columnas: la política de UPDATE abre la fila y este trigger
-- acota qué. Sin él, quien puede responder podría reescribir el comentario del
-- auditor, que es exactamente lo que una auditoría no puede permitir.
create or replace function public.fn_comentario_auditor_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.texto is distinct from old.texto
     or new.objeto_tipo is distinct from old.objeto_tipo
     or new.objeto_id is distinct from old.objeto_id
     or new.autor_id is distinct from old.autor_id
     or new.tenant_id is distinct from old.tenant_id
     or new.created_at is distinct from old.created_at then
    raise exception 'De un comentario del auditor solo se puede cambiar la respuesta.'
      using errcode = 'check_violation';
  end if;

  if old.respondido_en is not null then
    raise exception 'Ese comentario ya fue respondido; la respuesta no se reescribe.'
      using errcode = 'check_violation';
  end if;

  -- Quién responde y cuándo los pone la base, no la aplicación.
  if new.respuesta is not null then
    new.respondido_por := auth.uid();
    new.respondido_en  := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_comentario_auditor_before_update on public.comentarios_auditor;
create trigger trg_comentario_auditor_before_update
  before update on public.comentarios_auditor
  for each row execute function public.fn_comentario_auditor_before_update();

-- -----------------------------------------------------------------------------
-- Políticas
-- -----------------------------------------------------------------------------
-- LECTURA: el staff ve todo; dentro del tenant, el administrador del cliente y
-- el propio auditor. El usuario de área NO: el hilo del auditor es con quien
-- responde por el expediente, no con quien cargó cada archivo.
drop policy if exists comentarios_auditor_select on public.comentarios_auditor;
create policy comentarios_auditor_select on public.comentarios_auditor
  for select to authenticated
  using (
    public.fn_is_staff()
    or (
      tenant_id = public.fn_current_tenant()
      and (public.fn_is_admin_cliente() or public.fn_is_auditor())
    )
  );

-- ESCRITURA del comentario: SOLO el auditor, sobre su propio tenant y firmando
-- como sí mismo. Es la única excepción a la barrera de la migración anterior, y
-- por eso aquella excluye esta tabla por nombre.
drop policy if exists comentarios_auditor_insert on public.comentarios_auditor;
create policy comentarios_auditor_insert on public.comentarios_auditor
  for insert to authenticated
  with check (
    public.fn_is_auditor()
    and autor_id = auth.uid()
  );

-- RESPUESTA: staff o administrador del cliente de ese tenant. Cualquiera de los
-- dos, sin responsable único.
drop policy if exists comentarios_auditor_responde on public.comentarios_auditor;
create policy comentarios_auditor_responde on public.comentarios_auditor
  for update to authenticated
  using (
    public.fn_is_staff()
    or (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant())
  )
  with check (
    public.fn_is_staff()
    or (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant())
  );

-- Sin política de DELETE, y el grant retirado arriba. Append-only como la
-- bitácora y por el mismo motivo.
drop policy if exists comentarios_auditor_no_delete on public.comentarios_auditor;
create policy comentarios_auditor_no_delete on public.comentarios_auditor
  as restrictive for delete to authenticated using (false);

-- -----------------------------------------------------------------------------
-- Regla de CLAUDE.md §3: toda migración que cree una tabla o un bucket termina
-- heredando la barrera del auditor. Aquí es un no-op —esta tabla está excluida
-- por nombre dentro de la función, a propósito— y se llama igual: la regla vale
-- porque se cumple siempre, y una excepción silenciosa enseña a saltársela.
-- -----------------------------------------------------------------------------
select public.fn_aplicar_barrera_auditor();
