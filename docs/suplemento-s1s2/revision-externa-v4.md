# Revisión externa · Formato electrónico v4 y Excel de taxonomía v4 (Empresa Demo 2025)

Fecha: 26 de octubre de 2026
Revisor: lector externo (Claude), segunda conversación
Insumos: `Formato_electronico_NIIF_Empresa_Demo_2025_v4.xlsx`, `Taxonomia_NIIF_Empresa_Demo_2025_v4.xlsx`, `auditoria-mapeo-formato-v4.md`, Word del suplemento del 11 de octubre (último que tiene el revisor; el aprobado de v40 no se cruzó).
Numeración: filas de Excel de la hoja «Estructura Formato Electronico» (coinciden con la celda K). La auditoría mecánica numera filas del JSON con un desfase de 279 (su 439 es la K718 de aquí).

Deudas conocidas que no se califican dos veces: repeticiones por inciso en K85–K90 y S2 33/34; 29A–29C fuera del catálogo (K711–K720 con alivio C4); marcadores de pendiente en S2 30 y B65(e); 36(e) «no aplica» por regla en dos redacciones.

---

## 0. Por qué la lectura de v3 no atrapó K433 y K437

La lectura de v3 verificó tres cosas: que las cifras cruzaran entre Word, taxonomía y Formato; que los alivios C3/C4/E5 aparecieran en los tres entregables; y que las celdas vacías y las tablas-plantilla estuvieran. Las frases de alivio y los booleanos se trataron como **etiquetas** (presentes o ausentes), no como **afirmaciones** (verdaderas o falsas contra el Word y el Perfil). Y las filas cuya referencia no existe en el catálogo (29B, 29C, enmiendas 2025) recibieron lo que el generador puso y se leyeron como una fila más de la misma sección, sin preguntar si el texto correspondía a una emisora que participa en banca comercial y que mide con PCAF el 42% de su cartera empresarial.

Lo que cambia en la rúbrica a partir de v4:

1. **Negaciones al 100%, no por muestra.** Toda celda que afirme un «No», «No aplica», «No revelado», «no participa», «no tiene» se contrasta contra el hecho del Word o del Perfil que la sustenta. Son las celdas donde una regla de plantilla produce una afirmación falsa con más facilidad.
2. **Booleanos como hechos.** Cada «Sí/No/Verdadero/Falso» se cruza con la celda narrativa vecina y con el Word. Un booleano contradicho por su propia explicación cuenta en Fidelidad y en Coherencia.
3. **Filas sin datapoint listadas aparte.** Toda fila cuya referencia no esté en el catálogo (o esté mapeada a un datapoint «más general») se lee con la norma vigente a la mano, incluidas las enmiendas de 2025 (29A–29C, B62A, B63A), y se reporta por separado.
4. **Fidelidad pesa el doble que Cobertura cuando chocan.** Una celda llena y falsa es peor que una vacía.

Con esa rúbrica v3 no habría dado 4.0. Esta lectura aplica la rúbrica corregida.

---

## 1. Calificación v4 (misma rúbrica, 1–5; 5 = entregable a una emisora sin tocar)

| # | Criterio | v4 | Comentario (fila o celda) |
|---|---|---|---|
| 1 | Fidelidad | 3 | K38 «Sí» a «¿las métricas de desempeño se incluyen en las políticas de remuneración?» cuando K704/K707 y el Word dicen que ninguna proporción está vinculada (cero por ciento). K592 «No» a «¿mide conforme al Protocolo GEI?» cuando K596 y la taxonomía (fila 137) dicen que mide conforme al Protocolo GEI desde 2022. K643/K666/K689 «No» a «¿las métricas sectoriales podrían satisfacer los requerimientos?» cuando K722/K725 revelan FN-CB. Tres hechos del Formato que no están en el Word del 11 de octubre: «reubicar hasta 2028 seis sucursales» (K105/K110/K111), «aprobó los objetivos el 24 de abril de 2025» (K36/K39/K41), «Verificadora Demo, S.C.» (K265): verificar que estén en el Word aprobado de v40. |
| 2 | Cobertura | 4 | Vacías que deberían tener valor: K711 (29A), K723 (¿considerará métricas sectoriales?), K45/K697/K705 («¿Por qué?» tras un Sí/No), K861/K866 (B50/B54: «No aplica», como K863). K644/K667/K690 (B65(e)) vacías cuando el Word ya nombra las partidas (estimación preventiva; propiedades, mobiliario y equipo; gastos de administración): es deuda conocida como marcador, pero aquí ni marcador hay. |
| 3 | Voz del emisor | 4 | Voz correcta y denominaciones unificadas. «la Dirección» por gerencia ejecutiva (K707/K709) es aceptable. K606 «se acompaña de su memoria de cálculo» es voz de plataforma, no de emisora. |
| 4 | Claridad | 4 | K116/K117/K119: «Fecha de inicio/fin del periodo» respondidas con una oración; deben ser fechas. K179/K183/K228/K232/K253/K257/K301/K305/K350/K354/K400/K404/K449/K453: descripciones de métrica copiadas de la norma con dos puntos finales. K697 vacío y K699 lleno: el «No» de K696 necesita el «¿Por qué?», no el «¿Cómo lo está haciendo?». |
| 5 | Extensión | 3 | Fuera de las deudas conocidas: K633–K640 (ocho celdas de B65(c), riesgos de transición) con el mismo párrafo de exposición de K627; K656–K663 (riesgos físicos) con el de K650; K679–K686 (oportunidades) con el de K673. Veinticuatro celdas que preguntan por efectos financieros y reciben la cifra de exposición. La oración del alivio E5 encabeza ~60 celdas; es la regla acordada, pero una emisora la pondría una vez por sección. |
| 6 | Coherencia | 3 | K38 vs K704/K707 (remuneración Sí vs No). K592 vs K596 y taxonomía 137 (Protocolo GEI No vs conforme). K643/K666/K689 vs K722/K725 (sectoriales No vs FN-CB). Taxonomía, hoja «NIIF S2 22(b)(ii)», filas 7–8 «Pendiente en plataforma» para supuestos tecnológicos y otros, cuando K114/K115 y el Word traen «40% de generación limpia en la matriz eléctrica». Taxonomía, hoja «NIIF S2 36(e)(i)-(iv)», filas 5–7 «Pendiente en plataforma» cuando el Formato K542/K544/K546 dice «No aplica»: la deuda de 36(e) no es de dos redacciones sino de tres estados. Leyenda K12 «Alivios de este reporte: C3, C4, E5» omite E4, que el Word sí invoca (bloques 2 y 3). |
| 7 | Trazabilidad | 4 | Cifras cruzadas con el Word: 1,240; 3,860; 8,090/9.4%; 14,200/16.4%; 10,370/12%/640; 6,910/8%/2,000; 40/34%; 31.0/31.4/0.4; 12.3 capex/6.2 opex; ICAP 15.8/10.5; AR5; 488,000 L; 104/14 sucursales. Las 23 tablas-plantilla conservan `vm=` y `xl/richData` (verificado en el zip). Lo que no puedo rastrear: los tres hechos de Fidelidad y K14,200 «16.4% del pasivo total» (14,200/0.164 = 86,585 ≈ cartera total 86,400; base a verificar contra el balance). |
| 8 | Pendientes | 4 | El Formato no lleva marcadores, correcto para un formato. En la taxonomía, «Pendiente en plataforma» marca como faltante lo que existe (22(b)(ii)). Los marcadores de S2 30 y B65(e) son deuda conocida. |
| 9 | Tablas | 4 | Las 23 imágenes de plantilla están. Líneas de datos de K589/K604/K626/K649/K672 bien formadas, con unidades y alivio C3. Resta: K787/K788 («pendiente de catálogo SASB») colocadas bajo [805100] Ropa y calzado (CG-AA), que no es el sector de la emisora; hoja «Métricas SASB» con una sola línea de texto de proyecto; «capital: gasto 12.3» / «capital: financiación 640» en K649 es taquigrafía que una emisora reescribiría. |
| 10 | Vocabulario de plataforma | 3 | «Cifras de los registros de clima, capturas validadas.» abre 12 celdas de S1 50(d): K169, K193, K218, K242, K291, K315, K340, K364, K390, K414, K439, K463. «pendiente de catálogo SASB (Fase C)» en K787, K788 y en la hoja «Métricas SASB». «memoria de cálculo» en K606 y en taxonomía 148. Taxonomía: «Ver sección 28 · Emisiones GEI Alcance 1 y 2 (+ Alcance 3 según régimen)» arrastra el título con paréntesis de plataforma. |

**Promedio v4: 3.6** (v3 había dado 4.0 con la rúbrica anterior; la diferencia es que ahora los booleanos y las negaciones se leen como afirmaciones).

### 1.1 Celdas que IRStrat no entregaría así

Falsas o contradictorias (corregir el valor):

- K38 → «No» (y K39/K41 explican el cero por ciento y la evaluación de CAPS a partir de 2027).
- K592 → «Sí» (y K594 queda vacío o «No aplica», porque no hay método distinto).
- K643, K666, K689 → «Sí, parcialmente» (FN-CB-410a: exposición por sector y criterios ambientales en el análisis de crédito, como dice K722).
- Leyenda K12 → «C3, C4, E4, E5».

Voz de plataforma (reescribir):

- K169, K193, K218, K242, K291, K315, K340, K364, K390, K414, K439, K463: quitar «Cifras de los registros de clima, capturas validadas.» y la etiqueta «(ejercicio 2025)» entre comillas latinas; dejar la descripción del método y el dato.
- K787, K788 y hoja «Métricas SASB»: vacío o «No aplica: la emisora no participa en este sector» bajo CG-AA; las métricas FN-CB, cuando existan, van bajo [815200].
- K606 y taxonomía 148: quitar «y se acompaña de su memoria de cálculo».

Vacías con contenido disponible:

- K711 (29A): «No revelado · alivio C4», consistente con K712–K720.
- K723: «Sí» (y K725 ya trae FN-CB).
- K45, K697, K705: la explicación del Sí/No.
- K861, K866: «No aplica».
- K644, K667, K690 (B65(e)): la frase de partidas que el bloque 10 del Word ya tiene.

Contenido que no responde a la pregunta (reemplazar, no repetir):

- K633–K640, K656–K663, K679–K686 (B65(c), efectos financieros actuales y previstos por tipo de riesgo): hoy repiten la exposición; la respuesta es la del bloque 10 del Word (sin efectos materiales en 2025; 12.3 MDP capex y 6.2 MDP primas en el sureste; riesgo de ajuste sobre la estimación preventiva), filtrada por tipo de riesgo.
- K116/K117/K119: «01/01/2025» y «31/12/2025».

A verificar contra el Word aprobado de v40 (no están en el del 11 de octubre):

- K105/K110/K111 «reubicar hasta 2028 seis sucursales en zonas de inundación».
- K36/K39/K41 «aprobó los objetivos climáticos… el 24 de abril de 2025».
- K265 «Verificadora Demo, S.C., con aseguramiento limitado».

---

## 2. Pasada semántica: secciones de emisiones financiadas (K729–K783; EI25–EI38)

Criterio: la etiqueta de la fila (columna D) contra el datapoint al que está mapeada, aunque la referencia de la columna A coincida.

| Fila | Etiqueta (D) | Referencia (A) | Qué pide la norma | Veredicto |
|---:|---|---|---|---|
| 729 | Emisiones Financiadas | «NIIF S2 58-B63A» | B58–B63A | Errata de la plantilla BMV («58» por «B58»). No es nuestra, pero sale en la entrega. |
| 735 y 737 | Porcentaje del total de activos bajo gestión incluido en el cálculo | B61(c) | B61(c): % de AG incluido | Correcto, pero la etiqueta está dos veces (735 y 737) para un solo inciso. |
| 741 | Desagregación de las emisiones financiadas por clase de activo | EI25 a EI38 | B61 no pide desagregación por clase de activo; eso es B62(a)(ii) (bancos) | **No corresponde**: etiqueta de bancos colocada en gestión de activos. La respuesta «No aplica por actividad» es correcta por accidente. |
| 747 | Emisoras que participen en actividades de banca comercial: | EI25 a EI38 | Los EI son ejemplos ilustrativos; el requisito es B62 | Referencia mal citada en la plantilla. La respuesta «No revelado · alivio C4» en una fila de encabezado/selector: debería ser «Banca comercial» (como K618) y el alivio en las filas de datos. |
| 748–750 | Tablas Alcance 1/2/3 por clase de activo | B62(a) y (b) | B62(a)(i)(ii), (b)(i)(ii) | Corresponde. |
| 751 | Porcentaje del total de **activos bajo gestión** incluido en el cálculo | B62(c) | B62(c): % de la **exposición bruta** | **No corresponde**: etiqueta de gestión de activos (B61(c)) bajo bancos. Cuando una emisora bancaria la llene, debe responder exposición bruta. |
| 753 | Explicación de las exclusiones, incluido el tipo de activos excluidos | B62(c)(i) | B62(c)(i) | Corresponde. Faltan filas para B62(c)(ii) (excluir mitigadores de riesgo) y (iii) (% de compromisos no utilizados por separado): huecos de la plantilla, no del generador. |
| 755 | Metodología… método de asignación | B62(d) | B62(d) | Corresponde. |
| 757–758 | Desagregación industrial / Sistema de clasificación industrial | B62A(a) | B62A (enmienda 2025: sistema de clasificación en lugar de GICS obligatorio) | Corresponde a la norma enmendada; no existe en el catálogo (deuda 29A–29C/B62A). |
| 760 | Información que permite a los usuarios comprender… | B62A | B62A(a)(ii)/(b) | Etiqueta genérica; aceptable. |
| 762 | Explicación de por qué la incorporación de clases de activos adicionales… | B62A(b) | Esto es B62(a)(ii) in fine, no B62A(b) | Referencia equivocada en la plantilla; la etiqueta sí corresponde a un inciso real. |
| 768–770 | Tablas seguros Alcance 1/2/3 | B63(a)(b) | B63(a)(b) | Corresponde. |
| 771 | Porcentaje del total de **activos bajo gestión** incluido en el cálculo | B63(c) | B63(c): % de la **exposición bruta** | **No corresponde**, mismo defecto que 751. |
| 773 | Explicación de las exclusiones | B63(c)(i) | B63(c)(i) | Corresponde. Falta fila para B63(c)(ii) (compromisos no utilizados). |
| 777–778 | Desagregación industrial / sistema de clasificación | B63A(a) | B63A | Corresponde a la norma enmendada; fuera del catálogo. |
| 782 | Explicación de clases de activos adicionales | B63A(b) | Es B63(a)(ii) in fine | Misma referencia equivocada que 762. |

Hallazgo de fondo: todas estas filas (unas treinta) están mapeadas al único datapoint `NIIF S2 29 (a)(vi)(2)`. Para Empresa Demo da igual porque todo cae en C4 o en «no aplica por actividad». Para un banco en segundo año, B62(a)–(d), B62A y B63/B63A necesitan datapoints propios o el Formato no se puede llenar desde la plataforma. Es la ampliación de catálogo que ya está anotada como encargo posterior; esta pasada le da la lista de incisos.

---

## 3. Deudas conocidas: solo lo que la lectura añade

- **29A–29C (K711–K720)**: K711 está vacía mientras K712–K720 llevan el alivio; igualarla.
- **36(e)**: además de las dos redacciones de «no aplica» (K534/K536/K538/K540/K546 con punto; K542/K544 con dos puntos), la taxonomía tiene un tercer estado, «Pendiente en plataforma», en las filas 5–7 de su hoja. Tres estados para un mismo hecho.
- **B65(e)**: en el Formato (K644/K667/K690) no hay marcador, hay vacío; en la taxonomía (fila 191) sí hay marcador. Los dos entregables no coinciden sobre si el requisito está pendiente o simplemente no se respondió.
- **S2 33/34 (K496–K522)**: además de la repetición, K520 (34(c), métricas de seguimiento) y K522 (34(d), revisiones efectuadas) llevan el texto de 34(b); 34(c) debería decir «tCO2e por sucursal y por colaborador; porcentaje de cartera sostenible; porcentaje de cartera empresarial con PCAF» y 34(d) «Ninguna revisión en 2025».

---

## 4. Lo que está bien y conviene no tocar

Las 23 tablas-plantilla volvieron con sus vínculos; las líneas de datos de las tablas tienen unidades y el alivio C3 explícito; «No aplica por actividad» en gestión de activos y seguros es correcto y bien redactado; la hoja «Tabla NIIF» cuadra con el Word en los cuatro riesgos y dos oportunidades, incluido el largo plazo de huracanes; K609/K611 (Alcance 2) ya distinguen las 104 sucursales propias de las 14 arrendadas; K596 trae AR5; K695/K699 y K707/K709 responden precio interno y remuneración exactamente como la norma pide, con el cero por ciento explícito.
