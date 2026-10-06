-- =============================================================================
-- RENOMBRE DE LOS CÓDIGOS MALFORMADOS DEL CATÁLOGO NIIF
--
-- Acompaña a docs/suplemento-s1s2/auditoria-catalogo.md. Va en migración aparte
-- de las correcciones de descripción porque renombrar un código es un cambio de
-- BASE Y DE CÓDIGO a la vez: `lib/suplemento/bloques.ts` cita estas cadenas
-- literalmente, y si la base cambia sin el archivo, el bloque se queda sin su
-- requisito EN SILENCIO —que es justo el fallo que `validarMapeo()` existe para
-- gritar—. Las dos mitades viajan en el mismo commit.
--
-- QUÉ ESTABA MAL. Ocho códigos pegaban el párrafo 29(x) con un inciso de B65,
-- como si B65 tuviera sub-requisitos de 29(x). No los tiene: B64 solo dice que
-- además de los GEI hay que revelar 29(b) a (g), y B65 enumera CONSIDERACIONES
-- de preparación comunes a todos ellos. "B64 y" sobraba en los ocho.
--
-- CÓMO SE RENOMBRAN, sin interpretar:
--   · Los tres cuya descripción ES el párrafo 29(x) —cantidad y porcentaje de
--     activos vulnerables o alineados— pasan a `NIIF S2 29 (x)` a secas.
--   · Los seis que describen una consideración de B65 aplicada a un tipo de
--     riesgo pasan a `NIIF S2 29 (x) · B65 (y)`: los dos párrafos que
--     efectivamente concurren, y ninguno más.
--   · `IFRS S1 2023-06-26 40 a` mezclaba el nombre inglés de la Norma con su
--     fecha de emisión. Pasa a `NIIF S1 40(a)`.
--
-- QUÉ NO SE TOCA. `NIIF S2 EI14 a E18` está malformado —le falta la I de EI18—
-- pero remite a la Guía sobre la Implementación, que no está entre los PDF
-- auditados. Corregirlo exigiría comprobar a qué apunta, y no se puede. Queda
-- diferido junto con los otros tres códigos con sufijo EI.
--
-- SIN RIESGO PARA LAS REFERENCIAS. `mapeo_solicitud_datapoint`, `mapeo_export` y
-- `plantilla_solicitudes.datapoint_ids` apuntan por uuid, no por código: el
-- renombre no toca un solo enlace.
--
-- Idempotente: cada UPDATE busca el código viejo, que después de correr una vez
-- ya no existe, y no hace nada la segunda.
-- =============================================================================

-- El nombre inglés de la Norma y su fecha de emisión no son parte del código.
update public.datapoints_taxonomia set codigo = 'NIIF S1 40(a)'
 where codigo = 'IFRS S1 2023-06-26 40 a';

-- 29(b) — riesgos de transición. El inciso (a) ES el párrafo 29(b).
update public.datapoints_taxonomia set codigo = 'NIIF S2 29 (b)'
 where codigo = 'NIIF S2 29 (b) B64 y B65 inciso (a)';
update public.datapoints_taxonomia set codigo = 'NIIF S2 29 (b) · B65 (b)'
 where codigo = 'NIIF S2 29 (b) B64 y B65 inciso (b)';
update public.datapoints_taxonomia set codigo = 'NIIF S2 29 (b) · B65 (c)'
 where codigo = 'NIIF S2 29 (b) B64 y B65 inciso (c)';

-- 29(c) — riesgos físicos. El párrafo en sí lo inserta la migración anterior
-- como `NIIF S2 29 (c)`, que era la fila que faltaba.
update public.datapoints_taxonomia set codigo = 'NIIF S2 29 (c) · B65 (b)'
 where codigo = 'NIIF S2 29 (c) B64 y B65 inciso (b)';
update public.datapoints_taxonomia set codigo = 'NIIF S2 29 (c) · B65 (c)'
 where codigo = 'NIIF S2 29 (c) B64 y B65 inciso (c)';

-- 29(d) — oportunidades. El inciso (a) ES el párrafo 29(d).
update public.datapoints_taxonomia set codigo = 'NIIF S2 29 (d)'
 where codigo = 'NIIF S2 29 (d) B64 y B65 inciso (a)';
update public.datapoints_taxonomia set codigo = 'NIIF S2 29 (d) · B65 (b)'
 where codigo = 'NIIF S2 29 (d) B64 y B65 inciso (b)';
update public.datapoints_taxonomia set codigo = 'NIIF S2 29 (d) · B65 (c)'
 where codigo = 'NIIF S2 29 (d) B64 y B65 inciso (c)';
