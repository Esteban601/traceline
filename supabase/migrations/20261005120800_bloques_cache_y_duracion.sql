-- =============================================================================
-- documentos_bloques: desglose de caché y duración de la generación.
--
-- POR QUÉ. `tokens_entrada` guarda un solo número, y la entrada de una llamada
-- con caché de prompt son TRES cantidades con precios distintos: lo que se
-- escribió al caché (1.25x el precio base), lo que se leyó de él (0.1x, y 0.025x
-- en Fable 5.1) y lo que entró sin cachear (1x). Con un único total no se puede
-- reconstruir el costo ni saber si el caché está funcionando, que es justo lo
-- que A4 mide.
--
-- `duracion_ms` es lo que decide si un bloque cabe en los 30 s del router de
-- Heroku. Sin medirlo, el límite se descubre en producción.
--
-- Aditiva y con default 0: las filas existentes quedan válidas y el código que
-- no las escriba sigue funcionando.
-- =============================================================================

alter table public.documentos_bloques
  add column if not exists tokens_entrada_cache_escritura integer not null default 0,
  add column if not exists tokens_entrada_cache_lectura   integer not null default 0,
  add column if not exists duracion_ms                    integer;

comment on column public.documentos_bloques.tokens_entrada is
  'Tokens de entrada NO cacheados, al precio base. El total facturado es esta columna más las dos de caché.';
comment on column public.documentos_bloques.tokens_entrada_cache_escritura is
  'Tokens escritos al caché de prompt en esta llamada (usage.cache_creation_input_tokens). Cuestan 1.25x el precio base a 5 minutos, 2x a una hora.';
comment on column public.documentos_bloques.tokens_entrada_cache_lectura is
  'Tokens servidos desde el caché (usage.cache_read_input_tokens). Cuestan 0.1x el precio base; 0.025x en Fable 5.1.';
comment on column public.documentos_bloques.duracion_ms is
  'Milisegundos de la llamada al modelo, de inicio de petición a fin de stream. Es lo que se compara contra el corte de 30 s del router de Heroku.';
