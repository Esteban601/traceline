# Encargo: Perfeccionar la generación del suplemento NIIF S1/S2

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/suplemento-calidad` desde `dev/ajustes-sep26`; PR a `dev`, luego a `main` y despliegue según `CLAUDE.md` v1.8.
**Fecha de inicio:** 6 de octubre de 2026 · **Aprobado por:** Manuel.
**Referencia:** especificación §3 (generador), §3.3 (captura sugerida), Anexo A (mapeo de 40 bloques); `lib/suplemento/`, `lib/evidencias/`; demo financiero (`docs/suplemento-s1s2/demo/contenido.md`).

## 1. Objetivo

Que el suplemento que sale de la plataforma sea un documento que un consultor de IRStrat entregaría con pocos cambios: solo con lo que la norma exige salvo que la emisora quiera más, redactado con todo lo que la emisora ya cargó (capturas, evidencias y adjuntos del Perfil), coherente de principio a fin, y con trazabilidad de cada edición.

## 2. Alcance

### 2.1 Bloques normativos y editoriales

- **Clasificación de los 40 bloques** en dos clases: *normativo* (exigido por un párrafo de NIIF S1 o S2, citado en el Anexo A) y *editorial* (carta o mensaje de la dirección, historia de la emisora, "acerca de este informe", hitos, glosario, cualquier bloque sin párrafo que lo exija). La clasificación la propone Claude Code en el paso 0 y la revisa Esteban con Manuel; queda en el Anexo A con el párrafo de respaldo de cada normativo.
- **Selección al generar**: la pantalla de generación muestra los bloques editoriales como opcionales (apagados por defecto) y los normativos fijos; la selección se guarda en el documento. Un bloque editorial apagado no se genera, no aparece en el índice ni en el Word, y no cuenta para el semáforo de completitud ni para los pendientes.
- Los bloques que la norma vuelve no aplicables por alivios (C4, E5) siguen la lógica actual.

### 2.2 Más contenido desde los archivos

- **Adjuntos del Perfil del emisor** (organigrama, políticas, código de ética, actas, estatutos) se leen con la misma extracción que las evidencias (`evidencias_contenido` o tabla hermana) y entran como contexto en los bloques de gobernanza, estrategia y gestión de riesgos, citados por archivo y página.
- **Evidencias de solicitudes narrativas**: el generador usa el contenido extraído completo (no solo el extracto confirmado) como contexto del bloque que corresponde, y cita la fuente; el extracto confirmado sigue siendo lo único que puede afirmar como hecho; el resto del contenido puede usarse para contexto y redacción, nunca para cifras.
- **Regla de cifras** sin cambios: toda cifra sale de capturas confirmadas; el validador lo impone.
- **Pendientes más útiles**: cuando falta información, el marcador `[Pendiente: …]` dice qué documento concreto la cubriría, con la misma lógica de "documento sugerido" de la captura sugerida.

### 2.3 Calidad del documento

- **Pasada de coherencia** al final de la generación: terminología uniforme (denominación, nombres de comités, unidades), ausencia de repeticiones entre bloques, referencias cruzadas correctas ("como se describe en la sección …"), y que ningún bloque anuncie contenido que termina en pendiente. Sale como lista de observaciones para el revisor, no como edición automática.
- **Rúbrica de calidad** (10 criterios: fidelidad a la fuente, cobertura del requisito, voz del emisor, claridad, extensión, coherencia, trazabilidad, pendientes bien formulados, tablas correctas, sin vocabulario de plataforma) aplicada al demo antes y después del encargo, por un consultor de IRStrat; el encargo termina cuando la calificación "después" sea aceptable para Manuel.
- **Word**: índice con los bloques seleccionados, numeración de secciones, encabezados y pies con denominación y ejercicio, tablas con formato consistente, y una página de "Cómo leer este suplemento" opcional (editorial).

### 2.4 Trazabilidad (A6 completo)

- Historial de versiones por bloque: cada regeneración y cada edición manual queda guardada con autor, fecha y texto; se puede ver el diff y restaurar.
- Confirmación antes de regenerar un bloque editado a mano ("se perderá la edición de X del día Y; se conserva en el historial").
- El Word aprobado registra la versión de cada bloque que lo compone.

No incluye:
- Inglés (A7): encargo aparte, después.
- Años subsecuentes (A9) ni pre-carga de riesgos (A10).
- PDF con diseño (Fase B).
- Cambios al catálogo NIIF.

## 3. Definición de terminado

- Anexo A con la clasificación normativo/editorial y el párrafo de respaldo de cada normativo, aprobada por Manuel.
- Documento del demo generado solo con bloques normativos: índice, Word y semáforo correctos; con todos los editoriales encendidos: igual.
- Adjuntos del Perfil del demo leídos y citados en al menos tres bloques de gobernanza/estrategia; e2e de aislamiento: los adjuntos de una emisora no aparecen en el documento de otra.
- Validador de cifras en verde con el contenido ampliado como contexto.
- Pasada de coherencia probada con un documento al que se le introducen tres incoherencias deliberadas; las detecta.
- Rúbrica aplicada al demo antes y después, con las dos calificaciones en §7.
- Historial de versiones y confirmación probados por e2e; el auditor ve el historial y no edita.
- Costo por documento medido antes y después (hoy ~$9 en Heroku); si sube más del 50 %, se justifica en §7.
- `tsc`, `eslint`, `verify:export`, build; especificación al día; despliegue con registro en §10.

## 4. Pasos y paradas

0. Resumen de una página con la clasificación propuesta de los 40 bloques (tabla: bloque, clase, párrafo NIIF o motivo editorial), cómo entran hoy los adjuntos del Perfil al generador (si entran), y qué cambia en el esquema. Parada: Esteban y Manuel aprueban la clasificación.
1. Bloques opcionales: selección, generación, índice, Word, semáforo. Parada: demo generado solo-normativo.
2. Lectura de adjuntos del Perfil y contenido ampliado como contexto; validador. Parada: tres bloques con citas a adjuntos.
3. Pasada de coherencia y pendientes con documento sugerido. Parada: lista de observaciones del demo.
4. Historial de versiones y confirmación (A6). Parada: revisión de pantalla.
5. Rúbrica antes/después con un consultor; ajustes de prompt que salgan de ahí. Parada: calificaciones.
6. PR a `dev`, PR a `main`, despliegue.

## 5. Riesgos

- Ampliar el contexto encarece cada bloque; el tope por emisora y la caché del prompt (la capa estable crece y puede volver a cachearse) lo controlan.
- Los adjuntos del Perfil pueden ser largos (estatutos de 80 páginas): límite de páginas y selección de las partes relevantes por el modelo antes de redactar.
- La clasificación normativo/editorial es una lectura de la norma: se cita el párrafo para que sea discutible, no una opinión.

## 6. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-10-06 | Manuel pide perfeccionar el suplemento: bloques no normativos opcionales y más contenido desde los archivos | Encargo escrito; inglés queda para después |
| 2026-10-06 | **Paso 0** (resumen en el chat). Clasificación propuesta: 32 normativos con su párrafo de respaldo y 8 editoriales. Los adjuntos del Perfil no entran hoy al generador: un bloque del Perfil sin texto y con archivo queda `pendiente_adjunto`. Las evidencias sí entran como contexto (8,000 caracteres por evidencia y 30,000 por bloque) y nunca como fuente de cifras. Esquema y prompt propuestos. Hallazgos: el Anexo A tenía los códigos anteriores a la corrección del catálogo, y la regeneración no protege las ediciones a mano (A6) | **Clasificación decidida por Esteban y el asesor, por delegación de Manuel, el 6 de octubre de 2026,** con tres ajustes: (1) dos subclases de editorial: **recomendado** (encendido por defecto: 7 materialidad y 18 organigrama) y **opcional** (apagado por defecto: 1, 11, 12, 14, 19 y 20); (2) el 24 se queda, y su fusión con el 21 y el 25 queda como deuda de estructura; (3) los pendientes llevan el documento sugerido dentro de «qué falta», sin cambiar el formato de CLAUDE.md §5. Si Manuel cambia los casos 2, 7 o 24, se ajusta en `bloques.ts` sin tocar el mecanismo. Esquema y prompt como se propusieron |
| 2026-10-06 | **Paso 1 · bloques opcionales.** `bloques.ts` con la clase y el respaldo de los 40 bloques; el 34 sin `NIIF S2 30`. Migración `20261006140000`: `editoriales_incluidos` y estado `no_seleccionado`, aplicada en local y en dev (69 de 69, barrera 90). La generación guarda la selección y deja los editoriales no elegidos en `no_seleccionado` sin tocar su texto; el bloque no los reclama ni los genera. El índice del prompt (`calidad-v1-2026-10-06`), el Word con su índice, la revisión, la aprobación y el semáforo trabajan solo con los seleccionados. La pantalla del generador tiene una casilla por editorial, con los recomendados marcados. Especificación v0.25: Anexo A con la clasificación. **Hallazgo corregido** (`206b0f8`): la llave de Anthropic de dev devolvía 401 y, con cualquier error de la API, el bloque se quedaba en `generando` hasta el corte de tres minutos, con costo 0 y sin rastro en el log. Ahora pasa a `error` en el momento, con el motivo saneado y una línea en el log; el e2e del generador lo prueba con una llave inválida (error en 1.1 s, costo 0). **Demo en dev** (`scripts/suplemento/generar-demo.mjs`, reporte de Empresa Demo): **solo-normativo**: 31 bloques en borrador, 1 que no aplica por régimen y 8 no seleccionados; 26 páginas, $6.54, 7.2 min, sin fallos; ningún título editorial en el Word. **Con todos los editoriales**: 39 en borrador y 1 que no aplica; 32 páginas, $7.70, 8.7 min, sin fallos. Gasto total de los dos demos: $14.24. `tsc`, `eslint`, `verify:export` y build en verde | **Decisiones que tomé:** (1) un editorial no seleccionado conserva su fila y su texto, en lugar de borrarse; (2) sin `NIIF S2 30` en el 34, la declaración del demo «no se acoge a la exención» deja de salir en el documento; ningún párrafo la exige; (3) el semáforo se cuenta en la pantalla sobre lo seleccionado, en lugar de mover la evaluación de completitud |
