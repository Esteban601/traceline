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
- ✅ **Export de taxonomía por cliente/reporte**: el mapeo celda↔dato es una
  definición reutilizable (rubros canónicos + año relativo); cualquier cliente
  genera su Excel.
- ✅ **Import de un cliente real (GCARSO)**: `scripts/import-gcarso.mjs` recrea el
  proceso IAS 2025 de Grupo Carso, con extensión VERT del catálogo.
- ✅ **Rol admin-cliente (tier de autoservicio)**: un usuario del cliente
  administra su propio tenant desde el panel —crea solicitudes internas, las
  valida, gestiona usuarios y áreas y genera su Excel— con la **regla dura de
  origen** (cada lado valida lo suyo) y el **toggle de carga por IRStrat** por
  cliente. Ver más abajo.
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
| `admin.cliente@empresademo.example` | **Administrador del cliente** (autoservicio): entra al **panel**, no al portal | Todas las solicitudes del tenant demo |
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

**El export es POR REPORTE.** La ruta exige `?reporte=<id>` y todo —GEI,
registros, objetivos y cuestionarios— se acota a ese reporte; no hay valor por
omisión, porque adivinar el reporte fue justo lo que hacía que un cliente
recibiera el libro de otro. El archivo se nombra con el slug del tenant real
(`taxonomia-{slug}-{ejercicio}-{fecha}.xlsx`).

- **Regla dura:** a las hojas de datos solo entra el valor de la última captura
  **confirmada** cuya solicitud esté **`validado`** (o el valor vigente de un
  registro **activo**). Lo no validado no entra: en su lugar va una nota de
  brecha (`Pendiente de validación en plataforma` / `Sin evidencia` /
  `Sin solicitud en el reporte` / `Sin datos del ejercicio`). El pie discreto
  `[DEMO]` se estampa **solo para el tenant de demostración**: marcar así el
  entregable oficial de una emisora real sería falsear su documento.
- **Hojas GEI** (`29(a)(i)`, `29(a)(vi)(1)`): mapeo **celda↔dato** en la tabla
  `mapeo_export`, construido leyendo la plantilla. Es una **definición
  reutilizable**: describe la plantilla (hoja, celda, **rubro canónico**, **año
  relativo**), no los datos de un cliente. Ver la sección siguiente.
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

### El mapeo es reutilizable, no del demo

Hasta el sprint anterior, `mapeo_export` ataba cada celda de valor a una
**solicitud concreta** — las del seed de Empresa Demo. El mapeo era, de hecho,
propiedad del demo: un cliente nuevo no tenía celdas y no podía generar su Excel.
Ahora el mapeo describe **la plantilla**, y los datos se resuelven en el momento
del export:

| Pieza | Qué es |
|-------|--------|
| `rubros_taxonomia` | Catálogo **global** de rubros canónicos (GEI Alcance 1/2/3 y las 15 categorías de Alcance 3 del GHG Protocol). Son categorías de la norma: viven con el mapeo, iguales para toda emisora. |
| `mapeo_export` | Una fila por celda: `(hoja, celda, datapoint_id, rubro_clave, anio_offset, celda_nota)`. El año es **relativo** (`0` = ejercicio del reporte, `1` = el anterior); con un año absoluto el mapeo solo habría servido para reportes 2025. |
| `solicitudes.rubro_taxonomia` | La contraparte del lado del cliente. **Única por reporte**, así que la resolución es determinista: el export busca, entre las solicitudes de ESE reporte, la que lleva el rubro de la celda. |
| `plantilla_solicitudes.rubro_taxonomia` | Propaga el rubro al clonar una plantilla. Es lo que hace que el **primer** export de un cliente nuevo salga lleno. |

**Por qué el join es por rubro y no por la liga a datapoints:** el datapoint es
1→N — las 15 categorías de Alcance 3 comparten `NIIF S2 29 (a)(vi)(1) EI12` y los
tres alcances comparten `29 (a)(i)`—, así que no identifica la celda. El
datapoint se conserva en la fila como ancla de taxonomía y trazabilidad.

> **No confundir con `solicitudes.rubro_clave`.** Aquel es texto libre y dice
> "estas dos áreas capturan el mismo concepto y deben cuadrar" (detector de
> discrepancias). `rubro_taxonomia` está acotado al catálogo y dice "esta
> solicitud llena esta celda de la plantilla oficial".

### Cómo dar de alta un cliente y que su primer export salga bien

1. **Crea el cliente** en `/admin/clientes` (nombre, slug, prefijo de folios y
   sus áreas).
2. **Crea su primer reporte desde una plantilla** — el enlace *"Crea su primer
   reporte"* del alta ya lleva el cliente preseleccionado. Usa una plantilla que
   traiga **rubros de taxonomía**; la del seed (`Checklist base NIIF S1/S2`) los
   trae. Aquí se decide todo: al clonar, cada solicitud hereda su rubro y el
   reporte queda listo para resolver las celdas de la plantilla oficial.
3. **Comprueba la cobertura**: en `/admin/cobertura`, elige el cliente y su
   reporte. El botón **"Generar Excel de taxonomía"** ya está disponible.
4. **Genera el Excel**: saldrá con las etiquetas de la plantilla y las notas de
   brecha correspondientes (`Sin evidencia` mientras no haya cargas). A medida
   que el cliente sube evidencia y el equipo valida, las celdas se llenan solas.
5. Si una celda dice **`Sin solicitud en el reporte`**, es que ese rubro no se le
   pidió a este cliente: crea la solicitud y asígnale el rubro en el campo
   **"Rubro de taxonomía"** del formulario, o clónalo desde una plantilla que lo
   incluya.

> Un rubro lo alimenta **una sola solicitud por reporte** (índice único en la
> base). Si intentas asignar el mismo dos veces, la app lo dice en vez de dejar
> el export en un empate silencioso.

> **Paso post-despliegue (una vez).** La migración traduce el mapeo y asigna los
> rubros a las **solicitudes** existentes, pero no puede inventar ítems en una
> **plantilla** que se guardó antes de que los rubros existieran. En un ambiente
> ya desplegado, entra a `/admin/plantillas` → **"Guardar desde un reporte"**,
> elige el reporte demo y guarda una plantilla nueva: esa sí llevará los 18
> rubros y las solicitudes GEI. Es la plantilla con la que arrancarán los
> clientes nuevos. (En local no hace falta: el seed ya la genera completa.)

### Verificación end-to-end (`verify:export`)

Prueba la **ruta HTTP autenticada** (no solo el motor): forja sesión de admin con
`@supabase/ssr` e invoca **dos** exports:

- **Empresa Demo** — la referencia: HTTP 200 + las 14 hojas llenadas + las reglas
  duras, exactamente como antes del rediseño del mapeo.
- **Un segundo tenant** creado al vuelo con datos mínimos (1 solicitud GEI
  validada) y ejercicio **2026**, distinto del demo. Comprueba que su celda se
  llena (el año relativo resuelve), que los rubros que su reporte no pide marcan
  `Sin solicitud en el reporte`, que el archivo lleva **su** slug, que **no**
  lleva la marca `[DEMO]` y que en el libro no aparece **ningún** dato de Empresa
  Demo. Al terminar se elimina.

Requiere el server corriendo y el seed aplicado:

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

El **Excel de taxonomía** se genera por **reporte** (ver la sección siguiente):
junto al selector de cliente hay uno de reporte, y el botón está siempre
disponible — solo pide que elijas reporte si no hay uno resoluble.

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

## Rol admin-cliente: el tier de autoservicio

Hasta aquí la plataforma asumía que **IRStrat** operaba el proceso y el cliente
solo respondía. El rol `admin_cliente` abre el otro modo: un usuario **del
cliente** administra su propio tenant sin acompañamiento —pide información a sus
áreas, la revisa, la valida y genera su Excel— sin ver ni tocar nada de otra
emisora.

No es un staff con menos botones ni un usuario de portal con más: entra al
**panel** (`/admin`), acotado a su cliente, con la marca de su cliente.

### Matriz de permisos

La misma regla vive en tres capas, y la autoridad es siempre la de abajo:
**RLS + triggers** (`supabase/migrations/20260820130000_admin_cliente.sql`),
**server actions** y **UI**. `lib/roles.ts` y `lib/origen.ts` son esa regla escrita
una vez para que las tres no se desalineen.

| Puede | Detalle |
|-------|---------|
| Ver **todas** las solicitudes de su tenant | Todas las áreas, no solo la suya. Nunca de otro tenant. |
| Subir evidencia | Como cualquier área de su cliente, eligiendo el área de origen. |
| Crear y editar solicitudes | Solo las **suyas** (origen `cliente`). Las de IRStrat las ve, no las modifica. |
| Revisar, observar y validar | Solo las de origen `cliente` — ver la regla dura, abajo. |
| Crear y editar áreas | Su catálogo (`areas_tenant`). Renombrar propaga a solicitudes y perfiles. |
| Crear y desactivar usuarios | Solo de su tenant y solo con rol **responsable de área** o **administrador del cliente**. |
| Su matriz, su cobertura, su bitácora | Con el **export de su Excel** de taxonomía y el de trazabilidad. |

| No puede | Por qué |
|----------|---------|
| `/admin/clientes`, `/admin/reportes`, `/admin/plantillas` | Son multi-emisora o propiedad de la firma. |
| Captura de taxonomía (clima, objetivos, cuestionarios) | Trabajo de analista. |
| Escribir el catálogo de datapoints o el mapeo NIIF | El mapeo a la norma lo decide IRStrat. El formulario de solicitud no le ofrece datapoints. |
| Crear staff, o usuarios de otro tenant | La server action ignora el `tenant_id` del formulario y toma el del perfil; RLS lo vuelve a negar. |
| **Congelar** un reporte | Decisión registrada abajo. |
| Eliminar solicitudes o áreas | La trazabilidad no admite borrar historia: las áreas se **desactivan**; retirar una solicitud es un acto de IRStrat. |
| Ver nada cross-tenant | RLS. Una URL directa de otra emisora responde *"Solicitud no encontrada"*. |

> **Lectura de la taxonomía, decisión explícita.** Su tier incluye "su cobertura
> con el export de su Excel", y esa vista **es** el catálogo de la norma: sin
> lectura, su cobertura saldría vacía y su Excel no sería suyo. Se le abre en
> **solo lectura** (datapoints, rubros, mapeo de la plantilla y el mapeo de sus
> propias solicitudes). Los usuarios de área siguen sin verlo, y la escritura
> sigue siendo exclusiva del staff.

### Origen de la solicitud y validación por origen

`solicitudes.origen` dice **quién pidió** la información: `irstrat` (la firma) o
`cliente` (el administrador del cliente, para su propio equipo). Es `NOT NULL` con
default `irstrat`, y el backfill de lo existente es un hecho histórico: hasta esta
migración no había otra vía de crear solicitudes que el panel interno.

**Badge visible para todos los roles** —staff, área, coordinador y administrador—
en la matriz y en el detalle, y también en el portal del cliente: **Solicitud
IRStrat** (teal) vs **Solicitud interna** (dorado). Saber de dónde viene la
petición es parte de la trazabilidad, no un detalle interno. En la matriz la
columna *Origen* aparece solo cuando la vista mezcla los dos: repetir "Solicitud
IRStrat" en cada fila de un cliente que nunca creó una interna sería ruido.

**REGLA DURA:** cada lado revisa, observa y valida **lo suyo**.

- Origen `irstrat` → solo el staff de IRStrat.
- Origen `cliente` → solo el `admin_cliente` de ese tenant.
- El otro lado **la ve completa** (la trazabilidad es compartida) pero no la
  transiciona: en vez de botones deshabilitados, la UI dice de quién es la
  revisión. La server action lo rechaza y el trigger
  `trg_solicitud_origen_transicion` lo impide en la base.

Dos excepciones deliberadas, ambas de la firma sobre el reporte entero: el
**congelamiento** y la **edición de campos** de una solicitud interna (p. ej.
asignar el rubro de taxonomía que hace que su valor llene una celda). Las
**transiciones automáticas** por llegada de evidencia o captura
(`pendiente→recibido`, `validado→en_revision`) no son actos de revisión y siguen
funcionando para cualquiera que tenga derecho a cargar: los triggers las marcan
con un ajuste local a la transacción para que el candado las distinga.

### Trazabilidad de la fuente de validación

Donde un valor validado alimenta una celda, la trazabilidad dice **quién lo
validó** —el origen lo determina, así que no hay ambigüedad que resolver:

- **Cobertura** (`/admin/cobertura`): cada solicitud ligada ya validada lleva su
  etiqueta (`IRStrat` / `Interna`), con el texto completo en el tooltip
  (*Validación IRStrat* / *Validación interna del cliente*).
- **Excel de trazabilidad** (`/admin/cobertura/export`): columna
  **Origen / validación**.
- **Excel de taxonomía oficial**: a la celda de **Notas/Brechas** se agrega
  `(validación interna del cliente)` **solo cuando la validación fue interna**. El
  documento oficial se lee asumiendo la validación de la firma, así que lo que hay
  que declarar es la excepción. `verify:export` comprueba que el libro de Empresa
  Demo **no** lleva esa nota: todas sus validaciones son de staff y su export es la
  referencia que no debe moverse.

### Bitácora

Todo acto del administrador del cliente se registra igual que uno del staff, y
**con su rol visible** (`Nombre · Administrador del cliente` vs
`Nombre · IRStrat · Analista`). Sin el rol, dos actos idénticos se leerían como del
mismo lado. Se añaden las entidades `areas_tenant` al filtro y las acciones
`area_creada` / `area_editada` / `area_desactivada` / `area_reactivada` y
`tenant_carga_staff_habilitada` / `…_deshabilitada`.

### Toggle "carga por IRStrat" (por cliente, solo super admin)

`tenants.staff_puede_cargar`, `NOT NULL default false`: **el comportamiento actual
se conserva como default**. El switch está en la ficha del cliente en
`/admin/clientes`, visible y editable **solo para el rol `admin`** de IRStrat (no
analista, no administrador del cliente) — y el trigger
`trg_tenant_toggle_carga_staff` lo revalida en la base.

- **Apagado (default).** En el detalle staff de una solicitud la zona de carga
  **está presente**, en gris y bloqueada, con la leyenda *"La carga de evidencia
  corresponde al cliente"*. Presente y no escondida: así se ve que existe y de
  quién es la tarea. Un POST de carga del staff se rechaza en la server action **y**
  en el trigger.
- **Encendido.** El staff puede cargar evidencia de ese cliente, **exigiendo
  siempre el área en cuyo nombre carga** (periodo y captura igual que el cliente), y
  con **trazabilidad obligatoria e inborrable**: el historial dice *"Cargado por
  [nombre] (IRStrat) en nombre de [área]"* —también en el portal del cliente, que
  tiene derecho a ver quién subió lo que aparece como suyo—, la bitácora lo registra
  igual, y `evidencias.cargado_por_staff` la **calcula el trigger**, no la
  aplicación. Por eso la marca no es configurable: el toggle habilita la
  *capacidad*, nunca oculta la *autoría*.
- **Apagar de nuevo** no retira ninguna marca ya puesta; solo vuelve a bloquear la
  carga. La confirmación del switch lo dice con esas palabras.
- La **validación posterior** sigue las reglas de origen sin cambios: que IRStrat
  cargue la evidencia de una solicitud interna del cliente no le da derecho a
  validarla.

> **Efecto lateral que valía la pena arreglar.** Para que el historial pueda decir
> *quién* de IRStrat cargó, el cliente tiene que poder leer ese nombre. RLS no lo
> permitía: los perfiles de la firma quedaban fuera del alcance de un usuario con
> tenant, así que el historial —y las observaciones, desde antes de este sprint—
> mostraban "—". Se abre en **solo lectura**, y solo los perfiles que **aparecen
> en lo que ese usuario ya puede ver** (quien subió su evidencia, capturó su valor
> o comentó en su solicitud): así se puede poner el nombre sin que nadie pueda
> enumerar el equipo de la firma. Un rastro que no dice quién no sirve para
> aseguramiento.

> **GCARSO nace con el toggle encendido, y es un hecho del proceso real**, no una
> conveniencia del script: la evidencia de Carso la subió IRStrat a partir del
> checklist y del IAS que el cliente entregó por correo. Con el toggle encendido,
> cada una de esas 32 evidencias queda marcada como cargada por IRStrat en nombre
> de su área — que es exactamente lo que ocurrió.

### Refuerzos que pidió el code-review

Tres huecos que el rol nuevo abría o volvía alcanzables, cerrados en las dos capas:

- **Una invitación es un cambio de contraseña diferido.** La política de
  `invitaciones` solo acotaba `tenant_id`, no `perfil_id`; con el alta de usuarios
  ya en manos del cliente, eso permitía emitirse una liga contra una cuenta ajena
  —incluida una de IRStrat— y quedársela al canjearla. Ahora el destinatario tiene
  que ser alguien a quien quien la emite **sí administra** (RLS + una política
  **restrictiva** que aplica a todos, staff incluido), y la acción de canje —que
  corre con `service_role` y por definición no pasa por RLS— vuelve a comprobar que
  el perfil pertenezca al tenant de la invitación.
- **El toggle también se gatea en el ALTA.** El trigger cubría solo `UPDATE`, así
  que un analista podía dar de alta un cliente que naciera con la carga por IRStrat
  ya habilitada y saltarse la regla de administrador entera.
- **El aviso de observación por correo no puede mentir sobre el origen.** El texto
  decía "El equipo de IRStrat registró una observación" fijo; en una solicitud
  interna, el único canal que sale de la plataforma habría contradicho al badge, a
  la bitácora y a la nota del Excel. Ahora dice quién la registró. Por lo mismo, la
  copia de las ligas de invitación pasó de "pídele una nueva al equipo de IRStrat"
  a "a quien te dio el acceso": desde el autoservicio, IRStrat puede no ser quien
  la emitió.

Y dos que ya estaban ahí y quedaron cerrados de paso: un reporte **congelado** ya
no admite solicitudes nuevas (el candado de Fase 2 cubría el `UPDATE`, no el
`INSERT`, ni para el staff), y un archivo subido cuya fila de evidencia falla ya no
queda huérfano en el bucket (el cliente no tiene `DELETE` en storage, así que la
limpieza la hace el servidor sobre lo que acaba de crear).

### Decisiones registradas como revisables

- **Congelar un reporte sigue siendo un acto de IRStrat.** El administrador del
  cliente **ve** los reportes de su tenant pero no puede congelarlos: el
  congelamiento es la firma del cierre para aseguramiento y hoy lo respalda la
  firma. Está bloqueado en RLS (no tiene escritura en `reportes`) y en el trigger
  de transición. **Revisable**: si el tier de autoservicio llega a incluir el
  cierre, se abre con su propia migración y su propia confirmación reforzada.
- **`coordinador` lo sigue asignando IRStrat.** El administrador del cliente solo
  nombra responsables de área y otros administradores como él. Revisable si el rol
  de coordinador pasa a ser una figura interna del cliente.
- **Sin borrado.** No elimina solicitudes ni áreas (las áreas se desactivan).
- **Los recordatorios masivos siguen siendo de la firma.** Corren con
  `service_role` sobre todos los clientes, así que el botón no se le ofrece. El
  envío de **sus** solicitudes sí, con el filtro de origen aplicado.

### Prueba E2E con sesiones reales

```bash
supabase start && supabase db reset && pnpm dev   # en una terminal
pnpm e2e:admin-cliente                            # en otra
pnpm e2e:admin-cliente http://localhost:3001      # otro puerto
```

`scripts/e2e-admin-cliente.mjs` levanta Chromium y **inicia sesión por el
formulario real** (no cookies forjadas) con cuatro identidades: el administrador
del cliente, un usuario de área, el analista y el admin de IRStrat. Cada
afirmación se comprueba donde de verdad se decide:

- **UI** — que la app no *ofrezca* lo que no corresponde (botones ausentes, zona
  de carga en gris, secciones fuera del menú, URL directa que rebota) y que el
  flujo completo funcione cuando sí corresponde.
- **Datos** — con la sesión **real** de ese mismo usuario contra Postgres: que la
  escritura se rechace aunque nadie pase por la UI. Esa es la capa que un POST
  forjado tampoco salta. *Esconder un botón no es una barrera y el script no lo
  cuenta como tal.*

Cubre: entrada al panel con menú reducido y marca del cliente; alta de una
solicitud interna que nace con origen `cliente` y su badge; carga de evidencia por
un usuario de área; validación por el administrador del cliente; su Excel con la
nota de validación interna; el rechazo de validar una solicitud de IRStrat (UI y
datos); que no pueda crear staff ni salir de su tenant (incluidas URL directas y
aislamiento en ambos sentidos); gestión y renombrado de áreas con propagación; que
el staff conserve todo lo suyo; y el ciclo completo del toggle de carga
(apagado → encendido → carga marcada → apagado, sin perder la marca).

Usa un **tenant propio** (`e2e-autoservicio`) y lo elimina al terminar, incluso si
algo falla: el export de Empresa Demo es la referencia de `verify:export` y no debe
moverse.

### Guía de prueba manual (QA)

Con `supabase db reset` y `pnpm dev` corriendo:

1. **Entrada.** `/login` con `admin.cliente@empresademo.example` (`Demo2025!`).
   Debe aterrizar en **`/admin`**, con el nombre de *Empresa Demo SAB* en el menú
   y solo cuatro secciones: Matriz, Cobertura, Bitácora, Usuarios y áreas.
2. **Solicitud interna.** *Nueva solicitud interna* → título, área **RH**, marca
   *Es cuantitativa* con unidad `tCO2e`, responsable `Responsable RH`. Al guardar,
   el detalle debe mostrar el badge **Solicitud interna** (dorado). Envíala.
3. **Respuesta del área.** En ventana privada, `rh@empresademo.example` → esa
   solicitud (con su badge) → sube un archivo con periodo `2025` y una cifra.
4. **Validación interna.** De vuelta como administrador: *Poner en revisión* →
   *Validar*. En `/admin/bitacora` el evento aparece con
   *Administrador del cliente*.
5. **Regla de origen.** Abre cualquier solicitud del seed (badge **Solicitud
   IRStrat**): no hay botones de transición, sino la nota de a quién corresponde.
   Como `analista@irstrat.example`, abre la interna del paso 2: mismo trato al
   revés.
6. **Aislamiento.** Como administrador del cliente, pega en la barra
   `/admin/clientes` → vuelve a la matriz. Pega la URL de una solicitud de GCARSO
   (tómala del panel staff) → *"Solicitud no encontrada"*.
7. **Áreas.** *Usuarios y áreas* → agrega **Legal**; renombra **RH** y comprueba
   que las solicitudes de esa área y el usuario de RH quedan con el nombre nuevo
   (si el reporte estuviera congelado, la app lo impide y lo explica).
8. **Toggle.** Como `admin@irstrat.example` → `/admin/clientes` → enciende
   *Carga de evidencia por IRStrat* en Empresa Demo. Abre una solicitud del seed:
   la zona de carga se activa; carga un archivo eligiendo el área. El historial y
   el portal del cliente deben decir *"Cargado por … (IRStrat) en nombre de …"*.
   Apágalo: la zona vuelve a gris y la marca sigue ahí.
   Con `analista@irstrat.example` el switch **no** aparece.

## Import de un cliente real: GCARSO (proceso IAS 2025)

`scripts/import-gcarso.mjs` recrea dentro de la plataforma el proceso de recabado
que IRStrat corrió con Grupo Carso: sus solicitudes, responsables, fechas,
capturas y contenido **reales**. Las fuentes viven en `import-gcarso/` (carpeta
**no versionada**, `.gitignore`): el mapeo de importación —que es la
especificación—, el checklist del proceso, el informe S1/S2 y el IAS 2025.

```bash
node scripts/import-gcarso.mjs            # contra la BD local
node scripts/import-gcarso.mjs --limpiar  # retira el import
IMPORT_TARGET_OK=1 node scripts/import-gcarso.mjs   # obligatorio si el destino NO es local
```

Es **idempotente**: retira por completo el import anterior antes de rehacerlo, así
que correrlo dos veces no duplica nada. Escribe con una **sesión de staff** (RLS
activo, como lo haría un analista por la UI); solo el alta de cuentas usa
`service_role`.

**Requisito previo:** debe existir una plantilla de checklist **con rubros de
taxonomía** (ver la sección anterior). Sin ella el script se detiene con un
mensaje explícito, porque el reporte nacería sin poder resolver ninguna celda GEI.

### Qué importa, y qué NO

| Fuente | Destino | Regla |
|--------|---------|-------|
| Checklist (5 hojas) | 134 solicitudes | Una por requerimiento real. Las subsidiarias van en la descripción, no como solicitudes aparte. Responsable real **como texto** (`responsable_cliente_texto`): son personas sin cuenta. |
| Tablas del checklist | 42 capturas | Valores reales del ejercicio 2025, una por división o subsidiaria más un **consolidado** al final (la plataforma toma la última captura como valor vigente). |
| Informe `.docx` | 3 registros de clima + 2 objetivos | Solo los ítems numerados de las tablas `[100002]` y `[100003]`. Las secciones `[805600]+` (SASB de industria) **no se importan**. |
| IAS 2025 `.pdf` | Evidencia cualitativa + contexto | Cada capítulo se recorta con `pdf-lib` y se adjunta a las solicitudes de política que la especificación lista, con la cita de páginas. **Nunca** a una solicitud cuyo entregable es la cifra. |

El tenant nace con el **toggle "carga por IRStrat" encendido** y su evidencia queda
marcada como cargada por IRStrat en nombre de cada área: en el proceso real la subió
la firma a partir de lo que Carso entregó por correo. Ver la sección del rol
admin-cliente.

**Nada se inventa.** Lo que el proceso real no entregó (filas con `ND`, `N/A` o
`XXXX`) no se captura: el hueco es información y la plataforma lo muestra como
tal. Los atributos que el informe no cubre quedan vacíos y salen como pendientes
en el Excel.

### Usuarios

Seis usuarios **genéricos** por área (`comercial@gcarso.example`, …), con
contraseñas fuertes generadas en cada corrida y mostradas una sola vez al final.
No se crean cuentas a nombre de personas reales: los nombres del proceso viven
como texto en cada solicitud.

### Extensión VERT del catálogo

El proceso de Carso pide cuatro conceptos que la norma no cubre como datapoint
propio: plantilla y rotación, capacitación, agua y residuos. Se incorporaron al
catálogo con `datapoints_taxonomia.marco = 'VERT'` (los 91 de la norma quedan en
`'NIIF'`) y en `/admin/cobertura` aparecen en una **sección propia, "Extensión
VERT"**, con su propio conteo y fuera del avance de la norma. Nunca se presentan
como parte de NIIF S1/S2.

> **Licenciamiento IFRS Foundation — pendiente de escalar.** La portada del mapeo
> de importación deja constancia: el checklist de Carso usa métricas y códigos
> SASB verbatim (CG-MR, RT-EE, IF-EN, EM-CM) y el informe incluye las secciones
> de industria `[805600]+`. Integrar ese contenido en una plataforma **comercial**
> requiere licencia de la IFRS Foundation (el uso no comercial es libre). El
> import respeta la instrucción de no traer esas secciones y las solicitudes SASB
> quedan ligadas a la hoja bloqueada `NIIF S1 46 a 50`, que se recaba pero no se
> exporta. La recomendación registrada es escalarlo a dirección y contactar a
> `licensing@sasb.org` **antes** de dar acceso a Grupo Carso.

## Documentación

- **[DESIGN.md](./DESIGN.md)** — sistema de diseño: tokens, tipografía, componentes, motion.
- **[README-SCHEMA.md](./README-SCHEMA.md)** — esquema, diagrama de relaciones,
  modelo RLS, triggers, storage, **credenciales demo** y decisiones de diseño.
- Types generados: `lib/database.types.ts`
  (`supabase gen types typescript --local > lib/database.types.ts`).
