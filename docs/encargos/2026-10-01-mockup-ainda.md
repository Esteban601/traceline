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
