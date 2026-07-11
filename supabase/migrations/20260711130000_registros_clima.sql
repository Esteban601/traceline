-- =============================================================================
-- Fase 3, Sprint 2 — rubro_clave (detector de discrepancias refinado) +
-- registro de riesgos y oportunidades climáticos.
--
-- LEY DE LA CASA: toda tabla nueva incluye sus GRANTS explícitos. El grant
-- "on all tables" de la migración inicial es puntual, no futuro.
-- =============================================================================

-- 1. rubro_clave en solicitudes ------------------------------------------------
--    Dos solicitudes con el MISMO rubro_clave capturan el mismo concepto del
--    mundo real. El detector de discrepancias (lib/discrepancias.ts) solo compara
--    capturas entre solicitudes que comparten rubro_clave (+ misma unidad y
--    periodo). Sin rubro_clave => nunca participa (p. ej. el desglose GEI por
--    categoría, que son conceptos distintos y no deben cuadrar entre sí).
alter table public.solicitudes add column rubro_clave text;

comment on column public.solicitudes.rubro_clave is
  'Concepto compartido para detección de discrepancias entre áreas. Dos solicitudes con el mismo rubro_clave (+ misma unidad y periodo) deben cuadrar; valores distintos = discrepancia. NULL = no participa.';

create index solicitudes_rubro_idx on public.solicitudes (rubro_clave)
  where rubro_clave is not null;

-- 2. registros_clima -----------------------------------------------------------
--    Riesgos (físico/transición) y oportunidades climáticos de un reporte.
create table public.registros_clima (
  id                 uuid primary key default gen_random_uuid(),
  reporte_id         uuid not null references public.reportes (id) on delete cascade,
  tipo               text not null
                       check (tipo in ('riesgo_fisico', 'riesgo_transicion', 'oportunidad')),
  nombre             text not null,
  descripcion        text,
  horizonte_temporal text,
  orden              int not null default 0,
  activo             boolean not null default true,
  created_at         timestamptz not null default now()
);

create index registros_clima_reporte_idx on public.registros_clima (reporte_id);

comment on table public.registros_clima is
  'Riesgos físicos/de transición y oportunidades climáticos (NIIF S2 10 / 29(b) / 30 / 29(d)). Solo staff (RLS). No se borran: se desactivan (activo=false) por trazabilidad.';

-- 3. registros_clima_valores (APPEND ONLY) -------------------------------------
--    Valores anuales por registro. Correcciones = filas nuevas; la vigente para
--    un (registro, ejercicio) es la de created_at más reciente.
create table public.registros_clima_valores (
  id                 uuid primary key default gen_random_uuid(),
  registro_id        uuid not null references public.registros_clima (id) on delete cascade,
  ejercicio          int not null,
  cantidad_activos   numeric,
  porcentaje         numeric,
  capital_desplegado numeric,
  notas              text,
  capturado_por      uuid references public.perfiles_usuario (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index registros_clima_valores_registro_idx
  on public.registros_clima_valores (registro_id, ejercicio, created_at desc);

comment on table public.registros_clima_valores is
  'APPEND ONLY: valores anuales de un registro de clima. La fila vigente por (registro, ejercicio) es la de created_at más reciente; las anteriores quedan como historial de correcciones.';

-- 4. GRANTS (LEY DE LA CASA) ---------------------------------------------------
grant select, insert, update, delete on public.registros_clima         to authenticated;
grant select, insert, update, delete on public.registros_clima_valores to authenticated;
grant select on public.registros_clima, public.registros_clima_valores to service_role;

-- 5. RLS — internos de IRStrat: solo staff (patrón mapeo_solicitud_datapoint) --
alter table public.registros_clima         enable row level security;
alter table public.registros_clima_valores enable row level security;

create policy registros_clima_staff_all on public.registros_clima
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

create policy registros_clima_valores_staff_all on public.registros_clima_valores
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());
