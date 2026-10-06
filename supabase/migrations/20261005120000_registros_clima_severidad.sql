-- =============================================================================
-- registros_clima — priorización: probabilidad, impacto, severidad y nivel.
--
-- Hoy un registro de clima dice QUÉ es (tipo, nombre, descripción, horizontes)
-- pero no CUÁNTO pesa. El suplemento S1/S2 necesita reproducir la tabla de
-- priorización que la firma ya entrega en sus informes: los riesgos ordenados
-- por severidad, con su nivel.
--
-- POR QUÉ TRES NÚMEROS Y NO UNO. La severidad de una matriz de riesgos es
-- probabilidad × impacto, pero no todos los clientes entregan los dos factores:
-- algunos dan solo el puntaje final. Se guardan los tres por separado para no
-- obligar a inventar los factores cuando no existen —quedan nulos— ni a
-- recalcular el puntaje cuando el cliente ya lo tiene decidido.
--
-- POR QUÉ `nivel` ES TEXTO LIBRE Y NO UN CHECK. La escala y los cortes son del
-- cliente: viven en `perfil_emisor.matriz_riesgos` ({escala_max, niveles:[…]}).
-- Un CHECK con 'crítico/alto/medio/bajo' aquí congelaría la matriz de CADU para
-- todos y rompería al primer cliente que use cinco niveles o los nombre distinto.
-- El nivel se calcula contra la matriz del emisor y se guarda ya resuelto para
-- que el entregable no dependa de recalcularlo.
--
-- Todo nullable: los registros que ya existen en staging y en los 16 tenants
-- siguen siendo válidos sin tocarlos.
-- =============================================================================

alter table public.registros_clima
  add column probabilidad numeric,
  add column impacto      numeric,
  add column severidad    numeric,
  add column nivel        text;

comment on column public.registros_clima.probabilidad is
  'Factor de probabilidad de la matriz del emisor. Nulo si el cliente solo entrega el puntaje final.';
comment on column public.registros_clima.impacto is
  'Factor de impacto de la matriz del emisor. Nulo si el cliente solo entrega el puntaje final.';
comment on column public.registros_clima.severidad is
  'Puntaje de severidad (típicamente probabilidad × impacto). Es lo que ordena la tabla de priorización del suplemento.';
comment on column public.registros_clima.nivel is
  'Nivel resuelto contra perfil_emisor.matriz_riesgos (p. ej. ''Crítico''). Texto libre a propósito: la escala y los nombres son de cada emisora.';

-- Las políticas y los grants de la tabla no cambian: columnas nuevas sobre una
-- tabla que ya tiene RLS quedan cubiertas por las políticas existentes.
