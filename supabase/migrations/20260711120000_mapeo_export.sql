-- =============================================================================
-- Fase 3, Sprint 1 — Motor de llenado de la plantilla oficial de taxonomía.
--
-- mapeo_export: tabla de mapeo CELDA ↔ DATO para escribir la plantilla oficial
-- (Taxonomias NIIF S1 y S2). El mapeo VIVE EN BD, no hardcodeado: cuando la
-- plantilla cambie de layout, se actualiza con datos (INSERT/UPDATE), no con un
-- deploy del motor de export.
--
-- Cada fila describe UNA celda de UNA hoja. Dos formas (check las distingue):
--
--   * Celda de ETIQUETA — `etiqueta` no nula: el motor escribe ese texto literal
--     (p. ej. el nombre de la categoría, verbatim de la plantilla, o la unidad
--     'tCO2e'). Sin solicitud ni ejercicio.
--
--   * Celda de VALOR — `solicitud_id` + `ejercicio` no nulos: el motor escribe el
--     valor de la ÚLTIMA captura CONFIRMADA de esa solicitud para ese ejercicio,
--     PERO solo si la solicitud está en estado 'validado' (regla dura). Si no,
--     escribe en `celda_nota` la brecha ('Pendiente de validación en plataforma'
--     o 'Sin evidencia'). `datapoint_id` es informativo (trazabilidad al catálogo).
--
-- Se llena por seed (ver seed.sql §13) construido leyendo la plantilla real.
-- =============================================================================

create table public.mapeo_export (
  id           uuid primary key default gen_random_uuid(),
  hoja         text not null,                                    -- nombre exacto de la hoja, p. ej. 'NIIF S2 29(a)(i)'
  celda        text not null,                                    -- referencia A1, p. ej. 'C4'
  datapoint_id uuid references public.datapoints_taxonomia (id) on delete restrict,
  solicitud_id uuid references public.solicitudes (id)           on delete cascade,
  ejercicio    int,                                              -- año de la captura para celdas de valor (2025, 2024…)
  etiqueta     text,                                             -- texto literal para celdas de etiqueta
  celda_nota   text,                                             -- celda destino de la nota/brecha de la fila (p. ej. 'E3')
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  -- Cada fila es etiqueta O valor (con su ejercicio):
  constraint mapeo_export_forma_chk check (
    etiqueta is not null
    or (solicitud_id is not null and ejercicio is not null)
  )
);

-- Una celda se mapea una sola vez mientras esté activa.
create unique index mapeo_export_celda_ux on public.mapeo_export (hoja, celda) where activo;
create index mapeo_export_solicitud_idx on public.mapeo_export (solicitud_id);

comment on table public.mapeo_export is
  'Mapeo celda↔dato de la plantilla oficial de taxonomía (Fase 3). Vive en BD para actualizarse con datos cuando cambie el layout, no con deploy.';
comment on column public.mapeo_export.hoja is 'Nombre EXACTO de la hoja en la plantilla (.xlsx).';
comment on column public.mapeo_export.celda is 'Referencia de celda A1 (columna+fila), p. ej. C4.';
comment on column public.mapeo_export.etiqueta is 'Texto literal a escribir (categoría verbatim de la plantilla, unidad…). Celdas de etiqueta.';
comment on column public.mapeo_export.celda_nota is 'Celda de la columna Notas/Brechas de la fila; recibe la brecha cuando el valor no entra por no estar validado.';

-- RLS — mapeo interno de IRStrat: solo staff (mismo patrón que mapeo_solicitud_datapoint).
alter table public.mapeo_export enable row level security;

create policy mapeo_export_staff_all on public.mapeo_export
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());
