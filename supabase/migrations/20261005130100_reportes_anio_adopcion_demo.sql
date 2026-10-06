-- =============================================================================
-- Año de adopción NIIF S1/S2 en los reportes de las emisoras de demostración
-- (encargo 2026-10-05-generador-a-produccion, Paso 3).
--
-- `reportes.anio_adopcion` (20261005120100) nace vacía en los reportes que ya
-- existían. Sin ella el régimen queda «indeterminado» y el generador responde 422
-- (no puede decidir si el documento lleva comparativos). En las emisoras de
-- demostración el reporte es su primer año: año de adopción = ejercicio del
-- reporte. Los clientes reales (es_demo = false) no se tocan: su año lo declara
-- la emisora, y hoy su generador está apagado de todos modos.
--
-- Migración de datos, idempotente: solo filas de demostración sin año declarado.
-- =============================================================================

update public.reportes r
   set anio_adopcion = r.ejercicio
  from public.tenants t
 where t.id = r.tenant_id
   and t.es_demo
   and r.anio_adopcion is null;
