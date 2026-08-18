-- =============================================================================
-- Extensión VERT del catálogo de datapoints.
--
-- El catálogo tenía 91 datapoints, TODOS de la taxonomía NIIF S1/S2. El proceso
-- real de Grupo Carso pide cuatro conceptos que la norma no cubre como datapoint
-- propio (plantilla y rotación, capacitación, agua, residuos) y que la firma
-- decidió recabar igual ("dudosas aprobadas" del mapeo de import).
--
-- Se incorporan al MISMO catálogo para que compartan el motor de cobertura y de
-- mapeo, pero con una columna `marco` que los separa sin ambigüedad: la UI los
-- presenta en una sección propia 'Extensión VERT'. NUNCA se muestran como parte
-- de la norma: son requerimientos de la firma, y confundirlos sería atribuirle a
-- NIIF S1/S2 algo que no dice.
-- =============================================================================

alter table public.datapoints_taxonomia
  add column marco text not null default 'NIIF';

comment on column public.datapoints_taxonomia.marco is
  'Origen del datapoint: NIIF (taxonomía oficial S1/S2) o VERT (extensión propia de la firma). La UI los separa; nunca se presenta un VERT como parte de la norma.';

alter table public.datapoints_taxonomia
  add constraint datapoints_marco_chk check (marco in ('NIIF', 'VERT'));

create index datapoints_marco_idx on public.datapoints_taxonomia (marco);

-- Los 91 preexistentes son de la norma (el default ya los dejó en 'NIIF'; queda
-- explícito para que la intención no dependa de un default).
update public.datapoints_taxonomia set marco = 'NIIF' where marco is distinct from 'NIIF';

-- -----------------------------------------------------------------------------
-- Los 4 datapoints de la extensión. Códigos, descripciones y pilar VERBATIM de
-- la hoja 'Datapoints VERT' del mapeo de import.
--
-- `norma` y `pilar` son enums de la taxonomía NIIF y no admiten un valor propio;
-- se usa el que mejor corresponde (S1 / metricas) y el marco es lo que los
-- distingue. seccion_indice lleva la etiqueta que la UI agrupa.
-- -----------------------------------------------------------------------------
insert into public.datapoints_taxonomia
  (codigo, norma, pilar, descripcion, seccion_indice, version_taxonomia, marco, activo)
values
  ('VERT-SOC-01', 'S1', 'metricas',
   'Plantilla total y rotación por género, edad y tipo de colaborador',
   'Extensión VERT', '2025', 'VERT', true),
  ('VERT-SOC-02', 'S1', 'metricas',
   'Capacitación: horas, temáticas y cobertura',
   'Extensión VERT', '2025', 'VERT', true),
  ('VERT-AMB-01', 'S1', 'metricas',
   'Agua: consumo, tratamiento y descarga (m³)',
   'Extensión VERT', '2025', 'VERT', true),
  ('VERT-AMB-02', 'S1', 'metricas',
   'Residuos por tipo y manejo (kg/ton)',
   'Extensión VERT', '2025', 'VERT', true)
on conflict (codigo, version_taxonomia) do nothing;

-- NO se crean rubros de taxonomía para estos cuatro, a propósito. Un rubro es
-- ÚNICO por reporte porque identifica una celda de la plantilla oficial, y estos
-- conceptos se recaban POR DIVISIÓN (5 solicitudes de agua, 5 de residuos…).
-- Las solicitudes VERT se ligan a su datapoint por mapeo_solicitud_datapoint,
-- que es N:N y admite varias solicitudes por datapoint — que es justo lo que el
-- proceso real necesita. Los datapoints VERT tampoco tienen celda en la
-- plantilla oficial: no son de la norma.
