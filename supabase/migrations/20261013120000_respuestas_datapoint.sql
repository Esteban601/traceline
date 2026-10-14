-- =============================================================================
-- Respuestas por datapoint para el Excel de taxonomía y el Formato electrónico
-- NIIF S1/S2 (encargo 2026-10-13-excel-respuestas-narrativas, Paso 2; tabla
-- aprobada por Esteban en el Paso 0).
--
-- UNA FILA POR CLAVE Y DOCUMENTO APROBADO. `destino` dice a qué Excel va:
--   · taxonomia — clave = código del catálogo (`datapoints_taxonomia.codigo`,
--     verbatim); respuesta de hasta cuatro oraciones con remisión a la sección;
--   · formato   — clave = código del datapoint que alimenta conceptos text o
--     text block del Formato electrónico; hasta seis oraciones y 900 caracteres.
-- `estado`: respuesta, pendiente (con el marcador [Pendiente: …]) o no_aplica.
-- `origen`: modelo (desde el bloque aprobado y sus hechos), captura (valor
-- confirmado, sin modelo), bloque (oraciones ancladas del bloque aprobado, sin
-- modelo) o regla (no aplica / pendiente decididos por código).
--
-- SOLO DE DOCUMENTOS APROBADOS. Se generan al aprobar; aprobar un documento
-- nuevo del mismo reporte reemplaza las del anterior (los Excel leen siempre el
-- último aprobado). Procedencia: bloque y versión aprobada del bloque, hechos
-- citados, modelo, versión de prompt, tokens y costo.
--
-- QUIÉN LEE: staff todo; el administrador del cliente y el auditor, las de su
-- emisora (el auditor descarga el Excel de taxonomía, y estas filas solo existen
-- para documentos aprobados). NADIE ESCRIBE CON SESIÓN: las escribe el servidor
-- con service role al aprobar. Termina con la barrera del auditor.
--
-- Estado de la generación en el documento, con el molde del cierre:
-- respuestas_estado en_cola → ejecutando → listo | error.
--
-- ADITIVA: tabla nueva y columnas nullable.
-- =============================================================================

create table if not exists public.respuestas_datapoint (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants (id) on delete cascade,
  reporte_id              uuid not null references public.reportes (id) on delete cascade,
  documento_id            uuid not null references public.documentos_generados (id) on delete cascade,
  version_documento       integer not null,
  destino                 text not null check (destino in ('taxonomia', 'formato')),
  clave                   text not null,
  tipo_campo              text not null default 'text',
  estado                  text not null check (estado in ('respuesta', 'pendiente', 'no_aplica')),
  origen                  text not null check (origen in ('modelo', 'captura', 'bloque', 'regla')),
  texto                   text,
  valor                   jsonb,
  bloque                  integer,
  bloque_version          integer,
  hechos                  jsonb not null default '[]'::jsonb,
  notas                   jsonb not null default '[]'::jsonb,
  modelo                  text,
  prompt_version          text,
  tokens_entrada          integer not null default 0,
  tokens_cache_escritura  integer not null default 0,
  tokens_cache_lectura    integer not null default 0,
  tokens_salida           integer not null default 0,
  costo_usd               numeric(10, 4) not null default 0,
  created_at              timestamptz not null default now(),
  unique (documento_id, destino, clave)
);

comment on table public.respuestas_datapoint is
  'Respuesta por datapoint (taxonomía) o por datapoint de concepto text/text block (Formato electrónico), desde el documento aprobado del Suplemento. Solo la escribe el servidor (encargo 2026-10-13, Paso 2).';
comment on column public.respuestas_datapoint.hechos is
  'Ids (uuid) de los hechos del libro que sostienen la respuesta.';
comment on column public.respuestas_datapoint.notas is
  'Observaciones de los validadores (glosario aplicado, reintento, respaldo por oraciones del bloque).';

create index if not exists respuestas_datapoint_reporte_idx
  on public.respuestas_datapoint (reporte_id, destino);

alter table public.respuestas_datapoint enable row level security;

grant select on public.respuestas_datapoint to authenticated;
grant all on public.respuestas_datapoint to service_role;

drop policy if exists respuestas_datapoint_staff_select on public.respuestas_datapoint;
create policy respuestas_datapoint_staff_select on public.respuestas_datapoint
  for select to authenticated using (public.fn_is_staff());
drop policy if exists respuestas_datapoint_tenant_select on public.respuestas_datapoint;
create policy respuestas_datapoint_tenant_select on public.respuestas_datapoint
  for select to authenticated
  using ((public.fn_is_admin_cliente() or public.fn_is_auditor()) and tenant_id = public.fn_current_tenant());

alter table public.documentos_generados
  add column if not exists respuestas_estado text;
alter table public.documentos_generados
  add column if not exists respuestas_resultado jsonb;
alter table public.documentos_generados
  add column if not exists respuestas_actualizado_en timestamptz;

alter table public.documentos_generados
  drop constraint if exists documentos_generados_respuestas_estado_check;
alter table public.documentos_generados
  add constraint documentos_generados_respuestas_estado_check
  check (respuestas_estado is null or respuestas_estado in ('en_cola', 'ejecutando', 'listo', 'error'));

comment on column public.documentos_generados.respuestas_estado is
  'Generación de respuestas por datapoint: en_cola → ejecutando → listo | error (null: nunca se generaron).';
comment on column public.documentos_generados.respuestas_resultado is
  'Resultado de la última generación de respuestas: {reserva, conteos, costo_usd} o {error}.';

select public.fn_aplicar_barrera_auditor();
