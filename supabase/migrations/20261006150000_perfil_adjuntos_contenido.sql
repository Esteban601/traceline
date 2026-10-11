-- =============================================================================
-- Lectura de los adjuntos del Perfil del emisor (encargo 2026-10-06,
-- suplemento-calidad — Paso 2).
--
-- perfil_emisor_adjuntos_contenido es la tabla hermana de evidencias_contenido:
-- guarda UNA VEZ por adjunto lo que se extrajo del archivo (texto por página de
-- un PDF, párrafos y tablas de un Word, celdas de un Excel, transcripción de una
-- imagen) para que el generador del Suplemento lo use como contexto citado por
-- archivo y página. Misma extracción, mismo tipo de estado, misma cola.
--
-- QUIÉN ESCRIBE: nadie desde la aplicación con sesión de usuario.
--   · El trigger `trg_perfil_adjunto_encolar_lectura` (SECURITY DEFINER) crea la
--     fila en `pendiente` al insertar el adjunto, por cualquier camino, y copia
--     lo que el procesador necesita (ruta, nombre, sección).
--   · El procesador (lib/evidencias/cola.ts, con service_role) la actualiza.
-- QUIÉN LEE: los mismos que leen el adjunto —staff y el administrador del
-- cliente de su propia emisora—. Usuarios de área, no: el adjunto es material
-- de dirección y su contenido no se abre por una puerta que el archivo tiene
-- cerrada.
--
-- Bandera y tope: los de la lectura de evidencias (`lectura_evidencias_activa`,
-- `lecturas_mes_max`). El contenido viaja al mismo proveedor por el mismo
-- motivo; dos interruptores para lo mismo serían dos maneras de equivocarse.
--
-- Relleno: los adjuntos que ya existen reciben su fila (pendiente u omitido
-- según la bandera de su emisora), para que la cola los lea sin volver a
-- subirlos. Es una fila nueva en una tabla nueva, no el cambio de un dato.
--
-- Aditiva: tabla nueva, trigger nuevo. Idempotente. Termina con
-- fn_aplicar_barrera_auditor() (CLAUDE.md §3).
-- =============================================================================

create table if not exists public.perfil_emisor_adjuntos_contenido (
  id              uuid primary key default gen_random_uuid(),
  adjunto_id      uuid not null unique references public.perfil_emisor_adjuntos (id) on delete cascade,
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  seccion         text not null,
  archivo_path    text not null,
  nombre_original text not null,
  tipo            text check (tipo in ('excel', 'csv', 'pdf', 'word', 'imagen', 'otro')),
  estado          public.estado_lectura not null default 'pendiente',
  contenido       jsonb,
  paginas         integer,
  hojas           integer,
  truncado        boolean not null default false,
  bytes           bigint,
  modelo          text,
  tokens_entrada  integer not null default 0,
  tokens_salida   integer not null default 0,
  costo_usd       numeric(10, 4) not null default 0,
  intentos        integer not null default 0,
  error           text,
  mensaje         text,
  created_at      timestamptz not null default now(),
  procesado_en    timestamptz
);

comment on table public.perfil_emisor_adjuntos_contenido is
  'Contenido extraído de cada adjunto del Perfil del emisor (una fila por adjunto). La crea un trigger al insertar el adjunto y la completa la cola de lectura con service_role. Solo lectura para usuarios. El generador lo usa como contexto citado; no respalda cifras.';
comment on column public.perfil_emisor_adjuntos_contenido.contenido is
  'Mismo JSON que evidencias_contenido.contenido: excel/csv {hojas}; pdf {paginas:[{pagina, texto, origen}]}; word {bloques}; imagen {paginas}.';

create index if not exists perfil_adjuntos_contenido_estado_idx
  on public.perfil_emisor_adjuntos_contenido (estado, created_at);
create index if not exists perfil_adjuntos_contenido_tenant_idx
  on public.perfil_emisor_adjuntos_contenido (tenant_id, seccion);

alter table public.perfil_emisor_adjuntos_contenido enable row level security;

drop policy if exists perfil_adjuntos_contenido_staff_select on public.perfil_emisor_adjuntos_contenido;
create policy perfil_adjuntos_contenido_staff_select on public.perfil_emisor_adjuntos_contenido
  for select to authenticated
  using (public.fn_is_staff());

drop policy if exists perfil_adjuntos_contenido_admin_cliente_select on public.perfil_emisor_adjuntos_contenido;
create policy perfil_adjuntos_contenido_admin_cliente_select on public.perfil_emisor_adjuntos_contenido
  for select to authenticated
  using (public.fn_is_admin_cliente() and tenant_id = public.fn_current_tenant());

-- Sin escritura para usuarios con sesión: ni grant ni política.
revoke insert, update, delete on public.perfil_emisor_adjuntos_contenido from authenticated, anon;
drop policy if exists perfil_adjuntos_contenido_no_insert on public.perfil_emisor_adjuntos_contenido;
create policy perfil_adjuntos_contenido_no_insert on public.perfil_emisor_adjuntos_contenido
  as restrictive for insert to authenticated with check (false);
drop policy if exists perfil_adjuntos_contenido_no_update on public.perfil_emisor_adjuntos_contenido;
create policy perfil_adjuntos_contenido_no_update on public.perfil_emisor_adjuntos_contenido
  as restrictive for update to authenticated using (false);
drop policy if exists perfil_adjuntos_contenido_no_delete on public.perfil_emisor_adjuntos_contenido;
create policy perfil_adjuntos_contenido_no_delete on public.perfil_emisor_adjuntos_contenido
  as restrictive for delete to authenticated using (false);

-- Grants explícitos (una tabla nueva no hereda SELECT para `authenticated`). La
-- cola corre con service_role: lee y actualiza esta tabla y descarga del bucket
-- `documentos`, que ya puede.
grant select on public.perfil_emisor_adjuntos_contenido to authenticated;
grant select, update on public.perfil_emisor_adjuntos_contenido to service_role;

-- -----------------------------------------------------------------------------
-- Encolado: al insertar un adjunto, su fila de contenido nace `pendiente`
-- (u `omitido` si la emisora tiene la lectura apagada, con el motivo).
-- -----------------------------------------------------------------------------
create or replace function public.fn_perfil_adjunto_encolar_lectura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activa boolean;
begin
  select lectura_evidencias_activa into v_activa from public.tenants where id = new.tenant_id;
  insert into public.perfil_emisor_adjuntos_contenido
    (adjunto_id, tenant_id, seccion, archivo_path, nombre_original, estado, mensaje)
  values
    (new.id, new.tenant_id, new.seccion, new.archivo_path, new.nombre_original,
     case when coalesce(v_activa, false) then 'pendiente'::public.estado_lectura else 'omitido'::public.estado_lectura end,
     case when coalesce(v_activa, false) then null else 'La lectura de documentos está apagada para esta emisora.' end)
  on conflict (adjunto_id) do nothing;
  return new;
end;
$$;

revoke all on function public.fn_perfil_adjunto_encolar_lectura() from public;

drop trigger if exists trg_perfil_adjunto_encolar_lectura on public.perfil_emisor_adjuntos;
create trigger trg_perfil_adjunto_encolar_lectura
  after insert on public.perfil_emisor_adjuntos
  for each row execute function public.fn_perfil_adjunto_encolar_lectura();

-- Relleno: los adjuntos que ya estaban.
insert into public.perfil_emisor_adjuntos_contenido
  (adjunto_id, tenant_id, seccion, archivo_path, nombre_original, estado, mensaje)
select a.id, a.tenant_id, a.seccion, a.archivo_path, a.nombre_original,
       case when t.lectura_evidencias_activa then 'pendiente'::public.estado_lectura else 'omitido'::public.estado_lectura end,
       case when t.lectura_evidencias_activa then null else 'La lectura de documentos está apagada para esta emisora.' end
  from public.perfil_emisor_adjuntos a
  join public.tenants t on t.id = a.tenant_id
on conflict (adjunto_id) do nothing;

comment on table public.perfil_emisor_adjuntos is
  'Archivos de respaldo de cada sección del perfil del emisor. La cola de lectura extrae su contenido a perfil_emisor_adjuntos_contenido y el generador lo usa como contexto citado (encargo suplemento-calidad, Paso 2).';

select public.fn_aplicar_barrera_auditor();
