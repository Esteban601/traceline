# Bloque 6 · Juicios, supuestos e incertidumbres

**Sección:** I · Introducción · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v1-2026-09-15` |
| Longitud | 1,573 caracteres |
| Costo | $0.2002 |
| Duración | 37,668 ms |
| Velocidad | 68.0 tok/s |
| Tokens | 6,075 entrada · 2,563 salida |

---

## Texto

En la preparación de la información a revelar sobre riesgos y oportunidades relacionados con el clima correspondiente al ejercicio 2025, Empresa Demo, S.A.B. de C.V. realizó juicios que, sin implicar la estimación de importes, tuvieron el efecto más significativo sobre la información presentada. El primero fue la delimitación del perímetro: las emisiones de gases de efecto invernadero se determinaron sobre las operaciones propias, mientras que la cartera de crédito se consideró como una exposición de carácter cualitativo. El segundo consistió en la clasificación sectorial de la cartera de acuerdo con su intensidad de carbono. El tercero fue la elección de los escenarios utilizados en el análisis de los riesgos y oportunidades relacionados con el clima.

Adicionalmente, la Compañía identifica fuentes de incertidumbre de medición que afectan la información cuantitativa presentada. Estas se concentran en la calidad de los datos proporcionados por los acreditados; en la estimación de las emisiones de Alcance 2 a partir de la facturación de energía eléctrica, dado que en 14 sucursales arrendadas con servicio incluido no se cuenta con medición directa del consumo; y en la estimación de la exposición de los colaterales, realizada con base en el código postal de su ubicación.

Los juicios descritos condicionan el alcance y la comparabilidad de la información cuantitativa y cualitativa contenida en este informe, y las fuentes de incertidumbre señaladas deben considerarse al interpretar las cifras de emisiones y las evaluaciones de exposición de la cartera.

## Fuentes

- `sol:a2d8baef-0d5b-4de6-89ee-d5124516fb5b` — Juicios significativos y fuentes de incertidumbre de estimación — entregada y validada
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- El tipo de bloque indica 'D→T + Tabla', pero no se entregó ninguna tabla en los datos; el texto se redactó solo en prosa. Si se prevé una tabla de juicios/incertidumbres, habría que armarla a partir de la misma solicitud.
- La solicitud sol:a2d8baef menciona 'la elección de escenarios' sin identificar cuáles escenarios se eligieron ni su fuente (p. ej., NGFS, AIE). El detalle corresponde al bloque 26, pero conviene verificar que ahí sí esté el dato.
- La solicitud dice que la exposición de colaterales se estima por código postal, sin precisar a qué tipo de riesgo (físico) se refiere; se redactó de forma neutral para no inferir. Confirmar si debe decir 'riesgos físicos'.
- Revelación voluntaria posible: cuantificar qué proporción de las emisiones de Alcance 2 corresponde a las 14 sucursales sin medición directa; los datos entregados no lo indican.
- La delimitación del perímetro (cartera solo como exposición cualitativa) es consistente con el alivio C4 de no revelar Alcance 3 / emisiones financiadas; conviene que el bloque 3 y el bloque 33 lo reflejen en los mismos términos.
- Ambigüedad en la solicitud: no queda claro si la estimación de Alcance 2 a partir de facturación aplica a todas las instalaciones o únicamente a las 14 sucursales arrendadas. El texto no lo resuelve; validar con el cliente antes de publicar.

