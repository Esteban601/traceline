# Auditoría del catálogo de datapoints NIIF contra el texto oficial

**Fecha de la auditoría:** 11 de septiembre de 2026 · **Base auditada:** `traceline-dev`
**Alcance:** los 91 códigos con `marco = 'NIIF'` de `datapoints_taxonomia` (las 4 filas GRI quedan fuera).

> ## ✅ Aplicada en dev el 11 de septiembre de 2026
>
> Migraciones `20260912120000_catalogo_niif_correcciones.sql` —descripciones, códigos nuevos, plantilla base y
> enlaces del tenant demo— y `20260915120000_catalogo_codigos_malformados.sql` —renombres—. `migration list`
> local == remoto (39).
>
> **Catálogo: 95 → 98 filas** (91 → 94 NIIF). **36 descripciones corregidas, 9 códigos renombrados, 3 códigos
> nuevos.** `validarMapeo()` reporta **0 faltantes**: 63 códigos citados por los 40 bloques, los 63 presentes.
>
> La columna **Estado** de cada fila dice qué se hizo con ella:
>
> | Estado | Qué significa |
> |---|---|
> | **Aplicada** | La corrección está en dev. |
> | **Diferida** | Sin base para decidir: remite a la Guía sobre la Implementación, que no se auditó. |
> | Sin cambio | La descripción ya coincidía con la norma. |
>
> **Staging no se ha tocado.** Aplicarlo allá es una operación aparte, todavía sin planear.

**Fuente.** NIIF S1 y NIIF S2, edición de junio de 2023, traducción al español aprobada por el Comité de
Revisión de la Fundación IFRS. La auditoría se hizo contra el texto en español; el inglés se usó solo como
desempate y cada uso se indica más abajo. Los PDF no se versionan: son material con licencia.

**Este documento cita párrafo y número; no reproduce el texto de la norma.** Las columnas de corrección
son redacciones propias que resumen el requisito, no transcripciones.

---

## Resumen

| Veredicto | Filas | Qué significa |
|---|---:|---|
| Coincide | 38 | La descripción dice lo que el párrafo exige. |
| Paráfrasis aceptable | 19 | Correcta en lo esencial; erratas u omisiones de detalle. |
| Descripción incorrecta | 23 | Dice algo distinto de lo que el párrafo exige. |
| Código malformado | 8 | El contenido puede ser correcto; la referencia no lo es. |
| No existe en la norma | 0 | — |
| No verificable | 3 | Remite a la Guía sobre la Implementación, no entregada. |
| **Total** | **91** | |

**Uno de cada cuatro códigos (23 de 91) describe algo distinto de lo que la norma pide.** Los tres más
graves están señalados en la tabla y resumidos al final.

### Dónde hizo falta el inglés

Tres veces, todas para confirmar y ninguna para decidir: el español era unívoco en los tres casos.

| Párrafo | Por qué se contrastó | Qué confirmó |
|---|---|---|
| S2 29(b), (c) y (d) | Es el hallazgo de mayor impacto; convenía no sostenerlo sobre una sola edición. | `transition risks` en (b), `physical risks` en (c). Sin ambigüedad. |
| S2 6(b)(i) | La S1 traduce «a nivel de gestión» y la S2 «a nivel de gerencia» para el mismo inciso; el catálogo usa «dirección». | `management-level` en ambas. «Dirección» es deriva del catálogo, no una variante de traducción. |
| S2 22(a)(iii) | La descripción del catálogo suena a TCFD; había que descartar que fuera una traducción alternativa. | `capacity to adjust or adapt its strategy and business model`, con tres sub-incisos. El catálogo describe otra cosa. |

---

## Tabla de los 91 códigos

Ordenada por norma y, dentro de cada una, por gravedad. «Texto del catálogo» va recortado a 200
caracteres cuando es más largo.

### NIIF S1 — 29 códigos

| # | Código en el catálogo | Veredicto | Texto del catálogo | Referencia oficial | Corrección propuesta | Estado |
|---:|---|---|---|---|---|---|
| 1 | `NIIF S1 27(a)(v)` | Descripción incorrecta | La forma en que el órgano o los órganos o la persona o personas supervisan el establecimiento de objetivos relacionados con los riesgos y las oportunidades relacionados con la sostenibilidad, y… | NIIF S1 27(a)(v) | Cómo supervisan el establecimiento de objetivos relacionados con riesgos y oportunidades de sostenibilidad y controlan los avances hacia su consecución (véase el párrafo 51), incluyendo si las métricas de desempeño relacionadas se incluyen en las políticas de remuneración y de qué manera. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 2 | `NIIF S1 30(a)y(b)` | Descripción incorrecta | Riesgos y oportunidades relacionados con la sostenibilidad que podría esperarse razonablemente que afecten a las perspectivas de la entidad. | NIIF S1 30(a) y (b) | El código nombra dos incisos y la descripción solo cubre (a). Añadir (b): los horizontes temporales —corto, medio o largo plazo— en los que cabe esperar razonablemente que se produzcan los efectos de cada riesgo y oportunidad. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 3 | `NIIF S1 35(a)` | Descripción incorrecta | Cómo los riesgos y oportunidades relacionados con la sostenibilidad han afectado a su situación financiera durante el periodo sobre el que se informa | NIIF S1 35(a) | La Norma pide los tres: «…han afectado a su situación financiera, rendimiento financiero y flujos de efectivo durante el periodo sobre el que se informa». La descripción omite dos. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 4 | `NIIF S1 35(c)(i)(ii)` | Descripción incorrecta | En términos generales, los riesgos y oportunidades identificados en este informe pueden influir en el corto, medio y largo plazo en los siguientes elementos: Ingresos: Cambios en patrones de tráfico,… | NIIF S1 35(c)(i) y (ii) | La descripción es texto narrativo de UNA emisora concreta (peajes, patrones de tráfico). Sustituir por el requisito: cómo espera que cambie su situación financiera a corto, medio y largo plazo dada su estrategia, considerando (i) sus planes de inversión y disposición, incluidos los no comprometidos contractualmente, y (ii) sus fuentes de financiación previstas. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 5 | `NIIF S1 35(d)` | Descripción incorrecta | Como se espera que cambien su rendimineto financiero a corto, medio y largo plazo, dada su estrategia para gestionar los riesgos y oportunidades relacionados con la sostenibilidad | NIIF S1 35(d) | Omite los flujos de efectivo y trae la errata «rendimineto»: «Cómo espera que cambien su rendimiento financiero y sus flujos de efectivo a corto, medio y largo plazo, dada su estrategia…». | **Aplicada** · 11 sep 2026 — descripción corregida |
| 6 | `NIIF S1 74` | Descripción incorrecta | Revelar la información que se considere necesaria por la Emisora a que hace referencia el apartado "Juicios, incertidumbres y errores" de la NIIF S1 | NIIF S1 74 | La descripción remite a un apartado del informe, no al requisito. Sustituir por: los juicios —distintos de los que implican estimaciones— realizados al preparar la información a revelar y que tengan el efecto más significativo sobre ella. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 7 | `IFRS S1 2023-06-26 40 a` | Código malformado | Explicación de por qué no se proporcionó información cuantitativa sobre los efectos financieros actuales o previstos de un riesgo o oportunidad identificado | NIIF S1 40(a) | Renombrar el código a `NIIF S1 40(a)`. La descripción es correcta; el código mezcla el nombre inglés de la Norma con su fecha de emisión. | **Aplicada** · 11 sep 2026 — renombrado a `NIIF S1 40(a)` |
| 8 | `NIIF S1 27(b)` | Paráfrasis aceptable | La gerencia en los procesos de gobernanza, los controles y los procedimientos utilizados para vigilar, gestionar y supervisar los riesgos y las oportunidades relacionados con la sostenibilidad | NIIF S1 27(b) | Anteponer «El papel de» a «la gerencia…», que es como lo enuncia la Norma. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 9 | `NIIF S1 27(b)(i)` | Paráfrasis aceptable | En el papel de la gerencia en los procesos de gobernanza, los controles y los procedimientos utilizados para vigilar, gestionar y supervisar los riesgos y las oportunidades relacionadas con la… | NIIF S1 27(b)(i) | Añadir la segunda mitad: «y cómo se ejerce la supervisión sobre dicho cargo o comité». Usar «a nivel de gestión» en vez de «de la dirección». | **Aplicada** · 11 sep 2026 — descripción corregida |
| 10 | `NIIF S1 32(a)` | Paráfrasis aceptable | Descripción de los efectos actuales y previstos de los riesgos y oportunidades relacionados con la sostenibilidad sobre el modelo de negocio y la cadena de valor [bloque de texto] | NIIF S1 32(a) | Quitar el resto de etiquetado XBRL «[bloque de texto]» del final. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 11 | `NIIF S1 44 (a)(i)a(v)` | Paráfrasis aceptable | Procesos y políticas relacionadas que la entidad utiliza para identificar, evaluar, priorizar y supervisar los riesgos relacionados con la sostenibilidad | NIIF S1 44(a)(i) a (v) | Correcta como encabezado agrupado; los cinco incisos no se detallan. | **Fuera de alcance** · 11 sep 2026 — la descripción es correcta como encabezado agrupado; detallar sus incisos es reagrupar el catálogo, no una corrección literal |
| 12 | `NIIF S1 46 a 50` | Paráfrasis aceptable | Métricas para riesgos y oportunidades de sostenibilidad: métricas requeridas por NIIF/SASB/CDSB/Apéndice C-NIIF S1 y métricas propias de la entidad (fuente, tipo, validación por tercero, método de… | NIIF S1 46 a 50 | Resumen razonable del bloque. SASB y CDSB no se nombran en 46–50; proceden de los párrafos 54 a 58. | **Fuera de alcance** · 11 sep 2026 — la descripción es correcta como encabezado agrupado; detallar sus incisos es reagrupar el catálogo, no una corrección literal |
| 13 | `NIIF S1 51` | Paráfrasis aceptable | Objetivos que se ha fijado la entidad y requeridos para cumplir por ley o regulación para supervisar el progreso hacia la consecución de sus objetivos estratégicos en relación con ese riesgo u… | NIIF S1 51 | Correcta como encabezado; no enumera los atributos (a) a (e) que la Norma pide por cada objetivo. | **Fuera de alcance** · 11 sep 2026 — la descripción es correcta como encabezado agrupado; detallar sus incisos es reagrupar el catálogo, no una corrección literal |
| 14 | `NIIF S1 27(a)` | Coincide | Órgano u órganos de gobernanza o personas responsables de la supervisión de los riesgos y oportunidades relacionados con la sostenibilidad | NIIF S1 27(a) | — | Sin cambio · 11 sep 2026 |
| 15 | `NIIF S1 27(a)(i)` | Coincide | Cómo se reflejan las responsabilidades relativas a los riesgos y oportunidades relacionados con la sostenibilidad en los términos de referencia a, mandatos, descripciones de funciones y otras… | NIIF S1 27(a)(i) | — | Sin cambio · 11 sep 2026 |
| 16 | `NIIF S1 27(a)(ii)` | Coincide | Cómo determina el órgano o los órganos o las personas si se dispone o se desarrollarán las habilidades y competencias adecuadas para supervisar las estrategias diseñadas para responder a los riesgos… | NIIF S1 27(a)(ii) | — | Sin cambio · 11 sep 2026 |
| 17 | `NIIF S1 27(a)(iii)` | Coincide | Cómo y con qué frecuencia se informa a los órganos o personas sobre los riesgos y oportunidades relacionados con la sostenibilidad. | NIIF S1 27(a)(iii) | — | Sin cambio · 11 sep 2026 |
| 18 | `NIIF S1 27(a)(iv)` | Coincide | Cómo tiene en cuenta el órgano o los órganos los riesgos y oportunidades relacionados con la sostenibilidad al supervisar la estrategia de la entidad, sus decisiones sobre transacciones importantes y… | NIIF S1 27(a)(iv) | — | Sin cambio · 11 sep 2026 |
| 19 | `NIIF S1 30(c)` | Coincide | Explicar cómo define la entidad el "corto plazo", el "medio plazo" y el "largo plazo" y cómo se vinculan estas definiciones a los horizontes de planificación utilizados por la entidad para la toma de… | NIIF S1 30(c) | — | Sin cambio · 11 sep 2026 |
| 20 | `NIIF S1 32(b)` | Coincide | Descripción de dónde se concentran en el modelo de negocio y en la cadena de valor de la entidad los riesgos y oportunidades relacionados con la sostenibilidad. | NIIF S1 32(b) | — | Sin cambio · 11 sep 2026 |
| 21 | `NIIF S1 33(a)` | Coincide | Cómo se ha respondido y prevé responder a los riesgos y oportunidades relacionados con la sostenibilidad en su estrategia y toma de decisiones. | NIIF S1 33(a) | — | Sin cambio · 11 sep 2026 |
| 22 | `NIIF S1 33(b)` | Coincide | Progresos realizados en relación con los planes que la entidad haya revelado en periodos anteriores sobre los que se informa, incluida la información cuantitativa y cualitativa. | NIIF S1 33(b) | — | Sin cambio · 11 sep 2026 |
| 23 | `NIIF S1 33(c)` | Coincide | Compensaciones entre los riesgos relacionados con la sostenibilidad y las oportunidades que la entidad consideró. | NIIF S1 33(c) | — | Sin cambio · 11 sep 2026 |
| 24 | `NIIF S1 35(b)` | Coincide | Riesgos y oportunidades relacionados con la sostenibilidad identificados para los que existe un riesgo significativo de un ajuste material o con importancia relativa dentro del próximo periodo anual… | NIIF S1 35(b) | — | Sin cambio · 11 sep 2026 |
| 25 | `NIIF S1 41` | Coincide | Evaluación cualitativa y, en su caso, cuantitativa de la resiliencia de su estrategia y modelo de negocio en relación con sus riesgos relacionados con la sostenibilidad, incluyendo información sobre… | NIIF S1 41 | — | Sin cambio · 11 sep 2026 |
| 26 | `NIIF S1 44 (a)(vi)` | Coincide | ¿La entidad ha cambiado los procesos que utiliza en comparación con el periodo de información anterior? | NIIF S1 44(a)(vi) | — | Sin cambio · 11 sep 2026 |
| 27 | `NIIF S1 44 (b)` | Coincide | Procesos utilizados para identificar, evaluar, priorizar y supervisar las oportunidades relacionadas con la sostenibilidad | NIIF S1 44(b) | — | Sin cambio · 11 sep 2026 |
| 28 | `NIIF S1 44 (c)` | Coincide | Grado y forma en que los procesos de identificación, evaluación, priorización y seguimiento de los riesgos y oportunidades relacionados con la sostenibilidad se integran en el proceso global de… | NIIF S1 44(c) | — | Sin cambio · 11 sep 2026 |
| 29 | `NIIF S1 72` | Coincide | ¿La entidad cumple con todos los requerimientos de las Normas NIIF de Información a Revelar sobre Sostenibilidad explícitamente y sin reservas? | NIIF S1 72 | — | Sin cambio · 11 sep 2026 |

### NIIF S2 — 62 códigos

| # | Código en el catálogo | Veredicto | Texto del catálogo | Referencia oficial | Corrección propuesta | Estado |
|---:|---|---|---|---|---|---|
| 1 | `NIIF S2 14(a)(v)` | Descripción incorrecta | Cómo prevé la entidad alcanzar cualquier objetivo relacionado con el clima, incluido cualquier objetivo de emisiones de gases de efecto invernadero, descrito de conformidad con los desarrollados en… | NIIF S2 14(a)(v) | Sustituye la referencia de la Norma («de conformidad con los párrafos 33 a 36») por una remisión a un apartado del informe, y deja un paréntesis sin abrir. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 2 | `NIIF S2 16(a)` | Descripción incorrecta | Cómo los riesgos y oportunidades relacionados con el clima han afectado a su situación financiera durante el periodo sobre el que se informa | NIIF S2 16(a) | Omite dos de los tres elementos: «…han afectado a su situación financiera, rendimiento financiero y flujos de efectivo durante el periodo sobre el que se informa». | **Aplicada** · 11 sep 2026 — descripción corregida |
| 3 | `NIIF S2 16(d)` | Descripción incorrecta | Como se espera que cambien su rendimineto financiero a corto, medio y largo plazo, dada su estrategia para gestionar los riesgos y oportunidades relacionados con el clima | NIIF S2 16(d) | Omite los flujos de efectivo y trae la errata «rendimineto»: «Cómo espera que cambien su rendimiento financiero y sus flujos de efectivo a corto, medio y largo plazo…». | **Aplicada** · 11 sep 2026 — descripción corregida |
| 4 | `NIIF S2 22(a)(i)` | Descripción incorrecta | Evaluación de su resiliencia climática en la fecha de presentación incluidos los efectos identificados en el análisis del escenario relacionado con el clima. | NIIF S2 22(a)(i) | Describe el encabezado de 22(a), no el inciso (i). Sustituir por: las implicaciones, en su caso, de la evaluación para su estrategia y modelo de negocio, incluida la forma en que la entidad necesitaría responder a los efectos identificados en el análisis de escenarios. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 5 | `NIIF S2 22(a)(iii)` | Descripción incorrecta | Como espera que afecten su capacidad de respuesta ante el cambio climático, a corto, mediano y largo plazo, los recursos financieros y operativos disponibles para hacer frente al riesgo y aprovechar… | NIIF S2 22(a)(iii) | La descripción usa lenguaje TCFD («recursos financieros y operativos», «acceso al capital»). La Norma pide la capacidad de ajustar o adaptar estrategia y modelo de negocio al cambio climático a corto, medio y largo plazo, incluyendo (1) disponibilidad y flexibilidad de los recursos financieros existentes, (2) capacidad de redistribuir, reutilizar, mejorar o desmantelar activos y (3) efecto de las inversiones actuales y planificadas en mitigación, adaptación y resiliencia. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 6 | `NIIF S2 22(b)(i)` | Descripción incorrecta | Analisis de escenarios | NIIF S2 22(b)(i) | «Analisis de escenarios» es una etiqueta, no el requisito. Sustituir por: información sobre los datos de entrada utilizados, incluidos los escenarios y sus fuentes, si el rango fue diverso, si se asocian a riesgos físicos o de transición, si se usó un escenario alineado con el último acuerdo internacional, por qué son relevantes, los horizontes temporales y el alcance de las operaciones analizadas. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 7 | `NIIF S2 29 (a)(v)` | Descripción incorrecta | Emisiones de gases de efecto invernadero de Alcance 2 | NIIF S2 29(a)(v) | «Emisiones de Alcance 2» a secas pierde el requisito. La Norma pide revelar el Alcance 2 BASADO EN LA UBICACIÓN y la información sobre cualquier instrumento contractual necesaria para comprenderlo. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 8 | `NIIF S2 29 (a)(vi)(1)` | Descripción incorrecta | Emisiones de gases de efecto invernadero de Alcance 3 | NIIF S2 29(a)(vi)(1) | «Emisiones de Alcance 3» corresponde a 29(a)(i)(3). Este inciso pide las CATEGORÍAS incluidas en la medición del Alcance 3, conforme a las categorías del Protocolo de GEI de la cadena de valor corporativa (2011). | **Aplicada** · 11 sep 2026 — descripción corregida |
| 9 | `NIIF S2 29 (b) B64 y B65 inciso (a)` | Descripción incorrecta | Riesgos físicos relacionados con el clima: cantidad y porcentaje de activos o actividades empresariales vulnerables, y despliegue de capital aplicado (comparativo anual) | NIIF S2 29(b); B65(a) | EL ERROR MÁS GRAVE. 29(b) son los riesgos DE TRANSICIÓN; la descripción dice «riesgos físicos». Además añade el despliegue de capital, que es 29(e), y un «comparativo anual» que la Norma no exige aquí. Texto correcto: cantidad y porcentaje de activos o actividades empresariales vulnerables a los riesgos de transición relacionados con el clima. | **Aplicada** · 11 sep 2026 — descripción corregida y renombrado a `NIIF S2 29 (b)` |
| 10 | `NIIF S2 29 (c) B64 y B65 inciso (c)` | Descripción incorrecta | Cómo los riesgos de transición relacionados con el clima han afectado a su situación financiera, rendimiento financiero y flujos de efectivo durante el periodo sobre el que se informa | NIIF S2 29(c); B65(c) | Dice «riesgos de transición» bajo el código de 29(c), que son los riesgos FÍSICOS. Es el mismo cruce que el de 29(b) inciso (a), en sentido contrario. | **Aplicada** · 11 sep 2026 — descripción corregida y renombrado a `NIIF S2 29 (c) · B65 (c)` |
| 11 | `NIIF S2 29 (f) (i) y (ii)` | Descripción incorrecta | ¿La entidad está aplicando un precio del carbono en la toma de decisiones? | NIIF S2 29(f)(i) y (ii) | El código nombra dos incisos y la descripción solo cubre (i). Falta (ii): el precio por tonelada métrica de emisiones que la entidad utiliza para evaluar el costo de sus emisiones. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 12 | `NIIF S2 29 (g) (i) y (ii)` | Descripción incorrecta | ¿Las consideraciones relacionadas con el clima se tienen en cuenta en la remuneración de los ejecutivos ? | NIIF S2 29(g)(i) y (ii) | El código nombra dos incisos y la descripción solo cubre (i). Falta (ii): el porcentaje de la remuneración de la gerencia ejecutiva reconocida en el periodo que está vinculada a consideraciones climáticas. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 13 | `NIIF S2 30` | Descripción incorrecta | Cantidad y porcentaje de activos o actividades empresariales vulnerables a los riesgos de transición relacionados con el clima | NIIF S2 30 | La descripción es el contenido de 29(b). El párrafo 30 dice otra cosa: al preparar la información de 29(b) a (d), la entidad usará toda la información razonable y sustentable disponible en la fecha de presentación sin costo o esfuerzo desproporcionado. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 14 | `NIIF S2 32` | Descripción incorrecta | Seleccionar el tipo de sector o sectores en las que participa: | NIIF S2 32 | «Seleccionar el tipo de sector…» es una instrucción de formulario. El párrafo pide revelar las métricas basadas en el sector industrial asociadas a los modelos de negocio, actividades o rasgos comunes que caracterizan la participación en un sector, considerando la Guía de Implementación por Sectores Industriales. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 15 | `NIIF S2 36 (a)a(d)` | Descripción incorrecta | Objetivo de emisiones de gases de efecto invernadero | NIIF S2 36(a) a (d) | «Objetivo de emisiones de GEI» es una etiqueta. Los cuatro incisos piden: qué gases cubre, qué alcances cubre, si es bruto o neto (y, si es neto, revelar por separado el bruto asociado) y si se obtuvo con un enfoque de descarbonización sectorial. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 16 | `NIIF S2 6 (a)(iv)` | Descripción incorrecta | Indicar cómo tiene en cuenta el órgano o los órganos los riesgos y oportunidades relacionados con la sostenibilidad al supervisar la estrategia de la entidad, sus decisiones sobre transacciones… | NIIF S2 6(a)(iv) | Dice «relacionados con la sostenibilidad»; en la NIIF S2 es «relacionados con el clima». Es el texto de la NIIF S1 27(a)(iv) copiado. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 17 | `NIIF S2 6 (a)(v)` | Descripción incorrecta | La forma en que el órgano o los órganos o la persona o personas supervisan el establecimiento de objetivos relacionados con los riesgos y las oportunidades relacionados con la sostenibilidad, y… | NIIF S2 6(a)(v) | Dos defectos: dice «sostenibilidad» en vez de «clima», y sustituye la referencia a los párrafos 33 a 36 por una remisión a un apartado del informe. Además omite la parte de remuneración, que en la S2 remite al párrafo 29(g). | **Aplicada** · 11 sep 2026 — descripción corregida |
| 18 | `NIIF S2 29 (b) B64 y B65 inciso (b)` | Código malformado | Descripción de dónde se concentran en el modelo de negocio y en la cadena de valor de la entidad los riesgos de transición relacionados con el clima. | NIIF S2 29(b); B65(b) | Contenido correcto. El código mezcla el párrafo 29(b) con el inciso (b) de B65, que no es un sub-requisito de 29(b) sino una consideración de preparación común a 29(b)–(g). | **Aplicada** · 11 sep 2026 — renombrado a `NIIF S2 29 (b) · B65 (b)` |
| 19 | `NIIF S2 29 (b) B64 y B65 inciso (c)` | Código malformado | Cómo los riesgos de transición relacionados con el clima han afectado a su situación financiera durante el periodo sobre el que se informa | NIIF S2 29(b); B65(c) | Código mezclado (igual que el anterior) y descripción incompleta: B65(c) remite a 16(a) y (b), que abarcan situación financiera, rendimiento financiero y flujos de efectivo. | **Aplicada** · 11 sep 2026 — descripción corregida y renombrado a `NIIF S2 29 (b) · B65 (c)` |
| 20 | `NIIF S2 29 (c) B64 y B65 inciso (b)` | Código malformado | Descripción de dónde se concentran en el modelo de negocio y en la cadena de valor de la entidad los riesgos físicos relacionados con el clima. | NIIF S2 29(c); B65(b) | Contenido correcto; código mezclado. | **Aplicada** · 11 sep 2026 — renombrado a `NIIF S2 29 (c) · B65 (b)` |
| 21 | `NIIF S2 29 (d) B64 y B65 inciso (a)` | Código malformado | Oportunidades relacionadas con el clima: cantidad y porcentaje de activos o actividades empresariales alineadas, y despliegue de capital aplicado (comparativo anual) | NIIF S2 29(d); B65(a) | Código mezclado. La descripción además suma el despliegue de capital (29(e)) y un «comparativo anual» que la Norma no exige. | **Aplicada** · 11 sep 2026 — descripción corregida y renombrado a `NIIF S2 29 (d)` |
| 22 | `NIIF S2 29 (d) B64 y B65 inciso (b)` | Código malformado | Descripción de dónde se concentran en el modelo de negocio y en la cadena de valor de la entidad las oportunidades relacionados con el clima. | NIIF S2 29(d); B65(b) | Contenido correcto; código mezclado. Errata de concordancia: «oportunidades relacionados». | **Aplicada** · 11 sep 2026 — descripción corregida y renombrado a `NIIF S2 29 (d) · B65 (b)` |
| 23 | `NIIF S2 29 (d) B64 y B65 inciso (c)` | Código malformado | Cómo las oportunidades relacionadas con el clima han afectado a su situación financiera, rendimiento financiero y flujos de efectivo durante el periodo sobre el que se informa | NIIF S2 29(d); B65(c) | Contenido correcto; código mezclado. | **Aplicada** · 11 sep 2026 — renombrado a `NIIF S2 29 (d) · B65 (c)` |
| 24 | `NIIF S2 EI14 a E18` | Código malformado | Emisiones de gases de efecto invernadero de Alcance 1 | Guía sobre la Implementación (no entregada) | Código malformado: «E18» sin la I. Además remite a la Guía sobre la Implementación, que no viene en los PDF: no verificable. | **Diferida** · 11 sep 2026 — remite a la Guía sobre la Implementación, no auditada |
| 25 | `NIIF S2 29 (a)(iv) EI5` | No verificable | Desagregación de las emisiones de gases de efecto invernadero de Alcance 1 y Alcance 2 entre el grupo contable consolidado y otras participadas excluidas. | NIIF S2 29(a)(iv) | El contenido coincide con 29(a)(iv). El sufijo «EI5» remite a la Guía sobre la Implementación, que no viene en los PDF entregados: no verificable. | **Diferida** · 11 sep 2026 — remite a la Guía sobre la Implementación, no auditada |
| 26 | `NIIF S2 29 (a)(vi)(1) EI12` | No verificable | Extracto de la información a revelar de las emisiones de gases de efecto invernadero de Alcance 3 desagregado en categorías : | NIIF S2 29(a)(vi)(1) | Contenido razonable. El sufijo «EI12» remite a la Guía sobre la Implementación, ausente de los PDF entregados: no verificable. | **Diferida** · 11 sep 2026 — remite a la Guía sobre la Implementación, no auditada |
| 27 | `NIIF S2 EI19 a EI24` | No verificable | Desagregación de una categoría de Alcance 3 por los gases que la componen: | Guía sobre la Implementación (no entregada) | Remite a la Guía sobre la Implementación, ausente de los PDF entregados: no verificable. | **Diferida** · 11 sep 2026 — remite a la Guía sobre la Implementación, no auditada |
| 28 | `NIIF S2 14(a)(iv)` | Paráfrasis aceptable | Planes de transición relacionado con el clima que tenga la entidad, incluida la información sobre los supuestos clave utilizados en el desarrollo de su plan de transición, y las dependencias en las… | NIIF S2 14(a)(iv) | Errata: «entida» por «entidad». Falta «cualquier» al inicio. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 29 | `NIIF S2 16(c)(i)(ii)` | Paráfrasis aceptable | Como se espera que cambie su situación financiera a corto, medio y largo plazo, dada su estrategia para gestionar los riesgos y oportunidades relacionados con el clima (Considerar: i) sus planes de… | NIIF S2 16(c)(i) y (ii) | Errata tipográfica: «compromet ida» con espacio intercalado. | **Aplicada** · 11 sep 2026 — descripción corregida |
| 30 | `NIIF S2 25 (a)(i)a(v)` | Paráfrasis aceptable | Procesos y políticas relacionadas que la entidad utiliza para identificar, evaluar, priorizar y supervisar los riesgos relacionados con el clima | NIIF S2 25(a)(i) a (v) | Correcta como encabezado agrupado; los cinco incisos no se detallan. | **Fuera de alcance** · 11 sep 2026 — la descripción es correcta como encabezado agrupado; detallar sus incisos es reagrupar el catálogo, no una corrección literal |
| 31 | `NIIF S2 29 (a)(i)` | Paráfrasis aceptable | Información sobre sus emisiones brutas absolutas de gases de efecto invernadero generadas durante el periodo sobre el que se informa, expresadas en toneladas métricas equivalentes de CO2 (CO2e) : | NIIF S2 29(a)(i) | No menciona la clasificación en Alcance 1, 2 y 3 que el propio inciso exige. | **Fuera de alcance** · 11 sep 2026 — la descripción es correcta como encabezado agrupado; detallar sus incisos es reagrupar el catálogo, no una corrección literal |
| 32 | `NIIF S2 29 (a)(ii)` | Paráfrasis aceptable | Información sobre la medición de sus emisiones de gases de efecto invernadero de conformidad con el Protocolo sobre Gases de Efecto Invernadero (Un Estándar Corporativo de Contabilidad y Reporte… | NIIF S2 29(a)(ii) | No recoge la excepción: salvo que una autoridad jurisdiccional o la bolsa donde cotiza requieran otro método. | **Fuera de alcance** · 11 sep 2026 — la descripción es correcta como encabezado agrupado; detallar sus incisos es reagrupar el catálogo, no una corrección literal |
| 33 | `NIIF S2 29 (a)(iii)` | Paráfrasis aceptable | Información sobre el enfoque que utiliza para medir sus emisiones de gases de efecto invernadero | NIIF S2 29(a)(iii) | No detalla los tres puntos que el inciso exige: enfoque, datos de entrada y supuestos; la razón de esa elección; y los cambios del periodo con sus motivos. | **Fuera de alcance** · 11 sep 2026 — la descripción es correcta como encabezado agrupado; detallar sus incisos es reagrupar el catálogo, no una corrección literal |
| 34 | `NIIF S2 33` | Paráfrasis aceptable | Objetivos cuantitativos y cualitativos relacionados con el clima establecidos para supervisar el progreso hacia la consecución de sus objetivos estratégicos y objetivos requeridos por ley o… | NIIF S2 33 | Correcta como encabezado; no enumera los ocho atributos (a) a (h) que la Norma exige por cada objetivo. | **Fuera de alcance** · 11 sep 2026 — la descripción es correcta como encabezado agrupado; detallar sus incisos es reagrupar el catálogo, no una corrección literal |
| 35 | `NIIF S2 34` | Paráfrasis aceptable | Información sobre su enfoque para establecer y revisar cada objetivo, y sobre cómo supervisa el progreso con respecto a cada objetivo | NIIF S2 34 | Correcta como encabezado; no enumera los incisos (a) a (d). | **Fuera de alcance** · 11 sep 2026 — la descripción es correcta como encabezado agrupado; detallar sus incisos es reagrupar el catálogo, no una corrección literal |
| 36 | `NIIF S2 6 (a)(i)` | Paráfrasis aceptable | Indicar cómo se reflejan las responsabilidades relativas a los riesgos y oportunidades relacionados con el cima en los términos de referencia a, mandatos, descripciones de funciones y otras políticas… | NIIF S2 6(a)(i) | Errata: «cima» por «clima». | **Aplicada** · 11 sep 2026 — descripción corregida |
| 37 | `NIIF S2 6 (a)(iii)` | Paráfrasis aceptable | Incicar cómo y con qué frecuencia se informa a los órganos o personas sobre los riesgos y oportunidades relacionados con el clima. | NIIF S2 6(a)(iii) | Errata: «Incicar» por «Indicar». | **Aplicada** · 11 sep 2026 — descripción corregida |
| 38 | `NIIF S2 6(b)` | Paráfrasis aceptable | La gerencia en los procesos de gobernanza, los controles y los procedimientos utilizados para vigilar, gestionar y supervisar los riesgos y las oportunidades relacionados con el cima | NIIF S2 6(b) | Errata «cima» por «clima»; anteponer «El papel de». | **Aplicada** · 11 sep 2026 — descripción corregida |
| 39 | `NIIF S2 6(b)(i)` | Paráfrasis aceptable | En el papel de la gerencia en los procesos de gobernanza, los controles y los procedimientos utilizados para vigilar, gestionar y supervisar los riesgos y las oportunidades relacionados con el clima… | NIIF S2 6(b)(i) | Añadir «y cómo se ejerce la supervisión sobre dicho cargo o comité»; usar «a nivel de gerencia» en vez de «de la dirección» (inglés: management-level). | **Aplicada** · 11 sep 2026 — descripción corregida |
| 40 | `NIIF S2 6(b)(ii)` | Paráfrasis aceptable | ¿La gerencia utiliza controles y procedimientos para apoyar la supervisión de los riesgos y oportunidades relacionados con el clima? | NIIF S2 6(b)(ii) | Añadir la segunda mitad: «y, en caso afirmativo, cómo se integran estos controles y procedimientos con otras funciones internas». | **Aplicada** · 11 sep 2026 — descripción corregida |
| 41 | `NIIF S2 10(a), (b)y(c)` | Coincide | Riesgos y oportunidades climáticos: nombre, descripción, tipo de riesgo climático (físico/transición) y horizontes temporales en los que cabe esperar razonablemente que se produzcan sus efectos | NIIF S2 10(a), (b) y (c) | — | Sin cambio · 11 sep 2026 |
| 42 | `NIIF S2 10(d)` | Coincide | Explicar cómo define la entidad el "corto plazo", el "medio plazo" y el "largo plazo" y cómo se vinculan estas definiciones a los horizontes de planificación utilizados por la entidad para la toma de… | NIIF S2 10(d) | — | Sin cambio · 11 sep 2026 |
| 43 | `NIIF S2 13(a)` | Coincide | Descripción de los efectos actuales y previstos de los riesgos y oportunidades relacionados con el clima sobre el modelo de negocio y la cadena de valor de la entidad | NIIF S2 13(a) | — | Sin cambio · 11 sep 2026 |
| 44 | `NIIF S2 13(b)` | Coincide | Descripción de dónde se concentran en el modelo de negocio y en la cadena de valor de la entidad los riesgos y oportunidades relacionados con el clima. | NIIF S2 13(b) | — | Sin cambio · 11 sep 2026 |
| 45 | `NIIF S2 14(a)(i)` | Coincide | Los cambios actuales y previstos en el modelo de negocio de la entidad, incluida su asignación de recursos, para abordar los riesgos y oportunidades relacionados con el clima | NIIF S2 14(a)(i) | — | Sin cambio · 11 sep 2026 |
| 46 | `NIIF S2 14(a)(ii)` | Coincide | Los esfuerzos directos actuales y previstos de reducción o adaptación | NIIF S2 14(a)(ii) | — | Sin cambio · 11 sep 2026 |
| 47 | `NIIF S2 14(a)(iii)` | Coincide | Los esfuerzos indirectos actuales y previstos de reducción o adaptación | NIIF S2 14(a)(iii) | — | Sin cambio · 11 sep 2026 |
| 48 | `NIIF S2 14(b)` | Coincide | Forma en que la entidad está dotando de recursos a las actividades reveladas en su estrategia y toma de decisiones, así como sus planes de seguir haciéndolo: | NIIF S2 14(b) | — | Sin cambio · 11 sep 2026 |
| 49 | `NIIF S2 14(c)` | Coincide | Información cuantitativa y cualitativa sobre el progreso de los planes revelados en periodos anteriores sobre los que se informa de acuerdo con su estrategia y toma de decisiones: | NIIF S2 14(c) | — | Sin cambio · 11 sep 2026 |
| 50 | `NIIF S2 16(b)` | Coincide | Riesgos y oportunidades relacionados con el clima identificados para los que existe un riesgo significativo de un ajuste material o con importancia relativa dentro del próximo periodo anual sobre el… | NIIF S2 16(b) | — | Sin cambio · 11 sep 2026 |
| 51 | `NIIF S2 22(a)(ii)` | Coincide | Áreas significativas de incertidumbre consideradas en la evaluación de la resiliencia climática | NIIF S2 22(a)(ii) | — | Sin cambio · 11 sep 2026 |
| 52 | `NIIF S2 22(b)(ii)` | Coincide | Supuestos clave que la entidad realizó en el análisis | NIIF S2 22(b)(ii) | — | Sin cambio · 11 sep 2026 |
| 53 | `NIIF S2 22(b)(iii)` | Coincide | Periodo sobre el que se informa en el que se ha llevado a cabo el análisis del escenario | NIIF S2 22(b)(iii) | — | Sin cambio · 11 sep 2026 |
| 54 | `NIIF S2 25 (a)(vi)` | Coincide | ¿La entidad ha cambiado los procesos que utiliza en comparación con el periodo de información anterior? | NIIF S2 25(a)(vi) | — | Sin cambio · 11 sep 2026 |
| 55 | `NIIF S2 25 (b)` | Coincide | Procesos que utiliza la entidad para identificar, evaluar, priorizar y supervisar las oportunidades relacionadas con el clima, incluida la información sobre si la entidad utiliza, y de qué manera, el… | NIIF S2 25(b) | — | Sin cambio · 11 sep 2026 |
| 56 | `NIIF S2 25 (c)` | Coincide | Grado y forma en que los procesos de identificación, evaluación, priorización y seguimiento de los riesgos y oportunidades relacionados con el clima se integran en el proceso global de gestión de… | NIIF S2 25(c) | — | Sin cambio · 11 sep 2026 |
| 57 | `NIIF S2 29 (a)(vi)(2)` | Coincide | Información adicional sobre las emisiones de gases de efecto invernadero de la Categoría 15 de la entidad o las asociadas a sus inversiones (emisiones financiadas), si las actividades de la entidad… | NIIF S2 29(a)(vi)(2) | — | Sin cambio · 11 sep 2026 |
| 58 | `NIIF S2 29 (e)` | Coincide | Información sobre la cantidad de gasto de capital, financiación o inversión aplicada a los riesgos y oportunidades relacionados con el clima: | NIIF S2 29(e) | — | Sin cambio · 11 sep 2026 |
| 59 | `NIIF S2 35` | Coincide | Información sobre sus resultados en relación con cada objetivo relacionado con el clima y un análisis de las tendencias o cambios en los resultados de la entidad | NIIF S2 35 | — | Sin cambio · 11 sep 2026 |
| 60 | `NIIF S2 36 (e)(i)a(iv)` | Coincide | Información sobre el uso previsto por la entidad de créditos de carbono para compensar las emisiones de gases de efecto invernadero con el fin de alcanzar cualquier objetivo de emisiones de gases de… | NIIF S2 36(e)(i) a (iv) | — | Sin cambio · 11 sep 2026 |
| 61 | `NIIF S2 6 (a)` | Coincide | Órgano u órganos de gobernanza o personas responsables de la supervisión de los riesgos y oportunidades relacionados con el clima | NIIF S2 6(a) | — | Sin cambio · 11 sep 2026 |
| 62 | `NIIF S2 6 (a)(ii)` | Coincide | Indicar cómo determina el órgano o los órganos o las personas si se dispone o se desarrollarán las habilidades y competencias adecuadas para supervisar las estrategias diseñadas para responder a los… | NIIF S2 6(a)(ii) | — | Sin cambio · 11 sep 2026 |

---

## Requisitos de la NIIF S2 (párrafos 6 a 37 y B64–B65) que el catálogo no cubría

| # | Requisito | Párrafo | Estado |
|---:|---|---|---|
| 1 | Cantidad y porcentaje de activos o actividades vulnerables a los **riesgos físicos** | S2 29(c) | **Aplicada** · 11 sep 2026 — insertado como `NIIF S2 29 (c)`. Su texto estaba archivado bajo el código de 29(b), que es el de transición. |
| 2 | Usar toda la información razonable y sustentable disponible sin costo o esfuerzo desproporcionado al preparar 29(b) a (d) | S2 30 | **Aplicada** · 11 sep 2026 — el código `NIIF S2 30` existía con el contenido de 29(b); se corrigió su descripción. |
| 3 | Considerar si las métricas por sector industrial satisfacen los requerimientos de 29(b) a (g) | S2 B65(d) | **Diferida** · 11 sep 2026 — decidido no incorporarlo: es una consideración de preparación, no una revelación. Se quitó del INSERT. |
| 4 | Conexiones con los estados financieros relacionados | S2 B65(e) | **Aplicada** · 11 sep 2026 — insertado como `NIIF S2 B65 inciso (e)`. |
| 5 | Si la gerencia usa controles y procedimientos y cómo se integran con otras funciones | S1 27(b)(ii) | **Aplicada** · 11 sep 2026 — insertado. Fuera del alcance pedido (era S2), se incluyó por simetría con `NIIF S2 6(b)(ii)`. |

### Cobertura agregada — sin cambio

| Requisito | Párrafo | Estado |
|---|---|---|
| Los ocho atributos por objetivo | S2 33(a) a (h) | **Fuera de alcance** — un solo código `NIIF S2 33`; los ocho se capturan en la tabla `objetivos`. Reagrupar el catálogo no es una corrección literal. |
| Enfoque para establecer y revisar objetivos | S2 34(a) a (d) | **Fuera de alcance** — ídem; el detalle vive en `objetivos_detalle`. |
| Datos de entrada y supuestos del análisis de escenarios | S2 22(b)(i) y (ii) | **Fuera de alcance** — el detalle vive en las hojas de cuestionario. |

---

## Lo que quedó pendiente después de aplicar

**`NIIF S2 29 (c)` no lo cita ningún bloque.** El requisito ya tiene código, pero `lib/suplemento/bloques.ts` no
lo enumera en el bloque 35 (riesgos físicos: exposición y gráfica), que es a donde corresponde. Añadirlo es una
decisión de MAPEO, no una corrección literal del catálogo, así que se dejó fuera de esta aplicación. Mientras
tanto, `validarMapeo()` lo cuenta entre los 31 códigos del catálogo sin bloque, que no es un fallo.

**Los cuatro códigos con sufijo EI siguen sin verificar.** `NIIF S2 29 (a)(iv) EI5`,
`NIIF S2 29 (a)(vi)(1) EI12`, `NIIF S2 EI14 a E18` y `NIIF S2 EI19 a EI24` remiten a la Guía sobre la
Implementación de la NIIF S2, que no está entre los PDF auditados. El tercero está además malformado —le falta
la I de `EI18`— y aun así no se tocó: corregirlo exigiría comprobar a qué apunta. Con la Guía a la vista, los
cuatro se auditan en una pasada corta.

**Staging no se ha tocado.** El enlace cruzado 29(b)/29(c) sigue vivo en las 15 emisoras de staging. Aplicarlo
allá es una operación aparte, todavía sin planear.

---

## Los tres hallazgos que motivaron todo esto

**1 · Los riesgos de transición y los físicos estaban cruzados en 29(b) y 29(c).** NIIF S2 29(b) son los de
transición y 29(c) los físicos; el catálogo lo decía al revés en dos filas, y `plantilla_solicitudes` ligaba la
solicitud de riesgos físicos al código de transición. **Corregido en dev**: descripciones, código nuevo de
29(c), plantilla base y los enlaces del tenant demo.

**2 · Había texto de un cliente concreto dentro del catálogo compartido.** La descripción de
`NIIF S1 35(c)(i)(ii)` era una redacción sobre peajes, patrones de tráfico y tarifas. **Corregida.**

**3 · Siete descripciones remitían al informe en vez de a la norma** — «desarrollados en el apartado … del
presente informe», «Seleccionar el tipo de sector». Restos de la plantilla de captura. **Corregidas.**

Un cuarto patrón, menor pero repetido: cinco descripciones recortaban «situación financiera, rendimiento
financiero y flujos de efectivo» a solo el primer término. **Corregidas las cinco.**

---

## El mismo cruce, propagado al Excel · 11 de septiembre de 2026

La auditoría corrigió el catálogo en la base, pero el cruce 29(b)/29(c) también
vivía en la plantilla `assets/taxonomia-base.xlsx`, que es otra copia del mismo
origen. Corregir una no corregía la otra.

### Lo que estaba mal

| Dónde | Decía | Debía decir |
|---|---|---|
| Nombre de la hoja principal | `Fondo I` — el nombre de un cliente | `Taxonomía NIIF S1 S2` |
| Columna D de la hoja índice | Texto congelado con los errores del catálogo, incluido un párrafo sobre peajes y tarifas de un cliente | Se escribe desde `datapoints_taxonomia` en cada export |
| Pestaña con contenido de riesgos **físicos** | `NIIF S2 29(b)` — que es transición | `NIIF S2 29(c)` |
| Pestaña con contenido de riesgos **de transición** | `NIIF S2 30` — que es la exención por costo desproporcionado | `NIIF S2 29(b)` |
| Cabeceras A1 de esas dos hojas | Los mismos códigos cruzados | Corregidas |
| Cuatro celdas de la columna B de la hoja índice | `NIIF S2 30` como código de las filas de cantidad, porcentaje y despliegue de capital de los tres bloques | `29 (b)`, `29 (c)` y `29 (d)` según el subtítulo |

El contenido de las dos hojas de riesgo **siempre fue el correcto**: sus columnas
hablaban del riesgo que les corresponde, de arriba abajo. Lo único equivocado era
la etiqueta. Por eso no hubo cifras que mover.

### Qué se hizo

`scripts/preparar-plantilla-taxonomia.mjs` y `scripts/corregir-hojas-riesgo.mjs`,
ambos idempotentes, más dos migraciones de red de seguridad para `mapeo_export`
(`20260916120000` y `20260917120000`) que hoy afectan a cero filas: esa tabla
solo mapea las dos hojas GEI, pero el nombre de hoja es la llave con la que el
export busca la pestaña.

Se insertaron además las dos filas que faltaban: `NIIF S1 27(b)(ii)` y
`NIIF S2 B65 inciso (e)`, los dos códigos que la auditoría creó y que la
plantilla no tenía. Solo con el código en la columna B; la descripción la escribe
el export.

### Lo que queda

`NIIF S2 30` ya no tiene fila en la hoja índice. Es coherente: el párrafo 30 no
es una revelación sino una instrucción de preparación —usar la información
razonable disponible sin costo o esfuerzo desproporcionado—, así que no le
corresponde una fila de requisito. Si se decide que debe aparecer, hay que darle
una fila propia, no reutilizar la de otro.
