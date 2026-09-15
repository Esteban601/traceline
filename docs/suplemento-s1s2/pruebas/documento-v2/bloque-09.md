# Bloque 9 · Evaluación y priorización de riesgos

**Sección:** I · Introducción · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v1-2026-09-15` |
| Longitud | 2,270 caracteres |
| Costo | $0.1466 |
| Duración | 31,278 ms |
| Velocidad | 62.4 tok/s |
| Tokens | 9,240 entrada · 1,952 salida |

---

## Texto

**Priorización de riesgos y oportunidades**

| Riesgo u oportunidad | Tipo | Probabilidad | Impacto | Severidad | Nivel |
|---|---|---:|---:|---:|---|
| Huracanes e inundaciones en la red del sureste | Riesgo físico | 5 | 4 | 20 | Crítico |
| Estrés hídrico sobre la cartera agropecuaria del norte y el Bajío | Riesgo físico | 4 | 4 | 16 | Alto |
| Precio al carbono y regulación sobre sectores intensivos en la cartera empresarial | Riesgo de transición | 4 | 3 | 12 | Medio |
| Expectativas de inversionistas y taxonomía sostenible | Riesgo de transición | 3 | 3 | 9 | Medio |
| Financiamiento sostenible a pymes y vivienda eficiente | Oportunidad | — | — | — | — |
| Eficiencia operativa de la red | Oportunidad | — | — | — | — |

Empresa Demo, S.A.B. de C.V. evalúa y prioriza sus riesgos y oportunidades relacionados con el clima mediante una matriz que asigna a cada riesgo una calificación de probabilidad y una de impacto. La severidad resulta del producto de ambas calificaciones, con un valor máximo de 25 puntos, y determina el nivel de prioridad conforme a los umbrales definidos por la Compañía: bajo, de 0 a 5 puntos; medio, de 6 a 12; alto, de 13 a 19; y crítico, de 20 a 25. La tabla anterior presenta el resultado de este ejercicio para el periodo sobre el que se informa.

Los riesgos físicos se evalúan considerando la ubicación de la red de sucursales y de los centros operativos, así como la concentración geográfica y sectorial de la cartera de crédito. Los riesgos de transición se evalúan en función de la exposición de la cartera empresarial a sectores intensivos en carbono y de las condiciones de acceso al fondeo institucional. Los niveles resultantes orientan la asignación de responsabilidades de seguimiento y la definición de las respuestas que se describen en las secciones correspondientes de este informe.

Las oportunidades relacionadas con el clima se identifican y se registran en la misma matriz, pero no se someten a la calificación de probabilidad e impacto; su priorización se realiza en función de su contribución al modelo de negocio y a los objetivos de la Compañía. La matriz se revisa cuando cambian las condiciones que sustentan la evaluación, de modo que la priorización refleje la información disponible en cada periodo.

## Fuentes

- `perfil:matriz_riesgos` — Perfil del emisor, campo matriz_riesgos
- `reg:5eb61ca7-aee8-4661-a4d2-22abb69cc695` — Registro de clima: Huracanes e inundaciones en la red del sureste (riesgo_fisico)
- `reg:c6b3a6ca-545e-443a-8666-b0cc25e09ffb` — Registro de clima: Estrés hídrico sobre la cartera agropecuaria del norte y el Bajío (riesgo_fisico)
- `reg:5d7950ee-586a-4163-8e9f-d2889ac7fa99` — Registro de clima: Precio al carbono y regulación sobre sectores intensivos en la cartera empresarial (riesgo_transicion)
- `reg:9b02370a-9453-426b-894d-0d6a8ed259c7` — Registro de clima: Expectativas de inversionistas y taxonomía sostenible (riesgo_transicion)
- `reg:20f70a95-4f3d-472d-95c7-03f3c258810b` — Registro de clima: Financiamiento sostenible a pymes y vivienda eficiente (oportunidad)
- `reg:a54697f1-4b4e-4789-aa7c-5a2854be5ed5` — Registro de clima: Eficiencia operativa de la red (oportunidad)
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- El perfil (perfil:matriz_riesgos) solo define umbrales de nivel y escala_max=25; no describe explícitamente que probabilidad e impacto se califiquen de 1 a 5 ni la periodicidad de revisión de la matriz. El texto se limitó a decir que la severidad es el producto de ambas con máximo de 25 y que la matriz 'se revisa cuando cambian las condiciones'; confirmar con la emisora si prefiere declarar una periodicidad concreta (por ejemplo, anual o trimestral) y, en su caso, aportar el dato.
- Las oportunidades aparecen en la tabla sin probabilidad, impacto ni severidad. El texto lo explica como decisión metodológica de la emisora; verificar que efectivamente no se califican y que la redacción sobre su criterio de priorización refleja la práctica real, ya que ese criterio no consta en los datos entregados.
- Los registros de clima traen métricas del ejercicio (cantidad de activos, porcentajes, capital de gasto, financiación e inversión) que no se usaron en este bloque; corresponden a los bloques 34, 35 y 36 y al 25. El registro de estrés hídrico indica cantidad_activos 10370 y porcentaje 12, mientras que la descripción dice '12% de la cartera'; conviene verificar la unidad de cantidad_activos (¿millones de pesos?) antes de que se use en otros bloques.
- Los horizontes, la concentración y las respuestas por riesgo que traen los registros se dejaron a los bloques 8, 21 y 27 para evitar duplicidad.

