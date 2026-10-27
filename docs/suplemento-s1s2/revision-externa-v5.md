# Revisión externa · Formato electrónico v5 y Excel de taxonomía v5 · Empresa Demo 2025

Fecha: 2026-10-27 · Lector externo (Claude) · Archivos: `Formato_electrónico_v5_-_Empresa_Demo_2025.xlsx` (hoja «Estructura Formato Electronico», 867 filas, columna K = Respuesta), `Excel_taxonomía_v5_-_Empresa_Demo_2025.xlsx` (hoja «Taxonomía NIIF S1 S2», 279 filas, columna C = Respuesta, más 15 hojas de datos), `auditoria-mapeo-v5.md`, `deudas-conocidas.md`, `auditoria-vocabulario-v5.txt`.

Rúbrica aplicada: la corregida en la revisión del v4. Negaciones y booleanos leídos al 100 % y cruzados con la celda vecina y con los hechos de la emisora; filas sin datapoint listadas aparte; Fidelidad (veracidad por celda) pesa el doble que Cobertura; una celda categórica falsa topa el entregable en 3. Reglas de diseño aceptadas: el Excel se califica solo por sus respuestas; la oración E5 una vez por encabezado de pilar (9 celdas); el perímetro de una cifra dentro de su respuesta. Deudas de `deudas-conocidas.md` no calificadas dos veces.

## 1. Rúbrica

| # | Criterio | Peso | v5 | Sustento |
|---|---|---|---|---|
| 1 | Veracidad por celda | 2 | **3** | Formato: los 46 booleanos y 11 enumeraciones cruzan con su vecina y con los hechos (lista en §3). Lo que impide el 4: filas 13, 17 y 19 (bloque «Para: Fideicomisos») llevan clave de cotización y razón social de la emisora como fideicomitente y administrador del patrimonio, mientras 14, 15 y 20 dicen «No aplica»; Empresa Demo no es fideicomiso. K640 dice que «no identificó efectos de los riesgos climáticos que requirieran reconocer ajustes… por lo que no se señala un riesgo significativo de ajuste material» en la fila de riesgos de transición; leída sola contradice K663, K91 y K92 (físicos: principal fuente de riesgo de ajuste material); falta «de transición». Excel: ocho «No aplica» falsos. Filas 20 (S1 30), 27 (S1 33(c)), 38 (S1 40(a)) y 55 (S1 46–50) dicen «No aplica en este periodo por el alivio E5»: E5 no hace inaplicable el requisito de S1, lo responde con la información de clima (la fila 30 lo hace bien: «se revela conforme a NIIF S2 16(a)»); la 55 contradice la hoja «NIIF S1 46-50» del mismo libro, que está llena. Filas 144, 146, 147 y 150: «No aplica. … se acoge a C4 y no revela sus emisiones de Alcance 3»: Alcance 3 y Categoría 15 aplican y se difieren; es el mismo defecto señalado en el v4.1, sin cambio. |
| 2 | Cobertura | 1 | 3 | Formato: K615 (extracto de Alcance 3) vacía donde 614 y 616 llevan C4; K631, K654 y K677 («dónde se concentran») repiten el texto de exposición de 627, 650 y 673 en vez del de concentración de 623, 646 y 669. Excel: seis filas con requisito y sin respuesta —31, 32, 37 (S1 35(a), 35(d)) y 98, 99, 104 (S2 16(a), 16(d))—; la respuesta de la fila anterior no las cubre (97 habla de situación financiera, no de rendimiento ni flujos). Misma causa que la deuda 1 (un código por párrafo), pero en el Excel la consecuencia es ausencia, no repetición, y el Excel se califica por sus respuestas. |
| 3 | Voz del emisor | 1 | 4 | Sin vocabulario de plataforma en K ni en el Excel. «Sí.» como primera palabra de celdas de texto (K126, K135, K137) y «488000» sin separador en K606 (K596 dice «488,000»). |
| 4 | Claridad | 1 | 4 | Nueve oraciones E5 por decisión; cifras con perímetro dentro de la respuesta (K169–K463, K627, K650, K673); efectos actuales, previstos y riesgo de ajuste ya con texto propio (K633–K640, K656–K663, K679–K686). |
| 5 | Extensión | 1 | 3 | Fuera de deudas: 631/654/677 con 627/650/673; 596, 597, 599 y 601 (29(a)(iii)(1)–(3), misma causa que la deuda 1, no listada); 135/137; 91/92; 695/697/701; 705/709; 609/611. |
| 6 | Coherencia entre entregables | 1 | 3 | Alcance 3 y Categoría 15: Formato «No revelado · alivio C4» (613–621, 711–720) vs Excel «No aplica… C4» (144–150). 36(e): hoja «NIIF S2 36(e)(i)-(iv)» responde (i) con «No se basa en créditos de carbono. El objetivo… se cumplirá…» y la hoja principal (276) con «No aplica». Hoja «NIIF S2 29(a)(vi)(1)»: columna 2024 con «alivio C4»; el Formato (589) atribuye 2024 a C3. Excel 55 vs su hoja «NIIF S1 46-50». Cifras, fechas y nombres coinciden en los dos libros y en «Tabla NIIF» (eficiencia operativa en mediano plazo; huracanes con largo plazo). |
| 7 | Trazabilidad | 1 | 4 | Cada cifra nombra riesgo, ejercicio y base; los textos narrativos remiten a sección. Sin anclas a la sección del Word en el Formato. |
| 8 | Pendientes y vacías | 1 | 3 | Excel sin marcadores. Formato: 18 vacías con tipo, 16 encabezados o logotipos; 615 (ver 2); 699 y 707 vacías por «No» en 696 y 704, correcto. K787 y K788 «Métricas por industria: pendiente de catálogo SASB (Fase C)» siguen bajo CG-AA (ropa y calzado); el bloque FN-CB (805) vacío. Excel: seis filas sin respuesta (ver 2). |
| 9 | Tablas | 1 | 3 | Formato: 23 tablas-plantilla vinculadas; 589, 626, 649 correctas. Excel: hoja «NIIF S2 36(a)-(d)» con «Falso» crudo y filas desalineadas («Cartera sostenible | Falso» en la columna de gases); cartera sostenible y PCAF no son objetivos de emisiones GEI y no van en 36(a)–(d); hoja «NIIF S2 29(a)(vi)(1)» con 2024 bajo C4. |
| 10 | Vocabulario de plataforma | 1 | 3 | Formato K: K787 y K788 «Fase C» (la auditoría de vocabulario reporta 0 porque no busca esa cadena). Hojas «Leyenda» y «Métricas SASB» del Formato: «Fase C», «plataforma», «Perfil», «registros de clima». Excel limpio. |
| | **Promedio ponderado** | 11 | **3.3** | (3×2 + 3+4+4+3+3+4+3+3+3) / 11 = 3.27. Tope por veracidad: 3. |

Respecto del v4 (2.9): K592 corregida, 16 celdas de efectos con texto propio, B65(e) llenas, K747 «Banca comercial», 13 celdas de método sin vocabulario de plataforma, 62 → 9 oraciones E5. Lo que queda es casi todo del Excel y de dos celdas de la plantilla CG-AA.

## 2. Celdas que IRStrat no entregaría así

Formato electrónico
- **K13, K17, K19** → «No aplica» (no es fideicomiso), como 14, 15 y 20.
- **K640** → «…no identificó efectos de los riesgos **de transición** que requirieran…».
- **K615** → «No revelado · alivio C4».
- **K631, K654, K677** → el texto de concentración (623, 646, 669), no el de exposición.
- **K787, K788** → vacío o «No aplica: sector CG-AA»; la nota SASB, si va, en 805 (FN-CB) y sin «Fase C».
- **K606** → «488,000 litros».
- **K126, K135, K137** → sin «Sí.» inicial en celdas de texto (el booleano vecino ya lo dice).
- Hojas **«Leyenda»** y **«Métricas SASB»** → sin «Fase C», «plataforma», «Perfil», «registros de clima».

Excel de taxonomía
- **Filas 20, 27, 38, 55** → «La información correspondiente a este requisito, en lo relativo al clima, se revela conforme a NIIF S2 10 / 14 / 21(a) / 29» (la fórmula de la fila 30).
- **Filas 144, 146, 147, 150** → «No revelado · alivio C4» (como el Formato). En 147 además: «La Compañía participa en banca comercial».
- **Filas 31, 32, 37, 98, 99, 104** → respuesta propia o, al menos, «Véase la fila anterior» cuando la anterior realmente la cubra; 98/99/104 no quedan cubiertas por 97/103.
- **Fila 276** → el texto de la hoja «NIIF S2 36(e)(i)-(iv)» («No se basa en créditos de carbono…»), que es mejor respuesta que «No aplica».
- **Hoja «NIIF S2 36(a)-(d)»** → solo el objetivo de reducción de Alcances 1 y 2; «Falso» → «No»; columnas alineadas.
- **Hoja «NIIF S2 29(a)(vi)(1)»** → columna 2024 con «alivio C3».

## 3. Negaciones y booleanos verificados

Formato electrónico, columna K. Veredicto «cuadra» = coincide con la celda vecina y con los hechos de la emisora (banco comercial; alivios E4, E5, C3, C4; sin precio interno del carbono, sin remuneración climática, sin créditos de carbono, sin objetivo neto; Protocolo GEI desde 2022; inventario verificado; procesos cambiados en 2025; escenarios usados).

| Fila | Pregunta | Respuesta | Veredicto |
|---|---|---|---|
| 14, 15, 20 | Logotipo, denominación, número de fideicomiso | No aplica | Cuadra |
| 13, 17, 19 | Clave, fideicomitente, administrador (bloque fideicomisos) | EDEMO / Empresa Demo | **No cuadra** con 14, 15, 20 |
| 38 | ¿Métricas de desempeño en remuneración? (6(a)(v)) | No | Cuadra (K704, K709) |
| 44 | ¿Función delegada a cargo o comité? (6(b)(i)) | Sí | Cuadra (K45 vacía por diseño, K47 texto) |
| 49 | ¿Controles y procedimientos? (6(b)(ii)) | Sí | Cuadra (Excel 77) |
| 126 | ¿Escenarios fundamentan la identificación de riesgos? (25(a)(ii)) | Sí | Cuadra con Excel 116; en el Word del 11 de octubre seguía pendiente: verificar que el Word v5 lo afirme |
| 134 | ¿Cambió los procesos? (25(a)(vi)) | Sí | Cuadra (K135, K137; Excel 120) |
| 148, 172, 197, 221, 246, 270, 294, 319, 343, 369, 393, 418, 442 | ¿Métrica requerida por una Norma NIIF? | Verdadero | Cuadra (fuente «Norma NIIF» en la fila siguiente) |
| 161, 185, 210, 234, 259, 283, 307, 332, 356, 382, 406, 431, 455 | ¿Se deriva de ajuste de otra fuente? | No | Cuadra (163… «No aplica: sin ajuste») |
| 167, 191, 216, 240, 289, 313, 338, 362, 388, 412, 437, 461 | ¿Validada por tercero? | No | Cuadra |
| 265 | ¿Validada por tercero? (GEI) | Sí, Verificadora Demo | Cuadra (K596, Word 30) |
| 465 | ¿Redefinió o sustituyó una métrica? | No | Cuadra (467–471 No aplica; primer año) |
| 478 | ¿Objetivo relacionado con el clima? | Verdadero | Cuadra |
| 516 | ¿Objetivo validado por tercero? (34(a)) | No | Cuadra (hoja «NIIF S2 34», Word 39) |
| 532 | ¿Enfoque de descarbonización sectorial? (36(d)) | No | Cuadra |
| 535 | ¿Uso previsto de créditos de carbono? | No | Cuadra (534–546) |
| 552 | ¿Periodo distinto de 12 meses? | No | Cuadra (554–558) |
| 565 | ¿Cumple todos los requerimientos? | Sí | Cuadra con S1 72–73 y los alivios declarados; con pendientes abiertos en el Word sería prematuro |
| 582 | ¿Adoptó E5? | Sí | Cuadra (Leyenda: E4, E5, C3, C4) |
| 592 | ¿Mide conforme al Protocolo GEI? (29(a)(ii)) | Sí | Cuadra (K596, Excel 129). Corregida desde v4 |
| 613, 614, 616, 617, 621 | Alcance 3 | No revelado · alivio C4 | Cuadra |
| 618, 619 | Actividad | Banca comercial | Cuadra |
| 643, 666, 689 | ¿Métricas sectoriales podrían satisfacer…? | Sí, parcialmente | Cuadra (K722, K723 Sí). Corregidas desde v4 |
| 696 | ¿Precio interno del carbono? | No | Cuadra (K695, K697, K701; Word 37) |
| 704 | ¿Clima en remuneración? | No | Cuadra (K705, K709 «cero por ciento») |
| 711–720 | 29A–29C | No revelado · alivio C4 | Deuda 2; no se juzga |
| 723 | ¿Considerará métricas sectoriales? | Sí | Cuadra |
| 725, 726 | Sector | FN-CB | Cuadra |
| 733–741 | Gestión de activos | No aplica por actividad | Cuadra |
| 747 | Banca comercial | Banca comercial | Cuadra. Corregida desde v4 |
| 748–762 | Banca comercial, cifras | No revelado · alivio C4 | Cuadra |
| 767–782 | Seguros | No aplica por actividad | Cuadra |
| 861, 863, 866 | Comparativos revisados (B50–B59) | No aplica | Cuadra (C3) |
| 574, 576, 578 | Errores de periodos anteriores | No se identificaron / No aplica | Cuadra |
| 640 | Riesgo de ajuste material, transición | «no se señala un riesgo…» | **Cuadra solo si se lee como transición**; el texto dice «riesgos climáticos» |

Excel de taxonomía, columna C.

| Fila | Requisito | Respuesta | Veredicto |
|---|---|---|---|
| 20, 27, 38, 55 | S1 30, 33(c), 40(a), 46–50 | No aplica por E5 | **No cuadra**: E5 no inaplica, remite a S2; 55 contradice la hoja «NIIF S1 46-50» |
| 30, 34, 35, 36 | S1 35(a)–(d) | Remisión a S2 16 | Cuadra |
| 77 | S2 6(b)(ii) | Sí, controles… | Cuadra |
| 116 | S2 25(a)(ii) | Sí, escenarios… | Cuadra con K126 (misma reserva sobre el Word) |
| 120 | S2 25(a)(vi) | Sí, cambios 2025 | Cuadra |
| 144, 146, 147, 150 | Alcance 3, Categoría 15, EI19–EI24 | No aplica … C4 | **No cuadra**: aplican y se difieren; Formato dice «No revelado · alivio C4» |
| 270 | 36(c) | No aplica: ningún objetivo neto | Cuadra |
| 272, 276–279 | 36(e) | No aplica: sin créditos | Cuadra (deuda 36(e) en dos redacciones); 276 difiere de su hoja de datos |
| Hoja 36(a)-(d) | Descarbonización sectorial | Falso ×3 | Cuadra el valor para Alcances 1 y 2; cartera sostenible y PCAF no son objetivos GEI |
| Hoja 35 | Tendencias | No aplicable: primer ejercicio | Cuadra |
| Hoja 29(a)(vi)(1) | 2024 | No revelado · alivio C4 | Debe decir C3 |

## 4. Filas sin datapoint (norma enmendada a la mano)

Sin cambio respecto del v4: 711–720 (29A, 29B, 29C), 757–758 y 777–778 (B62A, B63A), 760 y 780 (texto de B62A/B63A sin referencia en la plantilla), 741/751/771 (etiquetas copiadas de B61(c)), 735/737 (etiqueta duplicada). Todo en `deudas-conocidas.md` §2 y §5; no se califica. Observación nueva: la Leyenda del Formato declara «Alivios: E4, E5, C3, C4», y E4 (publicación posterior a los estados financieros) no aparece en ninguna celda del Formato ni del Excel; si se adopta, S1 E4 no exige revelarlo en el Formato, pero el Word debe seguir diciéndolo (el del 11 de octubre lo decía).

## 5. Cobertura de esta revisión

Leídas celda a celda: todas las celdas K categóricas (booleanos, enumeraciones, «No aplica», «No revelado», respuestas de ≤ 70 caracteres), todas las vacías con y sin tipo, 83–100, 115, 126–137, 169–463 (método y verificación), 571, 584–790, 861–867, las hojas «Tabla NIIF», «Métricas SASB» y «Leyenda»; en el Excel, todas las respuestas categóricas y vacías de la hoja principal y las hojas «NIIF S1 46-50», «NIIF S2 29(a)(vi)(1)», «35», «36(a)-(d)», «36(e)(i)-(iv)», «22(b)(ii)». Por muestreo: las narrativas de gobernanza y estrategia (25–81) y las hojas de datos restantes. No se cruzó contra el Word v5 (no adjunto); las referencias al Word son al del 11 de octubre.
