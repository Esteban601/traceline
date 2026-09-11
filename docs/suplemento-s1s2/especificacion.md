# TRACELINE · Fase A · Generador de Suplemento NIIF S1 / S2

Especificación para revisión interna. **Versión 0.4** · 10 de septiembre de 2026.
Referencia de resultado esperado: Informe Anual de Sostenibilidad NIIF S1 y S2 2025 de CADU (41 págs.).

**Cambios respecto a 0.3** (tras construir el semáforo de A3b y cruzarlo con los datos reales):
- Los bloques 6, 10, 22, 23, 27 y 28 dejan de citar `cuestionarios_respuestas`: no existe hoja narrativa que los
  alimente. Su fuente son los datapoints de sus solicitudes, resueltos leyendo las evidencias documentales
  (§3.2 b bis). Anexo A corregido.

**Cambios respecto a 0.1** (tras revisión contra el código):
- El Perfil del emisor tiene tabla propia por tenant; `cuestionarios_respuestas` no sirve (CHECK de hojas, una respuesta por pregunta, cascada al reporte).
- Bloques 4, 5 y 7 pasan a Plantilla + Perfil: sus párrafos NIIF no existen en el catálogo de 91 datapoints. Bloque 10 usa S2 16(a)–(d). Bloque 35 corrige incisos.
- El mapeo bloque → datapoint es una tabla explícita de códigos exactos; los códigos del catálogo tienen espaciado irregular y no se buscan por igualdad de cadena.
- Caché de prompt, salida estructurada con esquema y streaming forman parte del diseño, no de la optimización.
- Aprobación bloqueada mientras queden pendientes.
- Incorporadas las cinco decisiones de negocio (§8): perfil capturado por cliente y por IRStrat; severidad configurable por tenant; aprobación por cualquiera de los dos; sin tope de presupuesto por documento; segundo año de adopción planeado desde ahora.
- Los 40 bloques resultan de expandir los ~35 apartados de CADU (dos bloques se separan en tabla + prosa; se añaden 29(f)–(g) que CADU omite).

---

## 1. Qué entrega la Fase A

| Entrega | Incluido | Fuera de Fase A |
|---|---|---|
| Botón "Excel de taxonomía" (renombrado) | Sí | — |
| Menú "Taxonomía S1 / S2" (renombrado) | Sí | — |
| Botón "Suplemento S1 y S2" | Sí | — |
| Verificación de completitud antes de generar (semáforo por bloque) | Sí | — |
| Generación del contenido por bloques con la API de Claude | Sí | — |
| Trazabilidad: cada bloque guarda de qué solicitudes, capturas y registros salió | Sí | — |
| Revisión y edición por bloque, regeneración individual, aprobación | Sí | — |
| Exportación a Word (.docx) con estilos, tablas y anexo de trazabilidad | Sí | — |
| Versión en inglés (traducción del texto aprobado, con glosario) | Sí | — |
| Registro de quién generó, cuándo, con qué datos y a qué costo | Sí | — |
| Estructura para primer año de adopción **y** años subsecuentes (§3.1) | Sí (estructura); año 2 se prueba en A9 | — |
| PDF con diseño (plantilla con logo, paleta y fotos del tenant) | — | Fase B |
| Editables InDesign / otros | — | Fase B+ |
| Infografías generadas | — | Fase B (gráficas desde datos sí; ilustración no) |
| Menús GRI y SASB, Informe Anual GRI/SASB | — | Fase C |

Regla no negociable del generador: **cero dato inventado**. Donde falte información, el texto dice
`[Pendiente: <solicitud o campo>]`. Nunca prosa plausible. Un documento con pendientes no se puede aprobar.

---

## 2. Lo que el documento de CADU revela sobre las fuentes

De los ~35 apartados del suplemento de CADU (40 bloques tras expandir):

- **≈ 50 %** sale de datos que TRACELINE ya recaba (datapoints, capturas, registros de clima, objetivos, cuestionarios).
- **≈ 15 %** sale de datos que TRACELINE recaba pero le falta un campo (§5: severidad de riesgos).
- **≈ 35 %** es información institucional o de configuración que hoy no existe en la plataforma: carta de la Dirección, historia, modelo de negocio y cadena de valor, organigrama, proceso de materialidad, alivios adoptados, horizontes temporales, datos de la entidad que informa.

Ese 35 % se resuelve con el **Perfil del emisor** (§4). Sin él, el generador marca pendiente. No redacta.

---

## 3. Los bloques

Tipos de generación:

- **D→T** (datos a texto): Claude redacta a partir de datos estructurados. Solo puede usar lo que recibe.
- **T→E** (texto institucional a edición): el emisor escribe, Claude corrige estilo y terminología y traduce. No agrega hechos.
- **Tabla**: se arma directo desde datos, sin IA. Claude solo redacta la frase introductoria.
- **Plantilla**: texto fijo con variables (entidad, ejercicio, alivios), sin IA.

Los códigos de la columna "Datapoints" se listan **tal como están en `datapoints_taxonomia.codigo`** en un archivo
de mapeo (`lib/suplemento/bloques.ts`), uno por uno. La columna aquí es indicativa; el mapeo definitivo se
construye en A2 cruzando contra los 91 códigos reales y se anexa a esta especificación.

### Sección I · Introducción

| # | Bloque | Fuente en TRACELINE | Tipo | Si falta |
|---|---|---|---|---|
| 1 | Carta de la Dirección | Perfil: texto, firmante, cargo | T→E | Bloque omitido con aviso |
| 2 | Presentación del informe (adopción, CNBV) | `reportes.ejercicio`, tenant, `reportes.anio_adopcion` | Plantilla | — |
| 3 | Bases de preparación: marco y alivios transitorios | `reportes.alivios` (E4, E5, C3, C4, C5) | Plantilla condicional | Pendiente |
| 4 | Entidad que informa, periodo y conectividad | Perfil: denominación, entidad que informa, perímetro; `reportes.ejercicio`; `solicitudes.nota_alcance` | Plantilla + T→E | Pendiente |
| 5 | Conexiones y referencias cruzadas | Texto fijo | Plantilla | — |
| 6 | Juicios, supuestos e incertidumbres (tabla) | Datapoint S1 74; `capturas_valor.justificacion` | D→T + Tabla | Fila pendiente |
| 7 | Materialidad: contexto y proceso | Perfil: texto del proceso de materialidad | T→E | Pendiente |
| 8 | Horizontes temporales (tabla) | Perfil: 3 horizontes con definición y justificación | Tabla | Pendiente |
| 9 | Evaluación y priorización de riesgos | `registros_clima` con **severidad** (§5) y matriz del tenant | D→T + Tabla | Sin severidad: solo conteo por tipo |
| 10 | Resumen de efectos financieros actuales y previstos | Datapoints S2 16(a)–(d); capturas; cuestionario | D→T | Pendiente |
| 11 | Nuestra historia (línea de tiempo) | Perfil: hitos corporativos | Tabla + T→E | Bloque omitido |
| 12 | Modelo de negocio y cadena de valor | Perfil: texto + etapas | T→E | Bloque omitido |
| 13 | Efectos sobre el modelo de negocio y la cadena de valor | Datapoints S2 13; `registros_clima` | D→T | Pendiente |

### Sección II · Gobernanza

| # | Bloque | Fuente | Tipo | Si falta |
|---|---|---|---|---|
| 14 | Introducción a la sección | Texto fijo | Plantilla | — |
| 15 | Roles y responsabilidades del órgano de gobierno | Datapoints S2 6(a)(i)–(ii) | D→T | Pendiente |
| 16 | Supervisión de la estrategia, objetivos y remuneración | Datapoints S2 6(a)(iii)–(v) | D→T | Pendiente |
| 17 | Papel de la gerencia y controles | Datapoints S2 6(b) | D→T | Pendiente |
| 18 | Estructura de gobierno corporativo + organigrama | Perfil: texto + imagen | T→E + imagen | Bloque sin imagen |

### Sección III · Nuestra estrategia

| # | Bloque | Fuente | Tipo | Si falta |
|---|---|---|---|---|
| 19 | Trayectoria en sostenibilidad y clima (hitos) | Perfil: hitos de sostenibilidad | Tabla + T→E | Bloque omitido |
| 20 | Contexto estratégico | Reutiliza #8 y #13 | D→T | — |
| 21 | Riesgos climáticos prioritarios (tabla + profundización) | `registros_clima` tipo riesgo: descripción, horizontes, **severidad**; datapoints S2 10(a)–(d) | D→T + Tabla | Pendiente por registro |
| 22 | Cambios en modelo de negocio y asignación de recursos | Datapoints S2 14(a)(i)–(ii); cuestionario | D→T | Pendiente |
| 23 | Esfuerzos directos e indirectos de reducción y adaptación | Datapoints S2 14(a)(iii); cuestionario | D→T | Pendiente |
| 24 | Oportunidades y cómo prevé alcanzar objetivos | `registros_clima` tipo oportunidad; `objetivos` | D→T | Pendiente |
| 25 | Recursos asignados y progreso de planes | Datapoints S2 14(a)(iv)–(v) | D→T | Pendiente |
| 26 | Resiliencia de la estrategia y análisis de escenarios | `cuestionarios_respuestas` hojas S2 22(b)(i) y (ii) | D→T | Pendiente por pregunta |

### Sección IV · Riesgos

| # | Bloque | Fuente | Tipo | Si falta |
|---|---|---|---|---|
| 27 | Gestión y mitigación de riesgos y oportunidades | Datapoints S2 25(a)–(c) | D→T | Pendiente |
| 28 | Plan de transición | Datapoints S2 14(a)(iv); cuestionario | D→T | Pendiente |

### Sección V · Métricas y objetivos

| # | Bloque | Fuente | Tipo | Si falta |
|---|---|---|---|---|
| 29 | Emisiones GEI Alcance 1 y 2 (+ Alcance 3 según régimen) | `capturas_valor` rubros GEI; `reportes.alivios` (C4) | Tabla + D→T | Celda pendiente |
| 30 | Método de medición, datos de entrada y C5 | Datapoints S2 29(a)(ii)–(iii) | D→T | Pendiente |
| 31 | Razones del enfoque y desagregación | Datapoint S2 29(a)(iv) | D→T | Pendiente |
| 32 | Alcance 2 por ubicación e instrumentos contractuales | Datapoint S2 29(a)(v) | D→T | Pendiente |
| 33 | Emisiones financiadas | Datapoint S2 29(a)(vi) | D→T / N-A | Pendiente |
| 34 | Riesgos de transición: concentración, exposición y capital | Datapoints S2 29(b); `registros_clima_valores` | Tabla + D→T | Fila pendiente |
| 35 | Riesgos físicos: exposición y gráfica | Datapoints S2 29(c) incisos existentes en catálogo; `registros_clima_valores` | Tabla + gráfica + D→T | Fila pendiente |
| 36 | Oportunidades: alineación y capital | Datapoints S2 29(d)–(e); `registros_clima_valores` | Tabla + D→T | Fila pendiente |
| 37 | Precio interno del carbono y remuneración vinculada | Datapoints S2 29(f)–(g) | D→T | Pendiente |
| 38 | Objetivos climáticos (ocho atributos por objetivo) | `objetivos` | Tabla | Pendiente por atributo |
| 39 | Enfoque para establecer y revisar objetivos; resultados | `objetivos_detalle` | Tabla + D→T | Pendiente |
| 40 | Objetivo de emisiones GEI | `objetivos_detalle`; cuestionario S2 36(e) | Tabla + D→T | Pendiente |

### 3.1 Régimen por ejercicio

Cada bloque tiene una variante por **régimen**, resuelto desde `reportes.anio_adopcion` y `reportes.alivios`:

| Régimen | Cuándo | Qué cambia |
|---|---|---|
| **Primer año** (CADU 2025) | ejercicio = año de adopción | Bloque 3 enumera alivios adoptados; sin comparativos (C3); Alcance 3 omitido si C4; método distinto a GHG Protocol si C5; solo clima si E5; S1 en lo pertinente |
| **Años subsecuentes** | ejercicio > año de adopción | Bloque 3 se reduce a marco regulatorio; bloques 29, 34–36, 38–40 incorporan columna comparativa (`anio_offset = 1`, ya soportado por el ensamblador); Alcance 3 obligatorio con categorías (bloque 29 se expande); si E5 ya no aplica, entran los datapoints S1 de sostenibilidad general (bloques 6, 7 y 10 se amplían) |

La Fase A implementa ambas variantes en el mapeo y la plantilla; la prueba de años subsecuentes (A9) usa un
segundo reporte del tenant demo con datos del ejercicio anterior. Los bloques S1 puros que no apliquen se marcan
"no aplicable en este ejercicio", no se omiten en silencio.

---

### 3.2 Adjuntos como insumo

Cada sección del Perfil del emisor (§4) admite archivos de respaldo: PDF, DOCX, XLSX, PNG y JPG. En Fase A
(paso A3) **se guardan, se descargan y se quitan; el generador no los abre**. Lo que sigue es cómo se
convierten en insumo, y bajo qué reglas.

**(a) Alimentan a los bloques T→E en A5.** Un bloque T→E parte de texto que el emisor ya escribió; el adjunto
es de dónde sale ese texto cuando no está en el formulario. Dos tratamientos, según el archivo:

- **Texto ya redactado** (una carta, una descripción del modelo de negocio en un DOCX): se **normaliza y se
  traduce, sin resumir**. El emisor escribió lo que quería decir; acortarlo es editorializar sobre un texto
  que va firmado.
- **Documentos largos** (una política de riesgos de 40 páginas, un acta): se **derivan** con **cita de adjunto
  y página**. La cita no es cortesía: es lo que permite que un revisor abra el archivo y compruebe la frase.

En los dos casos rige la regla del generador: **nada que no esté en el archivo**. Un adjunto no autoriza a
inferir; si el dato no está, el bloque lleva su `[Pendiente: …]` como si no hubiera adjunto.

**(b) Paso nuevo A10 — pre-carga asistida.** Después de A8. Los emisores llegan con documentos de análisis de
riesgos y estudios de materialidad cuya estructura **varía por consultor**: cada despacho usa su plantilla, sus
nombres de columna y su escala. Transcribirlos a mano es el trabajo que hoy hace que estos campos se queden
vacíos.

A10 extrae de esos documentos hacia un **esquema fijo** — `nombre`, `tipo`, `horizonte`, `probabilidad`,
`impacto`, `descripcion` — y devuelve, por cada campo, la **página de origen** y un **nivel de confianza**. Con
eso propone registros de clima y campos del Perfil, y **no inserta nada**: el resultado se revisa **fila por
fila** y se acepta o se descarta una a una. La revisión humana no es una salvaguarda opcional del paso; es el
paso.

**(b bis) La misma tubería sirve para las evidencias de las solicitudes cualitativas.** Una solicitud
cualitativa no entrega una cifra: entrega un documento —una política, un acta, un procedimiento— y su requisito
NIIF se resuelve **leyendo esa evidencia**, no consultando una tabla. Por eso los bloques 6, 10, 22, 23, 27 y 28
**no citan `cuestionarios_respuestas`**: no hay hoja narrativa que los alimente, y su fuente son los datapoints
que sus solicitudes cubren. El generador abre esas evidencias con el mismo tratamiento de (a) —texto redactado
se normaliza sin resumir; documento largo se deriva con cita de archivo y página— y bajo la misma regla: nada
que no esté en el archivo. Las únicas hojas de cuestionario que existen son las tres de la plantilla oficial
(`S2 22(b)(i)`, `S2 22(b)(ii)`, `S2 36(e)`), y alimentan solo a los bloques 26 y 40.

**(c) Requisito técnico.** La extracción necesita texto:

- **DOCX y XLSX se convierten a texto en el servidor.** No hay forma de mandarlos al modelo tal cual.
- **PDF se manda nativo**, que conserva la paginación — y sin paginación no hay cita de página, que es el
  requisito de (a) y de (b).
- **Caché obligatorio en la porción del archivo.** Un estudio de materialidad son decenas de miles de tokens y
  se consulta varias veces: una por bloque que lo cite, más cada reintento de la revisión fila por fila. Sin
  caché, el mismo documento se paga entero cada vez.

---

## 4. Perfil del emisor (nuevo)

Se captura una vez por emisora y persiste entre ejercicios. Lo que cambia por ejercicio vive en `reportes`.

**Tabla `perfil_emisor`** (1:1 con `tenants`):

| Campo | Tipo | Alimenta |
|---|---|---|
| denominacion_formal, nombre_corto, forma_de_referencia ("la Compañía", "la Emisora", "el Grupo", …) | text | todos |
| entidad_que_informa, perimetro (texto) | text | 4 |
| carta_texto, carta_firmante, carta_cargo | text | 1 |
| proceso_materialidad | text | 7 |
| horizontes | jsonb: [{plazo, definicion, justificacion}] × 3 | 8, 20 |
| hitos_corporativos | jsonb: [{anio, texto}] | 11 |
| hitos_sostenibilidad | jsonb: [{anio, texto}] | 19 |
| modelo_negocio | text | 12 |
| cadena_valor | jsonb: [{etapa, descripcion}] | 12 |
| gobierno_texto | text | 18 |
| organigrama_path | text (ruta en bucket `documentos`) | 18 |
| matriz_riesgos | jsonb: {escala_max, niveles: [{nombre, min, max}]} | 9, 21 |
| actualizado_por, actualizado_en | uuid, timestamptz | auditoría |

**Columnas nuevas en `reportes`**: `anio_adopcion` (int), `alivios` (jsonb: {E4, E5, C3, C4, C5} booleanos).

**Adjuntos por sección** (`perfil_emisor_adjuntos`): cada una de las nueve secciones admite uno o más archivos
(PDF, DOCX, XLSX, PNG, JPG, hasta 20 MB) en `documentos/{tenant_id}/perfil/{seccion}/`. En Fase A solo se
guardan y se descargan; su uso como insumo es §3.2.

**Quién captura**: el admin del cliente desde el portal y el staff de IRStrat desde el panel interno, sobre el
mismo formulario. Cada guardado registra quién y cuándo. Las listas (hitos, cadena de valor) se editan como
filas, no como JSON.

---

## 5. Cambios aditivos al esquema

| Cambio | Motivo | Migración |
|---|---|---|
| `registros_clima.probabilidad`, `.impacto`, `.severidad` (numéricos, nullable) y `.nivel` (text) | La priorización de CADU es probabilidad × impacto en escala 0–25 con cuatro niveles. La matriz varía por cliente, así que se guardan los tres números y el nivel se calcula contra `perfil_emisor.matriz_riesgos`; si el cliente solo entrega el puntaje, probabilidad e impacto quedan nulos | ADD COLUMN |
| `reportes.anio_adopcion`, `reportes.alivios` | Régimen por ejercicio (§3.1) | ADD COLUMN |
| Tabla `perfil_emisor` | §4 | CREATE TABLE + RLS por tenant |
| Tabla `documentos_generados` | Versiones, estado, idioma, auditoría, costo total | CREATE TABLE + RLS |
| Tabla `documentos_bloques` | Un renglón por bloque, versión e idioma: texto, estado, `fuentes` (ids), pendientes, tokens, costo, modelo, `prompt_version`, editado_por | CREATE TABLE + RLS |
| Bucket `documentos` (privado) | Word y organigrama, ruta `{tenant_id}/…` | Storage + políticas |
| `tenants.generaciones_mes_max` (int, default 10) | Salvaguarda contra uso accidental o abusivo del botón; no es tope de presupuesto | ADD COLUMN |

Todas aditivas. Nada de lo que hoy usan staging ni los 16 tenants cambia de forma.

---

## 6. Arquitectura

**Ensamblado de datos.** El export a Excel (`export-taxonomia/route.ts`, 967 líneas) mezcla dos cosas: la
resolución rubro → valor por reporte con tres causas de faltante, que es reutilizable, y el layout posicional
de las cuatro hojas de registros de clima, que es específico del Excel. La primera se extrae a
`lib/reporte/ensamblar.ts`; la segunda se queda en el route. Excel, Suplemento y (Fase B) PDF consumen el
mismo ensamblador. Prueba de A1: el Excel generado antes y después es idéntico **celda por celda** (valores y
notas) contra el arnés `verify:export` existente (104 asserts); no byte a byte, porque el paquete XLSX lleva
marcas de tiempo.

**Mapeo bloque → datapoints.** `lib/suplemento/bloques.ts`: por bloque, lista de códigos exactos del catálogo,
tablas y campos que lo alimentan, tipo, variante por régimen. Se valida en arranque que todo código listado
exista en `datapoints_taxonomia`; si no, el servidor lo reporta.

**Aislamiento.** El ensamblado corre en servidor con `service_role`; todas las consultas filtran por
`reporte_id` y se valida que el reporte pertenezca al tenant de la sesión antes de armar cualquier prompt.
Prueba obligatoria: generación simultánea con dos tenants y verificación de que ningún id cruza.

**Orquestación.** El router de Heroku corta a los 30 s. Cada bloque es `POST /api/suplemento/{documento}/bloque/{n}`;
el cliente encadena las llamadas con progreso y cada resultado se persiste al llegar. Cada llamada usa streaming
del SDK para no chocar con el límite en bloques largos. Si el navegador se cierra, lo generado queda.

**Prompt por bloque.** Diseñado para caché: primero lo estable (rol, reglas, glosario, preferencias del tenant,
texto de los requisitos NIIF del bloque) con marca de caché; después lo volátil (datos del bloque en JSON con
ids, ejemplo de estilo anonimizado, instrucción de extensión). Salida **estructurada con esquema**:
`{texto, fuentes_usadas[], pendientes[]}`. El servidor rechaza cualquier respuesta que cite un id que no se le
entregó.

**Modelo.** Por defecto el modelo de mayor capacidad disponible en la Consola; se compara con el intermedio en
A4 sobre los mismos bloques del tenant demo y se elige por calidad de redacción normativa. No hay tope de
presupuesto por documento (decisión §8.4), pero el costo se registra por bloque y por documento. Orden de
magnitud sin caché: 300 k tokens de entrada y 30 k de salida por suplemento en español; con caché del bloque
estable, sustancialmente menos.

**Word.** Librería `docx` en `dependencies`. Portada, índice, secciones, encabezados con referencia NIIF (según
preferencia del tenant), tablas, notas al pie con la fuente de cada cifra, anexo de trazabilidad
(bloque → solicitudes → evidencias). Marca de agua "BORRADOR GENERADO, PENDIENTE DE REVISIÓN" hasta la aprobación.

**Inglés.** Se traduce el texto **aprobado** en español, bloque a bloque, con el glosario ES↔EN como restricción.
No se generan en paralelo desde los datos.

**Dependencias nuevas.** SDK de Anthropic, `docx`. Variable `ANTHROPIC_API_KEY` en Heroku y `.env.local`, una llave
por ambiente.

---

## 7. Flujo de usuario

1. En Cobertura, junto a "Excel de taxonomía", el botón **"Suplemento S1 y S2"**. Visible para staff y admin del cliente.
2. Pantalla previa: **semáforo de 40 bloques**. Verde: datos completos. Amarillo: saldrá con pendientes (lista qué
   solicitud o campo del Perfil falta, con enlace). Gris: no aplicable en este régimen. Botón "Generar".
3. Generación con progreso bloque a bloque. Se puede salir; se retoma.
4. Vista de revisión: cada bloque con texto, fuentes (enlaces a solicitud y evidencia), "Regenerar" y edición en
   línea. Estados: *Borrador generado → En revisión → Aprobado*.
5. "Descargar Word" disponible desde Borrador, con marca de agua. **"Aprobar" bloqueado mientras exista al menos
   un `[Pendiente]`**; la pantalla lista cuáles.
6. Aprobación: puede hacerla el admin del cliente o el staff de IRStrat (decisión §8.3). Se registra quién.
7. "Generar versión en inglés" solo sobre un documento Aprobado.
8. Registro visible para staff: quién generó, quién aprobó, cuándo, versión, costo, modelo.

Preferencias del tenant (en `perfil_emisor`), una vez, editables: forma de referencia a la entidad; denominación
formal; idioma(s); encabezados con o sin referencia de párrafo; firmante de la carta.

---

## 8. Decisiones de negocio (tomadas el 10 de septiembre de 2026)

| # | Decisión | Resolución | Efecto en el diseño |
|---|---|---|---|
| 1 | Quién captura el Perfil del emisor | Cliente e IRStrat, ambos | Un formulario, dos accesos (portal y panel), auditoría de quién guardó |
| 2 | Severidad de riesgos | Varía por cliente según su propia matriz | Puntaje, probabilidad e impacto por registro; rangos y niveles configurables por tenant (`matriz_riesgos`) |
| 3 | Quién aprueba | Admin del cliente o IRStrat | Sin regla nueva de autorización; el rol admin_cliente ya entra al panel. Se registra quién aprobó |
| 4 | Presupuesto | Sin tope por documento | Se mantiene el límite de generaciones por mes como salvaguarda operativa, no económica. El límite de gasto vive en la Consola |
| 5 | Segundo año de adopción | Se planea desde ahora | Régimen por ejercicio en mapeo y plantilla (§3.1); prueba en A9 |

---

## 9. Orden de construcción

| Paso | Contenido | Dependencias |
|---|---|---|
| A1 | Renombres (botón, menú). Extraer `lib/reporte/ensamblar.ts` del export; el Excel lo consume; prueba celda por celda con `verify:export` | Ninguna |
| A2 | Migraciones aditivas (§5) en dev. Mapeo `lib/suplemento/bloques.ts` cruzado contra los 91 códigos reales, con validación en arranque. Anexar el mapeo a esta especificación | A1 |
| A3 | Formulario del Perfil del emisor (portal y panel) y captura de severidad en registros de clima. Semáforo de completitud, sin IA | A2 |
| A4 | SDK, un bloque de extremo a extremo (#29 GEI: tabla + texto) con caché y salida estructurada; comparación de modelos con datos del tenant demo | A3, crédito en Consola |
| A5 | Los 40 bloques en régimen primer año, orquestación, persistencia, vista de revisión, bloqueo de aprobación con pendientes | A4 |
| A6 | Word con estilos, marca de agua y anexo de trazabilidad | A5 |
| A7 | Glosario ES↔EN y versión en inglés | A6 |
| A8 | Límites por tenant, auditoría, prueba de aislamiento con dos tenants, app Heroku de dev para demo a Manuel | A7 |
| A9 | Régimen años subsecuentes: segundo reporte del tenant demo con ejercicio anterior, comparativos, Alcance 3 | A8 |
| A10 | Pre-carga asistida desde documentos de análisis de riesgos y estudios de materialidad: extracción a esquema fijo con página de origen y confianza por campo, y revisión fila por fila antes de insertar (§3.2b) | A8 |

Todo en `dev/ajustes-sep26` contra `traceline-dev`. Nada toca staging hasta que Manuel vea A8.

---

## Anexo A: mapeo definitivo (bloque → datapoints)

Generado en A2 cruzando `lib/suplemento/bloques.ts` contra los **91 códigos NIIF** de
`datapoints_taxonomia` en traceline-dev. Los códigos se resolvieron uno a uno y se emiten verbatim:
el catálogo tiene espaciado irregular (`NIIF S2 6 (a)(i)` lleva espacio, `NIIF S2 6(b)` no), así que un
código tecleado a mano no empata por igualdad de cadena.

**Resultado: 63 códigos citados por los 40 bloques, los 63 presentes en el catálogo.**
Cero faltantes, cero códigos en dos bloques. `validarMapeo()` lo vuelve a comprobar en arranque.

| # | Bloque | Tipo | Régimen | Datapoints | Tablas | Perfil |
|---|---|---|---|---|---|---|
| 1 | Carta de la Dirección | T→E | ambos | — | — | `carta_texto`, `carta_firmante`, `carta_cargo` |
| 2 | Presentación del informe (adopción, CNBV) | Plantilla | ambos | — | `reportes` | `denominacion_formal`, `nombre_corto` |
| 3 | Bases de preparación: marco y alivios transitorios | Plantilla | **varía** | — | `reportes` | — |
| 4 | Entidad que informa, periodo y conectividad | Plantilla + T→E | ambos | `NIIF S2 32` | `reportes`, `solicitudes` | `denominacion_formal`, `entidad_que_informa`, `perimetro` |
| 5 | Conexiones y referencias cruzadas | Plantilla | ambos | — | — | — |
| 6 | Juicios, supuestos e incertidumbres | D→T + Tabla | **varía** | `NIIF S1 74` | `capturas_valor` | — |
| 7 | Materialidad: contexto y proceso | T→E | **varía** | — | — | `proceso_materialidad` |
| 8 | Horizontes temporales | Tabla | ambos | — | — | `horizontes` |
| 9 | Evaluación y priorización de riesgos | D→T + Tabla | ambos | — | `registros_clima` | `matriz_riesgos` |
| 10 | Resumen de efectos financieros actuales y previstos | D→T | **varía** | `NIIF S2 16(a)`<br>`NIIF S2 16(b)`<br>`NIIF S2 16(c)(i)(ii)`<br>`NIIF S2 16(d)` | `capturas_valor` | — |
| 11 | Nuestra historia (línea de tiempo) | Tabla + T→E | ambos | — | — | `hitos_corporativos` |
| 12 | Modelo de negocio y cadena de valor | T→E | ambos | — | — | `modelo_negocio`, `cadena_valor` |
| 13 | Efectos sobre el modelo de negocio y la cadena de valor | D→T | ambos | `NIIF S2 13(a)`<br>`NIIF S2 13(b)` | `registros_clima` | — |
| 14 | Introducción a la sección | Plantilla | ambos | — | — | — |
| 15 | Roles y responsabilidades del órgano de gobierno | D→T | ambos | `NIIF S2 6 (a)`<br>`NIIF S2 6 (a)(i)`<br>`NIIF S2 6 (a)(ii)` | — | — |
| 16 | Supervisión de la estrategia, objetivos y remuneración | D→T | ambos | `NIIF S2 6 (a)(iii)`<br>`NIIF S2 6 (a)(iv)`<br>`NIIF S2 6 (a)(v)` | — | — |
| 17 | Papel de la gerencia y controles | D→T | ambos | `NIIF S2 6(b)`<br>`NIIF S2 6(b)(i)`<br>`NIIF S2 6(b)(ii)` | — | — |
| 18 | Estructura de gobierno corporativo y organigrama | T→E + imagen | ambos | — | — | `gobierno_texto`, `organigrama_path` |
| 19 | Trayectoria en sostenibilidad y clima | Tabla + T→E | ambos | — | — | `hitos_sostenibilidad` |
| 20 | Contexto estratégico | D→T | ambos | — | — | `horizontes` |
| 21 | Riesgos climáticos prioritarios | D→T + Tabla | ambos | `NIIF S2 10(a), (b)y(c)`<br>`NIIF S2 10(d)` | `registros_clima` | `matriz_riesgos` |
| 22 | Cambios en modelo de negocio y asignación de recursos | D→T | ambos | `NIIF S2 14(a)(i)`<br>`NIIF S2 14(a)(ii)` | — | — |
| 23 | Esfuerzos directos e indirectos de reducción y adaptación | D→T | ambos | `NIIF S2 14(a)(iii)` | — | — |
| 24 | Oportunidades y cómo prevé alcanzar objetivos | D→T | ambos | — | `registros_clima`, `objetivos` | — |
| 25 | Recursos asignados y progreso de planes | D→T | ambos | `NIIF S2 14(a)(v)`<br>`NIIF S2 14(b)`<br>`NIIF S2 14(c)` | — | — |
| 26 | Resiliencia de la estrategia y análisis de escenarios | D→T | ambos | `NIIF S2 22(a)(i)`<br>`NIIF S2 22(a)(ii)`<br>`NIIF S2 22(a)(iii)`<br>`NIIF S2 22(b)(i)`<br>`NIIF S2 22(b)(ii)`<br>`NIIF S2 22(b)(iii)` | `cuestionarios_respuestas` | — |
| 27 | Gestión y mitigación de riesgos y oportunidades | D→T | ambos | `NIIF S2 25 (a)(i)a(v)`<br>`NIIF S2 25 (a)(vi)`<br>`NIIF S2 25 (b)`<br>`NIIF S2 25 (c)` | — | — |
| 28 | Plan de transición | D→T | ambos | `NIIF S2 14(a)(iv)` | — | — |
| 29 | Emisiones GEI Alcance 1 y 2 (+ Alcance 3 según régimen) | Tabla + D→T | **varía** | `NIIF S2 29 (a)(i)`<br>`NIIF S2 EI14 a E18`<br>`NIIF S2 EI19 a EI24` | `capturas_valor`, `reportes` | — |
| 30 | Método de medición, datos de entrada y C5 | D→T | **varía** | `NIIF S2 29 (a)(ii)`<br>`NIIF S2 29 (a)(iii)` | — | — |
| 31 | Razones del enfoque y desagregación | D→T | ambos | `NIIF S2 29 (a)(iv) EI5` | — | — |
| 32 | Alcance 2 por ubicación e instrumentos contractuales | D→T | ambos | `NIIF S2 29 (a)(v)` | — | — |
| 33 | Emisiones financiadas | D→T | ambos | `NIIF S2 29 (a)(vi)(1)`<br>`NIIF S2 29 (a)(vi)(1) EI12`<br>`NIIF S2 29 (a)(vi)(2)` | — | — |
| 34 | Riesgos de transición: concentración, exposición y capital | Tabla + D→T | **varía** | `NIIF S2 30`<br>`NIIF S2 29 (b) B64 y B65 inciso (a)`<br>`NIIF S2 29 (b) B64 y B65 inciso (b)`<br>`NIIF S2 29 (b) B64 y B65 inciso (c)` | `registros_clima_valores` | — |
| 35 | Riesgos físicos: exposición y gráfica | Tabla + D→T | **varía** | `NIIF S2 29 (c) B64 y B65 inciso (b)`<br>`NIIF S2 29 (c) B64 y B65 inciso (c)` | `registros_clima_valores` | — |
| 36 | Oportunidades: alineación y capital | Tabla + D→T | **varía** | `NIIF S2 29 (d) B64 y B65 inciso (a)`<br>`NIIF S2 29 (d) B64 y B65 inciso (b)`<br>`NIIF S2 29 (d) B64 y B65 inciso (c)`<br>`NIIF S2 29 (e)` | `registros_clima_valores` | — |
| 37 | Precio interno del carbono y remuneración vinculada | D→T | ambos | `NIIF S2 29 (f) (i) y (ii)`<br>`NIIF S2 29 (g) (i) y (ii)` | — | — |
| 38 | Objetivos climáticos (atributos por objetivo) | Tabla | **varía** | `NIIF S2 33` | `objetivos` | — |
| 39 | Enfoque para establecer y revisar objetivos; resultados | Tabla + D→T | **varía** | `NIIF S2 34`<br>`NIIF S2 35` | `objetivos_detalle` | — |
| 40 | Objetivo de emisiones GEI | Tabla + D→T | **varía** | `NIIF S2 36 (a)a(d)`<br>`NIIF S2 36 (e)(i)a(iv)` | `objetivos_detalle`, `cuestionarios_respuestas` | — |

### A.1 · Bloques sin datapoints (14 de 40)

No es una laguna: es el ~30 % institucional de §2. Su fuente es el perfil del emisor o una plantilla,
y sin perfil capturado el generador los marca como pendientes en vez de redactarlos.

| # | Bloque | De dónde sale |
|---|---|---|
| 1 | Carta de la Dirección | `carta_texto`, `carta_firmante`, `carta_cargo` |
| 2 | Presentación del informe (adopción, CNBV) | `denominacion_formal`, `nombre_corto` |
| 3 | Bases de preparación: marco y alivios transitorios | `reportes` |
| 5 | Conexiones y referencias cruzadas | texto fijo |
| 7 | Materialidad: contexto y proceso | `proceso_materialidad` |
| 8 | Horizontes temporales | `horizontes` |
| 9 | Evaluación y priorización de riesgos | `matriz_riesgos` |
| 11 | Nuestra historia (línea de tiempo) | `hitos_corporativos` |
| 12 | Modelo de negocio y cadena de valor | `modelo_negocio`, `cadena_valor` |
| 14 | Introducción a la sección | texto fijo |
| 18 | Estructura de gobierno corporativo y organigrama | `gobierno_texto`, `organigrama_path` |
| 19 | Trayectoria en sostenibilidad y clima | `hitos_sostenibilidad` |
| 20 | Contexto estratégico | `horizontes` |
| 24 | Oportunidades y cómo prevé alcanzar objetivos | `registros_clima`, `objetivos` |

### A.2 · Códigos del catálogo sin bloque (28 de 91)

Tampoco es una laguna, y conviene decir por qué: **los 28 son de NIIF S1 general**. Con el alivio
**E5 ("primero clima") el primer año solo se informa de clima**, así que estos datapoints no tienen
bloque en el régimen que la Fase A implementa. Entran en años subsecuentes, cuando E5 deja de aplicar
(§3.1) — y ahí es donde los bloques 6, 7 y 10 se amplían. Ninguno queda huérfano por descuido.

```
  IFRS S1 2023-06-26 40 a
  NIIF S1 27(a)
  NIIF S1 27(a)(i)
  NIIF S1 27(a)(ii)
  NIIF S1 27(a)(iii)
  NIIF S1 27(a)(iv)
  NIIF S1 27(a)(v)
  NIIF S1 27(b)
  NIIF S1 27(b)(i)
  NIIF S1 30(a)y(b)
  NIIF S1 30(c)
  NIIF S1 32(a)
  NIIF S1 32(b)
  NIIF S1 33(a)
  NIIF S1 33(b)
  NIIF S1 33(c)
  NIIF S1 35(a)
  NIIF S1 35(b)
  NIIF S1 35(c)(i)(ii)
  NIIF S1 35(d)
  NIIF S1 41
  NIIF S1 44 (a)(i)a(v)
  NIIF S1 44 (a)(vi)
  NIIF S1 44 (b)
  NIIF S1 44 (c)
  NIIF S1 46 a 50
  NIIF S1 51
  NIIF S1 72
```

De NIIF S2 no queda ninguno sin bloque. Dos que la primera pasada había dejado fuera se
reasignaron al detectarlo: `NIIF S2 30` (cantidad y porcentaje de activos vulnerables a riesgos de
transición) al bloque 34, y `NIIF S2 32` (tipo de sector en que participa) al bloque 4.
