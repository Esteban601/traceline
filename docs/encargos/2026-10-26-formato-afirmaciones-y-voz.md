# Encargo: afirmaciones y voz del Formato electrónico

Versión 1 · 26 de octubre de 2026. Sale de la revisión externa del Formato v4 y del Excel v4
(`docs/suplemento-s1s2/revision-externa-v4.md`, §1.1 y §3): celdas que afirman algo falso (booleanos y negaciones),
voz de plataforma en celdas armadas por código, celdas vacías con contenido disponible y celdas que no responden a su
pregunta. Va antes de `formato-respuesta-por-inciso` (antes `formato-repeticiones-por-inciso`).

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/formato-afirmaciones-y-voz` desde `dev/ajustes-sep26`, después del OK al Paso 0. Se integra por PR a
`dev/ajustes-sep26` y de ahí a `main` (CLAUDE.md §2).
**Fecha de inicio:** 26 de octubre de 2026 · **Entrega:** Formato v5 y Excel v5 del demo en `traceline-dev` para una
segunda lectura externa; staging, después de esa lectura.
**Referencia:** `CLAUDE.md` v1.11 §4, §5, §7, §8 y §9; especificación v0.44 §10; `revision-externa-v4.md`;
`mapeo-formato-electronico.json`; `lib/formato/llenar.ts`, `lib/formato/instancias.ts`, `lib/suplemento/respuestas.ts`.

## 0. Paso 0 (lectura, sin cambios)

**Qué se pide.** Clasificar cada hallazgo de §1.1 y §3 de la revisión en una de cuatro causas: **regla de código**
(R), **mapeo** (M), **generador/contenido** (G) o **errata de la plantilla BMV** (E). Además:
- confirmar o refutar con código la hipótesis del lector sobre los booleanos (K38, K592, K643);
- decir qué palabras de CLAUDE.md §5 faltan en el validador de vocabulario y por qué pasaron «capturas validadas»,
  «registros de clima» y «memoria de cálculo»;
- explicar qué recibe hoy el generador para las celdas B65(c) y qué tendría que recibir del bloque 10;
- contar la oración E5 y proponer la regla «una vez por sección»;
- estimar por causa.

Parada al terminar. Numeración: celdas K del Formato exportado. Las filas del mapeo > 185 son K − 279.

### 0.1 Booleanos: la hipótesis del lector, contra el código

El lector supone que el «No» sale de leer una negación del texto. **Se refuta en el mecanismo; el efecto es el que
el lector ve.**

**K38 y K592.** `lib/formato/llenar.ts:202-208`: un booleano con datapoint toma la respuesta `taxonomia` de su código
y escribe «No» si **alguno** de los hechos anclados a esa respuesta es de `tipo = 'declaracion_negativa'`
(`lib/formato/datos.ts:36-49`); si ninguno lo es, escribe «Sí». No lee el texto ni la pregunta de la fila.
- **K38** (fila 38, `NIIF S2 6 (a)(v)`). La respuesta cubre todo 6(a)(v): la aprobación de objetivos y la
  remuneración. El hecho que contesta la pregunta, «las métricas climáticas no forman parte de la remuneración
  variable en 2025» (`ed075faf`), es de tipo `politica`, no `declaracion_negativa`. Ningún hecho anclado es negativo,
  así que sale **«Sí»**.
- **K592** (fila 313, `NIIF S2 29 (a)(ii)`). El único hecho negativo anclado es «la Compañía no hace uso de la medida
  transitoria del párrafo C5» (`9f6eca92`). Es una negación de otra pregunta que, de hecho, implica el «Sí». Sale
  **«No»**.
- **Los demás booleanos con datapoint, al 100 %.** Hay 10. Sin K38 ni K592, quedan K44, K49, K134, K516, K532, K535,
  K696 y K704. Los ocho son correctos contra sus hechos, pero K516, K532, K696 y K704 aciertan porque su hecho negativo
  sí es el que contesta. La regla no lo garantiza.

**K643, K666 y K689** (filas 364, 387 y 410). **No son booleanos ni leen negaciones.**
- Son la enumeración «Sí, totalmente / Sí, parcialmente / No» y copian el campo del Perfil `metricas_industria`
  (`llenar.ts:232`).
- El Perfil del demo lo trae en «No» desde `scripts/poblar-demo.mjs:204`, con el comentario «hasta que exista el
  catálogo SASB».
- La contradicción con K722 y K725 (sector FN-CB y la respuesta de NIIF S2 32) es de **contenido**: un juicio de la
  emisora capturado en «No». Ninguna regla cruza ese campo con `sector_sasb` ni con la respuesta de S2 32.

### 0.2 Vocabulario de plataforma

El validador es `VOCABULARIO_PROHIBIDO` (`lib/suplemento/prompt.ts:68`).

**Palabras de CLAUDE.md §5 que no están en el validador:**
- **«bloques».** Está «bloque», pero la expresión exige palabra completa (`\bbloque\b`), así que el plural no cuenta.
- **«validación» y «validaciones».** Están «validado», «validada», «validados» y «validadas», pero no el sustantivo.
  Agregarlo exige criterio: K28 dice «la validación del informe anual», que es voz legítima de la emisora.
- **Los ids sin prefijo** (uuid o hexadecimal). Solo se detectan los prefijos `sol:`, `reg:`, etc.
- **«suplemento».** No es de §5, pero el e2e del Formato sí lo prohíbe.

**Por qué pasaron las tres frases.**
- **«Cifras de los registros de clima, capturas validadas.»** La escribe el código, no el modelo
  (`lib/formato/instancias.ts:104`, y `:98` para la métrica GEI, «de capturas validadas»). El validador solo corre
  sobre texto del modelo (`generar-bloque.ts`, `respuestas.ts`); ninguna comprobación pasa la lista por las celdas
  exportadas. El e2e del Formato (`scripts/e2e-formato-electronico.mjs:145`) usa su propia lista corta: suplemento,
  solicitud, evidencia, IRStrat.
  - Con la lista oficial, el Formato v4 tiene **13** celdas con «validadas»: las 12 del lector y K267.
  - El Excel de taxonomía tiene otras 14, en la hoja `NIIF S1 46-50`.
- **«registros de clima».** No está en la lista: «registro» es el nombre del módulo y nunca se agregó. Llega por la
  misma frase del código.
- **«memoria de cálculo»** (K606 y taxonomía E148). Sale del **hecho**, no del bloque.
  - `lib/suplemento/hechos/fuentes.ts:168` arma el enunciado de una cifra capturada con el título de la solicitud:
    «Inventario GEI Alcance 1 con memoria de cálculo: 1240 tCO2e».
  - El modelo de respuestas lo parafraseó, y «memoria de cálculo» no está en la lista.
  - La tabla del bloque 29 ya limpia ese título (`lib/suplemento/tablas.ts:194-207`, `conceptoGei`); el hecho no lo
    limpia.
- **Hallazgo adicional.** Con la lista oficial salen también **17** celdas de «No aplica por actividad: … (actividades
  financieras del Perfil: …)», K733 a K783, por «perfil:». El lector las da por buenas (§4). Queda como decisión.

### 0.3 B65(c): lo que recibe hoy y lo que tendría que recibir

**Qué recibe hoy.**
- Las filas 354, 356, 358, 360 y 361, y sus pares de riesgos físicos (377–384) y de oportunidades (400–407), están
  mapeadas al código **padre** `NIIF S2 29 (b)`, `(c)` y `(d)`.
- `llenar.ts:195-200` escribe en ellas la respuesta de ese código, que es el párrafo de exposición del bloque 34, 35
  o 36.
- **Con texto son 15 celdas, no 24.** Hay 5 por sección: K633, K635, K637, K639 y K640, y sus pares. Las filas pares
  intermedias están vacías.
- Las filas de B65(b) de las tres secciones (352, 375 y 398; K631, K654 y K677) también apuntan al padre.

**Qué existe y no se usa.**
- El catálogo ya tiene `NIIF S2 29 (b) · B65 (c)`, `29 (c) · B65 (c)` y `29 (d) · B65 (c)`, con respuestas aprobadas
  por tipo de riesgo.
- Por ejemplo, la de transición dice que no hubo efectos cuantificables en 2025 y describe los efectos previstos en
  activo y pasivo, con los hechos `48a4b926`, `a142a63c` y `b8e0b470`. Ninguna fila del mapeo apunta a esos códigos.

**Qué tendría que recibir del bloque 10**, para responder cada celda (situación, rendimiento, flujos, previstos y
ajuste material) por tipo:
- los hechos propios del tipo (bloques 34, 35 y 36);
- los hechos del bloque 10 que remiten a ese bloque (`bloques_referencia` contiene 34, 35 o 36). En el libro vigente,
  para riesgos físicos:
  - `d34cdf7e`: 12.3 MDP de gasto de capital, capitalizados en propiedades, mobiliario y equipo, y 6.2 MDP de
    primas;
  - `93902338`: el riesgo de ajuste material sobre la estimación preventiva;
- el hecho general sin efectos que reconocer, `ccf24ca6` (`declaracion_negativa`, bloque 10, sin referencias), en
  los tres tipos.

La ruta ya existe: `CONCEPTOS_FORMATO_CON_ENFOQUE`, la de las filas 97 y 99, que da una respuesta propia por celda
(`fila:N`) con su enfoque y sin repetir oraciones. Le falta poder sumar hechos de otro bloque filtrados por
referencia, como `HECHOS_DEL_PADRE` o los hechos prestados.

### 0.4 Oración del alivio E5

**Hoy está en 62 celdas, siempre al inicio.** Por encabezado de la plantilla:

| Encabezado | Celdas | Cuáles |
|---|---:|---|
| Gobernanza (K24) | 2 | K25, K26 |
| Procesos de gobernanza (K27) | 11 | K28 a K52 |
| Estrategia (K54) | 10 | K55 a K81 |
| Situación y rendimiento financiero (K83) | 13 | K84 a K100 |
| Resiliencia (K102) | 1 | K103 |
| Gestión del riesgo (K121) | 12 | K122 a K141 |
| Objetivos (K473) | 9 | K474 a K493 |
| Periodo y declaración (K553) | 4 | K564 a K571 |

K81 es la única celda cuyo contenido es solo la oración, porque es un «no aplica · E5».

**Regla propuesta: «una vez por sección»**, con sección igual a pilar. La oración va en la primera celda con E5 de
cada pilar. Las celdas «no aplica · E5» la conservan, porque es su único contenido. Las conservan **6 celdas**:
- K25 (Gobernanza);
- K55 (Estrategia);
- K122 (Gestión del riesgo);
- K474 (Métricas y objetivos);
- K564 (requerimientos generales: la declaración);
- K81 (no aplica · E5).

Las otras 56 la pierden.

**Alternativa: una vez por encabezado de la plantilla.** La conservan 9 celdas: K25, K28, K55, K84, K103, K122,
K474, K564 y K81.

**Riesgo de las dos.** Si quien consume el Formato lee cada celda por separado, las celdas sin la oración pierden el
contexto del alivio. Por eso se acordó ponerla en todas.

### 0.5 Clasificación de §1.1 y §3

| # | Hallazgo | Causa | Dónde |
|---|---|---|---|
| 1 | K38 «Sí» → «No» | R | Booleano por tipo de hecho anclado (0.1) |
| 2 | K592 «No» → «Sí» | R | Mismo mecanismo; la negación es de C5 |
| 3 | K643, K666 y K689 «No» | G (contenido) | Perfil del demo, `metricas_industria = 'No'`; sin regla de coherencia con `sector_sasb` y S2 32 |
| 4 | Leyenda K12 sin E4 | R | `lib/formato/plantilla.ts:33` y `export-taxonomia/route.ts:203` fijan `["C3","C4","E5"]`; el reporte tiene E4 |
| 5 | «Cifras de los registros de clima, capturas validadas.» y «(ejercicio 2025)» en 12 celdas (13 con K267) | R | `instancias.ts:87-104` |
| 6 | K787, K788 y hoja «Métricas SASB» | R | Texto fijo en `llenar.ts:125` y `plantilla.ts:32`. La fila 508/509 es la única de métricas por industria que tiene la plantilla, la del ejemplo CG-AA |
| 7 | K606 y taxonomía 148, «memoria de cálculo» | G | Enunciado del hecho de captura con el título de la solicitud (`fuentes.ts:168`), más el hueco del validador |
| 8 | K711 (29A) vacía | M | La fila 432 está como «encabezado»; la regla de C4 (`FILAS_29B`) solo cubre 433, 435 y 437 |
| 9 | K723 vacía | M | La fila 444 está como «subconcepto de 443», pero es su propia pregunta; falta decidir la fuente (D3) |
| 10 | K45, K697 y K705 («¿Por qué?») vacías; K699 y K707 llenas con un «No» | M + R | Las filas 45, 418 y 426 son «subconcepto» del booleano. La condición de la fila 420 («si 417 = No, no se despliega») no está implementada |
| 11 | K861 y K866 vacías | M | Las filas 582 y 587 están como «miembro de tabla»; son conceptos (B50 y B54), con la regla del primer año como K863 |
| 12 | K644, K667 y K690 (B65(e)) vacías | M + G | Las filas 365, 388 y 411 son «subconcepto» de la enumeración. El código `NIIF S2 B65 inciso (e)` existe, pero queda pendiente «sin solicitud ni sección»: no tiene bloque dueño |
| 13 | B65(c): 15 celdas con la exposición | M + G | Mapeo al padre (0.3); el reparto por celda es del generador |
| 14 | K117 y K119, fechas como oración | M | Mapeadas como texto de 22(b)(iii); son fechas. El hecho sitúa el análisis en el ejercicio 2025 |
| 15 | K105/K110/K111, K36/K39/K41 y K265 «a verificar» | Sin defecto | Hechos validados del libro vigente: `99547034` (seis sucursales hasta 2028), `a586c27a` (24 de abril de 2025) y `ab3e60dc` (Verificadora Demo). El lector tenía el Word del 11/10 |
| §3-1 | 29A, K711 | M | El mismo hallazgo que el 8 |
| §3-2 | 36(e), tres estados | R | El Formato tiene dos redacciones: `llenar.ts:237` (con dos puntos) y la respuesta `no_aplica` (con punto). El Excel de taxonomía escribe «Pendiente en plataforma» (`export-taxonomia/route.ts:606`) porque el cuestionario 36(e) no tiene respuestas, y no lee el `no_aplica` |
| §3-3 | B65(e): el Formato vacío contra el marcador de la taxonomía | M + G | El mismo hallazgo que el 12. El vacío del Formato es de la clasificación «subconcepto», no del marcador |
| §3-4 | S2 34(c) y 34(d) con el texto de 34(b) | M | Las filas 241 y 243 apuntan a `NIIF S2 34`; el catálogo no tiene incisos de 34. Es la misma clase que K85–K90 (repeticiones por inciso) |

**Errata de la plantilla BMV:** ninguna en §1.1 ni en §3. Las de la revisión están en §2 (K729, K747, K751, K762,
K771 y K782) y en K627 («NIF S2»). Fuera de este encargo, salvo una nota en la hoja de revisión si se decide.

### 0.6 Estimación por causa

| Causa | Qué | Horas | Modelo |
|---|---|---:|---|
| R | Booleanos con respuesta explícita «Sí.»/«No.» validada contra el hecho que contesta, para los 10 | 5–6 | Regenerar respuestas (~0.55 USD) |
| R | Leyenda con E4 (y C5), en dos sitios | 0.5 | — |
| R | Método de las métricas iteradas sin «registros de clima» ni «capturas validadas» | 1–2 | — |
| R | Filas SASB y hoja «Métricas SASB» (texto según D8) | 0.5–1 | — |
| R | «¿Por qué?» y «¿Cómo?» según el valor del booleano (con M) | 2–3 | — |
| R | 36(e) en un solo estado en el Formato y en el Excel | 2 | — |
| R | Validador ampliado y aplicado a toda celda exportada (e2e y `verify:export`) | 2–3 | — |
| M | Correcciones de las filas 432, 444, 45/418/426, 582/587, 117/119, 352–361 y pares, 365/388/411 | 3–4 | — |
| G | B65(c) por celda y por tipo, con los hechos del bloque 10 que remiten (15 respuestas `fila:N`) | 4–6 | En las respuestas (~0.3 USD) |
| G | B65(e) con dueño el bloque 10 | 3–4 | Bloque 10 (~0.6 USD) y respuestas |
| G | Enunciado de cifras capturadas sin el título de la solicitud (libros nuevos). Para el v4 basta el validador | 1–2 | — |
| G | Perfil del demo, `metricas_industria` (D2) | 0.5 | — |
| E | Ninguna en alcance | 0 | — |

**Total: 25–34 h, unas 3 a 4 jornadas.** Modelo: unos 1.5 USD (una regeneración del bloque 10 y una de respuestas),
sin corrida completa del demo. Sin migraciones previstas: si aparece una, parada.

### 0.7 Decisiones que necesito antes de la Fase 1

- **D1.** Cómo se decide un booleano. Recomiendo que la respuesta del código abra con «Sí.» o «No.», validada contra
  el hecho que contesta, y que `llenar.ts` lea esa palabra. La alternativa es una regla por clave de hecho para cada
  fila, que es frágil porque las claves cambian entre libros.
- **D2.** `metricas_industria` del demo. ¿Pasa a «Sí, parcialmente», como propone el lector? Es un juicio de la
  emisora. ¿Y se agrega un aviso en la hoja de revisión cuando choca con `sector_sasb` y la respuesta de S2 32?
- **D3.** De dónde sale K723 («¿considerará…?»). Recomiendo «Sí» cuando `metricas_industria` está capturado y
  `sector_sasb` no está vacío, y vacío si no.
- **D4.** La regla E5: por pilar (6 celdas), por encabezado (9 celdas) o como está (62 celdas).
- **D5.** K117 y K119: las fechas del ejercicio solo cuando un hecho sitúa el análisis dentro de él (el demo lo
  tiene). Si no, vacías.
- **D6.** Las 17 celdas «(actividades financieras del Perfil: …)»: se quedan, como dice el lector, o se reescriben
  sin «Perfil».
- **D7.** Frontera con `formato-repeticiones-por-inciso`: K39/K41 (6(a)(v) repetido) y 34(c)/(d) pasan a ese encargo.
  Aquí solo entra el reparto «¿Por qué?»/«¿Cómo?» de los booleanos.
- **D8.** Filas SASB del ejemplo CG-AA: vacías o «No aplica: la Compañía no participa en este sector».

## 1. Objetivo

Que ninguna celda del Formato electrónico ni del Excel de taxonomía afirme algo que sus hechos contradicen, que
ninguna hable con voz de plataforma, y que las celdas con contenido disponible lo tengan, para cualquier emisora.

## 2. Alcance

Lo de 0.5 y 0.6, según las decisiones de 0.7, en dos fases:
- **Fase 1:** R y M, sin costo de modelo, salvo regenerar respuestas por D1.
- **Fase 2:** G.

Queda fuera:
- las repeticiones por inciso (K85–K90, S2 33/34 y, según D7, K39/K41), que van al encargo siguiente;
- 29A–29C en el catálogo;
- los marcadores de §5 (S2 30 y B65(e) como marcador del bloque);
- las erratas de la plantilla.

## 3. Qué toca y qué no

- **Toca:**
  - `lib/formato/llenar.ts`, `instancias.ts`, `plantilla.ts` y `datos.ts`;
  - `app/admin/cobertura/export-taxonomia/route.ts`;
  - `lib/suplemento/respuestas.ts`, `prompt.ts`, `hechos/fuentes.ts` y `bloques.ts` (B65(e));
  - `scripts/formato/correcciones-mapeo.mjs` y el JSON del mapeo;
  - `scripts/poblar-demo.mjs` (D2);
  - los e2e del Formato y de respuestas.
- **No toca:**
  - el catálogo (sin migraciones previstas);
  - los demás bloques del documento;
  - staging.
- **Ambientes:** stack local para los e2e; `traceline-dev` para el demo. Nada contra staging.

## 4. Definición de terminado

- Los 10 booleanos con datapoint del demo coinciden con el hecho que contesta. K38 «No» y K592 «Sí».
- Ninguna celda exportada (Formato y respuestas del Excel) contiene una palabra de `VOCABULARIO_PROHIBIDO` ampliado.
  Lo comprueba el e2e del Formato y `verify:export` con la lista oficial, no con una propia.
- Las 15 celdas B65(c) responden efectos por tipo, sin compartir oraciones con la exposición (K627, K650 y K673).
- K711, K723, K45, K697, K705, K861, K866, K644, K667 y K690 llenas según 0.7, o vacías por pendiente explícito.
- 36(e) en un solo estado en los dos entregables.
- La oración E5 según D4.
- `tsc`, `eslint`, `verify:export` y los cuatro e2e en verde.
- **Punto del cierre, antes del PR** (Esteban, 28/10/2026): las herramientas reutilizables que hoy viven fuera del repo
  (respaldo en `~/Downloads/scratchpad-respaldo/`) pasan a `scripts/`: la descarga del Formato y del Excel
  (`fase1/bajar.mjs`) y del Word aprobado (`fase5/bajar-word.mjs`), la corrida en seco de respuestas (`v5/seco.mjs`),
  la regeneración de una sola respuesta (`v5/solo-k662.mjs`, generalizada a cualquier código) y los lectores de celdas
  (`v5/buscar.cjs`, `fase2/celdas.mjs`), con la barrera del ref de dev y sin contraseñas escritas en el código.

## 5. Entregables intermedios

- **Paso 0:** este documento, §0. **Parada:** decisiones D1–D8.
- **Fase 1 (R + M):** PR con las pruebas, y el Formato y el Excel regenerados desde el v4 aprobado (sin regenerar
  bloques; las respuestas, solo si D1 lo pide). **Parada:** Esteban revisa las celdas de 0.5.
- **Fase 2 (G):** bloque 10 y respuestas regenerados en `traceline-dev`. Si cambia el texto aprobado, aprobar el v4
  de nuevo (o el v5). Formato v5, Excel v5 y auditoría del mapeo. **Parada:** informe y entrega al lector externo.
- **Staging:** fuera de este encargo hasta la segunda lectura. Lo ejecuta Esteban, según §10.

## 6. Riesgos y dudas conocidas

- **Validador más estricto.** Puede rechazar redacciones legítimas, como «la validación del informe» en K28. Se
  prueba sobre las 194 respuestas del v4 antes de activarlo; se usan excepciones por expresión, no se quitan palabras.
- **Booleanos con respuesta explícita.** Cambian el texto de 10 respuestas de la taxonomía (abren con «Sí.»/«No.»),
  como ya hace 25(a)(vi). Se acepta.
- **Regla E5 por sección.** Si el consumidor del Formato lee celda por celda, se pierde el contexto (0.4).

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 26/10/2026 | Encargo escrito; `revision-externa-v4.md` en dev (`67ce22c`). Paso 0 hecho, sin cambios de código | Parada para D1–D8 |
| 26/10/2026 | Decisiones de Esteban D1–D8 | **D1:** un booleano abre con «Sí.»/«No.» y cita el hecho que lo contesta; el validador lo rechaza si el hecho no existe o si la celda narrativa vecina lo contradice. **D2:** `metricas_industria` del demo, «Sí, parcialmente» en `poblar-demo.mjs`, con aviso cuando el Perfil dice «No» y hay sector SASB. **D3:** K723 sale de `metricas_industria`: «Sí» si es «Sí» o «Sí, parcialmente»; vacía si es «No». **D4:** la oración E5 una vez por encabezado de la plantilla (9 celdas). **D5:** K117/K119 con fechas solo si un hecho sitúa el análisis en el ejercicio; si no, pendiente. **D6:** las 17 celdas, «actividades financieras declaradas por la emisora: …». **D7:** K39/K41 se quedan aquí; 34(c)/(d) pasan a `formato-repeticiones-por-inciso`, anotados como contenido falso. **D8:** filas CG-AA vacías; FN-CB bajo [815200] cuando exista ese catálogo. **Validador:** el glosario de CLAUDE.md §5 es la única fuente; se quita la lista de `scripts/e2e-formato-electronico.mjs:145` y cualquier otra copia; cubre también lo que escribe el código y los títulos de solicitud usados como enunciado de hecho. **Fases con parada:** 1 (booleanos, validador, leyenda E4, E5 por encabezado, `instancias.ts`, 36(e) en un solo estado), 2 (mapeo), 3 (generador y contenido), 4 (rama a `traceline-dev` antes de cualquier PR, demo v5, Formato y Excel v5, auditorías, lectura externa; los PR después de la lectura) |
| 26/10/2026 | Pausa (`3741af0`, Fase 1 parcial) y vuelta | Se pausó por `carga-lectura-primero`; se retoma con `dev/ajustes-sep26` mezclado en la rama (`ea057ca`) para no perder la carga al desplegar |
| 26/10/2026 | **Fase 1** | **Booleanos (D1):** `lib/formato/booleanos.ts` (preguntas de los 10, `validarBooleano`); en `respuestas.ts`, una respuesta propia `fila:N` por booleano, con solo los hechos del código que tratan el tema de la pregunta, validada al generarla; `llenar.ts` lee el «Sí.»/«No.» y deja la celda vacía si la respuesta narrativa vecina lo contradice. `datos.ts` ya no consulta los hechos negativos. **Glosario único:** CLAUDE.md v1.12 §5 lo escribe completo; `lib/suplemento/vocabulario.ts` es su única copia en código y un e2e compara las dos. Excepciones por expresión, no por palabra: «validado por …» (validación de un tercero, NIIF S2 34) y «bloque de texto» (tipo de dato de la plantilla). Para celdas exportadas, `vocabularioEnCeldaExportada` acepta el marcador «Pendiente: …» en texto plano (excepción de §5). El e2e del Formato usa el glosario, sin lista propia. **Leyenda:** «Alivios de este reporte» desde el catálogo de alivios (`aliviosVigentes`), en el Formato y en el Excel: «E4, E5, C3, C4». **E5 (D4):** una vez por encabezado (`ENCABEZADOS_E5`). **`instancias.ts`:** el método de las métricas iteradas sin «registros de clima», «capturas validadas» ni «(ejercicio …)». **36(e):** un solo texto, el de `textoNoAplicaHeredado`, en el Formato (263/265), en la columna de respuestas y en las preguntas sin captura de la hoja del cuestionario. Las preguntas sin respuesta de los cuestionarios dicen «Pendiente: respuesta de la emisora a esta pregunta — cuestionario …», no «Pendiente en plataforma». **D6** entra aquí, porque el glosario aplicado a las celdas exportadas lo exige. **D2:** `poblar-demo.mjs` y, en dev, un `update` del campo del Perfil de Empresa Demo (sin correr `poblar-demo` completo); aviso de coherencia en la hoja «Avisos» de la revisión. **Respuestas regeneradas en dev** (documento `3487cb77`, v4) con el código de la rama: tres corridas, 0.0739 + 0.0302 + 0.0477 USD. En las dos primeras, 134 y 313 quedaron en respaldo porque el modelo no devolvió su respuesta; con la clave `fila:N` explícita en la descripción salieron las 10. **Antes y después** (antes: `traceline-dev` v26 con `main`; después: la rama en local contra dev; `scripts/formato/medir-formato.mjs`): K38 «Sí» → «No»; K592 «No» → «Sí»; K643 «No» → «Sí, parcialmente»; Leyenda K12 «C3, C4, E5» → «E4, E5, C3, C4»; los otros 8 booleanos sin cambio. Oración E5: 62 → 9 celdas (K25, K28, K55, K81, K84, K103, K122, K474 y K564). Vocabulario del glosario en el Formato (columna K): 31 → 1 (K606, «memoria de cálculo», que es de la Fase 3). En el Excel de taxonomía, sin la hoja «Leyenda»: 19 → 1 (E148, la misma causa). **Verificación:** `e2e-respuestas-validadores`, `e2e-formato-electronico`, `e2e-metricas-instancias`, `e2e-excel-respuestas`, `e2e-excel-alivios` y `e2e-respuestas-regeneracion` en verde; `verify:export` en verde contra dev con la rama; `tsc` limpio; `eslint` sin errores. **Parada:** entrega de la Fase 1 |
| 26/10/2026 | Excel de taxonomía: solo preguntas y respuestas (regla de Esteban) y booleanos contradichos en el informe | Se eliminan la hoja «Leyenda», las filas de título, los pies, las columnas «Sección», «UN SDG», «Notas / Brechas» y «Tipo de dato», las filas separadoras y vacías y las 21 imágenes de la plantilla (`lib/excel/depurar.ts`). Los faltantes van como marcador de §5 en la celda de la respuesta. Los alivios quedan dentro de respuestas: E5 en los encabezados de pilar de NIIF S1, E4 en la declaración de cumplimiento (NIIF S1 72), C3 y C4 en su cifra. La marca [DEMO] pasa a las propiedades del archivo. Dejan de exportarse la nota de perímetro (alcance de una solicitud), la salvedad «validación interna del cliente», las notas libres de cuestionarios y objetivos, y los íconos UN SDG. El glosario ya no excluye ninguna hoja: queda 1 celda (respuesta de NIIF S2 29 (a)(i), «memoria de cálculo», de la Fase 3). Un booleano que queda vacío por contradicción se lista con celda, fila, valor propuesto y la oración que lo contradijo (hoja «Avisos» de la revisión y log de la descarga). `aea7db4` |
| 26/10/2026 | **Fase 2** (mapeo) | 32 filas corregidas en `correcciones-mapeo.mjs` (encargo propio en cada corrección). K711 (432, 29A) con la regla de 29B. K723 (444) desde `metricas_industria` (D3). Los «¿Por qué?» K45/K697/K705 (45, 418 y 426) explican el «No» con la respuesta propia del booleano. Los «Si ¿Cómo…?» K699/K707 solo se despliegan con «Sí», y K700 (421) pasa a subconcepto. K861/K866 (582, 587) con la regla del primer año. K117/K119 con fechas del ejercicio (D5). B65(c): las 15 celdas a los códigos `NIIF S2 29 (b|c|d) · B65 (c)`. B65(e): 365, 388 y 411 como conceptos de `NIIF S2 B65 inciso (e)`, con dueño el bloque 10 en `bloques.ts`; quedan vacías hasta regenerar el bloque 10 (Fase 3). K747 (468) y K767 (488) son selectores de actividad. `validarMapeo()`: 0 faltantes. **Auditoría:** distintas 15 → 14 (sale la 468). **Formato:** cambian 27 celdas, todas previstas. **Verificación:** `verify:export` contra dev y seis e2e locales en verde |
| 26/10/2026 | Decisiones de Esteban sobre lo que ya no sale del Excel | **(1)** El perímetro de una cifra va dentro de su respuesta, «<cifra>; perímetro: <perímetro>»: en la celda del Excel, en la respuesta de captura de la taxonomía y en el enunciado del hecho (`lib/reporte/cifra.ts`). Comprobado con GCARSO en local (`import-gcarso` + histórico). **(2)** Las notas libres se quedan en la plataforma. **(3)** NIIF S1 46-50 lleva la columna B «Tipo» (Riesgo / Oportunidad). `e983b55` |
| 26/10/2026 | **Fase 3** (generador y contenido), sobre el v4 de dev | **B65(c) por celda:** las 15 celdas tienen su respuesta propia por efecto (`CONCEPTOS_B65C`), con los hechos del código más los del bloque 10 que remiten al bloque del tipo y las negativas generales. El validador exige nombrar el efecto y no repetir una oración genérica de otra celda del inciso (se retira si lo demás responde). Hay tres intentos; sin respuesta validada, la celda queda vacía, sin respaldo. **B65(e):** como el v4 está aprobado y no se regenera, sale por «alta posterior», con los hechos del bloque dueño elegidos por contenido (`HECHOS_POR_ENUNCIADO`): K644, K667 y K690 llenas. **«Memoria de cálculo»:** el enunciado de la cifra usa el concepto publicable (`conceptoDeCifra`). En dev se corrigieron los 3 hechos de captura del libro del v4 (`a1561e27`) al enunciado que produce el código, y la firma de las respuestas incluye ahora el texto de los hechos. **S1 72:** la declaración del bloque 2, más el alcance del E5 y el E4. **Costo:** 1.0378 USD en seis regeneraciones de respuestas; ningún bloque regenerado. **Auditoría:** 14 filas distintas, sin cambio; vocabulario 0 en el Formato y 0 en el Excel. **Verificación:** `verify:export` contra dev y ocho e2e locales en verde. **Parada:** entrega de la Fase 3 |
| 26/10/2026 | Ajustes a la Fase 3 y pregunta de la firma | La firma de las respuestas ya es por respuesta: el requisito y los hechos que recibe (ids y texto). Todas se regeneraron una vez porque cambió el formato de la firma; con los 3 hechos de captura corregidos, solo 4 respuestas los citan. Ajustes en código, para el v5: los planes de disposición de activos van en la celda de efectos previstos de B65(c) y no en la del ajuste material; en NIIF S1 72, «Asimismo, se acoge a la exención del párrafo E4…». K644/K667/K690 con el mismo texto queda como deuda conocida |
| 26/10–27/10/2026 | **Fase 4**, parada antes de aprobar | `traceline-dev` **v27** (`dd6c213`, rama local `despliegue/formato-afirmaciones-y-voz`, sin diferencia con la rama del encargo). **Demo v5** (`98436f25`) con `generar-demo.mjs todos` en una corrida: 38 bloques en borrador, 2 «no aplica», 0 fallos, 28 páginas, **15.9 min, 11.0131 USD en bloques + 1.2968 de coherencia + 0.0084 de cierre (12.3183 USD)**. Mismo libro que el v4 (`a1561e27`). No se aprueba: pendientes en los bloques 6, 10 y 25. Regenerados una vez (1.8014 USD): el 6 y el 25 quedan sin pendientes. El 10 conserva dos: NIIF S2 21(a) (el criterio de los párrafos 19 y 20) y B65(e) (la congruencia de datos y supuestos con los estados financieros; aparece porque B65(e) tiene ahora dueño el bloque 10 y ningún hecho la afirma). **Parada:** decisión de Esteban |
| 26/10/2026 | **Fase 4**, terminada; parada para la lectura externa | **Decisión de Esteban** sobre los dos pendientes del bloque 10: dos declaraciones de Empresa Demo, en voz de la emisora e ilustrativas, en `poblar-demo.mjs` y en dev (`45b1f83`): congruencia de datos y supuestos con los estados financieros (B65(e)) y criterio de cuantificación de los efectos financieros (NIIF S2 19–20, 21(a)). **Libro reconstruido** (`9ce685d6`, 312 hechos, 1.1104 USD): chocó con el tope de 10 generaciones del mes (429); con el OK de Esteban se subió a 20 y se restauró a 10. **Bloque 10 regenerado** (1.156 USD), sin pendientes. **Aprobado** el 27/10 00:35:51 UTC desde la interfaz como `admin@irstrat.example`. **Respuestas:** 221 filas, 0.6565 USD, 0 por respaldo; un pendiente de taxonomía (NIIF S2 30, sin fila exportada). **Cobertura del bloque 10 aprobado (versión 3):** NIIF S2 21(a) cubierto con 2 hechos y B65(e) con 1, los tres del bloque 10, sin la vía de alta posterior. **Formato v5 y Excel v5** descargados de `traceline-dev`: vocabulario 0 en los dos; E5 en 9 celdas; K38 «No», K592 «Sí», K643 «Sí, parcialmente», K723 «Sí», K747 «Banca comercial», K606 sin «memoria de cálculo»; S1 72 con «En este primer periodo» una vez y «Asimismo, se acoge a la exención del párrafo E4…»; K663 solo con el riesgo de ajuste material. **Auditoría de mapeo:** 14 distintas, las mismas que tras la Fase 2. **Hallazgo:** la reubicación de seis sucursales no llegó a K662 (ajuste 1 de la Fase 3): en el libro reconstruido el hecho quedó como declaración negativa con referencias a los bloques 26 y 22, no al 35, y el filtro de B65(c) no lo toma. Se corrige antes de los PR. **Costo total del v5:** 12.3183 (corrida) + 1.8014 (bloques 6, 10 y 25) + 1.1104 (libro) + 1.156 (bloque 10) + 0.6565 (respuestas) = **17.0426 USD**. Entrega en `~/Downloads/formato-v5/` con la lista de deudas conocidas | Parada para la lectura externa; los PR van después |
| 26/10/2026 | Regla de disposición de activos, 22(b)(ii) 5 y 6, y nueva entrega | **Regla de Esteban:** un plan de disposición de activos (16(c)) va a la celda de efectos previstos del tipo de riesgo que el hecho nombra como motivo («zonas de inundación» → físico), nunca por el bloque al que remite; sin riesgo nombrado (o con los dos) no entra en B65(c) y se lista en la hoja «Avisos» de la revisión (`PLAN_DISPOSICION_RE`, `tipoDeDisposicion`, `disposicionesSinTipo`); el validador exige que la celda de efectos previstos lo diga. **K662 regenerada sola** (0.0246 USD; la corrida llamó al modelo también para B65(e) y 21(a), que nunca se reutilizan, y se descartaron): guardada con un `update` de esa fila, porque `guardarRespuestas` borra las que no recibe. K662 lleva la reubicación de seis sucursales; K663 solo el riesgo de ajuste material. **22(b)(ii) 5 y 6** contestadas en `poblar-demo.mjs` y en dev con el supuesto de 40% de generación limpia: no exigen reconstruir el libro (el Excel y K115 las leen del cuestionario); el libro del v5 no las incluye. **Formato v5 y Excel v5** descargados de nuevo: vocabulario 0 y 0, E5 en 9 celdas, 0 marcadores en el Excel; auditoría de mapeo 14 distintas; avisos de la revisión 0 (ningún plan sin tipo). `verify:export` ajustado (22(b)(ii) completo; el marcador del cuestionario se comprueba en el segundo tenant) y en verde contra dev | Parada para la lectura externa |
| 27/10/2026 | **Fase 5** (revisión externa v5, `ae366ef`), con las decisiones 1–6 de Esteban; parada para la lectura externa | **(1) Alivios:** `lib/suplemento/alivios.ts`, única fuente con tres formas (encabezado, requisito, cifra) y la redacción del Formato; se borran `TITULO_ALIVIO`, la copia de `ensamblar.ts` y los literales de `llenar.ts` y `depurar.ts:174`. C4 en un requisito dice «No revelado · alivio C4» (Excel 144, 146, 147, 150). Pares S1→S2 completos: 30(a)y(b)→S2 10(a)–(c), 40(a)→S2 21(a) y, sin preguntar, 46 a 50→S2 29 (la fila 55 contradecía su hoja llena); 33(c) sin par lleva la oración del E5, como K81. El comparativo lo deja fuera C3 antes que C4 (hoja 29(a)(vi)(1), columna 2024). **(2) Glosario:** CLAUDE.md 1.13 suma «Fase <letra o número>», sprint, encargo, pendiente de catálogo, catálogo SASB, ampliación del catálogo, por decidir y sin mapeo («fase IV» de NGFS no cuenta); `medir-formato.mjs` revisa todas las hojas de los dos libros. **(3) 36(a)–(d):** solo objetivos de GEI (alcances o bruto/neto capturados y métrica en tCO2e) y «Sí»/«No». **(4)** Sin hoja «Leyenda»; los alivios en K12. **(5)** Plantilla limpia sin la nota de «Métricas SASB» A2 (`preparar-plantilla.mjs`), sha256 `217912465e5c0d2141604250f3946f147c6cc0953a4b10df3a8cbeecec9bad46`, 6,423,970 bytes, para `documentos/plantillas/formato-electronico/2025/plantilla.xlsx`; difiere de la vigente solo en `xl/worksheets/sheet4.xml`. El registro de la plantilla se actualiza cuando Esteban confirme la subida. **(6)** Separador de miles en las cifras de los hechos dentro de las respuestas (`conSeparadoresDeMiles`); en el hecho, con el siguiente libro. **Además:** sección «Para: Fideicomisos» (filas 13–21, por su columna A) entera «No aplica» si la emisora no es fideicomiso, con `fideicomitente` y `administrador_patrimonio` nuevos en el Perfil (migración `20261027120000`, aplicada en dev y en el stack local; tipos regenerados); `erroresDeForma`: sin «Sí.»/«No.» inicial fuera de un booleano y cada celda de B65(c) nombra su tipo (también decide si una respuesta guardada se reutiliza); «¿Por qué?»/«Si sí, ¿cómo?» en K135/K137; mapeo de 336 (K615, C4) y de 352/375/398 a B65(b); 36(e) por inciso desde el cuestionario (fila 276) sin cambiar el «No aplica» del padre; K787/K788 vacías. **Regeneración solo de respuestas:** 9 con el modelo (25(a)(ii) y 25(a)(vi) en los dos destinos, K640, K658, y B65(e) y 21(a), que nunca se reutilizan), **0.0643 USD**; las de regla, sin costo. **v5.1** exportado con el código de la rama (servidor local contra dev): vocabulario 0 en K y en el Excel, 1 celda en el resto del Formato («Métricas SASB» A2, hasta que se suba la plantilla); E5 en 9 celdas; auditoría de mapeo 257 filas con datapoint, las mismas 14 distintas. **Pruebas:** `e2e-celdas-categoricas` (nuevo, §3 y §2 de la revisión) 1 falla, la de A2; `e2e-respuestas-validadores` 79; `e2e-formato-electronico`, `e2e-excel-alivios`, `e2e-excel-respuestas` en verde contra el stack local; `verify:export` 81 en verde contra dev. Entrega en `~/Downloads/formato-v5-1/` con el Word v5 aprobado. **Al encargo siguiente, renombrado `formato-respuesta-por-inciso`:** filas 31, 32 y 37 (NIIF S1 35(a), 35(d)) y 98, 99 y 104 (NIIF S2 16(a), 16(d)) del Excel, sin respuesta | Parada para la lectura externa; los PR van después |
| 28/10/2026 | **Plantilla limpia, v5.1 y `traceline-dev` v28** | **Plantilla:** Esteban la subió a Storage de dev; descargada de vuelta, 6,423,970 bytes, sha256 `217912465e5c0d21…bad46` (el esperado). `subir-plantilla.mjs` lleva el registro por ambiente (`342f5ab`): dev con la nueva; staging con la de v41 (`eb09aa55…`), a reemplazar el día del despliegue v42 (anotado en la especificación §10, 0.46, con la cuarta migración, `20261027120000_perfil_fideicomitente_administrador`). **v5.1 reexportado** con la rama contra dev y reemplazado en `~/Downloads/formato-v5-1/`: `e2e-celdas-categoricas` sin fallas; vocabulario 0 en la columna K, 0 en el resto del Formato y 0 en el Excel; E5 en 9 celdas. **`traceline-dev` v28** (`cf2bd2d`, merge de la rama sobre `dd6c213`, sin diferencia con la rama): `/login` 200; inicio de sesión y descarga del Formato y del Excel del v5 aprobado, 200 los dos; iguales celda por celda a los de la entrega (3,803 y 1,219 celdas, 0 distintas); `verify:export` 81 en verde contra v28. Se agrega a la definición de terminado el paso de las herramientas reutilizables a `scripts/` antes del PR | Parada para la lectura externa; los PR van después |

## 8. Encargo siguiente, fuera de este: declaraciones del Perfil en el alta

Decisión de Esteban (26/10/2026): el cuestionario del Perfil debe preguntar, en el alta de cualquier emisora, las dos
declaraciones que en el demo se cargaron a mano: la congruencia de los datos y supuestos con los estados financieros
(NIIF S2 B65(e)) y el criterio de cuantificación de los efectos financieros previstos (NIIF S2 19–20, 21(a)). Sin
ellas, el bloque 10 de una emisora real queda con esos dos requisitos pendientes.
