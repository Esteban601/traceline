-- =============================================================================
-- CORRECCIÓN DEL CATÁLOGO DE DATAPOINTS NIIF CONTRA EL TEXTO OFICIAL
--
-- PREPARADA, NO APLICADA. Acompaña a docs/suplemento-s1s2/auditoria-catalogo.md,
-- que es la tabla de 91 filas con el veredicto de cada código. Manuel revisa esa
-- tabla ANTES del db push.
--
-- QUÉ ARREGLA, en orden de gravedad:
--   1. Los riesgos de transición (29(b)) y los físicos (29(c)) estaban cruzados.
--      Además del texto, el cruce vive en `plantilla_solicitudes`, desde donde se
--      propagó a las emisoras.
--   2. La descripción de NIIF S1 35(c)(i)(ii) era texto narrativo de UNA emisora
--      concreta dentro de un catálogo que leen todas.
--   3. Siete descripciones remitían a apartados del informe en vez de a la norma.
--   4. Cuatro requisitos de la norma no tenían código.
--
-- IDEMPOTENTE. Se puede aplicar dos veces y en staging más adelante:
--   · Los UPDATE son por código exacto y escriben un valor fijo: repetirlos no
--     cambia nada la segunda vez.
--   · Los INSERT llevan ON CONFLICT (codigo, version_taxonomia) DO NOTHING, que
--     es la clave única real de la tabla (no `codigo` a secas).
--   · La corrección de `plantilla_solicitudes` quita el id equivocado y añade el
--     correcto solo si no está ya en el arreglo.
--
-- NO BORRA NADA. Ni una fila del catálogo, ni un enlace de un reporte vivo. La
-- sección 4 repunta enlaces existentes y está separada a propósito: toca datos de
-- cliente y es la única que conviene decidir aparte.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Descripciones incorrectas: dicen algo distinto de lo que exige el párrafo.
-- -----------------------------------------------------------------------------

-- NIIF S1 27(a)(v)
update public.datapoints_taxonomia set descripcion = 'Cómo supervisa el órgano u órganos o las personas el establecimiento de objetivos relacionados con los riesgos y oportunidades de sostenibilidad y cómo controlan los avances hacia su consecución (véase el párrafo 51), incluyendo si las métricas de desempeño relacionadas se incluyen en las políticas de remuneración y de qué manera.'
 where codigo = 'NIIF S1 27(a)(v)';

-- NIIF S1 30(a) y (b)
update public.datapoints_taxonomia set descripcion = 'Descripción de los riesgos y oportunidades relacionados con la sostenibilidad que podría esperarse razonablemente que afecten a las perspectivas de la entidad, y los horizontes temporales —corto, medio o largo plazo— en los que cabe esperar razonablemente que se produzcan sus efectos.'
 where codigo = 'NIIF S1 30(a)y(b)';

-- NIIF S1 35(a)
update public.datapoints_taxonomia set descripcion = 'Cómo los riesgos y oportunidades relacionados con la sostenibilidad han afectado a su situación financiera, rendimiento financiero y flujos de efectivo durante el periodo sobre el que se informa.'
 where codigo = 'NIIF S1 35(a)';

-- NIIF S1 35(c)(i) y (ii)
update public.datapoints_taxonomia set descripcion = 'Cómo espera la entidad que cambie su situación financiera a corto, medio y largo plazo, dada su estrategia para gestionar los riesgos y oportunidades de sostenibilidad, considerando (i) sus planes de inversión y disposición —incluidos aquellos con los que no esté comprometida contractualmente— y (ii) sus fuentes de financiación previstas para implementar su estrategia.'
 where codigo = 'NIIF S1 35(c)(i)(ii)';

-- NIIF S1 35(d)
update public.datapoints_taxonomia set descripcion = 'Cómo espera la entidad que cambien su rendimiento financiero y sus flujos de efectivo a corto, medio y largo plazo, dada su estrategia para gestionar los riesgos y oportunidades relacionados con la sostenibilidad.'
 where codigo = 'NIIF S1 35(d)';

-- NIIF S1 74
update public.datapoints_taxonomia set descripcion = 'Los juicios —distintos de los que implican estimaciones de importes— realizados en el proceso de preparación de la información a revelar sobre sostenibilidad y que tengan el efecto más significativo sobre la información incluida en ella.'
 where codigo = 'NIIF S1 74';

-- NIIF S2 14(a)(v)
update public.datapoints_taxonomia set descripcion = 'Cómo prevé la entidad alcanzar cualquier objetivo relacionado con el clima, incluido cualquier objetivo de emisiones de gases de efecto invernadero, descrito de conformidad con los párrafos 33 a 36.'
 where codigo = 'NIIF S2 14(a)(v)';

-- NIIF S2 16(a)
update public.datapoints_taxonomia set descripcion = 'Cómo los riesgos y oportunidades relacionados con el clima han afectado a su situación financiera, rendimiento financiero y flujos de efectivo durante el periodo sobre el que se informa.'
 where codigo = 'NIIF S2 16(a)';

-- NIIF S2 16(d)
update public.datapoints_taxonomia set descripcion = 'Cómo espera la entidad que cambien su rendimiento financiero y sus flujos de efectivo a corto, medio y largo plazo, teniendo en cuenta su estrategia para gestionar los riesgos y oportunidades relacionados con el clima.'
 where codigo = 'NIIF S2 16(d)';

-- NIIF S2 22(a)(i)
update public.datapoints_taxonomia set descripcion = 'Las implicaciones, en su caso, de la evaluación de resiliencia climática para la estrategia y el modelo de negocio de la entidad, incluida la forma en que necesitaría responder a los efectos identificados en el análisis de escenarios relacionados con el clima.'
 where codigo = 'NIIF S2 22(a)(i)';

-- NIIF S2 22(a)(iii)
update public.datapoints_taxonomia set descripcion = 'La capacidad de la entidad para ajustar o adaptar su estrategia y su modelo de negocio al cambio climático a corto, medio y largo plazo, incluyendo la disponibilidad y flexibilidad de sus recursos financieros existentes, su capacidad de redistribuir, reutilizar, mejorar o desmantelar activos, y el efecto de sus inversiones actuales y planificadas en mitigación, adaptación y resiliencia climática.'
 where codigo = 'NIIF S2 22(a)(iii)';

-- NIIF S2 22(b)(i)
update public.datapoints_taxonomia set descripcion = 'Información sobre los datos de entrada utilizados en el análisis de escenarios: qué escenarios y de qué fuentes, si el rango fue diverso, si se asocian a riesgos de transición o físicos, si se incluyó un escenario alineado con el último acuerdo internacional sobre cambio climático, por qué se consideran relevantes, los horizontes temporales empleados y el alcance de las operaciones analizadas.'
 where codigo = 'NIIF S2 22(b)(i)';

-- NIIF S2 29(a)(v)
update public.datapoints_taxonomia set descripcion = 'Para las emisiones de Alcance 2, revelar las emisiones basadas en la ubicación y proporcionar la información sobre cualquier instrumento contractual que sea necesaria para comprender el Alcance 2 de la entidad.'
 where codigo = 'NIIF S2 29 (a)(v)';

-- NIIF S2 29(a)(vi)(1)
update public.datapoints_taxonomia set descripcion = 'Las categorías incluidas dentro de la medición de las emisiones de Alcance 3 de la entidad, conforme a las categorías de Alcance 3 descritas en la Norma de Contabilidad e Informes de la Cadena de Valor Corporativa (Alcance 3) del Protocolo de Gases de Efecto Invernadero (2011).'
 where codigo = 'NIIF S2 29 (a)(vi)(1)';

-- NIIF S2 29(b); B65(a)
update public.datapoints_taxonomia set descripcion = 'Riesgos de transición relacionados con el clima: la cantidad y el porcentaje de activos o actividades empresariales vulnerables a los riesgos de transición relacionados con el clima.'
 where codigo = 'NIIF S2 29 (b) B64 y B65 inciso (a)';

-- NIIF S2 29(c); B65(c)
update public.datapoints_taxonomia set descripcion = 'Cómo los riesgos físicos relacionados con el clima han afectado a la situación financiera, el rendimiento financiero y los flujos de efectivo de la entidad durante el periodo sobre el que se informa.'
 where codigo = 'NIIF S2 29 (c) B64 y B65 inciso (c)';

-- NIIF S2 29(f)(i) y (ii)
update public.datapoints_taxonomia set descripcion = 'Precios internos del carbono: explicación de si la entidad aplica un precio del carbono en la toma de decisiones y cómo lo hace, y el precio por cada tonelada métrica de emisiones que utiliza para evaluar el costo de sus emisiones.'
 where codigo = 'NIIF S2 29 (f) (i) y (ii)';

-- NIIF S2 29(g)(i) y (ii)
update public.datapoints_taxonomia set descripcion = 'Remuneración: descripción de si las consideraciones relacionadas con el clima se tienen en cuenta en la remuneración de los ejecutivos y de qué manera, y el porcentaje de la remuneración de la gerencia ejecutiva reconocida en el periodo actual que está vinculada a consideraciones climáticas.'
 where codigo = 'NIIF S2 29 (g) (i) y (ii)';

-- NIIF S2 30
update public.datapoints_taxonomia set descripcion = 'Al preparar la información a revelar para cumplir los requerimientos del párrafo 29(b) a (d), la entidad utilizará toda la información razonable y sustentable de que disponga en la fecha de presentación sin costo o esfuerzo desproporcionado.'
 where codigo = 'NIIF S2 30';

-- NIIF S2 32
update public.datapoints_taxonomia set descripcion = 'Métricas basadas en el sector industrial asociadas con uno o más modelos de negocio, actividades u otros rasgos comunes que caractericen la participación en un sector industrial, considerando la Guía de Implementación de la NIIF S2 basada en Sectores Industriales.'
 where codigo = 'NIIF S2 32';

-- NIIF S2 36(a) a (d)
update public.datapoints_taxonomia set descripcion = 'Para cada objetivo de emisiones de gases de efecto invernadero: qué gases cubre, si cubre emisiones de Alcance 1, 2 o 3, si es un objetivo de emisiones brutas o netas —y, si es neto, el objetivo bruto asociado revelado por separado— y si se ha obtenido utilizando un enfoque de descarbonización sectorial.'
 where codigo = 'NIIF S2 36 (a)a(d)';

-- NIIF S2 6(a)(iv)
update public.datapoints_taxonomia set descripcion = 'Cómo tienen en cuenta los órganos o personas los riesgos y oportunidades relacionados con el clima al supervisar la estrategia de la entidad, sus decisiones sobre transacciones importantes y sus procesos de gestión de riesgos y políticas relacionadas, incluyendo si han considerado las compensaciones asociadas a esos riesgos y oportunidades.'
 where codigo = 'NIIF S2 6 (a)(iv)';

-- NIIF S2 6(a)(v)
update public.datapoints_taxonomia set descripcion = 'Cómo supervisan los órganos o personas el establecimiento de objetivos relacionados con los riesgos y oportunidades climáticos y cómo controlan los avances hacia su consecución (véanse los párrafos 33 a 36), incluyendo si las métricas de desempeño relacionadas se incluyen en las políticas de remuneración y de qué manera [véase el párrafo 29(g)].'
 where codigo = 'NIIF S2 6 (a)(v)';

-- -----------------------------------------------------------------------------
-- 2. Erratas y omisiones menores. Bloque separado: si Manuel quiere aplicar solo
--    lo grave, puede dejar esta sección fuera sin tocar la anterior.
-- -----------------------------------------------------------------------------

-- NIIF S1 27(b)
update public.datapoints_taxonomia set descripcion = 'El papel de la gerencia en los procesos de gobernanza, los controles y los procedimientos utilizados para vigilar, gestionar y supervisar los riesgos y las oportunidades relacionados con la sostenibilidad.'
 where codigo = 'NIIF S1 27(b)';

-- NIIF S1 27(b)(i)
update public.datapoints_taxonomia set descripcion = 'Si la función se delega en un cargo específico a nivel de gestión o en un comité a nivel de gestión, y cómo se ejerce la supervisión sobre dicho cargo o comité.'
 where codigo = 'NIIF S1 27(b)(i)';

-- NIIF S1 32(a)
update public.datapoints_taxonomia set descripcion = 'Descripción de los efectos actuales y previstos de los riesgos y oportunidades relacionados con la sostenibilidad sobre el modelo de negocio y la cadena de valor de la entidad.'
 where codigo = 'NIIF S1 32(a)';

-- NIIF S2 14(a)(iv)
update public.datapoints_taxonomia set descripcion = 'Cualquier plan de transición relacionado con el clima que tenga la entidad, incluida la información sobre los supuestos clave utilizados en su desarrollo y las dependencias en las que se basa.'
 where codigo = 'NIIF S2 14(a)(iv)';

-- NIIF S2 16(c)(i) y (ii)
update public.datapoints_taxonomia set descripcion = 'Cómo espera la entidad que cambie su situación financiera a corto, medio y largo plazo, dada su estrategia para gestionar los riesgos y oportunidades relacionados con el clima, considerando (i) sus planes de inversión y disposición, incluidos aquellos con los que no esté comprometida contractualmente, y (ii) sus fuentes de financiación previstas para implementar su estrategia.'
 where codigo = 'NIIF S2 16(c)(i)(ii)';

-- NIIF S2 29(b); B65(c)
update public.datapoints_taxonomia set descripcion = 'Cómo los riesgos de transición relacionados con el clima han afectado a la situación financiera, el rendimiento financiero y los flujos de efectivo de la entidad durante el periodo sobre el que se informa.'
 where codigo = 'NIIF S2 29 (b) B64 y B65 inciso (c)';

-- NIIF S2 29(d); B65(a)
update public.datapoints_taxonomia set descripcion = 'Oportunidades relacionadas con el clima: la cantidad y el porcentaje de activos o actividades empresariales alineadas con las oportunidades relacionadas con el clima.'
 where codigo = 'NIIF S2 29 (d) B64 y B65 inciso (a)';

-- NIIF S2 29(d); B65(b)
update public.datapoints_taxonomia set descripcion = 'Descripción de dónde se concentran en el modelo de negocio y en la cadena de valor de la entidad las oportunidades relacionadas con el clima.'
 where codigo = 'NIIF S2 29 (d) B64 y B65 inciso (b)';

-- NIIF S2 6(a)(i)
update public.datapoints_taxonomia set descripcion = 'Cómo se reflejan las responsabilidades relativas a los riesgos y oportunidades relacionados con el clima en los términos de referencia, mandatos, descripciones de funciones y otras políticas relacionadas aplicables a dichos órganos o personas.'
 where codigo = 'NIIF S2 6 (a)(i)';

-- NIIF S2 6(a)(iii)
update public.datapoints_taxonomia set descripcion = 'Cómo y con qué frecuencia se informa a los órganos o personas sobre los riesgos y oportunidades relacionados con el clima.'
 where codigo = 'NIIF S2 6 (a)(iii)';

-- NIIF S2 6(b)
update public.datapoints_taxonomia set descripcion = 'El papel de la gerencia en los procesos de gobernanza, los controles y los procedimientos utilizados para vigilar, gestionar y supervisar los riesgos y las oportunidades relacionados con el clima.'
 where codigo = 'NIIF S2 6(b)';

-- NIIF S2 6(b)(i)
update public.datapoints_taxonomia set descripcion = 'Si la función se delega en un cargo específico a nivel de gerencia o en un comité a nivel de gerencia, y cómo se ejerce la supervisión sobre dicho cargo o comité.'
 where codigo = 'NIIF S2 6(b)(i)';

-- NIIF S2 6(b)(ii)
update public.datapoints_taxonomia set descripcion = 'Si la gerencia utiliza controles y procedimientos para apoyar la supervisión de los riesgos y oportunidades relacionados con el clima y, en caso afirmativo, cómo se integran estos controles y procedimientos con otras funciones internas.'
 where codigo = 'NIIF S2 6(b)(ii)';

-- -----------------------------------------------------------------------------
-- 3. Requisitos de la norma que no tenían código.
-- -----------------------------------------------------------------------------
insert into public.datapoints_taxonomia
  (codigo, marco, norma, pilar, seccion_indice, descripcion, ods, activo, version_taxonomia)
values
  -- S2 29(c). Es la mitad que faltaba de la métrica de exposición: el catálogo tenía tres códigos bajo 29(b) y solo dos bajo 29(c).
  ('NIIF S2 29 (c)', 'NIIF', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Riesgos físicos relacionados con el clima: la cantidad y el porcentaje de activos o actividades empresariales vulnerables a los riesgos físicos relacionados con el clima.', null, true, '2025'),
  -- S2 B65(e). Es el requisito de conectividad con los estados financieros y hoy no lo cubre ningún código.
  ('NIIF S2 B65 inciso (e)', 'NIIF', 'S2', 'metricas', '6. Contenidos sobre los temas materiales', 'Conexiones entre la información revelada conforme a los párrafos 29(b) a (g) y los estados financieros relacionados: congruencia de los datos y supuestos empleados y vínculos entre los importes revelados y los reconocidos y revelados en los estados financieros.', null, true, '2025'),
  -- S1 27(b)(ii). Su equivalente de la S2, 6(b)(ii), sí existía. Fuera del alcance pedido (S2), se incluye por simetría.
  ('NIIF S1 27(b)(ii)', 'NIIF', 'S1', 'gobernanza', '1. La organización y su prácticas de presentación de informes', 'Si la gerencia utiliza controles y procedimientos para apoyar la supervisión de los riesgos y oportunidades relacionados con la sostenibilidad y, en caso afirmativo, cómo se integran estos controles y procedimientos con otras funciones internas.', null, true, '2025')
on conflict (codigo, version_taxonomia) do nothing;

-- -----------------------------------------------------------------------------
-- 4. El enlace cruzado de 29(b)/29(c) en la plantilla base.
--
-- La solicitud de plantilla "Riesgos físicos climáticos en instalaciones" apunta
-- al código de 29(b), que son los riesgos de TRANSICIÓN. Ahora que 29(c) inciso
-- (a) existe (sección 3), se puede repuntar en vez de solo quitar.
--
-- Idempotente por construcción: array_remove no falla si el id ya no está, y el
-- append solo ocurre si el correcto no está todavía.
-- -----------------------------------------------------------------------------
-- Los dos códigos entran por FROM y no como subconsultas escalares: si alguno no
-- existiera —por ejemplo, si se aplicara esta sección sin la 3— el join no
-- produce filas y no se actualiza nada. Con subconsultas escalares, un código
-- ausente valdría NULL y se colaría un NULL dentro de `datapoint_ids`.
update public.plantilla_solicitudes ps
   set datapoint_ids =
         array_remove(ps.datapoint_ids, inc.id)
         || case when cor.id = any(ps.datapoint_ids) then '{}'::uuid[] else array[cor.id] end
  from public.datapoints_taxonomia cor,
       public.datapoints_taxonomia inc
 where cor.codigo = 'NIIF S2 29 (c)' and cor.version_taxonomia = '2025'
   and inc.codigo = 'NIIF S2 29 (b) B64 y B65 inciso (a)' and inc.version_taxonomia = '2025'
   and ps.titulo = 'Riesgos físicos climáticos en instalaciones'
   and inc.id = any(ps.datapoint_ids);

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
