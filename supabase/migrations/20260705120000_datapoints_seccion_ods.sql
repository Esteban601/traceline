-- =============================================================================
-- Amplía datapoints_taxonomia con dos columnas del catálogo oficial NIIF S1/S2:
--   * seccion_indice: sección del índice del informe donde se ubica el datapoint.
--   * ods: Objetivo(s) de Desarrollo Sostenible asociado(s), si aplica.
-- Ambas provienen verbatim de la plantilla base de la firma
-- (catalogo_taxonomia_S1_S2.csv) y se pueblan desde el seed.
-- =============================================================================

alter table public.datapoints_taxonomia
  add column seccion_indice text,
  add column ods            text;

comment on column public.datapoints_taxonomia.seccion_indice is 'Sección del índice del informe donde se ubica el datapoint (catálogo oficial NIIF S1/S2).';
comment on column public.datapoints_taxonomia.ods is 'Objetivo(s) de Desarrollo Sostenible asociado(s) al datapoint, si aplica (catálogo oficial NIIF S1/S2).';
