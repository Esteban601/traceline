-- =============================================================================
-- Repunte de enlaces de «Riesgos físicos climáticos en instalaciones» de
-- NIIF S2 29(b) inciso (a) a NIIF S2 29(c) en los reportes vivos.
--
-- SEPARADA de 20261005120700_catalogo_niif_correcciones (era su sección 5) el 5
-- de octubre de 2026, encargo `docs/encargos/2026-10-05-generador-a-produccion.md`,
-- decisión 3 del Paso 0: es la única parte de la corrección del catálogo que toca
-- datos de clientes. Antes de staging se reporta cuántas filas toca por emisora y
-- si alguna es de Grupo Carso; si Carso tiene filas, se revisan una por una. Se
-- aplica en staging SOLO con aprobación explícita; sin ella, este archivo no entra
-- en el lote de v33.
--
-- Va fechada al final de la serie a propósito: puede quedarse fuera sin mover
-- ninguna otra. El resto de la corrección del catálogo es coherente sin ella.
-- Contenido sin cambios respecto de la sección original. Idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5. Los enlaces YA PROPAGADOS a los reportes vivos.
--
-- SECCIÓN APARTE Y DELIBERADAMENTE AL FINAL: toca datos de cliente. En staging
-- son 15 emisoras las que arrastran el enlace equivocado desde la plantilla. Si
-- se decide no repuntarlos, basta con no ejecutar esta sección; el resto de la
-- migración es coherente sin ella.
--
-- Idempotente: el insert lleva ON CONFLICT DO NOTHING sobre la clave compuesta y
-- el delete solo quita el enlace equivocado, que después de correr una vez ya no
-- existe.
-- -----------------------------------------------------------------------------
-- Primero se crea el enlace correcto y solo después se quita el equivocado, para
-- que ninguna solicitud se quede sin ninguno de los dos si algo se interrumpe.
-- Los códigos entran por join, no por subconsulta escalar: sin el correcto no se
-- inserta nada en vez de intentar insertar un NULL.
insert into public.mapeo_solicitud_datapoint (solicitud_id, datapoint_id)
select msd.solicitud_id, cor.id
  from public.mapeo_solicitud_datapoint msd
  join public.solicitudes s   on s.id = msd.solicitud_id
  join public.datapoints_taxonomia inc
       on inc.id = msd.datapoint_id
      and inc.codigo = 'NIIF S2 29 (b) B64 y B65 inciso (a)'
      and inc.version_taxonomia = '2025'
  join public.datapoints_taxonomia cor
       on cor.codigo = 'NIIF S2 29 (c)'
      and cor.version_taxonomia = '2025'
 where s.titulo = 'Riesgos físicos climáticos en instalaciones'
on conflict (solicitud_id, datapoint_id) do nothing;

delete from public.mapeo_solicitud_datapoint msd
 using public.solicitudes s, public.datapoints_taxonomia inc
 where s.id = msd.solicitud_id
   and inc.id = msd.datapoint_id
   and inc.codigo = 'NIIF S2 29 (b) B64 y B65 inciso (a)'
   and inc.version_taxonomia = '2025'
   and s.titulo = 'Riesgos físicos climáticos en instalaciones';
