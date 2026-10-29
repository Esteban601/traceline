-- =============================================================================
-- Cuestionario de GEI (encargo formato-respuesta-por-inciso, Fase 5; decisión 4 de
-- Esteban del Paso 0): «cambios en el enfoque de medición» de NIIF S2 29(a)(iii)(3).
--
-- Las preguntas viven en lib/cuestionarios.ts (hoja «S2 29(a)(iii)»); la base solo
-- guarda la respuesta. El CHECK de `hoja` admitía tres hojas: se sustituye por uno
-- más amplio con la cuarta (CLAUDE.md §3: sustituir un CHECK por uno más amplio
-- está permitido). Las filas existentes cumplen los dos.
--
-- ADITIVA en efecto: ningún valor antes válido deja de serlo. La llamada a la
-- barrera es idempotente y va aunque no se cree tabla.
-- =============================================================================

alter table public.cuestionarios_respuestas drop constraint if exists cuestionarios_respuestas_hoja_check;
alter table public.cuestionarios_respuestas add constraint cuestionarios_respuestas_hoja_check
  check (hoja in ('S2 22(b)(i)', 'S2 22(b)(ii)', 'S2 36(e)', 'S2 29(a)(iii)'));

select public.fn_aplicar_barrera_auditor();
