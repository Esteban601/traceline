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
  emisora, 23 imágenes en celda). **La sube Esteban** (escritura en staging; CLAUDE.md §1), desde el panel de Storage
  de Supabase o con un comando de su terminal que se escribe en el Paso 1. Claude Code comprueba después, en solo
  lectura, que el archivo de Storage tenga el mismo sha256.

### 2.2 Qué cambia en el Excel de taxonomía de las emisoras de staging (sin datos nuevos, solo por código)

- **Para todas:** hoja nueva «Leyenda»; incisos hijos con nivel de esquema 1 en «Taxonomía NIIF S1 S2».
- **Con alivios vigentes** (primer año con C3/C4/E5): «No revelado · alivio C3/C4» en el año anterior y en Alcance 3;
  con E5, «NIIF S1 46-50» con las instancias de métricas por riesgo y «NIIF S1 51» solo con objetivos climáticos.
- **Sin alivios:** «NIIF S1 46-50» pasa de vacía a llevar las instancias de métricas de sus registros de clima (es
  dato de capturas, sale con o sin suplemento).
- **Con el generador encendido:** columna E «Respuesta» («En preparación» mientras no haya respuestas de un aprobado).
  Con el generador apagado (Grupo Carso), sin columna E.

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
  una emisora sin aprobado → 409 con el motivo; auditor → 403 en el Formato.
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

### 5.1 Guion v41 (se completa en el Paso 1 con los números medidos)

Orden, como en v40: la base se migra antes de que llegue el código (el código de `dev` lee columnas nuevas; `main`
corre sobre la base migrada). La plantilla se sube antes del push (sin ella, el Formato responde 500 «Falta la
plantilla», pero nada más se rompe).
1. Antes (Claude Code, solo lectura): release y config vars por nombre; línea base del día (Excel de CLEPSA, Banco Base
   y Grupo Carso; banderas); Esteban toma la instantánea de Carso.
2. Merge del PR a `main` (Claude Code, autorizado) y `HEAD = origin/main`.
3. Migraciones (Esteban): `migrar-remoto.sh staging` (5 pendientes == `ESPERADAS`) y `--aplicar` (91 de 91, barrera
   108); instantánea de Carso «después» y `diff`.
4. Plantilla (Esteban): subida a `documentos/plantillas/formato-electronico/2025/plantilla.xlsx`; Claude Code compara el
   sha256 descargando en solo lectura.
5. `git push heroku main` (Claude Code, autorizado) → v41.
6. Comprobaciones (Claude Code): logs por conteo; `comprobar-v41`; comparador de Excel; Formato de Empresa Demo (409 sin
   aprobado o 200 con validador en verde, según §2.3); auditor 403 en el Formato.
7. Registro en §10. Rollback (Esteban): `heroku releases:rollback v40 -a traceline-staging`.

## 6. Riesgos y dudas conocidas

- **El Excel de taxonomía de todas las emisoras cambia por código** (§2.2), también el de Grupo Carso (Leyenda y, si
  tiene registros de clima, «NIIF S1 46-50»). Se mide en el ensayo con el comparador antes de tocar staging.
- **Ensayo en copia: se recomienda.** La regla de §10 lo pide cuando el release cambia el esquema, y aquí además es la
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
