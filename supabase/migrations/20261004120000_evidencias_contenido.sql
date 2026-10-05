-- =============================================================================
-- Lectura de evidencias (encargo 2026-10-04, captura sugerida — Paso 1).
--
-- evidencias_contenido guarda UNA VEZ por versión de evidencia lo que se extrajo
-- del archivo —celdas de un Excel, texto por página de un PDF, párrafos y tablas
-- de un Word, transcripción de una imagen— para que la sugerencia (Paso 2) y el
-- generador (Paso 5) lo reutilicen sin volver a leer el archivo.
--
-- QUIÉN ESCRIBE: nadie desde la aplicación con sesión de usuario.
--   · El trigger `trg_evidencia_encolar_lectura` (SECURITY DEFINER) crea la fila
--     en `pendiente` al insertar la evidencia, por cualquier camino —portal,
--     panel o script—, y copia lo que el procesador necesita (ruta, nombre,
--     versión), porque service_role en este proyecto NO lee `evidencias`.
--   · El procesador (lib/evidencias/cola.ts, con service_role) la actualiza.
-- QUIÉN LEE: quien puede ver la solicitud (misma regla que la evidencia). El
-- auditor la ve; la barrera le impide escribir.
--
-- Bandera y límite por tenant, en esta misma migración:
--   · `lectura_evidencias_activa`: el contenido viaja a la API de Anthropic, así
--     que en clientes reales empieza APAGADA hasta que su contrato de encargado
--     nombre a Anthropic (encargo §3). En las emisoras de demostración se
--     enciende aquí; es relleno de una columna nueva, no cambio de un dato.
--   · `lecturas_mes_max` (default 500): tope mensual de lecturas, propio de esta
--     función. Lo aplica la cola. `generaciones_mes_max` es otra cosa (y hoy no
--     se aplica en ningún lado; queda anotado en la especificación como deuda).
--
-- Aditiva: tipo nuevo, tabla nueva, dos columnas con default, trigger nuevo.
-- Idempotente. Termina con fn_aplicar_barrera_auditor() (CLAUDE.md §3).
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'estado_lectura' and typnamespace = 'public'::regnamespace) then
    create type public.estado_lectura as enum (
      'pendiente',     -- encolada, sin procesar
      'procesando',    -- tomada por el procesador
      'extraido',      -- contenido guardado
      'error',         -- falló la lectura; `error` dice por qué
      'no_soportado',  -- formato que no se lee (p. ej. .xls binario); `mensaje` dice qué hacer
      'omitido'        -- no se leyó por decisión: bandera apagada o tope mensual
    );
  end if;
end $$;

alter table public.tenants
  add column if not exists lectura_evidencias_activa boolean not null default false;
alter table public.tenants
  add column if not exists lecturas_mes_max integer not null default 500;

comment on column public.tenants.lectura_evidencias_activa is
  'Lectura de evidencias por la plataforma (el contenido viaja a la API de Anthropic). Apagada en clientes reales hasta que su contrato de encargado lo cubra; encendida en demostraciones.';
comment on column public.tenants.lecturas_mes_max is
  'Tope de lecturas de evidencias por mes calendario. Lo aplica la cola de lectura; las que pasan del tope quedan en «omitido».';

-- Relleno de la columna nueva: las demostraciones la tienen encendida (§3).
update public.tenants set lectura_evidencias_activa = true
 where es_demo and not lectura_evidencias_activa;

create table if not exists public.evidencias_contenido (
  id              uuid primary key default gen_random_uuid(),
  evidencia_id    uuid not null unique references public.evidencias (id) on delete cascade,
  solicitud_id    uuid not null references public.solicitudes (id) on delete cascade,
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  version         integer not null,
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

comment on table public.evidencias_contenido is
  'Contenido extraído de cada versión de evidencia (una fila por evidencia). La crea un trigger al insertar la evidencia y la completa la cola de lectura con service_role. Solo lectura para usuarios.';
comment on column public.evidencias_contenido.contenido is
  'JSON por tipo: excel/csv {hojas:[{nombre, celdas:[{ref, valor, formato?}]}]}; pdf {paginas:[{pagina, texto, origen: texto|vision}]}; word {bloques:[{tipo: parrafo|tabla, n, texto|filas}]}; imagen {texto, origen: vision}.';

create index if not exists evidencias_contenido_estado_idx on public.evidencias_contenido (estado, created_at);
create index if not exists evidencias_contenido_tenant_mes_idx on public.evidencias_contenido (tenant_id, created_at);
create index if not exists evidencias_contenido_solicitud_idx on public.evidencias_contenido (solicitud_id);

alter table public.evidencias_contenido enable row level security;

drop policy if exists evidencias_contenido_select on public.evidencias_contenido;
create policy evidencias_contenido_select on public.evidencias_contenido
  for select to authenticated
  using (public.fn_puede_ver_solicitud(solicitud_id));

-- Sin escritura para usuarios con sesión: ni grant ni política.
revoke insert, update, delete on public.evidencias_contenido from authenticated, anon;
drop policy if exists evidencias_contenido_no_insert on public.evidencias_contenido;
create policy evidencias_contenido_no_insert on public.evidencias_contenido
  as restrictive for insert to authenticated with check (false);
drop policy if exists evidencias_contenido_no_update on public.evidencias_contenido;
create policy evidencias_contenido_no_update on public.evidencias_contenido
  as restrictive for update to authenticated using (false);
drop policy if exists evidencias_contenido_no_delete on public.evidencias_contenido;
create policy evidencias_contenido_no_delete on public.evidencias_contenido
  as restrictive for delete to authenticated using (false);

-- Grants explícitos, como el resto del esquema: en este proyecto una tabla nueva
-- NO hereda SELECT para `authenticated` (sin él, la política de arriba nunca se
-- llega a evaluar: «permission denied»). La cola corre con service_role: lee y
-- actualiza esta tabla, y nada más nuevo.
grant select on public.evidencias_contenido to authenticated;
grant select, update on public.evidencias_contenido to service_role;

-- -----------------------------------------------------------------------------
-- Encolado: al insertar una evidencia, su fila de contenido nace `pendiente`
-- (u `omitido` si el tenant tiene la lectura apagada, con el motivo).
-- -----------------------------------------------------------------------------
create or replace function public.fn_evidencia_encolar_lectura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.fn_tenant_de_solicitud(new.solicitud_id);
  v_activa boolean;
begin
  select lectura_evidencias_activa into v_activa from public.tenants where id = v_tenant;
  insert into public.evidencias_contenido
    (evidencia_id, solicitud_id, tenant_id, version, archivo_path, nombre_original, estado, mensaje)
  values
    (new.id, new.solicitud_id, v_tenant, new.version, new.archivo_path, new.nombre_original,
     case when coalesce(v_activa, false) then 'pendiente'::public.estado_lectura else 'omitido'::public.estado_lectura end,
     case when coalesce(v_activa, false) then null else 'La lectura de evidencias está apagada para esta emisora.' end)
  on conflict (evidencia_id) do nothing;
  return new;
end;
$$;

revoke all on function public.fn_evidencia_encolar_lectura() from public;

drop trigger if exists trg_evidencia_encolar_lectura on public.evidencias;
create trigger trg_evidencia_encolar_lectura
  after insert on public.evidencias
  for each row execute function public.fn_evidencia_encolar_lectura();

select public.fn_aplicar_barrera_auditor();
