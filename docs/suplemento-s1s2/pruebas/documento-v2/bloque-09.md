# Bloque 9 · Evaluación y priorización de riesgos

**Sección:** I · Introducción · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v2-2026-09-15` |
| Longitud | 2,321 caracteres |
| Costo | $0.1407 |
| Duración | 31,444 ms |
| Velocidad | 58.4 tok/s |
| Tokens | 9,300 entrada · 1,837 salida |

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

Empresa Demo, S.A.B. de C.V. evalúa y prioriza los riesgos y oportunidades relacionados con el clima mediante una matriz que combina la probabilidad de ocurrencia de cada riesgo con la magnitud de su impacto sobre la operación, la cartera y la captación. Ambas dimensiones se califican en una escala de uno a cinco y su combinación produce una calificación de severidad cuyo valor máximo es 25. Esa calificación se traduce en cuatro niveles de prioridad: bajo, entre cero y cinco puntos; medio, entre seis y doce; alto, entre trece y diecinueve; y crítico, entre veinte y veinticinco.

La tabla anterior presenta el resultado de esa evaluación para el ejercicio 2025. Los riesgos físicos, asociados a la exposición de la red de sucursales del sureste a ciclones e inundaciones y a la exposición de la cartera agropecuaria a la escasez de agua, ocupan los niveles superiores de la matriz. Los riesgos de transición, vinculados a la regulación sobre sectores intensivos en carbono dentro de la cartera empresarial y a las expectativas de los inversionistas institucionales, se ubican en el nivel medio.

Las oportunidades relacionadas con el clima se identifican y describen con los mismos criterios de ubicación en la cadena de valor y horizonte temporal, pero no se someten a la calificación de probabilidad e impacto, ya que la matriz de severidad se aplica exclusivamente a riesgos. El nivel asignado a cada riesgo determina la frecuencia de su seguimiento y el orden en que la Compañía asigna medidas de respuesta, lo que se describe en las secciones correspondientes de este informe.

## Fuentes

- `reg:5eb61ca7-aee8-4661-a4d2-22abb69cc695` — Registro de clima: Huracanes e inundaciones en la red del sureste (riesgo_fisico)
- `reg:c6b3a6ca-545e-443a-8666-b0cc25e09ffb` — Registro de clima: Estrés hídrico sobre la cartera agropecuaria del norte y el Bajío (riesgo_fisico)
- `reg:5d7950ee-586a-4163-8e9f-d2889ac7fa99` — Registro de clima: Precio al carbono y regulación sobre sectores intensivos en la cartera empresarial (riesgo_transicion)
- `reg:9b02370a-9453-426b-894d-0d6a8ed259c7` — Registro de clima: Expectativas de inversionistas y taxonomía sostenible (riesgo_transicion)
- `reg:20f70a95-4f3d-472d-95c7-03f3c258810b` — Registro de clima: Financiamiento sostenible a pymes y vivienda eficiente (oportunidad)
- `reg:a54697f1-4b4e-4789-aa7c-5a2854be5ed5` — Registro de clima: Eficiencia operativa de la red (oportunidad)
- `perfil:matriz_riesgos` — Perfil del emisor, campo matriz_riesgos
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- El perfil (perfil:matriz_riesgos) solo define los rangos de los niveles y la escala máxima de 25; la afirmación de que la severidad resulta de combinar probabilidad e impacto (producto) se dedujo de las cifras de la tabla (5×4=20, 4×4=16, 4×3=12, 3×3=9) y de la escala 1–5. Conviene que el cliente confirme que ese es el método formal de su matriz.
- Las oportunidades no traen probabilidad, impacto ni severidad en los registros ni en la tabla. El texto lo enuncia como criterio metodológico de la emisora (la matriz aplica solo a riesgos); si en realidad es una omisión de datos y no una decisión de método, hay que corregir la frase.
- La última frase remite de forma genérica a otras secciones (respuestas por riesgo van en bloques 21 y 27; horizontes en bloque 8). No se detallaron horizontes ni respuestas para no invadir esos bloques; si el revisor prefiere, puede eliminarse la remisión.
- Los registros incluyen métricas del ejercicio (cantidad de activos, porcentajes, capital) que no se usaron aquí porque corresponden a los bloques 34, 35 y 36; verificar que ahí se aprovechen.

