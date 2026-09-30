-- =============================================================================
-- Valor 'vista_taxonomia' en tipo_actividad_auditor.
--
-- VA SOLO, como todo ALTER TYPE ADD VALUE (Postgres no permite usar el valor en
-- la misma transacción que lo crea).
--
-- POR QUÉ NO ESTABA: la lista del encargo §2 enumeró ocho tipos —sesión, matriz,
-- cobertura, solicitud, evidencia, descarga de evidencia, descarga de Excel y
-- comentario— y ninguno cubre las tres pantallas de captura de taxonomía
-- (registros de clima, objetivos y cuestionarios), que el mismo encargo abre al
-- auditor en lectura. Sin este valor, tres de las pantallas a las que entra no
-- dejarían rastro, y el compromiso es registrar CADA vista.
--
-- Va uno solo y no tres porque lo que distingue a esas vistas entre sí ya cabe
-- en `objeto_tipo` ('registros_clima' | 'objetivos' | 'cuestionarios'): tres
-- valores de enum para lo mismo obligarían a mantener sincronizadas dos listas.
-- =============================================================================

alter type public.tipo_actividad_auditor add value if not exists 'vista_taxonomia';
