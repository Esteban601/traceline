-- =============================================================================
-- Libro de hechos estable y decisiones de una sola instancia (encargo
-- 2026-10-06, suplemento-calidad — Paso 5b, segunda revisión externa del 7 de
-- octubre de 2026).
--
-- hechos:
--   · rango_fuente + 'narrativo' (CHECK sustituido por uno más amplio): la Carta
--     de la Dirección y los textos editoriales; no sostienen una afirmación solos.
--   · oracion: la oración de la fuente de la que sale el hecho, partida por código
--     (`<fuente>#<n>`); es su identidad para comparar dos corridas del libro.
--   · alcance: clima / sostenibilidad_general / generico. Con E5 vigente, lo que
--     no es clima queda fuera del libro (descartado, con su motivo).
--   · veredicto y conciliacion: la contradicción la decide el libro una vez
--     —excluyente, compatible o secuencia— y, si es compatible, con la redacción
--     conciliada que usan todos los bloques.
-- documentos_bloques.anclas: para cada oración del texto, los hechos que la
-- sostienen ([h12] en modo revisión; el texto publicable no las lleva).
-- Aditiva: CHECK ampliado, columnas nullable.
-- =============================================================================

alter table public.hechos drop constraint if exists hechos_rango_fuente_check;
alter table public.hechos
  add constraint hechos_rango_fuente_check check (rango_fuente in ('validado', 'perfil', 'adjunto', 'narrativo'));

alter table public.hechos add column if not exists oracion text;
alter table public.hechos add column if not exists alcance text check (alcance in ('clima', 'sostenibilidad_general', 'generico'));
alter table public.hechos add column if not exists veredicto text check (veredicto in ('excluyente', 'compatible', 'secuencia'));
alter table public.hechos add column if not exists conciliacion text;

comment on column public.hechos.oracion is 'Oración de la fuente (partida por código) de la que sale el hecho: su identidad entre corridas del libro.';
comment on column public.hechos.alcance is 'clima / sostenibilidad_general / generico. Con E5 vigente, lo que no es clima se descarta.';
comment on column public.hechos.veredicto is 'Decisión del libro sobre su grupo de contradicción: excluyente (marcador y nota), compatible o secuencia (se redacta conciliado).';
comment on column public.hechos.conciliacion is 'Redacción conciliada del grupo cuando el veredicto es compatible o secuencia; la usan todos los bloques.';

alter table public.documentos_bloques add column if not exists anclas jsonb;
comment on column public.documentos_bloques.anclas is
  'Por oración del texto, los hechos que la sostienen: [{oracion, hechos[]}]. Se muestran en la revisión; el texto publicable no las lleva.';

select public.fn_aplicar_barrera_auditor();
