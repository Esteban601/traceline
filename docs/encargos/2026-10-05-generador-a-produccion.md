# Encargo: Generador y captura sugerida a producción (merge de `dev/ajustes-sep26` a `main`)

**Responsable:** Esteban (con Claude Code)
**Ramas:** `dev/ajustes-sep26` → `main`, por PR revisado con el asesor. Trabajo previo en `dev/ajustes-sep26` (renumeración y verificaciones) y en un proyecto Supabase de ensayo.
**Fecha de inicio:** 5 de octubre de 2026 · **Aprobado por:** Manuel (orden de trabajo acordado el 4 de octubre; MFA a la cola).
**Referencia:** `CLAUDE.md` v1.7 (§1, §3, §9), especificación §10 (releases y "Antes del merge a producción"), encargo del rol auditor §5 (guion de ensayo y despliegue), encargo de captura sugerida §7.

## 1. Objetivo

Llevar a staging (producción de facto, con Grupo Carso y la cuenta de Deloitte sobre CLEPSA) todo lo construido en `dev/ajustes-sep26` desde septiembre: perfil del emisor, generador del suplemento NIIF S1/S2, catálogo corregido con sus renombres, columna dinámica del Excel, lectura de evidencias con captura sugerida, mockups de Rotoplas y AINDA y sus configuraciones, con las banderas por emisora apagadas para clientes reales hasta que su contrato lo permita. Es el despliegue más grande desde julio y se trata como tal: ensayo completo sobre copia de producción, línea base, verificación y plan de reversión escritos antes de tocar staging.

## 2. Alcance

Incluye:
- **Reconciliación de migraciones.** Las migraciones de `dev` fechadas en septiembre son anteriores a las ya aplicadas en staging (`20260929*`, `20261001*`, `20261004*`). Decisión: **renumerar** las migraciones de `dev` que no están en staging con fechas posteriores a la última de staging, conservando el orden relativo y el contenido; sin `--include-all`. Verificación de que `migration list` local == dev tras la renumeración y de que una aplicación limpia en local produce el mismo esquema (comparación de `pg_dump --schema-only` normalizado antes y después).
- **Verificaciones previas sobre staging (solo lectura):** ninguna evidencia supera 25 MB (`storage.objects`); conteo de tablas que la barrera del auditor cubrirá (de 69 a 87 políticas, como en dev; decía 81, corregido en el Paso 0); no hay datos en staging que violen CHECKs o NOT NULL que `dev` introduce; `generaciones_mes_max`, `lecturas_mes_max`, `lectura_evidencias_activa` y `vitrina_habilitada` con sus valores por tenant decididos (§3).
- **Permisos de `service_role`:** inventario de lo que `dev` y los scripts necesitan y lo que el proyecto alojado concede por defecto; si hay diferencia que afecte a la aplicación en Heroku, se declara en migración; si solo afecta a scripts locales, se anota como deuda.
- **A8 (pruebas en Heroku):** app de dev en Heroku (`traceline-dev`) con el código de `dev` contra el proyecto de ensayo; generación de un bloque y de un documento completo del demo desde Heroku (latencia por bloque, `maxDuration`, `after()` bajo dyno real); prueba de aislamiento multi-tenant del generador y de la captura sugerida (un tenant no ve ni cita evidencias ni capturas de otro); carga de evidencia de 20 MB por URL firmada desde Heroku; costo medido por documento.
- **Ensayo en copia:** proyecto Supabase temporal con copia de staging (mismo guion del rol auditor), migraciones renumeradas aplicadas dos veces, e2e completos contra la copia, Excel de taxonomía de CLEPSA, Banco Base y Grupo Carso idéntico a la línea base, Grupo Carso intacto, vitrina de un mockup, auditor de Deloitte (cuenta de utilería equivalente) con el panel en lectura, y la prueba de que `main` actual corre sobre la base migrada (intervalo entre migrar y desplegar, y reversión de código).
- **Línea base** en `referencia/lineas-base/v33/`.
- **Despliegue v33:** migraciones primero (las corre una persona), luego `git push heroku main`, verificaciones, registro en §10.
- **Después:** merge de `main` a `dev` si hubo cambios durante el ciclo; limpieza del proyecto de ensayo y de la app de dev si no se conserva; actualización de `README-SCHEMA.md` y de los manuales si cambió algo visible.

No incluye:
- MFA (a la cola hasta que un cliente lo pida).
- Encender el generador o la captura sugerida para clientes reales.
- Rotación de las 124 cuentas de mockups (ventana aparte).
- Cambios funcionales nuevos: lo que no está en `dev` hoy no entra en este encargo.

## 3. Decisiones de configuración al desplegar

| Emisora | `vitrina_habilitada` | generador (documentos) | `lectura_evidencias_activa` |
|---|---|---|---|
| Mockups (17) | como está (AINDA apagada) | encendido, tope por `generaciones_mes_max` | encendida, tope 500 |
| Empresa Demo (staging) | encendida | encendido | encendida |
| Grupo Carso | apagada | **apagado** hasta contrato que nombre a Anthropic | **apagada** |
| CLEPSA (mockup hasta kick off) | encendida | encendido | encendida; al kick off, el tenant real nace apagado |

El generador necesita una bandera por tenant si hoy no la tiene; si no existe, se añade en este encargo (aditiva, default apagado para `es_demo = false`).

## 4. Definición de terminado

- Migraciones renumeradas: aplicación limpia en local idéntica en esquema a la aplicación histórica; `migration list` local == dev == ensayo tras aplicar.
- Verificaciones previas sobre staging documentadas con sus consultas y resultados.
- A8 ejecutado desde Heroku con tiempos y costos en §7; aislamiento multi-tenant probado con rechazo del servidor, no por pantalla.
- Ensayo en copia verde en todos sus puntos; línea base guardada.
- Despliegue v33: migraciones aplicadas (N de N, barrera 87), release arriba con el hash del merge, Excel de taxonomía de las tres emisoras con solo diferencias esperadas frente a la línea base (clasificación esperada / no esperada por celda en el informe del ensayo), Grupo Carso intacto, logs sin errores, vitrina de un mockup, Cobertura en Carso sin botón de suplemento ni de lectura.
- Banderas por emisora conforme a §3, verificadas por consulta.
- Registro en especificación §10 y en §7 de este encargo; `README-SCHEMA.md` al día; manuales actualizados si cambió algo visible para el cliente.
- Reversión documentada: `heroku releases:rollback v32 -a traceline-staging`; las migraciones se quedan (aditivas y probadas con `main` sobre la base migrada).

## 5. Pasos y paradas

0. Resumen de una página: inventario de lo que `dev` tiene y staging no (migraciones, tablas, rutas, pantallas, banderas, dependencias de `package.json`), propuesta de renumeración con la lista de archivos antes/después, riesgos que ves. Parada.
1. Renumeración en `dev/ajustes-sep26` y verificación de esquema. Parada.
2. Verificaciones previas sobre staging (solo lectura) y decisión de `service_role`. Parada con resultados.
3. Proyecto de ensayo (Esteban lo crea y pasa el ref; copia por el script con las URL en su terminal) y A8 en `traceline-dev` apuntando a ensayo. Parada con tiempos, costos y aislamiento.
4. Ensayo completo en copia, línea base, informe. Parada.
5. PR de `dev/ajustes-sep26` a `main`, revisado con el asesor. Guion v33 en §5.1 con los comandos exactos. Parada.
6. Despliegue v33: merge y push por Claude Code (CLAUDE.md v1.6/v1.7), migraciones por Esteban antes del push, verificaciones, banderas, registro. Limpieza.

### 5.1 Guion del Paso 3 · copia de staging a ensayo y app `traceline-dev`

Lo ejecuta **Esteban en su terminal**, salvo lo marcado como Claude Code. Ningún comando imprime una URL, una
llave ni una contraseña.

**0. Antes, una vez creado el proyecto de ensayo.**
- **Ref del proyecto de ensayo: `sqpxcxewoznhpwvhxamy`** (Postgres 17, creado el 5 de octubre de 2026). Siete
  scripts tenían fijo el ref anterior (`ndodorukqqyzhinahmrm`) y ya llevan el nuevo: `copiar-staging.sh`,
  `migrar-ensayo.sh`, `migrar-remoto.sh`, `rotar-cuentas-seed.mjs`, `verificar-main.mjs`, y como rechazo
  `poblar-demo.mjs` y `crear-demo-prospecto.mjs`. `migrar-remoto.sh` espera las 29 migraciones de v33 y una
  barrera de 87. El ref de ensayo **no** entra en `DEV_REFS_AUTORIZADOS`.
- **El proyecto de ensayo se crea con Postgres 17**, la versión de staging.
- **Archivos de entorno.**
  - `.env.local` ya lleva `ENSAYO_REF`.
  - `.env.ensayo.local` existe con el marcador `PEGAR_`: Esteban reemplaza el marcador por la URL de conexión
    directa del ensayo, con el editor y nunca con `>>`.
  - Los dos viven en `../vert-evidencia`. En `../vert-evidencia-dev` son enlaces simbólicos a ellos, porque los
    scripts los leen desde la raíz de su worktree; git los ignora igual.

**(a) Copia de staging a ensayo.** Se corre desde `../vert-evidencia-dev`, ya al día, con el cliente de
Postgres 17:
```sh
cd ~/Repositorios/vert-evidencia-dev && git pull --ff-only
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
read -rs STAGING_DB_URL && export STAGING_DB_URL   # pega la URL de staging (conexión directa) y Enter; no se muestra
read -rs ENSAYO_DB_URL && export ENSAYO_DB_URL     # la del proyecto de ensayo
bash scripts/ensayo/copiar-staging.sh              # copia public, historial de migraciones, auth y metadatos de storage; compara conteos
unset STAGING_DB_URL ENSAYO_DB_URL
```
- **Los archivos de storage no se copian**, solo sus metadatos: los objetos viven fuera de la base. Para las
  pruebas de A8 se suben evidencias nuevas.
- **Después, las migraciones de v33 en ensayo**, desde el mismo worktree:
  1. `bash scripts/despliegue/migrar-remoto.sh ensayo`: revisión. Debe listar exactamente las 29.
  2. `bash scripts/despliegue/migrar-remoto.sh ensayo --aplicar`: pide escribir el ref y verifica que no quede
     nada pendiente, la lista y la barrera de 87.
  3. Una segunda pasada sin `--aplicar`: «al día y verificado».

**(b) Config vars de `traceline-dev`** (Heroku → Settings → Config Vars). No van valores en este documento.

| Variable | De dónde sale | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase, proyecto de ensayo → Project Settings → API → Project URL | La app apunta a ensayo, nunca a staging |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ensayo → Project Settings → API → `anon` `public` | |
| `SUPABASE_SERVICE_ROLE_KEY` | Ensayo → Project Settings → API → `service_role` | Secreta; solo en Heroku |
| `ANTHROPIC_API_KEY` | Consola de Anthropic: una llave **nueva**, con nombre propio (p. ej. `traceline-dev-ensayo`) y límite de gasto | Una por persona y ambiente (CLAUDE.md §6); no la de dev ni la de staging |
| `CRON_SECRET` | Se genera en la terminal (`openssl rand -hex 32`) y se pega sin imprimirlo en otro lado | Distinto del de staging; lo usan `/api/evidencias/procesar` y `/api/recordatorios` |
| `NEXT_PUBLIC_APP_URL` | `https://traceline-dev-d4fd7a3cda04.herokuapp.com`, la Web URL que asignó Heroku. `traceline-dev.herokuapp.com` responde «No such app» | Los enlaces de los correos y de las invitaciones. **Puesta** |
| `NEXT_PUBLIC_APP_NAME` | El mismo valor que en `traceline-staging` | **Puesta** |
| `NEXT_PUBLIC_STAGING` | `true` | Franja de ambiente de prueba y sin indexación, como staging. **Puesta** |
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | `1` | Como staging: el build no descarga navegadores. **Puesta** |
| `RESEND_API_KEY` y `EMAIL_FROM` | **No se definen** | Sin llave, el correo sale a la consola (modo sin envío). La copia trae usuarios reales de Grupo Carso: desde ensayo no sale ningún correo |
| `SUPLEMENTO_PRUEBA` | `1` | Muestra al staff el botón de prueba del bloque 29. Solo para A8. **Puesta** |

Además:
- buildpack `heroku/nodejs`, ya fijado, como en staging. Node 22 y pnpm 11 salen de `engines` y `packageManager`;
- un dyno web Basic, como staging;
- el add-on **Heroku Scheduler** (`scheduler:standard`, ya creado; el job lo pone Esteban) con un job cada 10 minutos:
  `curl -s -X POST -H "x-cron-secret: $CRON_SECRET" "$NEXT_PUBLIC_APP_URL/api/evidencias/procesar?maximo=10"`.
  Sin job de recordatorios, porque no se manda correo desde ensayo;
- en Supabase, proyecto de ensayo → Authentication → URL Configuration: Site URL y Redirect URLs con el dominio de
  `traceline-dev`, para el login y la recuperación de contraseña.

**(c) Despliegue de `dev/ajustes-sep26` a `traceline-dev`.** Va **después** de migrar ensayo: el código de `dev`
espera las columnas nuevas.
```sh
cd ~/Repositorios/vert-evidencia-dev && git pull --ff-only
# el remoto heroku-dev ya existe (lo agregó Claude Code); `heroku` sigue siendo staging
heroku buildpacks -a traceline-dev                                   # debe decir heroku/nodejs
git push heroku-dev dev/ajustes-sep26:main                           # la rama dev va a la rama main de la app
heroku releases -a traceline-dev | head -3
heroku logs -a traceline-dev -n 300 | grep -c -E 'status=5[0-9]{2}|Error:'   # 0
```
- **Quién empuja.** El push a `traceline-dev` no toca staging. Con la autorización de Esteban por chat lo puede
  ejecutar Claude Code (CLAUDE.md §9 aplicado por analogía), y cada push se anota en §7.
- **Comprobaciones mínimas tras el release.**
  - `/login` responde 200.
  - Las páginas de Cobertura y del generador cargan sin errores de consola.
  - Las banderas de ensayo valen lo de §3, verificado por consulta.

## 6. Riesgos

- Renumerar migraciones ya aplicadas en dev y en los proyectos de los colaboradores: dev y el proyecto de Quique (si existe) deberán marcarse con `migration repair` o recrearse; se documenta el procedimiento.
- El generador y la captura sugerida en dyno real: `after()` y los tiempos de bloque pueden comportarse distinto que en local; A8 existe para eso.
- Banderas: un tenant real con el generador encendido por error enviaría sus datos a la API de Anthropic sin contrato; la verificación por consulta de §4 es obligatoria antes de dar por terminado.
- El límite de 25 MB del bucket es restrictivo; se verifica antes que ninguna evidencia existente lo supere.
- Conflictos conocidos ya resueltos en `dev` (`suplemento-button`, `cobertura-view`, `.gitignore`); pueden aparecer otros si `main` cambió desde el último merge a `dev`.

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-10-05 | Encargo escrito; MFA queda en cola | Renumerar migraciones en lugar de `--include-all`; Carso con generador y lectura apagados hasta contrato |
| 2026-10-05 | Paso 0 aprobado. Decisiones: renumerar a `20261005120000 + n minutos` con repair en dev (y el mismo script para el proyecto de Quique); `db reset` del stack local; la sección 5 de la corrección del catálogo, separada; `generaciones_mes_max` se aplica en este encargo junto con la bandera `generador_activo`; DoD con barrera 87 y «Excel con solo diferencias esperadas»; migración que apaga la vitrina donde `es_demo = false` | — |
| 2026-10-05 | **Paso 1.** Renumeradas las **26** migraciones de `dev` que staging no tiene (17 de septiembre, la reparación de la barrera y 8 de captura sugerida) como renombres puros (`6e397aa`). La sección 5 de la corrección del catálogo, separada en `20261005130000_catalogo_repunte_riesgos_fisicos` (al final de la serie, para poder dejarla fuera del lote). Nuevas: `20261005122600_tenants_generador_activo` (bandera, encendida en `es_demo`; unidad de `generaciones_mes_max`) y `20261005122700_vitrina_apagada_clientes_reales`. **Esquema:** `db reset --version 20261005122500` en local (las 36 de `main` y las 26 renumeradas) frente a la aplicación histórica, con `pg_dump --schema-only` normalizado: **0 diferencias como conjunto**, también en grants; la barrera sigue en 87 y los buckets son iguales. La única diferencia de orden es la posición física de `tenants.generaciones_mes_max`. **Dev:** `renumerar-historial.sh` (revisión y después `--aplicar`) reconcilió las 26 con `migration repair`; después, las tres nuevas aplicadas dos veces; 65 de 65 sin desalineadas. **Generador:** `lib/suplemento/acceso.ts`. Bandera apagada → 403 en generar, bloque y word; tope de corridas completas por mes → 429 en generar. La pantalla esconde el generador en Cobertura, en su página (con aviso) y el «Regenerar» de la revisión. Interruptor en `/admin/clientes` con confirmación de contrato y consumo del mes. `e2e:generador-bandera` 11 de 11. Regresión: captura sugerida 26, jefe 13, auditor 58, auditor-rutas 92; `verify:export` en verde contra dev | **Decisión que tomé:** la unidad de `generaciones_mes_max` pasa a ser la corrida completa (`POST …/generar`) por emisora y mes, la lance quien la lance. Hoy solo el staff puede lanzarla, así que eximirlo, como decía el comentario de la columna, dejaba el tope sin efecto; regenerar un bloque no cuenta. **Error propio:** «nueve/27» en la especificación v0.13 y en el PR #6; eran ocho/26. Corregido en v0.14 y en el cuerpo del PR. `scripts/regenerar-seed-catalogo.mjs` leía la migración del catálogo por su nombre de archivo y se actualizó |
| 2026-10-05 | Paso 1 aprobado, con la unidad de `generaciones_mes_max`. PR #7 a `dev/ajustes-sep26`. **Paso 2: verificaciones previas sobre staging, de solo lectura** (`scripts/despliegue/verificar-previas-v33.mjs`, con `.env.staging.local` en subshell y la sesión del analista; la llave de servicio solo para `select … head`). **(a)** 292 evidencias, ninguna de más de 25 MB; la mayor pesa 10.01 MB; hay 13 objetos sin tamaño y 12 filas sin archivo, todas del seed de Empresa Demo. **(b)** El repunte toca 19 enlaces, uno por emisora de demostración (19 de 19) y **ninguno de Grupo Carso**: se borra «NIIF S2 29 (b) B64 y B65 inciso (a)» y se agrega «NIIF S2 29 (c)» en la solicitud «Riesgos físicos climáticos en instalaciones». **(c)** Ninguna restricción nueva cae sobre datos existentes: van sobre tablas que nacen en el lote o sobre columnas nuevas cuyo default las cumple. 9 renombres de códigos sin choque con códigos existentes; 3 códigos nuevos que no existían; 36 descripciones corregidas, todas presentes; 0 filas en las hojas de `mapeo_export` que se renombran; 37 filas de `plantilla_solicitudes`. **(d)** 20 emisoras: 19 demo y Grupo Carso. Al desplegar: las 19 demo con generador y lectura encendidos y la vitrina como está (AINDA apagada); Grupo Carso con vitrina, generador y lectura apagados; topes de 10 y 500. Coincide con §3. **(e)** `service_role` lee en staging las 13 tablas que la aplicación le pide, además del listado de storage. Las tablas nuevas declaran sus grants en la migración | **Error propio, corregido** (`4e9718f`): al separar el repunte en el Paso 1, quedó corriendo después del renombre de «NIIF S2 29 (b) B64 y B65 inciso (a)» a «NIIF S2 29 (b)» y en staging no habría hecho nada; ahora busca los dos nombres. **Decisión sobre `service_role`:** no hace falta migración. La aplicación en Heroku solo necesita leer tablas existentes (verificado) y escribir en las dos tablas nuevas (grants en sus migraciones). Quedan por comprobar en el ensayo `fn_log_evento` desde la cola y la descarga y el borrado en storage, porque probarlos aquí exigiría escribir. Lo que difiere entre local y alojado sigue afectando solo a scripts (`poblar-demo`): deuda ya anotada |
| 2026-10-05 | PR #7 mezclado (`d8ddbd9`); repunte de riesgos físicos aprobado para v33 (19 filas de mockups, ninguna de Grupo Carso). `start` y `lint` restaurados en `package.json` (`b431b42`; se perdieron al resolver el merge `d3cea13`). Ensayo `sqpxcxewoznhpwvhxamy` (Esteban): la copia de staging dejó 29 tablas idénticas; las 29 migraciones se aplicaron en 17 s y quedaron 65 de 65 con barrera 87. **Paso 3 (A8)** con `scripts/ensayo/a8-heroku.mjs`. **Línea base** en `referencia/lineas-base/v33/antes/`: Excel de CLEPSA, Banco Base y Grupo Carso desde staging. **Despliegue** de `dev/ajustes-sep26` a `traceline-dev` (v11): arranca con `pnpm start`, `/login` responde 200, sin errores en los logs tras el despliegue; slug de 181 MB frente a 157 MB de staging. **Banderas** de las 20 emisoras conforme a §3. **Bloque 29** desde Heroku: 37.4 s de reloj, 33.9 s en el servidor, $0.2452, primer intento; `after()` funciona en el dyno. **Documento completo** del demo: 40 de 40 bloques en borrador, 9.9 min, sin fallos ni cortes por tiempo, mediana de 41.8 s por bloque (p90 56.8 s, máxima 61.1 s), **$8.93**. **Aislamiento**, 8 de 8 con rechazo del servidor: el administrador de CLEPSA recibe 404 o 403 en el bloque, la generación, el Word, la consulta de bloque y la descarga de evidencias de Empresa Demo; por RLS ve 0 filas de contenido, sugerencias y capturas ajenas; la base le rechaza decidir una sugerencia ajena; la ruta de regeneración responde 401 sin el secreto. **Evidencia de 22.4 MB** por URL firmada desde el portal en Heroku: 7.4 s; la cola la leyó con `after()` en 6 s ($0.0148); consola limpia | **Incidente (error propio):** al leer el log del Scheduler filtré con lista negra (`secret|key|token`) y salió en pantalla parte del `CRON_SECRET` de `traceline-dev`, que el comando del job lleva literal en un header `Authorization: Bearer`. Reportado de inmediato; la rotación la hace Esteban. El job, además, llama con GET (405) y manda el secreto en `Authorization` en vez de `x-cron-secret`; comando corregido propuesto: `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" …`. **Hallazgo para v33:** `reportes.anio_adopcion` llega vacía en los 20 reportes de staging, y sin ella el generador responde 422; en ensayo se declaró solo para Empresa Demo (2025). Falta decidir cómo se declara en los mockups. **Pendiente:** la prueba de la cola por el Scheduler, cuando el job esté corregido y el secreto rotado |
| 2026-10-05 | Secreto de `traceline-dev` rotado y job del Scheduler corregido por Esteban (POST, `x-cron-secret`, cada 10 min). **A8, cola por el Scheduler** (`a8-heroku.mjs cron`): una evidencia registrada sin pasar por la app (CSV de Empresa Demo) quedó pendiente y el job la dejó en `extraido` a los 2.8 min, sin error. **A8 cerrado.** **`anio_adopcion`:** migración `20261005130100_reportes_anio_adopcion_demo` (`73ccee0`): en los reportes de emisoras `es_demo` sin año, `anio_adopcion = ejercicio`; Grupo Carso no se toca y queda sin año hasta que la emisora lo declare. Aplicada en local, dev y ensayo (66 de 66, barrera 87). En ensayo, `POST generar` del reporte de CLEPSA responde 200 (régimen de primer año, 40 bloques en cola), ya no 422 | **Decisión que tomé:** declarar el año de adopción de los mockups igual al ejercicio del reporte (primer año de aplicación), por migración de datos acotada a `es_demo`. Queda en ensayo un documento de CLEPSA con 40 bloques en cola, sin generar |
