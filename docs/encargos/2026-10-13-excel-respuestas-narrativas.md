# Encargo: Respuestas narrativas en el Excel de taxonomía y Formato electrónico NIIF S1/S2 (Paso 7 del suplemento)

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/excel-respuestas` desde `dev/ajustes-sep26`; PR a `dev`, luego a `main` y despliegue según `CLAUDE.md` (migraciones por Esteban).
**Fecha de inicio:** 13 de octubre de 2026 · **Aprobado por:** Manuel.
**Referencia:** encargo de calidad del suplemento (Paso 7 anotado), especificación §3.3 y §6 (libro de hechos, cobertura por subrequisito, validadores), `lib/reporte/ensamblar.ts`, `assets/taxonomia-base.xlsx`, v40 en producción. **Formato de referencia:** `referencia/formato-electronico/Estructura_Formato_NIIF_S1_S2_Autlan.xlsx` (el formato electrónico de la BMV/CNBV tal como IRStrat lo entregó para Autlán, ejercicio 2025, con 93 respuestas llenas; fuera de git).

## 1. Objetivo

Que la plataforma entregue, además del Word del suplemento, los dos Excel que hoy IRStrat llena a mano para cada emisora, desde los mismos hechos y bloques aprobados:

1. **El Excel de taxonomía con respuestas**: por cada datapoint, además del valor, una respuesta breve redactada desde el bloque dueño del suplemento, con remisión a la sección.
2. **El Formato electrónico NIIF S1/S2** que la emisora presenta: la estructura del formato de referencia (secciones `[100000]`, `[200000]`, `[210000]`, `[211100]`–`[211300]`, `[901000]`), con la columna Respuesta llena según el tipo de cada campo, más la hoja "Tabla NIIF" de riesgos y oportunidades.

Una sola fuente de verdad: Word, Excel de taxonomía y Formato electrónico salen del mismo libro de hechos y de los mismos bloques aprobados, y no pueden contradecirse.

## 2. Alcance

### 2.1 Excel de taxonomía con respuestas
- Columna "Respuesta" en la hoja Taxonomía, por datapoint:
  - narrativos: dos a cuatro oraciones derivadas del bloque dueño y de los hechos de la cobertura de ese inciso; cifras idénticas a las capturas; cierra con "Ver sección N · <título>";
  - numéricos: el valor con unidad y periodo más una oración de contexto si el bloque la tiene;
  - sin hechos: "Pendiente: <qué falta>", el mismo marcador del Word;
  - "No aplica" cuando el inciso lo hereda del catálogo o del régimen (C4, E5, 36(c)/36(e)).
- Incisos hijos agrupados bajo su código padre, con la respuesta del padre como encabezado.

### 2.2 Formato electrónico NIIF S1/S2
- **Estructura**: se reproduce la del formato de referencia (hoja "Estructura Formato Electronico"): Ref, concepto, lista, tipo de formato, fuente, consideraciones para el llenado, consideraciones de estructura, Respuesta. Los textos de "Consideraciones para el llenado" reproducen la norma y viven en el archivo de referencia; la plataforma los **copia del asset** (no se versionan en el repo, `CLAUDE.md` §4), igual que la plantilla de taxonomía.
- **Mapeo concepto ↔ datapoint**: se construye una vez, por el párrafo de la columna "Fuente" (`NIIF S2 6`, `NIIF S1 31`, `NIIF S2 29(g)(i)`…) cruzado con los códigos del catálogo y con los bloques dueños. Archivo versionado en el repo (`docs/suplemento-s1s2/mapeo-formato-electronico.md` y su JSON), una fila por concepto: concepto, fuente, tipo de campo, datapoint(s), bloque dueño, regla de llenado, y "sin mapeo" donde el concepto no tiene datapoint en nuestro catálogo. Esteban lo revisa como revisión de IRStrat.
- **Llenado por tipo de campo**:
  - `text block` y `text`: respuesta de dos a cuatro oraciones desde el bloque dueño (misma generación que 2.1, reutilizada cuando el datapoint coincide);
  - `booleano`: Sí/No desde un hecho o una declaración negativa; sin hecho, "Pendiente";
  - `enumeración` (único o múltiple): el valor desde el catálogo o el Perfil (tipo de instrumento, horizontes, régimen); sin dato, "Pendiente";
  - `porcentaje` y cifras: desde las capturas confirmadas con unidad;
  - `tabla`: la tabla del bloque dueño (riesgos, oportunidades, GEI por alcance, objetivos), con las columnas del formato;
  - `abstract`: sin respuesta (es encabezado).
- **Sección `[100000]`** (identificación: clave de cotización, razón social, año, logotipo, tipo de instrumento): desde el Perfil del emisor; los campos que el Perfil no tiene hoy (clave de cotización, tipo de instrumento, fiduciario) se añaden al Perfil en este encargo.
- **Secciones `[2111xx]`** (emisiones financiadas: gestión de activos, bancos, seguros): se llenan solo si el sector del emisor lo pide (Perfil) y hay hechos; si no, "No aplica" con la justificación.
- **Secciones `[8xxxxx]`** (métricas por industria SASB): **fuera de alcance** hasta que exista el catálogo SASB (Fase C). Se dejan vacías con la nota "métricas por industria: pendiente de catálogo SASB".
- **Hoja "Tabla NIIF"**: riesgos y oportunidades con las columnas del formato (riesgo, descripción, relacionado con el clima, tipo, horizonte, efecto sobre el modelo de negocio y la cadena de valor, ubicación), desde los registros de clima y los bloques 21 y 24.
- **Hoja "Métricas SASB"**: fuera de alcance (Fase C); se deja la hoja con el encabezado.

### 2.3 Reglas comunes
- **Procedencia y versión**: cada respuesta se liga a la versión aprobada del bloque del que salió; se regenera solo cuando ese bloque cambia; el historial del bloque cubre a la celda. Las respuestas se guardan en una tabla aditiva (`respuestas_datapoint`: documento, versión aprobada, datapoint o concepto, texto, hechos citados, bloque, versión del bloque, modelo, costo), con RLS del tenant y barrera del auditor; los dos Excel las leen de ahí.
- **Regla de publicación**: las respuestas entran a los Excel solo desde un **documento aprobado**. Con el suplemento en borrador, la columna dice "En preparación" y el Formato electrónico muestra estructura y fuentes sin respuestas. Motivo: el auditor descarga el Excel de taxonomía y no debe leer borradores. El Formato electrónico lo descargan staff y admin del cliente; el auditor, no.
- **Validadores**: ninguna cifra fuera de las capturas confirmadas; cada booleano y enumeración respaldado por un hecho; la remisión apunta a un bloque del documento aprobado dueño del hecho; longitud máxima por tipo; sin vocabulario de plataforma; glosario del emisor aplicado; las declaraciones negativas del bloque aparecen cuando el concepto las pide.
- **Costo**: una llamada corta por respuesta narrativa con Sonnet 5.5, con caché del contexto compartido; estimado < $1 por emisora para los dos Excel (las respuestas se comparten entre taxonomía y formato cuando el datapoint coincide).
- **Pantalla**: en Cobertura, dos botones: "Excel de taxonomía" (como hoy, con o sin respuestas según estado) y "Formato electrónico NIIF" (solo con documento aprobado; si no, deshabilitado con el motivo). Al aprobar un documento, aviso de que los Excel incorporarán las respuestas.
- **Bandera**: `generador_activo` del tenant; sin generador, el Excel de taxonomía sale como hoy y el Formato electrónico no se ofrece.

No incluye:
- Cambios al generador del Word ni al libro de hechos (las deudas del Paso 5c siguen aparte).
- Métricas por industria SASB ni respuestas GRI (Fase C).
- Inglés.
- La hoja "Consideraciones" del formato (texto fijo de IRStrat): se copia tal cual desde el asset.

## 3. Decisiones de diseño

- La respuesta narrativa no se redacta desde cero: el prompt recibe el texto aprobado del bloque dueño y los hechos del inciso o concepto, y devuelve un resumen fiel con la cita de los hechos usados; el validador comprueba que cada cifra y cada hecho citado existan.
- El mapeo concepto ↔ datapoint es la pieza de fondo: donde el formato pide algo que el catálogo no tiene como datapoint, se registra como "sin mapeo" y se propone el datapoint nuevo para el catálogo en una lista aparte (no se crean en este encargo).
- El Excel de taxonomía conserva su estructura (hojas, columnas, mapeo_export); "Respuesta" se añade como columna. El Formato electrónico es un archivo aparte, generado desde el asset de referencia (estructura, tipos, fuentes y consideraciones) más las respuestas; se descarga como `Formato_electronico_NIIF_<emisora>_<ejercicio>.xlsx`.
- Un documento aprobado nuevo reemplaza las respuestas del anterior; los Excel reflejan siempre el último aprobado.
- Los textos de la norma que el formato trae en "Consideraciones para el llenado" viven en el asset (fuera de git); el repo solo lleva el mapeo y los códigos, conforme a `CLAUDE.md` §4.

## 4. Definición de terminado

- Migraciones aditivas con barrera (tabla de respuestas; campos nuevos del Perfil); aplicadas dos veces en local y en dev.
- Mapeo concepto ↔ datapoint completo para las secciones en alcance, revisado por Esteban; lista de conceptos "sin mapeo" entregada.
- Excel de taxonomía del demo con documento aprobado: todos los datapoints con respuesta, pendiente o no aplica; cero cifras fuera de las capturas; remisiones válidas; comparado con el Word por Esteban: ninguna respuesta contradice su sección.
- Formato electrónico del demo con documento aprobado: todos los conceptos en alcance con respuesta por tipo, pendiente o no aplica; `[100000]` completo desde el Perfil; Tabla NIIF con los riesgos y oportunidades del demo; secciones `[8xxxxx]` con la nota de Fase C. Comparado por Esteban, como consultor, contra el formato de Autlán: misma estructura, mismo tipo de respuesta por campo.
- Con el documento en borrador: "En preparación"; el auditor descarga el Excel de taxonomía sin texto de borrador y no puede descargar el Formato electrónico (e2e).
- Regeneración: al cambiar y reaprobar un bloque, solo cambian las respuestas de sus datapoints y conceptos (e2e).
- Costo medido por emisora; `tsc`, `eslint`, `verify:export` (actualizado), build.
- Especificación: sección "Excel de taxonomía con respuestas y Formato electrónico" y nota en §10 para el despliegue (diferencias esperadas en el Excel de taxonomía; archivo nuevo).

## 5. Pasos y paradas

0. Resumen de una página: lectura del formato de referencia (secciones, conceptos por tipo, cuántos tienen fuente, cuántos llena Autlán); cómo arma hoy el Excel el ensamblador; cómo se liga datapoint → bloque dueño → hechos → versión aprobada; propuesta del mapeo (método por párrafo de fuente) con una estimación de cuántos conceptos quedan sin mapeo; propuesta de tabla y de prompt; costo. Parada.
1. Mapeo concepto ↔ datapoint completo, en `docs/suplemento-s1s2/mapeo-formato-electronico.md` + JSON, con la lista "sin mapeo". Parada: revisión de Esteban (revisión de IRStrat).
2. Tabla de respuestas, generación al aprobar, validadores; respuestas del demo en tabla legible. Parada.
3. Excel de taxonomía con columna "Respuesta", incisos bajo su padre, regla de publicación, e2e del auditor. Parada: Excel del demo aprobado y en borrador.
4. Formato electrónico: asset de referencia cargado, generación por tipo de campo, `[100000]` desde el Perfil (campos nuevos), Tabla NIIF, secciones fuera de alcance con nota. Parada: revisión de Esteban contra el formato de Autlán.
5. Regeneración por cambio de bloque, pantalla, especificación, `verify:export`. PR a `dev`.
6. PR a `main` y despliegue (migraciones por Esteban; comparador con las diferencias esperadas).

## 6. Riesgos

- El formato de referencia tiene conceptos sin fuente o con fuentes agrupadas ("NIIF S1 32 / NIIF S2 13 / NIIF S2 23"): el mapeo tendrá ambigüedades que se resuelven con Esteban en el Paso 1, no con el modelo.
- Conceptos del formato sin datapoint en el catálogo: se esperan varios en `[100000]` (identificación) y en `[2111xx]`; se listan, no se inventan.
- El formato puede cambiar de versión (el de referencia es el de 2025): el asset lleva fecha de versión y el mapeo también; un formato nuevo es un mapeo nuevo.
- Respuestas que resumen bien pero omiten el matiz del bloque (alivios, exclusiones): el validador exige las declaraciones negativas cuando el concepto las pide.
- Volumen: 434 conceptos, de los que unos 180 están en alcance; cuidar ancho de columna y ajuste de texto.

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-10-13 | Manuel aprueba el Paso 7; Esteban entrega el formato electrónico de Autlán como referencia | El entregable es el Formato electrónico NIIF S1/S2 de la BMV lleno por tipo de campo, más el Excel de taxonomía con respuestas; métricas por industria fuera hasta la Fase C; respuestas solo desde documento aprobado |
| 2026-10-13 | **Paso 0** aprobado en sus seis puntos: mapeo en tres capas (el modelo nunca decide); [100000] desde el Perfil con clave de cotización, tipo de instrumento y fiduciario; tabla `respuestas_datapoint`; llenado por tipo, con modelo solo para text y text block; agrupar por bloque (meta < $1); para el Paso 2, el documento `98d57a6a` aprobado en dev. Lectura del formato: 369 filas de concepto (no 434), 92 respondidas por Autlán (no 93). La columna Ref trae el párrafo de la norma | — |
| 2026-10-13 | **Paso 1 · mapeo** (`scripts/formato/mapear-formato.mjs`, sin modelo; asset sha256 `69b062137cd8`; catálogo de dev, 112 códigos NIIF). 364 filas en alcance: 250 conceptos con tipo, 106 subconceptos (heredan el datapoint de la fila con tipo anterior), 5 encabezados y 3 miembros de tabla ([901000]). De los 250: Perfil 15, capa 1 (Ref o Fuente) 170, capa 2 (etiqueta) 49, sin candidato 16. Confianza: alta 160, media 63, baja 11. De los 92 respondidos por Autlán: Perfil 6, capa 1 70, capa 2 14, sin candidato 2. En la capa 1, ningún datapoint ajeno a sus párrafos. El `.md` y el JSON no traen texto del formato (comprobado: 0 de 670 textos), así que cada concepto va por su fila; las etiquetas están en `referencia/formato-electronico/mapeo-revision.xlsx` (fuera de git), con semáforo y la columna «Decisión de Esteban» | **Para la revisión de Esteban:** 66 conceptos de texto caen en 35 datapoints de NIIF S1 (27, 32, 33, 35, 40, 41, 44, 46 a 50, 51 y 72) que no tienen bloque dueño, porque el suplemento los responde con su equivalente de NIIF S2. Hay que decidir si se responden desde el bloque del equivalente S2 (tabla de correspondencias S1↔S2, que decide Esteban) o quedan «Pendiente». En [100000], 2 conceptos sin campo del Perfil asignado |
| 2026-10-13 | **Revisión de Esteban aplicada** (`mapeo-revision.xlsx`: la columna N vacía, así que valen las 147 propuestas del asesor en P). Se regeneró con `mapear-formato.mjs --decisiones`: las decisiones se interpretan con patrones explícitos (0 sin interpretar) y los códigos se resuelven contra el catálogo por su nombre exacto. Reglas: **par S1/S2 → el código S2**, con la oración fija del alivio E5 (43 por P, 9 por la regla general y 17 por la tabla de correspondencias de la Leyenda: 88 filas con E5); **imágenes** (23 tablas-plantilla de la BMV, celdas con `#VALUE!`) como «tabla», con la estructura en la columna O de la revisión (fuera de git); 6 filas insertadas (111, 113, 115, 310; 508 y 509 fuera de alcance); encabezados 102, 306, 272, 432 y 450, y 144 deja 27(a)(v); métricas S1 46–50 (144–185) iteradas por las métricas de S2 29; [100000] fila 5 regla fija y fila 20 `perfil.numero_fideicomiso`; 273, 303, 420 y 283 con regla; «No aplica» el primer año en 186–192, 295–299 y 584. **Antes → después:** filas 364 → 370; conceptos con tipo 250 → 256; sin candidato 16 → **1** (435, S2 29B(a), sector financiero); conceptos de texto con bloque dueño 106 → 143 (de 181); encabezados 5 → 51; subconceptos 106 → 58; confianza alta 217 → 316, media 102 → 2, baja 14 → 0; respondidos por Autlán 92 → 93 | **Discrepancias de código para Esteban:** S2 13 y S2 22 no tienen código propio (sus incisos son de los bloques 13 y 26: datapoint por decidir); S2 14(a) no existe y sus incisos tienen distintos dueños; S2 16(c) → «NIIF S2 16(c)(i)(ii)»; 25(a) → «NIIF S2 25 (a)(i)a(v)»; 36(e) → «NIIF S2 36 (e)(i)a(iv)»; 29(a)(iv) → «NIIF S2 29 (a)(iv) EI5»; 29(f)(i) → «NIIF S2 29 (f) (i) y (ii)»; 29(g)(i) → «NIIF S2 29 (g) (i) y (ii)»; S2 21(a), 28 y 29B(a) no existen. **Fila 167:** el bloque 30 tiene el hecho «…con inventario verificado por tercero» (sin verificador ni nivel de aseguramiento) |
| 2026-10-13 | **Documento de prueba aprobado.** `98d57a6a` tenía 8 pendientes en 7 bloques; Esteban decidió las 8 respuestas del demo (`poblar-demo.mjs`) y un acta ficticia del Consejo de abril y octubre de 2025 (`adjuntos-demo.mjs`) que cierra la secuencia aprobación de objetivos y capacitación. Libro rehecho dos veces y bloques 10, 15, 16, 21, 26, 27 y 28 regenerados ($3.16 + $1.33); aprobado por la pantalla real con la sesión del staff, sin bloqueantes. Arreglado aparte el pendiente fantasma del cierre (`cierre.ts`: la remisión por duplicación dejaba la entrada sin marcador) | Decisiones de Esteban del 13 de octubre: las 8 respuestas del demo y el acta del Consejo |
| 2026-10-13 | **Paso 2 · respuestas.** Tabla `respuestas_datapoint` (migración `20261013120000`, aplicada tres veces en local y en dev; local == remoto) y `lib/suplemento/respuestas.ts`: reglas por código (alivio C4; no aplica heredado de 36(c)/36(e); padres de incisos con los hechos de sus hijos; NIIF S1 sin bloque con E5 vigente → «No aplica» con la oración fija del E5 y la remisión a su par S2 del mapeo; sin bloque y con captura confirmada → valor, unidad y periodo «según captura validada», sin modelo; lo demás «Pendiente» con el marcador del Word). Modelo (Sonnet 5.5, esfuerzo bajo) una llamada por bloque, con validadores (cifras de la sección o los hechos, hechos citados, declaración negativa, longitud, vocabulario, marcadores, glosario) y un reintento; si falla, las oraciones del bloque ancladas a los hechos. Se genera al aprobar (after(), con reserva) y por `POST /api/suplemento/{documento}/respuestas`. **Demo:** 177 filas (112 de taxonomía, 65 de formato): taxonomía 66 respuesta, 44 no aplica, 2 pendientes (S2 30 y S2 B65(e), sin bloque ni captura); formato 56 y 9; 122 del modelo, 2 aceptadas en el reintento, 0 de respaldo; **$0.45**, 58 s | Decisiones de Esteban del 13 de octubre: text block del formato hasta 6 oraciones y 900 caracteres, taxonomía 4; nulos: celda vacía en el formato, «No aplica»/«Pendiente» explícitos en la taxonomía; sin bloque dueño con captura → respuesta desde la captura, sin modelo |
| 2026-10-13 | **Cambio de alcance** (revisión externa del Excel de taxonomía, de Esteban y el asesor, aprobada por Esteban): (1) las hojas de datos respetan C4, C3 y E5 en borrador y en aprobado («No revelado · alivio …»), con inventario previo contrastado con el Word y e2e con los tres alivios; (2) ninguna celda exportada lleva «[Pendiente…»: texto plano en la taxonomía, celda vacía en el formato (la base conserva el formato de §5; CLAUDE.md 1.10); (3) hoja «Leyenda» con el texto de las hojas de datos y de la columna «Respuesta»; (4) **entra a este encargo** la numeración consecutiva de secciones del Word, porque las remisiones del Excel dependen de ella (se levanta para ese punto la exclusión «cambios al generador del Word»); (5) «No aplica · E5» dice «sin sección en el suplemento; ver NIIF S2 N». Especificación 0.41, §6.1 | Aprobado por Esteban el 13 de octubre de 2026 |
| 2026-10-13 | **Cambio de alcance aplicado.** Inventario contra el Word: C4 → Alcance 3 total y 15 categorías en 29(a)(i) y 29(a)(vi)(1), los dos años (el Word calla los mismos rubros con `rubroExento`); C3 → la columna del año anterior en 29(a)(i), 29(a)(vi)(1) y en los registros de 29(b), 29(c) y 29(d) (el Word nunca publica el año anterior); E5 → hojas NIIF S1 46-50 (sin escritor) y NIIF S1 51 (todos los objetivos; el Word solo publica los climáticos, en S2 33–36); sin dependencia de alivios: S2 10, 22(b)(i)/(ii), 33–36, 36(e). La regla de celdas mapeadas vive en el ensamblador (`alivioDeCelda`) y la posicional en el export; hoja «Leyenda»; pendientes en texto plano (`pendienteEnTextoPlano`); «No aplica · E5» con «Sin sección en el suplemento; ver NIIF S2 N»; numeración consecutiva del Word (`numeracionConsecutiva`) compartida con las remisiones. Las respuestas del modelo se reutilizan si su bloque sigue en la misma versión aprobada y de prompt: en el demo, 0 llamadas y $0; cambiaron solo 36 textos E5 y 48 remisiones. e2e `scripts/e2e-excel-alivios.mjs` (19 ✓: sin alivios, C3+C4+E5 en el primer año, los mismos en año subsecuente, texto plano, índice del Word); `verify:export` actualizado al régimen del demo (C3, C4, E5) y verde; `verify:word` verde. Excel del demo: 0 celdas que empiecen con «[», 44 «No revelado · alivio», fila 191 «Pendiente: …» | — |
| 2026-10-13 | **Paso 3 · Excel de taxonomía.** Columna E «Respuesta» en la hoja «Taxonomía NIIF S1 S2», en la primera fila de cada código (como la D); hijos de 25(a), 36(a)–(d), 36(e) y S1 44(a) con nivel de esquema 1 y sangría bajo su padre; sin respuestas del último aprobado, «En preparación»; con el generador apagado, sin columna. e2e `scripts/e2e-excel-respuestas.mjs` (21 ✓, local, costo 0): el auditor descarga «En preparación» sin texto del borrador; aprobar por la pantalla genera las respuestas; un borrador nuevo no cambia lo que ve el auditor; el auditor no regenera ni escribe | — |
