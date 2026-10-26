# Encargo: carga con lectura primero

Versión 1 · 26 de octubre de 2026. Sale de la lectura de la pantalla de carga de evidencia del 26/10. Hoy el paso 3,
«La cifra que reportas», se ve antes de subir el archivo. La lectura corre después de enviar, sin aviso, y su
sugerencia solo aparece al recargar la página. El encargo invierte el orden: el archivo primero, después la lectura,
y la cifra prellenada para confirmar. El encargo `formato-afirmaciones-y-voz` queda en pausa en su rama (`3741af0`).

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/carga-lectura-primero` desde `dev/ajustes-sep26` (`d0ac80f`). Se despliega a `traceline-dev` antes del
PR. El PR a `dev/ajustes-sep26` y a `main` va después de que Esteban lo pruebe ahí con un PDF real.
**Fecha de inicio:** 26 de octubre de 2026 · **Entrega:** la rama en `traceline-dev`, con cuatro capturas de pantalla.
**Referencia:** `CLAUDE.md` v1.11 §3, §6 y §7; especificación §3.3 (captura sugerida).

## 0. Resumen de una página (Paso 0, para aprobación)

**Qué entendí.**

*Hoy:*
- **Pantalla.** `app/portal/solicitudes/[id]/upload-evidencia.tsx` es un formulario con tres pasos visibles a la
  vez: el archivo; el periodo; y la cifra, que es opcional y solo aparece en las solicitudes cuantitativas.
- **Al enviar.** Se registra la evidencia (el trigger avanza el estado y encola la lectura en
  `evidencias_contenido`). La cifra, si se escribió, va directo a `capturas_valor`.
- **La lectura.** Corre en `after()`, y la recoge el cron si no termina. La sugerencia
  (`sugerencias_captura`) solo se ve al recargar la página.
- **Defecto.** `fn_decidir_sugerencia` inserta la captura sin mirar si la evidencia ya tiene una cifra confirmada.

*Lo que pides:*
1. Archivo y periodo, con un botón «Subir y leer». El registro y el trigger se quedan al subir.
2. Sondeo de la lectura cada 3 a 5 s, hasta 90 s.
3. Paso 3 prellenado: cifra, unidad, periodo, fuente y cita, con Confirmar y Corregir mediante
   `fn_decidir_sugerencia`.
4. Cada caso que no da sugerencia muestra su línea y cae al paso 3 manual, que guarda con una acción nueva:
   lectura apagada, tope mensual, fallo técnico, sin hallazgo y los 90 s.
5. No hay doble captura, ni al generar la sugerencia ni al decidirla.
6. El mismo flujo en `carga-panel.tsx` del panel.

**Cómo lo voy a hacer.**

*Estado de la lectura.* Una función de servidor lee, con la sesión del usuario, `evidencias_contenido` y la
sugerencia visible de la evidencia (RLS: `fn_puede_ver_solicitud`). Devuelve una fase:

| Fase | De dónde sale |
|---|---|
| `leyendo` | Lectura pendiente o en proceso, o extraída sin sugerencia todavía |
| `sugerida` | Sugerencia visible, con lo que el paso 3 necesita |
| `sin_hallazgo` | Sugerencia visible sin cifra |
| `apagada` | Lectura `omitido` con la bandera del tenant apagada |
| `tope` | Lectura `omitido` por el tope mensual |
| `fallo` | Lectura `error` o `no_soportado`, o sugerencia `fallida` |
| `con_cifra` | La evidencia ya tiene captura confirmada |

*Pantalla.*
- La fase sale del estado en la base, no del navegador: si el usuario recarga o vuelve más tarde, la última evidencia
  sin cifra confirmada vuelve a mostrar el paso 3, con la sugerencia o el campo manual.
- El sondeo (cada 4 s) corre solo mientras la fase es `leyendo` y no han pasado 90 s desde que se creó la fila de
  lectura.
- Cada línea dice lo que pasó en voz de usuario. No se muestra el error técnico.

*Paso 3 manual.* Una acción nueva, `capturarCifra`, inserta la captura confirmada de la evidencia. La rechaza si ya
existe una.

*Sin doble captura.*
- `generarSugerencia` no sugiere si la evidencia ya tiene una captura confirmada.
- **Migración nueva** (`create or replace` del cuerpo de `fn_decidir_sugerencia`, como ya se hizo en
  `20261005122500`; la firma no cambia y es idempotente). Si ya hay una captura confirmada de esa evidencia, no
  inserta: responde PT409 «Esta evidencia ya tiene una cifra confirmada» y deja la sugerencia como está.
- **Parada antes de aplicarla** en dev (§5).

*Lo que no cambia.*
- Las solicitudes de texto siguen como hoy: el bloque «Extracto sugerido» va bajo la evidencia.
- La justificación de un reemplazo va en el primer momento, con el archivo.
- La lectura en sí (cola, modelo, tope) no cambia.

**Qué voy a tocar.**
- `upload-evidencia.tsx` y `page.tsx` del portal; `actions.ts` del portal, con `capturarCifra` y el estado de la
  lectura.
- `components/sugerencia-bloque.tsx`, con un modo para el paso 3.
- `lib/evidencias/sugerencias.ts`, con la guarda; un `lib/evidencias/estado-lectura.ts` nuevo.
- `app/admin/solicitudes/[id]/carga-panel.tsx` y su acción.
- La migración.
- Los e2e que llenan la cifra antes del archivo (`e2e-captura-sugerida-ui`, `e2e-jefe-sube-evidencia` y los que
  aparezcan) y un e2e nuevo, `e2e-carga-lectura-primero.mjs`.

**Qué no voy a tocar.**
- Staging.
- La cola de lectura y los prompts de sugerencia.
- El trigger.
- Las solicitudes de texto.
- El encargo en pausa.

**Pruebas (stack local, sin modelo).**
- El e2e controla el estado de la lectura con service role, como `e2e-captura-sugerida`. Inserta la evidencia por
  la base para que no corra el `after()`, y después fija la fila de lectura y siembra la sugerencia.
- **Casos:**
  - con hallazgo: confirmar y corregir;
  - sin hallazgo;
  - apagada;
  - tope;
  - fallo;
  - 90 s, con la fila de lectura envejecida;
  - doble captura: cifra manual, después la sugerencia, la regeneración devuelve «con cifra» y
    `fn_decidir_sugerencia` responde 409 sin una segunda fila;
  - una subida real desde el navegador sin llave del modelo (fallo y luego manual);
  - el mismo flujo en el panel.

**Capturas en `traceline-dev`.**
- Con Empresa Demo: portafolio-durango no existe en dev, porque `crear-demo-prospecto.mjs` no se corre contra dev.
- Las cuatro: antes de subir, leyendo, paso 3 prellenado (una lectura real de un Excel del conjunto de prueba, unos
  0.01 USD) y lectura apagada.
- Para la de lectura apagada, apago la bandera de Empresa Demo en dev y la restauro al terminar.

**Dudas (sigo con la opción propuesta si no dices otra cosa).**
1. El sondeo empieza al subir y dura 90 s. Si el usuario recarga después de los 90 s y la lectura sigue en curso,
   propongo mostrar el paso 3 manual con la línea «la lectura sigue en curso».
2. Corregir sin sugerencia es la acción manual: el paso 3 manual no pasa por `fn_decidir_sugerencia`.

## 1. Objetivo

Que quien carga una evidencia cuantitativa suba el archivo y confirme la cifra que la plataforma leyó, en lugar de
escribirla antes. Si la lectura no da una cifra, ve por qué y la escribe.

## 2. Alcance

Lo descrito en §0. **Migración:** una, aditiva por reemplazo de cuerpo (firma igual, idempotente, sin tablas nuevas,
así que no lleva barrera).

Agregado el 26/10 con el OK al Paso 0:
- La comprobación de cifra confirmada también **al guardar** la sugerencia, no solo al generarla. El modelo tarda, y
  la cifra manual puede entrar mientras tanto.
- «Por decidir», en la portada del portal y en el resumen diario, excluye las evidencias que ya tienen cifra
  confirmada.
- Cuando `fn_decidir_sugerencia` responde 409, la pantalla dice «Esta evidencia ya tiene una cifra confirmada».
- Dudas 1 y 2 de §0: como se propusieron.

## 3. Qué toca y qué no

- **Toca:** los archivos de §0; la migración en el stack local y, después del OK, en el dev de Esteban.
- **No toca:** staging, la cola de lectura, los prompts, el trigger ni las solicitudes de texto.
- **Ambientes:** e2e en el stack local; capturas en `traceline-dev`.

## 4. Definición de terminado

- El e2e nuevo, en verde con los casos de §0.
- Los e2e de captura sugerida y de carga, actualizados y en verde.
- `tsc` limpio, `eslint` sin errores nuevos.
- `verify:export`, porque las capturas alimentan el Excel.
- La rama en `traceline-dev`, con las cuatro capturas.
- La bandera de Empresa Demo restaurada en dev.

## 5. Entregables intermedios

- **Paso 0:** este resumen. **Parada.**
- **Fase 1:** implementación y e2e. **Parada antes de aplicar la migración** en dev: te muestro el SQL. Después,
  `traceline-dev` y las cuatro capturas. **Parada:** Esteban prueba en `traceline-dev` con un PDF real.
- **PR** a `dev/ajustes-sep26` y a `main`, después de esa prueba.

## 6. Riesgos y dudas conocidas

- **`after()` en Heroku.** Si el dyno se reinicia a media lectura, el sondeo llega a 90 s y cae al manual. El cron
  la termina después; si para entonces ya hay cifra, no se sugiere. Se acepta.
- **El sondeo** son unas 22 consultas por subida, durante 90 s como máximo, con la sesión del usuario. Se acepta.
- **Las capturas en `traceline-dev`** escriben datos de prueba en Empresa Demo: una evidencia y una captura en una
  solicitud de prueba. Se marcan como de prueba y se dejan anotadas.

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 26/10/2026 | Encargo escrito; Paso 0 | Decisiones de partida de Esteban: el registro y el trigger, al subir; las cinco líneas caen al manual; sin doble captura; el panel, con el mismo flujo. PR después de la prueba en `traceline-dev` |
| 26/10/2026 | OK al Paso 0 | Dudas 1 y 2 como se propusieron. Alcance agregado (§2): la guarda también al guardar la sugerencia, «por decidir» sin evidencias con cifra y el mensaje del 409 |
| 26/10/2026 | Fase 1: implementación y e2e en el stack local, migración aplicada solo en local | `e2e-carga-lectura-primero` 39 de 39, dos corridas seguidas. `e2e-difusion`, `e2e-vb-area`, `e2e-admin-cliente` y `e2e-jefe-sube-evidencia` en verde, con la cifra en el paso 3 manual. `verify:export` en verde contra dev (rama en :3017). `tsc` limpio; `eslint` sin errores (3 avisos previos, en archivos que no se tocaron). `e2e-captura-sugerida`: falla la aserción del Excel de la solicitud de Alcance 3 categoría 15. Probablemente es previa: con C4, esa celda no muestra la cifra; no se comprobó. `e2e-captura-sugerida-ui` no se corrió: necesita la llave del modelo. **Hallazgo:** en el stack local, `service_role` no tiene SELECT sobre `capturas_valor`, y la consulta con `head` devolvía «sin cifra» sin error. En dev el permiso existe. La migración agrega el `grant` (no-op en dev y staging), y las consultas fallan cerradas. **Parada:** SQL de la migración antes de aplicarla en dev |
| 26/10/2026 | Comprobaciones antes de aplicar en dev | **(1)** `e2e-captura-sugerida` también falla en `dev/ajustes-sep26` (`d0ac80f`), después de un reset limpio: «al validar, la cifra confirmada aparece en el Excel (0 celdas cambiaron)». **Deuda previa, con causa:** el e2e (4/10) prueba la cifra en la solicitud de Alcance 3 categoría 15 (`gei_a3_cat_15`). Desde `2f44c3b` (13/10), con C4 vigente en el demo, `alivioDeCelda` escribe «No revelado · alivio C4» en esa celda, valide o no. Se corrige en el e2e: otra solicitud, o C4 apagado durante la prueba. No es de esta rama. **(2)** Reset del stack local desde los archivos (`supabase db reset --local`), con la migración aplicada desde su archivo y sin pasos a mano: `e2e-carga-lectura-primero` 39 de 39. **(3)** Privilegios de `service_role` en dev (`scripts/despliegue/privilegios-service-role.sql`, por la Management API, solo lectura): las 37 tablas de `public` tienen los 7 privilegios. En local, solo 1 de 37 los tiene todos; `evidencias` no tiene SELECT. **El día de staging, antes de migrar,** se corre el mismo script contra staging y se compara con dev: si staging no tiene SELECT de `service_role` sobre `capturas_valor`, el `grant` de la migración sí cambia algo ahí, y se anota |
| 26/10/2026 | Migración en dev y despliegue a `traceline-dev` | OK de Esteban a `20261026120000` como aditiva. **Dev:** ref `kmjkoxecxcujxixlxwlb` verificado; `supabase db push` (dry-run: solo esta migración); `migration list` local == remoto; tipos regenerados desde dev, idénticos. Comprobado en dev: la función tiene la guarda; `service_role` con SELECT sobre `capturas_valor`; 228 políticas. **`traceline-dev` v22** (`a36c329`). Es una rama local de despliegue: esta rama más el merge de `13bfde4` (el `main` desplegado), sin diferencia de contenido. Se usó porque `13bfde4` no está en dev y no se usa `--force`. **Capturas** con Empresa Demo (`operaciones@`): antes de subir, leyendo, paso 3 prellenado (lectura real del Excel x01: 376,300 kWh, hoja «Energía», B14, confianza media) y lectura apagada. La bandera se restauró a `true` y se comprobó. **Datos de prueba en dev:** solicitudes «[Prueba] … lectura encendida» (`1b867b7f`, sugerencia sin decidir), «[Prueba] … lectura apagada» (`ffd7b1e3`, sin cifra) y tres «[Prueba PDF] …» para la prueba de Esteban (`370674c5`, `77dd2879`, `9f3ee113`). Una duplicada sin evidencia (`49c7bbe4`) se borró. **Parada:** prueba de Esteban con un PDF real; PR después |
| 26/10/2026 | Prueba de Esteban en `traceline-dev` y correcciones (1)–(4) | **Resultado de la prueba:** con hallazgo, la lectura fue rápida, pero Confirmar se quedaba en espera hasta recargar. Sin hallazgo funcionó. En el escaneado propuso 4,080 kWh (la fila de diciembre, confianza baja) en vez del total de 49,350, y al corregir a 546 el periodo quedó «diciembre 2025». El caso de la cifra manual durante la lectura no se reprodujo a mano; lo cubre el e2e. **(1) Causa de la espera:** en el build de producción de Next 15.5.20, una acción que revalida en una página bajo un `loading.tsx` deja la transición sin terminar: la respuesta llega completa, pero la pantalla no se actualiza. Se reprodujo en local con `next build` + `next start`. También pasa en `dev/ajustes-sep26`: la subida del panel se queda girando 3 de 3, y quitar `app/admin/loading.tsx` lo resuelve. Antes no se veía porque los e2e corrían contra `next dev`. Se quitaron los tres `loading.tsx` (`/admin`, `/portal` y `/portal/solicitudes/[id]`), y el sondeo pasó de una acción de servidor a `GET /api/evidencias/lectura`. **(2)** La línea de sin hallazgo lleva la unidad: «No encontramos una cifra en kWh en este archivo. Puedes escribir la cifra aquí.» **(3)** En el historial, la cifra vigente va grande y primero; la sugerencia decidida va plegada («Sugerencia corregida: 4,080 → 546 kWh»). **(4)** Corregir propone el periodo de la solicitud y muestra el de la cifra del archivo cuando difiere. **Verificación:** `e2e-carga-lectura-primero` 47 de 47 contra el build de producción, tres corridas seguidas (comprueba sin recargar). `e2e-difusion`, `e2e-vb-area`, `e2e-admin-cliente` y `e2e-jefe-sube-evidencia` en verde contra el mismo build; `verify:export` en verde contra dev; `tsc` limpio; `eslint` sin errores. **(5)** Diagnóstico y propuesta en §8. **Parada** antes de cambiar la regla |
| 26/10/2026 | Despliegue a `traceline-dev` v23 y v24 | **v23** (`46360a3`) con (1)–(4). La prueba de humo encontró un error de hidratación (React #418) en la página con la sugerencia decidida: la fecha con hora salía en UTC en Heroku y en la zona del navegador en el cliente. Se arregló con `fmtFechaHora` (hora de México), y el e2e ahora corre el navegador en otra zona. **v24** (`f55e3e0`): sin errores de página. **Solicitudes nuevas para la prueba:** «[Prueba PDF 2] … · con hallazgo» (`09596c53`), «· sin hallazgo» (`ab992b8a`) y «· escaneado» (`93a0523e`). Las de la ronda anterior se quedan con su evidencia y su cifra. **Parada:** prueba de Esteban y OK a la propuesta de §8 |
| 26/10/2026 | Diferencia con staging; OK a la regla de (5); `sug-num-3` | **«Pushed to main»** fue `git push heroku-dev despliegue/carga-lectura-primero:main` (`traceline-dev`); `origin/main` sigue en `13bfde4`. **Staging v41 no se queda girando** con los `loading.tsx` puestos: no es la versión (15.5.20 en los tres lockfiles), ni el compilador (con Turbopack en local también falla, 4 de 4), ni el navegador sin ventana. Es la entrega de la respuesta: en localhost llega en trozos casi sin latencia y falla 2 de 4; servida completa, con 1, 150 o 400 ms, 8 de 8 bien. Va a la cola (§9); el parche se queda en este PR. **`sug-num-3`**, con el OK de Esteban: el total que cubre el periodo es la principal; una parcial nunca lo es; sin total, «sin hallazgo» con las parciales de referencia sin prellenar; relectura a más resolución de la línea [ilegible], contada en el tope (`segunda_opinion.relectura.realizada`). **Hallazgo en el camino real:** la transcripción de visión agregó bajo la línea ilegible «(se alcanza a leer "46,350 kWh" parcialmente)», y salió como principal con confianza media. Es un dato inventado. Se corrigió: el transcriptor ya no anota lecturas a medias, y con la línea de la cifra [ilegible] no hay principal. **Verificación** contra el build de producción con Turbopack: `e2e-carga-lectura-primero` 51 de 51; `e2e-difusion`, `e2e-vb-area`, `e2e-admin-cliente` y `e2e-jefe-sube-evidencia` en verde; `e2e-sugerencia-total-periodo` 12 de 12 sin modelo y 8 de 8 con modelo (0.23 USD). Camino real con modelo (cola → sugerencia → relectura), dos corridas: p09 da 49,350 con los 12 meses como alternativas; p10 da «sin hallazgo» con la relectura hecha («sigue ilegible: parece 49,350 pero el primer dígito se confunde») y los 12 meses de referencia. El filtro del tope cuenta las relecturas. `verify:export` en verde contra dev |
| 26/10/2026 | **Cierre** | **Prueba de Esteban en v25:** con el escaneado limpio, 49,350 como principal, confianza alta y los 12 meses como alternativas plegadas; con el escaneado encimado, «sin hallazgo» con los meses de referencia, sin prellenar. **Antes del PR:** «Usar esta cifra» en una parcial fija su periodo y muestra «Esta cifra cubre <periodo>; la solicitud pide <periodo>»; la línea de sin hallazgo con parciales es la de Esteban, sin el motivo del modelo. `e2e-carga-lectura-primero` 56 de 56 contra el build de producción con Turbopack; los otros cuatro e2e en verde; `verify:export` en verde. **Datos de prueba en dev:** se borraron las 9 solicitudes «[Prueba…]» de Empresa Demo (las de las capturas y las de las tres rondas), con sus capturas, evidencias, lecturas y sugerencias, y sus 9 archivos de Storage. La bandera de lectura quedó en `true`. **PR #35** (`feat` → `dev/ajustes-sep26`, `03f7600`) y **PR #36** (`dev` → `main`, `f778831`), mezclados con el comentario de siempre. **Entran a v42 tres migraciones**, en orden: `20261024120000_catalogo_s2_21a`, `20261024130000_catalogo_padres_fase3` y `20261026120000_decidir_sugerencia_sin_doble_captura`; las tres están anotadas en el registro de v42 de la especificación (§10, 0.45). **Privilegios de `service_role`:** el día de staging, antes de migrar, se corre `scripts/despliegue/privilegios-service-role.sql` contra staging y se compara con dev (37 tablas con los 7 privilegios). Si falta SELECT sobre `capturas_valor`, el `grant` de la tercera migración cambia algo ahí y se anota. Encargo cerrado; sigue `actualizar-next-y-restaurar-loading` (§9) |

## 8. Selección de candidatos: diagnóstico y propuesta (pendiente de OK)

**Cómo elige hoy** (`lib/evidencias/sugerir.ts`, `sug-num-2`):
- Una llamada a Sonnet devuelve `encontrado`, una `principal` y hasta tres `candidatos`.
- La única regla de prioridad es la del año: si hay varios años, la principal es la del periodo del reporte.
- No hay regla de total contra filas parciales dentro del mismo año, y está prohibido sumar.
- El código verifica cada cifra contra el texto. Si la principal no existe o no se verifica, el primer candidato
  verificado **sube a principal** con confianza baja.
- Con confianza baja se pide la segunda opinión de Fable, que solo agrega un candidato.

**Por qué propuso «Diciembre | 4,080»:**
- La transcripción de visión del escaneado dice «Consumo total del período [ilegible] kWh», así que el modelo nunca
  vio 49,350.
- Las dos lecturas respondieron `encontrado = false`, porque el total era ilegible y sumar los meses está prohibido.
- Diciembre llegó como candidato «parcial», y el código lo subió a principal.
- No es una preferencia del modelo por la fila sobre el total: el total no estaba en el texto.
- No se comprobó si el total se lee en la imagen del PDF.

**`prueba-con-hallazgo.pdf`** (PDF con texto): propuso 49,350 kWh, periodo 2025, página 1, cita «Consumo total del
periodo49,350 kWh», confianza alta, sin candidatos. Se confirmó así.

**Propuesta** (`sug-num-3`, sin migración):
1. **Regla del prompt.** Si la solicitud cubre un periodo y el archivo trae un total que lo cubre, ese total es la
   principal. Las filas parciales (meses, trimestres, plantas) van como candidatos, con su periodo. Una fila parcial
   nunca es la principal.
2. **Regla del código.** El esquema agrega `cubre_periodo` (booleano) a cada cifra. Una cifra que no cubre el
   periodo de la solicitud nunca sube a principal. Si no queda ninguna que lo cubra, la sugerencia es
   `sin_hallazgo`: la línea de sin hallazgo, el motivo («el total del periodo aparece ilegible»), y las cifras
   parciales a la vista como referencia, sin prellenar el paso 3.
3. **Ilegible.** Si la transcripción marca `[ilegible]` en la línea de la cifra pedida, esa página se vuelve a leer
   con visión a más resolución y enfocada en esa línea; es una llamada más, solo en ese caso. Si sigue ilegible,
   aplica el punto 2.
4. **e2e** con los dos textos de prueba: total legible (principal 49,350, con los meses como alternativas) e
   ilegible (sin hallazgo, con los meses de referencia).

**Resolución (26/10):** OK de Esteban, implementado como `sug-num-3` (ver §7). Diferencias con la propuesta:
- `cubre_periodo` va en cada cifra.
- La relectura usa la imagen incrustada del PDF, o la foto sin reducir, en franjas con traslape. Un PDF sin imagen no
  se relee.
- Se agregó la regla «con la línea de la cifra [ilegible], no hay principal», por el hallazgo del camino real.

## 9. Encargo siguiente, fuera de este: `actualizar-next-y-restaurar-loading`

- **Causa:** una carrera del cliente de Next/React. Aparece cuando una acción que revalida responde en trozos con
  latencia cero, bajo un `loading.tsx`: la respuesta llega completa, pero la transición no termina y la pantalla se
  queda en espera.
- **Dónde se ve:** se reproduce con `next build` + `next start` en local, con webpack y con Turbopack, y en
  `dev/ajustes-sep26` (la subida del panel). En Heroku no se ha reproducido: staging v41 tiene los `loading.tsx` y la
  subida del panel termina, según la prueba de Esteban.
- **Parche vigente:** este PR quita los tres `loading.tsx` (`/admin`, `/portal` y `/portal/solicitudes/[id]`).
- **Prueba pendiente:**
  1. Desplegar a `traceline-dev` la ruta GET de la lectura con los `loading.tsx` restaurados.
  2. Correr Confirmar y la subida del panel diez veces cada uno contra Heroku.
  3. Con eso, decidir entre restaurarlos, actualizar Next o las dos cosas.
