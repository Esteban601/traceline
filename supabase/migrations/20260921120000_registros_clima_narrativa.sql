-- =============================================================================
-- TRES CAMPOS NARRATIVOS POR REGISTRO DE CLIMA.
--
-- El bloque 21 del Suplemento solo alcanzaba a producir la tabla resumen —riesgo,
-- tipo, horizontes, descripción, nivel— porque es lo único que el registro sabe.
-- CADU (pp. 23-24) escribe además un párrafo por riesgo que contesta tres cosas
-- que la descripción no cubre y que el modelo NO puede inventar:
--
--   concentracion         dónde se concentra la exposición: qué etapa de la
--                         cadena de valor, qué cartera, qué geografía.
--   impactos_potenciales  qué efectos concretos se prevén si el riesgo ocurre.
--   respuesta             qué está haciendo la emisora al respecto.
--
-- Son texto libre y nullable: los registros que ya existen no se vuelven
-- inválidos, y un registro sin estos campos sigue produciendo su fila de tabla
-- exactamente como hoy. Lo que cambia es que, cuando están, el bloque 21 puede
-- escribir el párrafo en vez de dejar un hueco.
--
-- Se capturan en /admin/registros, junto a la descripción.
-- =============================================================================

alter table public.registros_clima
  add column if not exists concentracion        text,
  add column if not exists impactos_potenciales text,
  add column if not exists respuesta            text;

comment on column public.registros_clima.concentracion is
  'Dónde se concentra la exposición: etapa de la cadena de valor, cartera o geografía. Alimenta el párrafo por riesgo del bloque 21.';
comment on column public.registros_clima.impactos_potenciales is
  'Efectos concretos que se prevén si el riesgo se materializa. Alimenta el párrafo por riesgo del bloque 21.';
comment on column public.registros_clima.respuesta is
  'Qué hace la emisora frente al riesgo: controles, coberturas, programas. Alimenta el párrafo por riesgo del bloque 21.';
