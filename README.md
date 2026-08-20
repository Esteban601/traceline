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
  proceso IAS 2025 de Grupo Carso, con extensión GRI del catálogo, y
  `scripts/import-gcarso-historico.mjs` suma el **comparativo 2024** (y 2023
  donde la fuente lo trae) desde los documentos del proceso anterior.
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
| `jefe.rh@empresademo.example` | **Jefe de área** (RH): lo mismo que el responsable **más** dar y retirar el visto bueno del área | **5** solicitudes (RH) |
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

Sistema de solicitud y recordatorios por correo (Resend). Plantillas HTML
alineadas al DESIGN.md: (a) solicitud de información, (b) recordatorio semanal
(digest, con observaciones destacadas), (b-bis) **recordatorio programado** de una
solicitud a N días de su fecha límite (ver
[Recordatorios programados](#recordatorios-programados-por-solicitud)),
(c) aviso de observación y (d) invitación de acceso.

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

### Activar el envío real (Resend) — paso a paso

Hoy **staging manda todo a modo consola**, y para staging eso es lo correcto: los
correos de prueba no deben llegarle a nadie. Estos son los pasos exactos para
encender el envío real cuando la dirección lo decida. El código no cambia: la única
condición es que exista `RESEND_API_KEY`.

1. **Cuenta y dominio.** En [resend.com](https://resend.com) → *Domains* → *Add
   Domain*, con el dominio desde el que se va a escribir (p. ej. `irstrat.com` o un
   subdominio propio como `avisos.irstrat.com`; un subdominio aísla la reputación
   de envío del correo corporativo).
2. **DNS.** Resend entrega los registros a publicar en la zona del dominio: `TXT`
   de verificación, `MX`/`TXT` de **SPF** y `TXT` de **DKIM**. Se agregan en el
   proveedor de DNS y se espera a que Resend marque el dominio *Verified*. Sin
   dominio verificado, Resend solo deja enviar desde `onboarding@resend.dev` — que
   es el default del código y sirve para una prueba, no para escribirle a un
   cliente. Conviene además publicar **DMARC** (`_dmarc` `TXT` con al menos
   `v=DMARC1; p=none; rua=mailto:…`) para ver qué pasa con los envíos.
3. **API key.** *API Keys* → *Create API Key* con permiso de **envío** (no de
   administración). Se copia una sola vez.
4. **Config vars** en la app (Heroku):
   ```bash
   heroku config:set --app <app> \
     RESEND_API_KEY="re_..." \
     EMAIL_FROM="TRACELINE <avisos@irstrat.com>" \
     NEXT_PUBLIC_APP_URL="https://<dominio-publico>"
   ```
   `EMAIL_FROM` es **configurable por entorno** a propósito (`lib/email/enviar.ts`
   lo lee de la variable, con `onboarding@resend.dev` como default) y su dominio
   tiene que ser el verificado en el paso 2, o Resend rechaza el envío.
   `NEXT_PUBLIC_APP_URL` se inlinea en build: **requiere redeploy**, no basta con
   cambiar la variable.
5. **Comprobar antes de escribirle a un cliente.** Con un tenant de prueba (o la
   Empresa Demo), disparar un recordatorio y confirmar en el *dashboard* de Resend
   que el envío salió y no rebotó. En la respuesta del endpoint y en la bitácora el
   campo `modo` pasa de `"consola"` a `"resend"`: es la señal de que el correo salió
   de verdad.
6. **Antes de encenderlo, revisar a quién se le va a escribir.** Las cuentas de
   demostración usan el TLD reservado `.example` y no existen; los usuarios de
   GCARSO en staging también (`@gcarso.example`). Con Resend activo, cada envío a
   esas direcciones es un rebote, y los rebotes dañan la reputación del dominio. El
   orden correcto es: primero los correos reales de las personas, después la clave.

**Cron de recordatorios (Heroku Scheduler)** — *no configurado todavía*. Programar
un job **diario** (los recordatorios programados se evalúan por día; el digest trae
su propia regla anti-spam de 5 días, así que correr a diario no lo multiplica):

```bash
curl -fsS -X POST "$NEXT_PUBLIC_APP_URL/api/recordatorios" \
  -H "x-cron-secret: $CRON_SECRET"
```

Una sola llamada hace las dos pasadas: primero los **programados** por solicitud,
después el **digest** por responsable. El orden importa (ver abajo).

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
- **El portal del cliente no se atribuye la carga.** La frase principal de su
  historial dice *"IRStrat cargó X el … en nombre de \<área\>"*, no *"Entregaste
  X"*, y el encabezado pasa de *Tus entregas* a *Entregas registradas* cuando la
  lista incluye alguna. Un "Entregaste" en el lugar más visible con la corrección en
  letra chica debajo es peor que no decir nada: el toggle habilita la capacidad,
  nunca cambia de quién fue el acto.
- La **validación posterior** sigue las reglas de origen sin cambios: que IRStrat
  cargue la evidencia de una solicitud interna del cliente no le da derecho a
  validarla.

> **Efecto lateral que valía la pena arreglar.** Para que el historial pueda decir
> *quién* de IRStrat cargó, el cliente tiene que poder leer ese nombre. RLS no lo
> permitía: los perfiles de la firma quedaban fuera del alcance de un usuario con
> tenant, así que el historial —y las observaciones, desde antes de este sprint—
> mostraban "—". Se abre en **solo lectura**, y solo los perfiles que **aparecen
> en lo que ese usuario ya puede ver**: quien subió su evidencia, capturó su valor,
> comentó en su solicitud **o dejó un acto en su bitácora**. Esa última rama importa
> porque buena parte de lo que hace IRStrat solo deja rastro ahí (crear una
> solicitud, cambiar su estado, congelar un reporte): sin ella el cliente veía esas
> entradas como **«Sistema»**, que no es un dato que falte sino una atribución
> falsa. Así se puede poner el nombre sin que nadie pueda enumerar el equipo de la
> firma; un rastro que no dice quién no sirve para aseguramiento.

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

A ellos se suma, dada de alta desde el panel y **no por el script**, la cuenta de
administración del cliente: `sostenibilidad@gcarso.example` (rol `admin_cliente`),
la jefatura de sostenibilidad de Carso. Es la cuenta del manual, así que su acceso
se entrega como **contraseña temporal legible con cambio forzado**
(`debe_cambiar_password`), no como liga de invitación: una liga en un documento
impreso vence a las 72 h y deja el manual inservible.

### Extensión GRI del catálogo

El proceso de Carso pide cuatro conceptos que NIIF S1/S2 no cubre como datapoint
propio: agua, residuos, capacitación y plantilla/rotación. **No son invención de la
firma: GRI ya los norma**, así que están en el catálogo con su código oficial
(migración `20260825120000`, que hizo el renombre desde el marco `VERT` con su
mapeo):

| Concepto | Código | Antes |
|---|---|---|
| Agua: consumo, tratamiento y descarga | **GRI 303-5** | `VERT-AMB-01` |
| Residuos por tipo y manejo | **GRI 306-3** | `VERT-AMB-02` |
| Capacitación: horas, temáticas y cobertura | **GRI 404-1** | `VERT-SOC-02` |
| Plantilla total y rotación | **GRI 2-7 / 401-1** | `VERT-SOC-01` |

`datapoints_taxonomia.marco` vale `'NIIF'` (los 91 de la norma) o `'GRI'` (estos
cuatro), y en `/admin/cobertura` aparecen en una **sección propia, "Extensión
GRI"**, con su propio conteo y fuera del avance de la norma. Cada tarjeta muestra
su código GRI igual que las NIIF muestran el suyo, para que quien lea el
entregable pueda ir a la norma y comprobarlo. Nunca se presentan como parte de
NIIF S1/S2, y el Excel oficial de taxonomía sigue siendo solo de la norma.

**El de plantilla/rotación lleva dos códigos** (`GRI 2-7 / 401-1`) porque el
datapoint cubre las dos cosas. Partirlo en dos habría cambiado el universo y el
mapeo de las solicitudes ya ligadas —que es dato del cliente—, así que se deja
compuesto y se explica.

> **Licenciamiento IFRS Foundation — pendiente de escalar.** La portada del mapeo
> de importación deja constancia: el checklist de Carso usa métricas y códigos
> SASB verbatim (CG-MR, RT-EE, IF-EN, EM-CM) y el informe incluye las secciones
> de industria `[805600]+`. Integrar ese contenido en una plataforma **comercial**
> requiere licencia de la IFRS Foundation (el uso no comercial es libre). El
> import respeta la instrucción de no traer esas secciones y las solicitudes SASB
> quedan ligadas a la hoja bloqueada `NIIF S1 46 a 50`, que se recaba pero no se
> exporta. La recomendación registrada es escalarlo a dirección y contactar a
> `licensing@sasb.org` **antes** de dar acceso a Grupo Carso.

### Histórico: el comparativo 2024

`scripts/import-gcarso-historico.mjs` (`pnpm import:gcarso-historico`) suma a las
solicitudes que ya existen las cifras de **años anteriores** y la evidencia
cualitativa del proceso previo. No crea solicitudes: requiere que el import de
2025 haya corrido.

```bash
node scripts/import-gcarso.mjs             # primero el proceso 2025
node scripts/import-gcarso-historico.mjs   # después el comparativo
```

La especificación autoritativa es la hoja **'Historico 2024'** del mapeo, que
decide archivo por archivo si se capturan cifras o solo se adjunta evidencia, a
qué destino y con qué regla. Las cifras del script son transcripción a mano de los
documentos, y **cada captura lleva su cita** (sector/concepto + archivo y página)
en `justificacion`, visible en la bitácora de la solicitud.

**Tres reglas mandan sobre todo:**

1. **El año es el año.** Cada cifra se captura con su periodo real. Nada se
   "estira" a 2024 para llenar la columna comparativa. El caso que lo prueba:
   `Número de Empleados 2024.docx` **no contiene 2024** —sus tablas son 2022 y
   2023, más una serie 2019-2023—, así que se capturó como 2022 y 2023 y el hueco
   de 2024 quedó declarado en la nota, no rellenado.
2. **Los estados no cambian.** La hoja 8 lo dice: la captura histórica se suma a
   la solicitud existente. Como el trigger de Fase 2 reabre a *en revisión* toda
   solicitud validada que reciba una captura, el script **restaura el estado
   original al final**. Nada se promueve a `validado` por venir del histórico. Lo
   que sí se deja pasar es el avance automático `solicitado → recibido` de las que
   recibieron evidencia: es la regla de la plataforma para "llegó evidencia".
3. **Nada se inventa.** Solo cifras que los archivos contienen textualmente. No se
   convierten unidades (el consumo eléctrico entra en MWh porque así lo declara la
   fuente, no en GJ), no se suman perímetros distintos y no se fabrican
   consolidados que el documento no declare. Donde la fuente **se contradice
   consigo misma**, se captura la cifra de su tabla y la discrepancia queda escrita
   en la cita: p. ej. el consumo eléctrico de Cables (105,102 en la p. 45 vs.
   106,102 que suma la tabla de la p. 48) y el agua de Autopartes en 2023 (117,505
   en la narrativa vs. 115,121 en la tabla por centro de trabajo).

#### Qué entra, y qué no

| Archivo | Qué se hizo |
|---------|-------------|
| `Reporte Anual Amb 2024 (17 jun 2025).pdf` (8.2 MB) | **58 capturas** de GEI por alcance, agua, energía y residuos, por sector y con año real (2023 y 2024), más **8 consolidados**. Se **recorta por sección** con `pdf-lib` y cada tabla recibe solo su parte: 2.6 MB en cuatro recortes en vez de 32.8 MB de copias del PDF completo. |
| `Cursos capacitación GCarso 2024.xlsx` | 779,453 participantes (2024) y 8,708 brigadistas; los demás programas, como nota. |
| `Resumen Responsabilidad Social 2024 (GS) (VFinal).xlsx` | 11,809 cursos de Grupo Sanborns (2024). Corrobora las cifras del archivo anterior. |
| `Número de Empleados 2024.docx` | Plantilla total 2023 (94,458) y 2022 (94,827) — **el archivo no trae 2024**. |
| `Sustentabilidad 2024 GCARSO 200525.docx` | Evidencia narrativa en distintivo ESR, comunidades y derechos humanos. |
| `Salud Integral Sostenible … .docx` | Evidencia + nota con MIDO 2024 (17,731 valorados) y las tendencias 2023→2024. |
| `Estrategia ASG de Condumex Jun-25.docx` | Evidencia en la solicitud de ética/anticorrupción de Industrial (su Pilar 3). |
| `ASG (Autopartes).pdf` (10.0 MB) | Evidencia en la misma solicitud de Industrial. |

**Total: 71 capturas nuevas** (47 de 2024, 23 de 2023, 1 de 2022), **14 evidencias**
(14.7 MB) y **11 notas**.

**Los consolidados, y por qué existen.** La plataforma muestra como *cifra vigente*
la última captura confirmada, así que sin un total al cierre el dato visible de una
tabla sería el de un sector cualquiera — el mismo problema que el import de 2025 ya
resolvió poniendo su consolidado al final. Por eso el script inserta **por periodo
ascendente y, dentro de cada uno, los sectores primero y su total después**: el
orden no es cosmético.

De 2024, GEI usa el total que el **propio reporte declara** (104,289 tCO₂e). Los
demás no los declara nadie: el script los **suma en código a partir de las mismas
entradas** —así una corrección de cifra corrige el total, no pueden separarse— y la
captura queda etiquetada con sus componentes y con la aclaración de que la suma es
del import, no del reporte. Los residuos se suman **por clase y nunca entre clases**:
RSU, RME y RP son conceptos distintos y un total que los junte no significa nada; de
2023 no hay total de ninguna clase porque el reporte solo trae comparativo de algunos
sectores.

El único par realmente comparable año contra año es el de **GEI**: el total de 2023
(105,720 tCO₂e) se suma de los **mismos tres sectores** que componen el 104,289 de
2024 —Autopartes, Cables y CIDEC—, así que ahí sí hay comparativo de perímetro contra
perímetro. Los totales de agua y energía de 2023 y 2024 **no** lo son, y lo dice su
etiqueta: el propio reporte señala que en 2024 amplió su alcance con 12 centros
adicionales.

Lo que la hoja 8 marca como **NO importar** se respeta: los informes completos de
27 MB y 83 MB, el mapeo GRI (Fase 4), el cronograma interno y —bloqueado por
licenciamiento— el mapeo SASB y la norma oficial de la IFRS Foundation.

**Dónde se desvió del Destino de la spec, y por qué.** La hoja 8 manda el resumen
de Grupo Sanborns a "solicitudes sociales de Comercial" y el deck de Autopartes a
"cualitativas de Industrial", pero su propia regla es *"solo lo que mapee claro"*.
Comercial no tiene ninguna solicitud de plantilla o capacitación (sus sociales son
rotación y salarios en tienda, que el archivo no cubre), así que sus cifras fueron
a las corporativas de capacitación, que es lo que el archivo contiene. Y el
`Estrategia ASG de Condumex` no se adjuntó a la solicitud de *materiales críticos*
de Industrial porque no trata el tema. Adjuntar un documento a una solicitud que no
sostiene es peor que dejarla sin evidencia.

#### Qué pasa si el import falla a mitad

La restauración de estados corre en un **`finally`**, no al final del camino
feliz. Si una subida devuelve 4xx o la sesión caduca después de que las primeras
capturas ya reabrieron las solicitudes validadas, esas solicitudes volverían a su
estado y el script diría por qué abortó. Una restauración que solo ocurre cuando
todo sale bien no restaura nada. Probado: quitando un archivo fuente a mitad de la
corrida, el import aborta con su error y las 6 solicitudes validadas de GCARSO
siguen validadas.

Y como es idempotente, el remedio de un fallo parcial es **volver a correrlo**:
detecta lo ya escrito, completa lo que falta y reintenta la restauración.

#### Peso de los archivos (punto abierto de la spec)

`ASG (Autopartes).pdf` mide **10.0 MB** y **entró sin problema**: el bucket
`evidencias` no declara límite propio, así que hereda el global del proyecto
(50 MiB en `supabase/config.toml`). El script mide cada archivo al subirlo, reporta
los mayores de 8 MB y **se niega a forzar** cualquiera que exceda el límite,
sugiriendo el recorte en su lugar. Si el ambiente de despliegue tuviera un tope más
bajo, el recorte natural es por tema —Becas Telmex, ASUME, Bienestar Social,
gobernanza— con el mismo `pdf-lib` que ya recorta el Reporte Ambiental.

#### El comparativo 2024 de la plantilla oficial sigue vacío, y por qué

Esta es la conclusión importante y no se maquilló. En el Excel de taxonomía, la
única celda con columna comparativa que tiene solicitud detrás es **Alcance 1**, y
la alimenta la solicitud de **Materiales** (Elementia + Fortaleza, 2,643,446.803 t
en 2025). **Ninguno de los ocho documentos históricos cubre a Materiales**: el
Reporte Anual Ambiental 2024 declara en su p. 5 que cubre dos subsidiarias —Carso
Infraestructura y Construcción, y Grupo Condumex (con Nacobre y Logtec)— más CIDEC
y las oficinas corporativas. Su total declarado de 104,289 tCO₂e son Autopartes +
Cables + CIDEC.

Poner esa cifra en la columna 2024 de esa fila habría empalmado dos perímetros
distintos en un mismo comparativo: exactamente el tipo de error que un
aseguramiento limitado busca. Así que la celda **sigue diciendo
`Sin evidencia (2024)`** y las 58 capturas ambientales viven donde les corresponde,
en las tablas de desempeño corporativas, con su cita y su perímetro declarado en la
nota.

**Había dos caminos, y dirección eligió el segundo.**

1. **Pedir el dato que falta:** las emisiones de Alcance 1 de 2024 de Elementia y
   Fortaleza Materiales, el mismo perímetro que Carso entregó para 2025. Sigue
   siendo el camino que llena la columna, y el mecanismo está listo: en cuanto haya
   una captura validada del año anterior en la solicitud del rubro, la columna se
   llena y la nota de brecha desaparece sola (probado en `verify:export`).
2. **Declarar el perímetro en el entregable** ← *aplicado*. En vez de mover el rubro
   a la tabla corporativa de GEI —que habría **cambiado la cifra de 2025 ya
   validada**, de 2,643,446.803 a 2,858,744.568— la celda de Notas/Brechas ahora
   **dice qué comprende** la cifra. Ver *Declarar el alcance de una cifra*, abajo.

> Para el camino 1, un hallazgo que conviene tener a mano: el checklist de 2025 **sí
> trae el GEI consolidado de todo Grupo Carso** en su hoja `Ambiental` (fila *Total
> GCarso*: Alcance 1 2,858,744.568 t y Alcance 2 599,841.699 t), pero el import de
> 2025 **no lo capturó**: la solicitud «Tabla Desempeño Ambiental. Gases Efecto
> Invernadero» quedó sin cifras de 2025, y por eso su valor vigente hoy es el total
> 2024 del histórico.

### Declarar el alcance de una cifra

`solicitudes.nota_alcance` es la salvedad de **perímetro** con la que hay que leer
una cifra en el entregable: qué comprende y qué no. El export la **agrega** a la
celda de *Notas/Brechas* de la fila que esa solicitud alimenta, junto a lo que ya
haya — no la reemplaza, porque la brecha y el perímetro son dos cosas distintas y
las dos importan:

```
Sin evidencia (2024); La cifra corresponde al perímetro de la división Materiales
(Elementia Materiales y Fortaleza Materiales); no comprende las demás divisiones
de Grupo Carso.
```

El orden dentro de la celda es el de lectura de un revisor: primero **lo que falta**
(las brechas por año), luego **qué comprende lo que sí está** (el perímetro) y al
final **quién lo validó** (la salvedad de validación interna).

- Es una **columna, no una rama en el export**: el perímetro es una propiedad del
  dato de un cliente concreto, así que vive con el dato. El motor del export sigue
  siendo la definición reutilizable de la plantilla, sin una sola condición por
  emisora.
- Se puede declarar **incluso sobre una solicitud validada**, por la misma razón que
  el rubro de taxonomía: no cambia lo que se pidió, ni el valor, ni el estado —
  explica la cifra. De hecho el caso que la motiva es justo una validada. Congelado
  sí queda fuera.
- Se edita desde el **detalle de la solicitud** (campo *Nota de alcance* del
  formulario, y el widget junto a *Rubro de taxonomía* cuando la solicitud ya está
  validada), y se ve en el detalle además del Excel: si solo viviera en el
  entregable, quien revisa en la plataforma leería la cifra con el perímetro
  equivocado, que es justo lo que la nota vino a evitar.
- El histórico de GCARSO la declara al correr, de forma idempotente, y **no
  sobrescribe** una nota que alguien haya editado desde el panel: lo reporta.

`verify:export` cubre las dos caras del asunto: en el cliente de verificación
comprueba que **la columna comparativa SÍ se llena** cuando existe captura validada
del año anterior (y que la nota de brecha desaparece sola al cerrarse el hueco), y
en GCARSO comprueba que sigue vacía **porque el histórico no cubre a Materiales** —
no porque el import no haya corrido: verifica que el reporte tiene sus 42 capturas
de 2024 y sus 20 de 2023, y que ninguna se colgó de la solicitud del rubro.

## La etiqueta de demostración es del cliente, no del ambiente

Hasta este sprint la franja **«Entorno de demostración — datos ilustrativos»** se
prendía con `NEXT_PUBLIC_STAGING`, una propiedad del **despliegue**. Desde que
Grupo Carso opera en ese mismo despliegue, la franja **mentía** en la cabeza de
cada pantalla: sus datos son reales y su entregable es oficial.

La etiqueta ahora es del tenant: **`tenants.es_demo`**.

| | Empresa Demo | Grupo Carso (y cualquier cliente nuevo) |
|---|---|---|
| `es_demo` | `true` (seed) | `false` (**default** de la columna) |
| Franja en el portal | sí | no |
| Franja en su panel (admin-cliente) | sí | no |
| Pie `[DEMO]` en el Excel de taxonomía | sí | no |

- **El default es `false` a propósito.** Los dos errores no cuestan lo mismo: una
  franja de más en una demo es un detalle; una franja de menos sobre datos demo
  presentados como oficiales es un problema de credibilidad. Se elige el que
  falla del lado seguro *para el cliente real*, que es quien firma el reporte.
- **El pie del Excel sigue la columna, no el nombre.** Antes se infería del
  prefijo `[DEMO]` del nombre del tenant: renombrar una emisora cambiaba su
  entregable. Ahora `es_demo` decide las dos marcas —la franja y el pie— y no hay
  dos fuentes de verdad que se puedan contradecir.
- **El `noindex/nofollow` se conserva GLOBAL** (`NEXT_PUBLIC_STAGING`, en
  `app/layout.tsx`). No depende del tenant ni de que haya sesión: es una
  propiedad de la URL, que no tiene dominio propio y no debe indexarse. `/login`
  no lleva franja —no hay tenant del que decirla— y sí lleva el `noindex`.
- **Quién la mueve:** solo el rol `admin` de IRStrat, impuesto por el trigger
  `trg_tenant_es_demo` en INSERT **y** UPDATE (dar de alta una emisora ya marcada
  es otra forma de marcarla). El analista no puede; el administrador del cliente,
  tampoco.
- **No hay switch en la UI, y es deliberado** (revisable): la etiqueta se fija en
  el seed o en una migración. Si mañana hace falta una demo nueva para un
  prospecto, hoy se marca con SQL como administrador —
  `update public.tenants set es_demo = true where slug = '<slug>';` — y el switch
  en la ficha del cliente queda como pendiente, junto al de «carga por IRStrat».
- **En el panel del staff no hay franja.** El staff de IRStrat no tiene tenant:
  sirve a todos y cambia de emisora con `?tenant=` *dentro* de cada pantalla, un
  dato que un layout no recibe. Ahí la demo se distingue por el prefijo `[DEMO]`
  de su nombre, visible en el selector, en la matriz y en el nombre del archivo
  exportado.

```bash
pnpm e2e:banner-demo        # sesiones reales: demo con franja, cliente real sin ella
```

Fija las dos direcciones del error (falta en la demo / sobra en un real), que el
libro de cada quien lleve o no `[DEMO]`, que el `noindex` siga siendo global, y que
al encender el flag esa *misma* sesión empiece a mostrar la franja — la prueba de
que sigue a la columna y no a un nombre.

## Contraseña temporal y cambio forzado

Una contraseña que se entrega **fuera de la plataforma** —dictada por teléfono,
impresa en un manual— la conoce alguien más que su dueño desde el minuto uno.
`perfiles_usuario.debe_cambiar_password` hace que sirva para una sola cosa:
entrar a cambiarla.

- **Formato legible `XXXX-xxxx-0000`** (`generarPasswordLegible()` en
  `lib/gestion.ts`): un bloque de mayúsculas, uno de minúsculas y uno de dígitos,
  con el alfabeto sin caracteres confundibles (`I`/`l`/`1`, `O`/`0`). Es para
  teclearla desde un papel; el costo de una ambigüedad lo paga quien la escribe.
- **Mientras el flag esté encendido no se renderiza ninguna otra vista.** El
  ruteo vive en dos lugares a propósito: la acción de ingreso manda directo a
  `/restablecer` (si mandara a `/admin`, el rebote pasaría *dentro* de la misma
  navegación y la barra de direcciones se quedaría en la anterior), y el
  middleware lo impone en cada request para cualquier ruta no pública. Los
  layouts del portal y del panel lo repiten: defensa en profundidad.
- **La pantalla dice la verdad de por qué está ahí:** «Cambia tu contraseña para
  continuar», no «esta liga venció» — que es el otro camino a `/restablecer`.
- **El flag se apaga en los dos caminos que establecen una contraseña**: la
  acción de restablecimiento (después de que `auth.updateUser` cambió la
  contraseña de verdad) y el canje de invitación. Si el apagado falla, se reporta
  y el flag **sigue encendido**: volver a `/restablecer` es molesto, pero lo
  contrario dejaría la puerta abierta en silencio.
- **Se apaga con `service_role`, no con una función `security definer`.** Una RPC
  para apagarlo sería una llamada que cualquier sesión podría hacer desde el
  navegador para saltarse el cambio sin cambiar nada. El grant es **de columna**:
  `grant update (debe_cambiar_password) on public.perfiles_usuario to
  service_role;` — puede apagar el flag y nada más de esa tabla (ni rol, ni
  tenant, ni área).

```bash
pnpm e2e:cambio-password    # temporal → rebote forzoso → definitiva → la temporal deja de servir
```

## Respaldos y restauración (Supabase)

Estado **medido** del proyecto de staging `ewgnvjtjhvdltvkopptn` (19 ago 2026, vía
Management API):

| | |
|---|---|
| Plan de la organización | **Pro** |
| Respaldos diarios | **sí**, físicos, `COMPLETED` — 8 disponibles (retención de 7 días del plan) |
| Último respaldo | 19 ago 2026, 08:48 UTC (uno diario, ~09:00 UTC) |
| **PITR** | **APAGADO** (`pitr_enabled: false`) |
| Costo de encenderlo | add-on: 7 días $100/mes · 14 días $200 · 28 días $400 |
| Región | `us-east-2` |

```bash
# Estado, sin entrar al dashboard (token de la CLI en el keychain):
TOK=$(security find-generic-password -s "Supabase CLI" -w)
curl -s -H "Authorization: Bearer $TOK" \
  https://api.supabase.com/v1/projects/ewgnvjtjhvdltvkopptn/database/backups
```

### Lo que el respaldo NO cubre

**Los archivos de evidencia no están en el respaldo de la base.** Es explícito en
la documentación de Supabase: *«Database backups do not include objects you store
via the Storage API, as the database only includes metadata about these objects»*.
En esta plataforma eso es la mitad del producto: restaurar la base traería de
vuelta las filas de `evidencias` apuntando a objetos que podrían no existir.

Súmese el candado de trazabilidad: `evidencias`, `capturas_valor` y `bitacora` son
**append-only** (sin UPDATE ni DELETE ni para `service_role`), así que un borrado
accidental desde la aplicación no es posible — pero tampoco lo es *reparar* nada
desde la aplicación. Solo el borrado en cascada de un reporte o un tenant elimina
esas filas, y ese es justo el accidente contra el que el respaldo tiene que servir.

### Procedimiento de restauración

1. **Antes de tocar nada**, sacar una copia lógica del estado actual (por malo que
   sea): `supabase db dump --linked -f pre-restore.sql` y
   `supabase db dump --linked --data-only -f pre-restore-datos.sql`. Un restore es
   destructivo; sin esto no hay vuelta atrás de la vuelta atrás.
2. **Base de datos** — Dashboard → *Database → Backups* → elegir el día y
   restaurar. Los respaldos físicos **no se descargan**: el restore es en sitio y
   **el proyecto queda inaccesible mientras corre** (minutos, según tamaño). Con
   PITR encendido se elige además la hora exacta.
3. **Archivos de evidencia** — no vienen en el paso 2. Se reponen desde la copia
   del bucket:
   ```bash
   # Respaldo (correr periódicamente; medido: 46 objetos, 64 MB solo GCARSO):
   supabase storage cp -r ss:///evidencias ./respaldo-evidencias --linked --experimental -j 4
   # Reposición tras un restore:
   supabase storage cp -r ./respaldo-evidencias ss:///evidencias --linked --experimental -j 4
   ```
   La ruta es `{tenant_id}/{solicitud_id}/{archivo}` y es la que guarda
   `evidencias.archivo_path`: si se repone con la misma ruta, las descargas del
   portal vuelven a resolver sin tocar la base.
4. **Cuadrar base y archivos.** Después de un restore parcial, los dos huecos
   posibles son filas sin objeto y objetos sin fila. Se detectan cruzando
   `select archivo_path from evidencias` contra `supabase storage ls -r`, y se
   resuelven reponiendo el archivo (nunca borrando la fila: es append-only).
5. **Verificar con lo que ya existe:** `pnpm verify:export` (el Excel de los tres
   tenants), `pnpm e2e:admin-cliente`, `pnpm e2e:banner-demo` y un login real de
   cliente. Si el export de GCARSO sale íntegro, la cadena base→archivos→entregable
   está sana.

### Pendiente para operar en serio

Grupo Carso opera hoy sobre staging. Con PITR apagado, la ventana de pérdida es de
**hasta 24 horas** (el respaldo es diario) y el bucket **no tiene respaldo
automático de ninguna clase**. Antes de que esto sea el ambiente de producción de
un cliente que firma su informe anual, hay dos decisiones de dirección pendientes:
encender **PITR 7 días** ($100/mes) y dejar el `storage cp` corriendo periódicamente
fuera de Supabase. Ninguna de las dos es código: son costo y operación.

## Recordatorios programados por solicitud

El digest de Fase 1 dice "tienes N pendientes". Esto dice **"faltan 3 días para
esta"**. Son dos cosas distintas y las dos hacen falta: el digest ordena la carga
de trabajo; el recordatorio programado defiende un plazo concreto.

### El modelo

`solicitudes_recordatorios` (migración `20260823120000`): una fila por intervalo,
con `dias_antes > 0` (máx. 365), `activo` y unicidad por `(solicitud_id,
dias_antes)`.

- **Es una tabla y no un campo** porque los intervalos son varios, se prenden y
  apagan por separado y admiten personalizados. Un array en `solicitudes` no
  podría expresar *"configurado y apagado"*, que es justo lo que distingue «nunca
  lo quisieron» de «lo quitaron a propósito» — y lo que permite que el formulario
  vuelva a mostrar un personalizado desmarcado en vez de perderlo.
- **Presets 7 / 3 / 1**, con **7 y 1 encendidos** por default: una semana antes da
  tiempo a juntar la evidencia y el día previo es el empujón. El de 3 se ofrece
  apagado para no convertir cada solicitud en tres correos.
- **Herencia.** Los tres caminos que crean solicitudes aplican el mismo criterio:
  el formulario (casillas ya marcadas), la server action cuando no recibe la
  sección, y el **clonado desde plantilla**. Las clonadas nacen con los presets
  aunque todavía no tengan fecha límite: la plantilla no guarda plazos —son del
  calendario de cada cliente— y el día que alguien pone la fecha, los avisos ya
  están configurados. Es el punto de heredarlos.
- **Sin fecha límite la sección no se esconde: explica.** Un recordatorio se
  calcula desde el plazo («7 días antes de *qué*»), así que sin fecha no hay
  cuándo. Se puede configurar igual.
- **Quién gestiona:** staff de IRStrat y el `admin_cliente` del tenant — incluidos
  los recordatorios de solicitudes de origen `irstrat`. Es una **excepción
  deliberada a la regla de origen**, y la razón es de quién es el correo: a quien
  se le avisa es a *su* gente. La regla de origen protege quién revisa y valida el
  **contenido**; el calendario de avisos internos del cliente no es contenido. El
  usuario de área **ve** su calendario (para saber cuándo le van a escribir) y no
  lo modifica. Un reporte **congelado** queda fuera por completo.

### El cron

`POST /api/recordatorios` (mismo endpoint, mismo `CRON_SECRET`) hace **dos
pasadas, en este orden**:

1. **Programados** — recordatorios activos cuya fecha de disparo
   (`fecha_limite - dias_antes`) es hoy.
2. **Digest** — el resumen por responsable de Fase 1.

El orden no es cosmético: la regla anti-spam del digest lee la bitácora, así que
quien acaba de recibir un aviso por un vencimiento concreto **no** recibe además el
resumen genérico. Al revés, recibiría los dos.

- **Destinatarios:** los usuarios **activos del área** responsable, más el
  responsable asignado si no estuviera en ella (es quien tiene la solicitud a su
  nombre; saltárselo por una diferencia de catálogo sería el peor error posible).
  Si no hay a quién escribirle, **se reporta** en el resumen del cron — un
  recordatorio configurado sin destinatarios es un hueco de operación, no un
  silencio aceptable.
- **No se recuerda lo cumplido:** `validado` y `congelado` quedan fuera. Recordar
  lo cumplido es ruido, y el ruido enseña a ignorar los recordatorios que sí
  importan. `recibido` y `en_revision` **sí** se recuerdan: la entrega puede estar
  incompleta y el plazo sigue siendo el plazo.
- **Anti-spam, con una salvedad honesta.** La regla de 5 días del digest **no**
  puede aplicarse a los programados: la escalera normal es 7-3-1 y entre el de 3 y
  el de 1 hay dos días, así que bloquearía justo el aviso más útil. Lo que se
  garantiza en su lugar es que **un recordatorio no se manda dos veces el mismo
  día** (idempotencia si el cron corre de más) y que un envío programado **sí**
  bloquea el digest de esa persona por los 5 días de la regla original.
- **"Hoy" es el de México**, no el del servidor (`hoyOperacion()` en
  `lib/fechas.ts`). En Heroku el proceso corre en UTC y un cron de madrugada
  evaluaría el día siguiente, mandando los avisos con un día de adelanto: los
  plazos los pone una persona en su propio calendario.
- **`?fecha=YYYY-MM-DD`** evalúa otro día. Existe para las pruebas de punta a punta
  —simular el cron sin mover el reloj de la máquina— y solo la alcanza quien ya
  tiene el secreto del cron. La respuesta devuelve `fechaEvaluada` para que nunca
  haya duda de qué día se evaluó.
- El **botón manual** del panel sigue disparando solo el digest: el calendario de
  los programados lo lleva el cron.

### El rastro

Cada envío deja una entrada en `bitacora` (`entidad = 'correo'`, acción
`recordatorio_programado_enviado`), **una por destinatario** —la regla anti-spam se
aplica por persona, así que necesita saber a quién se le escribió— con el
recordatorio, los días, el plazo, el área, el estado en que estaba la solicitud y
el modo (`consola` / `resend`). El detalle de la solicitud lo muestra en su sección
**Recordatorios**: lo configurado (con la fecha en que caerá cada uno) y lo ya
enviado, con los correos a los que salió.

```bash
pnpm e2e:recordatorios      # crea la solicitud por UI, corre el cron real y valida
```

Cubre el ciclo completo: fecha límite a 3 días → recordatorio de 3 días programado
→ cron con fecha forzada → correo (modo consola) a las **dos** personas del área y
a nadie más → segunda corrida omitida → validar la solicitud → el cron ya no la
recuerda. Y las guardas: sin `x-cron-secret` es 401, el usuario de área no cambia
su propio calendario, otro tenant no lo ve, y la base rechaza «0 días antes» y los
intervalos repetidos.

## Jefe de área y visto bueno del área (doble verificación)

Así se recaba la información de verdad en una emisora: la gente del área carga, su
**jefe** revisa que lo cargado sea lo que el área quiere entregar, y **encima** va
la validación final. La plataforma modelaba el primero y el tercero; el segundo
ocurría por WhatsApp y no dejaba rastro. Ahora es parte del expediente.

### El rol `jefe_area`

Los permisos del responsable de área —ve y carga **lo de su área**— más uno propio:
dar y retirar el visto bueno de las solicitudes de su área.

- **Vive en el PORTAL**, no en el panel: su trabajo es revisar lo que su gente
  entrega, no administrar la emisora. `/admin` lo rebota.
- **No valida.** La validación final sigue la regla de origen (IRStrat para las
  suyas, el administrador del cliente para las internas) y el trigger la niega al
  jefe igual que a cualquier otro.
- **No gestiona usuarios ni áreas.** Lo dan de alta el staff o el administrador del
  cliente, que ahora puede asignar tres roles: responsable de área, **jefe de área**
  y otro administrador.
- **Acotado a su área en la base, no en la UI.** `fn_puede_ver_solicitud` y la
  política `solicitudes_select` tratan a `jefe_area` igual que a `cliente`. Sin ese
  cambio el rol nuevo habría caído en la rama "otros roles del tenant" y habría
  visto **todas** las áreas — exactamente lo contrario de lo que es.

### El visto bueno

Columnas `solicitudes.vb_area_por` y `vb_area_fecha` (migración `20260824130000`).

**Por qué columnas y no una tabla.** El visto bueno es un hecho de *estado actual*
—¿está firmada hoy, y por quién?—, de un solo valor y consultado en cada listado.
Su *historial* ya tiene dónde vivir: la `bitacora`, append-only, donde quedan las
tres clases de acto (dar, retirar y la revocación automática). Una tabla aparte
duplicaría ese registro y convertiría la pregunta más frecuente en un
`order by … limit 1` por solicitud. Es el mismo criterio por el que
`solicitudes.estado` es una columna y su historia está en la bitácora.

Las reglas duras, en RLS **y** en trigger:

| Regla | Dónde se impone |
|---|---|
| Solo el jefe **del área** de esa solicitud lo da o lo retira | política `solicitudes_jefe_area_vb` + `fn_es_jefe_de_area` |
| **No se firma el vacío**: se exige al menos una evidencia | trigger `trg_solicitud_vb_area` |
| El jefe **solo** puede cambiar esas dos columnas de la fila | mismo trigger, comparando el resto de la fila en bloque (`to_jsonb`) — una columna futura queda protegida sin tocar nada |
| Quién firma y cuándo **los calcula la base** | mismo trigger (`auth.uid()`, `now()`): firmar "en nombre de" otro no funciona |
| **Evidencia nueva lo revoca**, con entrada de bitácora | trigger `trg_evidencia_revoca_vb` sobre `evidencias` |
| Una vez **validada**, la marca queda fija | mismo trigger (congelado ya lo impide el candado de Fase 2) |

**No es un estado.** La máquina de estados no cambió: el visto bueno es una marca
paralela. La validación final **no lo requiere** —se puede validar sin él— y el
export oficial sigue mirando solo `validado`, porque el visto bueno no es una
validación. Lo que sí cambia es que ahora **se ven las dos**.

**La revocación automática es del sistema, no de una persona.** Vive en un trigger
y no en la server action a propósito: si dependiera de la acción del portal, una
carga hecha por otra vía (el panel, el import, un script) dejaría una firma
respaldando un archivo que ya no es el vigente, y sin rastro de la contradicción.

### Las dos marcas, en todas las vistas

```
✓ VISTO BUENO DEL ÁREA          – VALIDACIÓN
  Ana Ruiz · Jefe de área          Recibido
  12 mar 2026, 10:04               Pendiente de validación
```

- En el **detalle** (portal y panel) con la misma pieza
  (`components/marcas-verificacion.tsx`): la doble verificación solo sirve si todos
  ven lo mismo.
- En la **matriz**, como indicador compacto de dos puntos (`VB · Val.`): en 135
  renglones no cabe la frase, pero sí la pregunta de quién ya pasó por las dos manos.
- **Una marca ausente se dice, no se esconde.** «Sin visto bueno del área» en gris
  es información; ocultarla dejaría la pantalla insinuando que la única verificación
  que existe es la que sí está.
- En el **Excel de trazabilidad** hay una columna nueva, junto a *Origen /
  validación*, y cuando no se dio la celda lo escribe (una celda vacía en un
  entregable se lee como "no aplica"). El **Excel oficial de taxonomía no cambia**.

### El detalle que se descubrió al construirlo

El portal decía «**Entregaste** archivo.xlsx» en la lista de entregas. Para el jefe
de área —que ve las entregas de *su gente*— eso es falso, igual que lo era para una
carga hecha por IRStrat. Ahora la frase nombra al autor: «Entregaste» solo si la
carga es de quien está mirando; si no, «[Nombre] entregó…». El E2E lo fija.

```bash
pnpm e2e:vb-area
```

Recorre la cadena completa con sesiones reales: el área carga → el jefe firma → las
dos marcas aparecen en portal, panel y matriz → llega evidencia nueva y el visto
bueno se revoca con su entrada de bitácora → el jefe re-firma → IRStrat valida y las
dos marcas quedan ✓. Más el camino de validar **sin** visto bueno (procede, y la
pantalla lo dice) y los negativos: el jefe de otra área no firma, el responsable
tampoco, el jefe no valida, no edita el contenido, no ve otras áreas, no firma sin
evidencia y no puede retirar la firma después de la validación.

## Informe de cobertura para imprimir (PDF)

`/admin/cobertura/informe` es el tablero de cobertura maquetado **como documento**:
encabezado con emisora, reporte y **fecha de corte**, anillos por pilar, tarjetas de
totales, el desglose por norma y pilar con sus barras, la extensión GRI aparte, y un
pie discreto de la plataforma. El botón **Exportar PDF** de la cobertura lo abre en
otra pestaña y dispara `window.print()`; el PDF lo produce el navegador
("Guardar como PDF").

- **Sin motor de PDF en el servidor.** El documento ya sabemos maquetarlo en HTML y
  el navegador imprime igual de bien: meter Puppeteer o similar habría añadido un
  binario, memoria y una fuente de fallos a un dyno que hoy no los tiene, para
  producir el mismo archivo.
- **Los mismos números que el tablero.** Las dos vistas cargan con
  `lib/cobertura-datos.ts`. Si cada una calculara lo suyo, tarde o temprano el PDF
  diría un porcentaje distinto del de la pantalla — y de las dos cifras, la que el
  cliente archiva es la del PDF.
- **Sin un solo control interactivo:** lo que se ve es lo que se imprime. Las
  reglas de `@media print` viven en la propia vista (`@page` carta, `break-inside:
  avoid` por grupo, ocultado de la barra de la app) porque solo aplican a este
  documento, y tenerlas al lado del maquetado evita que alguien "limpie" un salto
  de página sin saber qué rompía.
- **Permisos:** es una ruta del panel, así que entran staff y administrador del
  cliente, y RLS acota los datos. El administrador del cliente **no necesita ruta
  aparte**: el alcance lo pone su sesión. Su encabezado se resuelve desde su propia
  emisora —llega sin `?tenant=` porque no tiene selector— y no desde el parámetro;
  sin eso, el documento que archiva su auditor saldría encabezado con un guion.
- **Fecha de corte, siempre.** Una cobertura sin fecha no se puede archivar: mañana
  dice otra cosa.

Verificado con Playwright, incluido el PDF real generado por el motor del navegador
(9 páginas para las 91 filas NIIF + la extensión GRI, con los grupos sin cortar a
la mitad y el pie repetido al pie de cada página).

## Solicitudes multi-área: difusión

El caso real: **quien pide la información no sabe qué área la tiene.** Antes había
que adivinar, y una solicitud mal dirigida se quedaba semanas en el limbo con el
área mirándola sin saber que no era suya. Ahora se pregunta a varias —o a todas— y
las que no aplican **lo declaran**.

### El modelo no cambia: una copia por área

Difundir crea **una copia idéntica por área**, unidas por
`solicitudes.grupo_difusion_id`. Cada copia sigue siendo una solicitud normal: su
área, su responsable, su evidencia, su visto bueno de área, su validación por
origen y sus candados, sin una sola excepción. Lo único nuevo es el hilo que las
une y dos marcas paralelas.

**No hay tabla de grupos** porque un grupo no tiene atributos propios: el
enunciado, la fecha límite y los recordatorios viven en cada copia —porque cada
copia es una solicitud de verdad—, y quién difundió y cuándo ya está en la
bitácora. Un `uuid` compartido *es* el grupo; una tabla con un id y nada más solo
añadiría un JOIN y un lugar donde desincronizarse.

**Dos marcas, dos actores** (ninguna es un estado; la máquina de estados no se
toca):

| | Quién | Qué dice |
|---|---|---|
| `declinada` | el **área** (responsable o su jefe) | "esto no me corresponde" |
| `desactivada` | quien **difundió** | "ya sé quién la tenía; estas copias sobran" |

Se leen distinto en la vista de grupo y en el entregable, así que son dos columnas
y no un enum de "cerrada".

### Crear una difusión

El selector de área del formulario es **multi-selección con casillas**, con atajo
**"Todas las áreas"**. Con dos o más, la UI avisa cuántas copias va a crear.

- **La difusión no lleva rubro de taxonomía**, y el selector se deshabilita
  diciéndolo: la celda del entregable la llena **una sola** solicitud (hay un
  índice único por reporte y rubro), así que N copias peleándose por ella dejarían
  el Excel indefinido — y la segunda copia moriría con un error de unicidad que
  nadie sabría leer. Cuando se sabe qué área tenía el dato, el rubro se le asigna a
  esa copia desde su detalle.
- **El responsable designado tampoco viaja**: solo aplica a *su* área, y ponerlo en
  todas las copias le mandaría a una persona el trabajo de otras cinco.
- Lo que **sí** se hereda en todas: enunciado, descripción, fecha límite,
  recordatorios y el mapeo a datapoints.
- **Bitácora:** un acto de difusión (`solicitud_difundida`) con su conteo y sus
  áreas, más la creación de cada copia.

### "No aplica a mi área"

En el portal, las copias de una difusión ofrecen el botón al **área**: el
responsable y su jefe, que son "el área". El coordinador y el administrador del
cliente **no** declinan por ellos — declarar que algo no te corresponde lo dice
quien hace el trabajo, y firmarlo desde arriba sería poner en su boca algo que no
dijo.

Al declinar (con ConfirmDialog y **nota opcional**, que es el lugar de "esto lo
tiene Operaciones"):

1. se **publica el comentario** estándar en la conversación, con la nota;
2. `declinada = true`;
3. la solicitud **sale de sus pendientes**, de su barra de avance y de los
   recordatorios, y se muestra en gris como *Declinada*;
4. **no acepta evidencia** (lo impide un trigger, no solo la UI);
5. es **reversible** con "Retomar" mientras el grupo siga abierto, y el retorno
   también queda en la conversación.

**No se declina lo ya entregado.** Si el área subió un archivo, la información sí
le correspondía; dejar las dos cosas juntas volvería el expediente contradictorio,
así que el trigger lo rechaza y la UI lo explica.

### La vista de grupo (quien difundió)

En el detalle de cualquier copia, un panel con las N áreas y **su respuesta** —
entregó / en proceso / declinó / copia retirada / sin respuesta—, la nota de quien
declinó, y liga a cada copia. La tabla no repite el estado interno: traduce la
respuesta, que es lo que decide el siguiente movimiento.

**"Desactivar copias"** cierra la difusión: ofrece las que declinaron o siguen sin
responder —**nunca** las que entregaron algo— y las retira del juego. No borra
nada: cada copia conserva su conversación, su declaración y su historia; lo que
cambia es que deja de pedir, de contar y de recordar. Quién puede hacerlo lo decide
la regla de origen de siempre.

### Entregables y cobertura

- Una copia declinada o retirada **no es una brecha**: no es "sin evidencia" sino
  "no aplica". Sale de la cobertura y del Excel oficial de taxonomía.
- El **Excel de trazabilidad** las lista con una columna **Difusión** que dice cuál
  es cuál: sin ella, una copia declinada se leería como una solicitud sin evidencia,
  un hueco donde en realidad hubo respuesta.

```bash
pnpm e2e:difusion
```

Difunde a tres áreas con "Todas las áreas", una entrega, otra declina con su nota y
la tercera se queda silente; comprueba la vista de grupo con los tres caminos,
retira las copias que sobran y confirma la columna del entregable. Negativos: un
área no ve las copias de otra (ni por id), otra área no declina por ella, el jefe no
edita el contenido, la que entregó no se puede declinar ni retirar, y el rubro no es
seleccionable en una difusión.

## Documentación

- **[DESIGN.md](./DESIGN.md)** — sistema de diseño: tokens, tipografía, componentes, motion.
- **[README-SCHEMA.md](./README-SCHEMA.md)** — esquema, diagrama de relaciones,
  modelo RLS, triggers, storage, **credenciales demo** y decisiones de diseño.
- Types generados: `lib/database.types.ts`
  (`supabase gen types typescript --local > lib/database.types.ts`).
