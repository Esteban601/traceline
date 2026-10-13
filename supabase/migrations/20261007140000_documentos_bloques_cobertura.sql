-- =============================================================================
-- Cobertura por subrequisito de cada bloque (encargo 2026-10-06,
-- suplemento-calidad — Paso 5, punto 3).
--
-- Desde el libro de hechos, cada bloque devuelve, por cada requisito que le toca,
-- si quedó cubierto, parcial, pendiente o asignado a otro bloque, con los hechos
-- que lo sostienen. El código lo valida antes de guardar. La revisión pasa de
-- «leer y recordar la norma» a verificar una tabla (revisión externa del 7 de
-- octubre de 2026).
--   · documentos_bloques.cobertura: [{codigo, estado, bloque, hechos[], comentario}].
--   · documentos_bloques.libro_id: el libro de hechos del que salió el texto.
-- Aditiva: dos columnas nullable.
-- =============================================================================

alter table public.documentos_bloques add column if not exists cobertura jsonb;
alter table public.documentos_bloques add column if not exists libro_id uuid references public.libros_hechos (id) on delete set null;

comment on column public.documentos_bloques.cobertura is
  'Por requisito del bloque: cubierto / parcial / pendiente / asignado a otro bloque, con los hechos que lo sostienen. Validado por código (encargo suplemento-calidad, Paso 5).';
comment on column public.documentos_bloques.libro_id is
  'Libro de hechos del que se generó el texto (null = generado sin libro).';

select public.fn_aplicar_barrera_auditor();
