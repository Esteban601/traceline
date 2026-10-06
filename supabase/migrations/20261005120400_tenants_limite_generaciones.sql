-- =============================================================================
-- tenants.generaciones_mes_max — salvaguarda de uso del generador.
--
-- No es un tope de presupuesto: es un freno contra el uso accidental o abusivo
-- del botón. Un suplemento completo son cuarenta llamadas al modelo; alguien
-- pulsando "Generar" en bucle porque no le gusta un párrafo cuesta dinero real y
-- no mejora el documento —para eso está regenerar UN bloque—.
--
-- Diez al mes por emisora es holgado para el uso legítimo (generar, revisar,
-- regenerar entero un par de veces, la versión en inglés) y corta el bucle.
-- El staff de IRStrat no está sujeto al límite.
--
-- NULL no significa "sin límite": la columna es NOT NULL con default, así que
-- toda emisora —las 16 de staging incluidas— nace con su tope. Ponerlo en 0
-- deshabilita el generador para esa emisora, que es una forma útil de apagarlo
-- sin tocar código.
-- =============================================================================

alter table public.tenants
  add column generaciones_mes_max integer not null default 10;

comment on column public.tenants.generaciones_mes_max is
  'Máximo de suplementos completos que esta emisora puede generar por mes natural. 0 deshabilita el generador. El staff de IRStrat no está sujeto al límite.';

alter table public.tenants
  add constraint tenants_generaciones_mes_max_no_negativo
  check (generaciones_mes_max >= 0);

-- Las políticas y los grants de la tabla no cambian.
