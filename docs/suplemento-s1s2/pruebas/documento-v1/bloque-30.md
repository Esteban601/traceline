# Bloque 30 · Método de medición, datos de entrada y C5

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Longitud | 2,679 caracteres |
| Costo | $0.2590 |
| Duración | 45,583 ms |
| Velocidad | 82.4 tok/s |
| Tokens | 6,060 entrada · 3,757 salida |

---

## Texto

Empresa Demo SAB de CV mide sus emisiones de gases de efecto invernadero de conformidad con el Protocolo sobre Gases de Efecto Invernadero: Un Estándar Corporativo de Contabilidad y Reporte (2004). El inventario de emisiones de Alcance 1 correspondiente al ejercicio 2025 se acompaña de una memoria de cálculo que documenta la metodología aplicada conforme a dicho Protocolo, las fuentes de emisión consideradas y los parámetros de cálculo empleados para convertir los datos de actividad en toneladas métricas equivalentes de CO2.

Las emisiones de Alcance 1 comprenden las emisiones directas de fuentes fijas y móviles de La Compañía. Los datos de actividad que sirven de base para su cálculo corresponden al consumo de combustibles fósiles del ejercicio. [Pendiente: datos de actividad de consumo de combustibles fósiles 2025 en fuentes fijas y móviles, con su unidad de medida — de la solicitud Consumo de combustibles fósiles 2025]

Las emisiones de Alcance 2 se calculan a partir del consumo de energía eléctrica de cada instalación operativa, expresado en kilovatios hora, al que se aplican los factores de emisión correspondientes. [Pendiente: confirmación de los datos de consumo eléctrico por instalación y de los factores de emisión aplicados — de la solicitud Consumo de energía eléctrica 2025 por instalación (kWh)]

En cuanto al enfoque general de medición, La Compañía describe los criterios con los que delimita y consolida su inventario. [Pendiente: descripción del enfoque de medición, incluyendo el enfoque de consolidación (control operativo, control financiero o participación accionaria), los gases incluidos, el origen de los factores de emisión y los potenciales de calentamiento global utilizados — del requisito NIIF S2 29 (a)(iii), sin solicitud asociada]

Conforme al párrafo C5 del Apéndice C de la NIIF S2, durante este primer periodo anual de aplicación La Compañía se acoge a la medida transitoria que le permite continuar utilizando el método de medición de emisiones de gases de efecto invernadero empleado en el periodo anual inmediato anterior. [Pendiente: identificación del método de medición previo conservado bajo el párrafo C5 y de sus diferencias respecto del Protocolo sobre Gases de Efecto Invernadero — sin solicitud asociada] [Pendiente: cambios en el método de medición, los datos de entrada o los supuestos ocurridos durante el periodo, o confirmación de que no los hubo — sin solicitud asociada]

La Compañía prevé continuar fortaleciendo la documentación de sus datos de entrada y supuestos de medición, con el propósito de alinear plenamente su enfoque con el Protocolo sobre Gases de Efecto Invernadero en periodos subsecuentes.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000007` — Inventario GEI Alcance 1 con memoria de cálculo — entregada y validada, valor 400000 tCO2e
- `sol:c0000000-0000-0000-0000-000000000006` — Consumo de energía eléctrica 2025 por instalación (kWh) — entregada, sin validar
- `sol:c0000000-0000-0000-0000-000000000012` — Consumo de combustibles fósiles 2025 — sin evidencia
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

- [Pendiente: datos de actividad de consumo de combustibles fósiles 2025 en fuentes fijas y móviles, con su unidad de medida — de la solicitud Consumo de combustibles fósiles 2025]
- [Pendiente: confirmación de los datos de consumo eléctrico por instalación y de los factores de emisión aplicados — de la solicitud Consumo de energía eléctrica 2025 por instalación (kWh)]
- [Pendiente: descripción del enfoque de medición, incluyendo el enfoque de consolidación (control operativo, control financiero o participación accionaria), los gases incluidos, el origen de los factores de emisión y los potenciales de calentamiento global utilizados — del requisito NIIF S2 29 (a)(iii), sin solicitud asociada]
- [Pendiente: identificación del método de medición previo conservado bajo el párrafo C5 y de sus diferencias respecto del Protocolo sobre Gases de Efecto Invernadero — sin solicitud asociada]
- [Pendiente: cambios en el método de medición, los datos de entrada o los supuestos ocurridos durante el periodo, o confirmación de que no los hubo — sin solicitud asociada]

## Notas para el revisor — no se publican

- Inconsistencia de régimen: se declara adoptado el alivio C5 (método de medición previo distinto del Protocolo GEI), pero la única metodología documentada (sol:...007, memoria de cálculo del inventario Alcance 1) afirma conformidad con el GHG Protocol. Si el inventario ya sigue el Protocolo GEI, el alivio C5 no aplica y el párrafo correspondiente debe retirarse; si hay un método previo distinto, falta identificarlo y describirlo.
- El requisito NIIF S2 29 (a)(iii) no tiene ninguna solicitud asociada en el reporte; conviene abrir una solicitud que cubra enfoque de consolidación, gases incluidos, factores de emisión y GWP utilizados.
- sol:...012 (Consumo de combustibles fósiles 2025) está sin evidencia y sin unidad; es la base de actividad del Alcance 1, por lo que el inventario validado de 400,000 tCO2e carece de soporte de datos de entrada en el expediente. Verificar coherencia entre la memoria de cálculo y la ausencia de esa evidencia.
- sol:...006 (consumo eléctrico por instalación) está entregada pero pendiente de validación; el texto solo la referencia como dato de entrada sin cifras. Retirar el marcador cuando se valide.
- La cifra de 400,000 tCO2e de Alcance 1 no se incluye en este bloque por corresponder al bloque 29. La distinción entre método por ubicación y por mercado para Alcance 2 corresponde al bloque 32; aquí solo se menciona el dato de entrada.
- No hay dato sobre cambios en el método o los supuestos durante el periodo; se dejó marcador en lugar de afirmar que no hubo cambios.

