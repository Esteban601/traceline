-- =============================================================================
-- Sugerencias de captura (encargo 2026-10-04, captura sugerida — Paso 2).
--
-- Una fila por sugerencia que la plataforma genera para una solicitud a partir
-- del contenido extraído de su evidencia más reciente (evidencias_contenido).
-- Numérica (Paso 2): cifra, unidad, periodo, fuente exacta, cita literal,
-- candidatos alternos, conversión propuesta y, si la confianza fue baja, la
-- segunda opinión. De texto (Paso 3): extracto y cobertura.
--
-- ESTADOS. `sugerida` es la única que se muestra. `fallida` es una sugerencia
-- sin fuente localizable en el contenido: se registra (costo y motivo) y NO se
-- muestra (encargo §3). `obsoleta` la deja una versión nueva de la evidencia.
-- `confirmada` / `corregida` / `rechazada` las escribe la decisión del Paso 4,
-- que será una función SECURITY DEFINER que rechaza al auditor explícitamente;
-- las columnas de la decisión se crean aquí, vacías, para no partir la tabla.
--
-- QUIÉN ESCRIBE: la cola de lectura con service_role (lib/evidencias/cola.ts).
-- Ningún usuario con sesión escribe directo. QUIÉN LEE: quien puede ver la
-- solicitud (misma regla que la evidencia y su contenido).
--
-- Una sugerida viva por solicitud como máximo (índice único parcial): la nueva
-- deja obsoleta a la anterior antes de insertarse.
--
-- Aditiva: tipo nuevo, tabla nueva. Idempotente. Termina con
-- fn_aplicar_barrera_auditor() (CLAUDE.md §3).
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'estado_sugerencia' and typnamespace = 'public'::regnamespace) then
    create type public.estado_sugerencia as enum (
      'sugerida',    -- visible, sin decidir
      'confirmada',  -- se aceptó tal cual (Paso 4)
      'corregida',   -- se aceptó con otro valor (Paso 4)
      'rechazada',   -- no se aceptó (Paso 4)
      'obsoleta',    -- llegó una versión nueva de la evidencia
      'fallida'      -- sin fuente localizable o sin respuesta usable; no se muestra
    );
  end if;
end $$;

create table if not exists public.sugerencias_captura (
  id                uuid primary key default gen_random_uuid(),
  solicitud_id      uuid not null references public.solicitudes (id) on delete cascade,
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  evidencia_id      uuid not null references public.evidencias (id) on delete cascade,
  contenido_id      uuid not null references public.evidencias_contenido (id) on delete cascade,
  evidencia_version integer not null,
  tipo              text not null check (tipo in ('numerica', 'texto')),
  estado            public.estado_sugerencia not null default 'sugerida',
  -- Numérica: la cifra como la reporta el documento, con su unidad y periodo.
  valor             numeric,
  unidad            text,
  periodo           text,
  -- {tipo: celda|pagina|parrafo|tabla|imagen, hoja?, celda?, pagina?, parrafo?, tabla?, fila?, columna?}
  fuente            jsonb,
  cita              text,
  -- Si la solicitud espera otra unidad: {valor, unidad, factor, origen: tabla|modelo, explicacion}.
  conversion        jsonb,
  -- Texto (Paso 3).
  extracto          text,
  cobertura         text,
  -- Alternativas ordenadas, cada una con la misma forma que la principal y su verificación.
  candidatos        jsonb not null default '[]'::jsonb,
  confianza         text check (confianza in ('alta', 'media', 'baja')),
  motivo            text,
  -- Respuesta de Fable 5.1 cuando la confianza fue baja: {modelo, coincide, principal, costo_usd, ...}.
  segunda_opinion   jsonb,
  modelo            text,
  prompt_version    text,
  tokens_entrada    integer not null default 0,
  tokens_salida     integer not null default 0,
  costo_usd         numeric(10, 4) not null default 0,
  error             text,
  -- Decisión (Paso 4).
  decidido_por      uuid references auth.users (id),
  decidido_en       timestamptz,
  valor_final       numeric,
  unidad_final      text,
  motivo_rechazo    text,
  created_at        timestamptz not null default now()
);

comment on table public.sugerencias_captura is
  'Sugerencias de valor o extracto generadas a partir del contenido extraído de la evidencia. Las escribe la cola de lectura con service_role; la decisión (Paso 4) va por función. Solo `sugerida` se muestra; `fallida` es sin fuente localizable.';

create unique index if not exists sugerencias_captura_viva_idx
  on public.sugerencias_captura (solicitud_id) where estado = 'sugerida';
create index if not exists sugerencias_captura_solicitud_idx on public.sugerencias_captura (solicitud_id, created_at);
create index if not exists sugerencias_captura_tenant_idx on public.sugerencias_captura (tenant_id, created_at);
create index if not exists sugerencias_captura_contenido_idx on public.sugerencias_captura (contenido_id);

alter table public.sugerencias_captura enable row level security;

drop policy if exists sugerencias_captura_select on public.sugerencias_captura;
create policy sugerencias_captura_select on public.sugerencias_captura
  for select to authenticated
  using (public.fn_puede_ver_solicitud(solicitud_id));

-- Sin escritura para usuarios con sesión: ni grant ni política.
revoke insert, update, delete on public.sugerencias_captura from authenticated, anon;
drop policy if exists sugerencias_captura_no_insert on public.sugerencias_captura;
create policy sugerencias_captura_no_insert on public.sugerencias_captura
  as restrictive for insert to authenticated with check (false);
drop policy if exists sugerencias_captura_no_update on public.sugerencias_captura;
create policy sugerencias_captura_no_update on public.sugerencias_captura
  as restrictive for update to authenticated using (false);
drop policy if exists sugerencias_captura_no_delete on public.sugerencias_captura;
create policy sugerencias_captura_no_delete on public.sugerencias_captura
  as restrictive for delete to authenticated using (false);

-- Grants explícitos sobre ESTA tabla (una tabla nueva no hereda nada en este
-- proyecto). La cola inserta sugerencias y deja obsoletas las anteriores; no
-- borra. No se toca ningún grant de tablas existentes.
grant select on public.sugerencias_captura to authenticated;
grant select, insert, update on public.sugerencias_captura to service_role;

select public.fn_aplicar_barrera_auditor();
