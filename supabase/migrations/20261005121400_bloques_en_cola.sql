-- =============================================================================
-- documentos_bloques: estado 'en_cola' y columna reclamado_en.
--
-- QUÉ PROBLEMA RESUELVE. Abrir un documento crea sus cuarenta bloques de golpe,
-- pero solo tres se generan a la vez. Los otros treinta y siete ESPERAN, y hasta
-- ahora esperaban marcados como 'generando': indistinguibles de los que de
-- verdad estaban en curso. El vencimiento a los tres minutos contaba desde que
-- el bloque entró en la cola, no desde que alguien lo tomó, así que los últimos
-- se marcaban «tiempo excedido» sin haber empezado. Generar un bloque tarda
-- entre 30 y 46 segundos; esperar turno, minutos.
--
--   'en_cola'  — creado y esperando. Nadie lo ha tomado. No vence.
--   'generando' — tomado por una petición concreta. Vence a los 3 minutos
--                 contados desde `reclamado_en`.
--
-- POR QUÉ UNA COLUMNA Y NO REUTILIZAR generado_en. `generado_en` es cuándo se
-- produjo el texto que está guardado; `reclamado_en` es cuándo empezó el intento
-- en curso. En un reintento son fechas distintas, y mezclarlas fue exactamente
-- el error anterior. Antes de esto usé `prompt_version` como marca de reclamo,
-- lo que le daba dos significados a una columna que solo debe decir con qué
-- versión del prompt se escribió el texto.
--
-- AMPLÍA EL CHECK, como las anteriores: los siete valores previos siguen siendo
-- válidos y ninguna fila existente queda fuera. La columna es nullable y sin
-- default: una fila que nadie ha tomado no tiene fecha de reclamo, y eso es
-- justo lo que la distingue.
-- =============================================================================

alter table public.documentos_bloques
  add column if not exists reclamado_en timestamptz;

alter table public.documentos_bloques
  drop constraint if exists documentos_bloques_estado_chk;

alter table public.documentos_bloques
  add constraint documentos_bloques_estado_chk
  check (estado in (
    'en_cola',
    'generando',
    'no_aplica',
    'pendiente_adjunto',
    'error',
    'borrador',
    'en_revision',
    'aprobado'
  ));

comment on column public.documentos_bloques.reclamado_en is
  'Cuándo tomó este bloque la petición que lo está generando. NULL mientras está en cola. El vencimiento a los 3 minutos se cuenta desde aquí, no desde generado_en, que es cuándo se produjo el texto guardado.';
comment on column public.documentos_bloques.estado is
  'en_cola → generando → borrador → en_revision → aprobado. Fuera de ese camino: no_aplica (el régimen lo excluye), pendiente_adjunto (campo del Perfil vacío con archivo del que derivarlo) y error (falló; reintentable).';

-- El reclamo atómico filtra por (documento, numero, estado): este índice es el
-- que lo sirve sin recorrer los cuarenta.
create index if not exists documentos_bloques_documento_estado_idx
  on public.documentos_bloques(documento_id, estado);
