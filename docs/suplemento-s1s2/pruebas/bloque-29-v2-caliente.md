# Bloque 29 · Emisiones GEI — prompt v2, caché caliente

Salida literal del modelo, sin editar una palabra. Reporte `[DEMO] Informe Anual
Sustentable 2025` de Empresa Demo SAB en `traceline-dev`, ejercicio 2025, primer año
de adopción con los alivios C3, C4 y C5.

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión del prompt | `a4-v2-2026-09-11` |
| Tokens de entrada sin cachear | 2,787 |
| Tokens escritos al caché | 0 |
| Tokens leídos del caché | 3,906 |
| Tokens de salida (incluye razonamiento) | 3,358 |
| Costo | $0.1967 |
| Duración | 44,251 ms |
| Intentos | 1 |
| Longitud del texto | 1,159 caracteres |

---

## Tabla (la arma el código, no el modelo)

**Tabla 29. Emisiones GEI Alcance 1 y 2 (+ Alcance 3 según régimen)**

| Concepto | Valor | Unidad | Ejercicio |
|---|---:|---|---:|
| Inventario GEI Alcance 1 con memoria de cálculo | 400,000 | tCO2e | 2025 |
| Inventario GEI Alcance 2 (ubicación y mercado) | 3,120.4 | tCO2e | 2025 |
| Emisiones GEI Alcance 3 — total (todas las categorías) | 15,750 | tCO2e | 2025 |

## Texto generado

Las emisiones brutas absolutas de gases de efecto invernadero de Empresa Demo SAB de CV correspondientes al ejercicio 2025 se presentan en la tabla anterior, expresadas en toneladas métricas equivalentes de CO2 y desagregadas por alcance.

Las emisiones de Alcance 1 comprenden las emisiones directas de gases de efecto invernadero generadas por fuentes que son propiedad de la Compañía o que esta controla. Las emisiones de Alcance 2 comprenden las emisiones indirectas asociadas a la generación de la energía adquirida y consumida por la Compañía en sus operaciones.

La cifra de Alcance 3 que se presenta corresponde al total de las emisiones indirectas que ocurren en la cadena de valor de la Compañía, agregado para el conjunto de sus categorías, y se revela sin desagregación por categoría ni por gas. [Pendiente: desagregación de una categoría de Alcance 3 por los gases que la componen — NIIF S2 EI19 a EI24, sin solicitud asociada en el reporte]

Al tratarse del primer ejercicio sobre el que la Compañía informa conforme a la Norma NIIF S2, las cifras de emisiones se revelan únicamente para 2025, sin información comparativa del ejercicio anterior.

---

## `fuentes_usadas`

- `sol:c0000000-0000-0000-0000-000000000007`
- `sol:c0000000-0000-0000-0000-000000000008`
- `sol:c3000000-0000-0000-0000-000000000001`
- `reporte:20000000-0000-0000-0000-000000000001`

## `pendientes`

- [Pendiente: desagregación de una categoría de Alcance 3 por los gases que la componen — NIIF S2 EI19 a EI24, sin solicitud asociada en el reporte]

## `notas_revision` — no se publican

- Inconsistencia de régimen: la emisora adoptó el alivio NIIF S2 C4 (sin Alcance 3) y, sin embargo, la tabla 29 armada por el sistema incluye la fila de Alcance 3 total (15,750 tCO2e, sol:c3000000-...-0001). El revisor debe decidir si la emisora revela el Alcance 3 de forma voluntaria (en cuyo caso conviene ajustar el bloque 3 para que no afirme que se omite) o si se retira la fila de la tabla y el tercer párrafo del texto.
- El requisito NIIF S2 EI19 a EI24 (desagregación de una categoría de Alcance 3 por gas) no es exigible si se aplica el alivio C4. Si la emisora decide no revelar Alcance 3, el marcador de pendiente puede retirarse sin sustituirlo por dato alguno; si decide revelarlo voluntariamente, habría que abrir una solicitud para la desagregación por gas de al menos una categoría.
- Alcance 2: la solicitud sol:c0000000-...-0008 pedía ambos métodos (ubicación y mercado) y se recibió un único valor (3,120.4 tCO2e) sin indicar a qué método corresponde. La tabla lo presenta como 'ubicación y mercado' con una sola cifra. Conviene confirmar el método antes de que el bloque 32 lo describa.
- La solicitud sol:c0000000-...-0012 (consumo de combustibles fósiles 2025, base del Alcance 1) está sin evidencia. No afecta la cifra de Alcance 1 ya validada, pero deja sin soporte documental la composición del Alcance 1 (fuentes fijas y móviles); por ello el texto describe el Alcance 1 solo de forma definicional y no afirma qué tipo de fuentes lo integran. Relevante para el bloque 30 (datos de entrada).
- Revelación voluntaria posible: si se cuenta con el desglose del Alcance 1 por tipo de fuente (fija/móvil) o por gas (CO2, CH4, N2O), podría añadirse; no hay dato en el expediente para hacerlo.

