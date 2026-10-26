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
