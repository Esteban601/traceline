-- =============================================================================
-- reportes — régimen del ejercicio: año de adopción y alivios transitorios.
--
-- NIIF S1/S2 permiten alivios en los primeros ejercicios de adopción, y lo que
-- el suplemento debe decir cambia según cuáles se hayan tomado. Los tres casos
-- que gobiernan el documento:
--
--   * S1 E5 ("primero clima") — el primer año se informa solo de clima. Los
--     bloques S1 puros salen marcados como no aplicables a ese ejercicio en vez
--     de salir vacíos, que es distinto: uno es una decisión declarada y el otro
--     parece un hueco.
--   * S2 C4 — exime de informar Alcance 3 el primer año.
--   * S2 C3/C5 — eximen del comparativo y permiten el método de medición previo.
--
-- POR QUÉ VIVE EN `reportes` Y NO EN `perfil_emisor`. El alivio es del
-- EJERCICIO, no de la emisora: el primer año se toma y el segundo ya no. Lo que
-- sí es de la emisora —cuándo adoptó— también se guarda aquí, junto al ejercicio
-- que lo interpreta, para que un reporte se explique solo.
--
-- POR QUÉ jsonb Y NO CINCO BOOLEANOS. Los alivios son una lista tomada de un
-- apéndice de la norma; si mañana el IASB agrega uno, se agrega una llave, no
-- una migración. El default '{}' significa "ninguno declarado", que es lo
-- correcto para todo lo que ya existe.
-- =============================================================================

alter table public.reportes
  add column anio_adopcion integer,
  add column alivios       jsonb not null default '{}'::jsonb;

comment on column public.reportes.anio_adopcion is
  'Primer ejercicio en que la emisora reporta bajo NIIF S1/S2. Decide si este reporte está en régimen de primer año o subsecuente.';
comment on column public.reportes.alivios is
  'Alivios transitorios declarados para ESTE ejercicio, como banderas: {"E4":true,"E5":true,"C3":false,"C4":true,"C5":false}. ''{}'' = ninguno declarado.';

-- Guarda mínima: `alivios` tiene que ser un objeto, no un arreglo ni un escalar.
-- Sin esto, un `alivios = '[]'` pasaría y luego reventaría al leer una llave.
alter table public.reportes
  add constraint reportes_alivios_es_objeto
  check (jsonb_typeof(alivios) = 'object');

-- Las políticas y los grants de la tabla no cambian.
