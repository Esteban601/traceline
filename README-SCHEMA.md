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
| **Coordinador** (rol de tenant) | Todas las solicitudes/evidencias de **su** tenant. |
| **Cliente** (rol de tenant) | Solo solicitudes de **su área** (`area_asignada`) o donde es `responsable_cliente_id`; y la evidencia/capturas/comentarios de esas solicitudes. |
| `service_role` | **BYPASSRLS** — uso server-side/administrativo. Ver nota abajo. |

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

> Nota: el rol `postgres` (migraciones/seed) y `service_role` hacen bypass; la
> inmutabilidad protege el acceso de la aplicación, que corre como `authenticated`.

---

## Triggers

| Trigger | Evento | Efecto |
|--------|--------|--------|
| `trg_evidencia_before_insert` | BEFORE INSERT `evidencias` | Asigna `version = max(version)+1` de la solicitud. |
| `trg_evidencia_after_insert` | AFTER INSERT `evidencias` | Avanza estado `pendiente`/`solicitado` → `recibido`; registra `evidencia_creada` en bitácora. |
| `trg_captura_after_insert` | AFTER INSERT `capturas_valor` | Registra `captura_creada` en bitácora. |
| `trg_solicitud_estado_bitacora` | AFTER UPDATE `solicitudes` | Si cambió `estado`, registra `cambio_estado` (estado anterior/nuevo). |

Las funciones de trigger son `SECURITY DEFINER` para poder escribir en
`bitacora` a pesar de que el `INSERT` directo esté revocado: la bitácora solo
la puebla el sistema.

---

## Storage

- Bucket **privado** `evidencias`. Ruta: `{tenant_id}/{solicitud_id}/<archivo>`.
- **Staff**: acceso total.
- **Usuario de tenant**: sube y lee solo bajo la ruta de su tenant, y solo a
  solicitudes que puede ver (`fn_puede_ver_solicitud`). Sin `UPDATE`/`DELETE`.

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
