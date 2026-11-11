-- =============================================================================
-- EXTENSIÓN GRI CON TEXTO LITERAL, UNA FILA POR CONTENIDO (encargo docs/encargos/2026-10-31-catalogo-gri-sasb.md,
-- decisión de Esteban del 31/10/2026). GENERADA por scripts/catalogo/generar-gri-sasb.mjs --extension desde los PDF
-- oficiales en español de normas/_fuentes/gri-es/ el 2026-10-31. No se edita a mano.
--
--   · GRI 303-5, GRI 306-3 y GRI 404-1: la descripción que redactó la firma en 2026-08 se sustituye por el texto
--     literal del requisito; estándar, edición y página de origen.
--   · GRI 2-7 / 401-1: se parte por contenido. GRI 2-7 ya existe (carga de GRI 2) y GRI 401-1 entra aquí. Las solicitudes
--     ligadas a la fila compuesta y los renglones de plantilla que la llevan pasan a las dos; la fila compuesta se
--     RETIRA (activo = false). No se borra: conserva su historia y sus enlaces originales.
--
-- IDEMPOTENTE: upsert por (codigo, version_taxonomia); los enlaces, con on conflict do nothing; la plantilla, sin
-- duplicar ids. Pilar «metricas», como ya tenían las cuatro; norma S1 de relleno (deuda «relleno-norma-pilar-gri-sasb»).
-- =============================================================================

insert into public.datapoints_taxonomia
  (codigo, marco, norma, pilar, seccion_indice, estandar, edicion, descripcion, pagina_origen, version_taxonomia)
values
  ('GRI 303-5', 'GRI', 'S1'::public.norma_niif, 'metricas'::public.pilar_niif, null, 'GRI 303', '2018', 'La organización informante debe presentar la siguiente información: a. Consumo total de agua (en megalitros) de todas las zonas. b. Consumo total de agua (en megalitros) de todas las zonas con estrés hídrico. c. Cambio en el almacenamiento de agua (en megalitros), siempre que se haya identificado que el almacenamiento de agua genera un impacto significativo relacionado con el agua. d. Cualquier información contextual necesaria para comprender cómo se han recopilado los datos (como estándares, metodologías y supuestos utilizados), así como si la información se calcula, se estima, se obtiene a partir de un modelo o procede de mediciones directas, y el método empleado para ello, tal como el uso de factores específicos para el sector.', 18, '2025'),
  ('GRI 306-3', 'GRI', 'S1'::public.norma_niif, 'metricas'::public.pilar_niif, null, 'GRI 306', '2020', 'La organización informante debe presentar la siguiente información: a. Peso total de los residuos generados en toneladas métricas y desglose de este total en función de la composición de los residuos. b. Información contextual necesaria para entender los datos y la manera en que se recopilaron.', 12, '2025'),
  ('GRI 404-1', 'GRI', 'S1'::public.norma_niif, 'metricas'::public.pilar_niif, null, 'GRI 404', '2016', 'La organización informante debe presentar la siguiente información: a. El promedio de horas de formación que los empleados de la organización hayan recibido durante el periodo objeto del informe, desglosado por: i. género; ii. categoría laboral.', 8, '2025'),
  ('GRI 401-1', 'GRI', 'S1'::public.norma_niif, 'metricas'::public.pilar_niif, null, 'GRI 401', '2016', 'La organización informante debe presentar la siguiente información: a. La cantidad total y la tasa de contrataciones de nuevos empleados durante el periodo objeto del informe, por grupo de edad, género y región. b. La cantidad total y la tasa de rotación de personal durante el periodo objeto del informe, por grupo de edad, género y región.', 9, '2025')
on conflict (codigo, version_taxonomia) do update set
  marco = excluded.marco,
  norma = excluded.norma,
  pilar = excluded.pilar,
  seccion_indice = excluded.seccion_indice,
  estandar = excluded.estandar,
  edicion = excluded.edicion,
  descripcion = excluded.descripcion,
  pagina_origen = excluded.pagina_origen,
  activo = true
where public.datapoints_taxonomia.marco in ('GRI', 'SASB');

-- Enlaces de solicitudes: de la fila compuesta a GRI 2-7 y GRI 401-1.
insert into public.mapeo_solicitud_datapoint (solicitud_id, datapoint_id)
select m.solicitud_id, n.id
  from public.mapeo_solicitud_datapoint m
  join public.datapoints_taxonomia o on o.id = m.datapoint_id and o.codigo = 'GRI 2-7 / 401-1'
  join public.datapoints_taxonomia n on n.version_taxonomia = o.version_taxonomia and n.codigo in ('GRI 2-7', 'GRI 401-1')
on conflict do nothing;

-- Renglones de plantilla: el id compuesto se cambia por los dos, sin duplicar.
update public.plantilla_solicitudes p
   set datapoint_ids = (
     select array_agg(distinct x)
       from unnest(array_remove(p.datapoint_ids, o.id) || array[(select id from public.datapoints_taxonomia where codigo = 'GRI 2-7' and version_taxonomia = o.version_taxonomia), (select id from public.datapoints_taxonomia where codigo = 'GRI 401-1' and version_taxonomia = o.version_taxonomia)]) x
   )
  from public.datapoints_taxonomia o
 where o.codigo = 'GRI 2-7 / 401-1' and o.id = any(p.datapoint_ids);

-- La fila compuesta se retira.
update public.datapoints_taxonomia set activo = false where codigo = 'GRI 2-7 / 401-1' and activo;
