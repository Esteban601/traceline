# TRACELINE · Fase A · Generador de Suplemento NIIF S1 / S2

Especificación para revisión interna. **Versión 0.2** · 10 de septiembre de 2026.
Referencia de resultado esperado: Informe Anual de Sostenibilidad NIIF S1 y S2 2025 de CADU (41 págs.).

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
| 6 | Juicios, supuestos e incertidumbres (tabla) | Datapoint S1 74; `cuestionarios_respuestas` S2 22(b); `capturas_valor.justificacion` | D→T + Tabla | Fila pendiente |
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

Todo en `dev/ajustes-sep26` contra `traceline-dev`. Nada toca staging hasta que Manuel vea A8.
