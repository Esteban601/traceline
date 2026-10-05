-- =============================================================================
-- La vitrina del suplemento se apaga en las emisoras que no son de demostración
-- (encargo 2026-10-05-generador-a-produccion §3).
--
-- Hasta hoy, en Grupo Carso el botón de la vitrina no aparecía porque Cobertura
-- también exige `es_demo`, pero la columna `vitrina_habilitada` estaba en true.
-- Con esto la regla de §3 («Grupo Carso: vitrina apagada») se verifica por
-- consulta y no depende de la pantalla.
--
-- Migración de datos, idempotente: solo toca filas con es_demo = false y la
-- vitrina encendida.
-- =============================================================================

update public.tenants set vitrina_habilitada = false
 where not es_demo and vitrina_habilitada;
