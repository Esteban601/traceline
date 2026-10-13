-- =============================================================================
-- hechos.veredicto + 'por_conciliar' (encargo 2026-10-06, suplemento-calidad —
-- cierre del Paso 5b, decisión de Esteban del 7 de octubre de 2026).
--
-- Un grupo de contradicción que los tres votos del libro no deciden de forma
-- unánime (el caso «Alcance 3 frente a perímetro»: excluyente en una corrida, nada
-- en la otra) no es excluyente ni compatible: es inestable, y el revisor debe
-- saberlo. El hecho sigue vigente; el bloque no marca pendiente ni elige versión
-- y deja la nota «por conciliar».
-- Aditiva: CHECK sustituido por uno más amplio.
-- =============================================================================

alter table public.hechos drop constraint if exists hechos_veredicto_check;
alter table public.hechos
  add constraint hechos_veredicto_check check (veredicto in ('excluyente', 'compatible', 'secuencia', 'por_conciliar'));

comment on column public.hechos.veredicto is
  'Decisión del libro sobre su grupo: excluyente (marcador y nota), compatible o secuencia (se redacta conciliado), por_conciliar (los votos no fueron unánimes: inestable; nota al revisor, sin marcador).';

select public.fn_aplicar_barrera_auditor();
