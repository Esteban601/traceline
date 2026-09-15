# Bloque 30 · Método de medición, datos de entrada y C5

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v2-2026-09-15` |
| Longitud | 1,946 caracteres |
| Costo | $0.2516 |
| Duración | 43,540 ms |
| Velocidad | 75.7 tok/s |
| Tokens | 7,520 entrada · 3,294 salida |

---

## Texto

Empresa Demo, S.A.B. de C.V. mide sus emisiones de gases de efecto invernadero de Alcance 1 y Alcance 2 conforme al Protocolo sobre Gases de Efecto Invernadero: Un Estándar Corporativo de Contabilidad y Reporte (2004), bajo el enfoque de control operacional para la determinación de sus límites organizacionales. La Compañía aplica este método desde 2022 y su inventario es verificado por un tercero independiente, por lo que no requiere acogerse a la medida transitoria del párrafo C5 del Apéndice C de la NIIF S2, que permitiría conservar durante el primer periodo de aplicación un método de medición distinto del Protocolo.

Las emisiones de Alcance 1 corresponden a la combustión de gasolina y diésel en la flota vehicular y en las plantas de emergencia de sucursales y centros operativos. El dato de entrada es el volumen de combustible consumido, que en el ejercicio 2025 ascendió a 488,000 litros, al que se aplican los factores de emisión publicados por la Secretaría de Medio Ambiente y Recursos Naturales (SEMARNAT).

Las emisiones de Alcance 2 se derivan del consumo de energía eléctrica adquirida de la red, medido a partir de los kilowatt-hora facturados por sucursal e instalación, que en 2025 sumaron 9,120,000 kWh. A este consumo se aplica el factor de emisión para electricidad del Registro Nacional de Emisiones.

Durante el ejercicio 2025 no se modificaron el método de medición, los factores de emisión ni las fuentes de los datos de entrada respecto del periodo anterior, de modo que las cifras del ejercicio son consistentes con las de los inventarios previos de la Compañía. Conforme a la medida transitoria del párrafo C3 del Apéndice C de la NIIF S2, la Compañía no presenta información comparativa del periodo anterior en este primer periodo anual de aplicación. Las cifras de emisiones brutas absolutas que resultan de este enfoque se presentan en la sección de emisiones de gases de efecto invernadero de este informe.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000006` — Consumo de energía eléctrica 2025 por instalación (kWh) — entregada y validada, valor 9120000 kWh
- `sol:c0000000-0000-0000-0000-000000000012` — Consumo de combustibles fósiles 2025 — entregada y validada
- `sol:fb2804fe-7795-4819-bda1-93b7ee863df3` — Enfoque de medición de emisiones y datos de entrada — entregada y validada
- `sol:f92d61da-cbbe-43b5-87c1-3baadb78126a` — Consumo de combustibles fósiles 2025 (flota y plantas de emergencia) — entregada y validada, valor 488000 litros
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- Las solicitudes sol:c0000000-0000-0000-0000-000000000012 y sol:f92d61da-cbbe-43b5-87c1-3baadb78126a son duplicadas (mismo contenido, 488,000 litros); la primera carece de unidad y valor estructurado. Conviene consolidarlas en la plataforma.
- El alivio C5 no figura entre los adoptados y el enfoque de medición confirma uso del Protocolo GEI desde 2022; el texto lo declara como no requerido. Si el revisor prefiere no mencionar C5 en absoluto, puede retirarse la frase sin afectar la cobertura de 29(a)(ii) y (iii).
- La emisora tiene inventarios verificados desde 2022. El alivio C3 permite omitir comparativos, pero existe la posibilidad de revelación voluntaria de cifras 2024 o de la tendencia 2022-2025; el revisor decide si se incorpora en el bloque 29.
- No se identifica en los datos el nombre del verificador tercero ni el nivel de aseguramiento (limitado/razonable); podría revelarse voluntariamente si la emisora lo autoriza.
- La solicitud de enfoque no especifica los gases incluidos en el inventario ni los valores de potencial de calentamiento global (fuente y versión del IPCC) utilizados para convertir a tCO2e. NIIF S2 29(a)(ii) y B22-B23 razonablemente esperan esa precisión; se recomienda solicitar el dato para robustecer este bloque o el 31.
- La cifra de Alcance 1 (1,240 tCO2e, sol:c0000000-0000-0000-0000-000000000007) no se usó en este bloque por corresponder al bloque 29; se omite deliberadamente para no duplicar.
- La descripción atribuye el factor eléctrico al Registro Nacional de Emisiones; en la práctica el factor de emisión del Sistema Eléctrico Nacional lo publica la CRE/SEMARNAT. Se transcribió tal como llegó; confirmar con la emisora la fuente exacta y el año del factor aplicado.

