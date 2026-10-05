-- =============================================================================
-- Límite de 25 MB en el bucket `evidencias` (encargo 2026-10-04, captura
-- sugerida — Paso 4, subida directa con URL firmada).
--
-- Con la subida directa el archivo ya no pasa por la server action, así que el
-- límite tiene que estar donde el archivo llega: en el bucket. La firma solo se
-- emite si el tamaño declarado es de 25 MB o menos, y la acción que registra la
-- fila vuelve a medir el objeto; esto cierra el caso de una firma reutilizada
-- con un archivo mayor. 25 MB = 26 214 400 bytes, el mismo número que
-- lib/evidencias/limite-subida.ts.
--
-- Hace el storage MÁS restrictivo, nunca menos (CLAUDE.md §3). No toca los
-- objetos que ya existen. Solo baja el límite si hoy no hay uno o es mayor.
-- Idempotente. No crea tabla ni bucket.
-- =============================================================================

update storage.buckets
   set file_size_limit = 26214400
 where id = 'evidencias'
   and (file_size_limit is null or file_size_limit > 26214400);
