# Bloque 30 · Método de medición, datos de entrada y C5

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v1-2026-09-15` |
| Longitud | 2,528 caracteres |
| Costo | $0.2212 |
| Duración | 40,808 ms |
| Velocidad | 68.7 tok/s |
| Tokens | 6,945 entrada · 2,805 salida |

---

## Texto

Empresa Demo, S.A.B. de C.V. mide sus emisiones de gases de efecto invernadero de Alcance 1 y Alcance 2 de conformidad con el Protocolo sobre Gases de Efecto Invernadero: Un Estándar Corporativo de Contabilidad y Reporte (2004). La Compañía define su límite organizacional bajo el enfoque de control operacional, de modo que el inventario comprende las fuentes de emisión de las instalaciones y equipos sobre los que ejerce control de las políticas operativas. Las cifras resultantes se presentan en el apartado de emisiones brutas absolutas de este informe.

Las emisiones de Alcance 1 se calculan a partir del consumo de combustibles de fuentes fijas y móviles, expresado en litros, correspondiente a la flota vehicular y a las plantas de emergencia de la Compañía, al que se aplican los factores de emisión publicados por la Secretaría de Medio Ambiente y Recursos Naturales (SEMARNAT). El consumo de combustibles fósiles del ejercicio 2025 ascendió a [Pendiente: volumen de combustibles fósiles consumidos en 2025, por tipo de combustible y unidad — solicitud Consumo de combustibles fósiles 2025]. El cálculo se documenta en una memoria de cálculo que respalda el inventario de Alcance 1.

Las emisiones de Alcance 2 se calculan a partir de la energía eléctrica facturada por sucursal, expresada en kilowatts-hora. Durante el ejercicio 2025 el consumo de energía eléctrica de las instalaciones de la Compañía fue de 9,120,000 kWh, al que se aplica el factor de emisión eléctrico del Registro Nacional de Emisiones (RENE). Los datos de entrada provienen de la facturación de las comercializadoras de energía y de los registros de consumo de combustible de la operación.

Durante el ejercicio 2025 [Pendiente: descripción de los cambios en el enfoque de medición, factores de emisión o datos de entrada respecto del periodo anterior, o confirmación de que no hubo cambios — solicitud Enfoque de medición de emisiones y datos de entrada]. Conforme al párrafo C5 del Apéndice C de la NIIF S2, en este primer periodo anual de aplicación la Compañía se acoge a la facilidad transitoria que le permite continuar utilizando el método de medición aplicado en el periodo inmediato anterior, consistente en [Pendiente: descripción del método de medición empleado en el periodo anterior y de sus diferencias, en su caso, respecto del Protocolo GEI — solicitud Enfoque de medición de emisiones y datos de entrada]. La Compañía prevé alinear plenamente su medición al Protocolo sobre Gases de Efecto Invernadero en periodos subsecuentes.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000006` — Consumo de energía eléctrica 2025 por instalación (kWh) — entregada y validada, valor 9120000 kWh
- `sol:c0000000-0000-0000-0000-000000000007` — Inventario GEI Alcance 1 con memoria de cálculo — entregada y validada, valor 1240 tCO2e
- `sol:c0000000-0000-0000-0000-000000000012` — Consumo de combustibles fósiles 2025 — sin evidencia
- `sol:fb2804fe-7795-4819-bda1-93b7ee863df3` — Enfoque de medición de emisiones y datos de entrada — entregada y validada
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

- [Pendiente: volumen de combustibles fósiles consumidos en 2025, por tipo de combustible y unidad — solicitud Consumo de combustibles fósiles 2025]
- [Pendiente: descripción de los cambios en el enfoque de medición, factores de emisión o datos de entrada respecto del periodo anterior, o confirmación de que no hubo cambios — solicitud Enfoque de medición de emisiones y datos de entrada]
- [Pendiente: descripción del método de medición empleado en el periodo anterior y de sus diferencias, en su caso, respecto del Protocolo GEI — solicitud Enfoque de medición de emisiones y datos de entrada]

## Notas para el revisor — no se publican

- Posible inconsistencia con el alivio C5: el régimen indica que la emisora adopta NIIF S2 C5 (método de medición previo), pero la solicitud fb2804fe describe que el método ya es el GHG Protocol con enfoque de control operacional. Si el método previo es el mismo, el alivio C5 no aplica materialmente y conviene retirar la oración sobre C5 y la frase de alineación futura; si difiere, hay que describir el método previo. Confirmar con la emisora.
- La solicitud c0000000-...-0012 (Consumo de combustibles fósiles 2025) está sin evidencia. Es el dato de entrada base del Alcance 1, cuyo valor (1,240 tCO2e) sí fue entregado con memoria de cálculo. Se recomienda obtener la memoria de cálculo o el volumen de combustible para respaldar la trazabilidad del inventario; de lo contrario, considerar retirar la mención al volumen de combustible y dejar solo la descripción cualitativa del dato de entrada.
- El consumo eléctrico (9,120,000 kWh) se incluyó como dato de entrada del Alcance 2. La solicitud pide desglose por instalación pero llegó un agregado; el texto lo presenta como total. Si la emisora quiere revelar por sucursal, se requiere el desglose.
- No hay dato sobre cambios en el método durante el periodo. Al ser primer año de adopción, puede bastar una confirmación de que no hubo cambios respecto del inventario anterior; el marcador correspondiente puede resolverse con esa confirmación.
- Revelación voluntaria posible: la emisora podría indicar el año de publicación de los factores SEMARNAT y del factor RENE utilizados, así como los gases cubiertos (CO2, CH4, N2O, etc.), lo que mejora la comparabilidad. No está en los datos.

