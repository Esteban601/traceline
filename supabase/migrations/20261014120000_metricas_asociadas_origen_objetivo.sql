-- =============================================================================
-- Métricas asociadas por riesgo y origen del objetivo (encargo 2026-10-13-excel-
-- respuestas-narrativas; tercera lectura del Formato electrónico, decisión de
-- Esteban del 14 de octubre de 2026).
--
--   · registros_clima.metricas_asociadas — qué métricas intersectoriales de NIIF
--     S2 29 lleva cada riesgo u oportunidad en las métricas de NIIF S1 46–50
--     (subconjunto de 29(a)–(e), como 'a'…'e'). Lo elige el consultor; vacío =
--     regla por defecto (transición → b, e; físico → c, e; oportunidad → d, e).
--   · objetivos.origen_objetivo — si el objetivo lo fijó la emisora o lo exige
--     una ley o regulación (Formato electrónico, filas de NIIF S2 33).
--
-- ADITIVA: dos columnas nullable con CHECK sobre las columnas nuevas; la barrera
-- es idempotente.
-- =============================================================================

alter table public.registros_clima add column if not exists metricas_asociadas text[];
alter table public.registros_clima drop constraint if exists registros_clima_metricas_asociadas_check;
alter table public.registros_clima
  add constraint registros_clima_metricas_asociadas_check
  check (metricas_asociadas is null or metricas_asociadas <@ array['a', 'b', 'c', 'd', 'e']::text[]);
comment on column public.registros_clima.metricas_asociadas is 'Métricas de NIIF S2 29 (a)–(e) asociadas al riesgo u oportunidad en las métricas de NIIF S1 46–50; vacío = regla por defecto por tipo.';

alter table public.objetivos add column if not exists origen_objetivo text;
alter table public.objetivos drop constraint if exists objetivos_origen_objetivo_check;
alter table public.objetivos
  add constraint objetivos_origen_objetivo_check
  check (origen_objetivo is null or origen_objetivo in ('Fijado por la Emisora', 'Requerido por ley o regulación'));
comment on column public.objetivos.origen_objetivo is 'Si el objetivo lo fijó la emisora o lo exige una ley o regulación (NIIF S2 33).';

select public.fn_aplicar_barrera_auditor();
