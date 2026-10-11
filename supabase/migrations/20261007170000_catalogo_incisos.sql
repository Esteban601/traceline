-- =============================================================================
-- CATÁLOGO: LOS CÓDIGOS AGRUPADOS SE PARTEN EN INCISOS (encargo 2026-10-06,
-- suplemento-calidad — cierre del Paso 5b, punto 2 aprobado por Esteban el 7 de
-- octubre de 2026). Fila de auditoría en docs/suplemento-s1s2/auditoria-catalogo.md.
--
-- PREPARADA, NO APLICADA. Esteban revisa la lista de códigos nuevos (es la
-- revisión de IRStrat, CLAUDE.md §4) antes del db push en dev.
--
-- Cuatro filas del catálogo agrupaban incisos que la norma exige por separado:
--   NIIF S2 25 (a)(i)a(v)  → NIIF S2 25 (a)(i) … (a)(v)      (5)
--   NIIF S1 44 (a)(i)a(v)  → NIIF S1 44 (a)(i) … (a)(v)      (5)
--   NIIF S2 36 (a)a(d)     → NIIF S2 36 (a) … (d)            (4)
--   NIIF S2 36 (e)(i)a(iv) → NIIF S2 36 (e)(i) … (e)(iv)     (4)
-- Con el código agrupado, la cobertura de un bloque decía «25(a)(i)a(v):
-- parcial» y no qué inciso faltaba (segunda revisión externa, punto 3).
--
-- Las descripciones son redacciones propias que resumen cada inciso en la
-- terminología de la traducción oficial; no transcriben la norma (§4).
--
-- IDEMPOTENTE Y ADITIVA. NO BORRA NI DESACTIVA NADA:
--   1. Inserta las 18 filas copiando norma, pilar, sección del índice, ODS,
--      marco y versión de la fila agrupada (ON CONFLICT (codigo,
--      version_taxonomia) DO NOTHING).
--   2. TOCA DATOS DE EMISORAS: toda solicitud enlazada al código agrupado queda
--      enlazada también a cada uno de sus incisos (ON CONFLICT DO NOTHING). Sin
--      esto, la cobertura de los bloques que pasan a citar los incisos vería sin
--      solicitud lo que ya la tenía. En dev: una solicitud por código agrupado.
--   3. Plantilla de solicitudes: donde está el id agrupado se agregan los de sus
--      incisos que falten.
-- Las filas agrupadas se quedan activas: siguen enlazadas a solicitudes vivas y
-- a celdas del Excel (`mapeo_export`). Desactivarlas es una decisión aparte.
-- =============================================================================

-- 1. Filas nuevas ---------------------------------------------------------------
with incisos (codigo, agrupado, descripcion) as (
  values
    ('NIIF S2 25 (a)(i)', 'NIIF S2 25 (a)(i)a(v)', 'Datos de entrada y métricas que la entidad utiliza en sus procesos para identificar, evaluar, priorizar y supervisar los riesgos relacionados con el clima (por ejemplo, fuentes de datos y alcance de las operaciones cubiertas).'),
    ('NIIF S2 25 (a)(ii)', 'NIIF S2 25 (a)(i)a(v)', 'Si la entidad utiliza el análisis de escenarios relacionados con el clima para fundamentar la identificación de esos riesgos, y cómo lo hace.'),
    ('NIIF S2 25 (a)(iii)', 'NIIF S2 25 (a)(i)a(v)', 'Cómo evalúa la entidad la naturaleza, la probabilidad y la magnitud de los efectos de los riesgos relacionados con el clima (por ejemplo, factores cualitativos, umbrales cuantitativos u otros criterios).'),
    ('NIIF S2 25 (a)(iv)', 'NIIF S2 25 (a)(i)a(v)', 'Si la entidad da prioridad a los riesgos relacionados con el clima respecto de otros tipos de riesgo, y cómo lo hace.'),
    ('NIIF S2 25 (a)(v)', 'NIIF S2 25 (a)(i)a(v)', 'Cómo supervisa la entidad los riesgos relacionados con el clima.'),
    ('NIIF S1 44 (a)(i)', 'NIIF S1 44 (a)(i)a(v)', 'Insumos y métricas que la entidad utiliza en sus procesos para identificar, evaluar, priorizar y supervisar los riesgos relacionados con la sostenibilidad (por ejemplo, fuentes de datos y alcance de las operaciones cubiertas).'),
    ('NIIF S1 44 (a)(ii)', 'NIIF S1 44 (a)(i)a(v)', 'Si la entidad utiliza el análisis de escenarios para fundamentar la identificación de los riesgos relacionados con la sostenibilidad, y cómo lo hace.'),
    ('NIIF S1 44 (a)(iii)', 'NIIF S1 44 (a)(i)a(v)', 'Cómo evalúa la entidad la naturaleza, la probabilidad y la magnitud de los efectos de los riesgos relacionados con la sostenibilidad (por ejemplo, factores cualitativos, umbrales cuantitativos u otros criterios).'),
    ('NIIF S1 44 (a)(iv)', 'NIIF S1 44 (a)(i)a(v)', 'Si la entidad da prioridad a los riesgos relacionados con la sostenibilidad respecto de otros tipos de riesgo, y cómo lo hace.'),
    ('NIIF S1 44 (a)(v)', 'NIIF S1 44 (a)(i)a(v)', 'Cómo supervisa la entidad los riesgos relacionados con la sostenibilidad.'),
    ('NIIF S2 36 (a)', 'NIIF S2 36 (a)a(d)', 'Para cada objetivo de emisiones de gases de efecto invernadero: qué gases de efecto invernadero cubre.'),
    ('NIIF S2 36 (b)', 'NIIF S2 36 (a)a(d)', 'Para cada objetivo de emisiones de gases de efecto invernadero: si cubre emisiones de Alcance 1, Alcance 2 o Alcance 3.'),
    ('NIIF S2 36 (c)', 'NIIF S2 36 (a)a(d)', 'Para cada objetivo de emisiones de gases de efecto invernadero: si es un objetivo de emisiones brutas o netas; si es neto, también el objetivo de emisiones brutas asociado, por separado (párrafos B68 a B69).'),
    ('NIIF S2 36 (d)', 'NIIF S2 36 (a)a(d)', 'Para cada objetivo de emisiones de gases de efecto invernadero: si se obtuvo con un enfoque de descarbonización sectorial.'),
    ('NIIF S2 36 (e)(i)', 'NIIF S2 36 (e)(i)a(iv)', 'En qué medida y de qué manera el logro de un objetivo de emisiones netas de gases de efecto invernadero depende del uso de créditos de carbono.'),
    ('NIIF S2 36 (e)(ii)', 'NIIF S2 36 (e)(i)a(iv)', 'Qué régimen o regímenes de terceros verificarán o certificarán los créditos de carbono.'),
    ('NIIF S2 36 (e)(iii)', 'NIIF S2 36 (e)(i)a(iv)', 'Tipo de crédito de carbono: si la compensación subyacente se basa en la naturaleza o en la eliminación tecnológica de carbono, y si se logra mediante reducción o eliminación de carbono.'),
    ('NIIF S2 36 (e)(iv)', 'NIIF S2 36 (e)(i)a(iv)', 'Cualquier otro factor necesario para comprender la credibilidad e integridad de los créditos de carbono que la entidad prevé utilizar (por ejemplo, supuestos sobre la permanencia de la compensación).')
)
insert into public.datapoints_taxonomia (codigo, descripcion, norma, pilar, seccion_indice, version_taxonomia, marco, ods, activo)
select i.codigo, i.descripcion, g.norma, g.pilar, g.seccion_indice, g.version_taxonomia, g.marco, g.ods, true
  from incisos i
  join public.datapoints_taxonomia g on g.codigo = i.agrupado
on conflict (codigo, version_taxonomia) do nothing;

-- 2. Enlaces de solicitudes (datos de emisoras) --------------------------------
with incisos (codigo, agrupado, descripcion) as (
  values
    ('NIIF S2 25 (a)(i)', 'NIIF S2 25 (a)(i)a(v)', 'Datos de entrada y métricas que la entidad utiliza en sus procesos para identificar, evaluar, priorizar y supervisar los riesgos relacionados con el clima (por ejemplo, fuentes de datos y alcance de las operaciones cubiertas).'),
    ('NIIF S2 25 (a)(ii)', 'NIIF S2 25 (a)(i)a(v)', 'Si la entidad utiliza el análisis de escenarios relacionados con el clima para fundamentar la identificación de esos riesgos, y cómo lo hace.'),
    ('NIIF S2 25 (a)(iii)', 'NIIF S2 25 (a)(i)a(v)', 'Cómo evalúa la entidad la naturaleza, la probabilidad y la magnitud de los efectos de los riesgos relacionados con el clima (por ejemplo, factores cualitativos, umbrales cuantitativos u otros criterios).'),
    ('NIIF S2 25 (a)(iv)', 'NIIF S2 25 (a)(i)a(v)', 'Si la entidad da prioridad a los riesgos relacionados con el clima respecto de otros tipos de riesgo, y cómo lo hace.'),
    ('NIIF S2 25 (a)(v)', 'NIIF S2 25 (a)(i)a(v)', 'Cómo supervisa la entidad los riesgos relacionados con el clima.'),
    ('NIIF S1 44 (a)(i)', 'NIIF S1 44 (a)(i)a(v)', 'Insumos y métricas que la entidad utiliza en sus procesos para identificar, evaluar, priorizar y supervisar los riesgos relacionados con la sostenibilidad (por ejemplo, fuentes de datos y alcance de las operaciones cubiertas).'),
    ('NIIF S1 44 (a)(ii)', 'NIIF S1 44 (a)(i)a(v)', 'Si la entidad utiliza el análisis de escenarios para fundamentar la identificación de los riesgos relacionados con la sostenibilidad, y cómo lo hace.'),
    ('NIIF S1 44 (a)(iii)', 'NIIF S1 44 (a)(i)a(v)', 'Cómo evalúa la entidad la naturaleza, la probabilidad y la magnitud de los efectos de los riesgos relacionados con la sostenibilidad (por ejemplo, factores cualitativos, umbrales cuantitativos u otros criterios).'),
    ('NIIF S1 44 (a)(iv)', 'NIIF S1 44 (a)(i)a(v)', 'Si la entidad da prioridad a los riesgos relacionados con la sostenibilidad respecto de otros tipos de riesgo, y cómo lo hace.'),
    ('NIIF S1 44 (a)(v)', 'NIIF S1 44 (a)(i)a(v)', 'Cómo supervisa la entidad los riesgos relacionados con la sostenibilidad.'),
    ('NIIF S2 36 (a)', 'NIIF S2 36 (a)a(d)', 'Para cada objetivo de emisiones de gases de efecto invernadero: qué gases de efecto invernadero cubre.'),
    ('NIIF S2 36 (b)', 'NIIF S2 36 (a)a(d)', 'Para cada objetivo de emisiones de gases de efecto invernadero: si cubre emisiones de Alcance 1, Alcance 2 o Alcance 3.'),
    ('NIIF S2 36 (c)', 'NIIF S2 36 (a)a(d)', 'Para cada objetivo de emisiones de gases de efecto invernadero: si es un objetivo de emisiones brutas o netas; si es neto, también el objetivo de emisiones brutas asociado, por separado (párrafos B68 a B69).'),
    ('NIIF S2 36 (d)', 'NIIF S2 36 (a)a(d)', 'Para cada objetivo de emisiones de gases de efecto invernadero: si se obtuvo con un enfoque de descarbonización sectorial.'),
    ('NIIF S2 36 (e)(i)', 'NIIF S2 36 (e)(i)a(iv)', 'En qué medida y de qué manera el logro de un objetivo de emisiones netas de gases de efecto invernadero depende del uso de créditos de carbono.'),
    ('NIIF S2 36 (e)(ii)', 'NIIF S2 36 (e)(i)a(iv)', 'Qué régimen o regímenes de terceros verificarán o certificarán los créditos de carbono.'),
    ('NIIF S2 36 (e)(iii)', 'NIIF S2 36 (e)(i)a(iv)', 'Tipo de crédito de carbono: si la compensación subyacente se basa en la naturaleza o en la eliminación tecnológica de carbono, y si se logra mediante reducción o eliminación de carbono.'),
    ('NIIF S2 36 (e)(iv)', 'NIIF S2 36 (e)(i)a(iv)', 'Cualquier otro factor necesario para comprender la credibilidad e integridad de los créditos de carbono que la entidad prevé utilizar (por ejemplo, supuestos sobre la permanencia de la compensación).')
)
insert into public.mapeo_solicitud_datapoint (solicitud_id, datapoint_id)
select m.solicitud_id, d.id
  from public.mapeo_solicitud_datapoint m
  join public.datapoints_taxonomia g on g.id = m.datapoint_id
  join incisos i on i.agrupado = g.codigo
  join public.datapoints_taxonomia d on d.codigo = i.codigo and d.version_taxonomia = g.version_taxonomia
on conflict do nothing;

-- 3. Plantilla de solicitudes ---------------------------------------------------
with incisos (codigo, agrupado, descripcion) as (
  values
    ('NIIF S2 25 (a)(i)', 'NIIF S2 25 (a)(i)a(v)', 'Datos de entrada y métricas que la entidad utiliza en sus procesos para identificar, evaluar, priorizar y supervisar los riesgos relacionados con el clima (por ejemplo, fuentes de datos y alcance de las operaciones cubiertas).'),
    ('NIIF S2 25 (a)(ii)', 'NIIF S2 25 (a)(i)a(v)', 'Si la entidad utiliza el análisis de escenarios relacionados con el clima para fundamentar la identificación de esos riesgos, y cómo lo hace.'),
    ('NIIF S2 25 (a)(iii)', 'NIIF S2 25 (a)(i)a(v)', 'Cómo evalúa la entidad la naturaleza, la probabilidad y la magnitud de los efectos de los riesgos relacionados con el clima (por ejemplo, factores cualitativos, umbrales cuantitativos u otros criterios).'),
    ('NIIF S2 25 (a)(iv)', 'NIIF S2 25 (a)(i)a(v)', 'Si la entidad da prioridad a los riesgos relacionados con el clima respecto de otros tipos de riesgo, y cómo lo hace.'),
    ('NIIF S2 25 (a)(v)', 'NIIF S2 25 (a)(i)a(v)', 'Cómo supervisa la entidad los riesgos relacionados con el clima.'),
    ('NIIF S1 44 (a)(i)', 'NIIF S1 44 (a)(i)a(v)', 'Insumos y métricas que la entidad utiliza en sus procesos para identificar, evaluar, priorizar y supervisar los riesgos relacionados con la sostenibilidad (por ejemplo, fuentes de datos y alcance de las operaciones cubiertas).'),
    ('NIIF S1 44 (a)(ii)', 'NIIF S1 44 (a)(i)a(v)', 'Si la entidad utiliza el análisis de escenarios para fundamentar la identificación de los riesgos relacionados con la sostenibilidad, y cómo lo hace.'),
    ('NIIF S1 44 (a)(iii)', 'NIIF S1 44 (a)(i)a(v)', 'Cómo evalúa la entidad la naturaleza, la probabilidad y la magnitud de los efectos de los riesgos relacionados con la sostenibilidad (por ejemplo, factores cualitativos, umbrales cuantitativos u otros criterios).'),
    ('NIIF S1 44 (a)(iv)', 'NIIF S1 44 (a)(i)a(v)', 'Si la entidad da prioridad a los riesgos relacionados con la sostenibilidad respecto de otros tipos de riesgo, y cómo lo hace.'),
    ('NIIF S1 44 (a)(v)', 'NIIF S1 44 (a)(i)a(v)', 'Cómo supervisa la entidad los riesgos relacionados con la sostenibilidad.'),
    ('NIIF S2 36 (a)', 'NIIF S2 36 (a)a(d)', 'Para cada objetivo de emisiones de gases de efecto invernadero: qué gases de efecto invernadero cubre.'),
    ('NIIF S2 36 (b)', 'NIIF S2 36 (a)a(d)', 'Para cada objetivo de emisiones de gases de efecto invernadero: si cubre emisiones de Alcance 1, Alcance 2 o Alcance 3.'),
    ('NIIF S2 36 (c)', 'NIIF S2 36 (a)a(d)', 'Para cada objetivo de emisiones de gases de efecto invernadero: si es un objetivo de emisiones brutas o netas; si es neto, también el objetivo de emisiones brutas asociado, por separado (párrafos B68 a B69).'),
    ('NIIF S2 36 (d)', 'NIIF S2 36 (a)a(d)', 'Para cada objetivo de emisiones de gases de efecto invernadero: si se obtuvo con un enfoque de descarbonización sectorial.'),
    ('NIIF S2 36 (e)(i)', 'NIIF S2 36 (e)(i)a(iv)', 'En qué medida y de qué manera el logro de un objetivo de emisiones netas de gases de efecto invernadero depende del uso de créditos de carbono.'),
    ('NIIF S2 36 (e)(ii)', 'NIIF S2 36 (e)(i)a(iv)', 'Qué régimen o regímenes de terceros verificarán o certificarán los créditos de carbono.'),
    ('NIIF S2 36 (e)(iii)', 'NIIF S2 36 (e)(i)a(iv)', 'Tipo de crédito de carbono: si la compensación subyacente se basa en la naturaleza o en la eliminación tecnológica de carbono, y si se logra mediante reducción o eliminación de carbono.'),
    ('NIIF S2 36 (e)(iv)', 'NIIF S2 36 (e)(i)a(iv)', 'Cualquier otro factor necesario para comprender la credibilidad e integridad de los créditos de carbono que la entidad prevé utilizar (por ejemplo, supuestos sobre la permanencia de la compensación).')
),
nuevos as (
  select g.id as agrupado_id, d.id as inciso_id
    from incisos i
    join public.datapoints_taxonomia g on g.codigo = i.agrupado
    join public.datapoints_taxonomia d on d.codigo = i.codigo and d.version_taxonomia = g.version_taxonomia
)
update public.plantilla_solicitudes p
   set datapoint_ids = p.datapoint_ids || array(
         select n.inciso_id from nuevos n
          where n.agrupado_id = any(p.datapoint_ids) and not (n.inciso_id = any(p.datapoint_ids))
          order by n.inciso_id
       )
 where exists (select 1 from nuevos n where n.agrupado_id = any(p.datapoint_ids) and not (n.inciso_id = any(p.datapoint_ids)));
