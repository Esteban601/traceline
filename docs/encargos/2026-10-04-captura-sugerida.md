# Encargo: Lectura de evidencias y captura sugerida (A5b ampliado)

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/captura-sugerida` desde `dev/ajustes-sep26`; PR a `dev/ajustes-sep26` revisado con el asesor.
**Fecha de inicio:** 4 de octubre de 2026 · **Aprobado por:** Manuel, 4 de octubre de 2026.
**Referencia:** especificación §3.2 (adjuntos como insumo), `CLAUDE.md` v1.6, encargo del rol auditor (barrera de escritura: toda tabla nueva llama a `fn_aplicar_barrera_auditor()`).

## 1. Objetivo

Que la plataforma lea los archivos de sustento que se cargan a una solicitud (Excel, PDF, Word e imágenes) y proponga, con su fuente exacta, lo que esa solicitud necesita: una cifra con unidad y periodo si la solicitud es numérica, o un extracto si es de texto. Una persona confirma, corrige o rechaza la sugerencia; solo lo confirmado pasa al Excel de taxonomía y al generador del suplemento. Capturar deja de ser teclear y pasa a ser confirmar, sin que ninguna cifra llegue al informe sin que alguien responda por ella.

El contenido extraído de las evidencias queda almacenado y disponible para el generador del suplemento (A5b original), que hoy solo lee capturas y textos del Perfil.

## 2. Alcance

Incluye:
- **Extracción de contenido** al cargar una evidencia (nueva o nueva versión), en segundo plano:
  - Excel (`.xlsx`, `.xls`, `.csv`): hojas, celdas con valor, encabezados detectados, nombres de hoja y referencias de celda.
  - PDF con texto: texto por página con número de página.
  - PDF escaneado e imágenes (`.png`, `.jpg`, `.jpeg`, `.heic`/`.heif` convertidos, `.webp`): lectura por visión del modelo, texto por página o imagen.
  - Word (`.docx`): texto por párrafo y tablas.
  - Almacenamiento en una tabla nueva de contenido extraído, ligada a la evidencia y a su versión, con tipo, texto estructurado, conteo de páginas u hojas, tokens, modelo, costo y estado (pendiente / extraído / error / no soportado).
- **Sugerencia numérica** para solicitudes cuyo datapoint espera un valor: cifra, unidad, periodo, fuente exacta (`hoja!celda`, `página N`, `imagen`), confianza y, cuando haya ambigüedad, hasta tres candidatos ordenados. El prompt recibe título y descripción de la solicitud, los códigos de la taxonomía que cubre, la unidad esperada y el periodo del reporte.
- **Sugerencia de texto** para solicitudes narrativas (política, descripción, proceso): extracto fiel de hasta 150 palabras con la cita de dónde viene, más una línea de qué cubre y qué no cubre del requisito.
- **Tabla de sugerencias**: solicitud, evidencia y versión, tipo (numérica / texto), valor o extracto, unidad, periodo, fuente, candidatos alternos, confianza, modelo, costo, estado (sugerida / confirmada / corregida / rechazada / obsoleta), decidido por y cuándo, valor final si fue corregida.
- **Pantalla**: en el detalle de la solicitud, bloque "Valor sugerido" (o "Extracto sugerido") con la fuente como enlace que abre la evidencia en la página o hoja indicada; botones Confirmar, Corregir (abre el campo con el valor precargado) y Rechazar (con motivo opcional). Lo confirmado o corregido crea la captura exactamente como hoy la crea una captura manual, con la marca de origen "sugerida por la plataforma".
- **Quién decide**: los mismos roles que hoy pueden capturar (responsable de área, jefe de área, admin del cliente, staff). El auditor ve sugerencias y decisiones, no decide (la barrera lo garantiza en base de datos).
- **Bitácora**: eventos de sugerencia generada, confirmada, corregida y rechazada, con el usuario.
- **Excel de taxonomía y generador**: consumen solo capturas confirmadas; una sugerencia sin decidir no aparece en ningún entregable.
- **Reprocesamiento**: al cargar una nueva versión de la evidencia, las sugerencias anteriores pasan a obsoletas y se generan nuevas; las decisiones previas se conservan como historial.
- **Costos y límites**: Sonnet 5 para extracción y sugerencia; Fable 5.1 solo como segunda opinión cuando la confianza sea baja y el datapoint sea numérico. Límite de 25 MB y 60 páginas por archivo (más allá, se extraen las primeras 60 y se avisa). Costo registrado por archivo y por tenant; `generaciones_mes_max` del tenant aplica también aquí.
- **Idiomas**: evidencias en español e inglés.

No incluye:
- Autocompletar el Excel de taxonomía sin confirmación humana. Nunca.
- Enviar cuestionarios ni leer correo.
- Cambios al generador más allá de que pueda leer el contenido extraído como insumo adicional (eso sí entra: el generador cita evidencias por nombre y página en `fuentes_usadas`).
- Despliegue a staging (va con el merge del generador a producción).

## 3. Decisiones de diseño

- El contenido extraído se guarda una vez por versión de evidencia y lo reutilizan la sugerencia y el generador; no se vuelve a leer el archivo en cada uso.
- La fuente es obligatoria: una sugerencia sin fuente localizable no se muestra; se registra como fallida.
- Ante varios candidatos razonables (por ejemplo, 376,300 kWh de electricidad y 549.8 MWh de energía total en el mismo archivo), la pantalla muestra los candidatos con su fuente y el usuario elige; la plataforma no decide por él.
- Unidades: la sugerencia conserva la unidad del documento y, si el datapoint espera otra, propone la conversión con el factor usado y lo dice; la conversión también se confirma.
- Periodo: si el documento tiene varios años, la sugerencia prefiere el periodo del reporte y marca los demás como candidatos.
- Las imágenes y los PDF escaneados se leen con visión; la confianza de esas lecturas se muestra más baja por defecto y siempre va con la imagen de la página como fuente.
- Privacidad: el contenido de las evidencias viaja a la API de Anthropic para su lectura. Anthropic ya figura como sub-encargado en la respuesta de seguridad a LEP; debe figurar en el contrato de encargado de cada cliente que use esta función. Un tenant puede tener la función apagada (`lectura_evidencias_activa`, por defecto verdadero en demos, falso en clientes reales hasta que su contrato lo cubra).

## 4. Definición de terminado

- Migraciones aditivas (tablas de contenido extraído y de sugerencias, columna `lectura_evidencias_activa`), cada una terminando con `fn_aplicar_barrera_auditor()`; aplicadas dos veces en local y en dev sin cambios.
- Conjunto de prueba: 24 evidencias del demo y archivos de prueba creados para el encargo (8 Excel, 8 PDF de los cuales 3 escaneados, 4 Word, 4 imágenes), cada una con el valor correcto conocido y su fuente. Resultado exigido: la sugerencia principal o uno de los candidatos coincide con el valor correcto en al menos 22 de 24; la fuente citada es correcta en todas las que acierta; cero sugerencias sin fuente.
- Prueba de que una sugerencia no confirmada no aparece en el Excel de taxonomía ni en un bloque generado del suplemento.
- Prueba de roles: el auditor ve y no decide (rechazo del servidor); un usuario de otra área no ve sugerencias de solicitudes que no son suyas.
- Prueba de nueva versión: las sugerencias anteriores pasan a obsoletas; las decisiones previas se conservan.
- Costo medido por archivo y por tipo, con la tabla de precios de `lib/suplemento/modelos.ts`; estimación por emisora de 37 solicitudes documentada en §7.
- `tsc`, `eslint`, `verify:export` en verde; consola limpia en las pantallas tocadas.
- Especificación actualizada (§3.2 y una sección nueva de captura sugerida) y `CLAUDE.md` si aparece una regla nueva.

## 5. Pasos y paradas

0. Resumen de una página: qué se entendió, cómo se hará, qué tablas y archivos se tocan, qué no, y la lectura de cómo funcionan hoy la carga de evidencias, las capturas de valor y la exportación a Excel. Parada.
1. Extracción y almacenamiento de contenido para los cuatro tipos, con el conjunto de prueba. Parada: muestra del contenido extraído de un archivo de cada tipo.
2. Sugerencia numérica con fuente y candidatos, sin pantalla (API y pruebas). Parada: resultados sobre el conjunto de prueba.
3. Sugerencia de texto. Parada.
4. Pantalla en el detalle de la solicitud, decisiones, bitácora, marca de origen en la captura. Parada: Esteban revisa con las cuatro cuentas.
5. Generador leyendo el contenido extraído como insumo y citándolo. Parada: un bloque del demo regenerado con citas a evidencias.
6. Costos, límites, bandera por tenant, especificación. PR a `dev/ajustes-sep26`.

## 6. Riesgos y notas

- La exactitud depende de la calidad de las evidencias; el conjunto de prueba debe incluir archivos feos (hojas sin encabezado, PDF con tablas rotas, fotos torcidas).
- Los HEIC de iPhone requieren conversión en servidor; si la librería no está disponible en Heroku, se pide al usuario que suba JPG y se registra.
- Las lecturas por visión son las más caras; el límite de páginas y el modelo barato controlan el costo.
- Para clientes reales, la bandera por tenant empieza apagada hasta que su contrato de encargado nombre a Anthropic.

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-10-04 | Manuel aprobó la fase; Esteban definió el alcance | Excel, PDF, Word e imágenes; solicitudes numéricas y de texto; confirmación humana obligatoria |
| 2026-10-04 | Paso 0 aprobado | Subida directa a storage con URL firmada (límite de 25 MB en la firma y en la fila); `claude-sonnet-5-5` para lectura y sugerencia, y Fable 5.1 solo como segunda opinión numérica; contador propio `tenants.lecturas_mes_max` (500), con `generaciones_mes_max` como deuda en la especificación; los extractos de texto confirmados viven en `sugerencias_captura`; las cifras del generador salen solo de capturas confirmadas (prompt y validador); quien puede capturar, puede decidir (coordinador incluido; auditor rechazado explícitamente); unpdf, mammoth, sharp, heic-convert y pdf-lib en dependencies; `.xls` binario como «no soportado» |
| 2026-10-04 | **Paso 1: extracción y almacenamiento.** Migración `20261004120000_evidencias_contenido` (tabla, bandera y tope por tenant, encolado por trigger) aplicada dos veces en local (idempotente, barrera 84) y en dev (54 de 54). Conjunto de prueba de 24 evidencias y un control, generado con valores conocidos. Prueba por el camino de la aplicación: **23 de 24** con el valor en su fuente; control `.xls` en «no soportado» con su mensaje. Costo de lectura del conjunto: **$0.0390** (Excel, Word y PDF de texto, $0; PDF escaneado, unos $0.0067 por archivo; imagen, unos $0.0047). La cola procesó 50 lecturas en 18 s | El fallo es p02 (tabla rota): pdf.js entrega la cifra partida como «8,93 0.2», y reconstruirla queda para la sugerencia (Paso 2). La subida con URL firmada queda pendiente para el Paso 4, porque toca la pantalla de carga. `verify:export` falla en local también sobre `dev` sin estos cambios (desajuste previo entre el seed local y lo que espera el script); se anota y no se toca en este encargo |
