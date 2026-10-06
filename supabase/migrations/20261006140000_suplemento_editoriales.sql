-- =============================================================================
-- Selección de bloques editoriales del Suplemento (encargo
-- 2026-10-06-suplemento-calidad, Paso 1).
--
-- Los 40 bloques se clasifican en normativos (siempre van) y editoriales
-- (recomendados, encendidos por defecto; opcionales, apagados). La clasificación
-- vive en el código (lib/suplemento/bloques.ts, con el párrafo de respaldo); aquí
-- solo se guarda QUÉ editoriales lleva cada documento.
--
--   · documentos_generados.editoriales_incluidos: claves de los editoriales
--     seleccionados. NULL = documento anterior a la selección, que llevaba los 40.
--   · Estado `no_seleccionado` en documentos_bloques: el editorial que el
--     documento no lleva. Conserva su fila —y su texto, si lo tenía— para que
--     apagar un editorial en una regeneración no borre lo que ya se había escrito;
--     el Word, el índice y el semáforo lo saltan como a `no_aplica`.
--
-- Aditiva: columna nullable y un CHECK sustituido por uno más amplio
-- (CLAUDE.md §3). No crea tablas; la llamada a la barrera va igual.
-- =============================================================================

alter table public.documentos_generados
  add column if not exists editoriales_incluidos text[];

comment on column public.documentos_generados.editoriales_incluidos is
  'Claves de los bloques editoriales que lleva el documento. NULL = documento anterior a la selección (llevaba los 40).';

alter table public.documentos_bloques
  drop constraint if exists documentos_bloques_estado_chk;

alter table public.documentos_bloques
  add constraint documentos_bloques_estado_chk
  check (estado in (
    'en_cola',
    'generando',
    'no_aplica',
    'no_seleccionado',
    'pendiente_adjunto',
    'error',
    'borrador',
    'en_revision',
    'aprobado'
  ));

select public.fn_aplicar_barrera_auditor();
