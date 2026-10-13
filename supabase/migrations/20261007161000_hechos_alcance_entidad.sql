-- =============================================================================
-- hechos.alcance + 'entidad' (encargo 2026-10-06, suplemento-calidad — Paso 5b).
--
-- La primera corrida del libro estable mandó a «generico» —y por tanto fuera
-- del libro— hechos que el suplemento sí necesita: quién es la emisora, su
-- perímetro, su cartera total (denominador de 29(d)) y la composición de su
-- Consejo. «entidad» los separa de lo genérico (cláusulas de estatutos y
-- formalidades que tendría cualquier emisora), que es lo único que se descarta
-- por alcance sin E5.
-- Aditiva: CHECK sustituido por uno más amplio.
-- =============================================================================

alter table public.hechos drop constraint if exists hechos_alcance_check;
alter table public.hechos
  add constraint hechos_alcance_check check (alcance in ('clima', 'entidad', 'sostenibilidad_general', 'generico'));

comment on column public.hechos.alcance is
  'clima / entidad / sostenibilidad_general / generico. «generico» se descarta siempre; con E5 vigente, también «sostenibilidad_general».';

select public.fn_aplicar_barrera_auditor();
