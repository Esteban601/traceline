-- =============================================================================
-- CATÁLOGO: CÓDIGOS PADRE DE LA FASE 3 (encargo 2026-10-24-deuda-s2-formato;
-- descripciones aprobadas por Esteban el 24 de octubre de 2026 como revisión de
-- IRStrat, CLAUDE.md §4). Fila de auditoría en docs/suplemento-s1s2/auditoria-catalogo.md.
--
-- Mismo patrón que «NIIF S2 25 (a)(i)a(v)»: el padre convive con sus incisos
-- (lib/suplemento/catalogo-incisos.ts, PADRE_DE). Responden las filas del Formato
-- electrónico que piden el párrafo completo:
--   NIIF S2 13 (a)a(b)      ← 13(a), 13(b)                         fila 59
--   NIIF S2 14 (a)(i)a(v)   ← 14(a)(i)–(v)                         fila 65
--   NIIF S2 16 (b)a(d)      ← 16(b), 16(c)(i)(ii), 16(d)           fila 91
--   NIIF S2 22 (a)a(b)      ← 22(a)(i)–(iii), 22(b)(i)–(iii)       filas 103 y 105
-- Norma, pilar, sección del índice, versión, marco y ODS se copian del primer
-- inciso. Las descripciones son redacciones propias en la terminología de la
-- traducción oficial; no transcriben la norma (§4).
--
-- IDEMPOTENTE Y ADITIVA: cuatro filas nuevas (ON CONFLICT DO NOTHING). No enlaza
-- solicitudes ni toca la plantilla. En Cobertura los padres son filas de
-- agrupación: no entran a conteos ni porcentajes (lib/cobertura-vista.ts).
-- =============================================================================

with padres (codigo, inciso, descripcion) as (
  values
    ('NIIF S2 13 (a)a(b)', 'NIIF S2 13(a)', 'Efectos actuales y previstos de los riesgos y oportunidades relacionados con el clima sobre el modelo de negocio y la cadena de valor de la entidad, y dónde se concentran esos riesgos y oportunidades en el modelo de negocio y en la cadena de valor.'),
    ('NIIF S2 14 (a)(i)a(v)', 'NIIF S2 14(a)(i)', 'Cómo ha respondido y prevé responder la entidad a los riesgos y oportunidades relacionados con el clima en su estrategia y toma de decisiones: cambios en el modelo de negocio y en la asignación de recursos, esfuerzos directos e indirectos de reducción o adaptación, plan de transición y cómo prevé alcanzar sus objetivos relacionados con el clima.'),
    ('NIIF S2 16 (b)a(d)', 'NIIF S2 16(b)', 'Efectos financieros previstos de los riesgos y oportunidades relacionados con el clima: para cuáles existe un riesgo significativo de ajuste material, dentro del siguiente periodo anual, en los importes en libros de los activos y pasivos de los estados financieros, y cómo espera la entidad que cambien su situación financiera, su rendimiento financiero y sus flujos de efectivo a corto, medio y largo plazo.'),
    ('NIIF S2 22 (a)a(b)', 'NIIF S2 22(a)(i)', 'Resiliencia de la estrategia y del modelo de negocio de la entidad frente al cambio climático: la evaluación de su resiliencia climática a la fecha de presentación y cómo y cuándo se llevó a cabo el análisis de escenarios relacionado con el clima.')
)
insert into public.datapoints_taxonomia (codigo, descripcion, norma, pilar, seccion_indice, version_taxonomia, marco, ods, activo)
select p.codigo, p.descripcion, g.norma, g.pilar, g.seccion_indice, g.version_taxonomia, g.marco, g.ods, true
  from padres p
  join public.datapoints_taxonomia g on g.codigo = p.inciso
on conflict (codigo, version_taxonomia) do nothing;

-- Barrera del rol auditor (CLAUDE.md §3): idempotente; esta migración no crea tablas.
select public.fn_aplicar_barrera_auditor();
