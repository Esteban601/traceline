# Encargo: afirmaciones y voz del Formato electrónico

Versión 1 · 26 de octubre de 2026. Sale de la revisión externa del Formato v4 y del Excel v4
(`docs/suplemento-s1s2/revision-externa-v4.md`, §1.1 y §3): celdas que afirman algo falso (booleanos y negaciones),
voz de plataforma en celdas armadas por código, celdas vacías con contenido disponible y celdas que no responden a su
pregunta. Va antes de `formato-repeticiones-por-inciso`.

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
