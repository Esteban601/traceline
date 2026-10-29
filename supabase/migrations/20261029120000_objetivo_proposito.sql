-- =============================================================================
-- Campo «propósito del objetivo» (encargo formato-respuesta-por-inciso, Fase 4;
-- decisión 4 de Esteban del Paso 0).
--
--   · objetivos.proposito_objetivo — el objetivo de la meta que pide NIIF S2
--     33(b): por ejemplo, mitigación, adaptación o conformidad con iniciativas
--     basadas en la ciencia. Lo captura la emisora con el objetivo.
--
-- Hoy ningún campo lo dice: `meta` es el valor («Reducción de 30% al 2030») y
-- `naturaleza` dice riesgo u oportunidad. Sin el campo, la fila 223 del Formato
-- electrónico (NIIF S2 33(b), «Objetivo de la meta») queda vacía en cada bloque
-- «Objetivo N».
--
-- ADITIVA: una columna nullable en una tabla con RLS existente; la llamada a la
-- barrera es idempotente y va aunque no se cree tabla (CLAUDE.md §3).
-- =============================================================================

alter table public.objetivos add column if not exists proposito_objetivo text;

comment on column public.objetivos.proposito_objetivo is 'Propósito del objetivo (NIIF S2 33(b)): mitigación, adaptación, conformidad con iniciativas basadas en la ciencia u otro, en palabras de la emisora. Formato electrónico [100000], fila 223 de cada bloque «Objetivo N».';

select public.fn_aplicar_barrera_auditor();
