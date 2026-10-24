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
  - **S2 13:** toma `cadena_valor.*` y `modelo_negocio.*`, y K59 deja de repetir K60.
- Una migración aditiva para la tanda.
- **S2 28:** cerrada sin alta, resuelta por la iteración de `lib/formato/metricas.ts` (§7).
- **S2 29B(a):** pospuesta hasta que `normas/` tenga la modificación de NIIF S2 de 2025 (la pone Esteban; la edición
  local es la de junio de 2023 y no trae 29A–29C).
- Prueba en local con los criterios de la Fase 2.
- **Parada:** informe.

### Fase 4 · Integración y despliegue (con el OK)

- PR `dev/ajustes-sep26` → `main`, mezclado con el comentario de siempre (CLAUDE.md §2).
- Esteban corre la migración contra staging con `scripts/despliegue/migrar-remoto.sh` (CLAUDE.md §1).
- **Despliegue v42**, primero a `traceline-dev`.
- **Demo v4 en dev:** una sola corrida de regeneración (cerca de 8 USD, §5).
- **Formato v4:** con la lista de la Fase 1, para el lector externo.
- **Staging:** se despliega después de la lectura externa, con su registro en la especificación §10.

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
  - Fases 1 a 3: código local contra el dev de Esteban (`kmjkoxecxcujxixlxwlb`) en lectura, y el stack local para las
    migraciones.
  - Fase 4: `traceline-dev` y, después de la lectura externa, staging.
  - Nada contra staging antes de la Fase 4.

## 4. Definición de terminado

- **Auditoría de la Fase 1, vuelta a correr al final:** 0 discrepancias no explicadas.
- **K433 y K437:** con C4, «No revelado · alivio C4»; sin C4, vacías como pendiente, igual que K435.
- **K84, K91 y K100:** sin «Sin sección en el suplemento». En ninguna celda K del Formato del demo aparecen
  «suplemento», «solicitud», «evidencia» ni «IRStrat».
- **K100:** responde con los hechos de los bloques 10 y 34, sin dato inventado.
- **K105, K65 y K59:** responden con su código padre; K59 ya no es igual a K60.
- **`validarMapeo()`:** 0 faltantes; `supabase migration list` igual en local y en remoto.
- **Validador del Formato:** 23 imágenes enlazadas, 0 «#VALUE!» y 0 celdas K con «[».
- `tsc` limpio, `eslint` sin errores nuevos, `npm run verify:export` en verde, y e2e `e2e-formato-electronico` y
  `e2e-metricas-instancias` en verde.
- v42 registrado en la especificación §10.

## 5. Entregables intermedios

- Paso 0: resumen de §0. **Parada.**
- Fase 1: lista de discrepancias, más K62 y K64. **Parada:** Esteban confirma la lista.
- Fase 2: correcciones, S2 21(a) y textos de las seis celdas. **Parada:** informe.
- Fase 3: códigos padre y textos de K59, K65 y K105. **Parada:** informe.
- Fase 4: PR, v42 en `traceline-dev`, demo v4 y Formato v4 para el lector externo. **Parada:** informe. Staging,
  después de la lectura.

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

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-10-24 | Paso 0 de lectura de los seis códigos (sin código). Demo v3 = documento `99992cd3` en dev. Errores fuera de los seis: 433/437 → `NIIF S2 EI14 a E18` (Alcance 1), 390 → 13(a), 84/91 → S1 40(a). `normas/` tiene NIIF S2 de junio de 2023, sin 29A–29C | — |
| 2026-10-24 | Encargo escrito | Orden: mapeo y 21(a); luego 22, 14(a) y 13. **S2 28 cerrada sin alta**: párrafo que solo remite (28(a) → 29–31, (b) → 32, (c) → 33–37), resuelto por la iteración de `lib/formato/metricas.ts`. **S2 29B(a) pospuesta** hasta que `normas/` tenga la modificación de 2025 |
