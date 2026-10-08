-- =============================================================================
-- hechos.tipo + 'declaracion_negativa' (encargo 2026-10-06, suplemento-calidad —
-- añadido 12 de Esteban, 8 de octubre de 2026).
--
-- «No existen planes revelados en periodos anteriores», «no hace uso de C5»,
-- «ninguna revisión al objetivo en 2025», «no usa créditos de carbono» son hechos
-- que responden un requisito. La rúbrica externa encontró que se perdían al
-- regenerar (bloques 25, 30, 39 y 40 frente a septiembre): con su propio tipo, el
-- bloque no puede omitirlos.
-- Aditiva: CHECK sustituido por uno más amplio.
-- =============================================================================

alter table public.hechos drop constraint if exists hechos_tipo_check;
alter table public.hechos
  add constraint hechos_tipo_check
  check (tipo in ('cifra', 'fecha', 'nombre', 'frecuencia', 'responsable', 'composicion', 'proceso', 'politica', 'otro', 'tramite', 'declaracion_negativa'));

select public.fn_aplicar_barrera_auditor();
