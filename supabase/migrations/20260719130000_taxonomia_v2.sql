-- =============================================================================
-- Fase 3, Sprint 5 — Fidelidad de taxonomía v2 (contra la especificación oficial
-- embebida en la hoja 'Fondo I' de la plantilla base).
--
-- Solo dos tablas cambian de ESQUEMA aquí:
--   1. registros_clima_valores — el "Despliegue de capital" se desglosa en tres
--      (gasto / financiación / inversión), como en 29(b)/30/29(d).
--   2. registros_clima — el horizonte temporal pasa de valor único a multi-enum
--      (un registro puede cubrir varios horizontes).
-- Los tipos oficiales de objetivos y 36(e) NO tocan esquema: esas columnas ya son
-- `text`; su corrección es de opciones canónicas (seed) + control en UI + export.
--
-- LEY DE LA CASA: la tabla ya tenía sus grants; ALTER no los altera. No se crean
-- tablas nuevas.
-- =============================================================================

-- 1. Despliegue de capital en tres (registros_clima_valores) -------------------
--    Estructura oficial (Fondo I): "Cantidad de gasto de capital",
--    "Cantidad de financiación", "Cantidad de inversión", por ejercicio.
alter table public.registros_clima_valores
  add column capital_gasto        numeric,
  add column capital_financiacion numeric,
  add column capital_inversion    numeric;

-- Migra el dato existente: el capital desplegado histórico era, en la práctica,
-- gasto de capital. Se preserva ahí; financiación/inversión quedan nulos.
update public.registros_clima_valores
   set capital_gasto = capital_desplegado
 where capital_desplegado is not null;

alter table public.registros_clima_valores
  drop column capital_desplegado;

comment on column public.registros_clima_valores.capital_gasto is
  'Cantidad de gasto de capital (Despliegue de capital, estructura oficial 29(b)/30/29(d)).';
comment on column public.registros_clima_valores.capital_financiacion is
  'Cantidad de financiación (Despliegue de capital).';
comment on column public.registros_clima_valores.capital_inversion is
  'Cantidad de inversión (Despliegue de capital).';

-- 2. Horizonte temporal como multi-enum (registros_clima) ----------------------
--    Un registro puede cubrir varios horizontes: 'Corto plazo' | 'Mediano plazo'
--    | 'Largo plazo' (estructura oficial S2 10 / 29(b) / 30 / 29(d)).
alter table public.registros_clima
  add column horizontes text[] not null default '{}';

-- Migra el valor único preexistente al array canónico (mapeo por prefijo; el
-- seed anterior usaba 'Corto/Mediano/Largo plazo (rango)'). Un valor no mapeable
-- se conserva íntegro como único elemento del array (no se pierde).
update public.registros_clima
   set horizontes = case
     when horizonte_temporal is null or btrim(horizonte_temporal) = '' then '{}'
     when horizonte_temporal ilike 'corto%'   then array['Corto plazo']
     when horizonte_temporal ilike 'mediano%' then array['Mediano plazo']
     when horizonte_temporal ilike 'largo%'   then array['Largo plazo']
     else array[horizonte_temporal]
   end;

alter table public.registros_clima
  drop column horizonte_temporal;

comment on column public.registros_clima.horizontes is
  'Horizontes temporales cubiertos (multi-enum): ''Corto plazo'' | ''Mediano plazo'' | ''Largo plazo''. Estructura oficial S2 10 / 29(b) / 30 / 29(d).';
