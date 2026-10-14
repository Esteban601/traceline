-- =============================================================================
-- Juicio de la emisora sobre las métricas por industria (encargo 2026-10-13-
-- excel-respuestas-narrativas, Paso 4; decisión de Esteban del 13 de octubre de
-- 2026). El Formato electrónico pregunta, para riesgos de transición, riesgos
-- físicos y oportunidades (filas 364, 387 y 410), si las métricas basadas en el
-- sector industrial podrían satisfacer el requerimiento total o parcialmente. Es
-- un juicio del emisor, no un dato derivable: se captura una vez en el Perfil y
-- se repite en las tres filas.
--
-- ADITIVA: una columna nullable con CHECK sobre la columna nueva; la barrera es
-- idempotente.
-- =============================================================================

alter table public.perfil_emisor add column if not exists metricas_industria text;

alter table public.perfil_emisor drop constraint if exists perfil_emisor_metricas_industria_check;
alter table public.perfil_emisor
  add constraint perfil_emisor_metricas_industria_check
  check (metricas_industria is null or metricas_industria in ('Sí, totalmente', 'Sí, parcialmente', 'No'));

comment on column public.perfil_emisor.metricas_industria is 'Si las métricas por industria (SASB) podrían satisfacer los requerimientos de NIIF S2 29(b)–(d): «Sí, totalmente», «Sí, parcialmente» o «No». Formato electrónico, filas 364, 387 y 410.';

select public.fn_aplicar_barrera_auditor();
