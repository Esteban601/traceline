# Encargo: deuda S2 del suplemento y corrección del mapeo del Formato electrónico

Versión 1 · 24 de octubre de 2026. Sale del Paso 0 de lectura del 24/10 sobre los seis códigos que el Formato
electrónico pide y el catálogo no tiene (`docs/suplemento-s1s2/ampliacion-catalogo.md`: S2 13, 22, 14(a), 21(a), 28,
29B(a)). Esa lectura encontró, además, cinco filas del Formato mal mapeadas (84, 91, 390, 433, 437).

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/deuda-s2-formato` desde `dev/ajustes-sep26` (`0c2ffcd`). Se integra por PR a `dev/ajustes-sep26` y de
ahí a `main` (CLAUDE.md §2).
**Fecha de inicio:** 24 de octubre de 2026 · **Entrega:** Formato v4 del demo en `traceline-dev` para el lector
externo; staging (v42), después de esa lectura.
**Referencia:** `CLAUDE.md` v1.10 §3, §4, §5, §7, §8 y §9; especificación v0.42 §6.1, §10 y Anexo A;
`docs/suplemento-s1s2/mapeo-formato-electronico.json`, `ampliacion-catalogo.md` y `auditoria-catalogo.md`.

## 0. Resumen de una página (Paso 0, para aprobación)

**Qué entendí.** El Formato electrónico se llena por fila desde `mapeo-formato-electronico.json`. Hay dos problemas
distintos:
- **Mapeo equivocado:** filas cuyo datapoint no corresponde a lo que la fila pide. Las conocidas son 84, 91, 390, 433
  y 437. Hoy el demo v3 escribe en ellas texto falso (433 «Sí» y 437 el Alcance 1) o texto de relleno (84, 91 y 100:
  «No aplica… Sin sección en el suplemento»).
- **Códigos faltantes:** seis códigos que el catálogo no tiene.

El encargo corrige primero el mapeo y después da de alta los códigos que hacen falta. S2 28 se cierra sin alta y S2
29B(a) se pospone.

**Cómo lo voy a hacer.**
- **Fase 1 (solo lectura).** Script que compara, fila por fila, la columna A de la plantilla de 2025 con la referencia
  del datapoint mapeado en el JSON. Lista de discrepancias con lo que el demo v3 escribe hoy en cada una. Etiquetas
  de K62 y K64.
- **Fase 2.**
  - Correcciones del JSON y de `ampliacion-catalogo.md`.
  - Alta de `NIIF S2 21(a)` con dueño el bloque 10: migración de datos aditiva, con su fila en
    `auditoria-catalogo.md` y en el Anexo A de la especificación (la especificación se corrige antes que el código).
  - Fuera el texto de relleno de K84, K91 y K100.
- **Fase 3.** Códigos padre S2 22, 14(a) y 13, en una migración.
- **Fase 4.** PR, despliegue a `traceline-dev`, demo v4 y lectura externa; staging después.

**Qué voy a tocar.**
- El JSON del mapeo y `lib/formato/llenar.ts`, para la regla de C4 en 433 y 437 y el texto de relleno.
- La construcción de respuestas (`lib/suplemento/respuestas.ts`) donde haga falta para los códigos nuevos.
- Migraciones de datos del catálogo.
- `ampliacion-catalogo.md`, `auditoria-catalogo.md` y la especificación (Anexo A y §10).

**Qué no voy a tocar.**
- El texto de los bloques del suplemento ni el documento v3 del demo; no se regenera nada hasta la Fase 4.
- El catálogo SASB.
- 29B(a) y 29B(b) en el catálogo.
- Staging, salvo lo que la Fase 4 asigna a Esteban.

**Dudas que necesito resueltas antes de la Fase 2** (detalle en §6):
1. Cómo sale el texto de K100 «sin regenerar el documento»: por código desde los hechos, o regenerando solo las
   respuestas del demo (unos 0.49 USD).
2. Dónde se aplican las migraciones para probar: el demo v3 vive en el dev de Esteban, no en el stack local.
3. El orden de la Fase 4: la migración en staging antes de la lectura externa adelanta las filas nuevas del catálogo
   en las 22 emisoras de staging.

## 1. Objetivo

Que el Formato electrónico de cualquier emisora responda cada fila con la información que la fila pide: sin datapoints
cruzados, sin texto de relleno y con los párrafos de NIIF S2 que hoy no tienen código. Así el Formato v4 del demo
puede ir al lector externo.

## 2. Alcance

### Fase 1 · Auditoría mecánica del mapeo (lectura)

- Para cada fila de la plantilla de 2025 (hoja «Estructura Formato Electronico») con referencia normativa en la columna
  A y datapoint en el JSON: normalizar la columna A (norma, párrafo, inciso) y compararla con la referencia del
  datapoint.
- **Regla de comparación:** coinciden si alguna referencia NIIF S2 de la columna A es la del datapoint o un ancestro
  suyo (párrafo sin inciso contra inciso). Para filas con par S1/S2, cuenta el par S2. Los códigos agrupados del
  catálogo (`… a …`) se expanden a sus incisos.
- **Entrega:** fila, etiqueta (C/D), columna A, datapoint y su referencia, y qué escribe hoy el demo v3 (documento
  `99992cd3` en dev, con el llenado de la ruta).
- **Las cinco conocidas.** Deben aparecer, o explico por qué no. Anticipo que 84, 91 y 390 **no tienen columna A**:
  - 84 y 91 tienen la referencia en la columna G («NIIF S1 36-40»);
  - la de 390 está en la fila 391 («NIIF S2 29 (b)»).

  La prueba estricta no las detecta. Las reporto aparte con una segunda pasada que usa la referencia heredada de la
  fila anterior con columna A o la de la columna G, marcada como tal.
- Etiquetas y columna A de K62 y K64, para decidir dónde va la concentración de `registros_clima`.
- **Parada:** lista para que Esteban la confirme.

### Fase 2 · Corrección del mapeo y S2 21(a) (con el OK y la lista confirmada)

- **JSON y `ampliacion-catalogo.md`, en las filas confirmadas:**
  - 433 y 437: la regla de K435 con alivio C4;
  - 390: la métrica de oportunidades 29(d);
  - 84 y 91: S1 34–35 / S2 15–16;
  - las demás, según la lista.
- **S2 21(a):**
  - alta en el catálogo, con dueño el bloque 10: migración aditiva con `fn_aplicar_barrera_auditor()` al final, fila
    en `auditoria-catalogo.md`, código copiado verbatim y `validarMapeo()` con 0 faltantes;
  - respuesta desde `riesgos_transicion.efectos_registrados_2025` y `efectos_financieros.*`.
- **Texto de relleno:** fuera «No aplica… Sin sección en el suplemento» de K84, K91 y K100 (vocabulario de plataforma,
  §5).
- **Prueba en local** con el libro del demo v3, sin regenerar el documento: texto resultante de K84, K91, K100, K433,
  K437 y K390.
- **Parada:** informe.

### Fase 3 · Códigos padre S2 22, 14(a) y 13 (con el OK)

- Mismo patrón que «NIIF S2 25 (a)(i)a(v)», en este orden:
  - **S2 22:** K105 reutiliza la síntesis de K103;
  - **S2 14(a):** sintetiza los cinco incisos de los bloques 22, 23, 25 y 28;
  - **S2 13:** toma `cadena_valor.*` (y, hasta el 25/10, `modelo_negocio.*`), y K59 deja de repetir K60.
- **Códigos padre de los efectos financieros** (`NIIF S2 15` / `NIIF S1 34`, filas 84 y 91): misma tanda, si
  hace falta el padre. Hasta entonces las dos filas se responden desde el bloque 10 con la clave `fila:N`
  (Fase 2).
- Una migración aditiva para la tanda.
- **S2 28:** cerrada sin alta, resuelta por la iteración de `lib/formato/metricas.ts` (§7).
- **S2 29B(a):** pospuesta hasta que `normas/` tenga la modificación de NIIF S2 de 2025 (la pone Esteban; la edición
  local es la de junio de 2023 y no trae 29A–29C).
- Prueba en local con los criterios de la Fase 2.
- **Parada:** informe.

### Fase 4 · Integración y despliegue (con el OK)

En este orden (decisión de Esteban del 24/10):

1. PR `dev/ajustes-sep26` → `main`, mezclado con el comentario de siempre (CLAUDE.md §2).
2. **Despliegue v42 a `traceline-dev`** (las migraciones ya están en dev desde las Fases 2 y 3).
3. **Demo v4 en dev:** una sola corrida de regeneración (cerca de 8 USD, §5).
4. **Formato v4** generado en `traceline-dev`, con la lista de la Fase 1, para el lector externo. **Parada:** lectura
   externa.
5. **El día del despliegue a staging, después de la lectura externa:**
   - foto «antes» en staging (la misma de §6, punto 4), con totales y porcentajes por emisora;
   - Esteban corre la migración con `scripts/despliegue/migrar-remoto.sh` (CLAUDE.md §1);
   - `git push heroku main` (v42);
   - foto «después», comparada contra la diferencia esperada;
   - registro en la especificación §10, que **incluye el cambio de Cobertura**: los códigos padre (los 4 anteriores
     y los 4 nuevos) salen de conteos y porcentajes. En el demo de dev, NIIF pasa de 113 códigos con 65 % cubierto
     (v41) a 109 con 64 % (v42).

## 3. Qué toca y qué no

- **Toca:**
  - `docs/suplemento-s1s2/mapeo-formato-electronico.json` y `.md`;
  - `lib/formato/llenar.ts` y, si hace falta, `lib/suplemento/respuestas.ts`;
  - `supabase/migrations/` (datos del catálogo) y `lib/database.types.ts` si cambia;
  - `ampliacion-catalogo.md`, `auditoria-catalogo.md` y la especificación (Anexo A, §6.1 y §10).
- **No toca:**
  - el esquema: solo filas del catálogo;
  - el texto de los bloques del suplemento ni sus prompts;
  - el catálogo SASB;
  - 29B(a) y 29B(b) en el catálogo;
  - la plantilla en Storage: su sha256 no cambia.
- **Ambientes:**
  - Fases 1 a 3: código local contra el dev de Esteban (`kmjkoxecxcujxixlxwlb`). En las Fases 2 y 3 las migraciones
    de datos se aplican ahí, con foto antes y después. El libro no se copia a local.
  - Fase 4: `traceline-dev` y, después de la lectura externa, staging.
  - Nada contra staging antes de la Fase 4.

## 4. Definición de terminado

- **Auditoría de la Fase 1, vuelta a correr al final:** 0 discrepancias no explicadas.
- **K433 y K437:** con C4, «No revelado · alivio C4»; sin C4, vacías como pendiente, igual que K435.
- **K84, K91 y K100:** sin «Sin sección en el suplemento». En ninguna celda K del Formato del demo ni en ninguna
  respuesta del Excel aparecen «suplemento», «solicitud», «evidencia» ni «IRStrat».
  - **Excepción escrita (decisión de Esteban del 24/10):** los marcadores de pendiente de §5, `[Pendiente: … —
    <solicitud o campo>]`, nombran la solicitud por regla de CLAUDE.md. En el demo son 2 respuestas del Excel:
    NIIF S2 30 y NIIF S2 B65 inciso (e).
- **Voz:** ninguna respuesta ni celda K en primera persona del plural. El validador rechaza y reintenta.
- **K100:** responde con los hechos de los bloques 10 y 34, sin dato inventado.
- **K105, K65 y K59:** responden con su código padre; K59 ya no es igual a K60.
- **`validarMapeo()`:** 0 faltantes; `supabase migration list` igual en local y en remoto.
- **Validador del Formato:** 23 imágenes enlazadas, 0 «#VALUE!» y 0 celdas K con «[».
- `tsc` limpio, `eslint` sin errores nuevos, `npm run verify:export` en verde, y e2e `e2e-formato-electronico` y
  `e2e-metricas-instancias` en verde.
- **Ningún código padre suma con sus incisos** en Cobertura ni en el Excel de taxonomía.
- **Foto antes y después de cada migración** (dev en las Fases 2 y 3, staging en la Fase 4): la diferencia es
  exactamente la esperada, escrita antes de correrla.
- v42 registrado en la especificación §10.
- Al cerrar el encargo, el worktree `vert-evidencia-dev` vuelve a `dev/ajustes-sep26`.

## 5. Entregables intermedios

- Paso 0: resumen de §0. **Parada.**
- Fase 1: lista de discrepancias, más K62 y K64. **Parada:** Esteban confirma la lista.
- Fase 2: correcciones, S2 21(a) y textos de las seis celdas. **Parada:** informe.
- Fase 3: códigos padre y textos de K59, K65 y K105. **Parada:** informe.
- Fase 4: PR, v42 en `traceline-dev`, demo v4 y Formato v4 para el lector externo. **Parada:** lectura externa.
  Después, staging con la migración y las fotos, el mismo día. **Parada:** informe.

## 6. Riesgos y dudas conocidas

- **Texto de K100 sin regenerar el documento.** Hoy las celdas narrativas salen de `respuestas_datapoint`, que genera
  el modelo al aprobar. Para que K100 cambie sin regenerar el documento hay dos caminos:
  - (a) componerlo por código desde los hechos: es una declaración negativa más causas, como la fila 64;
  - (b) regenerar solo las respuestas del demo v3 (unos 0.49 USD), que no regenera el documento.

  Propongo (b), porque es el mismo camino que seguirá cualquier emisora. **Decide Esteban.**
- **Dónde se prueba.** El demo v3 vive en el dev de Esteban; el stack local no lo tiene. Hay dos opciones:
  - aplicar la migración en dev (escritura en el dev de Esteban, con su OK) y correr el código local contra dev;
  - copiar el libro al stack local.

  **Decide Esteban.**
- **Orden de la Fase 4.** La migración en staging antes de la lectura externa agrega las filas nuevas del catálogo a
  Cobertura y al Excel de taxonomía de las 22 emisoras de staging, antes de que el código las sepa llenar. Propongo
  correr la migración en staging junto con el despliegue posterior a la lectura. Si se mantiene el orden escrito, el
  Excel de staging mostrará esas filas como «En preparación» o vacías hasta v42. **Decide Esteban.**
- **Ensayo.** La especificación §10 pide un ensayo en una copia de staging cuando el release cambia el esquema. Estas
  migraciones son solo de datos del catálogo. **Pregunta a Esteban:** ¿se exige el ensayo?
- **Códigos padre junto a sus incisos.** La revisión externa del 8/10 objetó los códigos colapsados («25 (a)(i)a(v)»)
  y los encabezados con errata («EI14 a E18»). Un padre convive con sus incisos en Cobertura, en el semáforo y en el
  Excel de taxonomía. En la Fase 3 compruebo que no se cuente dos veces ni aparezca como fila de datos duplicada.
- **K84 y K91.** El catálogo tiene S1 35(a)–(d) y S2 16(a)–(d), pero no S1 34 ni S2 15, que son los párrafos padre.
  Las dos filas son encabezados de tipo text. En la Fase 1 propongo si van como encabezado sin respuesta o desde
  16(a)–(d).
- **K64.** La concentración por código desde `registros_clima` (decisión de Esteban del 13/10) está en una fila cuya
  etiqueta es «Estrategia y toma de decisiones» (S1 33 / S2 14); la concentración la pide 13(b), en K62. Se decide con
  las etiquetas de la Fase 1.
- **`EI14 a E18`** en el catálogo es «Emisiones de GEI de Alcance 1» (un ejemplo ilustrativo). Al quitarlo de 433 y
  437, verificar que ninguna otra fila lo use para algo distinto del Alcance 1.

### Decisiones de Esteban sobre §6 (24/10)

1. **K100:** se regeneran solo las respuestas del demo v3, no el documento. El costo se registra en §7.
2. **Pruebas de las Fases 2 y 3:** en el Supabase dev (`kmjkoxecxcujxixlxwlb`), con la migración aditiva de datos
   aplicada ahí. El libro no se copia a local.
3. **Fase 4:** la migración contra staging la corre Esteban el mismo día del despliegue v42 a staging, después de la
   lectura externa del Formato v4 generado en `traceline-dev` (§2, Fase 4, reescrita).
4. **Sin copia de staging, pero con foto.**
   - Antes de cada migración en dev se guarda el conteo de solicitudes y de Cobertura por emisora y por código.
   - Antes de correrla se escribe la diferencia esperada: qué códigos aparecen, en cuántas emisoras y con qué estado.
   - Después se compara y se entrega la diferencia.
   - El mismo par de fotos se hace en staging en la Fase 4.
   - Si en dev aparece cualquier diferencia no prevista, el encargo pasa a ensayo en copia de staging antes de seguir.

### Hallazgos de la Fase 1 que no se corrigen aquí (decisión de Esteban del 24/10)

**Erratas de la columna A de la plantilla de la BMV. Sin cambio: el datapoint es el correcto.**

| Fila | Columna A en la plantilla | Referencia correcta | Nota |
|---:|---|---|---|
| 350, 373, 396 | NIF S2 29 (e) | NIIF S2 29 (e) | «NIF» por «NIIF»; despliegue de capital |
| 371 | NIF S2 29 (c) | NIIF S2 29 (c) | «NIF» por «NIIF» |
| 368 | NIIF S2 29 (b) | NIIF S2 29 (c) | sección de riesgos físicos con la referencia de transición |
| 370 | NIIF S2 29 (b) B64 y B65 inciso (a) | NIIF S2 29 (c), B64, B65 (a) | ídem (tabla de riesgos físicos) |
| 391 | NIIF S2 29 (b) | NIIF S2 29 (d) | sección de oportunidades con la referencia de transición |
| 472 | NIIF S2 B62 (c) | por confirmar | la etiqueta habla de «activos bajo gestión» dentro de la sección de banca comercial |

**Falsos positivos de la segunda pasada** (la fila no tiene columna A y hereda la de otra; el datapoint es el
correcto): 344, 367, 369, 390, 392, 413, 416 y 468.

**Deuda de la modificación de 2025 de NIIF S2** (`ampliacion-catalogo.md`): 29B (filas 433, 435–436 y 437) y 29C
(439 y 441). Con C4 escriben «No revelado · alivio C4».

**Encargo siguiente, fuera de este: `formato-repeticiones-por-inciso`** (renombrado el 24/10). Filas que repiten el
mismo texto porque comparten datapoint: NIIF S2 33(a)–(h) (221 a 235, 7 celdas con texto) y 34(b)–(d) (239 a 243, 3
celdas), con los generales `NIIF S2 33` y `NIIF S2 34`; y NIIF S2 16(a) en K85 a K90 (6 celdas).

### Decisiones de Esteban antes de la migración de la Fase 3 (24/10)

- **Descripción de `NIIF S2 21(a)`:** aprobada sin cambios.
- **`textoNoAplicaE5`:** «[oración E5] La información correspondiente a este requisito, en lo relativo al clima, se
  revela conforme a NIIF S2 X.»; sin par de NIIF S2, solo la oración E5.
- **(a) Cobertura:** los padres, viejos y nuevos, salen de los conteos y porcentajes y quedan como filas de agrupación.
  La foto mide totales y porcentajes por emisora, y el cambio se escribe en el registro de v42.
- **(b) Efectos financieros, según la plantilla:**
  - K84 es una síntesis de 16(a), con la regla de K97/K99 respecto a K85;
  - K91 responde al padre `NIIF S2 16 (b)a(d)`.
- **(c) S2 14:** K65 responde al padre `NIIF S2 14 (a)(i)a(v)`; K64 es una síntesis de una o dos oraciones de S2 14,
  con la regla de K97/K99 respecto a K65.
- **(d)** Solo padres de NIIF S2.
- **(e)** S2 13 suma `cadena_valor.*` y `modelo_negocio.*` con un mecanismo general por clave, no limitado al demo.
  **Ajuste del 25/10 (revisión de K59 por Esteban):** `modelo_negocio.*` sale del padre. Sus subclaves las extrae el
  modelo del texto libre del Perfil y mezclan acciones de respuesta (en el demo, `modelo_negocio.cambios_2025`:
  límites sectoriales y unidad de financiamiento sostenible, contenido de NIIF S2 14) con efectos y concentración (13);
  los hechos de `modelo_negocio` que son de 13 ya llegan por los incisos. La descripción del padre dice además que no
  describe acciones de respuesta.

### Reglas registradas en la Fase 3 (decisión de Esteban del 24/10)

- **Documento vigente:** el documento aprobado vigente del demo es el v3 (`99992cd3`) hasta que se genere el v4 en
  la Fase 4; a partir de entonces lo es el v4, y las respuestas y el Formato se leen de él.
- **`HECHOS_POR_CLAVE` no se usa con documentos de clientes.** Solo resuelve, en el demo, los requisitos dados de
  alta después de aprobar el documento (hoy `NIIF S2 21(a)`). En el v4, y en cualquier documento generado después
  del alta, la cobertura del bloque manda y no se usa. Las respuestas que salen por esa vía no se reutilizan: se
  generan de nuevo en cada corrida.
- **E5 y cifras de efectos financieros:** NIIF S1 E5 permite revelar solo los riesgos y oportunidades relacionados
  con el clima (y aplicar NIIF S1 solo en esa medida); no exime de información cuantitativa. La oración E5 delante
  de las cifras de K84–K98 no contradice nada.

### Regla de `HECHO_RAZON` (decisión de Esteban del 24/10)

`HECHO_RAZON` degrada. Si `emisora.compromiso_transparencia_limitaciones` no está en los libros del documento, la
descripción del requisito no pide la razón y el validador no la exige: K100 se responde con los hechos de
`efectos_financieros.*` (y `riesgos_transicion.efectos_registrados_2025`). Nunca se empuja al modelo a dar una razón
que el libro no trae.

**El generador del bloque usa la misma ruta (decisión de Esteban del 25/10, opción (a)).** El demo v4 dejó el bloque 10
con un pendiente de 21(a): la razón está en un hecho cuyo dueño es el bloque 1 (Carta de la Dirección), y el bloque 10
solo recibía sus hechos propios y referencias de una línea. Desde la rama `fix/bloque10-hecho-transparencia`,
`HECHO_RAZON` vive en `lib/suplemento/hechos/razones.ts` y `insumoDelBloque` entrega ese hecho al bloque como
**prestado**: se busca por clave en el libro vigente y en los otros libros del documento, uno por requisito, del libro
vigente primero, con su fuente, su bloque dueño y su libro de origen (que quedan en las fuentes y anclas guardadas). Va
con un `uso` que le pide citarlo en la misma oración que un hecho propio de otro rango (el validador rechaza una
oración o un requisito sostenidos solo por la Carta). Sin el hecho, nada cambia: el bloque deja su pendiente.
- **El libro no admite registrarlo bajo el bloque 10 sin duplicarlo.** Un hecho tiene un solo `bloque_dueno`;
  `bloques_referencia` lo daría como referencia de una línea para remitir, no como hecho citable; y el libro se rehace
  con el modelo, así que un cambio a mano se perdería.
- **La clave cambia entre libros** porque la pone el modelo: `emisora.compromiso_transparencia_limitaciones` en los
  libros del 8 y 11/10, `emisora.carta_compromiso_transparencia` en el del 14/10 (el vigente). La expresión cubre las
  dos; una tercera variante en un libro futuro haría que el requisito degrade a pendiente, sin dato inventado.

### Reuso de respuestas con firma del pedido (Fase 3)

La versión de prompt de cada respuesta lleva una firma: un hash de la descripción del requisito y de los hechos que
recibe. Una respuesta previa solo se reutiliza si su pedido es el mismo. Sin la firma, K64 y K84 conservaban el texto
anterior aunque su descripción hubiera cambiado. La primera corrida con firma regeneró todas las respuestas del demo
(0.53 USD); `e2e-respuestas-regeneracion` comprueba que el reuso sigue funcionando con el mismo pedido.

### Deuda siguiente: pendientes del demo

Esteban anotó «los 22 pendientes del demo (36(e), 25(a))» como la deuda que sigue a este encargo. **Medido en dev
el 24/10, el número no coincide:** el demo v3 tiene 2 respuestas pendientes (NIIF S2 30 y NIIF S2 B65 inciso (e)). Los
códigos de 25(a) tienen respuesta y los de 36(e) llevan el «no aplica» heredado. Falta que Esteban confirme a qué se
refieren los 22 antes de escribir el encargo.

**36(e), revisado el 25/10 (pendiente del encargo siguiente, no se corrige aquí).** El «no aplica» de
`NIIF S2 36 (e)(i)` a `(iv)` y de su padre viene de una **regla**, no de una decisión de IRStrat sobre la emisora:
`noAplicaHeredado` (`lib/suplemento/catalogo-incisos.ts`, decisión del 8/10) busca con una expresión regular una
negación del uso de créditos de carbono en las respuestas del cuestionario «S2 36(e)» que capturó la emisora; si la
encuentra, los cuatro incisos y el padre son «no aplica» con el texto fijo. En el Formato exportado (filas 534–547;
son las 255–270 del mapeo, desplazadas por las tablas de métricas), K534, K538, K540 y K546 dicen «No aplica. La
Compañía no prevé usar créditos de carbono para alcanzar sus objetivos de emisiones.» y K542 y K544 (enumeraciones
de (iii)) dicen «No aplica: la Compañía no prevé usar créditos de carbono para alcanzar sus objetivos.». Lo que falta
revisar: que la detección dependa de la redacción de la respuesta y no de un campo explícito, y las dos redacciones.

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-10-24 | Paso 0 de lectura de los seis códigos (sin código). Demo v3 = documento `99992cd3` en dev. Errores fuera de los seis: 433/437 → `NIIF S2 EI14 a E18` (Alcance 1), 390 → 13(a), 84/91 → S1 40(a). `normas/` tiene NIIF S2 de junio de 2023, sin 29A–29C | — |
| 2026-10-24 | Encargo escrito | Orden: mapeo y 21(a); luego 22, 14(a) y 13. **S2 28 cerrada sin alta**: párrafo que solo remite (28(a) → 29–31, (b) → 32, (c) → 33–37), resuelto por la iteración de `lib/formato/metricas.ts`. **S2 29B(a) pospuesta** hasta que `normas/` tenga la modificación de 2025 |
| 2026-10-24 | Paso 0 aprobado | Respuestas a §6 registradas arriba. Fase 4 reescrita. Se agregan a §4: ningún padre suma con sus incisos, fotos antes y después de cada migración, y el worktree de vuelta a `dev/ajustes-sep26` al cerrar |
| 2026-10-24 | **Fase 1.** `scripts/formato/auditar-mapeo.mjs` (lectura; plantilla 2025 contra el JSON, con el demo v3 `99992cd3` en dev). 262 filas con datapoint: 201 iguales, 8 parciales, 16 con datapoint más general, 12 S1→S2 sin juzgar y 25 distintas. Errores reales del mapeo: 91, 390 (y 391/392), 433, 437, 462/463 y 488; 329 mal clasificada. La 84 no sale como distinta: su columna G («S1 36-40») contiene el 40. Las demás distintas son erratas de la columna A de la plantilla, ruido de la 2.ª pasada o la deuda 29C | Detenido para que Esteban confirme la lista |
| 2026-10-24 | **Fase 2.** Mapeo corregido en 14 filas (62, 64, 84, 91, 100, 329, 390–392, 433, 437, 462, 463, 488) con `scripts/formato/correcciones-mapeo.mjs`, que también aplica `mapear-formato.mjs` (las salidas pasan a `mapeo-salidas.mjs`, con el `.md` idéntico byte por byte antes de corregir). **Alta de `NIIF S2 21(a)`**, dueño el bloque 10: migración `20261024120000_catalogo_s2_21a` aplicada en local y en dev (local == remoto, barrera 108). Foto de dev antes y después (`scripts/despliegue/foto-cobertura.mjs`): la diferencia es exactamente la esperada, escrita antes de correrla (`NIIF S2 21(a)` nuevo en 1 de 1 emisoras, 0 solicitudes, «sin solicitud»). Respuesta de 21(a) por clave de hechos para documentos aprobados antes del alta (`HECHOS_POR_CLAVE`). Llenado: 433/435/437 con C4; la sección de una actividad que la emisora no tiene se resuelve antes que «sin candidato»; la concentración pasa de K64 a K62. **Respuestas del demo v3 regeneradas** (sin el documento): 189 respuestas, **0.047 USD**. tsc, eslint, `verify:export` (contra dev) y 4 e2e (`respuestas-validadores`, `metricas-instancias`, `formato-electronico`, `respuestas-regeneracion`) en verde. Fase 1 corregida: el parser no leía «NIF S2 …» (350, 371, 373 y 396) ni «EI14 a E18»; antes de corregir eran 21 filas distintas y no 25; después quedan 14, todas explicadas. Abierto: K81 (`NIIF S1 33(c)`) todavía escribe «No aplica… Sin sección en el suplemento»; la descripción de 21(a) se cargó en dev sin la revisión de IRStrat | Detenido con el informe |
| 2026-10-24 | **Fase 3, punto 1 y punto 2 (sin migración).** `textoNoAplicaE5` con el texto aprobado: 34 respuestas del Excel (28 con par de NIIF S2, 6 sin par) y K81. Ninguna celda K tiene «suplemento», «solicitud», «evidencia» ni «IRStrat». K100 da la razón: `emisora.compromiso_transparencia_limitaciones` (de otro libro del documento) por `HECHOS_POR_CLAVE`, pedida en la descripción y exigida por el validador (`HECHO_RAZON`). Respuestas del demo regeneradas dos veces: 0.0179 y 0.0146 USD. Descripciones de los padres reescritas según (b) y (c), pendientes. Abierto: 2 respuestas pendientes del Excel (S2 30 y B65(e)) llevan el marcador de §5, que nombra la solicitud y el suplemento | Detenido para el OK de las descripciones |
| 2026-10-24 | **Fase 3.** Descripciones aprobadas (21(a) y los 4 padres). `HECHO_RAZON` degrada; regla de voz en el validador (`primeraPersonaPlural`) sobre respuestas y celdas K (e2e del Formato). **Cobertura:** los padres, viejos y nuevos, salen de conteos y porcentajes como filas de agrupación (`esPadre`, `contables`), en el tablero y en el informe. Migración `20261024130000_catalogo_padres_fase3` (13 (a)a(b), 14 (a)(i)a(v), 16 (b)a(d), 22 (a)a(b)) en local y en dev: local == remoto, barrera 108. Foto antes y después: exactamente la esperada (4 códigos nuevos, «sin solicitud», 0 solicitudes; NIIF de 113 · 73 cubiertos (65 %) a 109 · 70 (64 %)). Mapeo: 59, 65, 91, 103 y 105 a los padres; 64 y 84 como síntesis sin repetir K65 y K85; 13 suma `cadena_valor.*` y `modelo_negocio.*` (`HECHOS_DEL_PADRE`); un padre no copia oraciones de sus incisos (validador). **Reuso con firma del pedido.** Respuestas regeneradas: 0.0754 USD (todavía sin firma; K64 y K84 salieron reutilizadas) y 0.5281 USD (con firma, regeneración completa). 0 oraciones compartidas entre K59–K60, K64–K65, K84–K85 y K91–K92; K105 = K103 sin E5. tsc, eslint, `verify:export` (contra dev) y los 4 e2e en verde; el informe de Cobertura de dev muestra «/ 109». Auditoría: 15 distintas, todas explicadas (la 91 hereda la columna A de la 85) | Detenido con el informe |
| 2026-10-25 | **Antes de la Fase 4 (revisión de Esteban).** K59: la clave que traía límites sectoriales y unidad de financiamiento sostenible era `modelo_negocio.cambios_2025`, de NIIF S2 14; `/^modelo_negocio\./` sale de `HECHOS_DEL_PADRE` de 13 y la descripción del padre dice que no describe acciones de respuesta. Regeneración: 0.0304 USD (solo el padre de 13, taxonomía y formato). 36(e): «no aplica» por regla (`noAplicaHeredado`), anotado como pendiente del encargo siguiente (§6). Informe de Cobertura de dev: «agrupa incisos · no cuenta» 8 veces en el HTML, una por cada padre de `PADRE_DE` (las otras 8 son los datos de React). **Fase 4:** v42 registrado en la especificación §10 (0.44), con el cambio de porcentajes de Cobertura y la regeneración completa de respuestas en la primera corrida |
| 2026-10-25 | **Fase 4.** PR #31 (`feat/deuda-s2-formato` → `dev/ajustes-sep26`, merge `7f992b3`) y PR #32 (`dev/ajustes-sep26` → `main`, merge `27cce24`), con el comentario de CLAUDE.md §2. Worktree de vuelta en `dev/ajustes-sep26`. **`traceline-dev` v20** (Deploy `27cce240`, `web.1` up, `/login` 200). **Demo v4** (`3487cb77`) generado en `traceline-dev` con `generar-demo.mjs todos` en una sola corrida: 38 bloques en borrador y 2 «no aplica», 0 fallos, 29 páginas, **14.7 min y 11.15 USD en los bloques, más 1.03 USD de coherencia (12.18 USD)**; más que los ~8 USD de §5. **Parada: no se aprueba.** El bloque 10 trae un `[Pendiente: …]` de NIIF S2 21(a) (falta la explicación de por qué no se cuantifican los efectos previstos): el hecho `emisora.compromiso_transparencia_limitaciones` está en el libro del bloque 34 y el bloque 10 no lo ve. Sin aprobación no hay respuestas ni Formato v4. Auditoría vuelta a correr (documento aprobado vigente: v3): las mismas 15 filas distintas de la Fase 3. Sin migraciones contra staging |
| 2026-10-25 | **Fase 4, opción (a).** PR #33 (`fix/bloque10-hecho-transparencia` → `dev/ajustes-sep26`) y PR #34 (`dev/ajustes-sep26` → `main`, merge `13bfde4`), con el comentario de CLAUDE.md §2; worktree de vuelta en `dev/ajustes-sep26`. `traceline-dev` **v21** (`13bfde4`). Bloque 10 del v4 regenerado solo (app local con el código de `main` contra dev; `regenerar-bloques.mjs` solo admite una app local): el primer intento se cortó a los 150 s y volvió a la cola, el segundo salió en borrador por 0.5933 USD, con NIIF S2 21(a) «cubierto» por el hecho propio y el prestado (fuente «hecho del bloque 1, libro a1561e27») y sin marcador. **v4 aprobado** en `traceline-dev` por la pantalla (26/10, 01:20 UTC): documento aprobado vigente del demo; respuestas 194 filas en 187 s, 0.53 USD. Costo total registrado del v4: **13.3073 USD** (especificación §10). Formato v4: validador de entrega sin «#VALUE!» suelto y con 23 imágenes, 0 celdas K con «[» fuera de lista, sin vocabulario ni primera persona; K100 da la razón. Excel v4: 0 celdas con «[», 0 en primera persona. Auditoría contra el v4: las mismas 15 filas distintas, todas explicadas. CLAUDE.md 1.11 (§5). Sin migraciones contra staging |
