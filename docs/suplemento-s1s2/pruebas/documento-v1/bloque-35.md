# Bloque 35 · Riesgos físicos: exposición y gráfica

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Longitud | 1,681 caracteres |
| Costo | $0.2081 |
| Duración | 36,415 ms |
| Velocidad | 75.2 tok/s |
| Tokens | 6,038 entrada · 2,738 salida |

---

## Texto

**Exposición a riesgos físicos y despliegue de capital**

| Concepto | Cantidad de activos | Porcentaje | Gasto de capital | Financiación | Inversión |
|---|---:|---:|---:|---:|---:|
| Estrés hídrico en planta norte | 3 | 12.5 % | 450,000 | 120,000 | 80,000 |
| Inundación costera en centro de distribución | 1 | 4.2 % | 180,000 | 60,000 | — |

Empresa Demo SAB de CV identifica dos riesgos físicos relacionados con el clima a los que se encuentran expuestos sus activos: el estrés hídrico que afecta a la planta norte y la inundación costera que afecta al centro de distribución. La tabla anterior presenta, para cada uno de ellos, la cantidad de activos vulnerables, el porcentaje que estos representan y los recursos de gasto de capital, financiación e inversión asociados a su atención. El primero de los riesgos concentra la mayor parte de los activos expuestos y de los recursos desplegados, mientras que el segundo se limita a una sola instalación de la red de distribución de La Compañía, sin que se le haya asignado inversión en el periodo.

[Pendiente: descripción de dónde se concentran los riesgos físicos relacionados con el clima en el modelo de negocio y en la cadena de valor — NIIF S2 29 (c) · B65 (b)]

[Pendiente: cómo los riesgos físicos relacionados con el clima han afectado a la situación financiera, el rendimiento financiero y los flujos de efectivo durante el ejercicio 2025 — NIIF S2 29 (c) · B65 (c)]

La Compañía prevé continuar con la identificación y cuantificación de los activos y actividades empresariales vulnerables a los riesgos físicos relacionados con el clima, así como con la evaluación de sus efectos financieros, en periodos subsecuentes.

## Fuentes

- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025
- `reg:f0000000-0000-0000-0000-000000000001` — Registro de clima: Estrés hídrico en planta norte (riesgo_fisico)
- `reg:f0000000-0000-0000-0000-000000000002` — Registro de clima: Inundación costera en centro de distribución (riesgo_fisico)

## Pendientes

- [Pendiente: descripción de dónde se concentran los riesgos físicos relacionados con el clima en el modelo de negocio y en la cadena de valor — NIIF S2 29 (c) · B65 (b)]
- [Pendiente: cómo los riesgos físicos relacionados con el clima han afectado a la situación financiera, el rendimiento financiero y los flujos de efectivo durante el ejercicio 2025 — NIIF S2 29 (c) · B65 (c)]

## Notas para el revisor — no se publican

- Inconsistencia: el estado de completitud marca NIIF S2 29 (c) como sin_solicitud, pero la tabla armada por el sistema ya reporta cantidad y porcentaje de activos vulnerables para dos riesgos físicos a partir de los registros de clima reg:f0000000-...-0001 y reg:f0000000-...-0002. Se dio por cubierto el datapoint con la tabla; confirmar que los registros son la fuente aceptada para 29 (c).
- La tabla no indica la base sobre la que se calcula el porcentaje (total de activos, activos fijos, número de sitios). El texto evita afirmar la base; conviene precisarla en el encabezado de la tabla o en el bloque 34/13.
- Las columnas de gasto de capital, financiación e inversión no traen moneda ni unidad (pesos, miles, USD). Debe agregarse a la tabla antes de publicar.
- Las columnas de gasto de capital, financiación e inversión corresponden más al requisito NIIF S2 29 (e) (despliegue de capital) que a 29 (c); verificar que no se dupliquen con el bloque 34 o 25.
- Los datapoints B65 (b) y B65 (c) no tienen solicitud en el reporte; se requiere abrir solicitudes de narrativa sobre concentración en modelo de negocio/cadena de valor y sobre efectos financieros en el periodo.
- Por el alivio C3 no se presentan comparativos; el texto no lo menciona porque corresponde al bloque 3.
- Revelación voluntaria posible: si la emisora cuenta con descripción de medidas de adaptación concretas para la planta norte y el centro de distribución, podría vincularse aquí con referencia cruzada al bloque 23.

