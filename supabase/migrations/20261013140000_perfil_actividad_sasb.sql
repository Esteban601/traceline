-- =============================================================================
-- Actividad financiera y sector SASB en el Perfil del emisor (encargo
-- 2026-10-13-excel-respuestas-narrativas, Paso 4; revisión externa del Formato
-- electrónico, punto 3, aprobada por Esteban el 13 de octubre de 2026).
--
--   · actividades_financieras — en qué actividades participa la emisora: gestión
--     de activos, banca comercial, seguros (Formato electrónico, filas 339/340).
--     Las secciones de emisiones financiadas de una actividad en la que no
--     participa dicen «No aplica por actividad», con esta justificación;
--   · sector_sasb — sector(es) SASB de la emisora, con la etiqueta de la lista
--     del formato (filas 446/447).
--
-- ADITIVA: dos columnas nullable; la barrera es idempotente.
-- =============================================================================

alter table public.perfil_emisor add column if not exists actividades_financieras text[];
alter table public.perfil_emisor add column if not exists sector_sasb text[];

comment on column public.perfil_emisor.actividades_financieras is 'Actividades financieras en las que participa la emisora (gestión de activos, banca comercial, seguros); Formato electrónico, emisiones financiadas.';
comment on column public.perfil_emisor.sector_sasb is 'Sector(es) SASB de la emisora, con la etiqueta de la lista del Formato electrónico (p. ej. «[815200] Finanzas - Bancos comerciales (FN-CB)»).';

select public.fn_aplicar_barrera_auditor();
