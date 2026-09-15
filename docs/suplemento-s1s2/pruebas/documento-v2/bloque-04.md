# Bloque 4 · Entidad que informa, periodo y conectividad

**Sección:** I · Introducción · **Vía:** perfil · **Estado:** `borrador`

| | |
|---|---|
| Modelo | `claude-fable-5-1` |
| Versión de prompt | `a5b-v2-2026-09-15` |
| Longitud | 2,243 caracteres |
| Costo | $0.2075 |
| Duración | 36,223 ms |
| Velocidad | 69.4 tok/s |
| Tokens | 7,017 entrada · 2,514 salida |

---

## Texto

Empresa Demo, S.A.B. de C.V. presenta la información a revelar relacionada con el clima correspondiente al ejercicio 2025, concluido el 31 de diciembre de 2025. La entidad que informa comprende a la Compañía y a sus subsidiarias consolidadas: Banco Demo, S.A., Institución de Banca Múltiple; Arrendadora Demo, S.A. de C.V., SOFOM E.R.; y Factoraje Demo, S.A. de C.V. El perímetro abarca la totalidad de las operaciones consolidadas en México, integradas por 118 sucursales bancarias, tres centros operativos ubicados en Monterrey, Ciudad de México y Mérida, y el corporativo. Las participaciones minoritarias no consolidadas se excluyen. Las métricas de emisiones de gases de efecto invernadero comprenden las operaciones propias, Alcances 1 y 2, mientras que las emisiones financiadas se difieren conforme al alivio del párrafo C4 de la NIIF S2 aplicable al primer ejercicio de adopción.

La Compañía pertenece al sector de bancos comerciales conforme a la clasificación SASB y evaluó la aplicabilidad de las métricas de ese sector a su modelo de negocio, revelando aquellas para las que dispone de información con la calidad requerida: la composición de la cartera por sector económico, la proporción de cartera sostenible y la exposición a sectores intensivos en carbono. Al 31 de diciembre de 2025 la cartera de crédito total ascendió a 86,400 millones de pesos, distribuida en crédito empresarial por 44,930 millones de pesos (52%), hipotecario por 18,140 millones de pesos (21%), consumo por 12,960 millones de pesos (15%) y agropecuario por 10,370 millones de pesos (12%). La cartera con etiqueta sostenible conforme a la Taxonomía Sostenible de México ascendió a 6,910 millones de pesos, equivalente al 8.0% de la cartera total. Dentro del crédito empresarial, 8,090 millones de pesos, el 9.4% de la cartera total, corresponden a sectores intensivos en carbono. La exposición de la cartera a riesgos climáticos se presenta en términos cualitativos y su cuantificación en términos de emisiones se incorporará en ejercicios subsecuentes. Las métricas restantes del sector se evaluarán conforme la Compañía disponga de información fiable, y esa evaluación se describe como juicio significativo en las bases de preparación de este informe.

## Fuentes

- `sol:af41d00f-4130-4e03-b06c-4c36802e8af6` — Métricas basadas en la industria: sector de bancos comerciales — entregada y validada, valor 86400 MDP
- `perfil:denominacion_formal` — Perfil del emisor, campo denominacion_formal
- `perfil:entidad_que_informa` — Perfil del emisor, campo entidad_que_informa
- `perfil:perimetro` — Perfil del emisor, campo perimetro
- `reporte:20000000-0000-0000-0000-000000000001` — Reporte [DEMO] Informe Anual Sustentable 2025, ejercicio 2025

## Pendientes

_Ninguno._

## Notas para el revisor — no se publican

- El único datapoint asignado a este bloque es NIIF S2 32 (métricas basadas en el sector industrial), que temáticamente corresponde más a los bloques 29-36 de métricas; el bloque 4 debería cubrir NIIF S1 20-21 y 27-28 (entidad que informa, periodo, conectividad con estados financieros). Se redactó cubriendo ambos aspectos con el perfil del emisor; confirmar que no se duplique la revelación sectorial en otro bloque.
- No se recibió confirmación explícita de que el periodo y la entidad que informa coinciden con los de los estados financieros consolidados (requisito de conectividad NIIF S1 20 y 64). El texto afirma el perímetro consolidado con base en perfil:entidad_que_informa; el revisor debe verificar la coincidencia con los estados financieros y, en su caso, añadir la frase de conectividad.
- La solicitud sol:af41d00f registra valor 86,400 MDP (cartera total) pero la descripción contiene múltiples cifras (composición por sector, cartera sostenible 6,910 MDP, sectores intensivos en carbono 8,090 MDP); las cifras derivadas provienen de la narrativa, no de un campo estructurado. Verificar que los porcentajes y montos suman consistentemente (44,930+18,140+12,960+10,370 = 86,400, correcto).
- La descripción menciona que la evaluación de métricas restantes del sector se documenta como juicio significativo en las bases de preparación: confirmar que el bloque 3 o 6 efectivamente lo incluye para que la referencia cruzada no quede vacía.
- Revelación voluntaria posible: la Compañía podría desglosar qué sectores integran la categoría de 'intensivos en carbono' y la definición aplicada; los datos no lo incluyen y no se pide en este bloque.

