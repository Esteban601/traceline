# Bloque 30 · Método de medición, datos de entrada y C5

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v2-2026-09-15` |
| Longitud | 2,234 caracteres |
| Costo | $0.2648 |
| Duración | 47,775 ms |
| Velocidad | 75.8 tok/s |
| Tokens | 7,219 entrada · 3,619 salida |

---

## Texto

Empresa Demo, S.A.B. de C.V. mide sus emisiones de gases de efecto invernadero de Alcance 1 y Alcance 2 conforme al Protocolo sobre Gases de Efecto Invernadero: Un Estándar Corporativo de Contabilidad y Reporte (2004), y aplica el enfoque de control operacional para delimitar el perímetro organizacional del inventario. Bajo este enfoque, la Compañía contabiliza la totalidad de las emisiones generadas por las operaciones sobre las que ejerce control operacional, incluidas sus sucursales y centros operativos.

Las emisiones de Alcance 1 corresponden a la combustión de gasolina y diésel en la flota vehicular y en las plantas de emergencia de sucursales y centros operativos. El dato de entrada para su cálculo es el consumo de combustible registrado durante el ejercicio, que en 2025 ascendió a 488,000 litros de gasolina y diésel, al que se aplican los factores de emisión publicados por la Secretaría de Medio Ambiente y Recursos Naturales (SEMARNAT) para cada tipo de combustible.

Las emisiones de Alcance 2 corresponden al consumo de energía eléctrica adquirida. El dato de entrada es la electricidad facturada por sucursal, que en 2025 sumó 9,120,000 kWh, al que se aplica el factor de emisión del Sistema Eléctrico Nacional publicado por la Comisión Reguladora de Energía (CRE).

Durante el ejercicio 2025 no se registraron cambios en el método de medición, en los factores de emisión ni en los datos de entrada respecto del periodo anterior. La Compañía mide su inventario conforme al Protocolo sobre Gases de Efecto Invernadero desde 2022 y lo somete a verificación por un tercero; por ello no conserva un método de medición distinto ni se acoge a la facilidad transitoria prevista en el párrafo C5 del Apéndice C de la NIIF S2. Conforme al párrafo C3 del mismo Apéndice, en este primer periodo anual de aplicación la Compañía no presenta información comparativa sobre los datos de entrada ni sobre los resultados de la medición.

El método descrito se limita a las emisiones de Alcance 1 y Alcance 2. Los datos de entrada, los factores de emisión aplicados y la memoria de cálculo del inventario se conservan como soporte del proceso de medición y se mantienen disponibles para su verificación en periodos subsecuentes.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000006` — Consumo de energía eléctrica 2025 por instalación (kWh) — entregada y validada, valor 9120000 kWh
- `sol:c0000000-0000-0000-0000-000000000007` — Inventario GEI Alcance 1 con memoria de cálculo — entregada y validada, valor 1240 tCO2e
- `sol:c0000000-0000-0000-0000-000000000012` — Consumo de combustibles fósiles 2025 — entregada y validada
- `sol:fb2804fe-7795-4819-bda1-93b7ee863df3` — Enfoque de medición de emisiones y datos de entrada — entregada y validada
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- El alivio C5 no figura entre los adoptados y la solicitud sol:fb2804fe indica que la Compañía mide bajo el Protocolo GEI desde 2022; el texto afirma que no se acoge a C5. Confirmar con la emisora que desea declararlo explícitamente o retirar la frase si prefiere no mencionar alivios no adoptados.
- La solicitud sol:c0000000-...-000012 (consumo de combustibles) trae el valor 488,000 litros solo en la descripción, sin campo de unidad ni valor estructurado; además agrega gasolina y diésel sin desglose por combustible. Se pidió como dato de entrada y llegó agregado: si se quiere revelar por tipo de combustible, hay que pedir el desglose.
- La descripción menciona inventario 'verificado por tercero' pero no identifica al verificador, el nivel de aseguramiento ni el alcance de la verificación. El texto lo enuncia de forma genérica; si la emisora quiere nombrar al tercero o el estándar de verificación (p. ej. ISO 14064-3), falta ese dato.
- No se especifica el año del factor de emisión del Sistema Eléctrico Nacional (CRE) aplicado ni la versión de los factores SEMARNAT. Revelación voluntaria posible y práctica recomendable bajo S2 B27-B29 para dar trazabilidad a los supuestos.
- No se indica si el Alcance 2 se calcula por ubicación o por mercado ni si existen instrumentos contractuales; corresponde al bloque 32, pero conviene verificar que la información llegue a ese bloque y sea consistente con el uso del factor del SEN aquí descrito.
- No se menciona la fuente de los potenciales de calentamiento global (informe de evaluación del IPCC) usados para convertir a CO2e; S2 B22 pide usar los valores del IPCC más recientes disponibles. Revelación voluntaria posible si la emisora lo confirma.
- Las cifras 1,240 tCO2e (sol:...-000007) no se incluyen en el texto por corresponder al bloque 29; el id se cita porque la memoria de cálculo de esa solicitud sustenta la descripción del método de Alcance 1.

