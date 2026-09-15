# Bloque 4 · Entidad que informa, periodo y conectividad

**Sección:** I · Introducción · **Vía:** perfil · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v1-2026-09-15` |
| Longitud | 2,236 caracteres |
| Costo | $0.2063 |
| Duración | 48,545 ms |
| Velocidad | 76.4 tok/s |
| Tokens | 6,525 entrada · 3,709 salida |

---

## Texto

La información a revelar relacionada con el clima contenida en este informe corresponde a Empresa Demo, S.A.B. de C.V. y sus subsidiarias consolidadas: Banco Demo, S.A., Institución de Banca Múltiple; Arrendadora Demo, S.A. de C.V., SOFOM E.R.; y Factoraje Demo, S.A. de C.V. La entidad que informa coincide con la que presenta los estados financieros consolidados de la Compañía, y el periodo sobre el que se informa es el ejercicio 2025, primer periodo anual de aplicación de las Normas NIIF S1 y S2.

El perímetro abarca la totalidad de las operaciones consolidadas en México: 118 sucursales bancarias, tres centros operativos ubicados en Monterrey, Ciudad de México y Mérida, y el corporativo. Las participaciones minoritarias no consolidadas quedan excluidas. Las métricas de emisiones de gases de efecto invernadero comprenden las operaciones propias de la Compañía, es decir, los Alcances 1 y 2. Las emisiones financiadas y las métricas de cartera se presentan como exposición cualitativa, y su cuantificación se difiere conforme al párrafo C4 del Apéndice C de la NIIF S2, aplicable a este primer periodo anual.

En materia de conectividad, la información relacionada con el clima se refiere a la misma entidad, al mismo perímetro de consolidación y al mismo periodo que la información financiera de la Compañía, de modo que los usuarios de los informes financieros con propósito general puedan relacionar ambos conjuntos de información y comprender los efectos de los riesgos y oportunidades relacionados con el clima sobre la situación financiera, el rendimiento financiero y los flujos de efectivo de la Compañía.

Respecto de las métricas basadas en el sector industrial, la Compañía pertenece al sector de bancos comerciales conforme a la clasificación SASB (Commercial Banks) y considera para su revelación las métricas de ese sector relativas a la incorporación de factores ambientales en el análisis de crédito y a la exposición de la cartera por sector económico. En el ejercicio 2025 la Compañía revela la composición de su cartera por sector económico y la proporción de cartera sostenible; la revelación completa del conjunto de métricas industriales aplicables a su sector se incorporará en ejercicios subsecuentes.

## Fuentes

- `sol:af41d00f-4130-4e03-b06c-4c36802e8af6` — Métricas basadas en la industria: sector de bancos comerciales — entregada y validada
- `perfil:denominacion_formal` — Perfil del emisor, campo denominacion_formal
- `perfil:entidad_que_informa` — Perfil del emisor, campo entidad_que_informa
- `perfil:perimetro` — Perfil del emisor, campo perimetro
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- El único datapoint asignado a este bloque es NIIF S2 32 (métricas basadas en el sector industrial), que temáticamente corresponde a la sección de métricas y no a 'Entidad que informa, periodo y conectividad'. Los requisitos naturales del bloque (NIIF S1 20 entidad que informa, S1 21-24 conectividad, S1 64 periodo) no aparecen en la lista de datapoints; se cubrieron con los campos del perfil, pero conviene verificar el mapeo del índice.
- La afirmación de que la entidad que informa coincide con la de los estados financieros consolidados se infiere de perfil:entidad_que_informa ('subsidiarias consolidadas') y perfil:perimetro ('operaciones consolidadas'). Confirmar con la emisora que el perímetro de consolidación es idéntico al de los estados financieros.
- Inconsistencia en perfil:perimetro: dice que las métricas de cartera se difieren 'conforme al alivio C4 del primer año'. El alivio C4 exime únicamente de revelar emisiones de Alcance 3 (incluidas emisiones financiadas); no ampara diferir métricas industriales de cartera. Al mismo tiempo, la solicitud sol:af41d00f afirma que en 2025 sí se revela la composición de cartera por sector y la proporción de cartera sostenible. El texto reproduce ambas afirmaciones; el revisor debe decidir cuál prevalece y corregir la referencia a C4 si aplica.
- La solicitud sol:af41d00f es cualitativa (valor null): los datos de composición de cartera por sector y proporción de cartera sostenible que se anuncian como revelados en 2025 no están en este bloque. Verificar que efectivamente se presentan en los bloques 33 o 34; de lo contrario, la afirmación 'la Compañía revela la composición de su cartera' quedaría sin respaldo en el informe.
- El alivio E4 (momento de la información) adoptado no se menciona en este bloque porque corresponde al bloque 3; verificar que allí se explique si la publicación ocurre después de los estados financieros.

