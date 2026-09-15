# Bloque 9 · Evaluación y priorización de riesgos

**Sección:** I · Introducción · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Longitud | 2,399 caracteres |
| Costo | $0.1862 |
| Duración | 40,973 ms |
| Velocidad | 76.8 tok/s |
| Tokens | 6,860 entrada · 3,148 salida |

---

## Texto

**Priorización de riesgos y oportunidades**

| Riesgo u oportunidad | Tipo | Probabilidad | Impacto | Severidad | Nivel |
|---|---|---:|---:|---:|---|
| Estrés hídrico en planta norte | Riesgo físico | — | — | — | — |
| Inundación costera en centro de distribución | Riesgo físico | — | — | — | — |
| Precio del carbono y endurecimiento regulatorio | Riesgo de transición | — | — | — | — |
| Eficiencia energética en operaciones | Oportunidad | — | — | — | — |
| Línea de productos bajos en carbono | Oportunidad | — | — | — | — |

Empresa Demo SAB de CV evalúa y prioriza sus riesgos y oportunidades relacionados con el clima mediante una matriz que combina la probabilidad de ocurrencia de cada evento con la magnitud de su impacto sobre la situación financiera, el rendimiento financiero y los flujos de efectivo. Del producto de ambas variables resulta una calificación de severidad en una escala cuyo valor máximo es de veinticinco puntos, la cual se clasifica en cuatro niveles: crítico, para severidades de veinte a veinticinco puntos; alto, de doce a diecinueve; medio, de seis a once; y bajo, de cero a cinco. El nivel asignado determina el orden de atención de cada riesgo u oportunidad y la forma en que se incorpora en los procesos de gestión de riesgos de La Compañía.

La tabla anterior presenta los riesgos y oportunidades identificados para el ejercicio 2025 y su clasificación por tipo. Los riesgos físicos comprenden el estrés hídrico en la planta norte, asociado a sequías recurrentes que reducen la disponibilidad de agua para procesos y considerado en los horizontes de corto y mediano plazo, así como la exposición del centro de distribución del golfo a marejadas e inundación por elevación del nivel del mar, considerada en el largo plazo. El riesgo de transición corresponde al aumento de costos operativos por impuestos al carbono y regulación de emisiones en jurisdicciones clave, en los horizontes de mediano y largo plazo. Las oportunidades identificadas son el ahorro por eficiencia energética y autoconsumo solar en instalaciones propias, en el corto plazo, y el desarrollo de una línea de productos de baja huella de carbono para mercados con preferencia sostenible, en el mediano y largo plazo.

[Pendiente: calificaciones de probabilidad, impacto, severidad y nivel resultante para cada riesgo y oportunidad — campos probabilidad e impacto de los registros de clima]

## Fuentes

- `reg:f0000000-0000-0000-0000-000000000001` — Registro de clima: [DEMO] Estrés hídrico en planta norte (riesgo_fisico)
- `reg:f0000000-0000-0000-0000-000000000002` — Registro de clima: [DEMO] Inundación costera en centro de distribución (riesgo_fisico)
- `reg:f0000000-0000-0000-0000-000000000003` — Registro de clima: [DEMO] Precio del carbono y endurecimiento regulatorio (riesgo_transicion)
- `reg:f0000000-0000-0000-0000-000000000004` — Registro de clima: [DEMO] Eficiencia energética en operaciones (oportunidad)
- `reg:f0000000-0000-0000-0000-000000000005` — Registro de clima: [DEMO] Línea de productos bajos en carbono (oportunidad)
- `perfil:matriz_riesgos` — Perfil del emisor, campo matriz_riesgos
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

- calificaciones de probabilidad, impacto, severidad y nivel resultante para cada riesgo y oportunidad — campos probabilidad e impacto de los registros de clima

## Notas para el revisor — no se publican

- El estado de completitud marca 'completo' (2 de 2), pero la tabla armada trae vacías las columnas Probabilidad, Impacto, Severidad y Nivel para los cinco registros. Sin esas calificaciones el bloque no puede afirmar la priorización efectiva; se dejó un solo marcador de pendiente que cubre los cinco registros. Confirmar si los registros de clima tienen los campos de probabilidad e impacto capturados en la plataforma o si deben solicitarse al cliente.
- La matriz del perfil (escala_max 25, niveles Crítico 20-25, Alto 12-19, Medio 6-11, Bajo 0-5) se describió en prosa como probabilidad × impacto en escala de 25. El perfil no dice explícitamente que ambas variables sean de 1 a 5; verificar con el cliente que esa es la mecánica antes de publicar.
- Los registros 1 a 4 traen metricas_del_ejercicio (cantidad_activos, porcentaje, capital_gasto, capital_financiacion, capital_inversion). No se usaron en este bloque porque corresponden a los bloques 34 (riesgos de transición), 35 (riesgos físicos) y 36 (oportunidades). El registro 5 (línea de productos bajos en carbono) no trae métricas del ejercicio; el registro 2 trae capital_inversion nulo. Avisar a quien redacte esos bloques.
- Los horizontes de cada registro se mencionaron en prosa para dar contexto que la tabla no incluye; la definición de los horizontes (qué años abarca corto, mediano y largo plazo) corresponde al bloque 8 y no se repitió aquí.
- Los nombres de los registros llevan el prefijo '[DEMO]'; se omitió en el texto. Confirmar que los nombres definitivos coinciden con los usados en la tabla.
- No se incluyó mención al alivio C3 (sin comparativos) para no invadir el bloque 3; si el revisor prefiere una frase sobre la ausencia de priorización comparativa del periodo anterior, puede añadirse al cierre.

