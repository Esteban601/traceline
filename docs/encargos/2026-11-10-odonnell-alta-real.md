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

### 0.6 Complemento (10/11/2026): lo que dice el informe 2025 de O'Donnell

Fuente: `~/Downloads/mapa-odonnell-2025.md`, que copió Esteban. Es un mapa del Formato electrónico publicado (ODOCK) y
del IAS 2025.

**Qué dice el informe:**
- **Es un fideicomiso:** CKD CIB2659, clave ODOCK. Fiduciario: Banco Multiva. Fideicomitente y administrador: O'Donnell
  Capital Management.
- **No adoptó E5:** reporta NIIF S1 completo.
- **Declara cumplimiento con reserva:** a NIIF S1 72 respondió «No», «preparado procurando el cumplimiento».
- **Adoptó en 2025 y publicó.** 2026 es su primer año subsecuente.
- **Objetivos con año base 2023,** sin meta numérica.
- **Industrias SASB publicadas:** IF-RE e IF-RS.

**Qué cambia en §0.1:**
- **La emisora:**
  - el bloque «Para: Fideicomisos» del Formato (K13–K21) aplica completo, con fiduciario, número de fideicomiso,
    fideicomitente y administrador del Perfil, que se usan por primera vez;
  - la forma de referencia de la emisora es otra (p. ej. «el Fideicomiso»): el generador y las respuestas solo se han
    probado con «la Compañía».
- **Decisiones de §5 que se resuelven:**
  - la 1: adopta en 2025 y publicó;
  - la 8: queda abierta entre IF-RS (lo que publicó) e IF-EN (lo que dijo Esteban).

### 0.7 Qué pasa hoy cuando el tenant NO tiene E5

Con E5 vigente, los 33 códigos de NIIF S1 que no tienen bloque (de 35; abajo) se responden «No aplica · E5», con la
remisión a su par de NIIF S2 (`respuestas.ts`). La oración del E5 va en los encabezados de pilar de S1, en el Excel
(`depurar.ts`) y en el Formato (`llenar.ts`, `ENCABEZADOS_E5`). Las filas de continuación de S1 llevan la remisión de
su fila madre (`continuaciones.ts`).

**Sin E5** (código leído, nunca ejercitado con un documento):

| Pieza | Qué hace hoy | Probado |
|---|---|---|
| Suplemento (40 bloques) | Solo hay bloques de clima. **Ninguna sección trata la sostenibilidad general de NIIF S1**: gobernanza (27), estrategia (30–35), gestión de riesgos (44), métricas y objetivos (46–51). La especificación §3.1 prevé ampliar los bloques 6, 7 y 10; no está hecho | No |
| Respuestas | Los **33 códigos de NIIF S1 sin bloque** (de 35: 9 de gobernanza, 13 de estrategia, 8 de riesgos y 3 de métricas) caen a captura, si una solicitud cuantitativa ligada está validada, o a **pendiente** («sin solicitud en el reporte ni sección del suplemento») | No |
| Bloque 3 | Lo dice bien: «no se acoge a ninguna de las medidas transitorias» (`frasesDeAlivios`) | Sí, por plantilla |
| Excel | Sin la oración del E5 en los encabezados. Las filas de continuación de S1 llevan la respuesta de S1, que hoy es pendiente. La hoja «NIIF S1 51» lleva **todos** los objetivos, no solo los de clima (`export-taxonomia`) | Solo la ausencia de la oración del E5 (`e2e-excel-alivios`, caso «sin alivios») |
| Formato | Sin E5 en los encabezados; la fila del alivio dice «No». Las 45 filas «revisión (S1→S2)» y las 17 de «correspondencia S1→S2» toman la respuesta del código S1: pendiente, vacías | No |
| Registros de clima | Sus tipos son de clima (riesgo físico, de transición, oportunidad). Un riesgo de sostenibilidad general, como el n.º 8 de O'Donnell (salud y seguridad de ocupantes), no tiene tipo | — |
| Semáforo | No evalúa los códigos de NIIF S1: no están en ningún bloque | — |

**Encargo «régimen sin E5»:**

| Parte | Qué | Jornadas |
|---|---|---|
| a | Secciones de sostenibilidad general de S1: ampliar 6, 7 y 10, o bloques nuevos para gobernanza, estrategia, riesgos y métricas no climáticos, con prompts, cobertura y completitud | 2.5–3.5 |
| b | Riesgos y oportunidades de sostenibilidad general: un tipo nuevo en registros (migración aditiva; `ADD VALUE` en migración propia si es enum) y su captura | 0.5–0.75 |
| c | Respuestas: los 33 códigos S1 a sus bloques; regla para S1 integrado con S2 cuando el mismo órgano o proceso cubre clima y lo demás | 0.75 |
| d | Excel y Formato sin E5: filas de continuación, las 45 + 17 de correspondencia, encabezados | 0.75–1 |
| e | Pruebas: e2e del régimen y una corrida completa sin E5, del demo con E5 apagado (~12 USD, con el tope) | 1 |
| **Total** | | **~5.5–7** |

### 0.8 NIIF S1 72 con reserva

**Hoy el generador siempre declara cumplimiento.**
- **Bloque 2:** es una plantilla, sin modelo, que dice «preparada **de conformidad con** las Normas NIIF S1 y NIIF S2».
- **Respuesta de NIIF S1 72:** toma ese párrafo (`declaracionDeCumplimiento`), con el alcance del E5 y del E4.
- **Formato, fila 285:** lleva el mismo párrafo.
- **Formato, fila 286** («¿cumple con todos los requerimientos…?»): «Sí» solo con cero pendientes y cero requisitos
  «parcial» en la cobertura aprobada; si no, «No. Falta completar…».

**Con O'Donnell** saldría una declaración de conformidad que la emisora no hace. Es una afirmación falsa y choca con
CLAUDE.md §5: cero dato inventado.

**Hoy ya hay una incoherencia, aun sin reserva:** con pendientes o parciales, la fila 286 dice «No» mientras la 285 y
el bloque 2 afirman conformidad.

**Qué falta:**
1. En el reporte o el Perfil, la declaración de la emisora: sin reserva o con reserva, y el texto de la reserva
   (migración aditiva).
2. Bloque 2 con dos ramas: con reserva, «preparada procurando el cumplimiento…», con la razón.
3. NIIF S1 72 y la fila 285, desde esa declaración.
4. Fila 286: «No» si la emisora declara con reserva, aunque no haya pendientes.
5. La regla de coherencia: una declaración sin reserva con pendientes o parciales es un aviso del validador, no un «Sí»
   escondido.
6. e2e de las cuatro combinaciones.

**~1–1.5 jornadas.**

### 0.9 Año base 2023 en los objetivos

**Hoy:** `objetivos` guarda `periodo_base` (texto) y `meta` (texto), por reporte. **No hay campo para el valor del año
base ni para el avance.** Las hojas «NIIF S2 34/35» llevan el periodo base como texto y el avance (35) sale de
`objetivos_detalle.resultados`, en narrativa. Sin meta numérica, 33(f) y la meta en el nombre quedan vacíos, que es lo
correcto: no se inventan.

**Para el comparativo:**
- El Excel solo conoce `anio_offset` 0 y 1. 2023 no es columna en 2025 (offset 2) ni en 2026 (offset 3): el año base
  no entra por ahí.
- Si O'Donnell da sus valores de 2023 (EDGE, agua, cobertura de GEI), se cargan como capturas con `periodo = 2023` en
  las solicitudes de esas métricas: «el año es el año», como en Carso. Sirven de evidencia del avance y de fuente del
  libro de hechos.

**Para A9:**
- Los objetivos son por reporte. En 2026 hay que **continuar** el mismo objetivo, con su base 2023, no recapturarlo:
  vínculo `objetivo_anterior_id` al crear el reporte siguiente.
- Para que el avance sea comparable año contra año hacen falta el valor base y el valor del periodo: dos columnas
  numéricas en `objetivos`, o la liga objetivo ↔ solicitud de su métrica.
- Suma **~0.75–1 jornada** a A9.

### 0.10 Catálogo SASB para O'Donnell

Hoy el catálogo solo tiene FN-CB, y en `feat/catalogo-gri-sasb`, sin mezclar ni desplegar. Contadas en los PDF de
`normas/_fuentes/`:

| Industria | Versión | Métricas | Lo que publicó O'Donnell |
|---|---|---|---|
| **IF-RE** Real Estate | **2023-06** (las demás son 2023-12) | 18: 14 contables (130a energía, 140a agua, 410a gestión de impactos de inquilinos, 450a adaptación al clima) y 4 de actividad | 130a.1, 130a.2, 130a.4, 130a.5 y 140a.1 |
| **IF-RS** Real Estate Services | 2023-12 | 11: 6 contables (410a, 510a) y 5 de actividad | 410a.1–410a.3 (en cero) |
| **IF-EN** Engineering & Construction Services | 2023-12 | 16 | — |

**Qué falta:**
- **El generador SASB:** está escrito para FN-CB, con el prefijo y la tabla 2 a la medida. Hay que generalizarlo a
  cualquier industria (prefijo y versión por parámetro), con su comprobación de conteo.
- **Una migración de datos** con IF-RE y la segunda industria, más sus filas en `auditoria-catalogo.md`.
- **`FUENTE_GRI_SASB` para IF-RE:**
  - 450a (adaptación) → bloques 21 y 35;
  - 130a (energía) → bloques 29 y 32;
  - 140a (agua) → sin bloque mientras no haya S1 general (§0.7).
- **El sector del Perfil** con las dos etiquetas del Formato.
- **La hoja «Métricas SASB» y el libro** ya sirven para cualquier industria.

**~1.25–1.5 jornadas**, después de mezclar `catalogo-gri-sasb` y desplegar v45.

**Aparte:** el IAS de O'Donnell tiene índice GRI. El libro GRI/SASB le servirá completo con el nivel medio de GRI.

### 0.11 Estimación reordenada antes del primer documento 2026

**Clave:** la carga de 2025 es **solo de datos**. O'Donnell ya publicó su 2025, así que no se genera ningún documento
2025 en la plataforma. Por eso el régimen sin E5 y la reserva de S1 72 no bloquean la carga: hacen falta para el
documento 2026.

| Orden | Pieza | Jornadas | Depende de |
|---|---|---|---|
| 0 | `catalogo-gri-sasb` mezclado y v45 en staging (en curso) | — | — |
| 1 | **Alta real** (§0.1), con Perfil de fideicomiso, alivios en el reporte (sin E5) y declaración con reserva **como dato** | 0.75–1 | Decisiones de §5 |
| 2 | **Catálogo IF-RE + segunda industria** (§0.10) | 1.25–1.5 | 0 |
| 3 | **Carga 2025** por la vía B, con las cifras del mapa, los 9 registros, los 3 objetivos con base 2023 y sus valores 2023 si los da | 0.5 de plataforma, más la carga de IRStrat | 1, 2 |
| 4 | **S1 72 con reserva** (§0.8) | 1–1.5 | — |
| 5 | **A9** (§0.2) con continuidad de objetivos y año base (§0.9) | 7–9.5 | 3 |
| 6 | **Régimen sin E5** (§0.7) | 5.5–7 | — (se prueba con 5) |
| 7 | **Primer documento 2026** de O'Donnell: corrida completa (~12 USD), revisión y entregables | 1 + revisión | 4, 5, 6 y contrato (decisión 3) |
| **Total hasta el primer documento 2026** | | **~17–22** | |

Las piezas 4, 5 y 6 pueden ir en paralelo a la carga, en ramas distintas: tocan el generador, el ensamblador y las
exportaciones. Para no chocar, 4 va antes que 6, porque las dos tocan el bloque 2 y S1 72. El documento 2026 se
presenta en 2027, así que hay margen.

---

## 5. Decisiones de Esteban (pendientes)

1. ~~Año de adopción~~ Resuelta por el complemento: adoptó en 2025 y publicó (§0.6). Queda: ¿usó C3 en 2025?
2. **Slug y prefijo del real:** ¿nuevos (p. ej. `odonnell-sa` / `ODNL`) o se liberan los del mockup antes del alta?
3. **Contrato:** ¿cubre mandar sus datos a la API de Anthropic? De eso dependen la lectura de evidencias (vía B con
   lectura) y el generador.
4. **Vía de carga:** B (mi recomendación), A o C.
5. **Comparativos:** ¿A9 completo, solo a+b (el Excel de 2026 con 2025), o la vía Carso (cargar 2025 dentro del 2026
   cuando toque)?
6. **MFA:** ¿sale de la cola con este cliente?
7. **Usuarios:** ¿invitación o contraseña temporal con cambio forzado? ¿Hay auditor externo desde el inicio?
8. **Segunda industria SASB:** IF-RS (lo publicado) o IF-EN (lo que dijo Esteban); IF-RE confirmada (§0.10).
9. **Régimen sin E5:** ¿encargo propio antes de A9, o en paralelo (§0.11)?
10. **S1 72 con reserva:** ¿dónde vive la declaración, en el reporte o en el Perfil? ¿Quién escribe el texto de la
    reserva? (§0.8)
11. **Año base 2023:** ¿O'Donnell entrega sus valores 2023 para los tres objetivos? ¿El avance se guarda como columnas
    numéricas en `objetivos` o con la liga a la solicitud de su métrica? (§0.9)
12. **Forma de referencia** del fideicomiso («el Fideicomiso», «ODOCK»…), para el glosario del Perfil.

### 5.1 Decisiones del complemento (Esteban, 10/11/2026)

1. **C3:** no se invocó en 2025 (el Formato publicado no lo menciona). 2026 lleva comparativo.
2. **Slug y prefijo:** el real toma `odonnell` / `ODN`; el mockup pasa a `odonnell-demo` / `ODND` y se desactiva con
   `activo = false`, sin borrar. **El contrato cubre** el envío de datos a la API de Anthropic: lectura y generador
   encendidos.
3. **Segunda industria SASB: IF-EN.** El IAS 2025 dice IF-EN y el Formato BMV 2025 publicó IF-RS con métricas en cero.
   **Discrepancia a señalar a O'Donnell antes del Formato 2026** (registrada aquí y en la lista de datos del alta).
4. **Orden:** S1 72 con reserva primero; el régimen sin E5 en rama propia, en paralelo con A9.
5. **La declaración de cumplimiento,** con o sin reserva, vive en el reporte. Su texto lo escribe la emisora; para 2025
   es el de la p. 41 del Formato publicado («preparado procurando el cumplimiento…»). El generador nunca la redacta.
6. **Avance de objetivos:** con liga a su solicitud. Los valores de 2023, si O'Donnell los entrega, se cargan como
   cifras con su año real.
7. **Forma de referencia «la Emisora».** Un campo del Perfil, con «la Compañía» por defecto, que lean el prompt y el
   validador de voz; entra en el alta.

### 5.2 Estado de staging antes de la Fase 1 (10/11/2026)

- **Staging en v43.**
- **v44 sin desplegar:** sección «Efectos financieros»; runbook listo y PR #50 en `main`.
- **v45 aún no existe:** `catalogo-gri-sasb` sin mezclar.
- **Lo que el alta ya tiene:** los campos de fideicomiso (v42), la forma de referencia y el sector SASB.
- **El orden:**
  - el alta va **después de v44**, porque `comprobar-v44.mjs` espera 22 emisoras y el alta deja 23;
  - «Efectos financieros» se llena en la carga.

### 5.3 Hallazgos de la Fase 1

1. **El Formato no reconoce un CKD como fideicomiso.**
   - `llenar.ts` decide el bloque «Para: Fideicomisos» (K13–K21) y el fiduciario con `/fideicomiso/i` sobre
     `tipo_instrumento`.
   - La opción del Formato para ODOCK es «Certificados Bursátiles Fiduciarios de Desarrollo (CKD)», sin esa palabra,
     así que saldría «No aplica».
   - Lo mismo pasaría con CERPI, FIBRA y FIBRAE.
   - Corrección: reconocer las opciones fiduciarias de la lista. Va con la pieza 4 (~0.25 jornada).
   - El guion lo avisa en `verificar`.
2. **«Forma de referencia»: el campo ya existe** (`perfil_emisor.forma_de_referencia`, sección Identidad), sin
   default.
   - **Lo leen:** el prompt de los bloques (con «la Emisora» si falta), las plantillas y la coherencia.
   - **No lo leen:** el sistema de respuestas («la Compañía»), los textos fijos de reglas («No aplica… a la Compañía»,
     36(c)), las oraciones de alivios (E5, E4, C3/C4) y los enfoques del Formato. Con «la Emisora» saldrían mezcladas.
   - Falta:
     - el default «la Compañía» en la lectura;
     - pasar la forma a esos textos y al sistema de respuestas;
     - que el validador de voz acepte la forma del Perfil.
   - **~0.75–1 jornada.** Va con la pieza 4, antes del documento 2026. El alta ya la escribe: «la Emisora».
3. **El mockup en `crear-demo-prospecto.mjs`** queda como `retirado`: no se toca ni con `--solo`. Así no hay que
   cambiar su slug en el script, que regeneraría contraseñas. `e2e-demo-prospectos.mjs` lo saca de su lista; CADU e
   Inmobilia siguen cubriendo el cruce de áreas homónimas.

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
| 10/11/2026 | **Complemento del Paso 0** (lectura), con el mapa del informe 2025 de O'Donnell | Fideicomiso CKD (ODOCK), sin E5, S1 72 con reserva, base 2023 e industrias IF-RE e IF-RS. **Sin E5:** 33 de 35 códigos S1 sin sección; respuestas pendientes; Excel y Formato sin probar; registros sin tipo para riesgos no climáticos; encargo «régimen sin E5» de ~5.5–7 jornadas. **S1 72:** el bloque 2 siempre afirma conformidad; la fila 286 ya puede decir «No» y se contradice con la 285; la reserva necesita dato y ramas (~1–1.5). **Año base 2023:** sin campo de valor base ni de avance; offset 2–3 fuera del Excel; A9 necesita continuidad de objetivos (+0.75–1). **Catálogo:** IF-RE 18 métricas (versión 2023-06), IF-RS 11, IF-EN 16; generalizar el generador SASB (~1.25–1.5). **Hasta el primer documento 2026:** ~17–22 jornadas; la carga de 2025 es solo de datos y no espera al generador | **Parada:** decisiones de §5 |
| 10/11/2026 | **Decisiones del complemento** (§5.1) y **Fase 1**: guion del alta, parada | **Guion** `scripts/alta/alta-cliente-real.mjs`, genérico (sirve para CLEPSA). Pasos `tenant` / `reportes` / `verificar`, cada uno con revisar y `--aplicar` (confirmación del ref). Sesión de staff del seed con RLS; bitácora con los eventos del panel; idempotente. Datos fuera del repo (`~/Downloads/odonnell-alta/datos.json`, 600, con «CONFIRMAR» donde falta un dato: el guion no corre mientras quede alguno). Usuarios por invitación desde el panel, entre `tenant` y `reportes`. **Comandos** en `~/Downloads/odonnell-alta/comandos.md` (T1–T3, P, R1–R2, V) y la lista de datos a tener a mano. **Prueba en el stack local** con un mockup `odonnell` de prueba: mockup a `odonnell-demo` / `ODND` inactivo, conservando su reporte; tenant real con banderas, 4 áreas y 10 campos del Perfil; reporte 2025 con 37 solicitudes en «pendiente», sin fecha ni evidencias, responsables por área, y 2026 vacío; segunda pasada de cada paso sin cambios; `verificar` todo en verde; sin usuarios, `reportes` se detiene. Local limpio después (0 tenants `odonnell*`, 0 usuarios de prueba, 0 filas de bitácora). **Error propio:** la primera versión buscaba el mockup por el slug original, que después del alta es del real, y la segunda pasada se detenía; corregido (por el slug nuevo, o por el original solo si es de demostración). **Hallazgos** en §5.3: el Formato no reconoce un CKD como fideicomiso; la forma de referencia existe pero las respuestas y los textos fijos dicen «la Compañía»; el mockup queda `retirado` en `crear-demo-prospecto` y fuera de `e2e-demo-prospectos` | **Parada:** revisión del guion |

