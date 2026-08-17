-- =============================================================================
-- Export de taxonomía parametrizado por cliente/reporte.
--
-- PROBLEMA QUE RESUELVE: `mapeo_export` ataba cada celda de valor a una
-- SOLICITUD concreta (las del seed de Empresa Demo). El mapeo era, en los
-- hechos, propiedad del demo: un cliente nuevo no tenía celdas y no podía
-- generar su Excel — no tenía el producto.
--
-- DISEÑO: el mapeo pasa a ser una DEFINICIÓN REUTILIZABLE de la plantilla, y la
-- resolución a datos ocurre en tiempo de export contra el reporte elegido.
--
--   1. `rubros_taxonomia` — catálogo GLOBAL de rubros canónicos (GEI Alcance 1/2/3
--      y las 15 categorías de Alcance 3 del GHG Protocol). Vive con el mapeo, no
--      con el tenant: son categorías de la norma, iguales para toda emisora.
--
--   2. `mapeo_export` referencia (datapoint_id, rubro_clave, anio_offset) en vez
--      de (solicitud_id, ejercicio). El offset es RELATIVO al ejercicio del
--      reporte (0 = el del reporte, 1 = el anterior); con un año absoluto el
--      mapeo solo habría servido para reportes 2025.
--
--   3. `solicitudes.rubro_taxonomia` es la contraparte del lado del cliente: el
--      export busca, entre las solicitudes DEL REPORTE, la que lleva ese rubro.
--      Es ÚNICA por reporte, así que la resolución es determinista.
--
--      Por qué el join es por rubro y no por la liga a datapoints: el datapoint
--      es 1→N (las 15 categorías de Alcance 3 comparten 'NIIF S2 29 (a)(vi)(1)
--      EI12', y los tres alcances comparten '29 (a)(i)'), así que no identifica
--      la celda. El datapoint se conserva en la fila como ancla de taxonomía.
--
--      OJO — no confundir con `solicitudes.rubro_clave`: aquel dice "estas dos
--      áreas capturan el mismo concepto y deben cuadrar" (detector de
--      discrepancias) y es texto libre. Este es la llave del mapeo a la
--      plantilla oficial y está acotado al catálogo.
--
--   4. `plantilla_solicitudes.rubro_taxonomia` propaga el rubro al clonar una
--      plantilla: es lo que hace que el PRIMER export de un cliente nuevo salga
--      lleno en vez de vacío.
--
-- El demo debe exportar EXACTAMENTE igual que antes: el backfill traduce sus
-- filas actuales a la forma nueva por posición de celda (que es como se
-- construyeron leyendo la plantilla real).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Catálogo de rubros canónicos
-- -----------------------------------------------------------------------------
create table public.rubros_taxonomia (
  clave      text primary key,
  etiqueta   text not null,
  grupo      text not null,
  orden      int  not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  constraint rubros_taxonomia_clave_formato check (clave ~ '^[a-z0-9]+(_[a-z0-9]+)*$')
);

comment on table public.rubros_taxonomia is
  'Rubros canónicos de la taxonomía (categorías GEI del GHG Protocol). Globales de la norma: viven con el mapeo de export, no con el tenant.';
comment on column public.rubros_taxonomia.grupo is
  'Agrupación para la UI: gei_alcances | gei_alcance3.';

create index rubros_taxonomia_grupo_idx on public.rubros_taxonomia (grupo, orden);

alter table public.rubros_taxonomia enable row level security;

-- Las tablas nuevas NO quedan cubiertas por el grant "on all tables" de la
-- migración inicial (ese grant es puntual, no futuro): se otorgan aquí.
grant select, insert, update, delete on public.rubros_taxonomia to authenticated;
grant select on public.rubros_taxonomia to service_role;

-- Catálogo interno de IRStrat, como datapoints_taxonomia y mapeo_export.
create policy rubros_taxonomia_staff_all on public.rubros_taxonomia
  for all to authenticated
  using (public.fn_is_staff())
  with check (public.fn_is_staff());

-- Las etiquetas de las 15 categorías son VERBATIM de la plantilla oficial (las
-- mismas que ya se escriben en la columna A de la hoja 29(a)(vi)(1)).
insert into public.rubros_taxonomia (clave, etiqueta, grupo, orden) values
  ('gei_alcance_1',       'Alcance 1', 'gei_alcances', 1),
  ('gei_alcance_2',       'Alcance 2', 'gei_alcances', 2),
  ('gei_alcance_3_total', 'Alcance 3', 'gei_alcances', 3),
  ('gei_a3_cat_01', 'Categoría 1-Bienes y servicios adquiridos', 'gei_alcance3', 1),
  ('gei_a3_cat_02', 'Categoría 2-Bienes de capital', 'gei_alcance3', 2),
  ('gei_a3_cat_03', 'Categoría 3-Actividades relacionadas con el combustible y la energía no incluidas en las emisiones de gases de efecto invernadero de Alcance 1 o Alcance 2', 'gei_alcance3', 3),
  ('gei_a3_cat_04', 'Categoría 4-Transporte y distribución', 'gei_alcance3', 4),
  ('gei_a3_cat_05', 'Categoría 5-Residuos generados en las operaciones', 'gei_alcance3', 5),
  ('gei_a3_cat_06', 'Categoría 6-Viajes de negocios', 'gei_alcance3', 6),
  ('gei_a3_cat_07', 'Categoría 7: Desplazamientos de los empleados', 'gei_alcance3', 7),
  ('gei_a3_cat_08', 'Categoría 8-Activos en arrendamiento financiero', 'gei_alcance3', 8),
  ('gei_a3_cat_09', 'Categoría 9-Transporte y distribución', 'gei_alcance3', 9),
  ('gei_a3_cat_10', 'Categoría 10-Transformación de los productos vendidos', 'gei_alcance3', 10),
  ('gei_a3_cat_11', 'Categoría 11-Uso de los productos vendidos', 'gei_alcance3', 11),
  ('gei_a3_cat_12', 'Categoría 12-Tratamiento de los productos vendidos al final de su vida útil', 'gei_alcance3', 12),
  ('gei_a3_cat_13', 'Categoría 13-Activos arrendados en fases posteriores', 'gei_alcance3', 13),
  ('gei_a3_cat_14', 'Categoría 14-Franquicias', 'gei_alcance3', 14),
  ('gei_a3_cat_15', 'Categoría 15-Inversiones', 'gei_alcance3', 15);

-- -----------------------------------------------------------------------------
-- 2. Contraparte en solicitudes y plantillas
-- -----------------------------------------------------------------------------
alter table public.solicitudes
  add column rubro_taxonomia text references public.rubros_taxonomia (clave) on delete restrict;

comment on column public.solicitudes.rubro_taxonomia is
  'Rubro canónico que esta solicitud alimenta en la plantilla oficial (p. ej. gei_alcance_1). Único por reporte: es la llave con la que el export resuelve cada celda. NO confundir con rubro_clave, que es del detector de discrepancias.';

-- Determinismo del export: un reporte no puede tener dos solicitudes para el
-- mismo rubro (¿cuál llenaría la celda?).
create unique index solicitudes_rubro_taxonomia_ux
  on public.solicitudes (reporte_id, rubro_taxonomia)
  where rubro_taxonomia is not null;

alter table public.plantilla_solicitudes
  add column rubro_taxonomia text references public.rubros_taxonomia (clave) on delete restrict;

comment on column public.plantilla_solicitudes.rubro_taxonomia is
  'Rubro canónico que heredará la solicitud clonada. Es lo que hace que el primer export de un cliente nuevo salga lleno.';

-- -----------------------------------------------------------------------------
-- 3. mapeo_export: de (solicitud, año absoluto) a (rubro, año relativo)
-- -----------------------------------------------------------------------------
alter table public.mapeo_export
  add column rubro_clave text references public.rubros_taxonomia (clave) on delete restrict,
  add column anio_offset int;

comment on column public.mapeo_export.rubro_clave is
  'Rubro canónico de la celda. En export se resuelve contra la solicitud del reporte elegido que lleve este rubro.';
comment on column public.mapeo_export.anio_offset is
  'Años hacia atrás desde el ejercicio del REPORTE: 0 = ejercicio del reporte, 1 = el anterior. Relativo para que el mapeo sirva en cualquier ejercicio.';

-- Backfill de las filas existentes (staging). La correspondencia celda→rubro es
-- POSICIONAL porque así se construyó el mapeo: leyendo la plantilla real, una
-- fila por categoría en el orden impreso. En un `db reset` esto no encuentra
-- nada (el seed corre después y ya escribe la forma nueva).
with corr as (
  select 'NIIF S2 29(a)(i)'::text as hoja, 3 as fila, 'gei_alcance_1'::text as rubro
  union all select 'NIIF S2 29(a)(i)', 4, 'gei_alcance_2'
  union all select 'NIIF S2 29(a)(i)', 5, 'gei_alcance_3_total'
  union all
  select 'NIIF S2 29(a)(vi)(1)', 3 + n, 'gei_a3_cat_' || lpad(n::text, 2, '0')
  from generate_series(1, 15) as n
)
update public.solicitudes s
set rubro_taxonomia = corr.rubro
from public.mapeo_export m, corr
where m.solicitud_id = s.id
  and m.hoja = corr.hoja
  and nullif(regexp_replace(m.celda, '[^0-9]', '', 'g'), '')::int = corr.fila
  and s.rubro_taxonomia is null;

with corr as (
  select 'NIIF S2 29(a)(i)'::text as hoja, 3 as fila, 'gei_alcance_1'::text as rubro
  union all select 'NIIF S2 29(a)(i)', 4, 'gei_alcance_2'
  union all select 'NIIF S2 29(a)(i)', 5, 'gei_alcance_3_total'
  union all
  select 'NIIF S2 29(a)(vi)(1)', 3 + n, 'gei_a3_cat_' || lpad(n::text, 2, '0')
  from generate_series(1, 15) as n
)
update public.mapeo_export m
set rubro_clave = corr.rubro,
    anio_offset = r.ejercicio - m.ejercicio
from corr, public.solicitudes s
join public.reportes r on r.id = s.reporte_id
where m.solicitud_id = s.id
  and m.hoja = corr.hoja
  and nullif(regexp_replace(m.celda, '[^0-9]', '', 'g'), '')::int = corr.fila;

-- Si alguna fila de valor quedó sin traducir, el export saldría con huecos
-- silenciosos: mejor abortar la migración y revisarlo.
do $$
declare
  v_huerfanas int;
begin
  select count(*) into v_huerfanas
  from public.mapeo_export
  where solicitud_id is not null and (rubro_clave is null or anio_offset is null);

  if v_huerfanas > 0 then
    raise exception
      'Quedaron % filas de mapeo_export sin traducir a (rubro, anio_offset). Revisa la correspondencia posicional antes de migrar.',
      v_huerfanas;
  end if;
end $$;

-- Fuera la atadura a solicitudes concretas. Con esto también desaparece el
-- `on delete cascade`: borrar una solicitud ya no puede llevarse el mapeo.
alter table public.mapeo_export
  drop constraint mapeo_export_forma_chk,
  drop column solicitud_id,
  drop column ejercicio,
  add constraint mapeo_export_forma_chk check (
    etiqueta is not null
    or (rubro_clave is not null and anio_offset is not null)
  ),
  add constraint mapeo_export_anio_offset_chk check (
    anio_offset is null or anio_offset between 0 and 10
  );

create index mapeo_export_rubro_idx on public.mapeo_export (rubro_clave);

comment on table public.mapeo_export is
  'Mapeo celda↔dato de la plantilla oficial de taxonomía. DEFINICIÓN REUTILIZABLE: describe la plantilla (hoja, celda, rubro canónico, año relativo), no los datos de un cliente. La resolución a valores ocurre en export contra el reporte elegido.';
