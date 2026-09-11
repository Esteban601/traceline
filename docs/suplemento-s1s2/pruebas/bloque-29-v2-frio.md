# Bloque 29 · Emisiones GEI — prompt v2, caché frío

Salida literal del modelo, sin editar una palabra. Reporte `[DEMO] Informe Anual
Sustentable 2025` de Empresa Demo SAB en `traceline-dev`, ejercicio 2025, primer año
de adopción con los alivios C3, C4 y C5.

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión del prompt | `a4-v2-2026-09-11` |
| Tokens de entrada sin cachear | 2,787 |
| Tokens escritos al caché | 3,906 |
| Tokens leídos del caché | 0 |
| Tokens de salida (incluye razonamiento) | 4,666 |
| Costo | $0.3100 |
| Duración | 58,957 ms |
| Intentos | 1 |
| Longitud del texto | 1,245 caracteres |

---

## Tabla (la arma el código, no el modelo)

**Tabla 29. Emisiones GEI Alcance 1 y 2 (+ Alcance 3 según régimen)**

| Concepto | Valor | Unidad | Ejercicio |
|---|---:|---|---:|
| Inventario GEI Alcance 1 con memoria de cálculo | 400,000 | tCO2e | 2025 |
| Inventario GEI Alcance 2 (ubicación y mercado) | 3,120.4 | tCO2e | 2025 |
| Emisiones GEI Alcance 3 — total (todas las categorías) | 15,750 | tCO2e | 2025 |

## Texto generado

Las emisiones brutas absolutas de gases de efecto invernadero de Empresa Demo SAB de CV generadas durante el ejercicio 2025 se presentan en la tabla anterior, expresadas en toneladas métricas equivalentes de CO2 y desagregadas por alcance.

Las emisiones de Alcance 1 comprenden las emisiones directas procedentes de las fuentes fijas y móviles de La Compañía, derivadas principalmente de la combustión de combustibles en sus instalaciones y en sus equipos de transporte. Estas emisiones se determinan a partir de un inventario propio que cuenta con su correspondiente memoria de cálculo.

Las emisiones de Alcance 2 comprenden las emisiones indirectas asociadas a la generación de la energía adquirida por La Compañía para el funcionamiento de sus operaciones. El detalle de los métodos con que se determinan estas emisiones se describe en los apartados siguientes de esta sección.

Al ser 2025 el primer ejercicio sobre el que La Compañía informa conforme a la Norma NIIF S2, las cifras de emisiones se presentan únicamente para dicho ejercicio, sin información comparativa del periodo anterior.

[Pendiente: desagregación de una categoría de Alcance 3 por los gases que la componen — sin solicitud en el reporte que cubra NIIF S2 EI19 a EI24]

---

## `fuentes_usadas`

- `sol:c0000000-0000-0000-0000-000000000007`
- `sol:c0000000-0000-0000-0000-000000000008`
- `reporte:20000000-0000-0000-0000-000000000001`

## `pendientes`

- [Pendiente: desagregación de una categoría de Alcance 3 por los gases que la componen — sin solicitud en el reporte que cubra NIIF S2 EI19 a EI24]

## `notas_revision` — no se publican

- Inconsistencia de régimen: la emisora adoptó el alivio NIIF S2 C4 (sin Alcance 3 en el primer año), pero la Tabla 29 incluye la fila de Alcance 3 total (15,750 tCO2e, sol:c3000000-0000-0000-0000-000000000001, entregada y validada). El texto se limita a Alcance 1 y 2 conforme al alivio. El revisor debe decidir: (a) retirar la fila de Alcance 3 de la tabla para que sea coherente con C4, o (b) mantenerla como revelación voluntaria, en cuyo caso conviene añadir un párrafo que describa qué comprende el Alcance 3 (emisiones indirectas de la cadena de valor, todas las categorías agregadas) y revisar la redacción del bloque 3 sobre C4.
- El requisito NIIF S2 EI19 a EI24 (desagregación de una categoría de Alcance 3 por gases) no tiene solicitud que lo cubra. Si se sostiene el alivio C4, este requisito no aplica en 2025 y el marcador de pendiente puede retirarse sin sustituirlo por dato alguno. Si se opta por revelar Alcance 3 voluntariamente, habría que abrir una solicitud de desagregación por gas (CO2, CH4, N2O, otros) de al menos una categoría, o bien retirar el marcador aceptando la omisión.
- La solicitud sol:c0000000-0000-0000-0000-000000000008 se titula 'Inventario GEI Alcance 2 (ubicación y mercado)' pero llegó con un solo valor (3,120.4 tCO2e) sin indicar a cuál de los dos métodos corresponde. El bloque 32 requiere ambas cifras por separado; conviene solicitar el desglose o confirmar cuál método representa el valor único.
- La solicitud sol:c0000000-0000-0000-0000-000000000012 (Consumo de combustibles fósiles 2025, base del Alcance 1) está sin evidencia y sin unidad definida. No es indispensable para este bloque, pero es el dato de entrada del Alcance 1 y su ausencia puede afectar al bloque 30 (datos de entrada y método). Se recomienda completarla antes de la aprobación.
- El alivio C3 (sin comparativos) se menciona en el texto solo en lo que afecta a la presentación de este bloque (cifras solo de 2025); la explicación completa del régimen queda en el bloque 3.
- La descripción de las fuentes de Alcance 1 (fuentes fijas y móviles, combustión) se basa en las descripciones de las solicitudes 07 y 12; no se afirma el enfoque de consolidación (control operativo, participación accionaria) porque corresponde al bloque 31 y no hay dato que lo respalde.

