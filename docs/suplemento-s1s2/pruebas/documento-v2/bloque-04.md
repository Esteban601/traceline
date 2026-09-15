# Bloque 4 · Entidad que informa, periodo y conectividad

**Sección:** I · Introducción · **Vía:** perfil · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v2-2026-09-15` |
| Longitud | 2,411 caracteres |
| Costo | $0.2243 |
| Duración | 39,309 ms |
| Velocidad | 73.4 tok/s |
| Tokens | 6,851 entrada · 2,884 salida |

---

## Texto

Empresa Demo, S.A.B. de C.V. presenta en este informe la información a revelar relacionada con el clima correspondiente al ejercicio concluido el 31 de diciembre de 2025, primer periodo anual en el que la Compañía aplica las Normas NIIF S1 y S2. La entidad que informa comprende a Empresa Demo, S.A.B. de C.V. y sus subsidiarias consolidadas: Banco Demo, S.A., Institución de Banca Múltiple; Arrendadora Demo, S.A. de C.V., SOFOM E.R.; y Factoraje Demo, S.A. de C.V. Las participaciones minoritarias no consolidadas se excluyen.

El perímetro abarca la totalidad de las operaciones consolidadas en México: 118 sucursales bancarias, tres centros operativos ubicados en Monterrey, Ciudad de México y Mérida, y el corporativo. Las métricas de emisiones comprenden las operaciones propias de la Compañía, correspondientes a los Alcances 1 y 2. Las métricas de cartera se presentan como composición por sector económico, proporción de cartera sostenible y exposición cualitativa a riesgos relacionados con el clima; su cuantificación en términos de emisiones se incorporará en ejercicios subsecuentes. La información relacionada con el clima se refiere a la misma entidad y al mismo perímetro de consolidación que los estados financieros consolidados de la Compañía, lo que permite a los usuarios de los informes financieros con propósito general relacionar ambos conjuntos de información.

La Compañía pertenece al sector de bancos comerciales conforme a la clasificación SASB (Commercial Banks) y considera para su revelación las métricas de ese sector relativas a la incorporación de factores ambientales en el análisis de crédito y a la exposición de cartera por sector. Al 31 de diciembre de 2025 la cartera de crédito total ascendió a 86,400 millones de pesos, con la siguiente composición por sector económico: crédito empresarial 52% (44,930 millones de pesos), hipotecario 21% (18,140 millones de pesos), consumo 15% (12,960 millones de pesos) y agropecuario 12% (10,370 millones de pesos). La cartera con etiqueta sostenible conforme a la Taxonomía Sostenible de México ascendió a 6,910 millones de pesos, equivalente al 8.0% de la cartera total. Dentro del crédito empresarial, 8,090 millones de pesos, equivalentes al 9.4% de la cartera total, corresponden a sectores intensivos en carbono. La revelación completa de las métricas basadas en el sector industrial se incorporará en ejercicios subsecuentes.

## Fuentes

- `sol:af41d00f-4130-4e03-b06c-4c36802e8af6` — Métricas basadas en la industria: sector de bancos comerciales — entregada y validada, valor 86400 MDP
- `perfil:denominacion_formal` — Perfil del emisor, campo denominacion_formal
- `perfil:entidad_que_informa` — Perfil del emisor, campo entidad_que_informa
- `perfil:perimetro` — Perfil del emisor, campo perimetro
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- El requisito NIIF S2 32 (métricas basadas en el sector industrial) quedó asignado al bloque 4, que por título cubre entidad, periodo y conectividad. La composición de cartera por sector y la exposición a sectores intensivos en carbono pueden solaparse con el bloque 34 (riesgos de transición: concentración y exposición) y con el bloque 33 (emisiones financiadas). Confirmar que esos bloques no repitan las cifras de cartera.
- La solicitud sol:af41d00f tiene valor numérico único (86,400 MDP); la desagregación por sector, la cartera sostenible (6,910 MDP) y la exposición a sectores intensivos en carbono (8,090 MDP) provienen solo del texto descriptivo de la solicitud, no de campos numéricos separados. Verificar aritmética: los cuatro sectores suman 86,400 y 100%; 6,910/86,400 = 8.0%; 8,090/86,400 = 9.36%, redondeado a 9.4%.
- La afirmación de que las métricas industriales completas se incorporarán en ejercicios subsecuentes no está amparada por un alivio transitorio específico de la NIIF S2 (los alivios C3, C4, E4, E5 no eximen de las métricas del párrafo 32). Confirmar con la emisora si desea sostener esa afirmación y si se explicará en el bloque 3 o 6 como juicio de la Compañía.
- La frase sobre conectividad con los estados financieros consolidados se apoya en que el perímetro se describe como 'operaciones consolidadas' y se excluyen participaciones no consolidadas; no hay un campo de perfil que afirme explícitamente la coincidencia con la entidad de los estados financieros. Confirmar con la emisora.
- El alivio E4 (momento de la información) y la relación temporal con la publicación de los estados financieros se dejan al bloque 3; no se mencionan aquí para evitar duplicidad.
- La descripción del perímetro menciona el diferimiento de emisiones financiadas por el alivio C4; se omitió deliberadamente en este bloque porque corresponde a los bloques 3, 29 y 33.

