-- =============================================================================
-- tenants.vitrina_habilitada (01/10/2026, encargo mockup AINDA, Fase 0).
--
-- La vitrina del Suplemento (botón de Cobertura y rutas de Word y PDF) se
-- encendía con `es_demo` a secas: toda emisora de demostración la veía. Un
-- mockup puede necesitar apagarla —AINDA, administrador de fondos, no tiene un
-- informe de emisora que enseñar con ese documento—, así que la vitrina pasa a
-- depender de `es_demo AND vitrina_habilitada`.
--
-- Aditiva: columna nueva con default true, así que todo tenant existente sigue
-- exactamente como estaba.
--
-- ORDEN DE DESPLIEGUE: la migración ANTES que el código. El código nuevo pide
-- `vitrina_habilitada` en el select de tenants, y sin la columna ese select
-- falla y Cobertura se rompe. El código anterior la ignora, así que migrar
-- primero no cambia nada hasta que llega el código.
-- No crea tablas ni buckets: no llama a fn_aplicar_barrera_auditor().
-- =============================================================================

alter table public.tenants
  add column if not exists vitrina_habilitada boolean not null default true;

comment on column public.tenants.vitrina_habilitada is
  'Si la vitrina del Suplemento (Word y PDF de muestra) se ofrece a esta emisora. Solo aplica con es_demo = true. Default true: apagarla es una decisión por mockup.';
