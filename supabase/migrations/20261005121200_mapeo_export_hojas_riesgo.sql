-- =============================================================================
-- mapeo_export: las dos hojas de riesgo llevan el código que les toca.
--
-- NIIF S2 29(b) son los riesgos de TRANSICIÓN y 29(c) los FÍSICOS; el párrafo 30
-- no es una revelación sino la exención por costo o esfuerzo desproporcionado al
-- preparar 29(b) a (d). La plantilla tenía la hoja de riesgos físicos etiquetada
-- «NIIF S2 29(b)» y la de transición «NIIF S2 30». El contenido de cada una
-- siempre fue el correcto —sus columnas hablaban del riesgo que les corresponde—
-- así que no hay cifras que mover: solo etiquetas.
--
-- COMO LA DE «Fondo I», HOY AFECTA A CERO FILAS: `mapeo_export` solo mapea las
-- dos hojas GEI. Se escribe igual porque el nombre de hoja es la llave con la
-- que el export busca la pestaña, y una celda mapeada contra el nombre viejo no
-- fallaría — simplemente no aparecería el dato.
--
-- EL ORDEN IMPORTA Y POR ESO VA POR UN NOMBRE TEMPORAL: el destino de una hoja
-- es el nombre actual de la otra. Renombrar «NIIF S2 30» a «NIIF S2 29(b)»
-- primero pisaría las filas de la hoja de físicos antes de moverlas.
--
-- Idempotente: tras correr una vez no queda ninguna fila con los nombres viejos
-- ni con el temporal, así que los tres UPDATE no encuentran nada.
-- =============================================================================

-- 1. La de físicos sale de en medio.
update public.mapeo_export
   set hoja = '__intercambio_riesgos__'
 where hoja = 'NIIF S2 29(b)';

-- 2. La de transición toma el código que le corresponde.
update public.mapeo_export
   set hoja = 'NIIF S2 29(b)'
 where hoja = 'NIIF S2 30';

-- 3. Y la de físicos, el suyo.
update public.mapeo_export
   set hoja = 'NIIF S2 29(c)'
 where hoja = '__intercambio_riesgos__';
