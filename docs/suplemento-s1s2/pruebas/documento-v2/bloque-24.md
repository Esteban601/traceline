# Bloque 24 · Oportunidades y cómo prevé alcanzar objetivos

**Sección:** III · Estrategia · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v2-2026-09-15` |
| Longitud | 2,231 caracteres |
| Costo | $0.2194 |
| Duración | 40,612 ms |
| Velocidad | 75.2 tok/s |
| Tokens | 11,078 entrada · 3,056 salida |

---

## Texto

Empresa Demo, S.A.B. de C.V. identificó dos oportunidades relacionadas con el clima con efecto previsible sobre su situación financiera, rendimiento financiero y flujos de efectivo: el financiamiento sostenible a pymes y vivienda eficiente, y la eficiencia operativa de su red de sucursales. Ambas se vinculan de manera directa con los objetivos climáticos que la Compañía fijó para el periodo 2026-2030, de modo que la forma en que prevé aprovecharlas coincide con la forma en que prevé alcanzar dichos objetivos.

La primera oportunidad se concentra en la originación de crédito y en la captación. Consiste en el crecimiento de la cartera con etiqueta verde, que abarca eficiencia energética, vivienda con certificación y energía distribuida, y en el acceso a fondeo de menor costo asociado a esa cartera. Sus efectos potenciales son mayores ingresos por intereses en segmentos de crecimiento, un menor costo de fondeo y la diferenciación de la oferta, en horizontes de corto y mediano plazo. Para materializarla, la Compañía estableció el objetivo de llevar la cartera con etiqueta sostenible, conforme a la Taxonomía Sostenible de México, del 8.0% de la cartera total en 2025 al 20% en 2028, con un hito intermedio de 12% en 2026. El avance descansa en alianzas con la banca de desarrollo, en la conciliación semestral del saldo etiquetado con la Dirección de Crédito y en la revisión semestral por parte del Comité de Sostenibilidad y Riesgos Climáticos.

La segunda oportunidad se concentra en la operación y la red de sucursales. Comprende la reducción del consumo eléctrico mediante iluminación LED, climatización eficiente y generación solar distribuida en 40 sucursales, con horizonte de corto plazo, y sus efectos previstos son un menor gasto operativo y menores emisiones de Alcance 2. Esta oportunidad constituye el vehículo del objetivo de reducir en 30% las emisiones brutas de Alcances 1 y 2 al 2030 respecto del periodo base 2025, con un hito de 12% al 2027, al que se suma la renovación de la flota. La Compañía prevé alcanzarlo mediante un programa 2025-2027 con una inversión de 92 millones de pesos, el seguimiento trimestral del consumo y de las emisiones por sucursal y la revisión anual por el mismo Comité.

## Fuentes

- `reg:20f70a95-4f3d-472d-95c7-03f3c258810b` — Registro de clima: Financiamiento sostenible a pymes y vivienda eficiente (oportunidad)
- `reg:a54697f1-4b4e-4789-aa7c-5a2854be5ed5` — Registro de clima: Eficiencia operativa de la red (oportunidad)
- `obj:70a56eb6-556e-4af7-86b6-b24b776e4f81` — Objetivo: Reducción de emisiones de Alcances 1 y 2
- `obj:014b1a2e-b4dc-45dd-a566-0cf6cda34388` — Objetivo: Cartera sostenible
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- Se omitieron deliberadamente las métricas de capital de las oportunidades (6,910 MDP de cartera etiquetada, 2,000 MDP de capital_financiacion, 31 MDP de capital_inversion 2025, porcentaje 34) porque el bloque 36 'Oportunidades: alineación y capital' las cubre; verificar que aparezcan ahí y no se dupliquen.
- Los atributos de los objetivos (periodo base, hito, tipo, validación de tercero, metodología) se enuncian aquí solo en lo necesario para explicar cómo se prevé alcanzarlos; los bloques 38 y 40 los desarrollan en detalle. Revisar solapamiento de las cifras 30%/2030, 12%/2027, 8.0%→20%/2028 y 12%/2026 entre bloques.
- Posible inconsistencia a revisar: el registro 'Eficiencia operativa de la red' declara un programa 2025-2027 de 92 MDP, mientras que capital_inversion del ejercicio es 31 MDP; el texto presenta 92 MDP como inversión total del programa y no como cifra del ejercicio. Confirmar la lectura con el cliente.
- El objetivo 'Medición de emisiones financiadas' (obj:c6ac8144) no se incluyó porque es de naturaleza riesgo y de cobertura de medición, no una oportunidad; queda para los bloques 33 y 38.
- La oportunidad de cartera sostenible se relaciona con el riesgo de transición 'Expectativas de inversionistas y taxonomía sostenible' (marco de bonos verdes, Política de Financiamiento Sostenible); una revelación voluntaria podría conectar ambos en este bloque, pero se dejó al bloque 34/21 para evitar repetición.

