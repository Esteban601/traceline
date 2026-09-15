# Bloque 24 · Oportunidades y cómo prevé alcanzar objetivos

**Sección:** III · Estrategia · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v1-2026-09-15` |
| Longitud | 2,415 caracteres |
| Costo | $0.2625 |
| Duración | 52,734 ms |
| Velocidad | 74.2 tok/s |
| Tokens | 11,018 entrada · 3,915 salida |

---

## Texto

Empresa Demo, S.A.B. de C.V. ha identificado dos oportunidades relacionadas con el clima que considera relevantes para su situación financiera, rendimiento financiero y flujos de efectivo: el financiamiento sostenible a pequeñas y medianas empresas y a vivienda eficiente, y la eficiencia operativa de su red de sucursales. Ambas oportunidades se vinculan con los objetivos climáticos que la Compañía ha establecido, y los planes que se describen a continuación constituyen la vía por la que prevé alcanzarlos.

La primera oportunidad consiste en el crecimiento de la cartera con etiqueta verde, que comprende créditos para eficiencia energética, vivienda con certificación y energía distribuida, así como el acceso a fondeo con menor costo asociado a dicha cartera. Se concentra en la originación de crédito y en la captación, con un horizonte de corto y mediano plazo, y sus efectos potenciales son mayores ingresos por intereses en segmentos de crecimiento, menor costo de fondeo y diferenciación. Al cierre de 2025 la cartera con etiqueta sostenible ascendió a 6,910 millones de pesos, equivalentes al 8.0% de la cartera total. Para llevar esa proporción al 20% en 2028, con un hito intermedio de 12% en 2026, la Compañía prevé apoyarse en alianzas con la banca de desarrollo, en la clasificación de los créditos conforme a la Taxonomía Sostenible de México y en la conciliación semestral del saldo etiquetado con la Dirección de Crédito.

La segunda oportunidad es la reducción del consumo eléctrico de la red mediante iluminación LED, climatización eficiente y generación solar distribuida en 40 sucursales. Su horizonte es de corto plazo y sus efectos potenciales son un menor gasto operativo y menores emisiones de Alcance 2. La Compañía la atiende mediante un programa 2025-2027 con una inversión de 92 millones de pesos. Este programa, junto con la renovación de flota, es el medio por el que prevé alcanzar el objetivo de reducir en 30% las emisiones brutas de Alcances 1 y 2 al 2030 respecto del periodo base 2025, con un hito intermedio de 12% al 2027; su avance se supervisa trimestralmente por sucursal.

En cuanto al objetivo de medir bajo la metodología PCAF las emisiones financiadas del 80% de la cartera empresarial en 2027, desde el 42% del periodo base, la Compañía prevé alcanzarlo mediante la depuración de datos de acreditados a cargo de la Dirección de Riesgos, con un hito de 60% en 2026.

## Fuentes

- `reg:20f70a95-4f3d-472d-95c7-03f3c258810b` — Registro de clima: Financiamiento sostenible a pymes y vivienda eficiente (oportunidad)
- `reg:a54697f1-4b4e-4789-aa7c-5a2854be5ed5` — Registro de clima: Eficiencia operativa de la red (oportunidad)
- `obj:70a56eb6-556e-4af7-86b6-b24b776e4f81` — Objetivo: Reducción de emisiones de Alcances 1 y 2
- `obj:014b1a2e-b4dc-45dd-a566-0cf6cda34388` — Objetivo: Cartera sostenible
- `obj:c6ac8144-b4dc-4769-9312-cb75be6c1e04` — Objetivo: Medición de emisiones financiadas
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- El registro de la oportunidad 'Financiamiento sostenible a pymes y vivienda eficiente' trae capital_financiacion = 2000 sin unidad ni definición (¿MDP desplegados en 2025? ¿meta?). No se usó en el texto; confirmar unidad y significado antes de considerarlo para el bloque 36 (Oportunidades: alineación y capital).
- El registro 'Eficiencia operativa de la red' trae capital_inversion = 31 sin unidad (probablemente MDP invertidos en 2025 dentro del programa de 92 MDP), y porcentaje = 34 sin denominador explícito (¿34% de las sucursales de la red?). Ambos se omitieron del texto para no inferir; confirmar y, en su caso, asignarlos al bloque 36.
- La 'renovación de flota' se menciona como medio para el objetivo de Alcances 1 y 2 porque aparece en la descripción del objetivo, pero no existe un registro de clima ni un dato de inversión que la respalde. Verificar consistencia con el bloque 23 (esfuerzos de reducción).
- El objetivo de medición de emisiones financiadas se enuncia como objetivo de cobertura (porcentaje de cartera medida), sin revelar cifras de emisiones de Alcance 3, lo que es compatible con el alivio NIIF S2 C4. Confirmar que el bloque 33 mantenga el mismo criterio.
- El objetivo 'Cartera sostenible' indica validacion_tercero = Verdadero, pero no se identifica al validador. No corresponde a este bloque; se señala para el bloque 38.
- Riesgo de traslape: los hitos intermedios y periodos de aplicación de los tres objetivos se mencionan aquí de forma resumida como vía de consecución; el bloque 38 los detallará por atributo y el bloque 40 el objetivo de GEI. El revisor puede recortar aquí si se percibe repetición.

