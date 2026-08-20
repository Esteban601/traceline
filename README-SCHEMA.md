# Esquema de base de datos — Recabado y trazabilidad de evidencia ESG (NIIF S1/S2)

Herramienta multi-tenant para gestionar el recabado de información de emisoras
BMV, la carga de evidencia versionada y la trazabilidad requerida para el
aseguramiento limitado bajo **NIIF S1/S2**.

> **Nombre comercial pendiente.** La app nunca debe hardcodear su nombre: se
> toma siempre de `NEXT_PUBLIC_APP_NAME` (default provisional: `TRACELINE`).

**Unidad central del modelo: el _datapoint_ de taxonomía, no el archivo.**
El cliente ve **solicitudes** en lenguaje llano; el mapeo de esas solicitudes a
los datapoints NIIF es interno de IRStrat y no se expone al cliente.

---

## Stack y puesta en marcha

- Next.js 15 (App Router, TypeScript, pnpm) — hoy solo esquema/seguridad/seeds, sin UI.
- Supabase local (CLI + Docker), Postgres 17.

```bash
pnpm install
supabase start           # levanta el stack local (Docker)
supabase db reset        # aplica migraciones + seed (idempotente, limpio de inicio a fin)
supabase gen types typescript --local > lib/database.types.ts   # regenerar types
```

`supabase/config.toml`, `supabase/migrations/**` y `supabase/seed.sql` **se
versionan**. Los `.env*` no (usa `.env.example` como plantilla).

---

## Migraciones

| Orden | Archivo | Contenido |
|------|---------|-----------|
| 1 | `20260704172201_esquema_inicial.sql` | Enums, 10 tablas, funciones helper de identidad. |
| 2 | `20260704172202_rls_politicas.sql` | RLS en todas las tablas + prohibición append-only. |
| 3 | `20260704172203_triggers.sql` | Versionado de evidencia, transición de estado, bitácora. |
| 4 | `20260704172204_storage_evidencias.sql` | Bucket privado `evidencias` y políticas de acceso. |
| … | `20260820120000_rol_admin_cliente_enum.sql` | Valor `admin_cliente` en el enum `rol_usuario`. **Va solo**: Postgres prohíbe usar un valor de enum nuevo en la misma transacción que lo crea. |
| … | `20260821130000_alcance_bitacora_policy.sql` | Vuelve a declarar `perfiles_staff_visible_al_cliente` con su rama de bitácora. Existe porque esa rama se añadió al archivo de `20260820130000` **después** de que ya estuviera aplicado a staging: en vez de confiar en qué versión quedó en cada ambiente, esta migración converge los dos. **Regla que queda:** una migración aplicada no se edita, se corrige con otra. |
| … | `20260821120000_nota_alcance.sql` | `solicitudes.nota_alcance`: salvedad de perímetro que el export agrega a la celda de Notas/Brechas. |
| … | `20260820130000_admin_cliente.sql` | Rol admin-cliente: `solicitudes.origen`, `tenants.staff_puede_cargar`, `evidencias.cargado_por_staff`, sus políticas RLS, los triggers de la regla de origen y del toggle, y `fn_renombrar_area`. |
| … | `20260822120000_tenant_es_demo.sql` | `tenants.es_demo` + `trg_tenant_es_demo`: la etiqueta de demostración deja de ser del ambiente (`NEXT_PUBLIC_STAGING`) y pasa a ser del cliente. Backfill por el prefijo `[DEMO]` del nombre; default `false` (un cliente nuevo nace real). |
| … | `20260822130000_debe_cambiar_password.sql` | `perfiles_usuario.debe_cambiar_password` + `grant update (debe_cambiar_password) … to service_role`: cambio forzado cuando la contraseña se entregó por un canal externo. |
| … | `20260824120000_rol_jefe_area_enum.sql` | Valor `jefe_area` en el enum `rol_usuario`. **Va solo** (misma razón que `admin_cliente`). |
| … | `20260825120000_extension_gri.sql` | Renombre CON mapeo de la extensión: `marco` pasa de `'VERT'` a `'GRI'` y los 4 datapoints reciben su código oficial (`GRI 303-5`, `306-3`, `404-1`, `2-7 / 401-1`). El CHECK queda en `('NIIF','GRI')`. No toca los 91 NIIF ni la plantilla oficial. |
| … | `20260824130000_visto_bueno_area.sql` | `solicitudes.vb_area_por/vb_area_fecha`, `fn_es_jefe_de_area`, la política de escritura del jefe, el trigger de reglas duras y el de revocación por evidencia nueva. Corrige además `fn_puede_ver_solicitud` y `solicitudes_select` para que el rol nuevo quede acotado a su área, y amplía las políticas del `admin_cliente` para que pueda dar de alta jefes. |
| … | `20260823120000_recordatorios_programados.sql` | `solicitudes_recordatorios` + `fn_gestiona_recordatorios`: avisos por correo a N días de la fecha límite de una solicitud. Grants explícitos (tabla nueva): los cuatro comandos a `authenticated`, **solo SELECT** a `service_role` — el cron lee la configuración, no la cambia. |

---

## Diagrama de relaciones

```
                         ┌───────────────┐
                         │    tenants    │  emisoras / clientes BMV
                         └───────┬───────┘
             ┌───────────────────┼───────────────────────────┐
             │ 1:N               │ 1:N                        │ (tenant_id)
             ▼                   ▼                            ▼
   ┌──────────────────┐   ┌──────────────┐            ┌──────────────┐
   │ perfiles_usuario │   │   reportes   │            │   bitacora   │  APPEND ONLY
   │ id = auth.users  │   │  (ejercicio) │            │ (auditoría)  │
   │ tenant_id NULL   │   └──────┬───────┘            └──────────────┘
   │  = staff IRStrat │          │ 1:N
   └───────┬──────────┘          ▼
           │            ┌──────────────────┐        ┌──────────────────────────┐
           │ resp.      │   solicitudes    │  N:N   │   datapoints_taxonomia   │
           ├───────────►│ (lenguaje        │◄──────►│  (catálogo NIIF S1/S2,   │
           │ cliente /  │  cliente)        │  vía   │   interno IRStrat)        │
           │ irstrat    └──────┬───────────┘ mapeo_ └──────────────────────────┘
           │                   │             solicitud_datapoint
           │        ┌──────────┼───────────────────────┐
           │        │ 1:N      │ 1:N                    │ 1:N
           │        ▼          ▼                        ▼
           │  ┌───────────┐  ┌──────────────┐   ┌──────────────┐
           └─►│ evidencias│  │ capturas_valor│   │ comentarios  │
   (subido_por│ APPEND    │◄─│ APPEND ONLY   │   │ /observación │
    capturado_│  ONLY     │  │ (evidencia_id)│   └──────────────┘
    por, autor)└─────┬─────┘  └──────────────┘
                     │ archivo_path
                     ▼
             Storage bucket privado 'evidencias'
             ruta: {tenant_id}/{solicitud_id}/<archivo>
```

### Cardinalidades clave

- `tenants` 1—N `reportes` 1—N `solicitudes`.
- `solicitudes` **N—N** `datapoints_taxonomia` (tabla puente `mapeo_solicitud_datapoint`).
- `solicitudes` 1—N `evidencias` (versionadas) 1—N `capturas_valor`.
- `perfiles_usuario.id` **=** `auth.users.id`. `tenant_id NULL` ⇒ staff IRStrat.

---

## Modelo de seguridad (RLS)

RLS está **habilitado en las 10 tablas**. La identidad del solicitante se
resuelve con funciones `SECURITY DEFINER` que leen `perfiles_usuario` sin
recursar sobre su propio RLS: `fn_is_staff()`, `fn_current_tenant()`,
`fn_current_rol()`, `fn_current_area()` y `fn_puede_ver_solicitud(id)`.

| Actor | Alcance |
|-------|---------|
| `anon` | Sin acceso a ninguna tabla de negocio. |
| **Staff IRStrat** (`tenant_id NULL`) | Ve y gestiona **todo**, incluida la taxonomía y el mapeo. |
| **Administrador del cliente** (`admin_cliente`, rol de tenant) | Todas las solicitudes de **su** tenant; crea y edita las de **origen `cliente`** y las revisa/valida; crea y edita sus áreas; da de alta usuarios de su tenant con rol `cliente` o `admin_cliente`. **Lectura** de la taxonomía y del mapeo de sus propias solicitudes (lo necesita su cobertura y su export). Nada cross-tenant. |
| **Coordinador** (rol de tenant) | Todas las solicitudes/evidencias de **su** tenant. |
| **Cliente** (rol de tenant) | Solo solicitudes de **su área** (`area_asignada`) o donde es `responsable_cliente_id`; y la evidencia/capturas/comentarios de esas solicitudes. |
| `service_role` | **BYPASSRLS** — uso server-side/administrativo. Ver nota abajo. |

> **Ojo con `service_role`:** solo tiene los GRANT que cada migración le dio
> (`select` en casi todas las tablas de negocio). No es un comodín para escribir:
> un `DELETE` suyo sobre `tenants`/`reportes` devuelve `42501`. Los scripts que
> limpian datos lo hacen con una **sesión de staff** (RLS activo) y reservan
> `service_role` para lo que solo él puede hacer: administrar cuentas en GoTrue.

- **Taxonomía y mapeo** (`datapoints_taxonomia`, `mapeo_solicitud_datapoint`)
  son **solo staff**: el cliente nunca ve el mapeo NIIF.
- **`service_role`** salta RLS por diseño de Supabase; solo debe usarse en el
  servidor (nunca en el cliente) y con lógica de autorización propia.

### Append-only a nivel de base de datos (no por convención)

`evidencias`, `capturas_valor` y `bitacora` son inmutables. Se aplica en **dos
capas** para todos los roles de aplicación (`authenticated`, `anon`):

1. `REVOKE UPDATE, DELETE` (y `INSERT` en `bitacora`) sobre la tabla.
2. Políticas RLS **restrictivas** `FOR UPDATE/DELETE USING (false)`.

Correcciones ⇒ **filas nuevas** (nunca `UPDATE`). En `capturas_valor` la
corrección se marca con `confirmado` (la fila anterior queda `confirmado=false`).

> Nota: el rol `postgres` (migraciones/seed) hace bypass; la inmutabilidad protege
> el acceso de la aplicación, que corre como `authenticated`.
>
> **`service_role` tampoco puede borrarlas**, y conviene no confundirlo: salta RLS,
> pero los GRANT son otra cosa y no los tiene. Medido: `service_role` solo tiene
> `SELECT` en `comentarios` y ninguna escritura en `evidencias` ni
> `capturas_valor`. Así que ni un script con la llave de servicio retracta
> evidencia fila por fila — el único borrado posible es **por cascada** desde el
> reporte o el tenant, que es justo el que usa `import-gcarso.mjs --limpiar`.

---

## Triggers

| Trigger | Evento | Efecto |
|--------|--------|--------|
| `trg_evidencia_before_insert` | BEFORE INSERT `evidencias` | Asigna `version = max(version)+1` de la solicitud. |
| `trg_evidencia_after_insert` | AFTER INSERT `evidencias` | Avanza estado `pendiente`/`solicitado` → `recibido`; registra `evidencia_creada` en bitácora. |
| `trg_captura_after_insert` | AFTER INSERT `capturas_valor` | Registra `captura_creada` en bitácora. |
| `trg_solicitud_estado_bitacora` | AFTER UPDATE `solicitudes` | Si cambió `estado`, registra `cambio_estado` (estado anterior/nuevo). |
| `trg_solicitud_origen_transicion` | BEFORE UPDATE `solicitudes` | **Regla dura de origen**: las de `origen='irstrat'` solo las transiciona el staff; las de `origen='cliente'`, solo el `admin_cliente` de ese tenant. Excepciones deliberadas: el **congelamiento** (acto de IRStrat sobre el reporte) y las **transiciones automáticas** por llegada de evidencia/captura, que los triggers marcan con el ajuste local `app.transicion_automatica`. |
| `trg_comentario_observacion_origen` | BEFORE INSERT `comentarios` | Una **observación formal** (`es_observacion`) solo la registra el lado dueño del origen. Cierra además un hueco previo: la política de `comentarios` dejaba marcar el flag a cualquiera con acceso. |
| `trg_evidencia_marca_carga` | BEFORE INSERT `evidencias` | Si quien inserta es staff, exige `tenants.staff_puede_cargar` y `area_origen`, y **calcula** `cargado_por_staff = true`. Si no es staff, la fija en `false`. La aplicación nunca escribe esa marca: por eso es inborrable. |
| `trg_tenant_toggle_carga_staff` | BEFORE INSERT OR UPDATE `tenants` | `staff_puede_cargar` solo lo cambia el rol `admin` de IRStrat. Cubre el INSERT porque dar de alta un cliente ya encendido es otra forma de cambiarlo. |
| `trg_solicitud_vb_area` | BEFORE UPDATE `solicitudes` | Reglas duras del **visto bueno del área**: solo el jefe de esa área lo mueve, exige evidencia, **calcula** autor y fecha, queda fijo tras la validación, y si la sesión es de un jefe de área impide que cambie cualquier otra columna de la fila. |
| `trg_evidencia_revoca_vb` | AFTER INSERT `evidencias` | Evidencia nueva **revoca** el visto bueno y lo registra en bitácora (`vb_area_revocado`, sin autor humano: es acto del sistema). Marca el cambio con `app.vb_automatico` para no exigirse sesión de jefe a sí mismo. |
| `trg_tenant_es_demo` | BEFORE INSERT OR UPDATE `tenants` | `es_demo` solo lo cambia el rol `admin` de IRStrat, por la misma razón y con la misma forma: marcar (o desmarcar) una emisora cambia lo que su propio entregable dice de sí mismo. |

Las funciones de trigger son `SECURITY DEFINER` para poder escribir en
`bitacora` a pesar de que el `INSERT` directo esté revocado: la bitácora solo
la puebla el sistema.

---

## Storage

- Bucket **privado** `evidencias`. Ruta: `{tenant_id}/{solicitud_id}/<archivo>`.
- **Staff**: acceso total.
- **Usuario de tenant**: sube y lee solo bajo la ruta de su tenant, y solo a
  solicitudes que puede ver (`fn_puede_ver_solicitud`). Sin `UPDATE`/`DELETE`.

- Bucket **público de lectura** `logos` (branding por cliente, Sprint 7). Ruta:
  `{tenant_id}/<archivo>`. `allowed_mime_types` = PNG/JPG/SVG/WebP y
  `file_size_limit` = 2 MB declarados en el propio bucket. **Escritura (insert,
  update, delete) solo staff**, con políticas explícitas — el patrón de grants
  aplica también a storage. Nada sensible vive aquí: el logo se sirve por URL
  pública para pintarlo en el header del portal sin firmar cada request.

---

## Operación multi-cliente (Sprint 7)

Añadidos por `20260817120000_multicliente.sql`:

| Objeto | Qué es |
|--------|--------|
| `tenants.prefijo_folio` | Clave corta de la emisora: 3-4 letras mayúsculas, **única**, con CHECK `^[A-Z]{3,4}$`. Los tenants preexistentes se backfillean derivándola del nombre (y desempatando con una letra final, nunca un dígito, para no violar el CHECK). |
| `tenants.logo_url` | URL pública del logo en el bucket `logos`. NULL = la UI cae a las iniciales del cliente. |
| `tenants.slug` | Ahora con CHECK de kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`); antes solo se validaba en la UI. |
| `areas_tenant` | Catálogo de áreas **por cliente** (RH, Operaciones, …). Se backfillea con las áreas que ya existían en los datos del tenant (usuarios y solicitudes) para no inventar ninguna. RLS: el usuario del cliente lee las suyas; escribe el staff. |
| `invitaciones` | Liga de un solo uso con vencimiento para establecer contraseña. Guarda el **SHA-256** del token, nunca el token. `authenticated` solo tiene `SELECT`/`INSERT` (gateado a staff por RLS); el **canje** lo resuelve el servidor con `service_role`, porque quien canjea aún no tiene sesión. |

Desactivar un cliente (`tenants.activo = false`) **no borra nada** y corta el
acceso de sus usuarios: se valida en el login y se revalida en el middleware en
cada request. El staff no tiene tenant, así que no le aplica.

---

## Export de taxonomía por cliente/reporte

Añadidos por `20260818120000_export_por_reporte.sql`:

| Objeto | Qué es |
|--------|--------|
| `rubros_taxonomia` | Catálogo **global** de rubros canónicos de la norma (GEI Alcance 1/2/3 + las 15 categorías de Alcance 3). Se siembra en la **migración**, no en el seed: son categorías de la taxonomía, no datos de demostración. Solo staff (RLS), como `datapoints_taxonomia`. |
| `mapeo_export.rubro_clave` + `.anio_offset` | Sustituyen a `solicitud_id` + `ejercicio`. La tabla pasa de "estas celdas se llenan con estas solicitudes del demo" a "esta plantilla tiene estas celdas". El offset es **relativo** al ejercicio del reporte (`0` = el del reporte, `1` = el anterior). |
| `solicitudes.rubro_taxonomia` | FK al catálogo, con índice **único parcial** `(reporte_id, rubro_taxonomia)`: un rubro lo alimenta una sola solicitud por reporte, así que el export no tiene empates que desempatar. |
| `plantilla_solicitudes.rubro_taxonomia` | Propaga el rubro al clonar; es lo que hace que el primer export de un cliente nuevo salga lleno. |

La migración **traduce las filas existentes** (staging) por posición de celda —así
se construyeron, leyendo la plantilla real— y aborta con `raise exception` si
alguna fila de valor quedara sin traducir, en vez de dejar huecos silenciosos.
Al soltar `solicitud_id` desaparece también su `on delete cascade`: borrar una
solicitud ya no puede llevarse el mapeo por delante.

---

## Rol admin-cliente (tier de autoservicio)

Añadidos por `20260820120000_rol_admin_cliente_enum.sql` (el valor del enum, en su
propia transacción) y `20260820130000_admin_cliente.sql`:

| Objeto | Qué es |
|--------|--------|
| `rol_usuario.admin_cliente` | Usuario **del cliente** que administra su propio tenant sin acompañamiento de IRStrat. Tiene `tenant_id`, así que `fn_is_staff()` sigue siendo `false` para él; entra al **panel** (`/admin`), no al portal simple. |
| `fn_is_admin_cliente()` | Espejo de `fn_is_staff()` para el rol nuevo: `SECURITY DEFINER`, exige `activo` (un administrador desactivado no conserva poderes ni un request). |
| `origen_solicitud` + `solicitudes.origen` | `'irstrat'` (la pidió la firma) o `'cliente'` (la creó el administrador del cliente). NOT NULL con default `'irstrat'`: el backfill es un hecho histórico, no una suposición — hasta esta migración no había otra vía de crear solicitudes que el panel interno. De este campo depende **quién** revisa, observa y valida. |
| `tenants.staff_puede_cargar` | Toggle **por cliente** que habilita a IRStrat a cargar evidencia en nombre de un área. `NOT NULL default false`: el comportamiento de siempre se conserva como default. |
| `evidencias.cargado_por_staff` | Marca de autoría **calculada por trigger**, no por la aplicación. Apagar el toggle después no la retira de nada ya cargado. |
| `fn_perfil_es_del_tenant(perfil, tenant)` | Sostiene la política **restrictiva** `invitaciones_perfil_del_tenant`: una liga de acceso nunca puede apuntar a un perfil de otro cliente ni a uno de IRStrat. Una invitación es un **cambio de contraseña diferido** (el canje corre con `service_role` y hace `updateUserById`), así que acotar solo `tenant_id` habría dejado emitirse una liga contra una cuenta ajena. Se comprueba también en la acción de canje, que por definición no pasa por RLS. |
| `solicitudes.nota_alcance` (mig. `20260821120000`) | Salvedad de **perímetro** de la cifra, redactada para el entregable. El export la **agrega** a la celda de Notas/Brechas de la fila que esa solicitud alimenta, junto a las brechas que ya haya. Es una columna y no lógica en el export porque el perímetro es una propiedad del dato de un cliente, no de la plantilla. Se fija incluso sobre una solicitud **validada** (misma excepción que el rubro: no cambia el dato, lo explica); congelado queda fuera. CHECK contra cadenas vacías: una nota en blanco ensuciaría la celda con un separador sin contenido. |
| `fn_renombrar_area(area_id, nombre)` | Renombra un área del cliente y **propaga** el nombre a `solicitudes.area_asignada` y `perfiles_usuario.area` del mismo tenant, en una transacción. Se niega si un reporte **congelado** usa el nombre (sus solicitudes son solo-lectura por candado de BD y la propagación quedaría a medias). `SECURITY DEFINER` con autorización propia: staff o `admin_cliente` de ese tenant. |

**Por qué el renombrado de un área es una función y no un `UPDATE`.** El nombre
del área vive en tres lugares —el catálogo, las solicitudes y los perfiles— y de
que los tres coincidan **exactamente** depende `fn_puede_ver_solicitud`. Cambiar
solo el catálogo dejaría a la gente sin ver su propio trabajo, en silencio.

**El cliente puede leer el nombre de quien actuó desde IRStrat.** Política
`perfiles_staff_visible_al_cliente`. Sin ella, el historial y las observaciones
mostraban "—" donde debía ir un nombre —el embed devolvía `null` porque
`perfiles_select` no alcanzaba al staff—, y un rastro que no dice **quién** no
sirve para aseguramiento. (El hueco existía desde antes para las observaciones; se
cierra aquí porque la carga por IRStrat lo volvió evidente.)

Lo que se abre NO es "el staff", son **los perfiles que aparecen en lo que ese
usuario ya puede ver**: quien subió una evidencia suya, quien capturó un valor
suyo, quien comentó en una de sus solicitudes (tres `EXISTS` acotados por
`fn_puede_ver_solicitud`) **o quien dejó un acto en la bitácora de su tenant**.
Índices en `evidencias.subido_por`, `capturas_valor.capturado_por`,
`comentarios.autor_id` y `bitacora.usuario_id`.

La cuarta rama no es un extra: buena parte de lo que hace IRStrat **solo** deja
rastro en la bitácora —crear una solicitud, cambiar su estado, congelar un reporte,
mover el toggle de carga—, y sin ella el embed devolvía `null` y `actorBitacora`
pintaba esas entradas como **«Sistema»**. Eso es peor que un hueco: es atribuirle a
un proceso automático algo que hizo una persona.

La diferencia con abrir "todo el staff" importa porque **RLS es a nivel de fila, no
de columna**: una política sin acotar habría dejado enumerar por REST el equipo
completo de la firma con sus correos y sus roles, que es mucho más de lo que hace
falta para poner un nombre en un historial.

**Por qué el administrador del cliente lee la taxonomía.** Su tier incluye "su
cobertura, con el export de su Excel", y esa vista **es** el catálogo de la norma.
Se abre en **solo lectura** (`datapoints_taxonomia`, `rubros_taxonomia`,
`mapeo_export`, y `mapeo_solicitud_datapoint` acotado a las solicitudes que ya
puede ver). La **escritura** del catálogo y del mapeo NIIF sigue siendo exclusiva
del staff, y los usuarios de área (`cliente`) no ven nada de esto.

---

## Visto bueno del área (doble verificación)

| Objeto | Qué es |
|--------|--------|
| `rol_usuario.jefe_area` | JEFE de un área del cliente. Permisos del responsable de área (acotado a SU área por `fn_puede_ver_solicitud`) más dar/retirar el visto bueno. Entra al **portal**; `puedeEntrarPanel` es false. No valida: el trigger de origen se lo niega como a cualquiera. |
| `solicitudes.vb_area_por` / `vb_area_fecha` | La firma vigente del área. CHECK de que viajen juntas; `ON DELETE RESTRICT` sobre el perfil (una firma no queda huérfana, igual que `evidencias.subido_por`). **Columnas y no tabla**: el visto bueno es estado actual de un solo valor, y su historial ya vive en `bitacora` (append-only) con sus tres actos —`vb_area_dado`, `vb_area_retirado`, `vb_area_revocado`—. |
| `fn_es_jefe_de_area(solicitud)` | Autorización: jefe **activo**, del mismo tenant y de la **misma área** que la solicitud. Es lo que sostiene la política de escritura y el trigger. |

**Por qué hacen falta política Y trigger.** RLS no distingue columnas: la política
`solicitudes_jefe_area_vb` abre el UPDATE de la fila, y el trigger es el que acota
qué puede cambiar (solo las dos columnas del visto bueno, comparando el resto de la
fila en bloque con `to_jsonb`). Ninguna de las dos piezas sobra.

**La revocación no depende de la aplicación.** Vive en `trg_evidencia_revoca_vb`,
así que una carga hecha por el panel, por el import o por un script también retira
la firma. Si dependiera de la server action del portal, existiría el caso de una
firma que respalda un archivo que ya no es el vigente.

---

## Etiqueta de demostración y contraseña temporal

| Objeto | Qué es |
|--------|--------|
| `tenants.es_demo` (mig. `20260822120000`) | `true` = emisora de **demostración**: sus sesiones muestran la franja «Entorno de demostración» y su Excel de taxonomía lleva el pie `[DEMO]`. `NOT NULL default false`: un cliente nuevo nace **real**, porque el costo de equivocarse en ese sentido (una franja de más) es menor que el contrario. Antes las dos marcas se inferían del prefijo `[DEMO]` del **nombre**: renombrar una emisora le cambiaba el entregable. El `noindex/nofollow` **no** depende de esta columna: es propiedad de la URL y sigue siendo global. |
| `perfiles_usuario.debe_cambiar_password` (mig. `20260822130000`) | `true` = la contraseña vigente es **temporal** y se entregó por un canal externo (dictada, impresa). Mientras esté encendida, el ingreso y el middleware fuerzan `/restablecer` y ninguna otra vista se renderiza. La apaga el servidor con `service_role` **después** de que `auth.updateUser` cambió la contraseña, o el canje de invitación. |

**Por qué el apagado no es una función `security definer`.** Sería una RPC que
cualquier sesión podría llamar desde el navegador para saltarse el cambio sin
cambiar nada. El camino queda dentro de la acción que ya comprobó el cambio, y el
privilegio se concede **por columna**:

```sql
grant update (debe_cambiar_password) on public.perfiles_usuario to service_role;
```

Es el patrón de la casa aplicado al detalle: `service_role` no tiene escritura por
default sobre `perfiles_usuario` (medido: solo `SELECT`), y aquí gana exactamente
un campo — ni rol, ni tenant, ni área.

---

## Recordatorios programados

| Objeto | Qué es |
|--------|--------|
| `solicitudes_recordatorios` | Un intervalo por fila (`dias_antes > 0`, máx. 365, único por solicitud). `activo = false` es **configurado y apagado**, distinto de no existir: eso es lo que un array en `solicitudes` no podía expresar. Sin `fecha_limite` la configuración es válida y no dispara — las solicitudes clonadas de plantilla nacen así. |
| `fn_gestiona_recordatorios(solicitud)` | Autorización de ESCRITURA: staff, o `admin_cliente` del tenant, y solo si el reporte no está `congelado`. Excepción deliberada a la regla de origen: el `admin_cliente` gestiona también los avisos de solicitudes `irstrat`, porque a quien se le escribe es a su gente. La lectura la gobierna `fn_puede_ver_solicitud` (la misma que evidencias y comentarios), así que el usuario de área ve su calendario y no lo cambia. |

El cron (`POST /api/recordatorios`) corre **programados y luego digest**: el orden
es lo que evita dos correos el mismo día a la misma persona, porque la regla
anti-spam del digest lee `bitacora`. Cada envío queda como
`recordatorio_programado_enviado`, **una entrada por destinatario**.

---

## Datos de demostración (seed)

**Regla de oro respetada:** todo el seed es DEMO y está etiquetado como tal
(prefijo `[DEMO]` en tenant, reporte y usuarios; correos con TLD reservado
`.example`). No hay cifras presentadas como reales.

### Credenciales demo

Contraseña única para todos: **`Demo2025!`**

| Rol | Email | Área | Alcance |
|-----|-------|------|---------|
| Coordinador (cliente) | `coordinador@empresademo.example` | — | Todo el tenant demo |
| Cliente | `rh@empresademo.example` | RH | Solo solicitudes de RH |
| Cliente | `operaciones@empresademo.example` | Operaciones | Solo solicitudes de Operaciones |
| Cliente | `finanzas@empresademo.example` | Finanzas | Solo solicitudes de Finanzas |
| **Jefe de área** | `jefe.rh@empresademo.example` | RH | Solo RH; además da/retira el visto bueno del área |
| **Administrador del cliente** | `admin.cliente@empresademo.example` | — | Panel acotado al tenant demo (autoservicio) |
| Analista IRStrat (staff) | `analista@irstrat.example` | — (staff) | Todo |

### Contenido sembrado

- 1 tenant `[DEMO] Empresa Demo SAB`, 1 reporte `[DEMO] Informe Anual Sustentable 2025`.
- **30 datapoints** NIIF S1 (14) y S2 (16): gobernanza, estrategia, gestión de
  riesgos, métricas; GEI Alcance 1/2/3 (GHG Protocol), riesgos físicos y de
  transición, métricas intersectoriales.
- **20 solicitudes** en lenguaje cliente repartidas entre RH, Operaciones,
  Finanzas y Gobierno Corporativo/Dirección; 9 cuantitativas con unidad
  (`personas`, `horas`, `%`, `kWh`, `tCO2e`, `m3`, `ton`).
- **31 mapeos** N:N (varias solicitudes → un mismo datapoint y viceversa).
- **5 evidencias** (una con 2 versiones para mostrar el versionado append-only),
  **5 capturas de valor** (una corrección como fila nueva) y **3 comentarios**
  (incluida 1 observación).
- Estados variados para el semáforo: `pendiente`, `solicitado`, `recibido`,
  `en_revision`, `observaciones`, `validado`.

> **Códigos de datapoint — verificación pendiente.** Los `codigo` usan la
> convención `S1-REF-PEND-NN` / `S2-REF-PEND-NN`. La **descripción es fiel** a
> la divulgación NIIF S1/S2, pero el código **no** afirma un número de párrafo
> exacto: queda pendiente el mapeo manual a los párrafos reales de la norma. Se
> evita deliberadamente inventar números de párrafo.

---

## Decisiones de diseño

**¿Por qué el datapoint es la unidad central y no el archivo?**
El aseguramiento NIIF S1/S2 se hace sobre _divulgaciones_ (datapoints), no sobre
archivos. Un mismo archivo puede sustentar varios datapoints y un datapoint
puede requerir varias fuentes. Modelar el datapoint como eje permite rastrear la
cobertura de la norma con independencia de cómo llegue la evidencia.

**¿Por qué N:N entre solicitudes y datapoints?**
Una solicitud en lenguaje cliente (p. ej. "Consumo de energía eléctrica por
instalación") puede alimentar varios datapoints (Alcance 2 + metodología GEI), y
un datapoint (p. ej. Alcance 1) puede alimentarse de varias solicitudes
(inventario + consumo de combustibles). La relación es intrínsecamente
muchos-a-muchos; la tabla puente `mapeo_solicitud_datapoint` mantiene ese mapeo
como conocimiento **interno de IRStrat**, invisible al cliente.

**¿Por qué append-only (evidencias, capturas_valor, bitácora)?**
La trazabilidad para aseguramiento limitado exige un rastro **inmutable**: quién
subió qué, cuándo, y qué valor se capturó de qué versión. Permitir `UPDATE`/
`DELETE` destruiría esa cadena de custodia. Por eso las correcciones son filas
nuevas (versionado en `evidencias`, `confirmado` en `capturas_valor`) y la
inmutabilidad se aplica a nivel de base de datos (revoke + RLS restrictivo), no
como simple convención de la aplicación.

**¿Por qué separar `solicitudes` (cliente) de `datapoints` (norma)?**
Desacopla el lenguaje del cliente del vocabulario técnico de la norma. El cliente
opera sobre peticiones claras; IRStrat controla el cumplimiento de la taxonomía.
Cambiar el mapeo no altera la experiencia del cliente.

**¿Por qué funciones `SECURITY DEFINER` para la identidad?**
Las políticas de `perfiles_usuario` necesitan consultar `perfiles_usuario`
(tenant/rol/área). Encapsular esas lecturas en funciones `SECURITY DEFINER`
evita la recursión de RLS y centraliza la lógica de autorización reutilizada por
las demás tablas (`fn_puede_ver_solicitud`).
