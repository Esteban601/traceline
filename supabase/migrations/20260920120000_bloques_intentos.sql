-- =============================================================================
-- CONTADOR DE INTENTOS POR BLOQUE.
--
-- El corte por tiempo (150 s de reloj propio sobre el stream) devuelve el bloque
-- a la cola en vez de marcarlo error: un bloque lento no es un bloque roto, y el
-- reintento suele bastar. Pero sin memoria del intento, un bloque que SIEMPRE
-- excede la ventana se reencola para siempre y el orquestador no termina nunca.
--
-- `intentos` es esa memoria y es COLUMNA PROPIA a propósito. Guardarlo dentro de
-- `pendientes` habría metido un contador de control en una columna que describe
-- huecos del texto, que es la clase de doble significado que ya nos costó una
-- corrida entera con `prompt_version`.
--
-- Se reinicia en cada encolado deliberado (regenerar a mano, /generar de nuevo):
-- lo que cuenta son los cortes de ESTA tanda, no los de la semana pasada.
-- =============================================================================

alter table public.documentos_bloques
  add column if not exists intentos smallint not null default 0;

comment on column public.documentos_bloques.intentos is
  'Cortes por tiempo acumulados en la tanda actual. Al segundo, el bloque pasa a error en vez de volver a la cola. Se reinicia al encolar.';
