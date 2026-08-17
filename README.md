# vert-evidencia

Herramienta de **recabado y trazabilidad de evidencia ESG** (taxonomía NIIF
S1/S2), multi-tenant, para la elaboración de Reportes Anuales Sustentables de
emisoras BMV (IRStrat / Vert).

> El nombre comercial está **pendiente**. La aplicación lo toma siempre de
> `NEXT_PUBLIC_APP_NAME` (default provisional: `TRACELINE`), nunca hardcodeado.

## Estado

- ✅ Base de datos, seguridad (RLS), triggers y seeds DEMO.
- ✅ **Portal del cliente** (autenticación + tablero + detalle de solicitud + carga de evidencia).
- ✅ **Panel interno de IRStrat** (`/admin`): matriz de seguimiento, detalle staff, cobertura de taxonomía y export a Excel.
- ✅ **Módulo de gestión (Fase 1, cierre)**: alta/edición/borrado de solicitudes con mapeo a datapoints, gestión de usuarios del cliente y plantillas de checklist (`/admin/plantillas`, `/admin/usuarios`).
- ✅ **Candado de trazabilidad (Fase 2)**: justificación de ajustes, congelamiento de reporte, alerta de discrepancia entre áreas y bitácora visible (ver más abajo).
- ✅ **Operación multi-cliente (Sprint 7)**: alta de clientes desde la UI
  (`/admin/clientes`) con sus áreas, prefijo de folios y logo; invitaciones de un
  solo uso; recuperación de contraseña; selector de cliente en matriz y cobertura.
- 🌱 **Correo y recordatorios (Fase 1)** — solicitar, recordar y avisar observaciones vía Resend (rama `fase-1-recordatorios`).

Stack: Next.js 15 (App Router, TypeScript, pnpm) + Supabase local (CLI + Docker).
Diseño: Tailwind v4 puro, paleta editorial crema/teal/dorado, Sora + Inter.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env.local     # rellena las claves (ver `supabase status`)
supabase start                 # levanta Postgres/Studio/Storage local
supabase db reset              # aplica migraciones + seed DEMO
pnpm dev                       # portal en http://localhost:3000
```

## Portal del cliente

Rutas:

| Ruta | Descripción |
|------|-------------|
| `/login` | Ingreso email + contraseña (Supabase SSR). |
| `/portal` | Tablero: KPIs semáforo + lista de solicitudes (toggle "Mis/Todas" para coordinador). |
| `/portal/solicitudes/[id]` | Detalle: historial de evidencias versionadas, captura de valor, comentarios/observaciones y carga (drag & drop). |
| `/portal/descargar/[evidenciaId]` | Descarga vía URL firmada de corta duración. |

Todas las rutas del portal están protegidas por middleware (sin sesión → `/login`).

### Usuarios demo (contraseña `Demo2025!`)

| Usuario | Qué probar | Ve |
|---------|-----------|-----|
| `rh@empresademo.example` | Cliente acotado por área | **5** solicitudes (RH) |
| `operaciones@empresademo.example` | Cliente acotado por área | **7** solicitudes (Operaciones) |
| `finanzas@empresademo.example` | Cliente acotado por área | **4** solicitudes (Finanzas) |
| `coordinador@empresademo.example` | Coordinador + toggle "Mis/Todas" | Solicitudes del tenant |
| `analista@irstrat.example` | Staff IRStrat (panel interno completo) | Todo |
| `admin@irstrat.example` | Staff IRStrat con rol **admin** (puede congelar reportes) | Todo |

Recorridos sugeridos:

- **Semáforo y estados variados**: cualquier usuario → tablero (KPIs Pendientes/Recibidas/Con observaciones/Validadas).
- **Observación destacada + responder**: `rh` → "Índice de rotación voluntaria 2025 (%)" (estado *con observaciones*).
- **Versionado de evidencia + captura de valor**: `operaciones` → "Consumo de energía eléctrica 2025 (kWh)" (dos versiones, valor corregido).
- **Carga cuantitativa (drag & drop)**: `operaciones` → "Inventario GEI Alcance 2" (*solicitado*, con campo de captura tCO2e).
- **Toggle Mis/Todas**: `coordinador` → alterna entre las 4 de Gobierno/Dirección y las 20.

## Correo y recordatorios (Fase 1)

Sistema de solicitud y recordatorios por correo (Resend). Tres plantillas HTML
alineadas al DESIGN.md: (a) solicitud de información, (b) recordatorio semanal
(digest, con observaciones destacadas) y (c) aviso de observación.

### Modo consola (sin cuenta de Resend)

**Sin `RESEND_API_KEY`, el sistema entra en "modo consola": los correos NO se
envían, se imprimen en el log del servidor.** Así se prueba todo el flujo en
local sin cuenta de Resend. Variables (ver `.env.example`):

| Variable | Rol |
|----------|-----|
| `RESEND_API_KEY` | Ausente → modo consola. Presente → envío real vía Resend. |
| `EMAIL_FROM` | Remitente (dominio verificado en Resend). Irrelevante en modo consola. |
| `NEXT_PUBLIC_APP_URL` | Base de los enlaces (CTA) de los correos. Local: `http://localhost:3000`. |
| `CRON_SECRET` | Protege `POST /api/recordatorios` (header `x-cron-secret`). |

### Cómo probar en modo consola

Deja `RESEND_API_KEY` vacío y observa el log de `pnpm dev`. Cada correo aparece
como un bloque `📧 CORREO (modo consola)` con destinatario y asunto.

1. **Solicitar** (panel `/admin`, como `analista@irstrat.example`):
   - Detalle de una solicitud *pendiente* con responsable → botón **"Enviar
     solicitud"**. En el log: un correo de *solicitud de información*. La
     solicitud pasa a *solicitada*.
   - Matriz: marca varias *pendientes* con checkbox → **"Enviar solicitudes"**.
     Se agrupan por responsable → **un correo por persona** con todas sus
     solicitudes. La barra muestra correos enviados / solicitudes actualizadas.
2. **Recordar**: botón **"Enviar recordatorios ahora"** (arriba en la matriz).
   En el log: un *digest* por responsable con pendientes (*solicitado* +
   *observaciones*, estas últimas destacadas). La barra muestra enviados y
   **omitidos** por la regla anti-spam (no se reenvía si el último recordatorio
   fue hace < 5 días). Púlsalo dos veces para ver la omisión.
   - Equivalente por API: `curl -X POST http://localhost:3000/api/recordatorios -H "x-cron-secret: $CRON_SECRET"`
3. **Observar**: en el detalle staff, escribe una **observación**. Además del
   cambio de estado, en el log aparece el *aviso de observación* al responsable.
   Si la solicitud no tiene responsable, no se envía y la acción lo indica.

Toda acción de correo queda en `bitacora` (`entidad = 'correo'`, acciones
`solicitud_enviada` / `recordatorio_enviado` / `aviso_observacion`).

### Despliegue en producción (pendiente de configurar)

- Define `RESEND_API_KEY` y `EMAIL_FROM` (dominio verificado en Resend),
  `NEXT_PUBLIC_APP_URL` (URL pública) y `CRON_SECRET`.
- **Cron de recordatorios (Heroku Scheduler)** — *no configurado en este sprint*.
  Programar un job periódico (p. ej. semanal) que ejecute:
  ```bash
  curl -fsS -X POST "$NEXT_PUBLIC_APP_URL/api/recordatorios" \
    -H "x-cron-secret: $CRON_SECRET"
  ```
  El endpoint agrupa por responsable, respeta la regla anti-spam de 5 días y
  registra cada envío en la bitácora.

## Candado de trazabilidad (Fase 2)

Refuerzos de trazabilidad para aseguramiento, todos con candado **a nivel de base
de datos** (no solo UI).

### Justificación de ajustes

- Columna `justificacion` en `evidencias` y `capturas_valor`.
- Al cargar evidencia/captura sobre una solicitud **`validado`**, el formulario
  **exige** justificación (mín. 20 caracteres) y el estado regresa
  automáticamente a **`en_revision`** por trigger (`fn_evidencia_after_insert` /
  `fn_captura_after_insert`), con la justificación registrada en la bitácora.
- En otros estados el campo es opcional y solo se muestra si ya existe una versión
  previa ("¿Por qué reemplazas esta evidencia?").
- La justificación aparece en el historial de versiones (portal y admin).

### Congelamiento de reporte

- `/admin/reportes` → **"Congelar reporte"**, acción de **rol `admin`** (no
  analista), con confirmación reforzada (reescribir el nombre del reporte).
- Efecto: `reportes.estado='congelado'`, `fecha_congelamiento=now()` y **todas**
  sus solicitudes pasan a `congelado`.
- Candado a nivel BD: con el reporte congelado, se bloquea por trigger el INSERT
  de evidencias/capturas/comentarios y cualquier UPDATE de sus solicitudes
  (incluido cambio de estado). La **lectura y el export siguen funcionando**.
- En el portal, un reporte congelado se muestra en solo-lectura con aviso
  ("Este informe fue cerrado el {fecha}; la evidencia quedó congelada para
  aseguramiento").
- **Descongelar no está implementado, por diseño.** Un reporte congelado no puede
  revertirse (trigger `fn_bloquea_descongelar`). Si algún día se requiere, es una
  decisión administrativa que deberá introducirse con **su propia migración**
  (levantar el trigger de forma controlada y auditada); no es una acción de la UI.

### Alerta de discrepancia entre áreas (refinada por `rubro_clave`, Fase 3)

- Dos solicitudes solo se comparan si comparten el mismo **`rubro_clave`**
  (columna en `solicitudes`): significa que capturan el mismo concepto del mundo
  real y deben cuadrar. Se compara la última captura confirmada de cada una; si
  hay valores distintos con **misma unidad y periodo**, es una discrepancia
  (`lib/discrepancias.ts`). Una solicitud **sin `rubro_clave` nunca participa**.
- El campo `rubro_clave` es opcional en el formulario de crear/editar solicitud
  ("solo si dos áreas capturan el mismo concepto y deben cuadrar").
- Esto evita falsos positivos por **desgloses legítimos** (p. ej. las 15
  categorías de Alcance 3 mapean al mismo datapoint con valores distintos, pero
  no llevan `rubro_clave` → no disparan alerta).
- Se señala con badge en `/admin/cobertura` y con un aviso en el detalle de las
  solicitudes involucradas. Solo staff.
- Caso DEMO: **consumo eléctrico 2025** reportado por Operaciones (1,875,430 kWh)
  y Finanzas (1,912,000 kWh), ambas con `rubro_clave='consumo_electrico_total'`.

### Bitácora visible

- Timeline cronológico en el detalle staff de cada solicitud.
- `/admin/bitacora`: vista global filtrable por cliente, entidad y rango de
  fechas (solo staff).

## Taxonomía oficial: llenado del Excel (Fase 3)

Motor que genera una **copia de la plantilla oficial** de la firma
(`assets/taxonomia-base.xlsx`) llenada desde los datos validados de la
plataforma, vía `exceljs`. Botón **"Generar Excel de taxonomía"** en
`/admin/cobertura` (solo staff).

- **Regla dura:** a las hojas de datos solo entra el valor de la última captura
  **confirmada** cuya solicitud esté **`validado`** (o el valor vigente de un
  registro **activo**). Lo no validado no entra: en su lugar va una nota de
  brecha (`Pendiente de validación en plataforma` / `Sin evidencia` /
  `Sin datos del ejercicio`). Pie discreto `[DEMO]` en cada hoja llenada.
- **Hojas GEI** (`29(a)(i)`, `29(a)(vi)(1)`): mapeo fijo **celda↔dato** en la
  tabla `mapeo_export` (categoría×año → celda), construido leyendo la plantilla.
- **Hojas de registros** (`S2 10`, `29(b)`, `30`, `29(d)`): **escritura
  posicional** — el nº de registros es dinámico y se llenan slots secuenciales
  por sección; por eso *no* usan `mapeo_export`. Si hay más registros que slots,
  se escriben los que caben y se anota `+N registros adicionales en plataforma`.
  **Fidelidad v2:** el horizonte temporal es **multi-enum** (se listan los plazos
  marcados) y el **despliegue de capital** se desglosa en 3 sub-filas por año
  (`Cantidad de gasto de capital` / `de financiación` / `de inversión`); cada
  registro ocupa un bloque de 3 filas en `29(b)/30/29(d)`.
- **Hojas de objetivos** (`S1 51`, `S2 33/34/35/36(a)-(d)`): escritura posicional;
  un mismo objetivo climático se sigue por la misma fila en las 4 hojas S2 33-36.
  **Fidelidad v2:** tipos oficiales — `tipo` es enum condicionado por ámbito
  (climático 3 opciones, sostenibilidad 2), `tipo_objetivo` ∈ {Cuantitativo,
  Absoluto, De intensidad}; gases (7) y alcances (3) son multi-enum; validación por
  tercero y enfoque de descarbonización son booleanos (`Verdadero`/`Falso`). Las
  opciones canónicas viven en `lib/objetivos-opciones.ts` (validadas en UI y en la
  server action).
- **Hojas de cuestionarios** (`S2 22(b)(i)`, `S2 22(b)(ii)`, `S2 36(e)(i)-(iv)`):
  rejilla pregunta/respuesta. Las **preguntas son fijas** de la estructura oficial
  y viven en `lib/cuestionarios.ts` (no en BD), **validadas contra la fuente**. El
  control de captura por pregunta (texto / booleano / enum único / enum múltiple)
  define la serialización de la respuesta. Una pregunta sin responder marca
  `Pendiente en plataforma` en su columna de notas.

Con esto el export cubre **14 de las 15 hojas** de llenado de la plantilla. La
hoja restante, **`NIIF S1 46-50`**, queda **condicionada a licenciamiento** (usa
la taxonomía SASB/ISSB por sector, sujeta a licencia): no se llena en esta fase.
Su especificación (métricas por norma NIIF/SASB/CDSB: nombre, descripción, fuente,
tipo de métrica, validación por tercero, método de cálculo, datos, limitaciones y
supuestos) queda documentada aquí para el sprint futuro que la habilite.

**Hoja no construida — `NIIF S2 29(a)(iv)`:** está en el índice de la taxonomía
(hoja 'Fondo I') pero la plantilla base **no incluye una hoja de llenado** para
ella. Es una **decisión de negocio pendiente**: no se construye hasta definir su
estructura de captura; se deja registrada aquí para no perder la traza.

### Verificación end-to-end (`verify:export`)

Prueba la **ruta HTTP autenticada** (no solo el motor): forja sesión de admin con
`@supabase/ssr`, invoca el export y valida HTTP 200 + las 14 hojas llenadas + las
reglas duras. Requiere el server corriendo y el seed aplicado:

```bash
supabase start && pnpm dev      # en una terminal
pnpm verify:export              # en otra (usa admin@irstrat.example por defecto)
# baseUrl / credenciales configurables:
#   pnpm verify:export http://localhost:3000
#   ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm verify:export
```

## Operación multi-cliente (Sprint 7)

La firma deja de operar un solo cliente: se dan de alta emisoras desde la UI, cada
una con su marca, sus áreas y sus usuarios, y el aislamiento entre ellas lo
garantiza RLS (verificado con dos sesiones simultáneas, ver la guía de prueba).

### Alta de cliente — `/admin/clientes` (solo staff)

| Campo | Regla |
|-------|-------|
| **Nombre** | Como aparece en el informe y en su portal. |
| **Identificador (slug)** | Se autogenera del nombre y es editable. Único, kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`), validado en UI **y** como CHECK en la base. |
| **Prefijo de folios** | Se autogenera del nombre y es editable. 3-4 letras mayúsculas, único (`^[A-Z]{3,4}$`). Etiqueta breve del cliente en el panel staff. |
| **Áreas iniciales** | Casillas de las estándar (RH, Operaciones, Finanzas) más las que se agreguen. **Al menos una**: sin áreas el cliente no puede recibir solicitudes. |

Al crear, el tenant queda **operable** (existe, activo, con sus áreas en
`areas_tenant`) y la UI encadena los dos pasos siguientes con el cliente ya
preseleccionado: *crea su primer reporte* (`/admin/plantillas?tenant=…`, reusando
las plantillas de checklist existentes) y *da de alta a sus usuarios*
(`/admin/usuarios?tenant=…`).

**Desactivar, nunca borrar.** `tenants.activo = false` con `ConfirmDialog`. El
cliente deja de ofrecerse para trabajo nuevo y **sus usuarios ya no pueden
ingresar** (se corta en el login y se revalida en el middleware en cada request);
su reporte, su evidencia y su bitácora se conservan y se puede reactivar. Toda el
alta y la baja quedan en bitácora (`entidad = 'tenants'`).

### Invitaciones y acceso

- **Liga de invitación de un solo uso** al crear un usuario: vence a las **72 h**,
  lleva a `/invitacion/[token]` para establecer contraseña propia y se muestra al
  staff para compartirla por el canal que sea. En la base se guarda el **SHA-256**
  del token, nunca el token. El canje corre con `service_role` (quien entra aún no
  tiene sesión) y la autorización la da el token, no una identidad.
- La **contraseña temporal** sigue existiendo como respaldo, y el botón
  **"Invitar"** de la lista regenera la liga cuando vence.
- El **correo de invitación** ya está implementado; sin `RESEND_API_KEY` sale al
  log del servidor y la vía de entrega operativa es la liga visible en el panel.
- **"¿Olvidaste tu contraseña?"** en el login → `/recuperar`. Flujo estándar de
  Supabase auth: con Resend se envía el correo; en **modo consola** se genera la
  misma liga con la Admin API y se imprime en el log. La liga pasa por
  `/auth/confirmar` (verifica el token y abre la sesión en cookies) y termina en
  `/restablecer`. La respuesta al usuario es siempre la misma exista o no la
  cuenta, para no delatar quién tiene acceso.
  - La plantilla de correo vive en `supabase/templates/recuperacion.html` y está
    conectada en `config.toml`. **En producción hay que cargarla también en el
    dashboard de Supabase** (Auth → Email Templates → Reset Password): la liga por
    defecto devuelve los tokens en el fragmento `#` de la URL, que el servidor no
    puede leer.

### Logo por cliente

- Columna `tenants.logo_url` + bucket de storage **`logos`**: lectura pública
  (el logo se pinta sin firmar URLs), **escritura solo staff**, con políticas
  explícitas y `allowed_mime_types` / `file_size_limit` en el propio bucket.
- Se sube, reemplaza y quita desde `/admin/clientes`. Acepta **PNG, JPG, SVG o
  WebP, máx. 2 MB**; los **rasterizados se reducen a 400 px de ancho** y se
  reencodan a WebP en el navegador antes de subir (evita añadir una dependencia
  nativa de imagen al servidor; el servidor revalida tipo y peso igualmente). Un
  SVG con `<script>`, manejadores de evento o `javascript:` se rechaza.
- **Dónde se ve:** header del portal del cliente (su logo, no el de IRStrat) y
  junto al nombre del tenant en la matriz y el selector del panel staff. **Sin
  logo, iniciales** en el círculo del design system (comportamiento anterior).
- El logo **no entra al Excel de taxonomía**: ese documento es oficial y su
  formato no se toca.

### Selector de cliente en el panel staff

`/admin` y `/admin/cobertura` aceptan `?tenant=<id>` desde un selector (aparece
solo si hay más de un cliente). La matriz suma una columna **Cliente** cuando la
vista mezcla varios. La cobertura se mide **por cliente**: mezclar emisoras daría
un porcentaje que no le corresponde a ninguna.

> **Excel de taxonomía y multi-cliente.** El llenado de la plantilla oficial se
> arma desde `mapeo_export` (mapeo fijo celda↔dato, construido por reporte). Si el
> cliente seleccionado no tiene celdas mapeadas, el botón **no se ofrece** y se
> explica por qué: entregaría el libro de otro cliente. Parametrizar el mapeo por
> cliente es trabajo de un sprint propio.

La **alerta de discrepancia** también se acotó por cliente: dos emisoras usan los
mismos `rubro_clave` con valores legítimamente distintos y compararlas entre sí
sería una alerta falsa.

### Guía de prueba del flujo completo de alta

Con `supabase start`, `supabase db reset` y `pnpm dev` corriendo, como
`admin@irstrat.example` (`Demo2025!`):

1. **Alta.** `/admin/clientes` → **Nuevo cliente**. Escribe el nombre y comprueba
   que el slug y el prefijo se autogeneran (edítalos si quieres). Marca las áreas
   estándar y agrega una propia con **Agregar área**. → **Crear cliente**.
2. **Confirmación.** Aparece la tarjeta *"… está listo para operar"* con el
   prefijo de folios, las áreas creadas y los dos pasos siguientes.
3. **Logo.** En la tarjeta del cliente, **Subir logo** con un PNG ancho (> 400 px).
   Verifica que el archivo servido queda en `.webp` y 400 px de ancho.
4. **Primer reporte.** Clic en *Crea su primer reporte* → el cliente llega
   preseleccionado; elige la plantilla, ponle nombre y ejercicio → **Crear
   reporte**.
5. **Usuario.** `/admin/usuarios?tenant=…` (o *Da de alta a sus usuarios*): el
   formulario abre solo con el cliente puesto. Elige rol **Cliente** y su **área**
   del catálogo. → **Crear usuario**. Copia la **liga de invitación**.
6. **Acceso del cliente.** En una **ventana privada**, abre la liga, establece la
   contraseña y confirma que entras a `/portal` con **el logo del cliente** en el
   header. Vuelve a abrir la misma liga: debe decir *"Esta liga ya se usó"*.
7. **Carga de evidencia.** Abre una solicitud de su área y sube un archivo;
   comprueba que queda listada en *Tus entregas*.
8. **Aislamiento.** Con ese usuario, pega la URL de una solicitud de Empresa Demo
   (tómala del panel staff): debe responder *"Solicitud no encontrada"*. Repite al
   revés con `rh@empresademo.example` contra una solicitud del cliente nuevo.
9. **Vista del staff.** `/admin` sin filtro muestra los dos clientes con su
   columna **Cliente**; con el selector puesto en el nuevo, las filas de Empresa
   Demo desaparecen. Lo mismo en `/admin/cobertura`.
10. **Restablecer contraseña.** `/login` → *¿Olvidaste tu contraseña?* → escribe
    el correo. Toma la liga del log de `pnpm dev` (`🔑 LIGA DE RECUPERACIÓN`),
    ábrela, guarda una contraseña nueva y entra con ella.
11. **Baja.** `/admin/clientes` → **Desactivar** en el cliente de prueba y
    confirma. Intenta entrar con su usuario: el acceso queda cortado y el cliente
    sigue en la lista marcado como *Inactivo*.

## Documentación

- **[DESIGN.md](./DESIGN.md)** — sistema de diseño: tokens, tipografía, componentes, motion.
- **[README-SCHEMA.md](./README-SCHEMA.md)** — esquema, diagrama de relaciones,
  modelo RLS, triggers, storage, **credenciales demo** y decisiones de diseño.
- Types generados: `lib/database.types.ts`
  (`supabase gen types typescript --local > lib/database.types.ts`).
