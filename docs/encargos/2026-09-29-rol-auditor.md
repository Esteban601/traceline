# Encargo: Rol auditor (solo lectura con comentarios y registro de actividad)

Versión 3 · 29 de septiembre de 2026. La conversión de CLEPSA a cliente real sale de este encargo: Deloitte
participó en la llamada con CLEPSA y sabe que el tenant actual lleva información de muestra. La conversión será
un encargo propio al kick off (ver §6).

**Responsable:** Esteban (con Claude Code)
**Rama:** `hotfix/rol-auditor` desde `main` (lo que corre en staging). Se integra a `main` por PR y, después del
despliegue, se mezcla a `dev/ajustes-sep26`.
**Fecha de inicio:** 29 de septiembre de 2026 · **Entrega:** credencial de auditor para Deloitte a finales de la
semana, sobre el tenant actual de CLEPSA (mockup, conocido como tal por Deloitte).
**Referencia:** `CLAUDE.md` §3, §6, §9; especificación §10 (despliegues).

## 1. Objetivo

Un rol `auditor` que puede leer todo lo de su tenant (todas las áreas), descargar los archivos de las solicitudes
y el Excel de taxonomía, y dejar comentarios; que no puede subir, validar, observar, eliminar, generar ni
descargar el suplemento; y cuya actividad (vistas y descargas) queda registrada en una bitácora que solo el
administrador de IRStrat consulta. Primer uso: Deloitte sobre el tenant actual de CLEPSA.

## 2. Alcance

Incluye:
- Rol `auditor` en el enum de roles (migración propia).
- RLS de solo lectura para auditor sobre: solicitudes, evidencias (todas las versiones), capturas de valor,
  comentarios, áreas, reportes, registros de clima y sus valores, objetivos y su detalle, cuestionarios; todo
  acotado a su tenant. Lectura del bucket de evidencias de su tenant. INSERT solo en comentarios (propios).
  Ningún UPDATE ni DELETE en ninguna tabla.
- Toda acción del servidor (subir evidencia, validar, observar, eliminar, difusión, recordatorios, cambiar
  estado, generar o descargar suplemento, editar Perfil) rechaza el rol aunque se llame directo a la ruta.
- Descarga del Excel de taxonomía: permitida.
- Comentarios del auditor: bloque propio "Comentarios del auditor" en el detalle de solicitud, registro de
  clima, objetivo y cuestionario. El auditor inserta; staff y admin del cliente ven y responden (cualquiera de
  los dos; no hay un responsable único); el auditor ve las respuestas. Sin edición ni borrado por parte del
  auditor. Los comentarios existentes de otros roles no cambian.
- Estado de atención: cada comentario del auditor muestra "sin responder" o "respondido por <nombre> el
  <fecha>". La matriz y el detalle muestran a staff y admin del cliente el número de comentarios del auditor
  sin responder, para que lo pendiente sea visible sin buscarlo. El auditor no ve este contador.
- Interfaz: el auditor entra al panel (`/admin`) en modo lectura: matriz completa de su tenant, detalle de cada
  solicitud con versiones de evidencia, quién subió y cuándo, quién validó y cuándo; Cobertura; registros de
  clima, objetivos y cuestionarios en lectura. Sin botones de acción; sin menú de administración; sin Perfil
  del emisor; sin bitácora general; sin suplemento ni vitrina.
- Tabla `auditor_actividad`: tenant, auditor, tipo (inicio de sesión, vista de matriz, vista de cobertura,
  vista de solicitud, vista de evidencia, descarga de evidencia, descarga de Excel, comentario), objeto,
  archivo, IP, navegador, fecha. La escribe el servidor con `service_role` en cada lectura o descarga del rol
  auditor. Solo la lee el rol staff administrador (no analista, no admin del cliente). Retención: se documenta
  en la especificación (propuesta: 24 meses).
- Pantalla `/admin/auditoria`, solo staff administrador: filtro por emisora, auditor y fechas; línea de tiempo;
  exportación CSV.
- Alta de auditores solo por staff, desde Usuarios: correo, nombre, tenant. Sin caducidad; al terminar el
  proceso se **desactiva** (no se borra), para que la actividad siga referenciando a la persona.
No incluye:
- La conversión de CLEPSA a cliente real. Al kick off: tenant nuevo "Libramiento Elevado de Puebla, S.A. de
  C.V." con `es_demo = false`, áreas y usuarios reales con cambio de contraseña forzado, sin solicitudes
  ficticias; el mockup se desactiva (no se borra); la credencial de Deloitte se recrea sobre el tenant real.
  Encargo propio.
- Cambios al generador ni a nada de `dev/ajustes-sep26`.
- Caducidad automática de credenciales.
- Acceso del auditor a la bitácora general, al Perfil del emisor, a documentos generados o a la vitrina.
- Notificaciones por correo de comentarios del auditor (se evalúa después; por ahora se ven en pantalla).

## 3. Qué toca y qué no

Toca: `supabase/migrations/` (tres migraciones: enum, RLS y tabla de actividad, política de storage),
`lib/bitacora.ts`, helpers de autorización (`puedeEntrarPanel` y equivalentes), acciones del servidor de
solicitudes/evidencias/registros/objetivos/cuestionarios, vistas del panel, `admin-sidebar.tsx`, Usuarios,
`lib/database.types.ts`, seed (rol auditor de ejemplo en Empresa Demo).
No toca: `lib/suplemento/`, `lib/reporte/`, `assets/`, la plantilla del Excel, `scripts/crear-demo-prospecto.mjs`.
Ambiente de desarrollo: proyecto dev de Esteban (su esquema es superconjunto de `main`; sirve para probar el
hotfix). Staging: solo en el despliegue, con el procedimiento de §7.

## 4. Definición de terminado

- `tsc` limpio, `eslint` sin errores nuevos, `verify:export` verde.
- Migraciones aditivas, aplicadas dos veces sin error en dev; `migration list` local == remoto.
- Prueba de aislamiento con la cuenta auditor del seed: puede leer todo lo de Empresa Demo y nada de otro
  tenant; cada acción prohibida devuelve rechazo del servidor (no solo botón oculto), probada ruta por ruta.
- Prueba de comentarios: el auditor inserta, no edita, no borra; staff o admin del cliente responden; el
  auditor ve la respuesta; el contador de "sin responder" baja al responder y no es visible para el auditor.
- Prueba de actividad: una sesión de auditor de diez acciones produce diez filas correctas en
  `auditor_actividad`; el admin del cliente y el analista reciben cero filas al consultar; el staff
  administrador ve la pantalla y exporta el CSV.
- Ensayo del despliegue: copia de staging en un proyecto Supabase temporal (esquema y datos), migraciones
  aplicadas ahí sin error, Excel de taxonomía de tres emisoras idéntico antes y después, y `verify:export`.
- Despliegue: rama → PR a `main` → `git push heroku main` por Esteban → verificación en staging (auditor de
  Empresa Demo; Grupo Carso intacto; vitrina de un mockup intacta) → registro en §10.
- Cuenta de auditor de Deloitte creada por staff sobre el tenant actual de CLEPSA, y aviso por escrito a
  Deloitte de que su actividad queda registrada y de que el tenant lleva información de muestra hasta el kick off.

## 5. Entregables intermedios

- Paso 0: resumen de una página (qué se entendió, cómo, qué toca y qué no), con parada.
- Paso 1: migraciones y RLS, probadas en dev con la cuenta auditor del seed. Parada: mostrar políticas.
- Paso 2: acciones del servidor bloqueadas y panel en modo lectura. Parada: Esteban revisa pantallas como
  auditor, como admin del cliente y como staff.
- Paso 3: comentarios del auditor y `auditor_actividad` con su pantalla. Parada: revisión.
- Paso 4: ensayo del despliegue en la copia de staging. Parada: informe del ensayo.
- Paso 5: despliegue y alta del auditor de Deloitte.

### 5.1 Guion del paso 4 · ensayo del despliegue

Proyecto `traceline-ensayo` (ref `ndodorukqqyzhinahmrm`). Lleva datos reales copiados de staging, es temporal
y se borra tras el despliegue (especificación §10, «Ensayo de despliegue»). Cada paso anota su hora de inicio y
fin en §7.

**Preparación.** `.env.ensayo.local` (ignorado por git) lleva solo `ENSAYO_DB_URL`, con la contraseña de ensayo
que pega Esteban; si tiene caracteres especiales va codificada en porcentaje. `.env.local` lleva
`ENSAYO_REF=ndodorukqqyzhinahmrm`, que solo lee `scripts/ensayo/migrar-ensayo.sh`. Ensayo **no** entra en
`DEV_REFS_AUTORIZADOS`, y `poblar-demo.mjs` y `crear-demo-prospecto.mjs` rechazan su ref por constante.
Antes de (a), Claude Code valida que `ENSAYO_DB_URL` conecta (`select 1`) y que ensayo no tiene tablas en
`public`.

a. **Copia.** Esteban ejecuta en su terminal `scripts/ensayo/copiar-staging.sh`, con `STAGING_DB_URL` y
   `ENSAYO_DB_URL` como variables de esa ejecución: la contraseña de staging no se escribe en ningún archivo ni
   pasa por Claude Code. El script copia `public` (esquema y datos), `supabase_migrations`, las filas de
   `auth.users`, `auth.identities`, `storage.buckets` y `storage.objects` (sin bytes) y las políticas de
   `storage.objects`, sin owners ni privilegios. Termina comparando conteos tabla por tabla, y si alguno difiere
   sale con código 1. Esteban pega en el chat la tabla de conteos, que no lleva datos.
b. **Línea base.** Antes de migrar, sobre ensayo: Excel de taxonomía de CLEPSA, Banco Base y Grupo Carso
   (ruta de descarga del panel como staff), y una instantánea de Grupo Carso (conteos por tabla de su tenant y
   suma de verificación de sus filas) y de `perfiles_usuario` (id, rol, tenant) de todos los usuarios.
c. **Migraciones del hotfix, dos veces.** `bash scripts/ensayo/migrar-ensayo.sh` dos veces. La primera aplica
   las cinco migraciones `20260929*`. La segunda no debe aplicar nada ni fallar. En las dos, `migration list`
   local == ensayo. `fn_aplicar_barrera_auditor()` devuelve el mismo número de políticas en las dos.
d. **e2e contra ensayo.** `e2e:auditor` y `e2e:auditor:rutas` con `NEXT_PUBLIC_SUPABASE_URL` y las llaves de
   ensayo en un subshell (pendiente: cómo llegan las llaves de API de ensayo sin pasar por el chat). Se usa un
   auditor de utilería creado para la prueba sobre un tenant mockup, **nunca Grupo Carso**. El auditor, sus
   comentarios, su actividad y los tenants auxiliares del e2e se borran al terminar, y se verifica con conteos
   que no quedó ninguno.
e. **Excel idéntico.** Se vuelven a descargar los tres Excel de (b) y se comparan celda por celda (valor, hoja y
   dirección) con un comparador ExcelJS en `scripts/ensayo/`, no por bytes: un libro regenerado difiere en
   bytes por las marcas de tiempo. `verify:export` no sirve aquí, porque valida el libro del demo contra sus
   reglas pero no compara dos libros. La descarga necesita la app local apuntando a ensayo (pendiente, igual que
   las llaves de (d)).
f. **Grupo Carso intacto.** La instantánea de (b) repetida coincide, y ningún usuario de `perfiles_usuario`
   cambió de rol ni de tenant.
g. **Informe.** Fila en §7 con tiempos por paso, resultados y lo que falló.
h. **Paso 5 preparado y parada.** PR de `hotfix/rol-auditor` a `main` y lista de comprobaciones del despliegue.
   Claude Code se detiene ahí: el `git push heroku main` y la aplicación de migraciones en staging los hace
   Esteban.

## 6. Riesgos y dudas conocidas

- Primer cambio de esquema en staging desde julio; el ensayo en copia no es opcional.
- El rol se construye sobre `main` y `dev` tiene cambios en los mismos archivos (`cobertura-view.tsx`,
  sidebar, tipos): el merge posterior a `dev` tendrá conflictos conocidos; se resuelven en `dev`, no en el hotfix.
- Los comentarios del auditor los atiende staff o el admin del cliente, sin responsable único; el contador de
  pendientes es lo que evita que queden sin respuesta.
- Registrar vistas del auditor requiere instrumentar lecturas de página, no solo descargas: cualquier vista
  nueva del panel debe registrar si el rol es auditor. Se documenta como regla en `CLAUDE.md` §5 en el merge.
- Al kick off de CLEPSA (encargo aparte): tenant nuevo con `es_demo = false`, mockup desactivado, credencial
  de Deloitte recreada sobre el tenant real, y la hoja CLEPSA del Excel de accesos marcada como retirada.

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-09-29 | Encargo escrito con las respuestas de Manuel vía Esteban | Auditor sin bitácora general; sin caducidad, se desactiva; comentarios en bloque propio |
| 2026-09-29 | Deloitte estuvo en la llamada con CLEPSA y conoce que el tenant es de muestra | La conversión a cliente real sale de este encargo y se hace al kick off como encargo propio |
| 2026-09-29 | Los comentarios del auditor los atiende staff o el admin del cliente | Sin responsable único; estado de atención por comentario y contador de pendientes en matriz y detalle |
| 2026-09-30 | Guion del paso 4 escrito (§5.1); proyecto `traceline-ensayo` creado | La contraseña de staging no toca ningún archivo: la copia la ejecuta Esteban con variables de entorno. Ensayo fuera de `DEV_REFS_AUTORIZADOS`; `ENSAYO_REF` propio |
