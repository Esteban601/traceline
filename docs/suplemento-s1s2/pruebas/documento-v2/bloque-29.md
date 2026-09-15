# Bloque 29 · Emisiones GEI Alcance 1 y 2 (+ Alcance 3 según régimen)

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v2-2026-09-15` |
| Longitud | 1,894 caracteres |
| Costo | $0.2304 |
| Duración | 38,260 ms |
| Velocidad | 74.8 tok/s |
| Tokens | 7,556 entrada · 2,863 salida |

---

## Texto

**Emisiones brutas absolutas de gases de efecto invernadero**

| Concepto | Valor | Unidad | Ejercicio |
|---|---:|---|---:|
| Inventario GEI Alcance 1 con memoria de cálculo | 1,240 | tCO2e | 2025 |
| Consumo de combustibles fósiles 2025 | 488,000 | litros | 2025 |
| Inventario GEI Alcance 2 (ubicación y mercado) | 3,860 | tCO2e | 2025 |

Empresa Demo, S.A.B. de C.V. revela sus emisiones brutas absolutas de gases de efecto invernadero generadas durante el ejercicio 2025, expresadas en toneladas métricas equivalentes de CO2, conforme se presentan en la tabla anterior. Las cifras corresponden al primer ejercicio sobre el que la Compañía informa bajo la NIIF S2.

Las emisiones de Alcance 1 comprenden las emisiones directas provenientes de fuentes que son propiedad de la Compañía o están bajo su control, en particular la combustión de gasolina y diésel en la flota vehicular y en las plantas de emergencia de las sucursales y los centros operativos. El volumen de combustibles fósiles consumido durante el ejercicio, que la tabla presenta en litros, constituye el dato de entrada a partir del cual se determinaron dichas emisiones directas.

Las emisiones de Alcance 2 comprenden las emisiones indirectas asociadas a la energía adquirida y consumida por la Compañía en sus instalaciones durante el ejercicio.

Conforme al párrafo C4 del Apéndice C de la NIIF S2, durante este primer periodo anual de aplicación la Compañía se acoge a la facilidad transitoria que la exime de revelar sus emisiones de gases de efecto invernadero de Alcance 3; en consecuencia, las cifras de emisiones brutas absolutas que se revelan corresponden a los Alcances 1 y 2.

La Compañía continuará avanzando en la medición y administración de sus emisiones de Alcance 3, priorizando las fuentes más relevantes asociadas a su operación, con el propósito de incorporar dicha revelación en periodos subsecuentes.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000007` — Inventario GEI Alcance 1 con memoria de cálculo — entregada y validada, valor 1240 tCO2e
- `sol:c0000000-0000-0000-0000-000000000012` — Consumo de combustibles fósiles 2025 — entregada y validada, valor 488000 litros
- `sol:c0000000-0000-0000-0000-000000000008` — Inventario GEI Alcance 2 (ubicación y mercado) — entregada y validada, valor 3860 tCO2e

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- Existe un dato de Alcance 3 total (sol:c3000000-0000-0000-0000-000000000001, 15,750 tCO2e, ejercicio 2025, entregado y validado) que el alivio C4 permite omitir. No se incluyó en el texto ni en la tabla. El revisor debe decidir si la emisora quiere revelarlo voluntariamente; de hacerlo, la frase sobre C4 y el cierre sobre periodos subsecuentes tendrían que reescribirse y el bloque 3 tendría que dejar de enumerar C4 como alivio adoptado.
- La solicitud de Alcance 2 se tituló 'ubicación y mercado' pero llegó un solo valor agregado (3,860 tCO2e) sin indicar a cuál de los dos métodos corresponde ni el desglose entre ambos. El bloque 32 requerirá ese desglose; conviene aclararlo con el cliente antes de aprobar la tabla, ya que la cifra publicada debe identificarse como basada en la ubicación conforme a la norma.
- La tabla incluye el consumo de combustibles fósiles (488,000 litros) como fila junto a las emisiones; es un dato de entrada, no una emisión bruta. Se comentó en prosa como dato de entrada sin describir el método (que corresponde al bloque 30). Verificar que la mezcla de unidades en la misma tabla no confunda al lector.
- La descripción de los alcances (combustión en flota vehicular y plantas de emergencia; energía adquirida) se limita a lo que indica la descripción de la solicitud de combustibles y a la definición normativa de Alcance 2. No se afirmó que el Alcance 2 provenga únicamente de electricidad porque no hay dato que lo respalde.
- No se mencionó el alivio C3 (sin comparativos) porque su enumeración corresponde al bloque 3; si el revisor prefiere una frase en este bloque indicando la ausencia de cifras comparativas, puede añadirse.

