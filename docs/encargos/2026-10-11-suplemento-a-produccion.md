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
**Estado:** **cerrado el 13 de octubre de 2026.** v40 está en staging (`Deploy e6e33089`), con todas las
comprobaciones en verde, y el proyecto de ensayo se borró y limpió (§7).
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
  - **Migraciones:** 18: las 16 del PR #17 (`20261006140000` a `20261008140000`) y las 2 del PR #18
    (`20261011120000` y `20261011121000`), todas posteriores a la última de
    staging (`20261006130000`), así que no hace falta renumerar.
  - **Tablas y buckets nuevos:** `perfil_emisor_adjuntos_contenido`, `observaciones_coherencia`,
    `documentos_bloques_versiones`, `libros_hechos` y `hechos`.
  - **Rutas y pantallas** del suplemento.
  - **Dependencias** de `package.json`.
  - **Variables de entorno.**
  - **Barrera del auditor esperada:** hoy 90; después de las 18, **105** (medida en dev).
  - **Llamadas al modelo nuevas:** el libro y el cierre usan Sonnet 5.5, con la misma `ANTHROPIC_API_KEY`.
- **Verificaciones previas sobre staging, de solo lectura:**
  - qué datos de cada emisora toca la migración del catálogo (`20261007170000`): solicitudes enlazadas a los cuatro
    códigos agrupados que reciben enlaces a los incisos, contadas por emisora, **con Grupo Carso aparte**;
  - que ninguna restricción nueva caiga sobre datos existentes (CHECK sustituidos y columnas nuevas);
  - las banderas por emisora (§3);
  - los adjuntos del Perfil que la migración `20261006150000` encolaría para lectura (relleno), por emisora.
- **Ensayo en copia.**
  - Un proyecto Supabase temporal con copia de staging, con el guion de v33: `copiar-staging.sh` y
    `migrar-remoto.sh ensayo`, este último actualizado a las 18 migraciones `ESPERADAS`. El proyecto lo crea Esteban,
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

### 2.1 Inventario final (Paso 1, 11 de octubre de 2026)

`dev/ajustes-sep26` en `a5de3da` (PR #17 y #18 mezclados) contra staging en v39 (`901eae3`, 68 migraciones,
barrera 90).

| Migración | Qué crea o cambia | Datos existentes que toca |
|---|---|---|
| `20261006140000_suplemento_editoriales` | `documentos_generados.editoriales_incluidos`; CHECK de estado del bloque ampliado | — |
| `20261006150000_perfil_adjuntos_contenido` | Tabla `perfil_emisor_adjuntos_contenido` (RLS, barrera) y trigger de encolado | Relleno: una fila por adjunto del Perfil ya existente; «omitido» si la lectura de la emisora está apagada |
| `20261006160000_suplemento_texto_del_emisor` | `documentos_generados.textos_literales`; `documentos_bloques.texto_del_emisor` | — |
| `20261006160100_observaciones_coherencia` | Tabla `observaciones_coherencia` | — |
| `20261006170000_documentos_bloques_versiones` | Tabla de historial (solo altas), triggers; `origen_texto`, `restaurada_de`, `versiones_aprobadas` | Relleno: versión 1 de cada bloque con texto |
| `20261007120000_libro_hechos` | Tablas `libros_hechos` y `hechos` | — |
| `20261007130000`, `…161000`, `…180000`, `20261008120000`, `…130000`, `…140000` | CHECK ampliados (estados, alcance, veredicto, origen, tipos) | — |
| `20261007140000_documentos_bloques_cobertura` | `documentos_bloques.cobertura` y `libro_id` | — |
| `20261007150000_perfil_glosario` | `perfil_emisor.glosario` (default `[]`) | — |
| `20261007160000_libro_estable` | Columnas de `hechos`; `documentos_bloques.anclas` | — |
| `20261007170000_catalogo_incisos` | 18 filas en `datapoints_taxonomia` | Enlaces de solicitudes de **todas las emisoras** a los incisos y la plantilla global (Paso 2 los cuenta) |
| `20261011120000_versiones_respaldo` | `documentos_bloques_versiones.respaldo` y `libro_id`; función del trigger de versiones | — |
| `20261011121000_documentos_cierre_estado` | `documentos_generados.cierre_estado`, `cierre_resultado`, `cierre_actualizado_en` | — |

- **Barrera:** 105 (90 + 15 de las cinco tablas nuevas), medida en dev después de las 18.
- **Rutas nuevas:** `/api/suplemento/[destino]/hechos` (GET, POST), `cierre` (GET, POST 202), `coherencia` (GET, POST)
  y `cruzado` (GET). **Modificadas:** `generar`, `bloque/[n]` y `word`.
- **Pantallas:** pre-vuelo con el libro en el generador; historial, coherencia y estado del cierre en la revisión;
  estado de lectura de los adjuntos y glosario en el Perfil.
- **Banderas y topes:** ninguno nuevo. Las rutas que llaman al modelo exigen `generador_activo`. El libro y la
  coherencia manuales exigen corridas disponibles en el mes (PR #18). La lectura de adjuntos usa
  `lectura_evidencias_activa`.
- **Dependencias:** sin cambios en `dependencies` ni en `pnpm-lock.yaml`.
- **Config vars:** no falta ninguna obligatoria en `traceline-staging`. Opcionales: `COHERENCIA_ESFUERZO` (`medium`
  por defecto). `SUPLEMENTO_PRUEBA` es solo para `traceline-dev`.
- **Excel de taxonomía de todas las emisoras (corrección del 13 de octubre de 2026):** la plantilla
  `assets/taxonomia-base.xlsx` lleva **18 filas más** en la hoja «Taxonomía NIIF S1 S2», una por inciso, desde el commit
  `d2bc8af`. Esas filas desplazan el resto de la hoja. Es una diferencia esperada. El Anexo A de la especificación ya lo
  decía, pero la descripción del PR #17 y el inventario del Paso 0 afirmaron que la exportación no cambiaba: solo se
  había revisado la ruta y `ensamblar.ts`, no la plantilla. Se midió en el ensayo: **435 celdas esperadas por emisora y
  0 no esperadas** con `comparar-excel-v40.mjs`. El código de `main` sobre la base migrada da el Excel idéntico, así
  que el cambio es de código, no de datos.
- **Scripts de v40** (rama `chore/despliegue-v40`):
  - `migrar-remoto.sh`: las 18 `ESPERADAS` y barrera 105. «ensayo» falla hasta que exista el ref de v40.
  - `comprobar-v40.mjs`:
    - banderas antes y después;
    - los 18 incisos;
    - Carso sin libro, hechos, coherencia ni historial, con sus adjuntos en «omitido»;
    - la ruta del cierre;
    - `POST generar`.
  - `instantanea-v40.sql`: Carso, con las tablas del suplemento y los enlaces a incisos en una línea aparte.
- **Ref fijo del ensayo borrado** (`sqpxcxewoznhpwvhxamy`), a cambiar en el Paso 4: `copiar-staging.sh`,
  `migrar-ensayo.sh`, `a8-heroku.mjs`, `crear-utileria.mjs`, `verificar-main.mjs`, `rotar-cuentas-seed.mjs`, y como
  rechazo `poblar-demo.mjs` y `crear-demo-prospecto.mjs`.

## 3. Qué toca y qué no

- **Toca:**
  - `main`;
  - `traceline-staging`, con las 18 migraciones y el código;
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
  - 18 de 18 migraciones y barrera 105;
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
  que ya tiene las 18 migraciones y el demo poblado; ensayo no es necesario para el A8.
- **El proyecto de ensayo es nuevo**, porque `sqpxcxewoznhpwvhxamy` se borró el 5 de octubre. Esteban lo crea con
  Postgres 17, pone `ENSAYO_REF` en `.env.local` y la URL en `.env.ensayo.local` con el editor (nunca con `>>`).
  Claude Code actualiza el ref fijo de los scripts y lo deja fuera de `DEV_REFS_AUTORIZADOS`.
- **Comandos:** se escriben completos en el Paso 1, con los números medidos en el Paso 0.

### 5.2 Guion v40 · despliegue a staging

Release de Heroku esperado: **v40**. Staging está en v39 y no se pone ninguna config var antes del push; si se
pusiera una, el `Deploy` correría un número. Ningún comando imprime una URL, una llave ni una contraseña.
- Los comandos de staging se corren desde la copia `~/Repositorios/vert-evidencia`, que tiene `.env.staging.local` y
  `.credenciales-demo/`.
- Tras el merge, los scripts de v40 están en `main` y se corren desde esa misma copia.
- `D=referencia/lineas-base/v40`.

**Orden y por qué.** Es el de v33 y v39: la base se migra antes de que llegue el código.
- El código de `dev` necesita las columnas nuevas.
- El código actual de `main` corre sobre la base migrada. En el ensayo (Paso 4) dio el Excel idéntico celda por celda
  en las tres emisoras, y `verificar-main` 26 de 26.
- `migrar-remoto.sh staging` exige `HEAD = origin/main`. Por eso el PR se mezcla primero, cosa que no despliega nada;
  después Esteban migra desde `main`, y al final va el push.

**0. Antes (Claude Code, solo lectura).** La línea base se vuelve a tomar el día del despliegue, porque Grupo Carso
pudo trabajar desde el 13/10.
```sh
cd ~/Repositorios/vert-evidencia
C=.credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json; APP=https://traceline-staging-70ce5b369e7c.herokuapp.com; D=referencia/lineas-base/v40
heroku releases -a traceline-staging -n 1                # v39 · Deploy 901eae36
heroku config -a traceline-staging --json | python3 -c "import json,sys; print(sorted(json.load(sys.stdin).keys()))"   # 11 nombres, sin cambios
(set -a; source .env.staging.local; set +a
 BASE_URL=$APP node ../vert-evidencia-dev/scripts/ensayo/descargar-excel.mjs --credenciales $C $D/antes clepsa banco-base gcarso
 node ../vert-evidencia-dev/scripts/despliegue/comprobar-v40.mjs --antes $D/antes --credenciales $C)   # banderas → antes/banderas.json
```
Esteban, además, toma la instantánea de Carso «antes» con `scripts/ensayo/instantanea-v40.sql` en
`$D/antes/instantanea-v40.txt` (24 líneas), con el mismo comando del Paso 4.

**1. Merge del PR (Claude Code, con la autorización de Esteban por chat, CLAUDE.md §9).**
```sh
gh pr merge <n> --merge                          # merge commit, con el comentario de revisión
cd ~/Repositorios/vert-evidencia && git fetch origin && git merge --ff-only origin/main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" && echo "HEAD = origin/main ✓"   # con --short, dos revisiones fallan
nvm use 22 && pnpm install --frozen-lockfile
```

**2. Migraciones contra staging (Esteban, en su terminal).** Si el host directo de Supabase no resuelve en la red, se
usa la URL del **session pooler**, con usuario `postgres.<ref>`. El script la acepta porque lleva el ref, igual que en
el ensayo.
```sh
cd ~/Repositorios/vert-evidencia && git status --short && git rev-parse --short HEAD   # limpio, = origin/main
mkdir -p referencia/lineas-base/v40/despues          # la carpeta de la instantánea de después
read -rs STAGING_DB_URL && export STAGING_DB_URL       # se pega sin eco
bash scripts/despliegue/migrar-remoto.sh staging                # revisión: 18 pendientes == ESPERADAS
bash scripts/despliegue/migrar-remoto.sh staging --aplicar      # pide el ref; al final: nada pendiente, 86 de 86, barrera 105
/opt/homebrew/opt/postgresql@17/bin/psql "$STAGING_DB_URL" -X -A -t -v ON_ERROR_STOP=1 \
  -f scripts/ensayo/instantanea-v40.sql > referencia/lineas-base/v40/despues/instantanea-v40.txt
unset STAGING_DB_URL
diff referencia/lineas-base/v40/antes/instantanea-v40.txt referencia/lineas-base/v40/despues/instantanea-v40.txt   # sin salida
```
- **Carso, resultado esperado:** instantánea **idéntica en las 24 líneas**, con `mapeo_solicitud_datapoint:incisos|0`.
  Así salió en el ensayo: staging y la copia migrada, idénticas.
- Una línea distinta se revisa por `created_at` (actividad de Carso entre las dos tomas) antes de seguir. Si no se
  explica así, se detiene el despliegue: el código no ha salido y no hay nada que revertir en Heroku.
- **La CLI de Supabase imprime un aviso de `pg-delta`** con una pila al aplicar. `migrar-remoto.sh` lo filtra y no
  depende de él: verifica con `--dry-run`, `migration list` y la barrera.

**3. Despliegue (Claude Code, con la autorización de Esteban por chat).**
```sh
cd ~/Repositorios/vert-evidencia && test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" && echo "HEAD = origin/main ✓"
git push heroku main
heroku releases -a traceline-staging -n 2        # v40 · Deploy <sha de main>
heroku ps -a traceline-staging                   # web.1: up
```

**4. Comprobaciones (Claude Code; solo lectura y descargas, salvo lo marcado).**
```sh
cd ~/Repositorios/vert-evidencia
C=.credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json; APP=https://traceline-staging-70ce5b369e7c.herokuapp.com; D=referencia/lineas-base/v40

# a) Logs: solo conteos.
curl -s -o /dev/null -w "%{http_code}\n" $APP/login                                     # 200
heroku logs -a traceline-staging -n 1500 | grep -c -E 'status=5[0-9]{2}'                # 0
heroku logs -a traceline-staging -n 1500 | grep -c -E 'Error:|Unhandled'                # 0

# b) Banderas iguales a las de antes, 18 incisos, Carso sin libro/hechos/coherencia/historial y adjuntos en
#    «omitido», y la ruta nueva del cierre (GET → 200).
(set -a; source .env.staging.local; set +a; BASE_URL=$APP node scripts/despliegue/comprobar-v40.mjs --despues $D/despues --credenciales $C)

# c) Excel de las tres emisoras contra la línea base: solo diferencias esperadas.
(set -a; source .env.staging.local; set +a; BASE_URL=$APP node scripts/ensayo/descargar-excel.mjs --credenciales $C $D/despues/excel clepsa banco-base gcarso)
git show 901eae3:assets/taxonomia-base.xlsx > $D/despues/plantilla-v39.xlsx
git show origin/main:assets/taxonomia-base.xlsx > $D/despues/plantilla-v40.xlsx
for s in clepsa banco-base gcarso; do
  node scripts/ensayo/comparar-excel-v40.mjs $D/antes/$s.xlsx $D/despues/excel/$s.xlsx \
    --plantilla-antes $D/despues/plantilla-v39.xlsx --plantilla-despues $D/despues/plantilla-v40.xlsx --catalogo $D/despues/catalogo.json
done                                                       # cada uno: 0 no esperadas (en ensayo: 435 esperadas)

# d) Vitrina de Banco Base (escribe dos filas de bitácora del mockup, a propósito).
(set -a; source .env.staging.local; set +a; BASE_URL=$APP node scripts/despliegue/comprobar-vitrina.mjs $D/despues/vitrina banco-base --credenciales $C)

# e) Generador de Empresa Demo (ESCRIBE: abre el documento con sus bloques en cola, sin modelo; cuenta 1 corrida).
(set -a; source .env.staging.local; set +a; BASE_URL=$APP node scripts/despliegue/comprobar-v40.mjs --generar --credenciales $C)   # POST generar → 200
```
- **Scheduler:** v40 no agrega jobs. Se cuentan los dos de staging (cola y recordatorios), y en la siguiente corrida de
  la cola se busca `evidencias/procesar.*status=200` por conteo, sin imprimir líneas.

**5. Registro.** Claude Code escribe la entrada de v40 en la especificación §10: release, sha, migraciones y
resultados de 2 y 4. También anota el despliegue en §7 de este encargo y hace push a `origin`.

**Rollback (lo ejecuta Esteban).** Solo de código:
```sh
heroku releases:rollback v39 -a traceline-staging
```
- Si el número del `Deploy` cambia porque se puso una config var antes, el destino es el release inmediatamente
  anterior al `Deploy`.
- Las migraciones se quedan: son aditivas, y `main` corre sobre la base migrada (ensayo, Paso 4).
- Si el problema es del generador, antes que el rollback está la bandera: se apaga `generador_activo` por emisora en
  `/admin/clientes`.

**Limpieza (Esteban).** Borrar el proyecto de ensayo `vdubzcjtujxayefzhhco`, y con él `.env.ensayo.local`,
`.env.ensayo-app.local` y la línea `ENSAYO_REF` de `.env.local`.

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
| 2026-10-11 | **Paso 0 aprobado** (inventario en el chat: 16 migraciones, barrera esperada 105, sin dependencias nuevas, sin config vars obligatorias que falten). Antes del Paso 1, rama `fix/pre-v40` con las tres observaciones de Codex sobre el PR #17. **(1)** El validador cruzado y el cierre dejan fuera los editoriales quitados, igual que el Word. **(2)** Al restaurar una versión vuelven su cobertura, sus anclas y su libro. **(3)** El cierre corre fuera de la petición, con su estado en el documento, y la coherencia del final de la corrida se encadena en el servidor. Dos migraciones nuevas, `20261011120000_versiones_respaldo` y `20261011121000_documentos_cierre_estado`, aditivas, aplicadas en local y en dev: **v40 lleva 18 migraciones**, y la barrera sigue en 105. `e2e:pre-v40` 26 de 26, local y sin modelo | **Tope (decisión de Esteban):** el libro y la coherencia cuentan dentro de la corrida. Lanzados a mano exigen que queden corridas en el mes, sin gastar una; la del final de la corrida y el cierre no piden nada. El cierre dirigido (script) tampoco cuenta. El A8 en `traceline-dev` confirma el cierre fuera de la petición |
| 2026-10-11 | PR #18 mezclado (`a5de3da`). **Traza de la CLI al aplicar en dev:** es el aviso de `pg-delta` que la CLI 2.109 escribe desde su runtime de edge (pila en `createManagedPool`, `postgres-config.js`) después de aplicar. `migrar-remoto.sh` lo filtra desde el 30 de septiembre (`4860b1b`). El tipo exacto no se pudo leer: vive en el contenedor de la CLI y solo sale cuando hay algo que aplicar. No se reprodujo en local, y repetirlo en dev exigiría aplicar algo. **No afecta a `migration list`:** 86 de 86 sin desalineadas, la CLI terminó con «Finished supabase db push» y un segundo push dijo «up to date». En staging, `migrar-remoto.sh` no confía en esa salida: verifica con `--dry-run`, `migration list` y la barrera. **Paso 1:** scripts de v40 e inventario final (§2.1). `instantanea-v40.sql` probada en local; `comprobar-v40.mjs` probado contra dev con una copia temporal: catálogo, 18 incisos y GET del cierre en verde. Las comprobaciones de Carso fallan en dev porque dev no tiene Carso; se ejercitan en el ensayo | **Observaciones de Codex sobre el PR #18, abiertas:** (P1) un cierre sano que dure más de 15 min se da por abandonado: otro cierre o la coherencia pueden correr encima, y los cambios de estado no van condicionados a la reserva; (P2) la pantalla vuelve a ofrecer «Generar» en cuanto el cierre responde 202, y `generar` no comprueba si hay un cierre en curso. Propuesta: `fix/cierre-reserva` antes del PR a `main` (Paso 5): latido de `cierre_actualizado_en` por verificación y token de reserva en los cambios de estado, 409 en `generar` con un cierre en curso, y la pantalla esperando el estado terminal |
| 2026-10-13 | PR #19 mezclado (`0c938b7`); `fix/cierre-reserva` en el PR #20, con las observaciones de Codex sobre los #18 y #19. **Paso 2 · verificaciones previas sobre staging, de solo lectura** (`scripts/despliegue/verificar-previas-v40.mjs`, con `.env.staging.local` en subshell y solo la sesión del analista). Staging: 21 emisoras (20 de demostración y Grupo Carso), 21 reportes. **(a) Catálogo:** 40 enlaces a los códigos agrupados, 2 por emisora de demostración (20 de 20), que pasan a **180 enlaces nuevos** a incisos (9 por emisora); la plantilla global, 2 filas y 9 ids. **Grupo Carso: 0.** Sus 134 solicitudes enlazan a 7 códigos (GRI 2-7 / 401-1, GRI 303-5, GRI 306-3, GRI 404-1, NIIF S1 44 (b), NIIF S1 46 a 50, NIIF S2 29 (a)(i)), ninguno agrupado; el cero se comprobó por conteo, el analista ve sus solicitudes. **(b) Restricciones:** los 4 códigos agrupados existen (taxonomía 2025) y ninguno de los 18 incisos; 40 bloques, ninguno fuera del CHECK nuevo de estados; 0 adjuntos del Perfil en staging; las columnas nuevas sobre tablas existentes son nullable o con default. **(c) Banderas:** las 20 de demostración con generador y lectura encendidos (10 y 500 por mes; vitrina apagada solo en AINDA); Grupo Carso con todo apagado; ninguna emisora real encendida. **(d) Rellenos:** 0 adjuntos a la cola y 0 versiones de bloques (los 40 bloques de Empresa Demo no tienen texto). **Config vars de `traceline-staging`** (11, por nombre): no falta ninguna obligatoria; `COHERENCIA_ESFUERZO`, `EMAIL_ARCHIVO`, `EMAIL_TRANSPORTE`, `NODE_ENV` y `SUPLEMENTO_PRUEBA` son opcionales o a propósito. **Error propio:** conteos de e2e inflados en uno en el PR #18 (el `grep` contaba la línea final «✓ todo en orden»): eran 24, 34, 11 y 32, no 26, 35, 12 y 33 | **Instantánea de Carso:** con 0 enlaces nuevos, `mapeo_solicitud_datapoint:incisos` debe seguir en 0 después de migrar, y todas las demás líneas idénticas. Pendiente de Esteban: decisión sobre Carso (no hay nada que decidir si se acepta el cero) y aprobación del PR #20 |
| 2026-10-13 | PR #20 mezclado (`a840d86`). **Paso 3 · A8 en `traceline-dev`.** Despliegue de `dev/ajustes-sep26` a `traceline-dev` (Claude Code, autorizado): release **v16**, `Deploy a840d86c`. Slug de 183 MB (staging, 182 MB), `/login` 200, 0 respuestas 5xx y 0 `Error:` tras el release. **Generación completa del demo desde Heroku** (`generar-demo.mjs todos`, sobre el documento `98d57a6a`; antes se guardaron las versiones vigentes de sus bloques en `referencia/suplemento-calidad/a8-v40/antes-versiones.json`): 20.3 min; 37 bloques en borrador, 2 «no aplica» y **1 en «error», el 25**. Tiempo de servidor por bloque: mediana 43.3 s, p90 80.7 s, máximo 150.9 s. 28 páginas, Word con `verify:word` en verde. **Costo: $12.38** (bloques $11.18, coherencia $1.20, cierre $0.008; libro reutilizado, $0). **Cierre y coherencia por `after()` bajo dyno real:** `POST …/cierre` → 202 en 372 ms; cierre «listo», 4 cerrados de 6 verificados; la coherencia (origen «fin_de_generacion») se abrió 0.3 s después del cierre y terminó «lista» en 186 s, con 35 observaciones; validador cruzado, 17. **Ninguna petición pasó de 30 s**, medido en el cliente (758 peticiones, máxima 12.8 s) y en el router (773 líneas, `service` máximo 11.6 s, sin códigos H). Lo más lento fue un `GET …/coherencia` (11.6 s); el resto queda por debajo de 2 s. El job de la cola del Scheduler respondió 200 en sus 14 corridas | **El bloque 25 no es un fallo del dyno:** el validador de remisiones rechazó la respuesta en el intento y en el reintento, porque remitía a los bloques 23 y 36 sin el ancla `[Bn.k]` ($0.45). No se regeneró. **Los e2e no corren contra Heroku:** los del suplemento solo corren en local, y los demás piden `supabase db reset`. Los del auditor necesitan una cuenta de auditor que el dev de Esteban no tiene, y crearla no está autorizado; corren en el ensayo del Paso 4, como en v33. El aislamiento entre emisoras tampoco se puede probar en dev, que tiene una sola emisora; va al ensayo. **Observaciones de Codex sobre el PR #20, abiertas:** (P1) carrera entre la comprobación de `generar` y un `POST …/cierre` concurrente; (P2) pasados 20 min, la pantalla da el cierre por terminado aunque siga en curso |
| 2026-10-13 | PR #21 (`167219f`) y PR #22 (`b1b478c`) mezclados; `traceline-dev` en v17. **Bloque 25 regenerado con la regla del #22:** de nuevo en «error» ($0.69), esta vez porque el texto reescribe un hecho del bloque 40; ese validador no degradaba. Codex sobre el #22: la degradación también abarcaba remisiones a bloques ausentes o sin dueño (P1), y `generar` reservaba antes de revisar las ediciones (P2). **PR #23 (`fix/pre-v40-c`):** los validadores de datos fallan y los de colocación degradan (remisión sin ancla y texto reescrito de otro bloque; especificación v0.38, §6). **Paso 4, preparación:** ref del ensayo **`vdubzcjtujxayefzhhco`** (Postgres 17, creado por Esteban). Actualizado en `copiar-staging.sh`, `migrar-ensayo.sh`, `a8-heroku.mjs`, `crear-utileria.mjs`, `verificar-main.mjs` y `rotar-cuentas-seed.mjs`, y como rechazo en `poblar-demo.mjs` y `crear-demo-prospecto.mjs`; también en `migrar-remoto.sh` (antes con marcador) y en `comprobar-v40.mjs`. No entra en `DEV_REFS_AUTORIZADOS`. `ENSAYO_REF` va en `.env.local` de la copia principal. `.env.ensayo.local` se creó con el marcador `PEGAR_` (permisos 600); los dos están enlazados desde `../vert-evidencia-dev` y git los ignora. Con el marcador puesto, `migrar-remoto.sh ensayo` y `migrar-ensayo.sh` se niegan a correr | Esteban: pegar la URL del ensayo en `.env.ensayo.local` con el editor y correr la copia en su terminal (comandos en el chat). La aplicación de las 18 migraciones en ensayo la hace Esteban, y Claude Code puede correr la revisión |
| 2026-10-13 | PR #23 mezclado (`21814d5`); `traceline-dev` en v18. **Bloque 25 regenerado: borrador** ($0.75, 84 s): aceptado en el reintento con una observación del validador (remisión sin ancla al 23); validador cruzado de 17 a 15. **Paso 4 · ensayo completo** en `vdubzcjtujxayefzhhco`, copia de staging: 36 tablas idénticas; 18 migraciones en 23 s; 86 de 86; barrera 105 (Esteban, con la URL del session pooler porque el host directo no resolvía). Las llaves de la API salieron de la CLI a `.env.ensayo-app.local` (permisos 600, sin imprimirse), con autorización de Esteban. Línea base de staging en `referencia/lineas-base/v40/antes/`: Excel de CLEPSA, Banco Base y Grupo Carso, banderas y la instantánea de Carso, tomada por Esteban. Apps locales contra el ensayo, `dev` (`21814d5`) y `main` (`901eae3`). **Resultados:** (a) `comprobar-v40 --despues` en verde (banderas idénticas, 18 incisos, Carso sin libro, hechos, coherencia ni historial). (b) **`main` sobre la base migrada:** Excel idéntico celda por celda en las tres emisoras; `verificar-main` 26 de 26; conteos iguales tras la limpieza. (c) **`dev` sobre la base migrada:** 0 diferencias no esperadas y 435 esperadas en cada emisora (`comparar-excel-v40.mjs`); la prueba negativa (3 celdas alteradas) da 3. (d) **E2E con utilería sobre Empresa Demo:** `e2e:auditor` 58 de 58 y `e2e:auditor:rutas` 92 de 92; la utilería se borró y los conteos quedaron iguales, salvo +2 filas de bitácora (avisos de v39 del comentario del auditor y su respuesta), igual que en la prueba de v39. (e) **Carso:** instantánea de staging y del ensayo migrado **idénticas en las 24 líneas** (`incisos|0`), y sin cambios tras los e2e y la generación. (f) **Generación completa del demo en la copia:** libro $0.14 (66 hechos); 33 en borrador, 7 «no aplica», **0 fallos**; 24 páginas; Word en verde; 14.6 min; bloque: mediana 54.7 s, p90 72.2 s, máximo 92 s; 507 peticiones, máxima 4.7 s y ninguna de más de 30 s; cierre 1 de 6; coherencia 28 observaciones en 130 s; validador cruzado 12; **$9.43** | **Errores propios:** (1) la exportación del Excel sí cambia, por la plantilla (§2.1); el PR #17 y el inventario del Paso 0 decían lo contrario. (2) `comparar-excel-v33.mjs` no servía tal cual (renombres fijos de v33, catálogo solo del lado «después»): se hizo `comparar-excel-v40.mjs`. **Decisión de Esteban:** antes del PR a `main`, el validador cruzado descarta una observación guardada si su cita ya no está en el texto (rama `fix/pre-v40-d`, con el guion v40 en §5.2) |
| 2026-10-13 | PR #24 (`2c2846e`) y PR #25 (`0d361d9`) mezclados. El guion de §5.2 se corrigió en `ef47dc0`, por dos observaciones de Codex (`rev-parse` con dos revisiones y la carpeta `despues`). **Despliegue v40.** (0) La línea base del día es idéntica a la del 13/10 (tres Excel y banderas). (1) Merge del #25 y `main` actualizado. (2) La primera pasada de Esteban fue rechazada con «La URL no apunta a …». La barrera ya aceptaba el ref en cualquier parte de la URL, así que la URL pegada no traía el de staging. Commit operativo directo a `main` (`e6e3308`): el ref va en el host o en el usuario del pooler, y el mensaje dice qué usuario y host encontró. Se probó con 8 URL sintéticas y contra el ensayo. Con eso, migración de Esteban: 18 de 18, 86 de 86, barrera 105, Carso idéntico. (3) `git push heroku main` → **v40**, `Deploy e6e33089`. (4) Comprobaciones en verde: logs (0 5xx, 0 `Error:`, 0 H), `comprobar-v40`, Excel (0 no esperadas y 435 esperadas por emisora), Carso, vitrina de Banco Base y generación completa de Empresa Demo (0 fallos, $9.52, ninguna petición de más de 30 s). Registro en la especificación §10 (v0.40) | Pendiente de Esteban: borrar el proyecto de ensayo y, con él, `.env.ensayo.local`, `.env.ensayo-app.local` y `ENSAYO_REF` de `.env.local`. **Encargo terminado** salvo esa limpieza |
| 2026-10-13 | **Limpieza y cierre.** Esteban borró el proyecto de ensayo `vdubzcjtujxayefzhhco`. Claude Code sobrescribió y borró `.env.ensayo.local` (289 bytes) y `.env.ensayo-app.local` (664 bytes, con las llaves de la API del ensayo), y quitó sus enlaces en `../vert-evidencia-dev`. `ENSAYO_REF` salió de `.env.local` sin imprimirse (12 → 11 líneas). En los scripts de ensayo y despliegue el ref volvió al marcador `PENDIENTE_REF_ENSAYO`, y `comprobar-v40.mjs` queda solo con staging. Con el marcador, `migrar-remoto.sh ensayo` se niega a correr («No hay proyecto de ensayo»). `main` mezclado en `dev` | **Encargo cerrado.** Para la siguiente pasada a `main` quedan en `dev` los commits de registro (especificación v0.40) y esta limpieza; no cambian código de la aplicación |
