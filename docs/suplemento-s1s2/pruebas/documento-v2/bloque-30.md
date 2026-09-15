# Bloque 30 · Método de medición, datos de entrada y C5

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v2-2026-09-15` |
| Longitud | 1,851 caracteres |
| Costo | $0.2557 |
| Duración | 45,702 ms |
| Velocidad | 75.1 tok/s |
| Tokens | 7,232 entrada · 3,433 salida |

---

## Texto

Empresa Demo, S.A.B. de C.V. mide sus emisiones de gases de efecto invernadero de los Alcances 1 y 2 de conformidad con el Protocolo sobre Gases de Efecto Invernadero: Un Estándar Corporativo de Contabilidad y Reporte (2004). La Compañía aplica este estándar desde 2022 y, por tanto, no hace uso de la medida transitoria prevista en el párrafo C5 del Apéndice C de la NIIF S2, que permitiría conservar durante el primer periodo de aplicación un método de medición distinto. El inventario de emisiones ha sido objeto de verificación por un tercero desde ese mismo año.

Para delimitar el perímetro del inventario, la Compañía utiliza el enfoque de control operacional, de manera que consolida la totalidad de las emisiones de las operaciones sobre las que ejerce dicho control.

Las emisiones de Alcance 1 corresponden a la combustión de gasolina y diésel en la flota vehicular y en las plantas de emergencia de sucursales y centros operativos. El dato de entrada es el consumo de combustibles del ejercicio 2025, que ascendió a 488,000 litros, al que se aplican los factores de emisión publicados por la Secretaría de Medio Ambiente y Recursos Naturales (SEMARNAT) para cada tipo de combustible.

Las emisiones de Alcance 2 corresponden a la electricidad adquirida y consumida en las instalaciones de la Compañía. El dato de entrada son los kilowatt-hora facturados por sucursal, que en 2025 sumaron 9,120,000 kWh, a los que se aplica el factor de emisión del Sistema Eléctrico Nacional publicado por la Comisión Reguladora de Energía (CRE).

Durante el ejercicio 2025 no se produjeron cambios en el método de medición, en los factores de emisión utilizados ni en la naturaleza de los datos de entrada respecto del periodo anterior, por lo que la información sobre emisiones de este periodo se elaboró sobre la misma base que la de ejercicios previos.

## Fuentes

- `sol:fb2804fe-7795-4819-bda1-93b7ee863df3` — Enfoque de medición de emisiones y datos de entrada — entregada y validada
- `sol:c0000000-0000-0000-0000-000000000012` — Consumo de combustibles fósiles 2025 — entregada y validada, valor 488000 litros
- `sol:c0000000-0000-0000-0000-000000000006` — Consumo de energía eléctrica 2025 por instalación (kWh) — entregada y validada, valor 9120000 kWh
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- No se citó sol:c0000000-0000-0000-0000-000000000007 (Inventario GEI Alcance 1, 1,240 tCO2e) porque la cifra de emisiones corresponde al bloque 29; la memoria de cálculo podría servir para ampliar la descripción del método si el revisor lo considera pertinente.
- El alivio C5 no figura entre los adoptados y la fuente confirma medición bajo Protocolo GEI desde 2022; el texto lo declara explícitamente como no aplicado. Confirmar que la emisora quiere esa mención expresa o prefiere omitirla.
- La fuente menciona el alivio C3 (sin comparativos); no se desarrolló aquí porque los alivios transitorios se cubren en el bloque 3. Solo se afirma que el método no cambió respecto del periodo anterior.
- La descripción del Alcance 2 se limita al factor del SEN (CRE), es decir, base por ubicación. La distinción ubicación/instrumentos contractuales corresponde al bloque 32; verificar consistencia entre ambos bloques.
- Inconsistencia menor: la solicitud 6 se titula 'por instalación' pero se entregó un valor agregado (9,120,000 kWh) y la fuente de método habla de 'kWh facturados por sucursal'. El texto usa 'por sucursal' y la cifra agregada.
- El consumo de combustibles (488,000 litros) llegó agregado gasolina + diésel; un desglose por combustible sería una revelación voluntaria posible si la emisora lo tiene.
- La fuente afirma 'inventario verificado por tercero' sin identificar al verificador, el nivel de aseguramiento ni los alcances cubiertos. El texto lo menciona sin detalle; si la emisora quiere revelar el verificador o el nivel de aseguramiento (voluntario), se requiere ese dato.

