# Encargo: catálogo IBSO (NIS A-1 del CINIF) como cuarto marco

Versión 1 · 17 de noviembre de 2026. Este documento contiene solo el **Paso 0**, de lectura: no se tocó código ni datos.

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/catalogo-ibso` desde `dev/ajustes-sep26` (`9838e50`). Se integra por PR (`CLAUDE.md` §2).
**Fecha de inicio:** 17 de noviembre de 2026 · **Entrega:** Fase 1 tras el OK de este Paso 0; parada con el SQL antes
de dev.
**Referencia:** `CLAUDE.md` §3, §4 y §5; encargo `2026-10-31-catalogo-gri-sasb` (v45), que este reutiliza.

**Fuentes:**
- **Catálogo:** `scripts/catalogo/datos/ibso-nis-a1.tsv`, redacción de IRStrat (hoy sin versionar), con 30 filas y 5
  columnas: clave, nombre, pilar ASG (16 A, 6 S y 8 G), cómo se mide y qué recopilar.
- **Norma de referencia:** NIS 2024 del CINIF, en
  `normas/_fuentes/International Standards/SASB Standards/Estandares ASG/NIS 2024.pdf` (189 páginas). No está en la
  ruta que dice el encargo, sino en la subcarpeta de SASB. Las 30 claves del TSV aparecen en ella. Su texto no se
  reproduce: se cita por clave.

## 0. Paso 0 (lectura)

### 0.1 IBSO como cuarto marco: qué hace falta

v45 dejó casi todo: `marco` es un CHECK de texto (no un enum), y las columnas `estandar`, `edicion` y `pagina_origen`
ya existen, con el CHECK `datapoints_edicion_chk`. Para IBSO:

| Pieza | Qué | Cómo |
|---|---|---|
| Marco | `'NIS'` | CHECK `datapoints_marco_chk` sustituido por uno más amplio (NIIF, GRI, SASB, NIS) |
| Estándar y edición | «NIS A-1», «2024» | Columnas de v45; cumple `datapoints_edicion_chk` |
| Código | `IBSO A.1` … `IBSO C.8` | Con el prefijo para no chocar con nada del catálogo; clave verbatim del TSV |
| Nombre | «Emisiones GEI: alcance 1»… | **Columna nueva** `nombre` (nullable). Hoy el catálogo no tiene nombre: GRI y SASB lo llevan dentro de `descripcion` |
| Pilar ASG | A, S o G | **Columna nueva** `pilar_asg` (nullable, CHECK A/S/G; obligatoria para NIS). `pilar` es el enum NIIF (gobernanza, estrategia, riesgos, métricas) y es NOT NULL: se llena con `metricas` para A y S, y `gobernanza` para G |
| Las dos columnas de texto | «Cómo se mide» y «Qué recopilar» | `descripcion` = qué recopilar; **columna nueva** `como_se_mide` (nullable). `pagina_origen` queda nula: no es texto de la norma |
| `norma` | Enum NIIF, NOT NULL | `S1`, como en GRI y SASB |
| Código | — | `Marco` en `lib/catalogo-marcos.ts` suma «NIS». `aplicaAEmisora`: IBSO aplica a toda emisora, como GRI |

Va en una migración aditiva (tres columnas nullable, un CHECK más amplio y un CHECK nuevo que solo afecta filas NIS) y
en otra de datos, idempotente por `(codigo, version_taxonomia)`, con su fila en `auditoria-catalogo.md` (`CLAUDE.md`
§4). Termina con la barrera del auditor.

### 0.2 Correspondencia: una captura responde todos los marcos

**El mecanismo ya existe:** una solicitud ligada a varios códigos (`mapeo_solicitud_datapoint`) alimenta la respuesta
de cada uno con la misma captura. Basta con agregar los IBSO a los `datapoint_ids` de la plantilla «con rubros» y a los
mapeos de las solicitudes.

Números: los `orden` de la plantilla. «—» = no hay solicitud en la plantilla. Códigos NIIF verbatim de la plantilla.
GRI fuera del catálogo = sin código hoy (solo como referencia).

| IBSO | Solicitud de la plantilla | NIIF | GRI en el catálogo | GRI fuera del catálogo | SASB (FN-CB) |
|---|---|---|---|---|---|
| A.1 Alcance 1 | 70 | NIIF S2 29 (a)(i); 29 (a)(ii); EI14 a E18 | — | 305-1 | — |
| A.2 Alcance 2 | 80 | NIIF S2 29 (a)(i); 29 (a)(v) | — | 305-2 | — |
| A.3 Alcance 3 | 220 (total) y 230–370 | NIIF S2 29 (a)(vi)(1) | — | 305-3 | 410b.1–410b.4 (categoría 15, emisiones financiadas) |
| A.4 Consumo energético | 60 y 210 | NIIF S2 29 (a)(ii); 29 (a)(v) | — | 302-1 | — |
| A.5 Energía renovable | — | — | — | 302-1 (desglose) | — |
| A.6 Inversión sostenible | 130 (y 140) | NIIF S2 29 (e); 29 (d) | — | — | 410a.2 (parcial) |
| A.7 Agua ingresada | 90 (parcial: consumo, no extracción) | NIIF S1 46 a 50 | 303-5 (consumo; parcial) | 303-3 | — |
| A.8 Agua reaprovechada | — | — | — | 303-3 | — |
| A.9 Aguas residuales descargadas | — | — | — | 303-4 | — |
| A.10 Aguas residuales tratadas | — | — | — | 303-4 | — |
| A.11 Agua en zonas con estrés hídrico | — | — | 303-5 (inciso b; parcial) | 303-3 | — |
| A.12 Suelo en zonas sensibles | — | — | — | 101 / 304-1 | — |
| A.13 Sustancias que agotan el ozono | — | — | — | 305-6 | — |
| A.14 Residuos generados | 100 | NIIF S1 46 a 50 | 306-3 | — | — |
| A.15 Residuos reaprovechados | 100 (parcial) | NIIF S1 46 a 50 | — | 306-4 | — |
| A.16 Residuos peligrosos | 100 (parcial) | NIIF S1 46 a 50 | 306-3 (desglose; parcial) | — | — |
| B.1 Igualdad y trabajo digno | 30 y 50 | NIIF S1 27(a); NIIF S1 44 (a)(i)… | 2-23, 2-7 | 405-1 | — |
| B.2 Brecha salarial | — | — | — | 405-2 | — |
| B.3 Capacitación | 20 | NIIF S1 46 a 50 | 404-1 | — | — |
| B.4 Evaluación y desarrollo | — | — | — | 404-3 | — |
| B.5 Salud y seguridad laboral | — | — | — | 403-1 a 403-8 | — |
| B.6 Accidentes y enfermedades | — | — | — | 403-9, 403-10 | — |
| C.1 Consejo de administración | 170 | NIIF S1 27(a); NIIF S2 6 (a) | 2-9, 2-10 | — | — |
| C.2 Mujeres en el consejo | 30 (parcial) | NIIF S1 27(a) | 2-9 (c.v) | 405-1 | — |
| C.3 Vigilancia independiente | 170 y 180 (parcial) | NIIF S2 6 (a)(ii) | 2-9 (c.ii), 2-11 | — | — |
| C.4 Política de riesgos | — (110 es solo riesgos físicos) | NIIF S2 25 (a)(i)–(vi) | — | — | — |
| C.5 Estrategia de sostenibilidad | 190 y 200 (parcial) | NIIF S2 14(a)(i); 14(a)(iv) | 2-22, 2-23 | — | — |
| C.6 Integridad y ética | — | — | 2-23, 2-24, 2-26 | 205-1 a 205-3 | — |
| C.7 Seguridad de la información | — | — | — | — | 230a.2 |
| C.8 Privacidad y datos de terceros | — | — | — | 418-1 | 230a.1 (parcial) |

**Resumen:**
- **15 IBSO** tienen solicitud en la plantilla, entera o parcial: A.1–A.4, A.6, A.7, A.14–A.16, B.1, B.3, C.1–C.3 y
  C.5.
- **15 no la tienen:** A.5, A.8–A.13, B.2, B.4–B.6, C.4 y C.6–C.8. De ellos, C.4 y C.6–C.8 sí tienen solicitud en el
  demo de staging (§0.5).
- **Correspondencia exacta** con un código GRI del catálogo solo hay en A.14 (306-3) y B.3 (404-1). Las demás son
  parciales o apuntan a GRI que el catálogo no tiene. **No se proponen GRI nuevos aquí;** sería ampliar el catálogo
  GRI aparte.

### 0.3 Sección del suplemento que responde cada cualitativo

El suplemento es de clima (S2) con lo de S1 que toca a gobierno. Las respuestas IBSO usan las mismas tres vías que
GRI/SASB (extracto de la solicitud, sección y captura).

| IBSO | Sección (bloque) | Vía principal |
|---|---|---|
| C.1 Consejo de administración | 15 Roles y responsabilidades del órgano de gobierno; 18 Estructura de gobierno corporativo | Sección |
| C.2 Mujeres en el consejo | 18 (composición) | Captura (como «Mujeres en plantilla y en el Consejo» del demo); sección si no hay |
| C.3 Vigilancia independiente | 17 Papel de la gerencia y controles; 18 | Sección |
| C.4 Política de riesgos | 9 Evaluación y priorización de riesgos; 27 Gestión y mitigación de riesgos | Sección; extracto si hay política |
| C.5 Estrategia de sostenibilidad | 19 Trayectoria en sostenibilidad; 20 Contexto estratégico; 22 Cambios en el modelo de negocio | Sección |
| C.6 Integridad y ética | ninguna | Extracto de la solicitud (código, política anticorrupción); sin ella, pendiente con «información no disponible en el reporte» |
| C.7 Seguridad de la información | ninguna | Extracto; sin solicitud, pendiente |
| C.8 Privacidad | ninguna | Extracto; sin solicitud, pendiente |
| B.1 Igualdad y trabajo digno | ninguna | Extracto (política de diversidad y derechos humanos) |
| B.5 Salud y seguridad laboral | ninguna | Extracto; sin solicitud, pendiente |

Los cuantitativos (A.x, B.2, B.3, B.6 y la parte numérica de C.2) salen de captura o quedan pendientes, nunca en cero.

### 0.4 Libro y Cobertura

- **Libro** (`lib/excel/gri-sasb.ts`, export `export-gri-sasb`): se suma una hoja **«IBSO»** con los 30, en el orden
  de la NIS, y las columnas del libro (código, requisito, respuesta). Como requisito van el nombre y «qué recopilar»,
  que son redacción de IRStrat y no texto de la norma. A la hoja le aplica todo el glosario de §5, porque no es texto
  literal (a diferencia de la columna «Requisito» GRI, v1.14). El libro y su ruta se renombran solo en la etiqueta
  («GRI, SASB e IBSO»); la ruta no cambia.
- **Cobertura** (`cobertura-view.tsx`, `cobertura-datos.ts`): una cuarta sección «IBSO · NIS A-1», con su conteo
  aparte, como GRI y SASB. Agrupa por pilar A/S/G. No entra en los porcentajes NIIF.

### 0.5 Fondo de Fondos en Empresa Demo de staging: las nueve solicitudes

Son las nueve de `~/Downloads/solicitudes-demo-rh/` (políticas de Fondo de Fondos, ligadas a GRI/SASB en v45). Propuesta:

| Solicitud | IBSO |
|---|---|
| Política de Inversión Responsable | C.4 |
| Políticas Generales de Inversión | C.4 |
| Política de Gestión y Comunicación Responsable (Stewardship) | C.5 |
| Declaración sobre la relevancia del desarrollo sostenible 2026 | C.5 |
| Código de Ética y Conducta | C.6 |
| Manifiesto de Tolerancia Cero a la Corrupción 2026 | C.6 |
| Política de Integridad y Anticorrupción | C.6 |
| Política de Diversidad, Equidad e Inclusión | B.1 |
| Política de Privacidad | C.8 y C.7 (decisión 3) |

Son 10 enlaces (11 si se confirma C.7). El script de ligado sería `ligar-ibso-demo-rh.mjs`, copia de
`ligar-gri-sasb-demo-rh.mjs`:
- revisar y `--aplicar` con el ref;
- solo agrega enlaces;
- una fila `solicitud_editada` por solicitud, marcada como demostración;
- lo corre Esteban después de las migraciones de IBSO en staging, y la foto «después» lo cuenta.

### 0.6 Estimación

| Pieza | Jornadas |
|---|---|
| Migración del marco y datos de los 30, con su fila de auditoría | 0.5 |
| Correspondencia: plantilla «con rubros» y mapeos (más la decisión 1) | 0.5 |
| Cobertura: sección IBSO | 0.25 |
| Libro: hoja IBSO | 0.25 |
| Respuestas por las tres vías: tabla IBSO → secciones/tema, reglas y validadores, como `gri-sasb.ts` | 1.0 |
| e2e (catálogo, libro, respuestas y celdas del libro) y `poblar-demo` para el demo de dev | 0.75 |
| Script de ligado de staging y runbook del despliegue (ESPERADAS, comprobar, esperado de Cobertura) | 0.5 |
| **Total** | **3.75** |

Modelo: solo las respuestas IBSO del documento aprobado del demo, con una corrida que regenera solo esas filas
(regla de la especificación §6.1); menos de 0.5 USD.

## 5. Decisiones de Esteban (pendientes)

1. **Solicitudes que ya existen:** ¿los IBSO se ligan solo en la plantilla «con rubros» (reportes nuevos), o también,
   por título, a las solicitudes que ya se crearon desde ella en los reportes de staging (22 emisoras de demostración
   más O'Donnell)? Lo segundo cambia la foto de Cobertura de todas.
2. **Columnas nuevas:** `nombre`, `pilar_asg` y `como_se_mide`, frente a meter todo en `descripcion`. Recomiendo las
   tres columnas.
3. **C.7 en la Política de Privacidad** del demo, o C.7 sin solicitud.
4. **Pilar NIIF obligatorio:** `metricas` para A y S, y `gobernanza` para G. ¿O C.4 y C.5 a `riesgos` y `estrategia`?

### 5.1 Decisiones (Esteban, 17/11/2026)

1. IBSO se liga en la plantilla «con rubros» y también, por título, a las solicitudes existentes de staging, con un
   script de revisar y `--aplicar` que corre Esteban. Foto de Cobertura antes y después, con esperado: la sección IBSO
   nueva con sus enlaces y los totales NIIF sin cambio.
2. Las tres columnas nuevas (`nombre`, `pilar_asg` y `como_se_mide`); `descripcion` lleva «qué recopilar».
3. C.7 sin solicitud en el demo; la Política de Privacidad liga solo C.8.
4. Pilar NIIF: C.4 riesgos, C.5 estrategia, A y S métricas, C.1–C.3 y C.6–C.8 gobernanza.
5. Se versiona el TSV.

## 6. Paradas

1. **Paso 0:** este documento. Parada para las decisiones de §5.
2. **Fase 1:** migración, carga de los 30, correspondencia, Cobertura, libro, respuestas, e2e y `poblar-demo`. Parada
   con el SQL antes de aplicarlo en dev.

## 7. Registro

| Fecha | Qué | Resultado |
|---|---|---|
| 17/11/2026 | **Paso 0** (lectura) | Cuarto marco sobre lo de v45, con tres columnas nuevas; correspondencia de los 30 (15 con solicitud en la plantilla, 15 sin ella); secciones de los cualitativos; hoja IBSO y sección en Cobertura; ligado de las nueve del demo; estimación de 3.75 jornadas. **Parada:** decisiones de §5 |
| 17/11/2026 | **Fase 1** (decisiones §5.1), probada en el stack local. **Migraciones:** `20261117120000_catalogo_marco_nis` (marco NIS, tres columnas, CHECK de nombre y pilar ASG para NIS, barrera) y `20261117130000_catalogo_ibso_nis_a1` (los 30, generada por `scripts/catalogo/generar-ibso.mjs` desde el TSV, ya versionado), con su sección en `auditoria-catalogo.md`; tipos con las tres columnas. **Cobertura:** sección «IBSO · NIS A-1» por A/S/G en el tablero y el informe, con conteo aparte; el export la lista con el nombre. **Libro:** hoja «IBSO» al final (Código, Indicador, Respuesta); «qué recopilar» no sale al libro y la hoja no tiene vocabulario de plataforma. **Respuestas:** por la vía GRI/SASB, por captura; C.1–C.5 por sección (bloques 15/18, 18/15, 17/18, 9/27, 19/20/22); B.1, B.5 y C.6–C.8 por evidencia directa. El modelo recibe el nombre y lo que aborda el indicador, sin las instrucciones de recopilación. **Correspondencia** en `scripts/catalogo/datos/ibso-correspondencia.json` (plantilla, demo de dev y Fondo de Fondos). **Ligado** con `scripts/catalogo/ligar-ibso.mjs` (conjuntos `plantilla` y `fondo-de-fondos`, revisar y `--aplicar`), que también usa `poblar-demo --solo ibso`. Esperado de Cobertura `esperado-cobertura-ibso.json`: el comparador admite `solicitudes: "cualquiera"`. **Verificado:** `e2e-catalogo-ibso` en verde; `e2e-respuestas-gri-sasb` con IBSO en verde (57; A.14 por captura, C.1 por sección, C.7 por evidencia, B.5 pendiente, 30 filas y hoja IBSO); `e2e-respuestas-validadores` (110); tablero e informe con la sección; ligado local de los dos conjuntos con segunda pasada en 0; `tsc`, `eslint` y `verify:export`. **Sin probar:** `poblar-demo --solo ibso` (solo corre en dev, que no tiene la migración) | **Parada:** SQL antes de dev |
