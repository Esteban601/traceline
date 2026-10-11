-- =============================================================================
-- Estado del cierre de pendientes en el documento (fix/pre-v40, observación P2
-- de Codex sobre el PR #17, decisión de Esteban del 11 de octubre de 2026).
--
-- El cierre verificado hace una o más llamadas al modelo (hasta 120 s cada una)
-- y la ruta las esperaba dentro de la petición, con el router de Heroku cortando
-- a los 30 s: el orquestador podía lanzar la coherencia sobre un documento a
-- medio cerrar. Ahora el cierre corre en after(), con su estado en el documento,
-- como el generador: en_cola → ejecutando → listo | error. La coherencia del
-- fin de la generación la lanza el mismo after() cuando el cierre termina.
--
-- ADITIVA: columnas nullable (null = nunca se cerró) y un CHECK sobre la nueva.
-- =============================================================================

alter table public.documentos_generados
  add column if not exists cierre_estado text;
alter table public.documentos_generados
  add column if not exists cierre_resultado jsonb;
alter table public.documentos_generados
  add column if not exists cierre_actualizado_en timestamptz;

alter table public.documentos_generados
  drop constraint if exists documentos_generados_cierre_estado_check;
alter table public.documentos_generados
  add constraint documentos_generados_cierre_estado_check
  check (cierre_estado is null or cierre_estado in ('en_cola', 'ejecutando', 'listo', 'error'));

comment on column public.documentos_generados.cierre_estado is
  'Cierre de pendientes verificado: en_cola → ejecutando → listo | error (null: nunca se corrió).';
comment on column public.documentos_generados.cierre_resultado is
  'Resultado del último cierre: {cierres: [{bloque, dueno, veredicto}], costo_usd} o {error}.';

select public.fn_aplicar_barrera_auditor();
