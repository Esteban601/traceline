# Correcciones del catálogo NIIF que requieren tu decisión

**Para:** Manuel · **11 de septiembre de 2026**

Este documento trae **solo las filas que hay que decidir**. La tabla completa de los 91 códigos, con
las que ya coinciden y las erratas menores, está en `auditoria-catalogo.md`.

Las secciones siguen el orden de la migración `20260912120000_catalogo_niif_correcciones.sql`, que está
escrita y **sin aplicar**. Marca la casilla de cada fila que apruebes; las que dejes sin marcar se quitan
de la migración antes del `db push`.

Cita el párrafo y el número de la norma; no reproduce su texto.

| | Filas | Efecto si se aprueban todas |
|---|---:|---|
| §0 · Texto de un cliente en el catálogo | 1 | Se sustituye por el requisito. |
| §1 · Descripciones incorrectas | 22 | `UPDATE` por código exacto. |
| §3 · Requisitos sin código | 5 | 4 `INSERT` y 1 `UPDATE`. |
| §4–5 · El cruce 29(b)/29(c) propagado | 2 | Plantilla base y 15 emisoras de staging. |
| — · Códigos malformados | 8 | **No están en la migración.** Ver por qué. |

---

## §0 · La fila con texto de un cliente dentro del catálogo compartido

Es una de las 23 descripciones incorrectas, pero va aparte porque el problema no es de redacción: es
material de una emisora concreta en una tabla que leen todas.

| Código | Qué dice hoy | Qué diría | ¿Apruebas? |
|---|---|---|---|
| `NIIF S1 35(c)(i)(ii)` | En términos generales, los riesgos y oportunidades identificados en este informe pueden influir en el corto, medio y largo plazo en los siguientes elementos: Ingresos: Cambios en patrones de tráfico, restricciones… | Cómo espera la entidad que cambie su situación financiera a corto, medio y largo plazo, dada su estrategia para gestionar los riesgos y oportunidades de sostenibilidad, considerando (i) sus planes de inversión y disposición —incluidos aquellos con los que no esté comprometida contractualmente— y (ii) sus fuentes de financiación previstas para implementar su estrategia. | ☐ |

Referencia: NIIF S1 35(c)(i) y (ii).

---

## §1 · Descripciones incorrectas (22 filas)

Dicen algo distinto de lo que exige el párrafo. Entran como `UPDATE ... WHERE codigo = '…'`.

| # | Código | Párrafo | Qué está mal | Qué diría | ¿Apruebas? |
|---:|---|---|---|---|---|
| 1 | `NIIF S1 27(a)(v)` | NIIF S1 27(a)(v) | Remite a un apartado del informe en vez de al párrafo 51, y omite la parte de remuneración. | Cómo supervisa el órgano u órganos o las personas el establecimiento de objetivos relacionados con los riesgos y oportunidades de sostenibilidad y cómo controlan los avances hacia su consecución (véase el párrafo 51), incluyendo si las… | ☐ |
| 2 | `NIIF S1 30(a)y(b)` | NIIF S1 30(a) y (b) | El código nombra dos incisos; la descripción solo cubre el (a). Faltan los horizontes temporales. | Descripción de los riesgos y oportunidades relacionados con la sostenibilidad que podría esperarse razonablemente que afecten a las perspectivas de la entidad, y los horizontes temporales —corto, medio o largo plazo— en los que cabe… | ☐ |
| 3 | `NIIF S1 35(a)` | NIIF S1 35(a) | Recorta «situación financiera, rendimiento financiero y flujos de efectivo» a solo el primero. | Cómo los riesgos y oportunidades relacionados con la sostenibilidad han afectado a su situación financiera, rendimiento financiero y flujos de efectivo durante el periodo sobre el que se informa. | ☐ |
| 4 | `NIIF S1 35(d)` | NIIF S1 35(d) | Omite los flujos de efectivo. Errata «rendimineto». | Cómo espera la entidad que cambien su rendimiento financiero y sus flujos de efectivo a corto, medio y largo plazo, dada su estrategia para gestionar los riesgos y oportunidades relacionados con la sostenibilidad. | ☐ |
| 5 | `NIIF S1 74` | NIIF S1 74 | Remite a un apartado del informe en vez de describir el requisito de juicios. | Los juicios —distintos de los que implican estimaciones de importes— realizados en el proceso de preparación de la información a revelar sobre sostenibilidad y que tengan el efecto más significativo sobre la información incluida en ella. | ☐ |
| 6 | `NIIF S2 14(a)(v)` | NIIF S2 14(a)(v) | Sustituye la referencia a los párrafos 33-36 por una remisión al informe. Paréntesis sin abrir. | Cómo prevé la entidad alcanzar cualquier objetivo relacionado con el clima, incluido cualquier objetivo de emisiones de gases de efecto invernadero, descrito de conformidad con los párrafos 33 a 36. | ☐ |
| 7 | `NIIF S2 16(a)` | NIIF S2 16(a) | Recorta los tres elementos a solo «situación financiera». | Cómo los riesgos y oportunidades relacionados con el clima han afectado a su situación financiera, rendimiento financiero y flujos de efectivo durante el periodo sobre el que se informa. | ☐ |
| 8 | `NIIF S2 16(d)` | NIIF S2 16(d) | Omite los flujos de efectivo. Errata «rendimineto». | Cómo espera la entidad que cambien su rendimiento financiero y sus flujos de efectivo a corto, medio y largo plazo, teniendo en cuenta su estrategia para gestionar los riesgos y oportunidades relacionados con el clima. | ☐ |
| 9 | `NIIF S2 22(a)(i)` | NIIF S2 22(a)(i) | Describe el encabezado de 22(a), no el inciso (i). | Las implicaciones, en su caso, de la evaluación de resiliencia climática para la estrategia y el modelo de negocio de la entidad, incluida la forma en que necesitaría responder a los efectos identificados en el análisis de escenarios… | ☐ |
| 10 | `NIIF S2 22(a)(iii)` | NIIF S2 22(a)(iii) | Usa lenguaje TCFD («acceso al capital») en vez del requisito de la Norma, y pierde dos de sus tres sub-incisos. | La capacidad de la entidad para ajustar o adaptar su estrategia y su modelo de negocio al cambio climático a corto, medio y largo plazo, incluyendo la disponibilidad y flexibilidad de sus recursos financieros existentes, su capacidad de… | ☐ |
| 11 | `NIIF S2 22(b)(i)` | NIIF S2 22(b)(i) | «Analisis de escenarios» es una etiqueta, no el requisito: faltan los siete datos de entrada. | Información sobre los datos de entrada utilizados en el análisis de escenarios: qué escenarios y de qué fuentes, si el rango fue diverso, si se asocian a riesgos de transición o físicos, si se incluyó un escenario alineado con el último… | ☐ |
| 12 | `NIIF S2 29 (a)(v)` | NIIF S2 29(a)(v) | «Emisiones de Alcance 2» a secas pierde lo específico: por ubicación y los instrumentos contractuales. | Para las emisiones de Alcance 2, revelar las emisiones basadas en la ubicación y proporcionar la información sobre cualquier instrumento contractual que sea necesaria para comprender el Alcance 2 de la entidad. | ☐ |
| 13 | `NIIF S2 29 (a)(vi)(1)` | NIIF S2 29(a)(vi)(1) | Describe 29(a)(i)(3). Este inciso pide las CATEGORÍAS del Alcance 3 según el Protocolo 2011. | Las categorías incluidas dentro de la medición de las emisiones de Alcance 3 de la entidad, conforme a las categorías de Alcance 3 descritas en la Norma de Contabilidad e Informes de la Cadena de Valor Corporativa (Alcance 3) del Protocolo… | ☐ |
| 14 | `NIIF S2 29 (b) B64 y B65 inciso (a)` | NIIF S2 29(b); B65(a) | EL MÁS GRAVE. Dice «riesgos físicos» bajo el código de TRANSICIÓN. Además suma el despliegue de capital (29(e)) y un «comparativo anual» que la Norma no pide. | Riesgos de transición relacionados con el clima: la cantidad y el porcentaje de activos o actividades empresariales vulnerables a los riesgos de transición relacionados con el clima. | ☐ |
| 15 | `NIIF S2 29 (c) B64 y B65 inciso (c)` | NIIF S2 29(c); B65(c) | Dice «riesgos de transición» bajo el código de los FÍSICOS. El cruce anterior, en sentido contrario. | Cómo los riesgos físicos relacionados con el clima han afectado a la situación financiera, el rendimiento financiero y los flujos de efectivo de la entidad durante el periodo sobre el que se informa. | ☐ |
| 16 | `NIIF S2 29 (f) (i) y (ii)` | NIIF S2 29(f)(i) y (ii) | El código nombra dos incisos; falta el (ii), el precio por tonelada. | Precios internos del carbono: explicación de si la entidad aplica un precio del carbono en la toma de decisiones y cómo lo hace, y el precio por cada tonelada métrica de emisiones que utiliza para evaluar el costo de sus emisiones. | ☐ |
| 17 | `NIIF S2 29 (g) (i) y (ii)` | NIIF S2 29(g)(i) y (ii) | El código nombra dos incisos; falta el (ii), el porcentaje de remuneración vinculada. | Remuneración: descripción de si las consideraciones relacionadas con el clima se tienen en cuenta en la remuneración de los ejecutivos y de qué manera, y el porcentaje de la remuneración de la gerencia ejecutiva reconocida en el periodo… | ☐ |
| 18 | `NIIF S2 30` | NIIF S2 30 | La descripción es el contenido de 29(b). El requisito del párrafo 30 no está en ninguna fila del catálogo. | Al preparar la información a revelar para cumplir los requerimientos del párrafo 29(b) a (d), la entidad utilizará toda la información razonable y sustentable de que disponga en la fecha de presentación sin costo o esfuerzo… | ☐ |
| 19 | `NIIF S2 32` | NIIF S2 32 | «Seleccionar el tipo de sector…» es una instrucción de formulario, no el requisito. | Métricas basadas en el sector industrial asociadas con uno o más modelos de negocio, actividades u otros rasgos comunes que caractericen la participación en un sector industrial, considerando la Guía de Implementación de la NIIF S2 basada… | ☐ |
| 20 | `NIIF S2 36 (a)a(d)` | NIIF S2 36(a) a (d) | «Objetivo de emisiones de GEI» es una etiqueta; no describe ninguno de los cuatro incisos. | Para cada objetivo de emisiones de gases de efecto invernadero: qué gases cubre, si cubre emisiones de Alcance 1, 2 o 3, si es un objetivo de emisiones brutas o netas —y, si es neto, el objetivo bruto asociado revelado por separado— y si… | ☐ |
| 21 | `NIIF S2 6 (a)(iv)` | NIIF S2 6(a)(iv) | Dice «sostenibilidad» donde la S2 dice «clima»: es el texto de la S1 copiado. | Cómo tienen en cuenta los órganos o personas los riesgos y oportunidades relacionados con el clima al supervisar la estrategia de la entidad, sus decisiones sobre transacciones importantes y sus procesos de gestión de riesgos y políticas… | ☐ |
| 22 | `NIIF S2 6 (a)(v)` | NIIF S2 6(a)(v) | Dice «sostenibilidad» por «clima», remite al informe en vez de a los párrafos 33-36 y omite la remuneración. | Cómo supervisan los órganos o personas el establecimiento de objetivos relacionados con los riesgos y oportunidades climáticos y cómo controlan los avances hacia su consecución (véanse los párrafos 33 a 36), incluyendo si las métricas de… | ☐ |

---

## §3 · Requisitos que la norma exige y el catálogo no tiene (5 filas)

| # | Requisito | Párrafo | Cómo entra | Por qué falta hoy | ¿Apruebas? |
|---:|---|---|---|---|---|
| 1 | Cantidad y porcentaje de activos o actividades vulnerables a riesgos FÍSICOS | S2 29(c) | INSERT · `NIIF S2 29 (c) B64 y B65 inciso (a)` | El catálogo tenía tres códigos bajo 29(b) y solo dos bajo 29(c). Su texto existe, archivado bajo el código de transición. Hoy no hay dónde registrar la exposición física. | ☐ |
| 2 | Usar toda la información razonable y sustentable disponible sin costo o esfuerzo desproporcionado al preparar 29(b) a (d) | S2 30 | UPDATE · `NIIF S2 30` | El código existe pero describe el contenido de 29(b). El requisito del párrafo 30 no está en ninguna fila. | ☐ |
| 3 | Considerar si las métricas por sector industrial satisfacen, total o parcialmente, los requerimientos de 29(b) a (g) | S2 B65(d) | INSERT · `NIIF S2 B65 inciso (d)` | Ningún código lo recoge. El catálogo usa B65 incisos (a), (b) y (c), nunca (d) ni (e). | ☐ *(ver nota)* |
| 4 | Conexiones con los estados financieros relacionados: congruencia de datos y supuestos, y vínculos entre importes revelados y reconocidos | S2 B65(e) | INSERT · `NIIF S2 B65 inciso (e)` | Ningún código lo recoge. Es el requisito de conectividad con los estados financieros, que es lo que distingue a NIIF S2 de un reporte voluntario. | ☐ |
| 5 | Si la gerencia usa controles y procedimientos para apoyar la supervisión y cómo se integran con otras funciones internas | S1 27(b)(ii) | INSERT · `NIIF S1 27(b)(ii)` | Fuera del alcance pedido (era S2), detectado de paso. Su equivalente de la S2, 6(b)(ii), sí existía. | ☐ *(ver nota)* |

**Notas de las dos filas marcadas:**
- **S2 B65(d)** — A decidir: es una consideración de preparación, no una revelación. Si no quieres exigirla como datapoint, se borra esa fila del INSERT.
- **S1 27(b)(ii)** — A decidir: es la única fila de este documento que no salió del alcance que pediste.

---

## §4 y §5 · El cruce 29(b)/29(c), ya propagado

NIIF S2 29(b) son los riesgos de **transición** y 29(c) los **físicos**. La solicitud de plantilla
«Riesgos físicos climáticos en instalaciones» apunta al código de transición, y de la plantilla pasó a
los reportes. Con 29(c) inciso (a) creado (§3), se puede repuntar en vez de solo quitar.

| # | Qué se corrige | Alcance | ¿Apruebas? |
|---:|---|---|---|
| 1 | `plantilla_solicitudes`: el enlace pasa del código de 29(b) al de 29(c). | La plantilla base. Solo afecta a emisoras nuevas. | ☐ |
| 2 | `mapeo_solicitud_datapoint`: mismo repunte en los reportes que ya lo arrastran. | **15 emisoras de staging.** Toca datos de cliente. | ☐ |

La fila 2 está en una sección aparte al final de la migración: si se deja sin ejecutar, el resto sigue
siendo coherente. Primero crea el enlace correcto y solo después borra el equivocado, para que ninguna
solicitud se quede sin ninguno de los dos.

---

## Códigos malformados (8 filas) — no están en la migración

La referencia es incorrecta aunque el contenido suela ser correcto. **No los renombré y quiero tu**
**decisión antes de hacerlo**: siete de los ocho están citados como cadena literal en
`lib/suplemento/bloques.ts`, así que renombrar el código en la base sin tocar ese archivo deja al bloque
sin su requisito **en silencio** — que es exactamente el fallo que `validarMapeo()` existe para gritar.
Renombrar es, por tanto, un cambio de código y base a la vez, no una migración de datos.

Seis de los ocho comparten el mismo defecto: el código pega el párrafo 29(x) con un inciso de B65, que no
es un sub-requisito de 29(x) sino una consideración de preparación común a 29(b)–(g).

| # | Código actual | Debería referirse a | Qué está mal | Consecuencia de renombrarlo | ¿Apruebas renombrar? |
|---:|---|---|---|---|---|
| 1 | `IFRS S1 2023-06-26 40 a` | NIIF S1 40(a) | Mezcla el nombre inglés de la Norma con su fecha de emisión. La descripción es correcta. | No lo cita `bloques.ts`. Renombrarlo es seguro. | ☐ |
| 2 | `NIIF S2 29 (b) B64 y B65 inciso (b)` | NIIF S2 29(b) · B65(b) | Mezcla el párrafo 29(b) con el inciso (b) de B65, que no es un sub-requisito suyo sino una consideración común a 29(b)-(g). Contenido correcto. | Lo cita `bloques.ts` (bloque 34). | ☐ |
| 3 | `NIIF S2 29 (b) B64 y B65 inciso (c)` | NIIF S2 29(b) · B65(c) | Mismo cruce de código. La descripción además recorta los tres elementos financieros a uno. | Lo cita `bloques.ts` (bloque 34). | ☐ |
| 4 | `NIIF S2 29 (c) B64 y B65 inciso (b)` | NIIF S2 29(c) · B65(b) | Mismo cruce de código. Contenido correcto. | Lo cita `bloques.ts` (bloque 35). | ☐ |
| 5 | `NIIF S2 29 (d) B64 y B65 inciso (a)` | NIIF S2 29(d) · B65(a) | Mismo cruce de código. La descripción suma el despliegue de capital (29(e)) y un «comparativo anual» que la Norma no pide. | Lo cita `bloques.ts` (bloque 36). | ☐ |
| 6 | `NIIF S2 29 (d) B64 y B65 inciso (b)` | NIIF S2 29(d) · B65(b) | Mismo cruce de código. Contenido correcto; errata de concordancia «oportunidades relacionados». | Lo cita `bloques.ts` (bloque 36). | ☐ |
| 7 | `NIIF S2 29 (d) B64 y B65 inciso (c)` | NIIF S2 29(d) · B65(c) | Mismo cruce de código. Contenido correcto. | Lo cita `bloques.ts` (bloque 36). | ☐ |
| 8 | `NIIF S2 EI14 a E18` | — | «E18» sin la I. Además remite a la Guía sobre la Implementación, que no vino en los PDF: no se pudo verificar qué exige. | Lo cita `bloques.ts` (bloque 29). Antes de renombrarlo hace falta la Guía. | ☐ |

---

## Lo que no está aquí

- **19 paráfrasis aceptables y 13 erratas menores** (`cima` por `clima`, `rendimineto`, un paréntesis sin
  abrir). Van en la §2 de la migración, en bloque aparte, y se pueden aplicar o no sin tocar el resto.
- **38 códigos que coinciden** con la norma.
- **3 códigos no verificables**, porque remiten a la Guía sobre la Implementación de la NIIF S2, que no
  venía en los cuatro PDF: `NIIF S2 29 (a)(iv) EI5`, `NIIF S2 29 (a)(vi)(1) EI12` y
  `NIIF S2 EI19 a EI24`. En los dos primeros la parte del código que sí es de la Norma —29(a)(iv) y
  29(a)(vi)(1)— sí se auditó; lo que no se pudo comprobar es a qué corresponde el sufijo. El cuarto
  código con sufijo EI, `NIIF S2 EI14 a E18`, está arriba entre los malformados.

## Una cosa que conviene resolver junto con esto

`supabase/seed.sql` conserva las 36 descripciones incorrectas. Si se aplica la migración y después
alguien hace un `db reset` de dev, el catálogo vuelve a quedar mal. Cuando apruebes esta tabla, lo
sensato es regenerar el seed desde la misma fuente que la migración, para que no puedan divergir.
