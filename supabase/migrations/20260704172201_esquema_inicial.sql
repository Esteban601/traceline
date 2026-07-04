-- =============================================================================
-- Migración inicial — Esquema de recabado y trazabilidad de evidencia ESG
-- Taxonomía NIIF S1/S2 · multi-tenant
--
-- Unidad central del modelo: el DATAPOINT de taxonomía (no el archivo).
-- El cliente interactúa con "solicitudes" en lenguaje llano; el mapeo a la
-- taxonomía NIIF es interno de IRStrat (ver mapeo_solicitud_datapoint).
-- =============================================================================

-- pgcrypto: requerido para crypt()/gen_salt() al sembrar usuarios auth en seed.sql
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.rol_usuario as enum ('cliente', 'coordinador', 'analista', 'admin');
create type public.estado_reporte as enum ('activo', 'congelado');
create type public.norma_niif as enum ('S1', 'S2');
create type public.pilar_niif as enum ('gobernanza', 'estrategia', 'riesgos', 'metricas');
create type public.estado_solicitud as enum (
  'pendiente',      -- creada, aún no comunicada al cliente
  'solicitado',     -- comunicada al cliente, esperando evidencia
  'recibido',       -- llegó al menos una evidencia
  'en_revision',    -- analista IRStrat revisando
  'observaciones',  -- devuelta al cliente con observaciones
  'validado',       -- aceptada por IRStrat
  'congelado'       -- bloqueada por congelamiento del reporte
);

-- -----------------------------------------------------------------------------
-- tenants — emisoras BMV / clientes de IRStrat
-- -----------------------------------------------------------------------------
create table public.tenants (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  slug       text not null unique,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.tenants is 'Emisoras/clientes. Cada tenant aísla sus reportes y evidencias vía RLS.';

-- -----------------------------------------------------------------------------
-- perfiles_usuario — extiende auth.users
-- tenant_id NULL   => staff interno IRStrat (ve todo)
-- tenant_id != NULL => usuario del cliente (acotado a su tenant)
-- -----------------------------------------------------------------------------
create table public.perfiles_usuario (
  id         uuid primary key references auth.users (id) on delete cascade,
  tenant_id  uuid references public.tenants (id) on delete restrict,
  rol        public.rol_usuario not null,
  area       text,  -- p.ej. 'RH', 'Operaciones', 'Finanzas' (solo relevante para rol cliente)
  nombre     text not null,
  email      text not null,
  created_at timestamptz not null default now()
);

comment on table public.perfiles_usuario is 'Perfil de negocio ligado a auth.users. tenant_id NULL = staff IRStrat.';
comment on column public.perfiles_usuario.area is 'Área del cliente responsable; acota la visibilidad del rol cliente.';

create index perfiles_usuario_tenant_idx on public.perfiles_usuario (tenant_id);

-- -----------------------------------------------------------------------------
-- reportes — un reporte anual sustentable por ejercicio, por tenant
-- -----------------------------------------------------------------------------
create table public.reportes (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants (id) on delete restrict,
  nombre               text not null,
  ejercicio            int not null,
  estado               public.estado_reporte not null default 'activo',
  fecha_congelamiento  timestamptz,
  created_at           timestamptz not null default now()
);

create index reportes_tenant_idx on public.reportes (tenant_id);

-- -----------------------------------------------------------------------------
-- datapoints_taxonomia — catálogo NIIF S1/S2 (interno IRStrat, global)
-- No tiene tenant: es referencia compartida. Solo visible para staff (RLS).
-- -----------------------------------------------------------------------------
create table public.datapoints_taxonomia (
  id                uuid primary key default gen_random_uuid(),
  codigo            text not null,       -- p.ej. 'S2-29a'
  norma             public.norma_niif not null,
  pilar             public.pilar_niif not null,
  descripcion       text not null,
  version_taxonomia text not null default '2025',
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (codigo, version_taxonomia)
);

comment on table public.datapoints_taxonomia is 'Catálogo de datapoints NIIF S1/S2. Referencia interna de IRStrat; no se expone al cliente.';

-- -----------------------------------------------------------------------------
-- solicitudes — petición de información en lenguaje cliente
-- -----------------------------------------------------------------------------
create table public.solicitudes (
  id                      uuid primary key default gen_random_uuid(),
  reporte_id              uuid not null references public.reportes (id) on delete cascade,
  titulo                  text not null,               -- lenguaje llano para el cliente
  descripcion             text,
  area_asignada           text,                        -- 'RH' | 'Operaciones' | 'Finanzas' | ...
  es_cuantitativa         boolean not null default false,
  unidad_esperada         text,                        -- 'kWh', 'tCO2e', ... (si es_cuantitativa)
  estado                  public.estado_solicitud not null default 'pendiente',
  responsable_cliente_id  uuid references public.perfiles_usuario (id) on delete set null,
  responsable_irstrat_id  uuid references public.perfiles_usuario (id) on delete set null,
  fecha_limite            date,
  orden                   int not null default 0,
  created_at              timestamptz not null default now()
);

create index solicitudes_reporte_idx on public.solicitudes (reporte_id);
create index solicitudes_area_idx on public.solicitudes (area_asignada);
create index solicitudes_responsable_cliente_idx on public.solicitudes (responsable_cliente_id);

-- -----------------------------------------------------------------------------
-- mapeo_solicitud_datapoint — relación N:N solicitud <-> datapoint (interno)
-- Una solicitud puede alimentar varios datapoints y un datapoint puede
-- alimentarse de varias solicitudes.
-- -----------------------------------------------------------------------------
create table public.mapeo_solicitud_datapoint (
  solicitud_id uuid not null references public.solicitudes (id) on delete cascade,
  datapoint_id uuid not null references public.datapoints_taxonomia (id) on delete restrict,
  created_at   timestamptz not null default now(),
  primary key (solicitud_id, datapoint_id)
);

create index mapeo_datapoint_idx on public.mapeo_solicitud_datapoint (datapoint_id);

-- -----------------------------------------------------------------------------
-- evidencias — APPEND ONLY. Cada carga es una versión inmutable.
-- La versión se asigna por trigger (BEFORE INSERT).
-- -----------------------------------------------------------------------------
create table public.evidencias (
  id               uuid primary key default gen_random_uuid(),
  solicitud_id     uuid not null references public.solicitudes (id) on delete cascade,
  version          int not null,             -- asignada por trigger fn_evidencia_before_insert
  archivo_path     text not null,            -- ruta en bucket 'evidencias': {tenant_id}/{solicitud_id}/...
  nombre_original  text not null,
  periodo_cubierto text,
  area_origen      text,
  subido_por       uuid not null references public.perfiles_usuario (id) on delete restrict,
  notas            text,
  created_at       timestamptz not null default now(),
  unique (solicitud_id, version)
);

comment on table public.evidencias is 'APPEND ONLY: sin UPDATE/DELETE (ver RLS). Historial versionado inmutable de cargas.';

create index evidencias_solicitud_idx on public.evidencias (solicitud_id);

-- -----------------------------------------------------------------------------
-- capturas_valor — APPEND ONLY. Valor numérico extraído de una evidencia.
-- Correcciones = filas nuevas (nunca UPDATE).
-- -----------------------------------------------------------------------------
create table public.capturas_valor (
  id            uuid primary key default gen_random_uuid(),
  solicitud_id  uuid not null references public.solicitudes (id) on delete cascade,
  evidencia_id  uuid not null references public.evidencias (id) on delete restrict,
  valor         numeric not null,
  unidad        text not null,
  periodo       text,
  capturado_por uuid not null references public.perfiles_usuario (id) on delete restrict,
  confirmado    boolean not null default true,
  created_at    timestamptz not null default now()
);

comment on table public.capturas_valor is 'APPEND ONLY: correcciones se registran como filas nuevas, nunca UPDATE.';

create index capturas_valor_solicitud_idx on public.capturas_valor (solicitud_id);
create index capturas_valor_evidencia_idx on public.capturas_valor (evidencia_id);

-- -----------------------------------------------------------------------------
-- comentarios — hilo de conversación / observaciones sobre una solicitud
-- -----------------------------------------------------------------------------
create table public.comentarios (
  id             uuid primary key default gen_random_uuid(),
  solicitud_id   uuid not null references public.solicitudes (id) on delete cascade,
  autor_id       uuid not null references public.perfiles_usuario (id) on delete restrict,
  contenido      text not null,
  es_observacion boolean not null default false,  -- true = observación formal de IRStrat al cliente
  created_at     timestamptz not null default now()
);

create index comentarios_solicitud_idx on public.comentarios (solicitud_id);

-- -----------------------------------------------------------------------------
-- bitacora — APPEND ONLY. Trazabilidad para aseguramiento limitado.
-- Poblada automáticamente por triggers; sin UPDATE/DELETE.
-- -----------------------------------------------------------------------------
create table public.bitacora (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenants (id) on delete set null,
  usuario_id uuid references public.perfiles_usuario (id) on delete set null,
  accion     text not null,       -- p.ej. 'evidencia_creada', 'captura_creada', 'cambio_estado'
  entidad    text not null,       -- p.ej. 'evidencias', 'solicitudes'
  entidad_id uuid,
  detalle    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.bitacora is 'APPEND ONLY: registro de auditoría inmutable para aseguramiento NIIF S1/S2.';

create index bitacora_tenant_idx on public.bitacora (tenant_id);
create index bitacora_entidad_idx on public.bitacora (entidad, entidad_id);

-- =============================================================================
-- Funciones helper de identidad (SECURITY DEFINER)
-- Leen perfiles_usuario ignorando RLS para evitar recursión en las políticas.
-- =============================================================================
create or replace function public.fn_current_tenant()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.perfiles_usuario where id = auth.uid();
$$;

create or replace function public.fn_current_rol()
returns public.rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfiles_usuario where id = auth.uid();
$$;

create or replace function public.fn_current_area()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select area from public.perfiles_usuario where id = auth.uid();
$$;

-- Staff IRStrat = perfil existente con tenant_id NULL.
create or replace function public.fn_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles_usuario
    where id = auth.uid() and tenant_id is null
  );
$$;

-- ¿El usuario actual puede ver esta solicitud?
-- Encapsula la regla de visibilidad reutilizada por evidencias/capturas/comentarios.
--   * staff               -> todo
--   * usuario del tenant   -> solicitudes de su tenant; si rol='cliente' solo de su
--                             área o donde es responsable_cliente_id.
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

  if public.fn_current_rol() = 'cliente' then
    -- cliente: solo su área o donde es responsable designado
    return (v_area is not distinct from public.fn_current_area())
        or (v_resp = auth.uid());
  end if;

  -- coordinador (u otros roles del tenant): todo su tenant
  return true;
end;
$$;
