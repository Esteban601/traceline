# Encargo: declaraciones del bloque 10 en el Perfil del emisor

Versión 1 · 29 de octubre de 2026. Sale de las deudas conocidas de la entrega v5.2 (§6, «Declaraciones de congruencia y
de criterio de cuantificación en el alta»): en el demo, NIIF S2 21(a) y B65(e) salen de dos declaraciones ilustrativas
cargadas por `scripts/poblar-demo.mjs`. Con una emisora real, el bloque 10 queda con esos dos requisitos pendientes.

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/perfil-declaraciones-alta` desde `dev/ajustes-sep26`. Se integra por PR a `dev/ajustes-sep26` y de ahí a
`main` (CLAUDE.md §2).
**Fecha de inicio:** 29 de octubre de 2026 · **Entrega:** por fases con parada (§2).
**Referencia:** `CLAUDE.md` v1.13 §3, §5, §7 y §8; especificación v0.49 §3 (bloque 10) y §10.

---

## 0. Paso 0 (lectura, sin cambios)

### 0.1 El Perfil hoy

- **Dónde vive:**
  - la tabla `perfil_emisor`, 1:1 con `tenants`;
  - la pantalla `/admin/perfil` (`app/admin/perfil/page.tsx`, `perfil-view.tsx` y `actions.ts`).
- **Quién edita:** el staff, en cualquier emisora; el administrador del cliente, solo en la suya (RLS de la migración
  `20261005120200`).
- **No es un cuestionario:** es un formulario por secciones, con una acción de guardado por sección. Los cuestionarios
  son otra cosa (`lib/cuestionarios.ts`: hojas S2 22(b)(i), 22(b)(ii), 36(e) y 29(a)(iii), guardadas en
  `cuestionarios_respuestas`).
- **Secciones y lo que pide cada una:**

| Sección | Qué pide | Bloques |
|---|---|---|
| Identidad | denominación, nombre corto, forma de referencia, entidad que informa, perímetro y los datos del Formato electrónico (clave de cotización, instrumento, fiduciario, fideicomiso, fideicomitente, administrador, hechos posteriores, actividades y sector SASB) | 2, 4 |
| Matriz | escala y niveles de la matriz de riesgos | 9, 21 |
| Horizontes | corto, mediano y largo plazo, con su definición y su justificación | 8, 20 |
| Carta | texto, firmante y cargo | 1 |
| Historia y Trayectoria | hitos corporativos e hitos de sostenibilidad | 11, 19 |
| Modelo | modelo de negocio y cadena de valor | 12, 13 |
| Gobierno | texto de gobierno, organigrama y glosario | 15–18 |
| Materialidad | proceso de materialidad | 7 |

- **Lo que no pide:** **nada sobre efectos financieros.** Ninguna sección pregunta el criterio de cuantificación
  (NIIF S2 19–21) ni la congruencia con los estados financieros (B65(e)).
- **Adjuntos de cada sección:** van en `perfil_emisor_adjuntos`. Su columna `seccion` tiene un CHECK con las nueve
  secciones de hoy.

### 0.2 Cómo llegan hoy las dos declaraciones al libro de hechos

1. `poblar-demo.mjs` (`NARRATIVAS`, decisión del 27/10) crea dos **solicitudes** del área Finanzas:
   - «Criterio de cuantificación de los efectos financieros previstos», con el código `NIIF S2 21(a)`;
   - «Congruencia de datos y supuestos con los estados financieros», con el código `NIIF S2 B65 inciso (e)`.

   Cada una lleva su evidencia y una sugerencia de texto **confirmada**.
2. El libro de hechos las toma de la fuente 2 de `lib/suplemento/hechos/fuentes.ts`: extractos confirmados, con rango
   «validado». El modelo las atomiza en hechos y les pone **la clave que elige**.
3. El bloque 10 las recibe porque la solicitud cubre sus datapoints (`bloques.ts`, bloque 10, con
   `datapoints: [… "NIIF S2 21(a)", "NIIF S2 B65 inciso (e)"]`).
4. Las respuestas las encuentran por **contenido**, no por clave:
   - 21(a): por `NO_CUANTIFICA_RE` y por el `pide` de `HECHO_RAZON`;
   - B65(e): por `HECHOS_POR_ENUNCIADO`.

   La única clave fija es la del compromiso de transparencia de la Carta (`HECHO_RAZON`, bloque 1).

**Consecuencia:** el camino no depende del script; depende de que exista una solicitud con extracto confirmado. Una
emisora real no tiene esas dos solicitudes, porque no salen del catálogo de solicitudes estándar.
- **En staging:** los dos códigos están «sin solicitud» en las 22 emisoras (foto «después» de v43), Empresa Demo
  incluida.
- **Sin hechos:** el bloque 10 escribe `[Pendiente: …]`. La respuesta del requisito queda «pendiente» (vacía en el
  Formato y con «Pendiente: …» en el Excel).

### 0.3 Qué haría falta

**a) Campos y migración.** Una migración aditiva:
- dos columnas `text` nullable en `perfil_emisor`:
  - `criterio_cuantificacion` (NIIF S2 19–21: si la emisora da información cuantitativa de los efectos financieros y,
    si no, por qué);
  - `congruencia_estados_financieros` (B65(e): si los datos y supuestos son congruentes con los de los estados
    financieros);
- si van en una sección nueva con adjuntos, el CHECK de `perfil_emisor_adjuntos.seccion` se sustituye por uno más
  amplio (permitido en CLAUDE.md §3);
- la llamada a `fn_aplicar_barrera_auditor()`, aunque no cree tabla, como en las migraciones de v43;
- tipos regenerados.

**b) Pantalla.** Una sección nueva, **«Efectos financieros»**, después de Materialidad:
- dos áreas de texto, con su ayuda (qué pide la norma, por párrafo, sin reproducir su texto);
- una acción `guardarEfectosFinancieros` con el patrón de `guardarMaterialidad`;
- la entrada en `SECCION_DE_CAMPO` y en `ETIQUETA_CAMPO` (`completitud.ts`).

**c) Libro de hechos.** En `fuentes.ts`, cada campo como **hecho directo** (`directoPerfil`):
- con clave fija (`emisora.criterio_cuantificacion` y `emisora.congruencia_estados_financieros`);
- con bloque dueño 10;
- con el texto como extracto y rango «perfil».

La alternativa es un tramo de texto que el modelo atomiza (`TEXTO_PERFIL`, como Materialidad). Propongo el directo:
- la clave no cambia de un libro a otro (la deuda de `libro-claves-normalizadas` no aplica aquí);
- 21(a) y B65(e) pueden buscarse por clave en `HECHO_RAZON`, `HECHOS_POR_CLAVE` y `HECHOS_POR_ENUNCIADO`, en lugar
  de por expresiones sobre el enunciado.

**d) Completitud y marcador (§5).** El bloque 10 suma los dos campos a `perfil`:
- **lleno:** cuenta como cumplido;
- **vacío:** `perfil_vacio` («Falta en el Perfil», con enlace a la sección), y el generador escribe el marcador con
  la forma de §5, por ejemplo `[Pendiente: criterio de cuantificación de los efectos financieros (NIIF S2 19–21) —
  Perfil del emisor, sección Efectos financieros]`;
- en las salidas: Formato vacío, Excel «Pendiente: … — Perfil del emisor, sección Efectos financieros».

Para que el requisito no quede además como «sin solicitud», 21(a) y B65(e) entran en `FUENTES_ALTERNATIVAS`. Hoy esa
tabla solo tiene `10(d)` → horizontes, que remite al bloque 8. Aquí el campo es del mismo bloque, así que **no
remite**: hay que distinguir ese caso (§5, pregunta 3).

**e) Que el bloque 10 lo lea del Perfil, no de un script:**
- `poblar-demo.mjs` escribe los dos textos en `perfil_emisor` y deja de crear las dos solicitudes de `NARRATIVAS`;
- el generador ya lee del libro, y con (c) el hecho sale del Perfil.

En dev quedan las dos solicitudes viejas, con su extracto confirmado. Si no se retiran, el libro las toma además del
Perfil y el bloque 10 tendría dos hechos iguales con rangos distintos (§5, pregunta 4).

### 0.4 Las 22 emisoras de staging

| Qué | Qué pasa |
|---|---|
| Columnas nuevas | Llegan vacías en las 22 (nullable, sin default). |
| Guardado | Ninguna sección se vuelve obligatoria y guardar el Perfil no exige los campos nuevos. |
| Generación | Nada se bloquea: el bloque 10 sale con los dos marcadores de §5 hasta que la emisora conteste. |
| Semáforo del suplemento | El bloque 10 baja: suma dos requisitos «Falta en el Perfil», en rojo, con enlace. Es visible para el staff. |
| Cobertura (foto de `foto-cobertura.mjs`) | No cambia: el catálogo y las solicitudes no se tocan. |
| Aprobación | Un documento con esos marcadores no se aprueba (§5), como hoy con cualquier pendiente. |
| Documentos aprobados | En staging hay 0, así que ninguna respuesta guardada cambia con el release. |

### 0.5 Estimación

| Fase | Qué | Jornadas |
|---|---|---|
| 1 | Migración, tipos, sección «Efectos financieros», acción, completitud y marcador; e2e de guardado (con su restauración) y de completitud | 0.5 |
| 2 | Hechos directos con clave fija; 21(a) y B65(e) por clave; `poblar-demo` y datos de dev; e2e de que el bloque 10 y las respuestas los toman del Perfil, y de que, vacíos, salen con el marcador | 0.5 |
| 3 | Despliegue a `traceline-dev` con humo; Formato y Excel del demo sin cambio de texto en K100 y K788/K811/K834 (la fuente cambia, el contenido no); PR | 0.25 |
| 4 | Runbook de v44: una migración, sin plantilla | 0.25 |

- **Total:** ~1.5 jornadas.
- **Costo del modelo:** solo la regeneración de 21(a) y B65(e) del demo, si cambia su fuente, unos **0.05 USD**
  (precio de las corridas de esta semana). No hace falta regenerar el bloque 10 del documento aprobado. Si se pide
  regenerarlo, son unos 0.30 USD más el libro de hechos (11.15 / 38 por bloque, referencia de CLAUDE.md §5).

---

## 5. Decisiones de Esteban (29/10/2026, Paso 0)

1. Fases y estimación de §0.5: **aprobadas**.
2. **Hecho tomado tal cual**, con clave fija y dueño el bloque 10.
3. **Sección «Efectos financieros» con adjuntos**, ampliando el CHECK de `perfil_emisor_adjuntos.seccion`.
4. **Se retiran de dev** las dos solicitudes viejas del demo (Fase 2).
5. Un requisito cubierto por un campo **del mismo bloque** cuenta como cumplido **sin remitir** a otro bloque.

### 5.1 Preguntas del Paso 0 (ya respondidas arriba)

1. **Fases y estimación de §0.5:** ¿las apruebas?
2. **Hecho directo con clave fija (§0.3 c)**, en lugar de un tramo que el modelo atomiza: es mi propuesta.
3. **Sección y adjuntos:**
   - ¿sección nueva «Efectos financieros» con adjuntos (CHECK ampliado de `perfil_emisor_adjuntos.seccion`)? Es mi
     propuesta;
   - ¿o sin adjuntos, sin tocar ese CHECK?
4. **Datos de dev:** ¿retiro las dos solicitudes viejas del demo (y su evidencia y su extracto) para que el bloque 10
   no tenga el hecho dos veces? La alternativa es dejarlas y que la respuesta prefiera el hecho del Perfil.
5. **`FUENTES_ALTERNATIVAS` sin remisión:** ¿un requisito cubierto por un campo del mismo bloque cuenta como cumplido
   sin remitir? Es mi propuesta.
6. **Redacción de las dos ayudas** de la pantalla: te la presento en la Fase 1, antes de cargarla.

### 5.2 Decisión de la parada de la Fase 2 (29/10/2026)

**No se sube el tope mensual** de generaciones de Empresa Demo. Lo siguiente queda como **«esperan v6»** y se regenera
con el libro de hechos v6, el 1 de noviembre de 2026 o después, en una sola corrida:

- el bloque 10 del demo;
- 21(a) y B65(e): K100, K788, K811 y K834, que cambian solo cuando se vuelva a aprobar el documento;
- K91 y K743;
- el Word de los objetivos 2 y 3 (33(g) y 33(h)).

Consta también en las deudas conocidas de la entrega v5.2 (`~/Downloads/formato-v5-2/deudas-conocidas.md`, §12; la §6
queda resuelta en código). El encargo se cierra como **«código en main; demo pendiente de v6»**.

## 7. Registro

| Fecha | Qué | Resultado |
|---|---|---|
| 29/10/2026 | **Paso 0** (lectura). El Perfil no pide ninguna de las dos declaraciones. En el demo llegan como solicitudes con extracto confirmado, creadas por `poblar-demo`. En staging, 21(a) y B65(e) están «sin solicitud» en las 22 emisoras. Propuesta: dos columnas en `perfil_emisor`, la sección «Efectos financieros», hechos directos con clave fija y bloque dueño 10, y el marcador de §5 cuando falten, sin bloqueo. ~1.5 jornadas, ~0.05 USD | **Parada:** decisiones de §5 |
| 29/10/2026 | **Decisiones del Paso 0** (§5) y **Fase 1**, parada con el SQL y las ayudas | **Migración** `supabase/migrations/20261029140000_perfil_efectos_financieros.sql`, aditiva: `perfil_emisor.criterio_cuantificacion` y `perfil_emisor.congruencia_estados_financieros` (text, nullable), el CHECK de `perfil_emisor_adjuntos.seccion` sustituido por uno más amplio con `efectos`, y la barrera. **Sin aplicar en ningún ambiente.** Tipos de las dos columnas escritos a mano en `lib/database.types.ts`, iguales a los que genera la CLI; se regeneran al aplicarla. **Pantalla:** sección «Efectos financieros» después de Materialidad, con adjuntos (`efectos`), las dos áreas de texto, su acción `guardarEfectosFinancieros` (patrón de Materialidad, con bitácora) y «completa» cuando las dos tienen texto o hay un documento. Las ayudas de los dos campos, sin cargar. `tsc` limpio y eslint sin errores. La completitud, el libro de hechos y el demo van en la Fase 2 | **Parada:** aprobación del SQL y de las ayudas |
| 29/10/2026 | **Fase 1 aprobada** (Esteban) con dos cambios, aplicados | **(1)** La sección cuenta como completa solo con los dos textos; el adjunto no sustituye al texto. **(2)** Los ejemplos de los campos vacíos muestran la elección entre corchetes («La Compañía [proporciona / no proporciona] …», «… [son / no son del todo] congruentes …»). **Migración** aplicada en dev (`supabase db push --linked`; la traza de `pg-delta` de siempre) y en el stack local: 98 de 98 con 0 desalineadas en los dos; barrera 108 en los dos. **Tipos** regenerados desde dev: iguales, byte por byte, a los escritos a mano en la Fase 1. **Ayudas** cargadas. **`e2e-perfil-efectos`** (nuevo, Playwright contra `next dev` local): la sección, sus ayudas y ejemplos; «Vacía» con un solo campo y con un adjunto; guardar, recargar y «Con datos»; un campo vaciado queda NULL; restauración (Empresa Demo del stack local no tenía fila de perfil: se borra la que crea). 15 en verde. En el stack local `service_role` no escribe `perfil_emisor`, así que la prueba lee y restaura con `psql` | Hecho |
| 29/10/2026 | **Fase 2**, parada en el tope mensual de generaciones | **Hechos:** cada campo es un hecho directo (`fuentes.ts`), con clave fija `emisora.criterio_cuantificacion` y `emisora.congruencia_estados_financieros` (`DECLARACIONES_PERFIL`, en `hechos/razones.ts`), dueño el bloque 10, rango «perfil» y el texto tal cual; los adjuntos de la sección van al bloque 10. **Completitud** (decisión 5): `FUENTES_ALTERNATIVAS` suma 21(a) y B65(e) con su campo; lleno, cumplido **sin remitir**; vacío y sin solicitud, **un** faltante «perfil_vacio» con el código como etiqueta, el detalle «…: sin capturar en el Perfil del emisor, sección Efectos financieros.» y el enlace a la sección. **Decisión mía:** no sumé los dos campos a `perfil` del bloque 10 (como decía §0.3 d), porque contaría dos veces el mismo hueco; el e2e lo comprueba (exigidos iguales, cumplidos +2). **Respuestas:** 21(a) y B65(e) toman la declaración por clave en cualquier libro del documento, aunque la cobertura aprobada no la cite; sin ella, el marcador `[Pendiente: criterio de cuantificación de los efectos financieros (NIIF S2 19–21) — Perfil del emisor, sección Efectos financieros]` (y el de B65(e)). El validador de K100 exige las razones que da la declaración, no una lista fija: con otra redacción de la emisora ya no rechaza una respuesta correcta; en el demo, que da las dos, no cambia nada. **`poblar-demo`:** los dos textos en `PERFIL`, fuera de `NARRATIVAS`, y `retirarSolicitudes()`, idempotente, que borra las dos solicitudes viejas y sus archivos. **Dev:** los dos textos cargados en el Perfil del demo (iguales a `poblar-demo`, comprobado) y las dos solicitudes retiradas con su archivo del bucket (0 solicitudes y 0 evidencias después). **Parada:** reconstruir el libro de hechos responde **429**: Empresa Demo ya usó sus 10 generaciones completas de octubre (`tenants.generaciones_mes_max`). No se pasó la barrera. Sin libro nuevo no se regenera el bloque 10, y sin volver a aprobar el documento las respuestas siguen saliendo de la versión 3 aprobada del bloque 10 (`versiones_aprobadas`), que cita los hechos del libro `9ce685d6`. K100, K788, K811 y K834 siguen iguales; no se regeneraron 21(a) ni B65(e) (costo 0) porque darían lo mismo. **Pruebas:** `e2e-perfil-declaraciones` (nuevo) 19 en verde; `e2e-perfil-efectos` 15; validadores 90, métricas 19, Formato 29, alivios 20, respuestas 22 y regeneración 9 contra el stack local; `verify:export` 81 contra dev con el código de la rama; `tsc` limpio; eslint sin errores (los 2 avisos de antes). **De paso:** el catálogo del stack local no tiene `NIIF S2 21(a)` ni los 4 padres (116 códigos contra 121 en dev): sus migraciones copian atributos de filas que el seed carga después. Ya existía; la completitud ahora da el faltante del Perfil aunque el código no esté en el catálogo | **Parada:** decisión sobre el tope mensual y la nueva aprobación |
