# Bloque 34 · Riesgos de transición: concentración, exposición y capital

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v2-2026-09-15` |
| Longitud | 2,169 caracteres |
| Costo | $0.2147 |
| Duración | 39,387 ms |
| Velocidad | 61.4 tok/s |
| Tokens | 8,159 entrada · 2,418 salida |

---

## Texto

**Exposición a riesgos de transición y despliegue de capital**

| Concepto | Cantidad de activos | Porcentaje | Gasto de capital | Financiación | Inversión |
|---|---:|---:|---:|---:|---:|
| Precio al carbono y regulación sobre sectores intensivos en la cartera empresarial | 8,090 | 9.4 % | — | — | — |
| Expectativas de inversionistas y taxonomía sostenible | 14,200 | 16.4 % | — | — | — |

Empresa Demo, S.A.B. de C.V. identifica dos riesgos de transición relacionados con el clima cuya exposición se presenta en la tabla anterior: el precio al carbono y la regulación que recae sobre los sectores intensivos en emisiones dentro de la cartera empresarial, y las expectativas de los inversionistas institucionales y la taxonomía sostenible que orientan sus decisiones. Para determinar la cantidad y el porcentaje de activos vulnerables, la Compañía no se acoge a la exención por costo o esfuerzo desproporcionado; las métricas se obtienen a partir de la clasificación de la cartera por sector y ubicación con la información razonable y sustentable disponible a la fecha de presentación.

La exposición al primer riesgo corresponde al crédito otorgado a acreditados de cemento, acero, transporte de carga y generación eléctrica convencional, que representa el 18 % del segmento empresarial y se mide contra una cartera de crédito total de 86,400 millones de pesos al cierre de 2025. En el modelo de negocio, los riesgos de transición se concentran en la originación y administración de esa cartera empresarial y, en la cadena de valor, en la captación y la tesorería, por las expectativas de los inversionistas institucionales que adquieren la deuda del grupo.

Los efectos previstos comprenden el deterioro de la calificación de los acreditados en sectores intensivos, mayores reservas crediticias y la posibilidad de que activos varados operen como colateral; por el lado del pasivo, un mayor costo de fondeo, menor demanda en las emisiones de deuda y la exclusión de índices sostenibles. Durante 2025 no se registraron efectos cuantificables en la situación financiera, el rendimiento financiero ni los flujos de efectivo de la Compañía atribuibles a estos riesgos.

## Fuentes

- `sol:ffc96e27-6d6e-42e2-aced-085cf4ece986` — Costo o esfuerzo desproporcionado en las métricas de exposición — entregada y validada
- `sol:4429b346-d35a-41c6-8f0a-cea0da836771` — Porcentaje de la cartera expuesta a riesgos de transición 2025 — entregada y validada, valor 9.4 %
- `sol:dc87ab13-f921-476d-ba47-173312caf8be` — Concentración de los riesgos de transición en el modelo de negocio — entregada y validada
- `sol:6169121a-31b9-4427-bb76-ce1d6f9d09e6` — Efecto de los riesgos de transición en la situación financiera — entregada y validada
- `reg:5d7950ee-586a-4163-8e9f-d2889ac7fa99` — Registro de clima: Precio al carbono y regulación sobre sectores intensivos en la cartera empresarial (riesgo_transicion)
- `reg:9b02370a-9453-426b-894d-0d6a8ed259c7` — Registro de clima: Expectativas de inversionistas y taxonomía sostenible (riesgo_transicion)
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- La segunda fila de la tabla (Expectativas de inversionistas y taxonomía sostenible: 14,200 activos, 16.4 %) no tiene respaldo en ninguna solicitud entregada; el registro reg:9b02370a aparece en la lista de fuentes pero el arreglo registros_clima viene vacío. Conviene verificar la base de cálculo del 16.4 % (¿16.4 % de qué cartera?) y su unidad antes de publicar.
- La tabla no indica la unidad de la columna 'Cantidad de activos'. Por la solicitud sol:4429b346 la primera fila son millones de pesos; el texto lo hace explícito para esa fila vía la cartera total de 86,400 millones, pero la tabla debería llevar la unidad en el encabezado.
- Las columnas Gasto de capital, Financiación e Inversión están vacías en ambas filas. No hay solicitud que las alimente; si la emisora tiene capital desplegado hacia estos riesgos (NIIF S2 29 e), falta el dato o debería confirmarse que es cero/no aplicable.
- La solicitud sol:ffc96e27 menciona que las emisiones financiadas se difieren por el alivio C4. Se omitió deliberadamente en este bloque porque corresponde al bloque 33 (Emisiones financiadas); verificar que allí se declare.
- Coherencia interna: 8,090 / 86,400 = 9.36 % ≈ 9.4 % (cuadra). El 18 % del segmento empresarial es dato de la solicitud de concentración, no de la tabla; se incluyó en prosa por aportar información adicional.

