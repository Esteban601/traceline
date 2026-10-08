-- =============================================================================
-- hechos.tipo + 'tramite' (encargo 2026-10-06, suplemento-calidad — Paso 5c,
-- decisión de Esteban del 8 de octubre de 2026).
--
-- Los acuerdos de trámite de un acta —solicitar informes, designar delegados,
-- aprobar el orden del día, convocar, formalizar acuerdos— entran al libro con
-- tipo «tramite» y quedan fuera del documento salvo que un subrequisito lo pida.
-- Publicado, «el Comité solicitó un informe conjunto» (bloque 17) parecía el
-- único control del proceso (tercera revisión externa, B).
-- Aditiva: CHECK sustituido por uno más amplio.
-- =============================================================================

alter table public.hechos drop constraint if exists hechos_tipo_check;
alter table public.hechos
  add constraint hechos_tipo_check
  check (tipo in ('cifra', 'fecha', 'nombre', 'frecuencia', 'responsable', 'composicion', 'proceso', 'politica', 'otro', 'tramite'));

select public.fn_aplicar_barrera_auditor();
