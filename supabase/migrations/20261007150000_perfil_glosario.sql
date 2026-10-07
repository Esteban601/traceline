-- =============================================================================
-- Glosario del emisor en el Perfil (encargo 2026-10-06, suplemento-calidad —
-- Paso 5.4).
--
-- Nombres canónicos de órganos, comités y direcciones, con sus variantes:
-- [{canonico, variantes[]}]. La capa estable del prompt lo lleva y un validador
-- determinista sustituye las variantes por el canónico después de generar.
-- Lo edita quien edita el Perfil (sección Gobierno corporativo); misma RLS que la
-- tabla.
-- Aditiva: columna con default.
-- =============================================================================

alter table public.perfil_emisor
  add column if not exists glosario jsonb not null default '[]'::jsonb;

comment on column public.perfil_emisor.glosario is
  'Nombres canónicos de órganos, comités y direcciones y sus variantes, [{canonico, variantes[]}]. El generador usa el canónico y sustituye las variantes (encargo suplemento-calidad, Paso 5).';

select public.fn_aplicar_barrera_auditor();
