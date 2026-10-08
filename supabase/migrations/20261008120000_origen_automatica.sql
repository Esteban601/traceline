-- =============================================================================
-- Origen «automatica» en el historial de bloques (encargo 2026-10-06,
-- suplemento-calidad — Paso 5c, tercera revisión externa).
--
-- El cierre de pendientes por código sustituye, sin llamar al modelo, el marcador
-- de un bloque por una remisión al bloque dueño que ya afirma ese hecho. Queda en
-- el historial como versión de origen «automatica»: no es una generación ni una
-- edición humana (no dispara la confirmación A6 al regenerar).
-- Aditiva: CHECK sustituidos por unos más amplios.
-- =============================================================================

alter table public.documentos_bloques drop constraint if exists documentos_bloques_origen_texto_check;
alter table public.documentos_bloques
  add constraint documentos_bloques_origen_texto_check
  check (origen_texto in ('generacion', 'edicion', 'literal', 'restauracion', 'automatica'));

alter table public.documentos_bloques_versiones drop constraint if exists documentos_bloques_versiones_origen_check;
alter table public.documentos_bloques_versiones
  add constraint documentos_bloques_versiones_origen_check
  check (origen in ('generacion', 'edicion', 'literal', 'restauracion', 'automatica'));

select public.fn_aplicar_barrera_auditor();
