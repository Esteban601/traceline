# Bloque 6 · Juicios, supuestos e incertidumbres

**Sección:** I · Introducción · **Vía:** datos · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v2-2026-09-15` |
| Longitud | 1,597 caracteres |
| Costo | $0.2117 |
| Duración | 37,403 ms |
| Velocidad | 74.2 tok/s |
| Tokens | 6,135 entrada · 2,777 salida |

---

## Texto

En la preparación de la información a revelar sobre riesgos y oportunidades relacionados con el clima correspondiente al ejercicio 2025, Empresa Demo, S.A.B. de C.V. realizó juicios que, sin implicar por sí mismos estimaciones de importes, tienen el efecto más significativo sobre la información contenida en este informe.

El primero de esos juicios fue la delimitación del perímetro. La Compañía consideró sus operaciones propias como el perímetro para la medición de emisiones de gases de efecto invernadero, mientras que la cartera de crédito se trató como una exposición de carácter cualitativo. El segundo juicio consistió en la clasificación de los sectores económicos presentes en la cartera según su intensidad de carbono. El tercer juicio fue la elección de los escenarios climáticos empleados en el análisis.

Por separado de esos juicios, la Compañía identifica fuentes de incertidumbre en la medición. La primera es la calidad de los datos proporcionados por los acreditados, de la que depende la caracterización de la cartera. La segunda es la estimación de las emisiones de Alcance 2 a partir de la facturación: en 14 sucursales arrendadas cuyo contrato incluye el servicio de energía no existe medición directa del consumo, por lo que las emisiones atribuibles a esos inmuebles se estiman. La tercera es la estimación de la exposición de los colaterales con base en su código postal, que aproxima la ubicación del bien sin identificar su localización exacta.

La Compañía revisará estos juicios y estimaciones en periodos subsecuentes conforme disponga de datos de mayor precisión.

## Fuentes

- `sol:a2d8baef-0d5b-4de6-89ee-d5124516fb5b` — Juicios significativos y fuentes de incertidumbre de estimación — entregada y validada
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- El tipo de bloque indica 'D→T + Tabla', pero en los datos no se entregó ninguna tabla; el texto se redactó solo en prosa. Confirmar si la tabla se genera en otro paso o si debe omitirse.
- El único requisito listado es NIIF S1 74 (juicios distintos de estimaciones), pero la solicitud validada también describe fuentes de incertidumbre de medición (calidad de datos de acreditados, Alcance 2 estimado por facturación, colaterales por código postal), que corresponden a NIIF S1 77-79. Se incluyeron en el texto porque el título del bloque abarca 'incertidumbres'; el revisor decide si mantenerlas aquí o remitirlas.
- La solicitud no especifica para qué análisis se eligieron los escenarios ni a qué tipo de riesgo (físico, presumiblemente) se refiere la exposición de colaterales por código postal; el texto se mantuvo neutral para no inferir. Si el bloque 26 lo confirma, puede precisarse.
- El detalle de las 14 sucursales arrendadas con servicio incluido es un dato operativo que la norma no exige revelar con ese nivel de granularidad; se incluyó por venir en la solicitud. La emisora puede optar por omitir la cifra.
- La frase de cierre sobre revisión en periodos subsecuentes es una declaración de intención sin fecha ni compromiso cuantitativo; verificar que la emisora esté de acuerdo en publicarla.

