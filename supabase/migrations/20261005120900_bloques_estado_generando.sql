-- =============================================================================
-- documentos_bloques.estado: añade 'generando' y 'error'.
--
-- POR QUÉ 'generando'. Un bloque tarda entre 20 y 40 segundos y el router de
-- Heroku corta a los 30. La ruta deja de esperar: crea la fila en 'generando',
-- responde de inmediato, y la generación termina en after(). El cliente consulta
-- cada dos segundos. Sin un estado propio, un bloque a medio generar es
-- indistinguible de uno vacío, y el cliente no sabría si esperar o reintentar.
--
-- POR QUÉ 'error'. Hoy un fallo se guarda como 'borrador' sin texto, con el
-- motivo escondido en `pendientes`: para quien mira la lista, es igual que un
-- bloque que nadie ha generado. Con estado propio, el fallo se ve y se puede
-- reintentar.
--
-- NO ES ADITIVA EN SENTIDO ESTRICTO: sustituye un CHECK. Pero solo AMPLÍA lo
-- admitido —los tres valores anteriores siguen siendo válidos— así que ninguna
-- fila existente queda fuera y la migración no puede fallar por datos.
--
-- Idempotente: el DROP lleva IF EXISTS y el ADD usa un nombre fijo, así que
-- aplicarla dos veces deja el mismo CHECK.
-- =============================================================================

alter table public.documentos_bloques
  drop constraint if exists documentos_bloques_estado_chk;

alter table public.documentos_bloques
  add constraint documentos_bloques_estado_chk
  check (estado in ('borrador', 'generando', 'error', 'en_revision', 'aprobado'));

comment on column public.documentos_bloques.estado is
  'generando → borrador → en_revision → aprobado, o error. Un bloque en generando más de 3 minutos lo pasa a error el propio generador, con motivo "tiempo excedido", y queda reintentable.';

-- El cliente consulta los bloques de un documento cada dos segundos mientras
-- haya alguno en 'generando'. El índice por (documento_id, estado) es el que
-- sirve esa consulta sin recorrer los cuarenta.
create index if not exists documentos_bloques_documento_estado_idx
  on public.documentos_bloques(documento_id, estado);
