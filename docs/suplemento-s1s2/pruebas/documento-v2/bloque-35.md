# Bloque 35 · Riesgos físicos: exposición y gráfica

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v1-2026-09-15` |
| Longitud | 1,930 caracteres |
| Costo | $0.2539 |
| Duración | 48,332 ms |
| Velocidad | 69.0 tok/s |
| Tokens | 7,533 entrada · 3,337 salida |

---

## Texto

**Exposición a riesgos físicos y despliegue de capital**

| Concepto | Cantidad de activos | Porcentaje | Gasto de capital | Financiación | Inversión |
|---|---:|---:|---:|---:|---:|
| Huracanes e inundaciones en la red del sureste | 32 | 26 % | 18.5 | — | — |
| Estrés hídrico sobre la cartera agropecuaria del norte y el Bajío | 10,370 | 12 % | — | 640 | — |

Empresa Demo, S.A.B. de C.V. presenta en la tabla anterior la cantidad y el porcentaje de activos y actividades vulnerables a los riesgos físicos relacionados con el clima, así como el capital desplegado frente a cada uno de ellos durante 2025. De las 118 sucursales y los tres centros operativos que integran su red, 31 sucursales y el centro operativo de Mérida se ubican en zonas de alta incidencia de ciclones en Yucatán, Quintana Roo, Tabasco y Veracruz, lo que explica la exposición a huracanes e inundaciones que muestra la tabla.

Los riesgos físicos se concentran en dos puntos del modelo de negocio y de la cadena de valor de la Compañía: por una parte, en la operación de la red de sucursales del sureste y en la administración de la cartera hipotecaria y pyme de esa región; por otra, en la originación y administración de la cartera agropecuaria del norte y el Bajío, expuesta al estrés hídrico.

Durante 2025, el efecto de estos riesgos sobre la situación financiera, el rendimiento financiero y los flujos de efectivo de la Compañía se reflejó en el gasto de capital destinado a adecuaciones y seguros de la red del sureste, que ascendió a 18.5 millones de pesos. Los efectos que la Compañía identifica para el sureste comprenden el cierre temporal de sucursales, daños a inmuebles y equipo, deterioro de cartera por afectación de clientes y mayores primas de seguro. Para la cartera agropecuaria, comprenden el aumento de la cartera vencida y de las reservas, el menor valor de las garantías rurales y la reducción de la originación por estrés hídrico.

## Fuentes

- `sol:d8097e33-2453-4803-a8fd-5b26c4d2382b` — Porcentaje de activos expuestos a riesgos físicos 2025 — entregada y validada, valor 26 %
- `sol:61e2b4ce-a74e-4642-9592-57897b61713c` — Concentración de los riesgos físicos en el modelo de negocio — entregada y validada
- `sol:6d78eba9-cd0d-4770-900b-4e78c172d30a` — Efecto de los riesgos físicos en la situación financiera — entregada y validada
- `reg:5eb61ca7-aee8-4661-a4d2-22abb69cc695` — Registro de clima: Huracanes e inundaciones en la red del sureste (riesgo_fisico)
- `reg:c6b3a6ca-545e-443a-8666-b0cc25e09ffb` — Registro de clima: Estrés hídrico sobre la cartera agropecuaria del norte y el Bajío (riesgo_fisico)
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- La tabla no indica la unidad ni la moneda de las columnas Gasto de capital y Financiación; la solicitud de efecto financiero permite afirmar que los 18.5 son millones de pesos, pero la cifra de 640 de financiación no tiene respaldo en ninguna solicitud entregada y su unidad es desconocida. Conviene añadir la unidad al encabezado de la tabla.
- Las cifras del renglón de estrés hídrico (10,370 activos, 12 %, financiación 640) provienen únicamente del registro de clima reg:c6b3a6ca, cuya descripción no se recibió en este bloque; ninguna de las tres solicitudes las menciona. Verificar contra el registro qué representa el conteo (créditos, hectáreas, clientes) y sobre qué base se calcula el 12 %.
- El datapoint B65 (c) pide cómo los riesgos físicos AFECTARON durante el periodo; la solicitud sol:6d78eba9 describe en su mayor parte efectos PREVISTOS y solo aporta un efecto realizado (gasto de capital de 18.5 millones). El texto lo distingue, pero el revisor puede pedir a la emisora efectos observados en 2025 (cartera vencida, reservas, siniestros, primas) si existen.
- El porcentaje de 26 % es consistente con 32 de 121 activos (118 sucursales más tres centros operativos), 26.4 %. La base de cálculo se explicita en prosa; confirmar que la emisora acepta revelar el conteo total de su red.
- Al ser primer año de adopción bajo C3, no se presentan comparativos; el bloque no lo menciona porque corresponde al bloque 3.

