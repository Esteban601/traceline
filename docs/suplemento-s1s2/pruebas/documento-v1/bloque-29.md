# Bloque 29 · Emisiones GEI Alcance 1 y 2 (+ Alcance 3 según régimen)

**Sección:** V · Métricas y objetivos · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Longitud | 1,767 caracteres |
| Costo | $0.1693 |
| Duración | 26,468 ms |
| Velocidad | 68.7 tok/s |
| Tokens | 6,779 entrada · 1,819 salida |

---

## Texto

**Emisiones brutas absolutas de gases de efecto invernadero**

| Concepto | Valor | Unidad | Ejercicio |
|---|---:|---|---:|
| Inventario GEI Alcance 1 con memoria de cálculo | 400,000 | tCO2e | 2025 |
| Inventario GEI Alcance 2 (ubicación y mercado) | 3,120.4 | tCO2e | 2025 |

Empresa Demo SAB de CV revela información sobre sus emisiones brutas absolutas de gases de efecto invernadero generadas durante el ejercicio 2025, expresadas en toneladas métricas equivalentes de CO2. La tabla que antecede presenta las cifras correspondientes a los Alcances 1 y 2.

Las emisiones de Alcance 1 comprenden las emisiones directas de gases de efecto invernadero generadas por fuentes que son propiedad de La Compañía o que se encuentran bajo su control, en particular las derivadas de la combustión en fuentes fijas y móviles asociadas a su operación. Las emisiones de Alcance 2 comprenden las emisiones indirectas de gases de efecto invernadero generadas por la producción de la energía que La Compañía adquiere y consume en sus instalaciones.

Conforme al párrafo C4 del Apéndice C de la NIIF S2, durante este primer periodo anual de aplicación La Compañía se acoge a la medida transitoria que la exime de revelar sus emisiones de gases de efecto invernadero de Alcance 3, por lo que las cifras de emisiones brutas absolutas presentadas en este apartado corresponden únicamente a los Alcances 1 y 2. Las cifras de ambos alcances se presentan en términos brutos, es decir, sin deducir compensaciones ni remociones de carbono.

La Compañía prevé continuar avanzando en la medición y administración de sus emisiones de Alcance 3, priorizando las fuentes más relevantes de su cadena de valor, con el propósito de incorporar dicha información a revelar en periodos subsecuentes.

## Fuentes

- `sol:c0000000-0000-0000-0000-000000000007` — Inventario GEI Alcance 1 con memoria de cálculo — entregada y validada, valor 400000 tCO2e
- `sol:c0000000-0000-0000-0000-000000000008` — Inventario GEI Alcance 2 (ubicación y mercado) — entregada y validada, valor 3120.4 tCO2e
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- Existe un dato de Alcance 3 total entregado y validado (sol:c3000000-0000-0000-0000-000000000001, 15,750 tCO2e, 2025) que el alivio C4 permite omitir. No se incluyó en el texto ni en la tabla; el revisor debe decidir si la emisora quiere revelarlo voluntariamente. Si se revela, habría que ajustar la frase sobre C4 en este bloque y en el bloque 3, y verificar el desglose por categorías (bloque 33 cubre Categoría 15).
- La solicitud de Alcance 2 pide ambos métodos (ubicación y mercado) pero llegó un solo valor agregado (3,120.4 tCO2e). No se identifica a cuál método corresponde; el bloque 32 requiere el basado en la ubicación y, en su caso, la información sobre instrumentos contractuales. Conviene solicitar el desglose.
- La solicitud sol:c0000000-0000-0000-0000-000000000012 (consumo de combustibles fósiles 2025, base del Alcance 1) está sin evidencia. No es requisito de este bloque, pero afecta la trazabilidad de la memoria de cálculo del Alcance 1 que corresponde al bloque 30 (datos de entrada).
- La afirmación de que las cifras son brutas (sin compensaciones ni remociones) se deriva de la definición del requisito NIIF S2 29(a)(i) y del título de la tabla; confirmar con la memoria de cálculo que efectivamente no se netearon compensaciones.
- Sin comparativos por alivio C3 (primer año), por lo que no se presentó ejercicio anterior; consistente con lo entregado.

