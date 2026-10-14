# Encargo: Excel de taxonomía con respuestas y Formato electrónico a producción (release v41)

Versión 1 · 14 de octubre de 2026. Sale del cierre del encargo `2026-10-13-excel-respuestas-narrativas` (PR #27,
mezclado en `dev/ajustes-sep26` en `478c06e`). Mismo guion que v40 (`2026-10-11-suplemento-a-produccion.md`).

**Responsable:** Esteban (con Claude Code)
**Rama:** `dev/ajustes-sep26` → `main`, por PR revisado con el asesor (CLAUDE.md §2).
**Fecha de inicio:** 14 de octubre de 2026 · **Entrega:** release v41 en `traceline-staging`, registrado en la
especificación §10.
**Referencia:** `CLAUDE.md` v1.10 §1, §3, §5, §6 y §9; especificación v0.41 §6.1 y §10 («Para el despliegue del Excel
con respuestas y el Formato electrónico», «Ensayo de despliegue», «Líneas base del despliegue»); encargo v40 §5.

## 1. Objetivo

Llevar a staging el Excel de taxonomía con respuestas, el Formato electrónico NIIF S1/S2 y sus capturas nuevas, sin
diferencias no esperadas en el Excel de las 21 emisoras de staging (20 de demostración y Grupo Carso) y sin encender
nada para Grupo Carso.

## 2. Alcance

### 2.1 Inventario de `dev` (`478c06e`) contra staging (v40, `e6e3308`; `main` en `58f7e77`, sin cambios de código)

| Migración | Qué crea o cambia | Datos existentes que toca |
|---|---|---|
| `20261013120000_respuestas_datapoint` | Tabla `respuestas_datapoint` (RLS: lectura de staff, admin del cliente y auditor de su emisora; escritura solo con service role); `documentos_generados.respuestas_estado`, `respuestas_resultado`, `respuestas_actualizado_en` (+ CHECK en la columna nueva) | — |
| `20261013130000_perfil_formato_electronico` | `perfil_emisor.clave_cotizacion`, `tipo_instrumento`, `fiduciario`, `numero_fideicomiso`, `hechos_posteriores` | — |
| `20261013140000_perfil_actividad_sasb` | `perfil_emisor.actividades_financieras`, `sector_sasb` (text[]) | — |
| `20261013150000_perfil_metricas_industria` | `perfil_emisor.metricas_industria` (+ CHECK en la columna nueva) | — |
| `20261014120000_metricas_asociadas_origen_objetivo` | `registros_clima.metricas_asociadas`, `objetivos.origen_objetivo` (+ CHECK en las columnas nuevas) | — |

- **Las 5 son posteriores** a la última de staging (`20261011121000`, 86 de 86): 91 en total, sin renumerar. Todas
  aditivas, sin relleno, con la barrera al final.
- **Barrera esperada: 108** (105 de v40 + 3 de `respuestas_datapoint`), medida en local con
  `fn_aplicar_barrera_auditor()`; se confirma en el ensayo.
- **Rutas nuevas:** `GET /admin/cobertura/export-formato` (staff y admin del cliente; auditor 403) y
  `GET|POST /api/suplemento/[destino]/respuestas` (staff). **Modificadas:** `export-taxonomia` (columna «Respuesta»,
  «Leyenda», alivios en las hojas de datos, «NIIF S1 46-50» y «NIIF S1 51»), la acción de aprobar (genera las
  respuestas en `after()` si la emisora tiene el generador encendido), Word (numeración consecutiva del índice).
- **Pantallas:** botón «Formato electrónico NIIF» en Cobertura; campos nuevos en Perfil (Identidad), registros de clima
  (métricas asociadas) y objetivos (origen); aviso al aprobar.
- **Dependencias:** sin cambios en `package.json` ni `pnpm-lock.yaml`. **Config vars:** ninguna nueva
  (`ANTHROPIC_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY` ya existen).
- **Llamadas al modelo nuevas:** solo al aprobar un documento de una emisora con el generador encendido (Sonnet 5.5,
  ~$0.45–0.50 por documento) o con `POST …/respuestas`. Ninguna al desplegar.
- **Plantilla del Formato electrónico en Storage (no está en git):** bucket `documentos`, ruta
  `plantillas/formato-electronico/2025/plantilla.xlsx`; el archivo es `referencia/formato-electronico/plantilla-formato-2025.xlsx`
  (armado a nivel zip con `scripts/formato/preparar-plantilla.mjs`, sin respuestas de la referencia, 0 menciones de la
  emisora, 23 imágenes en celda). **La sube Esteban** (escritura en staging; CLAUDE.md §1) con
  `scripts/formato/subir-plantilla.mjs` desde su terminal, no por el panel (decisión del 14/10): imprime el sha256 del
  archivo antes y el de Storage después. Claude Code lo comprueba otra vez, en solo lectura, con `comprobar-v41`.
  sha256 esperado: `eb09aa55c5a6073fe9d3ec299f08cbac0b2a0c1fd4dc8ec4a2c00ffefc146786` (el de dev).

### 2.2 Qué cambia en el Excel de taxonomía de las emisoras de staging (sin datos nuevos, solo por código)

- **Para todas:** hoja nueva «Leyenda» (al final, con los alivios de la emisora); el pie «Generado por…» aparece en
  «NIIF S1 46-50» aunque la hoja quede vacía.
- **Con alivios vigentes** (primer año con C3/C4/E5): «No revelado · alivio C3/C4» en el año anterior y en Alcance 3;
  con E5, «NIIF S1 46-50» con las instancias de métricas por riesgo y «NIIF S1 51» solo con objetivos climáticos.
- **Sin alivios:** «NIIF S1 46-50» pasa de vacía a llevar las instancias de métricas de sus registros de clima (es
  dato de capturas, sale con o sin suplemento).
- **Con el generador encendido:** columna E «Respuesta» («En preparación» mientras no haya respuestas de un aprobado) e
  incisos hijos con nivel de esquema 1 en «Taxonomía NIIF S1 S2», bajo su padre. Con el generador apagado (Grupo
  Carso), ni columna E ni nivel de esquema (corrección del Paso 1: el Paso 0 ponía el esquema «para todas»).
- **Con E5 y objetivos no climáticos:** «NIIF S1 51» se queda con los climáticos.

## 3. Qué toca y qué no

- **Toca:** `main`; `traceline-staging` (5 migraciones, código y la plantilla en Storage); `traceline-dev` (código de
  `dev`, A8 corto); un proyecto de ensayo temporal (si se aprueba, §6); `scripts/despliegue/` y `scripts/ensayo/`
  (`ESPERADAS` de v41, comprobador, comparador e instantánea de Carso); la especificación §10.
- **No toca:** las banderas de Grupo Carso ni de ninguna emisora; los datos de Grupo Carso (ninguna migración los
  toca: la instantánea debe salir idéntica salvo las columnas nuevas en null); ningún documento aprobado (§2.3).
- **Ambientes:** ensayo y `traceline-dev` para las pruebas; staging solo con lecturas y el despliegue.

### 2.3 Documentos aprobados existentes: respuestas al desplegar o al reaprobar (propuesta)

Al desplegar no se genera ninguna respuesta: solo nacen al aprobar. Un documento ya aprobado en staging queda con
«En preparación» en la columna E hasta que se reapruebe o se pidan sus respuestas. **Propuesta:** el Paso 2 cuenta
los documentos aprobados por emisora; para cada emisora de demostración con generador encendido y documento aprobado,
Esteban decide si se piden sus respuestas con `POST …/respuestas` después del release (escribe y cuesta ~$0.50 por
documento) o se espera a la siguiente aprobación. Grupo Carso: nada (generador apagado).

## 4. Definición de terminado

- Inventario (§2.1) y verificaciones previas (Paso 2) documentados, con resultados.
- Ensayo en verde (si se hace): 5 de 5 migraciones, 91 de 91, barrera 108, segunda pasada sin cambios; Carso idéntico
  salvo columnas nuevas en null; Excel de CLEPSA, Banco Base y Grupo Carso con solo las diferencias de §2.2 (0 no
  esperadas); `main` corriendo sobre la base migrada con el Excel idéntico.
- A8 en `traceline-dev`: Formato electrónico y Excel del demo descargados desde el dyno, validador del Formato en verde
  y tiempos por debajo de 30 s.
- Despliegue v41: migraciones aplicadas; plantilla en Storage con el sha256 esperado; release arriba; logs sin 5xx ni
  `Error:`; Excel de las tres emisoras con solo diferencias esperadas; Carso intacto; banderas sin cambios; Formato de
  una emisora sin aprobado → 409 con el motivo; usuario de área fuera de `/admin` (307 a `/portal`). El 403 del
  auditor en el Formato se prueba en el ensayo, con la utilería: staging no tiene cuenta de auditor.
- `tsc`, `eslint`, `verify:export`, build de producción (Turbopack) en verde; registro en la especificación §10.
- Reversión: `heroku releases:rollback v40 -a traceline-staging`. Las migraciones se quedan (aditivas; `main` corre
  sobre la base migrada).

## 5. Entregables intermedios

0. Resumen de una página. Parada.
1. Scripts de v41 (`migrar-remoto.sh` con las 5 `ESPERADAS` y barrera 108, `comprobar-v41.mjs`,
   `comparar-excel-v41.mjs` con las diferencias de §2.2, `instantanea-v41.sql` de Carso con las tablas y columnas
   nuevas) y el comando de subida de la plantilla para Esteban. Parada.
2. Verificaciones previas sobre staging, solo lectura (`.env.staging.local` en subshell): banderas por emisora;
   documentos aprobados por emisora; reportes con alivios vigentes; registros de clima y objetivos por emisora (qué
   cambia en «NIIF S1 46-50» y «NIIF S1 51»); que la ruta de la plantilla no exista aún. Parada con la decisión de
   §2.3.
3. A8 corto en `traceline-dev` (push de `dev`, sin modelo). Parada.
4. Ensayo en copia (si se aprueba) y línea base en `referencia/lineas-base/v41/`. Parada.
5. PR de `dev/ajustes-sep26` a `main` con el guion de v41 en §5.1. Parada.
6. Despliegue v41: migraciones y plantilla (Esteban), merge y push (Claude Code, con autorización por chat),
   comprobaciones y registro.

### 5.1 Guion v41 (Paso 1)

Orden, como en v40: la base se migra antes de que llegue el código (el código de `dev` lee columnas nuevas; `main`
corre sobre la base migrada). La plantilla se sube antes del push (sin ella, el Formato responde 500 «Falta la
plantilla», pero nada más se rompe).

**Scripts de v41** (en `dev`, probados contra dev y el stack local; ver §7):

| Script | Qué hace | Quién lo corre |
|---|---|---|
| `scripts/despliegue/migrar-remoto.sh` | `ESPERADAS` = las 5 de §2.1; barrera 108 | Esteban (staging); Esteban o Claude Code (ensayo) |
| `scripts/ensayo/instantanea-v41.sql` | Carso, 26 líneas: las 24 de v40 sin restar las columnas de v40 y restando las de v41, más `v41:columnas_nuevas_con_valor` y `v41:respuestas_datapoint` (0 antes y después) | Esteban (staging) |
| `scripts/formato/subir-plantilla.mjs` | Valida la plantilla (sha256 esperado, 23 imágenes, 0 menciones), dice si ya está en Storage; con `--subir` pide el ref, sube sin reemplazar, la descarga de vuelta e imprime el sha256 | Esteban (staging); Claude Code (ensayo) |
| `scripts/despliegue/comprobar-v41.mjs` | `--antes`: banderas, `contexto.json` y tabla por emisora (generador, alivios vigentes, aprobados, registros, objetivos), plantilla ausente. `--despues`: banderas iguales, columnas nuevas (Carso en null), respuestas por emisora (Carso 0), plantilla por sha256, Formato de Empresa Demo (200 + validador o 409), emisora sin aprobado 409, usuario de área 307, auditor 403 si hay cuenta. `--respuestas <slug>…`: escribe (§2.3) | Claude Code |
| `scripts/ensayo/comparar-excel-v41.mjs` | Excel antes/después por emisora: solo las diferencias de §2.2, según su `contexto.json` (y `--respuestas` si ya las tiene) | Claude Code |

Convenciones de los bloques: `C=.credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json`,
`APP=https://traceline-staging-70ce5b369e7c.herokuapp.com`, `D=referencia/lineas-base/v41`,
`TS="node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs"`.

**Paso 2 · verificaciones previas (Claude Code, solo lectura sobre staging).**
```sh
(set -a; source .env.staging.local; set +a; $TS ../vert-evidencia-dev/scripts/despliegue/comprobar-v41.mjs --antes $D/paso2 --credenciales $C)
```
Banderas, documentos aprobados, alivios vigentes, registros y objetivos por emisora, y la plantilla aún sin subir. Con
eso Esteban decide §2.3.

**Paso 4 · ensayo en copia.**
1. Esteban crea el proyecto de ensayo y escribe su ref; Claude Code lo pone en lugar de `PENDIENTE_REF_ENSAYO` en
   `migrar-remoto.sh`, `scripts/ensayo/*` (`copiar-staging.sh`, `migrar-ensayo.sh`, `crear-utileria.mjs`,
   `verificar-main.mjs`, `a8-heroku.mjs`), `rotar-cuentas-seed.mjs`, `subir-plantilla.mjs` y `REFS` de
   `comprobar-v41.mjs`.
2. Línea base (Claude Code, solo lectura, staging): Excel de CLEPSA, Banco Base y Grupo Carso en `$D/antes/` con
   `descargar-excel.mjs`, y `comprobar-v41 --antes $D/antes` (banderas y contexto). Esteban toma la instantánea de
   Carso «antes» con `instantanea-v41.sql` en `$D/antes/instantanea-v41.txt`.
3. Esteban: `STAGING_DB_URL='…' ENSAYO_DB_URL='…' bash scripts/ensayo/copiar-staging.sh` (conteos iguales) y
   `bash scripts/despliegue/migrar-remoto.sh ensayo` / `--aplicar` (5 pendientes == `ESPERADAS`; 91 de 91; barrera
   108). Una segunda pasada sin `--aplicar` dice «nada pendiente» y vuelve a verificar. Instantánea de Carso sobre el
   ensayo: idéntica a la de staging en las 26 líneas.
4. Claude Code, sobre el ensayo:
   - plantilla con `subir-plantilla.mjs --destino ensayo --subir`: la copia no trae los bytes de Storage, y así se
     prueba el camino de subida antes de staging;
   - apps locales de `main` y `dev` contra el ensayo;
   - `main`: Excel idéntico a la línea base (`comparar-excel.mjs`);
   - `dev`: `comparar-excel-v41.mjs` en las tres emisoras con 0 no esperadas;
   - `comprobar-v41 --despues` con la app local de `dev`, con la utilería del auditor (`crear-utileria.mjs`) para el
     403, y la utilería borrada después.

**Paso 6 · despliegue v41** (orden aprobado por Esteban el 14/10, el de v40 con la plantilla primero).

*0. Antes (Claude Code, solo lectura).* Staging en v40 y config vars por nombre; línea base del día en `$D/antes/`.
```sh
cd ~/Repositorios/vert-evidencia
heroku releases -a traceline-staging -n 1                      # v40 · Deploy e6e33089
(set -a; source .env.staging.local; set +a; BASE_URL=$APP node ../vert-evidencia-dev/scripts/ensayo/descargar-excel.mjs --credenciales $C $D/antes clepsa banco-base gcarso empresa-demo-sab)
(set -a; source .env.staging.local; set +a; $TS ../vert-evidencia-dev/scripts/despliegue/comprobar-v41.mjs --antes $D/antes --credenciales $C)   # banderas.json, contexto.json, plantilla ausente
```
Esteban toma la instantánea de Carso «antes» si el despliegue no es el mismo día que la del ensayo (14/10):
`psql "$STAGING_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -f scripts/ensayo/instantanea-v41.sql > $D/antes/instantanea-v41.txt` (26 líneas).

*1. Plantilla del Formato (Esteban, en su terminal).* Antes del merge el script solo está en `dev`: se corre desde
`~/Repositorios/vert-evidencia`, que tiene `.env.staging.local` y la plantilla en `referencia/formato-electronico/`
(ruta ignorada por git), con el script del worktree de `dev`. El código de v40 no lee esa ruta: subirla antes no cambia
nada en staging.
```sh
cd ~/Repositorios/vert-evidencia
git -C ../vert-evidencia-dev fetch -q origin && git -C ../vert-evidencia-dev status -sb | head -1   # dev/ajustes-sep26, al día
# Revisión: sha256 del archivo local, 23 imágenes, 0 menciones, «en Storage: no existe»
(set -a; source .env.staging.local; set +a; \
 node --experimental-strip-types --import ../vert-evidencia-dev/scripts/captura-sugerida/node/registrar.mjs \
   ../vert-evidencia-dev/scripts/formato/subir-plantilla.mjs referencia/formato-electronico/plantilla-formato-2025.xlsx --destino staging)
# Subida: pide escribir el ref de staging; sube sin reemplazar, descarga de vuelta e imprime su sha256
(set -a; source .env.staging.local; set +a; \
 node --experimental-strip-types --import ../vert-evidencia-dev/scripts/captura-sugerida/node/registrar.mjs \
   ../vert-evidencia-dev/scripts/formato/subir-plantilla.mjs referencia/formato-electronico/plantilla-formato-2025.xlsx --destino staging --subir)
```
Salida esperada: sha256 antes = después = `eb09aa55c5a6073fe9d3ec299f08cbac0b2a0c1fd4dc8ec4a2c00ffefc146786`. La llave
y la URL no se imprimen. Así se subió al ensayo el 14/10. Claude Code lo vuelve a comprobar en el paso 5 con
`comprobar-v41`.

*2. Merge del PR (Claude Code, con autorización por chat, CLAUDE.md §9).*
```sh
gh pr merge <n> --merge                          # merge commit, con el comentario de revisión
cd ~/Repositorios/vert-evidencia && git fetch origin && git merge --ff-only origin/main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" && echo "HEAD = origin/main ✓"
nvm use 22 && pnpm install --frozen-lockfile
```

*3. Migraciones (Esteban, en su terminal).* Con la URL del session pooler si el host directo no resuelve (staging:
`aws-1-us-east-2`).
```sh
cd ~/Repositorios/vert-evidencia && git status --short && git rev-parse --short HEAD      # limpio, = origin/main
mkdir -p referencia/lineas-base/v41/despues
read -rs STAGING_DB_URL && export STAGING_DB_URL                                           # se pega sin eco
bash scripts/despliegue/migrar-remoto.sh staging              # revisión: 5 pendientes == ESPERADAS
bash scripts/despliegue/migrar-remoto.sh staging --aplicar    # pide el ref; al final: nada pendiente, 91 de 91, barrera 108
/opt/homebrew/opt/postgresql@17/bin/psql "$STAGING_DB_URL" -X -A -t -v ON_ERROR_STOP=1 \
  -f scripts/ensayo/instantanea-v41.sql > referencia/lineas-base/v41/despues/instantanea-v41.txt
unset STAGING_DB_URL
diff referencia/lineas-base/v41/antes/instantanea-v41.txt referencia/lineas-base/v41/despues/instantanea-v41.txt   # sin salida
```
Esperado, como en el ensayo: 26 líneas idénticas, con `v41:columnas_nuevas_con_valor|0` y `v41:respuestas_datapoint|0`.
Una línea distinta se revisa por `created_at` (actividad de Carso entre las dos tomas). Si no se explica así, se
detiene el despliegue: el código no ha salido y no hay nada que revertir en Heroku.

*4. Despliegue (Claude Code, con autorización por chat).*
```sh
cd ~/Repositorios/vert-evidencia && test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" && echo "HEAD = origin/main ✓"
git push heroku main
heroku releases -a traceline-staging -n 2        # v41 · Deploy <sha de main>
heroku ps -a traceline-staging                   # web.1: up
```

*5. Comprobaciones (Claude Code; solo lectura y descargas).*
```sh
cd ~/Repositorios/vert-evidencia
# a) Logs, solo conteos.
curl -s -o /dev/null -w "%{http_code}\n" $APP/login                                      # 200
heroku logs -a traceline-staging -n 1500 | grep -c -E 'status=5[0-9]{2}'                 # 0
heroku logs -a traceline-staging -n 1500 | grep -c -E 'Error:|Unhandled'                 # 0
# b) Banderas iguales, columnas nuevas (Carso en null), 0 respuestas de Carso, plantilla por sha256,
#    Formato: Empresa Demo 409 (sin aprobado en staging), Grupo Carso 409 «generador apagado»,
#    una emisora sin aprobado 409, usuario de área 307 a /portal.
(set -a; source .env.staging.local; set +a; BASE_URL=$APP $TS scripts/despliegue/comprobar-v41.mjs --despues $D/despues --credenciales $C)
# c) Excel de las cuatro emisoras contra la línea base: 0 no esperadas en cada una.
(set -a; source .env.staging.local; set +a; BASE_URL=$APP node scripts/ensayo/descargar-excel.mjs --credenciales $C $D/despues/excel clepsa banco-base gcarso empresa-demo-sab)
for s in clepsa banco-base gcarso empresa-demo-sab; do
  $TS scripts/ensayo/comparar-excel-v41.mjs $D/antes/$s.xlsx $D/despues/excel/$s.xlsx \
    --plantilla assets/taxonomia-base.xlsx --contexto $D/antes/contexto.json --emisora $s
done
```
Esperado, según el ensayo:
- CLEPSA y Banco Base: 149 diferencias esperadas cada una.
- Grupo Carso: 73, sin columna E ni esquema y con J y K vacías en sus 6 instancias.
- Empresa Demo: 247.
- Si cambia el número de registros de clima de una emisora entre la línea base y el despliegue, cambia su conteo de
  instancias, pero no las no esperadas.
- **Respuestas:** con la regla de Esteban (Paso 2), al desplegar se piden solo para los documentos aprobados que ya
  existan en emisoras `es_demo`; hoy no hay ninguno, así que `comprobar-v41 --respuestas` no se corre. Si al desplegar
  apareciera alguno, se pide con `--respuestas <slug>` (~$0.50 cada uno) y se anota.

*6. Registro.* Entrada de v41 en la especificación §10 y en §7 de este encargo; push a `origin`. Después, limpieza
del ensayo (Esteban borra el proyecto; Claude Code, los `.env.ensayo*.local` y el ref de vuelta al marcador).

**Rollback (Esteban).** `heroku releases:rollback v40 -a traceline-staging`. Si una config var movió la numeración,
el destino es el release inmediatamente anterior al `Deploy` de v41. Las migraciones se quedan: son aditivas, y el
código de v40 sobre la base migrada dio en el ensayo el Excel idéntico en las cuatro emisoras. La plantilla en Storage
no estorba al código de v40.

## 6. Riesgos y dudas conocidas

- **El Excel de taxonomía de todas las emisoras cambia por código** (§2.2), también el de Grupo Carso (Leyenda y, si
  tiene registros de clima, «NIIF S1 46-50»). Se mide en el ensayo con el comparador antes de tocar staging.
- **Ensayo en copia: aprobado por Esteban el 14/10.** La regla de §10 lo pide cuando el release cambia el esquema, y aquí además es la
  única forma de ver el Excel de las emisoras reales con el código nuevo: el código de `dev` lee columnas que staging
  no tiene, y `dev` y `traceline-dev` solo tienen el demo. Las migraciones son aditivas y sin relleno (riesgo de datos
  bajo); el riesgo está en el Excel de las 21 emisoras.
- **La plantilla vive fuera de git:** si falta o es otra versión, el Formato falla con 500 y el validador de entrega
  lo impide; se comprueba por sha256.
- **Numeración del Word:** un Word aprobado reexportado cambia su numeración (no su texto).
- **Costo:** solo al aprobar con el generador encendido (~$0.50 por documento).

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-10-14 | PR #27 mezclado en `dev/ajustes-sep26` (`478c06e`) con el comentario de revisión. Encargo escrito; Paso 0 en el chat | Detenido en el Paso 0 |
| 2026-10-14 | Cuarta lectura del Formato: tres correcciones de redacción en dev (capital sin asignar como declaración negativa; 97 y 99 con texto propio; 64 sin cambio). Sin migraciones nuevas: el inventario de §2.1 no cambia | Paso 0 pendiente de aprobación |
| 2026-10-14 | **Paso 0 aprobado por Esteban:** ensayo en copia sí (él crea el proyecto y corre copia y migraciones); la plantilla la sube él con un comando, no por el panel. **Paso 1:** `migrar-remoto.sh` (5 `ESPERADAS`, barrera 108), `instantanea-v41.sql`, `subir-plantilla.mjs`, `comprobar-v41.mjs`, `comparar-excel-v41.mjs` y guion en §5.1. **Pruebas:** instantánea sobre el demo local, idéntica en las 26 líneas antes de migrar (tabla y columnas quitadas en una transacción revertida) y después; un `origen_objetivo` con valor solo mueve `v41:columnas_nuevas_con_valor`, y la cuenta dinámica se probó contra `bitacora`. `subir-plantilla` contra dev en revisión: sha256 de Storage = local; rechaza destino ajeno, ensayo sin ref y otro archivo; `--subir` con el mismo archivo no escribe. Falta probar la subida real: se hace en el ensayo. `comprobar-v41` `--antes` y `--despues` contra dev, con una copia temporal que admitía dev: Formato del demo 200 con validador en verde y sha256 de la plantilla; 2 fallas propias de dev (sin Carso; contraseña del auditor). `comparar-excel-v41` con el Excel del demo hecho por `main` (`58f7e77`, local :3016) y por `dev` (:3014) sobre la misma base: 0 no esperadas, 342 esperadas. Negativos: sin `--respuestas`, 111; con generador apagado y sin alivios, 181; con celdas alteradas, 1 y 2. La plantilla se copió a `referencia/` del worktree principal. **Errores propios:** (1) §2.2 decía que el nivel de esquema de los incisos era «para todas»; solo va con el generador encendido. (2) El 403 del auditor no se puede comprobar en staging, que no tiene cuenta de auditor, y el usuario de área no sirve como sustituto: el middleware lo saca de `/admin` (307) antes de llegar a la ruta. Se prueba en el ensayo con la utilería (§4 corregido). (3) El patrón de la columna D del comparador tenía un espacio de más, y el del pie no aceptaba «TRACELINE DEV»; los dos se corrigieron en la prueba | Detenido en el Paso 1 |
| 2026-10-14 | **No hay PR #28.** Esteban pidió mezclarlo; en GitHub el último es el #27 (ya mezclado) y no hay ninguno abierto. El Paso 1 se commiteó directo en `dev/ajustes-sep26` (`1154607`, `df972c0`). El PR de `dev` a `main` es el Paso 5: no se creó ni se mezcló nada. **Paso 2: verificaciones previas sobre staging**, solo lectura, con la sesión del analista (`verificar-previas-v41.mjs` y `comprobar-v41 --antes`; salida en `referencia/lineas-base/v41/paso2/`). (a) 21 emisoras: 20 de demostración con vitrina, generador y lectura encendidos (`ainda` con la vitrina apagada), topes 10/mes y 500/mes; Grupo Carso con todo apagado. (b) Un solo documento en staging, de Empresa Demo y **sin aprobar**; ninguna otra emisora tiene documento. Con la propuesta de §2.3 se pedirían 0 respuestas ($0); al desplegar no se genera ninguna. (c) Ninguna de las 13 columnas nuevas ni la tabla `respuestas_datapoint` existen en staging: los CHECK y NOT NULL caen sobre columnas que nacen en null y sobre una tabla vacía, así que ningún dato existente puede violarlos. (d) `perfil_emisor` tiene 0 filas en staging (ninguna emisora tiene Perfil; el analista sí ve las tablas del mismo patrón), así que los 8 campos nuevos nacen vacíos en las 21. (e) El bucket `documentos` existe; `plantillas/` no existe y la ruta de la plantilla está libre. (f) 18 de 18 incisos y 4 de 4 padres activos; catálogo 116; 180 enlaces a incisos y 40 a padres (9 y 2 por cada emisora de demostración; Carso 0 y 0); 1374 filas en `mapeo_solicitud_datapoint`. Ningún reporte tiene alivios vigentes. Registros de clima: Empresa Demo 5 y **Grupo Carso 3** (el código nuevo llena «NIIF S1 46-50» de Carso con sus instancias, sin documento aprobado: verificación vacía). Objetivos: Empresa Demo 4 (1 no climático), Carso 2 | Detenido en el Paso 2 |
| 2026-10-14 | **Paso 2 aprobado.** Regla de Esteban: al desplegar se piden respuestas solo para los documentos aprobados que ya existan en emisoras `es_demo` (hoy ninguno); Grupo Carso, sin respuestas y sin Formato visible mientras su generador esté apagado (el código ya lo cumple: Cobertura no muestra el botón y la ruta da 409). Opción (a) para el Formato en la copia: aprobar el documento de Empresa Demo; si los pendientes lo impiden, 409 y el 200 en la A8. **Ensayo** en `wbvqrjqlfmlnbtpejvnm` (`traceline-ensayo-v41`, us-east-2, Postgres 17). Ref en 10 archivos y en `comprobar-v41` (`6d95842`). Esteban: copia (41 tablas idénticas, 86 migraciones de origen), 5 aplicadas, 91 de 91, barrera 108, instantánea de Carso «antes» en staging (26 líneas), por el session pooler `aws-0` (el de staging es `aws-1`). **Resultados:** (a) `migrar-remoto.sh ensayo` en revisión: nada pendiente, 91 de 91, barrera 108. (b) **Carso:** instantánea del ensayo migrado idéntica a la de staging en las 26 líneas (`v41:*` en 0), y otra vez idéntica después de los e2e. (c) Llaves de la API de la CLI a `.env.ensayo-app.local` (600, sin imprimirse). **Plantilla subida a la copia con `subir-plantilla.mjs --subir`:** sha256 antes = después = esperado; repetir `--subir` no escribe nada. (d) **`main` (`58f7e77`) sobre la base migrada:** Excel idéntico a la línea base de staging celda por celda en CLEPSA, Banco Base, Grupo Carso y Empresa Demo. (e) **`dev` (`6d95842`):** `comparar-excel-v41` con 0 no esperadas en las cuatro. CLEPSA y Banco Base, 149 esperadas cada una: Leyenda 18, esquema 18, E1 1, «En preparación» 111, pie 1. Grupo Carso, 73: Leyenda 18, 6 instancias (54 celdas), pie 1; sin columna E ni esquema; de sus instancias solo se llenan A–I, J y K vacías porque no hay valores capturados ni documento aprobado. Empresa Demo, 247: además 10 instancias (98 celdas). (f) **E2E con utilería sobre Empresa Demo:** `e2e:auditor` 58 de 58, `e2e:auditor:rutas` 92 de 92. Utilería borrada; conteos iguales salvo +2 de bitácora, como en v40. (g) **Formato en la copia:** el documento de Empresa Demo (`ec665a76`, v1) no se puede aprobar, porque 30 de sus 33 bloques con texto tienen pendientes (criterio de `bloqueantesDeAprobacion`; no se intentó desde la pantalla). Como se decidió, el resultado correcto es el 409 con el motivo. `comprobar-v41 --despues` con la app local de `dev`: banderas iguales, columnas nuevas en null, 0 respuestas, plantilla con el sha256 esperado; Empresa Demo y afirme 409; usuario de área 307 a `/portal`; **auditor 403**. Grupo Carso 409 «generador apagado». **A8 en `traceline-dev`:** push de `dev` (`6d95842`, fast-forward desde `21814d5`) → **v19**, contra dev con el demo v3 aprobado. Dos pasadas como analista: **Formato 200 en 8.4 s y 4.8 s**, 23 imágenes enlazadas, 0 `#VALUE!`, 0 K con «[», Leyenda; idéntico al entregado en Descargas (44 de 44 partes del zip, sin `docProps`). Excel 200 en 2.3 s y 1.5 s: 111 respuestas, 0 «En preparación», 0 con «[», 13 instancias, Leyenda. Logs: 0 5xx, 0 `Error:`, 0 H en 1500 líneas | Detenido con el informe del ensayo y la A8 |
| 2026-10-14 | **Ensayo y A8 aprobados. Paso 5:** guion del despliegue en §5.1, en el orden pedido por Esteban: plantilla (Esteban, desde `~/Repositorios/vert-evidencia` con el script del worktree de `dev`, porque antes del merge solo está en `dev`), merge, migraciones con instantánea, push, comprobaciones, registro. `comprobar-v41 --despues` ahora también comprueba el 409 «generador apagado» de Grupo Carso; probado contra la copia (en verde). PR de `dev/ajustes-sep26` a `main` | Detenido en el Paso 5, esperando la revisión del PR |
