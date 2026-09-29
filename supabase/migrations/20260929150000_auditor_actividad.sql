-- =============================================================================
-- auditor_actividad — qué miró y qué se llevó el auditor externo.
--
-- No es la bitácora. `bitacora` registra lo que CAMBIA el estado del expediente
-- y la escriben los triggers; aquí se registra LECTURA, que no deja rastro en
-- ninguna tabla de negocio y que en una auditoría es justo lo que hay que poder
-- reconstruir: qué se le mostró al despacho y qué archivos se llevó.
--
-- Separarlas también separa quién las ve: la bitácora es del tenant, y esto solo
-- lo ve el administrador de IRStrat.
--
-- ADVERTENCIA, y no es menor: esta tabla registra la conducta de una persona
-- identificable de un despacho externo, con IP y navegador. Su legitimidad
-- depende del aviso por escrito a esa persona que pide el encargo §4, no de que
-- la tabla esté bien hecha. Sin el aviso, no se enciende.
--
-- Retención propuesta: 24 meses, a documentar en la especificación. No se
-- implementa purga automática en este hotfix; borrar por calendario algo que
-- respalda un aseguramiento es una decisión con consecuencias y se toma aparte.
-- =============================================================================

do $$
begin
  create type public.tipo_actividad_auditor as enum (
    'inicio_sesion',
    'vista_matriz',
    'vista_cobertura',
    'vista_solicitud',
    'vista_evidencia',
    'descarga_evidencia',
    'descarga_excel',
    'comentario'
  );
exception when duplicate_object then null;  -- reaplicable (encargo §4)
end $$;

create table if not exists public.auditor_actividad (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete restrict,

  -- on delete restrict, no cascade: la cuenta del auditor se DESACTIVA al cerrar
  -- el proceso, nunca se borra, precisamente para que estas filas sigan
  -- nombrando a alguien. El restrict convierte esa regla en un candado.
  auditor_id  uuid not null references public.perfiles_usuario (id) on delete restrict,

  tipo        public.tipo_actividad_auditor not null,

  -- Objeto mirado, cuando lo hay. 'vista_matriz' y 'inicio_sesion' no tienen.
  objeto_tipo text,
  objeto_id   uuid,

  -- Nombre del archivo servido en las descargas. Se guarda el nombre y no la
  -- ruta del bucket: la ruta es un dato de infraestructura y el nombre es lo que
  -- permite decir «se llevó esto».
  archivo     text,

  ip          inet,
  navegador   text,
  created_at  timestamptz not null default now()
);

comment on table public.auditor_actividad is
  'Vistas y descargas del rol auditor. La escribe el servidor con service_role en cada lectura; la lee SOLO el administrador de IRStrat. Registra a una persona externa identificable: requiere el aviso por escrito del encargo §4.';
comment on column public.auditor_actividad.ip is
  'Tipo inet, no text: permite consultar por rango sin parsear, y rechaza en la base un valor que no sea una dirección.';
comment on column public.auditor_actividad.archivo is
  'Nombre del archivo servido, no su ruta en el bucket.';

create index if not exists auditor_actividad_tenant_fecha_idx
  on public.auditor_actividad (tenant_id, created_at desc);
create index if not exists auditor_actividad_auditor_fecha_idx
  on public.auditor_actividad (auditor_id, created_at desc);

-- -----------------------------------------------------------------------------
-- GRANTS
--   · authenticated → SOLO SELECT, y RLS lo acota al administrador de IRStrat.
--     Sin INSERT: si el usuario pudiera escribir su propio registro de
--     actividad, el registro no valdría nada. Lo escribe el servidor.
--   · service_role  → SELECT e INSERT. No UPDATE ni DELETE: append-only, como la
--     bitácora, y por la misma razón.
-- -----------------------------------------------------------------------------
grant select on public.auditor_actividad to authenticated;
grant select, insert on public.auditor_actividad to service_role;
revoke insert, update, delete on public.auditor_actividad from authenticated, anon;

alter table public.auditor_actividad enable row level security;

-- LECTURA: solo el administrador de IRStrat. No el analista, no el admin del
-- cliente, y desde luego no el propio auditor.
--
-- Que el ADMIN DEL CLIENTE no la vea es deliberado y conviene dejarlo dicho: son
-- los movimientos de un tercero contratado para revisarlo a él, y dárselos
-- convertiría la trazabilidad del aseguramiento en un canal de vigilancia sobre
-- su propio auditor.
drop policy if exists auditor_actividad_select on public.auditor_actividad;
create policy auditor_actividad_select on public.auditor_actividad
  for select to authenticated
  using (public.fn_is_admin_irstrat());

-- Prohibición explícita de mutación desde la aplicación, en línea con `bitacora`.
drop policy if exists auditor_actividad_no_insert on public.auditor_actividad;
drop policy if exists auditor_actividad_no_update on public.auditor_actividad;
drop policy if exists auditor_actividad_no_delete on public.auditor_actividad;

create policy auditor_actividad_no_insert on public.auditor_actividad
  as restrictive for insert to authenticated with check (false);
create policy auditor_actividad_no_update on public.auditor_actividad
  as restrictive for update to authenticated using (false);
create policy auditor_actividad_no_delete on public.auditor_actividad
  as restrictive for delete to authenticated using (false);

-- -----------------------------------------------------------------------------
-- Regla de CLAUDE.md §3: toda migración que cree una tabla o un bucket termina
-- heredando la barrera del auditor. Aquí es un no-op —esta tabla está excluida
-- por nombre dentro de la función, a propósito— y se llama igual: la regla vale
-- porque se cumple siempre, y una excepción silenciosa enseña a saltársela.
-- -----------------------------------------------------------------------------
select public.fn_aplicar_barrera_auditor();
