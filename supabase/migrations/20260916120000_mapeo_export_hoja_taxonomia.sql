-- =============================================================================
-- mapeo_export: la hoja principal deja de llamarse como un cliente.
--
-- La plantilla oficial traía su hoja índice con el nombre «Fondo I», que es el
-- de un cliente (Fondo de Fondos), en un libro que es de la firma y que se
-- entrega a todas las emisoras. Pasa a llamarse «Taxonomía NIIF S1 S2».
--
-- HOY ESTA MIGRACIÓN AFECTA A CERO FILAS, y se escribe igual. `mapeo_export`
-- solo mapea celdas de las dos hojas GEI; ninguna de sus 57 filas activas
-- apunta a la hoja índice. Pero el nombre de hoja es la llave con la que el
-- export busca la pestaña: si mañana alguien mapea una celda de esa hoja contra
-- el nombre viejo, la celda se escribiría en una pestaña que ya no existe y no
-- fallaría nada — simplemente no aparecería el dato. Esto cierra esa puerta y
-- deja constancia del renombre en el historial de la base, no solo en un .xlsx
-- binario.
--
-- Idempotente: busca el nombre viejo, que después de correr una vez ya no está.
-- =============================================================================

update public.mapeo_export
   set hoja = 'Taxonomía NIIF S1 S2'
 where hoja = 'Fondo I';
