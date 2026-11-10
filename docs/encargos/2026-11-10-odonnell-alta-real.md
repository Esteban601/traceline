# Encargo: O'Donnell, alta como cliente real y carga de 2025

Versión 1 · 10 de noviembre de 2026. O'Donnell deja de ser mockup (slug `odonnell`, prefijo `ODN`) y pasa a cliente
real. Además pide cargar su información de 2025, para tener comparativos en el ejercicio siguiente. Este documento
contiene solo el Paso 0, de lectura: no se tocó código ni datos.

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/odonnell-alta-real` desde `dev/ajustes-sep26` (`49e55c7`). Se integra por PR (`CLAUDE.md` §2).
**Fecha de inicio:** 10 de noviembre de 2026 · **Entrega:** por fases con parada, después de las decisiones de §5.
**Referencia:** `CLAUDE.md` v1.13 §1, §3, §5, §6 y §8; especificación v0.50 §1, §3.1 y §10; README («Import de un
cliente real: GCARSO» e «Histórico: el comparativo 2024»); encargo `2026-09-29-rol-auditor` (plan de conversión de
CLEPSA).

**Contexto que condiciona todo:**
- El alta y la carga ocurren en **staging**, que escriben solo personas (CLAUDE.md §1). Claude Code prepara
  guiones, scripts y verificaciones; no escribe ahí.
- `feat/catalogo-gri-sasb` sigue abierta y no se mezcla aquí, pero pesa en el alta: el Perfil pide el sector SASB, y la
  industria de O'Donnell quedó por confirmar en ese encargo (§0.6, decisión 9).

---

## 0. Paso 0 (lectura, sin cambios)

### 0.1 Alta: tenant real frente al mockup ODN

**Cómo es hoy el mockup** (`scripts/crear-demo-prospecto.mjs`, entrada `odonnell`):

| Qué | Mockup ODN |
|---|---|
| `slug` / `prefijo_folio` | `odonnell` / `ODN`. Los dos son UNIQUE en `tenants` |
| `es_demo` | `true`: franja «Entorno de demostración», marca [DEMO] en los entregables, vitrina posible. Solo el rol `admin` lo cambia (`trg_tenant_es_demo`) |
| Banderas | `vitrina_habilitada` encendida, `lectura_evidencias_activa` encendida, `generador_activo` encendido, `staff_puede_cargar` apagada; topes por omisión (10 generaciones y 500 lecturas al mes) |
| Áreas | Cinco: Desarrollo y Construcción, Operación de Parques, Comercialización, Capital Humano, Administración y Finanzas; las solicitudes de la plantilla se reparten con su `mapa`/`mueve` |
| Reporte | Clonado de «Plantilla IAS NIIF S1/S2 (con rubros)», 37 solicitudes, con escena ficticia (estados, evidencias y capturas ilustrativas) |
| Usuarios | Cuentas `@…example` del Excel de accesos (contraseñas en `.credenciales-demo/prospectos-<ref>.json`), con jefe de área y auditor de muestra |
| Perfil | El que siembra el script para la vitrina (ilustrativo) |

**Qué cambia en un tenant real** (alta por el panel, `app/admin/clientes/actions.ts` → `crearCliente`):

| Qué | Tenant real |
|---|---|
| `es_demo` | `false` (default). Sin franja ni [DEMO]. La vitrina responde 403 aunque la bandera esté encendida (`suplemento-demo/route.ts` exige `es_demo`) |
| `vitrina_habilitada` | **Nace `true` por default de columna.** Es inofensivo por el 403, pero la regla de la especificación (§10: «`vitrina_habilitada = false` donde `es_demo = false`», se verifica por consulta) pide apagarla al dar el alta |
| `generador_activo` / `lectura_evidencias_activa` | Nacen **apagadas**. Encenderlas manda datos del cliente a la API de Anthropic: la especificación (§1, «Estado de los tenants») exige un contrato que lo cubra, como con Carso. Es la decisión 3 |
| `staff_puede_cargar` | Nace apagada; «carga por IRStrat» se enciende si la firma sube evidencia en nombre de las áreas (vía B de §0.3) |
| Topes | 10 generaciones y 500 lecturas al mes, por omisión; se ajustan en `/admin/clientes` |
| `slug` y prefijo | **`odonnell` y `ODN` están tomados por el mockup.** O el real usa otros (p. ej. `odonnell-sa` / `ODNL`), o al mockup se le cambian antes (es un UPDATE de datos; `crear-demo-prospecto` busca por slug y su entrada tendría que cambiar igual). Es la decisión 2 |
| Áreas | Las reales, en el alta (obligatorio al menos una). Las cinco del mockup son una propuesta para validar con el cliente |
| Usuarios | Cuentas con correo real, dadas de alta desde `/admin/usuarios` (`crearUsuario`): liga de invitación o contraseña temporal con cambio forzado (`debe_cambiar_password`), como la cuenta de administración de Carso. **No van al Excel de accesos de mockups** |
| Reporte | Nuevo, desde la plantilla «con rubros» (`crearReporteDesdePlantilla`), **sin escena**: estados en «pendiente», sin evidencias ni capturas. Con `anio_adopcion` declarado (si no, el régimen sale «indeterminado» y el semáforo no evalúa) |
| Perfil | Se captura con datos reales: identidad, matriz, horizontes, carta, gobierno, materialidad y, con v44, «Efectos financieros» |

**Qué se conserva del mockup:**
- **Del mockup como tal:** sus solicitudes, bitácora y vitrina. Se desactiva, no se borra.
- **Lo que se reaprovecha:** el logo (`logos-demo/odonnell.png`, no versionado), la propuesta de áreas y el reparto de
  la plantilla por área (`mapa`/`mueve`), como referencia para asignar las solicitudes del reporte real.
- **Lo que no se reaprovecha:** ninguna cifra, texto ni evidencia del mockup. Son ilustrativos.

**Cómo se desactiva sin borrar:**
- `/admin/clientes` → `cambiarActivoTenant`, que pone `tenants.activo = false` y deja «tenant_desactivado» en la
  bitácora.
- El middleware y los layouts sacan a cualquier cuenta de un tenant inactivo (`cliente_inactivo`): las cuentas del
  mockup dejan de entrar sin tocarlas.
- La hoja ODN del Excel de accesos se marca como retirada; las contraseñas del mockup no se regeneran.

**CLEPSA:** el plan de su conversión está escrito en el encargo `rol-auditor`, en sus §3 y §6:
- tenant nuevo con `es_demo = false`;
- áreas y usuarios reales con cambio de contraseña forzado;
- sin solicitudes ficticias;
- mockup desactivado y no borrado;
- la credencial de Deloitte recreada sobre el tenant real;
- la hoja CLEPSA del Excel de accesos marcada como retirada.

**No hay registro de que se haya ejecutado.** La especificación sigue diciendo que la única emisora real es Carso
(«Estado de los tenants», 6 de octubre de 2026), y los despliegues siguen usando a CLEPSA como mockup en sus líneas
base. Lo que «hizo falta» es, entonces, el mismo plan. O'Donnell sería la **primera alta real hecha con este
procedimiento**. Carso entró por import (`import-gcarso.mjs`), no por alta.

### 0.2 Comparativos: de dónde salen hoy y qué falta (A9)

**De dónde salen hoy.** Todo el dato de un entregable se acota por **reporte** (`lib/reporte/ensamblar.ts`: «las ocho
consultas van en paralelo y todas se acotan por `reporte_id`»).
- **Excel de taxonomía, celdas de cifra GEI:** cada celda de `mapeo_export` declara `anio_offset` (0 = el ejercicio,
  1 = el comparativo). El valor es la última captura confirmada **con `periodo` = ejercicio − offset** de la solicitud
  validada **de ese mismo reporte** que lleva el rubro. Con C3 vigente (primer año), la columna del año anterior dice
  «No revelado · alivio C3».
- **Excel, hojas de registros de clima** (`NIIF S2 29(b)/(c)/(d)`): columnas `v2025`/`v2024`, que son posiciones de la
  plantilla. Se llenan con los valores del registro por ejercicio (`registros_clima_valores`) de los registros **de
  ese reporte**.
- **Formato electrónico:** no tiene columna comparativa por cifra. Diez filas son «regla primer año» (186, 188, 190,
  192, 295, 297, 299, 582, 584 y 587 de la plantilla): el primer año dicen «No aplica» o la regla. **En un año
  subsecuente quedan «por decidir»** (`llenar.ts`): no está hecho.
- **Suplemento:** el régimen se resuelve con `reportes.anio_adopcion` (`regimenDe`: primer año o subsecuentes). La
  especificación §3.1 define qué cambia en subsecuentes:
  - el bloque 3 se reduce;
  - los bloques 29, 34–36 y 38–40 llevan comparativo;
  - el Alcance 3 es obligatorio;
  - sin E5 entran los datapoints S1 de los bloques 6, 7 y 10.

  En el generador solo está la estructura. La prueba es **A9** («segundo reporte del tenant demo con ejercicio
  anterior»), pendiente en la cola.

**Carso ya tiene comparativos, sin A9:** `import-gcarso-historico.mjs` sumó **a las solicitudes del reporte 2025**
capturas con su periodo real (2024, 2023), cada una con su cita. Es decir: hoy el comparativo funciona si las cifras
del año anterior están **en el mismo reporte**.

**¿Pueden coexistir un reporte 2025 y uno 2026 del mismo tenant?** Sí: `reportes` no tiene unicidad por
(tenant, ejercicio), y Cobertura, el semáforo y las exportaciones eligen reporte. Comparten los topes mensuales del
tenant (las generaciones cuentan por emisora y mes).

**Qué los vincula: nada.**
- No hay `reporte_anterior` ni correspondencia entre solicitudes de un año y otro.
- `crearReporteDesdePlantilla` clona la plantilla, no el reporte anterior.
- Los registros de clima y los objetivos también son por reporte.

**Qué falta para que el 2026 lea cifras del 2025** (A9; estimado aparte, §0.5):
1. **Vínculo.** `reportes.reporte_anterior_id` y, al crear el 2026 desde el 2025, la correspondencia de cada
   solicitud: por `rubro_taxonomia` (único por reporte), por datapoint y por título. Los registros de clima por nombre,
   los objetivos por nombre. Migración aditiva.
2. **Ensamblador y Excel.** Una celda con `anio_offset = 1` sin captura de ese periodo en el reporte toma la última
   captura confirmada de la solicitud correspondiente del reporte anterior, validada. Lo mismo para los valores de
   registros. La nota dice de dónde salió.
3. **Formato:** las diez filas «regla primer año» en régimen subsecuente, y sus comparativos.
4. **Generador:** las variantes subsecuentes de §3.1: bloque 3, comparativos en 29, 34–36 y 38–40, Alcance 3 por
   categoría, y los S1 si E5 deja de aplicar. Es lo más grande.
5. **Prueba A9** con un segundo reporte del demo. Es una corrida completa: ~12 USD (CLAUDE.md §5).

**Alternativa sin A9** (la de Carso): crear el reporte 2026 cuando toque y cargar ahí las cifras de 2025 como
capturas con `periodo = 2025`. El Excel ya las pinta en la columna comparativa. No lo resuelve para el suplemento ni
para el Formato, y duplica en 2026 lo cargado en 2025.

### 0.3 Carga de 2025: vías

**Supuesto, por confirmar:** O'Donnell adopta NIIF S1/S2 en 2025, así que su reporte 2025 es de primer año (con C3,
sin comparativo). La carga de 2025 es, entonces, **su reporte 2025 completo**, que en 2026 será el «anterior».

| Vía | Cómo | Evidencia | Bitácora | Cuándo conviene |
|---|---|---|---|---|
| **A. Áreas del cliente** (portal) | Cada área sube sus documentos y captura; IRStrat revisa y valida | Archivo subido por el usuario del área, versionado | `evidencia_creada` y capturas a nombre del usuario real; validación a nombre del staff | Proceso del año en curso. Para 2025, que ya cerró, es lento: pide a las áreas reconstruir lo que ya entregaron |
| **B. Panel de IRStrat, con lectura** («carga por IRStrat» encendida) | La firma sube lo que O'Donnell mande (informe anual 2025, inventario GEI, políticas) en la solicitud que corresponde; con la lectura encendida, la plataforma sugiere la cifra o el extracto y una persona confirma | Archivo subido por el staff **en nombre del área**, marcado así en la solicitud | Subida y confirmación a nombre del staff, con el área declarada; la sugerencia guarda su cita (página o celda) | **Recomendada**, si hay contrato para la lectura (decisión 3). Sin lectura, igual, pero la captura se transcribe a mano |
| **C. Importación masiva** (script, como `import-gcarso`) | Un script lee un libro estructurado que O'Donnell o IRStrat arman, con una hoja de mapeo como especificación, y crea capturas y evidencias con su cita; idempotente | Recortes de PDF por solicitud, con su cita de páginas | Eventos con la sesión del staff que corre el script; las capturas llevan su cita en `justificacion` | Solo si llegan muchas cifras ya tabuladas (más de ~60) o hay series de varios años. Cuesta escribir un script por cliente |

**Recomendación: la vía B.**
- Reporte 2025 desde la plantilla «con rubros», «carga por IRStrat» encendida y, si el contrato lo permite, la lectura
  encendida.
- Con todas las vías aplica la regla de Carso: **el año es el año**. Ninguna cifra de otro periodo se «estira» a 2025,
  y lo que no venga queda como hueco declarado.
- La vía C solo si O'Donnell entrega un libro de cifras grande.

### 0.4 Lo que cambia por ser cliente real

- **Cobertura y entregables:**
  - sin franja ni [DEMO]: el título del Excel de taxonomía y del libro GRI/SASB no lleva la marca, y el banner no sale;
  - vitrina negada;
  - Cobertura igual que para cualquier emisora.
- **Correos:**
  - las cuentas con correo real **sí reciben** avisos y resumen diario (las de dominio reservado se omitían);
  - el staff recibe los avisos y el resumen de una emisora real (`es_demo = false`), que con un mockup no recibe;
  - antes de dar de alta, conviene confirmar quién recibe qué (`recibe_resumen_diario`).
- **Tope de generaciones:** 10 corridas completas al mes (`generaciones_mes_max`), compartidas por sus reportes.
  Regenerar un bloque no cuenta.
- **Costo de referencia:**
  - una corrida completa del demo: **12.18 USD** (38 bloques, más la coherencia; CLAUDE.md §5);
  - respuestas de un documento aprobado: ~0.3–0.5 USD;
  - lectura de evidencias: por archivo, con su tope de 500 al mes.

  Todo eso solo con `generador_activo` y `lectura_evidencias_activa` encendidos, es decir, con contrato.
- **Seguridad pendiente:**
  - **MFA, en cola** desde el encargo `generador-a-produccion`, «hasta que un cliente lo pida». Con el primer cliente
    real que da de alta la firma, es la decisión 6;
  - contraseñas temporales con cambio forzado o invitación de 72 h;
  - el auditor de O'Donnell, si lo hay, se crea sobre el tenant real, no sobre el mockup;
  - las credenciales reales no van al Excel de accesos de mockups ni a `.credenciales-demo/`.

### 0.5 Estimación por partes

| Parte | Qué | Jornadas |
|---|---|---|
| 1. Alta | Guion del alta en staging, que ejecuta una persona: desactivar el mockup; alta con slug y prefijo; áreas; vitrina apagada; banderas según el contrato; usuarios con cambio forzado; reporte 2025 desde la plantilla con `anio_adopcion`; Perfil. Verificación de solo lectura (`comprobar` del alta, foto de Cobertura) y registro en la especificación §10. Sin migración | 0.75–1 |
| 2. Carga de 2025 (vía B) | Asignación de las solicitudes a las áreas reales; acompañamiento de la carga (lo hace la firma); revisión de huecos; Excel de taxonomía y Formato 2025 | 0.5 de plataforma, más la carga, que es trabajo de IRStrat y depende de lo que mande O'Donnell |
| 2'. Vía C (si se elige) | Hoja de mapeo y script de importación, con su prueba en local y dev | +1.5–2 |
| 3. Seguridad mínima del alta | Revisión de correos y destinatarios; checklist de cuentas reales | 0.25 |
| **Subtotal alta + carga** | | **~1.5–1.75** (o 3–3.75 con la vía C) |

**A9, años subsecuentes (aparte):**

| Parte | Qué | Jornadas |
|---|---|---|
| a. Vínculo entre reportes | `reportes.reporte_anterior_id` y correspondencia de solicitudes, registros y objetivos al crear el reporte siguiente (migración aditiva) | 0.75 |
| b. Ensamblador y Excel | Comparativo desde el reporte anterior, con su nota | 0.75–1 |
| c. Formato | Diez filas «regla primer año» en subsecuentes y comparativos | 0.75 |
| d. Generador en régimen subsecuente | §3.1: bloque 3, comparativos en 29, 34–36 y 38–40, Alcance 3 por categoría, S1 sin E5 (bloques 6, 7 y 10) | 3–5 |
| e. Prueba A9 en el demo | Segundo reporte con el 2025 como anterior; corrida completa ~12 USD | 1 |
| **Total A9** | | **~6.25–8.5** |

Solo para que el **Excel** de 2026 muestre 2025, bastan a y b (**~1.5–1.75**). El suplemento y el Formato
subsecuentes son el resto, y hacen falta hasta el reporte 2026, que se presenta en 2027.

---

## 5. Decisiones de Esteban (pendientes)

1. **Año de adopción:** ¿O'Donnell adopta en 2025 (reporte 2025 de primer año, con C3)? ¿Ya publicó su informe 2025,
   o el reporte 2025 se arma en la plataforma?
2. **Slug y prefijo del real:** ¿nuevos (p. ej. `odonnell-sa` / `ODNL`) o se liberan los del mockup antes del alta?
3. **Contrato:** ¿cubre mandar sus datos a la API de Anthropic? De eso dependen la lectura de evidencias (vía B con
   lectura) y el generador.
4. **Vía de carga:** B (mi recomendación), A o C.
5. **Comparativos:** ¿A9 completo, solo a+b (el Excel de 2026 con 2025), o la vía Carso (cargar 2025 dentro del 2026
   cuando toque)?
6. **MFA:** ¿sale de la cola con este cliente?
7. **Usuarios:** ¿invitación o contraseña temporal con cambio forzado? ¿Hay auditor externo desde el inicio?
8. **Sector SASB de O'Donnell** (encargo `catalogo-gri-sasb`, decisión 9): IF-RE, a confirmar.

## 6. Paradas

1. **Paso 0:** este documento. Parada para las decisiones de §5.
2. **Fase 1:** guion del alta y su verificación, sin ejecutar. Parada.
3. **Fase 2:** alta ejecutada por Esteban; verificación de solo lectura. Parada.
4. **Fase 3:** carga de 2025 por la vía elegida. Parada con el Excel y el Formato 2025.
5. **A9:** encargo aparte o fase posterior, según la decisión 5.

## 7. Registro

| Fecha | Qué | Resultado |
|---|---|---|
| 10/11/2026 | **Paso 0** (lectura). Alta real por el panel, con `es_demo = false`, vitrina a apagar a mano y banderas de generador y lectura apagadas hasta el contrato; slug y prefijo del mockup ocupados; mockup desactivado con `activo = false`. La conversión de CLEPSA quedó planeada en `rol-auditor`, sin registro de ejecución: O'Donnell sería la primera. Comparativos: hoy solo dentro del mismo reporte (vía Carso); dos reportes del mismo tenant conviven sin vínculo; A9 estimado en ~6.25–8.5 jornadas (solo el Excel: ~1.5–1.75). Carga 2025: vía B recomendada. Alta + carga: ~1.5–1.75 jornadas | **Parada:** decisiones de §5 |
