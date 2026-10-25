-- =============================================================================
-- CATÁLOGO: ALTA DE «NIIF S2 21(a)» (encargo 2026-10-24-deuda-s2-formato, Fase 2,
-- aprobada por Esteban el 24 de octubre de 2026). Fila de auditoría en
-- docs/suplemento-s1s2/auditoria-catalogo.md; deuda en ampliacion-catalogo.md.
--
-- NIIF S2 21(a): si la entidad determina, con los criterios de los párrafos 19
-- y 20, que no necesita dar información cuantitativa sobre los efectos
-- financieros de un riesgo u oportunidad relacionados con el clima, explica por
-- qué. El Formato electrónico lo pide en la fila 100 (par de NIIF S1 40(a)); su
-- bloque dueño es el 10 (efectos financieros, NIIF S2 15–16).
--
-- La descripción resume el párrafo con la terminología de la traducción
-- oficial; no transcribe la norma (§4). Norma, pilar, sección del índice,
-- versión, marco y ODS se copian de «NIIF S2 16(d)», del mismo bloque.
--
-- IDEMPOTENTE Y ADITIVA: una fila nueva (ON CONFLICT DO NOTHING). No enlaza
-- solicitudes ni toca la plantilla de solicitudes: en Cobertura aparece en cada
-- emisora «sin solicitud» hasta que una solicitud se ligue a él.
-- =============================================================================

insert into public.datapoints_taxonomia (codigo, descripcion, norma, pilar, seccion_indice, version_taxonomia, marco, ods, activo)
select 'NIIF S2 21(a)',
       'Si la entidad determina, con los criterios de los párrafos 19 y 20, que no necesita proporcionar información cuantitativa sobre los efectos financieros actuales o previstos de un riesgo u oportunidad relacionados con el clima: explicación de por qué no ha proporcionado esa información cuantitativa.',
       g.norma, g.pilar, g.seccion_indice, g.version_taxonomia, g.marco, g.ods, true
  from public.datapoints_taxonomia g
 where g.codigo = 'NIIF S2 16(d)'
on conflict (codigo, version_taxonomia) do nothing;

-- Barrera del rol auditor (CLAUDE.md §3): idempotente; esta migración no crea tablas.
select public.fn_aplicar_barrera_auditor();
