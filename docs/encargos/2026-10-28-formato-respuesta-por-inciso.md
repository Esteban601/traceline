# Encargo: respuesta por inciso del Formato electrónico y del Excel de taxonomía

Versión 1 · 28 de octubre de 2026. Sale de las deudas conocidas de las entregas v5 y v5.1 (§1, «Repeticiones por
inciso») y de las revisiones externas v4, v5 y v5.1.

**El problema:** filas de la plantilla que piden un inciso y reciben la respuesta del párrafo completo, o no reciben
ninguna. Hoy es el único encargo de calidad en curso.

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/formato-respuesta-por-inciso` desde `dev/ajustes-sep26`. Se integra por PR a `dev/ajustes-sep26` y de ahí
a `main` (CLAUDE.md §2).
**Fecha de inicio:** 28 de octubre de 2026 · **Entrega:** Formato y Excel del demo con respuesta propia por inciso, por
fases con parada.
**Referencia:**
- `CLAUDE.md` v1.13 §4, §5, §7 y §8; especificación v0.47.
- Inventario fila por fila: `docs/encargos/2026-10-28-formato-respuesta-por-inciso-inventario.md`.
- Mapeo: `docs/suplemento-s1s2/mapeo-formato-electronico.json`.
- Código: `lib/formato/llenar.ts` y `lib/suplemento/respuestas.ts`.

---

## 0. Paso 0 (lectura, sin cambios)

**Fuentes:**
- las 370 filas del mapeo del Formato, cruzadas con la columna K del Formato v5.1;
- las 278 filas de la hoja «Taxonomía NIIF S1 S2» del Excel v5.1;
- las 221 respuestas guardadas del demo v5 aprobado (`98436f25`);
- el catálogo de dev (117 códigos NIIF);
- los objetivos del demo (`objetivos` y `objetivos_detalle`).

**Método:**
- agrupé las filas que comparten datapoint con preguntas distintas (54 grupos, 224 filas);
- quité las que ya tienen respuesta propia (`fila:N`), las de regla correcta (alivio C4, «No aplica por actividad»,
  ramas cerradas por su booleano) y las 42 filas de opciones o de ejemplo;
- revisé a mano el resto.

### 0.1 Resultado

| Dónde | Filas con un inciso repetido o sin responder | (a) hechos que ya están | (b) hecho nuevo del libro | (c) pregunta o campo nuevo | (d) regla |
|---|---:|---:|---:|---:|---:|
| Formato, columna K | 50 | 25 | 1 | 2 | 22 |
| Excel, filas de continuación | 132 | 14 | 2 | 2 | 114 |

- **Excel:** 70 de las 132 filas son la lista de sectores de NIIF S2 32. Otras 40 se llenan con lo que ya escribe el
  Formato (ramas de booleanos, B65(c) por tipo) o con la remisión del E5.
- **(b):** la razón de la elección del enfoque de medición GEI (K599, f132, f136).
- **(c):**
  - los cambios en el enfoque de medición (K601, f133, f137) piden una pregunta del cuestionario GEI;
  - el propósito del objetivo (S2 33(b), K502) pide un campo del objetivo.
- **(d) por qué no aplica:** E5 (las filas de NIIF S1 remiten a su par de NIIF S2), ramas que el booleano cierra, filas
  de ejemplo y de etiqueta, alivio C4, actividad y sector desde el Perfil.

### 0.2 Contenido falso hoy (⚠)

| Celda | Qué dice | Por qué es falso |
|---|---|---|
| K41 | 6(a)(v) «¿De qué manera se hace?» con el texto del párrafo | K38 responde «No»: la rama «Sí» afirma una forma de hacerlo que la propia celda niega. Debe ir vacía. |
| K50 | 6(b)(ii) «¿Por qué?» con el texto de K52 | K49 responde «Sí»: la rama «No» explica algo que no ocurre. Debe ir vacía. |
| K629, K652, K675 (Excel f153, f162, f171) | 29(e) despliegue de capital: los mismos 31.4 millones en transición, físicos y oportunidades | Triplica la cifra. K652 atribuye a riesgos físicos la eficiencia energética de la red, cuando el gasto ligado a riesgos físicos son los 12.3 millones de adecuaciones del sureste (K85). |

### 0.3 34(c) y 34(d): ya no son contenido falso

En v4 llevaban el texto de 34(b) y no respondían lo que se les pregunta. En v5.1 el texto del párrafo 34 creció y ya
incluye:
- las métricas de supervisión: «tCO2e por sucursal y por colaborador, saldo y porcentaje de cartera sostenible…»;
- la ausencia de revisiones: «En 2025 no hubo revisiones, por ser el primer año».

Hoy son **repetición que contiene la respuesta**, no contenido falso. Quedan en la fase de objetivos, no en la primera.

### 0.4 36(e) hoy

| Elemento | Formato | Excel | Qué dice |
|---|---|---|---|
| Padre de 36(e) | K534 | f272 | «No aplica. La Compañía no prevé usar créditos de carbono…», por regla |
| Booleano | K535 | — | «No» |
| Rama «¿Por qué?» | K536 | f274 (vacía) | Repite el texto del padre, con «No aplica.» delante en lugar de la razón |
| (i) | K538 | f276 | Respuesta propia del cuestionario: «No se basa en créditos de carbono…» |
| (ii) | K540 | f277 | «No aplica:», con dos puntos, a diferencia de las demás |
| (iii) | K542, K544 | f278 | «No aplica.» |
| (iv) | K546 | f279 | «No aplica.» |
| Ramas del booleano | — | f273, f275 | Vacías |

No hay una contradicción de fondo: todo dice que no hay créditos. Pero el padre dice «No aplica» mientras (i) responde,
hay dos redacciones y la rama «¿Por qué?» no da la razón.

### 0.5 Códigos nuevos, respuestas nuevas y costo

**Códigos nuevos: ninguno es necesario.** El generador ya responde por fila con la clave `fila:N` (booleanos, B65(c) por
tipo, 22(b)). La continuación del Excel puede tomar la misma respuesta sin código propio.

Solo hace falta dar de alta códigos si se quiere que Cobertura cuente los incisos por separado. Serían 12:
NIIF S2 33 (a)–(h) y 34 (a)–(d). Los de NIIF S1 51 (a)–(g) no hacen falta mientras rija el E5. No propongo migración
en este paso.

**Respuestas nuevas por documento:**

| Tipo | Cuántas | Cuáles | Costo |
|---|---:|---|---|
| Con el modelo | 12 | K39, K52, K87, K89, K93, K98, K597, K611, K629, K652, K675 y K701 | ~0.004 USD cada una (promedio del v5: 0.6932 USD / 168 filas, 830 tokens de entrada y 227 de salida); en total **~0.05 USD por corrida**, sobre los ~0.69 de hoy (+7%) |
| Con el modelo, más adelante | +1 | K599, cuando exista su hecho | — |
| Por regla | ~30 | S2 33/34 por objetivo, ramas y remisiones | 0 USD |

Las 12 respuestas con el modelo son respuestas propias con clave `fila:N`. Las filas de rendimiento y flujos (K87,
K89) cubren también su fila de «cuantitativa y cualitativa». El Excel reutiliza las del Formato.

Las respuestas por regla salen del objetivo (S2 33/34), de las ramas de los booleanos y de las remisiones del E5. En
el Excel son ~110 filas más, sin llamada al modelo.

### 0.6 Lo que encontré de paso

- **La plantilla pide los objetivos uno por uno** («Objetivo 1», «Objetivo 2»: K475, K495, K548), pero el demo junta los
  tres objetivos en un solo bloque. Responder S2 33/34 por inciso **y por objetivo** exige iterar el bloque, como ya se
  hace con las métricas de S1 46–50. Es lo más grande del encargo.
- **El Excel repite el bloque de 29(a)(iii)** (f130–f133 y f134–f137 son las mismas cuatro preguntas). Se llenan igual;
  no se toca la plantilla.

---

## 1. Objetivo

Que cada fila del Formato electrónico y de la hoja principal del Excel que pide un inciso reciba la respuesta de ese
inciso. Cuando no la tenga, la fila queda vacía por una regla nombrada (E5, rama cerrada, alivio, actividad), nunca con
el texto del párrafo. La revisión externa deja de calificar «repeticiones por inciso».

## 2. Alcance, por fases (propuesta; cada una con parada)

### Fase 1 · Contenido falso y 36(e)

- **K41 y K50:** van vacías por regla. Se agregan `SI_COMO` 41:38 y `POR_QUE` 50:49, con su e2e.
- **29(e) por tipo:**
  - tres respuestas propias, `fila:350`, `fila:373` y `fila:396`, cada una solo con los hechos de su tipo;
  - un validador que impide repetir el mismo importe en dos tipos;
  - el Excel (f153, f162, f171) toma las mismas;
  - K692 (etiqueta) queda vacía.
- **36(e) en un solo estado:**
  - una redacción de regla para (ii)–(iv) y para el padre;
  - el padre deja de decir «No aplica» cuando (i) tiene respuesta del cuestionario, y remite a (i)–(iv);
  - la rama «¿Por qué?» da solo la razón;
  - en el Excel, las ramas f273–f275 como en el Formato.
- **Costo en dev:** 3 respuestas con el modelo (~0.013 USD), más las 3 que se regeneran siempre (~0.02 USD).
- **Estimación:** 1 jornada.

### Fase 2 · Estrategia (NIIF S2 16)

- K86–K90: rendimiento y flujos de 16(a), con su fila cuantitativa y cualitativa.
- K93: 16(b), cuantitativa y cualitativa.
- K98: flujos previstos de 16(d).
- Excel: f98, f99 y f104.
- **Costo:** 4 respuestas con el modelo (~0.016 USD por corrida).
- **Estimación:** 1 jornada.

### Fase 3 · Gobernanza (NIIF S2 6) y continuación del Excel bajo E5

- K39 (la razón de que no haya métricas en la remuneración) y K52.
- Excel:
  - las 16 ramas de booleanos de NIIF S2 (regla, lo mismo que el Formato);
  - las 12 filas de NIIF S1 bajo E5 (remisión o vacías: decisión §5);
  - f114.
- **Costo:** 2 respuestas con el modelo (~0.008 USD).
- **Estimación:** 1 jornada.

### Fase 4 · Objetivos (NIIF S1 51, S2 33 y 34)

- El bloque «Objetivo N» se itera por objetivo.
- S2 33 (a), (c)–(h) y 34 (b)–(d) salen por regla de `objetivos` y `objetivos_detalle`.
- S1 51 (a)–(g) remiten a su par de S2 por el E5.
- S2 33(b), el propósito del objetivo, queda pendiente hasta que exista el campo (clase c): no se inventa.
- **Costo:** sin llamadas al modelo.
- **Estimación:** 2 jornadas, por la iteración del bloque.

### Fase 5 · Métricas (NIIF S2 29 y 32)

- **29(a)(iii):** K597 (a). K599 (b) pendiente del hecho en el próximo libro. K601 (c) desde una pregunta nueva del
  cuestionario de GEI, si Esteban la aprueba. En el Excel, f131–f137.
- **29(a)(v):** K611; en el Excel, f142 y f143.
- **Excel EI14:** f140.
- **29(f):** K701 y la etiqueta K695 vacía.
- **Excel, ramas de 29(f) y 29(g):** f185 y f190.
- **Excel, B65(c) por tipo:** f156–f177, por regla desde las `fila:N` que ya existen.
- **Excel:** actividad (f148–f149) y la lista de sectores de 32 (70 filas, «Sí» en el sector del Perfil).
- **Filas de ejemplo:** K63, K125 y K129 vacías.
- **Costo:** 3 respuestas con el modelo (~0.012 USD).
- **Estimación:** 1.5 jornadas.

**Total estimado:** 6.5 jornadas. En dev se regeneran solo las respuestas de cada fase con
`scripts/formato/regenerar-una-respuesta.mjs` o con la regeneración de respuestas, que reutiliza las demás. El costo
acumulado del encargo en dev sería menor de 0.20 USD. No se regenera el documento.

## 3. Qué toca y qué no

- **Toca:**
  - `lib/formato/llenar.ts`, `lib/suplemento/respuestas.ts` y la exportación del Excel
    (`app/admin/cobertura/export-taxonomia`);
  - los e2e del Formato y del Excel, y `verify:export`;
  - las respuestas del demo v5 en dev.
- **No toca:**
  - el catálogo y las migraciones, salvo una decisión de Esteban en §5;
  - la plantilla del Formato;
  - el Word y los bloques del documento aprobado;
  - staging.
- **Ambientes:** stack local para los e2e; dev para las respuestas y las exportaciones; `traceline-dev` al final, para
  la lectura externa.

## 4. Definición de terminado

- Ninguna celda del inventario repite el texto de su párrafo: o tiene respuesta propia, o está vacía por una regla
  nombrada. Lo comprueba un e2e nuevo que recorre el inventario.
- Las 5 celdas ⚠ de §0.2, corregidas.
- 36(e) en un solo estado en el Formato y en el Excel.
- Vocabulario 0 en los dos libros.
- `tsc` limpio, `eslint` sin errores nuevos, `verify:export` y los e2e del área en verde.

## 5. Decisiones de Esteban (28/10/2026, Paso 0)

1. Fases 1–5 aprobadas, en ese orden.
2. 36(e): el padre remite a los incisos (i)–(iv) cuando (i) tiene respuesta; «No aplica» solo si ningún inciso
   responde; una sola redacción.
3. Las 12 filas de continuación de NIIF S1 bajo E5 llevan la remisión de su fila madre.
4. Sí a los dos:
   - la pregunta «cambios en el enfoque de medición» va al cuestionario de GEI en la Fase 5;
   - el campo «propósito del objetivo» (S2 33(b)) entra en la Fase 4, con migración aditiva y parada con el SQL antes
     de aplicarla en dev.
5. Sin códigos nuevos: se responde por fila y Cobertura no cambia.

Fase 1, además: las ramas que su booleano cierra quedan vacías por regla general, no solo K41 y K50. 29(e) físicos son
los 12.3 millones de adecuaciones del sureste; transición y oportunidades, lo que el libro sustente, o vacío.

### 5.1 Preguntas del Paso 0 (ya respondidas arriba)

1. **Fases y orden de §2:** ¿los apruebas? La Fase 1 es la que pediste: contenido falso y 36(e).
2. **36(e), el padre:** ¿remite a (i)–(iv) en lugar de «No aplica» cuando (i) tiene respuesta del cuestionario? Es mi
   propuesta.
3. **Excel, continuación de NIIF S1 bajo E5 (12 filas):** ¿la misma remisión de la fila madre, o vacías?
4. **Clase (c):**
   - ¿agrego la pregunta «cambios en el enfoque de medición» al cuestionario de GEI?
   - ¿el campo «propósito del objetivo» (S2 33(b)) entra aquí, con su migración, o va a otro encargo? Hasta decidirlo,
     esas celdas quedan pendientes.
5. **Códigos de S2 33 (a)–(h) y 34 (a)–(d) para Cobertura:** ¿se dan de alta (12, migración de datos del catálogo) o se
   responde solo por fila? Mi propuesta: solo por fila en este encargo.

## 6. Riesgos y dudas conocidas

- La iteración de objetivos (Fase 4) cambia el número de filas que se llenan en la plantilla. Hay que probarla con 1,
  3 y 5 objetivos.
- K599 depende del próximo libro de hechos. Hasta entonces queda vacía, y no con el texto del párrafo.

## 7. Registro

| Fecha | Qué | Resultado |
|---|---|---|
| 28/10/2026 | **Paso 0** (lectura). Inventario de 50 celdas del Formato y 132 filas del Excel; 5 celdas con contenido falso; 34(c)/(d) ya no lo son; 0 códigos nuevos necesarios; ~12 respuestas con el modelo por documento (~0.05 USD por corrida); cinco fases, 6.5 jornadas | **Parada:** decisiones de §5 |
| 28/10/2026 | **Fase 1**, parada | **Ramas de los booleanos, regla general:** `RAMAS_BOOLEANO` en `llenar.ts`, con las 14 ramas de la plantilla, sustituye a `POR_QUE` y `SI_COMO`. Un e2e comprueba contra la columna D que no falte ninguna. Cerradas y vacías: K41, K45, K50, K135, K594, K699 y K707. K39 («¿Por qué?» con «No») da la razón: la respuesta propia de K38 sin el «No.». **29(e) por tipo** (`CONCEPTOS_29E`, filas 350, 373 y 396): reciben solo los hechos de despliegue de capital del libro de su tipo; validador de tipo nombrado y de cifras que salgan de sus hechos. K652, 12.3 millones de adecuaciones; K675, 31.0 de eficiencia más 0.4 de medición del inventario; K629 vacía, porque el libro no sustenta ninguno de transición. K693 conserva el total de 31.4. **36(e):** el padre (K534, Excel f272) remite a (i)–(iv); K535 «No» por regla, porque (ii)–(iv) no aplican; K536 da la razón (la respuesta de (i)); una respuesta del cuestionario que solo dice «No aplica…» toma la redacción de regla (K540, f277). **Regeneración:** solo las 6 filas que cambian, en una corrida (`regenerar-una-respuesta.mjs`, ahora con varias claves y `--crear`): **0.0268 USD**, de los que 2 respuestas son nuevas y el resto son las 3 que se regeneran siempre. **Antes y después:** 9 celdas del Formato y 2 del Excel, ninguna más (`~/Downloads/formato-respuesta-por-inciso/fase1-antes-despues-*.txt`). **Pruebas:** `e2e-celdas-categoricas` en verde con 13 casos nuevos, que fallan los 13 sobre v5.1; `e2e-respuestas-validadores` 83; métricas 19, Formato 29, alivios 20, respuestas 22 y regeneración 9, contra el stack local; `verify:export` 81 contra dev; vocabulario 0 en los dos libros; `tsc` limpio | **Parada:** revisión de Esteban |
| 28/10/2026 | **Fase 1 aprobada** con dos ajustes, aplicados | (1) El despliegue de capital excluye lo registrado como gasto, con el criterio de K85 (capitalizado sí, gasto no): instrucción y validador `GASTO_NO_CAPITAL_RE`. (2) La celda dice solo el despliegue de su tipo, sin aclaraciones de lo que no incluye. K652: 12.3 millones de adecuaciones; K675: solo los 31.0 millones de eficiencia energética |
| 28/10/2026 | **Fase 2** (Estrategia, NIIF S2 16), parada | **Formato:** K85 (situación), K87 (rendimiento) y K89 (flujos) con respuesta propia (`porEfecto`). Se reparten los hechos del párrafo: lo capitalizado (12.3 y 31.0) en K85; las primas (6.2) y la medición (0.4) registradas como gasto en K87; los desembolsos del periodo en K89. Las tres van sin la declaración negativa general, que queda en la síntesis K84, y sin respaldo de oraciones del bloque. Validador: ninguna repite ni parafrasea (≥ 70 % de palabras) una oración de otra celda del párrafo, incluida K84. K86, K88 y K90 (instrucción «Revelar información cuantitativa y cualitativa…» de la pregunta de arriba) quedan vacías por regla. Regla de forma general: ninguna respuesta habla de «los hechos». **Excel:** filas de continuación (`lib/excel/continuaciones.ts`); 98 y 99 con K87 y K89, 104 con la respuesta de flujos previstos (`fila:99`), 31, 32 y 37 con la remisión de su fila madre; solo cuentan las filas con requisito (la plantilla trae una fila intermedia vacía en 16(d)). **Regeneración:** 0.0566 USD (29(e) ×2, K84, K85, K87 y K89, más las 3 que se regeneran siempre) + 0.0251 (K85, K87 y K89 otra vez, tras corregir el validador de la declaración negativa) = **0.0817 USD**. **Antes y después:** 9 celdas del Formato (K84–K90, K652 y K675) y 6 del Excel (31, 32, 37, 98, 99 y 104). **Pruebas:** `e2e-celdas-categoricas` en verde con 9 casos nuevos, que fallan los 9 sobre la Fase 1; `e2e-respuestas-validadores` 85; métricas 19, Formato 29, alivios 20, respuestas 22 y regeneración 9, contra el stack local; `verify:export` 81; vocabulario 0; `tsc` y eslint limpios. **Error propio:** la primera exportación desplazó las filas del Excel a partir de la 104 (la respuesta cayó en la fila intermedia vacía de 16(d)); corregido antes de este registro | **Parada:** revisión de Esteban |
| 28/10/2026 | **Fase 2 aprobada** con tres ajustes, aplicados | (1) **Filas de instrucción** según su tipo en la plantilla: con tipo, la parte cuantitativa propia; sin tipo, vacías. K86, K88 y K90 no tienen tipo y quedan vacías. (2) **K89** con la forma «Los importes del periodo relacionados con … fueron …; la Compañía no identificó otros efectos en sus flujos de efectivo». Validador: «salida», «pago» o «desembolso» solo si un hecho lo dice. (3) **16(d) por efecto:** K96 rendimiento previsto, con la razón de no cuantificar (NIIF S2 21); K98 flujos previstos, con el ahorro de 9 millones. K97 y K99 llevan una línea por plazo, solo con hechos que nombran el plazo (`TABLAS_POR_HORIZONTE`); ningún hecho de 16(d) nombra un plazo, así que quedan vacías. Antes repetían el mismo texto en los tres plazos. Excel 104 toma K98. Se borraron de dev las respuestas `fila:97` y `fila:99` (las tablas viejas sin plazo), que ya no lee nada. **Regeneración:** K89, K96 y K98, **0.0230 USD** |
| 28/10/2026 | **Fase 3** (Gobernanza, NIIF S2 6, y Excel bajo E5), parada | **Formato:** K26 vacía por una regla general: una fila sin tipo que sigue a otra con el mismo código es su detalle. La misma regla deja vacías las filas de ejemplo K63, K125 y K129 (inventario, Fase 5). K36 (supervisión de objetivos) por efecto, sin los hechos de remuneración (van en K38 y K39). K43 (papel de la gerencia) por efecto, con validador que impide repetir o parafrasear las respuestas de 6(b)(i) (K47) y 6(b)(ii) (K52). **Excel** (`lib/excel/continuaciones.ts`): las filas de NIIF S1 bajo E5 (f4, f10–f12, f15–f17, f49, f50) llevan la remisión de su fila madre. Los booleanos de NIIF S2 y sus ramas (6(a)(v), 6(b)(i), 6(b)(ii), 25(a)(vi), 29(f), 29(g) y 36(e)) toman el valor que escribe el Formato («K:N», con el llenado del Formato), con las ramas cerradas vacías. La primera fila de esos códigos, y la de 16(a) y 16(d), toma solo su parte (K36, el booleano, K85, K96) en lugar de la respuesta completa del código, que parafraseaba las demás filas. Dentro de cada código solo quedan iguales las remisiones del E5, como se decidió. **Regeneración:** K36 y K43, **0.0243 USD**. **Antes y después:** Formato K26, K36, K43, K63, K125 y K129; Excel, 26 celdas (`fase3-antes-despues-*.txt`). **Pruebas:** `e2e-celdas-categoricas` en verde con 7 casos nuevos de la Fase 3 y 6 de los ajustes, que fallan sobre la exportación anterior (7 y 9); validadores 85; métricas 19, Formato 29, alivios 20, respuestas 22 y regeneración 9, contra el stack local; `verify:export` 81; vocabulario 0; `tsc` y eslint limpios | **Parada:** revisión de Esteban |
