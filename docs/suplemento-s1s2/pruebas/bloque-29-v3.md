# Bloque 29 · Emisiones GEI — prompt v3, caché caliente

Salida literal, sin editar una palabra. Reporte `[DEMO] Informe Anual Sustentable 2025`
de Empresa Demo SAB en `traceline-dev`, ejercicio 2025, primer año de adopción con los
alivios C3, C4 y C5. Generado por la ruta real, con el flujo asíncrono.

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión del prompt | `a4-v3-2026-09-11` |
| Esfuerzo | `high` (valor por defecto del API) |
| Tokens de entrada sin cachear | 2,757 |
| Tokens escritos al caché | 0 |
| Tokens leídos del caché | 4,213 |
| Tokens de salida (incluye razonamiento) | 2,038 |
| Costo | $0.1305 |
| Duración de la llamada | 26,904 ms |
| Reloj de punta a punta, con polling | 32.7 s |
| Respuesta del POST | 202 en 2.2 s |

---

## Texto generado (la tabla la arma el código y va delante)

**Tabla 29. Emisiones GEI Alcance 1 y 2 (+ Alcance 3 según régimen)**

| Concepto | Valor | Unidad | Ejercicio |
|---|---:|---|---:|
| Inventario GEI Alcance 1 con memoria de cálculo | 400,000 | tCO2e | 2025 |
| Inventario GEI Alcance 2 (ubicación y mercado) | 3,120.4 | tCO2e | 2025 |

Empresa Demo SAB de CV presenta en la tabla anterior sus emisiones brutas absolutas de gases de efecto invernadero generadas durante el ejercicio 2025, expresadas en toneladas métricas equivalentes de CO2 (tCO2e), desglosadas por Alcance 1 y Alcance 2.

Las emisiones de Alcance 1 comprenden las emisiones directas de gases de efecto invernadero provenientes de fuentes que son propiedad de La Compañía o que se encuentran bajo su control, incluidas las fuentes fijas y móviles asociadas a su operación. Las emisiones de Alcance 2 comprenden las emisiones indirectas de gases de efecto invernadero derivadas de la generación de la electricidad y demás formas de energía adquiridas y consumidas por La Compañía durante el periodo.

Las cifras se presentan en términos brutos, es decir, sin deducir compensaciones ni remociones de carbono, y corresponden a la totalidad de las operaciones consideradas en el inventario de La Compañía para el ejercicio sobre el que se informa.

Conforme al párrafo C4 del Apéndice C de la NIIF S2, durante este primer periodo anual de aplicación La Compañía se acoge a la facilidad transitoria que la exime de revelar sus emisiones de gases de efecto invernadero de Alcance 3, por lo que las cifras de emisiones brutas absolutas corresponden a los Alcances 1 y 2.

La Compañía continuará avanzando en la medición de sus emisiones de Alcance 3, con el propósito de incorporar dicha información a revelar en periodos subsecuentes.

---

## `fuentes`

- `sol:c0000000-0000-0000-0000-000000000007` — Inventario GEI Alcance 1 con memoria de cálculo — entregada y validada, valor 400000 tCO2e
- `sol:c0000000-0000-0000-0000-000000000008` — Inventario GEI Alcance 2 (ubicación y mercado) — entregada y validada, valor 3120.4 tCO2e
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## `pendientes`

_Ninguno: bajo C4 el requisito de Alcance 3 no es exigible y deja de contarse como hueco._

## `notas_revision` — no se publican

- Existe un dato de Alcance 3 total (sol:c3000000-0000-0000-0000-000000000001, 15,750 tCO2e, entregado y validado) que el alivio C4 permite omitir. No se incluyó en el texto; el revisor debe decidir si la emisora desea revelarlo voluntariamente, en cuyo caso habría que ajustar la oración de C4 y la tabla.
- Inconsistencia: la solicitud sol:c0000000-0000-0000-0000-000000000008 pide Alcance 2 por ubicación y por mercado, pero llegó un único valor agregado (3,120.4 tCO2e) sin indicar a qué método corresponde. Esto afecta al bloque 32; conviene aclararlo con el cliente.
- La solicitud sol:c0000000-0000-0000-0000-000000000012 (consumo de combustibles fósiles 2025, base del Alcance 1) está sin evidencia. No genera pendiente en este bloque porque el inventario de Alcance 1 está cubierto, pero puede afectar la trazabilidad del dato de entrada en el bloque 30.
- Revelación voluntaria posible: la descripción de las solicitudes indica que el inventario se elabora conforme al GHG Protocol; ese dato corresponde al bloque 30 y no se mencionó aquí para no duplicar.

