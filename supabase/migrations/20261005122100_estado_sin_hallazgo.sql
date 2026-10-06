-- =============================================================================
-- Estado `sin_hallazgo` para las sugerencias (encargo 2026-10-04, captura
-- sugerida — decisión al aprobar el Paso 3).
--
-- Se muestra en los dos tipos: «No se encontró la cifra en esta evidencia» o
-- «Esta evidencia no cubre el requisito», con la línea de qué falta. `fallida`
-- queda solo para errores técnicos y no se muestra.
--
-- En migración propia: Postgres no permite usar un valor de enum nuevo en la
-- misma transacción que lo agrega (CLAUDE.md §3). El índice que lo usa va en la
-- migración siguiente. Aditiva e idempotente.
-- =============================================================================

alter type public.estado_sugerencia add value if not exists 'sin_hallazgo' after 'sugerida';
