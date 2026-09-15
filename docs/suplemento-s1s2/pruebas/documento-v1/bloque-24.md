# Bloque 24 · Oportunidades y cómo prevé alcanzar objetivos

**Sección:** III · Estrategia · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Longitud | 2,641 caracteres |
| Costo | $0.3337 |
| Duración | 57,658 ms |
| Velocidad | 79.6 tok/s |
| Tokens | 9,398 entrada · 4,591 salida |

---

## Texto

Empresa Demo SAB de CV ha identificado dos oportunidades relacionadas con el clima que considera relevantes para su situación financiera, rendimiento financiero y flujos de efectivo, y que se vinculan con los objetivos que se ha fijado. La primera consiste en el ahorro derivado de la eficiencia energética y del autoconsumo solar en instalaciones propias, con efectos previstos en el corto plazo y con seis activos involucrados, equivalentes al 30% del total considerado. La segunda corresponde al desarrollo de una nueva línea de productos de baja huella de carbono orientada a mercados con preferencia por atributos sostenibles, cuyos efectos se prevén en el mediano y largo plazo; para esta oportunidad La Compañía no ha cuantificado aún métricas del ejercicio.

La Compañía prevé alcanzar sus objetivos climáticos apoyándose principalmente en la primera de estas oportunidades. El objetivo de reducir 42% las emisiones absolutas de gases de efecto invernadero de Alcance 1 y 2 al 2030 respecto de 2023, con un hito intermedio de 25% al 2027 para el conjunto de sus operaciones propias, y el objetivo de reducir 50% la intensidad de emisiones por tonelada producida al 2030 respecto de 2022 en las unidades de negocio manufactureras, con un hito intermedio de 30% al 2027, se sustentan en la electrificación de la flota y en las mejoras de eficiencia térmica, que han sido los principales impulsores del avance observado al cierre de 2025, de 12% de reducción absoluta acumulada y de 18% de reducción de intensidad. Ambos objetivos cuentan con validación de un tercero.

Adicionalmente, La Compañía se ha fijado el objetivo de incrementar la participación de energía renovable sobre su consumo total de energía durante el periodo 2024–2030, medido como porcentaje del consumo. [Pendiente: meta cuantitativa o cualitativa, parte de la entidad a la que aplica, periodo base, hitos intermedios, tipo (absoluto o de intensidad) y alineación con acuerdo internacional — objetivo Consumo de energía renovable]

En materia de sostenibilidad, La Compañía identifica como oportunidad el incremento de la proporción de mujeres en puestos de dirección y gerencia, con la meta de alcanzar 40% de mujeres en posiciones de liderazgo al 2028 respecto de 2023, un hito intermedio de 30% al 2026 y aplicación a toda la entidad; al cierre de 2025 dicha proporción alcanzó 34%. [Pendiente: alineación con acuerdo internacional — objetivo Mujeres en posiciones de liderazgo]

La Compañía prevé continuar cuantificando los efectos de la línea de productos bajos en carbono y completar la definición del objetivo de energía renovable en periodos subsecuentes.

## Fuentes

- `reg:f0000000-0000-0000-0000-000000000004` — Registro de clima: [DEMO] Eficiencia energética en operaciones (oportunidad)
- `reg:f0000000-0000-0000-0000-000000000005` — Registro de clima: [DEMO] Línea de productos bajos en carbono (oportunidad)
- `obj:d0000000-0000-0000-0000-000000000001` — Objetivo: [DEMO] Reducción absoluta de emisiones GEI (Alcance 1 y 2)
- `obj:d0000000-0000-0000-0000-000000000002` — Objetivo: [DEMO] Intensidad de carbono por tonelada producida
- `obj:d0000000-0000-0000-0000-000000000003` — Objetivo: [DEMO] Mujeres en posiciones de liderazgo
- `obj:d0000000-0000-0000-0000-000000000004` — Objetivo: [DEMO] Consumo de energía renovable
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

- [Pendiente: meta cuantitativa o cualitativa, parte de la entidad a la que aplica, periodo base, hitos intermedios, tipo (absoluto o de intensidad) y alineación con acuerdo internacional — objetivo Consumo de energía renovable]
- [Pendiente: alineación con acuerdo internacional — objetivo Mujeres en posiciones de liderazgo]

## Notas para el revisor — no se publican

- El vínculo entre la oportunidad de eficiencia energética/autoconsumo solar y los objetivos de Alcance 1 y 2 e intensidad es una conexión cualitativa razonable pero no explícita en los registros; los impulsores citados (electrificación de flota, eficiencia térmica) provienen del campo analisis_tendencias de obj 1 y 2. Confirmar con la emisora que esa es la vía prevista.
- Las métricas de capital de la oportunidad reg:...0004 (capital_gasto 2,100,000; capital_financiacion 900,000; capital_inversion 700,000) se dejaron fuera de este bloque porque corresponden al bloque 36 (Oportunidades: alineación y capital). La moneda no está especificada en los datos.
- El 'porcentaje' de 30% de reg:...0004 se enunció como 'del total considerado' porque el dato no indica la base (¿activos, ingresos, capacidad?). Precisar la base o retirar la cifra.
- La oportunidad reg:...0005 (línea de productos bajos en carbono) tiene metricas_del_ejercicio null; no se marcó como pendiente porque el estado de completitud no la lista como faltante, pero podría valorarse si la emisora quiere revelar alguna cuantificación.
- Los resultados 12%, 18% y 34% también corresponden al bloque 39 (resultados); se incluyeron de forma breve como contexto de 'cómo prevé alcanzar'. Si el revisor prefiere evitar la duplicación, retirar la última frase del segundo párrafo y la cifra de 34%.
- El objetivo obj:...0003 es de ámbito sostenibilidad (no climático); el marcador de alineación con acuerdo internacional se puso porque el estado de completitud lo exige, pero el revisor puede valorar si ese atributo aplica a un objetivo de diversidad o si procede declarar 'no aplicable'.
- El objetivo obj:...0004 (energía renovable) carece de meta, parte de la entidad, periodo base, hitos, tipo y alineación, y no tiene detalle. Con solo métrica y periodo de aplicación, su revelación es muy limitada; considerar si conviene omitirlo de este ejercicio o completarlo antes de publicar.
- Primer año de adopción con alivio C3: no se incluyeron comparativos. Si la emisora desea revelar voluntariamente la evolución 2024–2025 de los objetivos, los datos no lo permiten con la información actual.

