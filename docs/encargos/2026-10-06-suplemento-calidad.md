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
