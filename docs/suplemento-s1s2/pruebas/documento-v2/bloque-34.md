# Bloque 34 · Riesgos de transición: concentración, exposición y capital

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v1-2026-09-15` |
| Longitud | 2,239 caracteres |
| Costo | $0.2774 |
| Duración | 47,412 ms |
| Velocidad | 77.8 tok/s |
| Tokens | 8,099 entrada · 3,688 salida |

---

## Texto

**Exposición a riesgos de transición y despliegue de capital**

| Concepto | Cantidad de activos | Porcentaje | Gasto de capital | Financiación | Inversión |
|---|---:|---:|---:|---:|---:|
| Precio al carbono y regulación sobre sectores intensivos en la cartera empresarial | 8,090 | 9.4 % | — | — | — |
| Expectativas de inversionistas y taxonomía sostenible | 14,200 | 16.4 % | — | — | — |

Empresa Demo, S.A.B. de C.V. presenta en la tabla anterior la cantidad y el porcentaje de activos vulnerables a los riesgos de transición relacionados con el clima al cierre de 2025. La exposición asociada al precio al carbono y a la regulación sobre sectores intensivos comprende los acreditados de cemento, acero, transporte de carga y generación eléctrica convencional dentro del crédito empresarial; su monto se expresa en millones de pesos, equivale al 18 % de ese segmento y su porcentaje se calcula sobre una cartera de crédito total de 86,400 millones de pesos.

Estas métricas se determinaron a partir de la clasificación de la cartera por sector y ubicación, con la información razonable y sustentable disponible a la fecha de presentación, sin que la Compañía se acogiera a la exención por costo o esfuerzo desproporcionado. Las emisiones financiadas se difieren conforme a la medida transitoria del párrafo C4 de la NIIF S2 y no por dicha exención.

Los riesgos de transición se concentran en dos puntos del modelo de negocio: en la originación y administración de la cartera empresarial, por la exposición a los sectores señalados, y en la captación y la tesorería, por las expectativas de los inversionistas institucionales que adquieren la deuda del grupo y por los criterios de las taxonomías sostenibles.

Durante 2025 no se registraron efectos cuantificables en la situación financiera, el rendimiento financiero ni los flujos de efectivo atribuibles a estos riesgos. Los efectos previstos comprenden, por el lado del activo, el deterioro de la calificación de acreditados en sectores intensivos, mayores reservas crediticias y la posibilidad de que el colateral se convierta en activos varados; por el lado del pasivo, un mayor costo de fondeo, una menor demanda en las emisiones de deuda y la exclusión de índices sostenibles.

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

- La fila 'Expectativas de inversionistas y taxonomía sostenible' de la tabla (14,200 / 16.4 %) no tiene respaldo en ninguna de las solicitudes recibidas; solo consta en el registro de clima reg:9b02370a. Conviene confirmar la unidad (¿millones de pesos?) y el denominador de ese porcentaje, porque 14,200 / 86,400 = 16.4 %, lo que sugiere que se calculó sobre la cartera total, pero la solicitud sol:dc87ab13 ubica ese riesgo en captación y tesorería, no en cartera. En el texto solo afirmé la unidad y el denominador para la primera fila.
- La columna 'Cantidad de activos' de la tabla no indica unidad; la solicitud sol:4429b346 la expresa en millones de pesos. Sugiero añadir la unidad al encabezado de la tabla.
- Las columnas Gasto de capital, Financiación e Inversión están vacías. El requisito 29(d) (despliegue de capital) no figura entre los datapoints de este bloque, por lo que no puse pendiente; si el revisor considera que el título del bloque ('capital') exige cubrirlo, faltaría una solicitud de capital destinado a riesgos de transición.
- Coexisten dos porcentajes con denominador distinto: 9.4 % de la cartera de crédito total (sol:4429b346) y 18 % del segmento empresarial (sol:dc87ab13). Los presenté ambos con su base explícita; verificar que no confundan al lector.
- La mención al diferimiento de emisiones financiadas por C4 procede de sol:ffc96e27 y se incluyó en una sola frase para aclarar el alcance de NIIF S2 30; el detalle del alivio corresponde a los bloques 3 y 33. Si el revisor prefiere evitar solapamiento, puede retirarse esa frase sin afectar la cobertura del bloque.

