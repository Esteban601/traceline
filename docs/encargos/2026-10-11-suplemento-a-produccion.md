# Encargo: Suplemento de calidad a producción (merge de `dev/ajustes-sep26` a `main`, release v40)

Versión 1 · 11 de octubre de 2026. Sale del cierre del encargo `2026-10-06-suplemento-calidad`, cerrado el 11 de
octubre de 2026 con la rúbrica externa: tablas 4, trazabilidad 4 y coherencia 4. Este encargo sigue el mismo guion
que v33 (`2026-10-05-generador-a-produccion.md`). Quedan fuera el Paso 7 (respuestas narrativas en el Excel) y las
deudas de ese encargo.

**Responsable:** Esteban (con Claude Code)
**Rama:** `dev/ajustes-sep26` → `main`, por PR revisado con el asesor (CLAUDE.md §2). Antes, el PR #17
(`feat/suplemento-calidad` → `dev/ajustes-sep26`) mezclado.
**Fecha de inicio:** 11 de octubre de 2026 · **Entrega:** release v40 en `traceline-staging`, registrado en la
especificación §10.
**Referencia:** `CLAUDE.md` v1.9 §1, §3, §6 y §9; especificación §6, §10 («Líneas base del despliegue», «Ensayo de
despliegue», «Ambiente de pruebas en Heroku: `traceline-dev`», «Jobs del Scheduler sin variables en el comando») y
v33/v39; encargo `2026-10-05-generador-a-produccion.md` §5 (guiones).

## 1. Objetivo

Llevar a staging lo que construyó el encargo suplemento-calidad:
- bloques normativos y editoriales;
- adjuntos del Perfil como contexto;
- pasada de coherencia;
- historial y versiones aprobadas;
- libro de hechos con validador cruzado y cierre de pendientes;
- catálogo partido en incisos.

Los clientes reales no pueden verse afectados: Grupo Carso sigue con el generador y la lectura apagados, y su Excel de
taxonomía queda sin diferencias no esperadas. Mismo rigor que v33: inventario, verificaciones de solo lectura, ensayo
en copia, línea base y reversión escritos antes de tocar staging.

## 2. Alcance

Incluye:
- **Inventario de `dev` contra staging.**
  - **Migraciones:** las 16 del PR #17, del `20261006140000` al `20261008140000`, todas posteriores a la última de
    staging (`20261006130000`), así que no hace falta renumerar.
  - **Tablas y buckets nuevos:** `perfil_emisor_adjuntos_contenido`, `observaciones_coherencia`,
    `documentos_bloques_versiones`, `libros_hechos` y `hechos`.
  - **Rutas y pantallas** del suplemento.
  - **Dependencias** de `package.json`.
  - **Variables de entorno.**
  - **Barrera del auditor esperada:** hoy 90; el número después de las 16 se mide en dev.
  - **Llamadas al modelo nuevas:** el libro y el cierre usan Sonnet 5.5, con la misma `ANTHROPIC_API_KEY`.
- **Verificaciones previas sobre staging, de solo lectura:**
  - qué datos de cada emisora toca la migración del catálogo (`20261007170000`): solicitudes enlazadas a los cuatro
    códigos agrupados que reciben enlaces a los incisos, contadas por emisora, **con Grupo Carso aparte**;
  - que ninguna restricción nueva caiga sobre datos existentes (CHECK sustituidos y columnas nuevas);
  - las banderas por emisora (§3);
  - los adjuntos del Perfil que la migración `20261006150000` encolaría para lectura (relleno), por emisora.
- **Ensayo en copia.**
  - Un proyecto Supabase temporal con copia de staging, con el guion de v33: `copiar-staging.sh` y
    `migrar-remoto.sh ensayo`, este último actualizado a las 16 migraciones `ESPERADAS`. El proyecto lo crea Esteban,
    y el ref nuevo entra en los scripts que llevan fijo el anterior.
  - Las migraciones se aplican dos veces; la segunda no debe aplicar nada.
  - Grupo Carso por instantánea, con las diferencias esperadas escritas antes de migrar.
  - Excel de CLEPSA, Banco Base y Grupo Carso con 0 diferencias no esperadas.
  - `main` corriendo sobre la base migrada (`verificar-main`).
  - Auditor de utilería con el panel en lectura.
- **Línea base** en `referencia/lineas-base/v40/` (regla de §10): `antes/` con los Excel desde staging y la
  instantánea de Carso, y `despues/`. La línea base de v40 es el después de v39 si existe; si no, se descarga.
- **A8 corto en `traceline-dev`.**
  - El código de `dev/ajustes-sep26`, con el PR #17 mezclado, va a la app (`git push heroku-dev
    dev/ajustes-sep26:main`), que apunta al dev de Esteban.
  - **Una sola generación completa del demo desde Heroku**, con tiempos por bloque, cortes por tiempo, `after()` del
    libro y de la coherencia, y costo medido frente a los ~$12.4 locales.
  - El Word del demo.
  - El aislamiento del libro y de los documentos entre dos emisoras, con rechazo del servidor.
- **PR de `dev/ajustes-sep26` a `main`**, revisado con el asesor, con el guion de v40 en §5.2.
- **Despliegue v40:** merge y push los hace Claude Code con la autorización de Esteban por chat; las migraciones
  las corre Esteban. Después, comprobaciones y registro en §10.

No incluye:
- el Paso 7 del encargo de calidad (columna «Respuesta» en el Excel);
- encender el generador para Grupo Carso o para cualquier cliente real;
- las deudas del encargo de calidad (§7 de ese encargo): libro sin bloques sugeridos por fuente, observaciones del
  validador cruzado y costo por vuelta;
- cambios funcionales nuevos: lo que no está en `dev` al abrir el PR a `main` no entra.

## 3. Qué toca y qué no

- **Toca:**
  - `main`;
  - `traceline-staging`, con las 16 migraciones y el código;
  - `traceline-dev`, con el código de `dev`;
  - un proyecto Supabase de ensayo temporal;
  - `scripts/despliegue/` y `scripts/ensayo/`, con la lista `ESPERADAS`, el ref de ensayo y los comprobadores de v40;
  - la especificación §10;
  - `README-SCHEMA.md`.
- **No toca:**
  - las banderas de Grupo Carso (siguen apagadas);
  - los datos de Grupo Carso, salvo lo que la migración del catálogo enlace, que se cuantifica en el Paso 2 y se
    decide antes de aplicar;
  - el Scheduler de staging, salvo que el inventario muestre un job nuevo, que se agregaría sin variables en el
    comando (CLAUDE.md §6) y contando los jobs antes y después.
- **Ambientes.**
  - Ensayo y `traceline-dev` para las pruebas.
  - Staging solo con las consultas de solo lectura del Paso 2 y el despliegue del Paso 6.
  - Contra staging no se corre ninguna generación con modelo.

## 4. Definición de terminado

- Inventario y verificaciones previas documentados, con sus consultas y resultados.
- Ensayo en verde:
  - 16 de 16 migraciones y barrera en el número medido;
  - la segunda pasada no aplica nada;
  - Carso con solo las diferencias esperadas;
  - Excel de las tres emisoras con 0 no esperadas;
  - `verificar-main` en verde.
- A8 desde `traceline-dev`: generación completa con tiempos y costo en §7, Word abierto con `verify:word` en verde
  y aislamiento con rechazo del servidor.
- Despliegue v40:
  - migraciones aplicadas;
  - release arriba con el hash del merge;
  - logs sin 5xx ni `Error:`;
  - Excel de las tres emisoras con solo diferencias esperadas;
  - Grupo Carso intacto salvo lo decidido;
  - banderas conforme a §3, por consulta;
  - `POST generar` de Empresa Demo → 200.
- `tsc` limpio, `eslint` sin errores nuevos, `verify:export` en verde y build de producción en verde con los
  servidores apagados (CLAUDE.md §7).
- Registro en la especificación §10 y en §7 de este encargo; `README-SCHEMA.md` al día.
- Reversión documentada: `heroku releases:rollback <release anterior al Deploy> -a traceline-staging`. Las
  migraciones se quedan, porque son aditivas y se prueban con `main` sobre la base migrada.

## 5. Entregables intermedios

0. **Resumen de una página:**
   - inventario de lo que `dev` (con el PR #17) tiene y staging no: migraciones, tablas, buckets, rutas, pantallas,
     banderas, dependencias, variables y llamadas al modelo;
   - barrera esperada medida en dev;
   - qué datos de emisoras toca cada migración;
   - riesgos.

   Parada.
1. **Mezcla del PR #17** a `dev/ajustes-sep26`, con el comentario de revisión, y preparación de los scripts de
   despliegue (`ESPERADAS` de v40, comprobador de v40, instantánea de Carso con las columnas nuevas). Parada.
2. **Verificaciones previas sobre staging**, de solo lectura, con `.env.staging.local` en subshell. Parada con
   resultados y la decisión sobre los enlaces del catálogo en Grupo Carso.
3. **A8 corto en `traceline-dev`**: push de `dev`, una generación completa del demo, tiempos, costo, Word y
   aislamiento. Parada con resultados.
4. **Ensayo completo en copia** (Esteban crea el proyecto y pasa el ref; la copia la corre él) y línea base en
   `referencia/lineas-base/v40/`, con informe. Parada.
5. **PR de `dev/ajustes-sep26` a `main`**, revisado con el asesor, con el guion de v40 en §5.2. Parada.
6. **Despliegue v40:**
   - merge y `git push heroku main` (Claude Code, con autorización por chat);
   - migraciones antes del push (Esteban);
   - comprobaciones y registro;
   - limpieza del proyecto de ensayo (Esteban).

### 5.1 Guion del Paso 3 y del Paso 4 · `traceline-dev` y copia de staging

Igual que §5.1 del encargo de v33, con estos cambios:
- **`traceline-dev` ya existe** y apunta al dev de Esteban (`kmjkoxecxcujxixlxwlb`). El A8 corre contra ese proyecto,
  que ya tiene las 16 migraciones y el demo poblado; ensayo no es necesario para el A8.
- **El proyecto de ensayo es nuevo**, porque `sqpxcxewoznhpwvhxamy` se borró el 5 de octubre. Esteban lo crea con
  Postgres 17, pone `ENSAYO_REF` en `.env.local` y la URL en `.env.ensayo.local` con el editor (nunca con `>>`).
  Claude Code actualiza el ref fijo de los scripts y lo deja fuera de `DEV_REFS_AUTORIZADOS`.
- **Comandos:** se escriben completos en el Paso 1, con los números medidos en el Paso 0.

### 5.2 Guion v40 · despliegue a staging

Se escribe en el Paso 5 con el orden de v33 y v39:
1. merge del PR a `main` (Claude Code);
2. migraciones contra staging (Esteban, `migrar-remoto.sh staging`, revisión y después `--aplicar`);
3. `git push heroku main` (Claude Code);
4. comprobaciones de solo lectura y descargas (Claude Code);
5. registro.

El rollback lo ejecuta Esteban. El número del release de Heroku se confirma en el paso 0 del guion, porque una
config var puesta antes del push lo corre.

## 6. Riesgos y dudas conocidas

- **La migración del catálogo escribe en datos de todas las emisoras**, incluida Grupo Carso: enlaza a los incisos
  toda solicitud enlazada a un código agrupado. El Paso 2 la cuantifica y Esteban decide antes de aplicar. La
  instantánea de Carso debe esperar exactamente esas filas.
- **El relleno de `perfil_emisor_adjuntos_contenido` encola la lectura de los adjuntos del Perfil que ya existen.**
  Con la lectura apagada en Carso no se leen, y se verifica por conteo que no salga ninguno de Carso a la API.
- **Costo:**
  - un documento completo mide ~$12.4 en local, frente a los $8.93 de v33;
  - `generaciones_mes_max` (10) limita las corridas, no el costo;
  - el A8 mide el costo en Heroku.
- **Tiempo en dyno real:** el libro (~4 min) y la coherencia corren con `after()`. El A8 mide si caben en
  `maxDuration` del dyno Basic.
- **`traceline-dev` escribe en el dev de Esteban:** el A8 deja un documento más del demo y gasta de la llave de
  ese ambiente.
- **Conflictos entre `main` y `dev`:** `main` está en `901eae3` y `dev` lo contiene; no se esperan, pero se
  comprueban en el Paso 5.

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-10-11 | Encargo escrito al cerrar el encargo de calidad (PR #17 abierto, sin mezclar) | Mismo guion que v33; A8 corto, con una generación completa desde Heroku; línea base en `referencia/lineas-base/v40/`. Detenido en el Paso 0 |
