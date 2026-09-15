# Bloque 32 · Alcance 2 por ubicación e instrumentos contractuales

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v1-2026-09-15` |
| Longitud | 1,945 caracteres |
| Costo | $0.1804 |
| Duración | 31,348 ms |
| Velocidad | 64.7 tok/s |
| Tokens | 6,773 entrada · 2,027 salida |

---

## Texto

Empresa Demo, S.A.B. de C.V. presenta a continuación la información relativa a sus emisiones de gases de efecto invernadero de Alcance 2 correspondientes al ejercicio 2025, con el fin de que los usuarios de los informes financieros con propósito general comprendan la base de cálculo empleada y la forma en que los instrumentos contractuales de adquisición de electricidad inciden, o no, en la cifra reportada. Las emisiones de Alcance 2 provienen de la electricidad adquirida para el funcionamiento de las instalaciones de la Compañía y se determinan a partir del consumo eléctrico registrado en cada una de ellas.

Durante el ejercicio 2025, el consumo de energía eléctrica de las instalaciones de la Compañía ascendió a 9,120,000 kWh. Sobre esa base, las emisiones de Alcance 2 calculadas con el método basado en la ubicación ascendieron a 3,860 toneladas métricas equivalentes de CO2. Este método aplica a la electricidad consumida el factor de emisión promedio de la red eléctrica del área geográfica en la que se ubican las instalaciones, con independencia de los acuerdos comerciales bajo los cuales se contrata el suministro.

La totalidad de la electricidad consumida por la Compañía se adquiere a la Comisión Federal de Electricidad bajo contratos de suministro estándar. La Compañía no cuenta con contratos de adquisición de energía renovable, ni con certificados de energía limpia u otros instrumentos contractuales que le atribuyan atributos específicos de generación distintos de los de la red. En consecuencia, no existen instrumentos contractuales que modifiquen la caracterización de la electricidad consumida y el método basado en el mercado arroja el mismo valor que el método basado en la ubicación para el ejercicio 2025.

Dado que se trata del primer periodo anual en que la Compañía aplica la NIIF S2, las emisiones de Alcance 2 se presentan únicamente para el ejercicio 2025, sin cifras comparativas del periodo anterior.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000006` — Consumo de energía eléctrica 2025 por instalación (kWh) — entregada y validada, valor 9120000 kWh
- `sol:c0000000-0000-0000-0000-000000000008` — Inventario GEI Alcance 2 (ubicación y mercado) — entregada y validada, valor 3860 tCO2e
- `sol:638b275a-1c22-45f9-8250-a6193d94b796` — Alcance 2 por ubicación e instrumentos contractuales — entregada y validada
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- La solicitud sol:c0000000-0000-0000-0000-000000000021 (consumo eléctrico corporativo 2025, consolidado Finanzas) está entregada pero sin validar y sin valor; no se usó. Conviene verificar que, una vez validada, coincida con los 9,120,000 kWh de la solicitud por instalación (sol:...006); una discrepancia obligaría a revisar la cifra de Alcance 2 o a explicar la diferencia de perímetro.
- La cifra de 3,860 tCO2e de Alcance 2 también corresponde al bloque 29 (Emisiones GEI Alcance 1 y 2). Se incluyó aquí porque el requisito 29(a)(v) pide expresamente la cifra basada en la ubicación; el revisor decide si mantenerla en ambos bloques o remitir a la tabla del bloque 29.
- La afirmación de que el método basado en el mercado arroja el mismo valor proviene del texto descriptivo validado (sol:638b...). La norma solo exige la cifra basada en la ubicación; la mención del método de mercado es revelación voluntaria que los datos permiten. Confirmar con la emisora que no hay factor residual de red distinto al de ubicación que hiciera diferir la cifra de mercado.
- El factor de emisión de la red y su fuente (p. ej. factor SEN publicado por la autoridad) corresponden al bloque 30 (método de medición); aquí no se detalló para evitar duplicidad.
- Revelación voluntaria posible con los datos disponibles: intensidad de emisiones de Alcance 2 por kWh consumido (3,860 tCO2e / 9,120,000 kWh); no se incluyó porque implicaría un cálculo no entregado.
- La ausencia de comparativos se apoya en el alivio NIIF S2 C3; se mencionó en una frase sin citar el párrafo para no invadir el bloque 3.

