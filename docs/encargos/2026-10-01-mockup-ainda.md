# Encargo: Mockup AINDA (vitrina por tenant y auditor en el mockup)

Versión 1 · 1 de octubre de 2026.

**Responsable:** Esteban (con Claude Code)
**Ramas:** Fase 0 en `hotfix/vitrina-por-tenant` desde `main`, que se integra por PR. Fase 1 en `dev/ajustes-sep26`,
después de mezclar `main`. La Fase 2 es una corrida contra staging; no lleva rama.
**Fecha de inicio:** 1 de octubre de 2026.
**Referencia:** `CLAUDE.md` §1 (`.env.staging.local` para el script de prospectos), §3 y §9; especificación §10.

> Este archivo se armó con la estructura del encargo `2026-09-29-rol-auditor.md`, porque la plantilla que cita
> `CLAUDE.md` §8 (`docs/encargos/PLANTILLA.md`) no existe en ninguna rama.

## 1. Objetivo

Un mockup comercial para **AINDA Energía & Infraestructura**, administrador de fondos de capital privado de
energía e infraestructura (CKD AINDACK 18A). Lleva dos cosas que los mockups anteriores no traen:

- **Sin vitrina del Suplemento.** Un administrador de fondos no tiene un informe de emisora que enseñar con ese
  documento.
- **Con un auditor externo.** Así el prospecto ve el rol de aseguramiento desde dentro.

## 2. Alcance

**Fase 0 · vitrina por tenant (`hotfix/vitrina-por-tenant`).**
- Migración aditiva `20261001140000_tenants_vitrina_habilitada`: `tenants.vitrina_habilitada boolean not null
  default true`.
- La vitrina se ofrece solo cuando la emisora es de demostración **y** tiene la vitrina habilitada
  (`es_demo AND vitrina_habilitada`):
  - el botón de Cobertura (`app/admin/cobertura/page.tsx`);
  - la ruta de Word y PDF (`suplemento-demo/route.ts`). Con la vitrina apagada, la ruta responde **404**, antes de
    leer el archivo y sin fila de bitácora.
- E2e nuevo, `scripts/e2e-vitrina.mjs` (`npm run e2e:vitrina`):
  - encendida: botón visible para el staff y para el admin del cliente, Word 200 y una fila de bitácora;
  - apagada: sin botón, Word y PDF 404 para los dos, y ninguna fila;
  - al final la deja encendida.

**Fase 1 · `crear-demo-prospecto.mjs` en `dev/ajustes-sep26`.**
- La entrada de un prospecto acepta:
  - `vitrina: false`: fija `vitrina_habilitada = false`;
  - `auditor: true`: crea `auditor@<slug>.example` con rol `auditor` y contraseña generada. La cuenta entra al JSON
    de credenciales y al Excel de accesos con el rol «Auditor externo».
- Entrada AINDA:

  | Campo | Valor |
  |---|---|
  | slug | `ainda` |
  | nombre | «AINDA Energía & Infraestructura» |
  | prefijo | **`AIND`** (ver §7) |
  | logo | `ainda.png` |
  | `vitrina` | `false` |
  | `auditor` | `true` |

- Áreas: Inversiones y Portafolio, Gestión de Activos, Riesgos y Cumplimiento, Relación con Inversionistas,
  Recursos Humanos, Finanzas y Administración.
- Mapa:
  - Operaciones → Gestión de Activos
  - RH → Recursos Humanos
  - Finanzas → Finanzas y Administración
  - Gobierno Corporativo → Riesgos y Cumplimiento
  - Dirección → Relación con Inversionistas
- Se mueven:
  - a Inversiones y Portafolio: Alcance 3 total, Categoría 15-Inversiones e ingresos sostenibles;
  - a Riesgos y Cumplimiento: riesgos físicos, plan de transición y escenarios;
  - a Finanzas y Administración: efectos financieros;
  - a Relación con Inversionistas: Composición y Competencias del Consejo.

  La capacitación se queda en Recursos Humanos.

**Fase 2 · corrida contra staging** con el procedimiento de Rotoplas. Además de sus siete puntos:
- La vitrina de AINDA responde 404 y no deja fila de bitácora.
- El auditor entra, ve la matriz completa, descarga una evidencia y comenta. No puede subir ni validar.
- El JSON pasa de 124 a 133 cuentas, y el SHA de las 124 previas no cambia.
- `Accesos_Demos_TRACELINE_v10.xlsx` lleva la hoja AINDA (9 cuentas), y las 17 hojas previas quedan idénticas.
- Se hace el commit y se borra el log.

## 3. Qué toca y qué no

- **Toca:**
  - Fase 0: `tenants` (columna nueva), la carga de Cobertura (`lib/cobertura-datos.ts`), el slot del botón, la ruta
    de la vitrina, los tipos y el e2e.
  - Fase 1: el script de prospectos.
- **No toca:**
  - la franja de demostración ni el pie `[DEMO]` del Excel, que siguen dependiendo de `es_demo` a secas;
  - el formato del prefijo de folio (`^[A-Z]{3,4}$`). No se amplía por un mockup.
- **No se corre contra dev:** el script de prospectos, por `CLAUDE.md` §3. La Fase 1 se prueba en el stack local.

## 4. Definición de terminado

- **Fase 0:**
  - `e2e:vitrina`, `e2e:auditor` y `e2e:auditor:rutas` en verde en local;
  - `tsc`, `eslint` y `verify:export` en verde;
  - PR a `main` abierto y sin mezclar;
  - v31 desplegado según §5.1, con sus comprobaciones.
- **Fase 1:** la lectura (colisiones, reparto y escena) aprobada, y la corrida local con las seis áreas con entrega.
- **Fase 2:** los nueve puntos de §2, verdes en staging.

## 5. Entregables intermedios

- Fase 0: PR abierto. **Parada.** Esteban mezcla, migra y despliega.
- Fase 1: lectura (hecha el 01/10, ver §7) y corrida local. **Parada.**
- Fase 2: solo con el OK de Esteban.

### 5.1 Guion v31 · vitrina por tenant

**La migración va ANTES que el código.**
- El código nuevo pide `vitrina_habilitada` en el `select` de tenants. Sin la columna ese `select` falla y
  Cobertura se rompe para todos.
- El código de v30 ignora la columna, así que migrar primero no cambia nada hasta que llega el código.
- Con la columna puesta, el rollback del código también es limpio.

Todo lo ejecuta una persona, salvo las comprobaciones posteriores al release (`CLAUDE.md` §1). La URL de la base
se carga con `read -rs` y no se escribe en ningún archivo.

```sh
nvm use 22 && git checkout main && git pull --ff-only origin main && git rev-parse --short HEAD   # el merge del PR
heroku releases -a traceline-staging -n 1                      # v30: destino del rollback
read -rs STAGING_DB_URL && export STAGING_DB_URL
bash scripts/despliegue/migrar-remoto.sh staging               # 1 pendiente: 20261001140000_tenants_vitrina_habilitada.sql
bash scripts/despliegue/migrar-remoto.sh staging --aplicar     # 35 de 35 · barrera 69 (la migración no crea tablas)
bash scripts/despliegue/migrar-remoto.sh staging               # «staging al día y verificado»
/opt/homebrew/opt/postgresql@17/bin/psql "$STAGING_DB_URL" -X -A -t -c "select count(*) || ' tenants · vitrina encendida ' || count(*) filter (where vitrina_habilitada) from tenants"; unset STAGING_DB_URL   # 19 · 19
git push heroku main                                           # Released v31
heroku releases -a traceline-staging | head -3                 # v31 · Deploy <hash>
```

**Comprobaciones posteriores al release** (las puede correr Claude Code con `.env.staging.local` en subshell):
- los tres Excel contra los del v30 (`~/despliegue-rol-auditor/excel-v30-migrada`), con la fecha del pie
  normalizada si cambió el día;
- la vitrina de Banco Base, Word y PDF, que sigue encendida (`comprobar-vitrina.mjs`).

**Rollback:** `heroku releases:rollback v30 -a traceline-staging`. Es limpio: el código de v30 ignora la columna,
y la migración se queda.

## 6. Riesgos y dudas conocidas

- **Orden de migraciones entre `dev` y `main`.** `dev/ajustes-sep26` lleva 17 migraciones de septiembre
  (`20260910120000` a `20260921120000`), más antiguas que todo lo que ya está en staging (`20260929*`,
  `20261001*`). Además lleva `20261001130000_barrera_auditor_reparacion`, que también queda por debajo de esta
  migración (`20261001140000`).
  - Cuando `dev` se mezcle a `main`, `migrar-remoto.sh` las va a rechazar, porque corre sin `--include-all` a
    propósito.
  - Hay que resolverlo **antes de ese merge**: con un `--include-all` deliberado y revisado, o renumerándolas.
  - Hoy no se toca. Queda anotado también en la especificación §10.
- **Un mockup con auditor no se retira con el script.** `comentarios_auditor` y `auditor_actividad` son
  append-only, y sus llaves al tenant y al perfil son `on delete restrict`. Por eso `limpiar()` revisa las dos
  tablas **antes de borrar nada**: si hay registro de auditoría, aborta. Antes fallaba a la mitad, con los
  reportes y los archivos ya borrados y el tenant no. Una vez que el auditor de AINDA se use, `--rehacer` y
  `--limpiar` no van a poder con ese mockup. Retirarlo exige decidir qué pasa con ese registro, y esa decisión
  no la toma el script.
- **`ADMIN_PASSWORD` sin valor por defecto.** El script entraba con la contraseña del seed, que en staging dejó
  de servir con la rotación del v29. Ahora aborta si falta. En staging se toma de
  `.credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json`, dentro del subshell y sin imprimirla.
- **El nombre lleva «&».** La vitrina de AINDA está apagada, así que no entra en el Word. En el Excel y en los
  nombres de archivo hay que comprobar que no rompa nada en la corrida local.

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-10-01 | Lectura de la Fase 1: el prefijo `AINDA` no cabe en `tenants_prefijo_folio_formato` (`^[A-Z]{3,4}$`). En staging, ningún slug `ainda`, ningún prefijo `AIND`/`AINA` y ningún correo `@ainda.example`. El logo está en `logos-demo/ainda.png` | Prefijo **`AIND`**. No se amplía el CHECK por un mockup |
| 2026-10-01 | Reparto de AINDA sobre «Plantilla IAS NIIF S1/S2 (con rubros)» de staging, con 37 solicitudes: Inversiones y Portafolio 3, Gestión de Activos 20, Riesgos y Cumplimiento 3, Relación con Inversionistas 2, Recursos Humanos 5, Finanzas y Administración 4. Las seis áreas tienen alguna entrega de la escena, que queda en 12/9. El jefe va a Recursos Humanos, por el visto bueno de capacitación | Tabla de reparto aprobada |
| 2026-10-01 | Encargo propio, con el guion v31 | Las 17 migraciones de `dev` más antiguas que las de staging quedan como punto a resolver antes del merge de `dev` a `main` |
| 2026-10-01 | Fase 0 implementada. En local: la migración dos veces (35 de 35, todos los tenants con la vitrina encendida), tipos regenerados, `e2e:vitrina` 12 ✓, `e2e:auditor` 58 ✓, `e2e:auditor:rutas` 92 ✓ (el auditor sigue recibiendo 403 en la vitrina), `verify:export` verde, `tsc` limpio y `eslint` sin errores | **La migración va antes que el código**, no «en cualquier orden»: sin la columna, el `select` del código nuevo rompe Cobertura |
| 2026-10-01 | v31 desplegado (`d53ae68`). La migración la corrió Esteban antes del código: la columna estaba en staging, con 19 de 19 tenants con la vitrina encendida. Comprobaciones posteriores: los tres Excel idénticos a los del v30, la vitrina de Banco Base (Word y PDF desde el bucket) y Cobertura con 200 y sin errores de página, con el botón en Banco Base y sin él en Grupo Carso | — |
| 2026-10-01 | Fase 1. `main` mezclado en `dev` (`601b5d1`); en `page.tsx` conflictuó el slot, y la vitrina exige además `vitrina_habilitada`. Migración `20261001140000` aplicada al proyecto dev (53 de 53). Script: `vitrina: false` y `auditor: true`, entrada AINDA con `AIND`. Corrida local: tenant con la vitrina apagada y 9 cuentas (6 de área, jefe en Recursos Humanos, admin y auditor). El reparto quedó idéntico a la tabla aprobada (3 · 20 · 3 · 2 · 5 · 4) y la escena en 12/9. La segunda corrida no creó nada. Las 7 cuentas previas del JSON local mantienen su SHA | `limpiar()` gana una guarda: si el mockup tiene registro de auditoría (`comentarios_auditor` o `auditor_actividad`, que son append-only), aborta **antes de borrar nada**. Antes fallaba a la mitad. Una vez que el auditor de AINDA se use, `--rehacer` y `--limpiar` no van a poder con ese mockup |
| 2026-10-01 | Punto para la Fase 2 | El script entra como `admin@irstrat.example` con `ADMIN_PASSWORD`, que por defecto es la del seed, y en staging esa cuenta está rotada desde v29. En la corrida hay que pasar `ADMIN_PASSWORD` desde `.credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json`, sin imprimirla |
| 2026-10-01 | **Fase 2 en staging.** Corrida `--solo ainda` con barrera de ref, `ADMIN_PASSWORD` leída del JSON de staff dentro del subshell y log en un archivo 600. 9 cuentas nuevas sobre «Plantilla IAS NIIF S1/S2 (con rubros)»: 37 solicitudes, escena 12/9, jefe en Recursos Humanos. JSON de 124 a 133 cuentas, con el SHA-256 de las 124 previas sin cambios (`f957d091…`). Vitrina de AINDA: 404 en Word y PDF para el staff y para el admin de AINDA, ninguna fila de bitácora (0 → 0) y Cobertura sin el botón. Auditor, probado contra la API y no por botón: entra al panel; ve la matriz completa (37 de 37); descarga una evidencia (307 a la firma, 1562 bytes); deja un comentario, que queda a su nombre. No puede insertar evidencias, subir a storage, validar (UPDATE de una solicitud en revisión: 0 filas, el estado sigue en `en_revision`), borrar una evidencia ni borrar su comentario. `Accesos_Demos_TRACELINE_v10.xlsx` en `~/Downloads` y `referencia/`, con permisos 600 y 18 hojas. Las 17 previas no difieren en ninguna celda de la v9 de `~/Downloads`; la v9 de `referencia/` difiere de esa en una sola celda, Rotoplas A3, que es el correo con y sin vínculo, no una contraseña. AINDA lleva 9 cuentas, 9 de 9 contraseñas iguales al JSON, y el auditor como «Auditor externo». Las 124 contraseñas de la v9 coinciden con el JSON | El extractor de lista blanca ahora reconoce el rol `auditor` en el log (antes contaba 8 de 9) |
| 2026-10-01 | **Incidente: contraseñas expuestas. Riesgo aceptado.** Hacia las 23:23 (hora de Ciudad de México), Claude Code inspeccionó la estructura de `Accesos_Demos_TRACELINE_v9.xlsx` imprimiendo los valores de la columna 2, que dio por hecho que era el rol. Era la contraseña, porque la fila 1 es un título combinado y los encabezados están en la fila 2. **Alcance:** unas 5 contraseñas por hoja en las 17 hojas, cerca de 85 cuentas de los mockups de prospecto en staging. Salieron dos veces, una por cada copia de la v9. La salida quedó en la terminal local de Esteban y en la transcripción de la sesión de Claude Code. No se expusieron las cuentas de AINDA, las del seed ni ninguna llave; las cuentas expuestas solo dan acceso a tenants de demostración con datos ilustrativos. **Causa:** adivinar qué era cada columna e imprimir valores de muestra en lugar de solo encabezados y conteos | **No se rota por ahora, por decisión de Esteban,** custodio de las credenciales: hay prospectos usando los mockups en este momento y rotar interrumpiría pruebas en curso. Es una excepción a `CLAUDE.md` §6 («se rota. No se discute»), autorizada por Esteban el 01/10/2026. **Se rotará en la próxima ventana sin pruebas activas**: cambio de contraseña por la API de admin, sin `--rehacer`, y un Excel de accesos nuevo. Se añade a `CLAUDE.md` §6 la regla de inspección: de un archivo con credenciales solo se imprimen encabezados y conteos |
| 2026-10-01 | Alcance de la rotación pendiente | Se rotan **las 124 cuentas de los 17 mockups**, no solo las ~85 que salieron en pantalla: separarlas obligaría a volver a leer esa salida, y una rotación completa es más fácil de explicar a los prospectos. Las 9 de AINDA no entran, porque no se expusieron. El cambio se hace por la API de admin (`updateUserById`), **sin `--rehacer`**, para conservar los tenants, la escena y las evidencias; el cambio de contraseña cierra solo las sesiones abiertas. Después: `Accesos_Demos_TRACELINE_v12.xlsx` desde el JSON (la v11 la tomó el mockup PINFRA el 6/10), con las 18 hojas y las contraseñas comparadas en código carácter por carácter, sin imprimir valores (`CLAUDE.md` §6). Se hace en la próxima ventana sin pruebas activas |
