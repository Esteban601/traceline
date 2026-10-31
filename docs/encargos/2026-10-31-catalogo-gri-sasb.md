# Encargo: catálogo GRI y SASB (Fase C)

Versión 1 · 31 de octubre de 2026. Fase C de la especificación (§1, «Menús GRI y SASB, Informe Anual GRI/SASB»),
asignada por Manuel a Esteban. Este documento contiene solo el Paso 0, de lectura: no se tocó código ni datos.

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/catalogo-gri-sasb` desde `dev/ajustes-sep26` (`49e55c7`). Se integra por PR (`CLAUDE.md` §2).
**Fecha de inicio:** 31 de octubre de 2026 · **Entrega:** por fases con parada, después de las decisiones de §5.
**Referencia:** `CLAUDE.md` v1.13 §3, §4, §5 y §8; especificación v0.50 §1 y §10; README «Extensión GRI del catálogo».

---

## 0. Paso 0 (lectura, sin cambios)

Fuentes leídas:
- `datapoints_taxonomia`, `plantilla_solicitudes` y `rubros_taxonomia` de **dev**, con la sesión de staff, solo
  lectura;
- `assets/taxonomia-base.xlsx`, la plantilla del Excel de taxonomía;
- `referencia/formato-electronico/plantilla-formato-2025.xlsx` y el Formato del demo exportado de `traceline-dev` v32;
- `lib/formato/llenar.ts`, `lib/excel/depurar.ts`, las migraciones de la extensión GRI y del sector SASB, y el README;
- `normas/`;
- los términos de uso públicos de GRI y de la Fundación IFRS, consultados en la web el 31/10/2026.

**Staging no se leyó.** CLAUDE.md §1 no lo permite fuera de los pasos de un despliegue. Lo que aquí se dice de la
plantilla «con rubros» de staging sale de dev y del registro del encargo `mockup-ainda` (37 solicitudes).

### 0.1 Inventario de lo que ya existe

**Catálogo (`datapoints_taxonomia`, dev, 121 activos).** Para separar los marcos sirve la columna `marco`, no
`norma`.

| Marco | `norma` | Códigos | Qué son |
|---|---|---|---|
| NIIF | S1 | 35 | Taxonomía oficial NIIF S1 |
| NIIF | S2 | 82 | Taxonomía oficial NIIF S2 |
| GRI | S1 (relleno) | 4 | «Extensión GRI», de la migración `20260825120000`: `GRI 303-5` (agua), `GRI 306-3` (residuos), `GRI 404-1` (capacitación) y `GRI 2-7 / 401-1` (plantilla y rotación, código compuesto) |
| SASB | — | 0 | No existe el valor: el CHECK `datapoints_marco_chk` admite `'NIIF'` y `'GRI'` |

Lo que conviene saber del catálogo:
- **`norma` no sirve para GRI ni SASB.** Es el enum `norma_niif` (`S1`, `S2`). Los cuatro GRI llevan `S1` de
  relleno, y la interfaz lo sustituye por «GRI» al pintarlo (`solicitudes/opciones.ts`, `cobertura/export`).
- **Las 4 GRI no tienen ninguna solicitud ligada en dev** (0 filas en `mapeo_solicitud_datapoint`).
- **Cobertura:** las GRI aparecen en una sección propia, «Extensión GRI», con su propio conteo y fuera del avance NIIF
  (`cobertura-view.tsx`, `cobertura/informe`). La foto de despliegue (`foto-cobertura.mjs`) cuenta solo `marco =
  'NIIF'`. Los «121 códigos» de la foto incluyen las 4 GRI.

**Plantilla de solicitudes.**
- En dev hay una sola, «Checklist base NIIF S1/S2 [DEMO]», con 37 renglones y 18 rubros de GEI. En staging, la
  «Plantilla IAS NIIF S1/S2 (con rubros)» tiene también 37 (registro de AINDA); no se leyó.
- **Ningún renglón está ligado a un código GRI.** Varios sí son temas GRI, pero están ligados a `NIIF S1 46 a 50`
  o a códigos de NIIF S2:

  | Tema de la solicitud | Norma GRI temática |
  |---|---|
  | Plantilla y rotación | 2-7 y 401 |
  | Índice de rotación voluntaria | 401 |
  | Horas de capacitación | 404 |
  | Diversidad e inclusión | 405 |
  | Derechos humanos y debida diligencia | 2-23 y 2-24 |
  | Energía eléctrica | 302 |
  | GEI de los Alcances 1, 2 y 3 | 305 |
  | Agua | 303 |
  | Residuos | 306 |
  | Riesgos físicos y efectos financieros | 201-2 |
  | Consejo: composición y competencias | 2-9 a 2-17 |

- **Las nueve solicitudes de demostración de RH** que preparamos para staging el 31/10 suman tres temas más: 205
  (anticorrupción), 418 (privacidad) y 2-23 (ética).

**Plantilla del Excel de taxonomía (`assets/taxonomia-base.xlsx`).** Estos son los «temas GRI» que llevaba el Excel
antes de depurarlo.
- La hoja «Taxonomía NIIF S1 S2» tenía las columnas «Sección» y «UN SDG».
- **«Sección»:** seguía la estructura de GRI 2 y GRI 3. Las secciones «1. La organización…», «2. Actividades y
  trabajadores», «3. Gobernanza», «4. Estrategia, políticas y prácticas» y «5. Participación de los grupos de interés»
  corresponden a GRI 2; «6. Contenidos sobre los temas materiales» corresponde a GRI 3.
- **Ocho «Contenidos temáticos»:**

  | Sección | Norma GRI |
  |---|---|
  | Empleo | 401 |
  | Seguridad y salud ocupacional | 403 |
  | Diversidad e igualdad de oportunidades | 405 |
  | No discriminación | 406 |
  | Trabajo infantil | 408 |
  | Trabajo forzoso u obligatorio | 409 |
  | Comunidad | 413 |
  | Privacidad del cliente | 418 |

- **Las 102 filas de esas ocho secciones no tienen código ni texto de requisito:** son un esqueleto vacío.
- **«UN SDG»:** 124 filas tenían un ODS.
- **La depuración del 26/10** (`aea7db4`, `lib/excel/depurar.ts`) quitó las dos columnas y las filas sin requisito.
  Hoy el Excel solo tiene NIIF.

**`rubros_taxonomia`.** Tiene 18 rubros, todos de GEI (`gei_alcances` 3 y `gei_alcance3` 15). Ninguno es de GRI ni
de SASB.

**Formato electrónico.**

- **Plantilla** (`plantilla-formato-2025.xlsx`, hoja «Estructura Formato Electronico»):
  - **68 secciones [8xxxxx]** de «Métricas de la Industria», una por industria SASB, de [805100] CG-AA a [855900]
    TR-RO. En la plantilla van en las filas 507 a 580.
  - **Solo dos traen filas de métrica.** [805100] CG-AA trae dos de ejemplo (CG-AA-440a.3 y 440a.4) y [855900] TR-RO
    trae filas de NIIF S1 B50–B59. Las otras 66 son un renglón de encabezado. La plantilla dice (I508) que las filas
    se desglosan «de acuerdo a las necesidades de las Emisoras».
  - **[815200] FN-CB** es solo un encabezado: fila 526 de la plantilla, D949 en el Formato del demo.
- **Lo que hoy llena `llenar.ts`:**
  - el sector (NIIF S2 32, K869/K870 del demo: «[815200] Finanzas - Bancos comerciales (FN-CB)», desde
    `perfil_emisor.sector_sasb`);
  - el texto de NIIF S2 32 (K866, narrativo del bloque, con la cartera por sector);
  - el juicio «¿las métricas por industria satisfacen el requerimiento?» (K786/K787, K809/K810 y K832/K833: «Sí,
    parcialmente», desde `perfil_emisor.metricas_industria`).
- **Las secciones [8xxxxx] quedan vacías por regla:** «fuera de alcance» (`llenar.ts:250`; `mapear-formato.mjs`:
  «[8xxxxx] SASB fuera, Fase C»).
- **K787/K788:** en el demo v5.2, K787 es la fila de opciones del juicio sobre las métricas por industria y K788 es
  NIIF S2 B65(e), la congruencia. No son filas SASB. La revisión externa v5 citó «K787/K788» por la nota interna
  «pendiente de catálogo SASB», que ya se quitó.
- **Hoja «Métricas SASB»:** está vacía en la plantilla de Storage desde v42. La copia de `referencia/` es anterior y
  todavía tiene la nota en A2.

**`normas/`.** En el worktree principal solo tiene NIIF S1 y S2, en español e inglés. Las fuentes de GRI y SASB
llegaron después a `normas/_fuentes/`; están en §0.6.

**Antecedente.** El README («Extensión GRI del catálogo») deja la licencia de SASB **«pendiente de escalar»** desde la
importación de Grupo Carso. Su checklist usa métricas SASB literales (CG-MR, RT-EE, IF-EN, EM-CM). La importación no
trajo las secciones [8xxxxx], y esas solicitudes quedaron ligadas a `NIIF S1 46 a 50`.

### 0.2 Qué pide cada salida

**Formato electrónico (CNBV/BMV).**
- Las filas [8xxxxx] esperan las **métricas SASB de la industria** que la emisora seleccionó en NIIF S2 32 (fila 446
  de la plantilla). Lo que cada fila espera, por sector, es la tabla de métricas contables y de actividad de esa
  industria.
- La plantilla no trae las filas: se desglosan por emisora. Llenar [815200] para el demo exige **insertar las filas de
  FN-CB** en la sección, o escribir la tabla en la hoja «Métricas SASB». Es la decisión 3 de §5.
- **GRI no tiene lugar en el Formato:** ninguna fila pide GRI.

**Excel de taxonomía.**
- Hoy es solo NIIF, por diseño: «el Excel oficial de taxonomía sigue siendo solo de la norma», según el README.
- **Propuesta: un libro aparte** («Índice de contenidos GRI» y, si se carga SASB, «Métricas SASB»), sin filas GRI ni
  SASB en el libro de la taxonomía. Así no se toca `export-taxonomia/route.ts` ni `depurar.ts`, y el Excel que se
  entrega a la CNBV no cambia.

**Informe Anual GRI/SASB (la cola, Fase C).**
- La especificación lo menciona en una sola línea (§1); no tiene definición.
- Con GRI, un informe «de conformidad» lleva el índice de contenidos GRI (GRI 1, requisito 7) y la declaración de uso.
- **Propuesta:** un encargo aparte, después del catálogo. El generador del suplemento sirve de base, pero cambian los
  bloques, el índice y las reglas de vocabulario.

### 0.3 Alcance propuesto en tres niveles

Unidad: un datapoint por **contenido** GRI (p. ej. 305-1) o por **métrica** SASB (p. ej. FN-CB-410a.2), no por
inciso. Los conteos de GRI son los de las normas 2021 y temáticas vigentes. **Hay que confirmarlos contra el texto**
cuando esté en `normas/`; las normas 302 y 305 serán reemplazadas por GRI 102 y 103 (2025), con vigencia posterior.

| | Mínimo | Medio | Completo |
|---|---|---|---|
| **Qué entra** | GRI 2 (2-1 a 2-30) y GRI 3 (3-1 a 3-3), y FN-CB para el demo | Mínimo, más las temáticas que ya aparecen en las solicitudes y en el esqueleto del Excel: 201, 205, 302, 303, 305, 306, 401, 403, 404, 405, 406, 408, 409, 413 y 418 | Medio, más las industrias SASB de los 20 mockups y de Carso |
| **Datapoints nuevos** | 30 + 3 + 17 de FN-CB (15 contables y 2 de actividad, versión 2025-12, contadas en el PDF) = **50** | ≈ **53** más (201:4, 205:3, 302:5, 303:5, 305:7, 306:5, 401:3, 403:10, 404:3, 405:2, 406:1, 408:1, 409:1, 413:2, 418:1), ≈ 100 en total | 10 industrias más para los mockups (§0.6): **156–172** métricas más según cómo se clasifique Rotoplas, y 27 más con Carso (CG-MR y RT-EE) |
| **Vínculo con solicitudes** | El de siempre (`mapeo_solicitud_datapoint`, lo hace el staff). En el demo, 2 o 3 solicitudes nuevas para FN-CB (`poblar-demo`); GRI 2 se cubre en gran parte con Perfil y Gobierno | Se re-mapean ~15 de los 37 renglones de la plantilla (columna `datapoint_ids`) y las solicitudes ya creadas que se quieran; las 4 GRI actuales pasan a su código propio (decisión 6) | Por mockup, solicitudes SASB nuevas con `crear-demo-prospecto` (sin regenerar contraseñas, como siempre) |
| **Cobertura** | Dos secciones propias, «GRI» y «SASB · industria», **con conteo aparte**, fuera del avance NIIF (el patrón de «Extensión GRI»). La foto de despliegue sigue contando NIIF | Igual | Igual, filtrando SASB por el `sector_sasb` del Perfil |
| **Migraciones** | (1) CHECK de `marco` sustituido por uno más amplio (`'NIIF','GRI','SASB'`); (2) columnas nullable `estandar` (p. ej. «GRI 305», «SASB FN-CB»), `edicion` y `tipo_metrica`; (3) datos idempotentes del catálogo, una fila por cambio en `auditoria-catalogo.md`. Todas aditivas y con barrera | (3) con más filas; re-código de las 4 GRI | (3) con más filas |
| **Salidas** | Formato: [815200] con las filas de FN-CB, o la hoja «Métricas SASB» (decisión 3). Libro aparte con el índice GRI 2/3 | Más el índice GRI temático | Más las [8xxxxx] de cada sector |
| **Jornadas** | **~5–6**: esquema y catálogo 1.5; FN-CB del demo 1; Cobertura 1; Formato y libro aparte 1.5; runbook 0.5 | **+3–4**, ≈ 9 | **+6–8**, ≈ 15–17 |
| **Costo del modelo** | ~0 (catálogo y salidas por regla); regenerar el bloque de NIIF S2 32 del demo, ~0.3 USD | ~0 | ~0 |

Las industrias SASB de los 20 mockups y de Empresa Demo, con sus métricas contadas, están en §0.6.

**El Informe Anual GRI/SASB queda fuera de los tres niveles.** Es un encargo aparte, estimado en más de 10 jornadas.

### 0.4 Licencias

> **Resuelto el 31/10/2026 (confirmación de Esteban).** Las licencias de la IFRS Foundation (NIIF S1/S2 y SASB) y la
> de GRI existen y son de reproducción en producto; los contratos los resguarda el equipo legal de Apalache y no se
> copian aquí. Con eso, el texto de los datapoints se carga literal de la norma, sin redacción propia y sin marcador
> de licencia pendiente. Lo que sigue es la lectura de los términos públicos del Paso 0; queda como antecedente.

Consulta del 31/10/2026 a fuentes primarias. **No es una opinión legal.** Las citas están en el idioma original.

**GRI.**
- **Aviso de copyright de las normas**, en GRI 1 (2021):

  > «The reproduction and distribution of this document for information and/or use in preparing a sustainability
  > report is permitted without prior permission from GRI. However, neither this document nor any extract from it
  > may be reproduced, stored, translated, or transferred in any form or by any means … for any other purpose
  > without prior written permission from GRI.»

  Fuente: https://globalreporting.org/pdf.ashx?id=12334. Solo se leyó el aviso de GRI 1; se supone igual en las demás.
- **Política de copyright:**

  > «The GRI Licensing Software and Tools Program grants permission, through licensing, for software and tools to
  > commercially use GRI's copyright-protected content.»

  > «Unauthorized translations of the GRI Standards are in violation of GRI's copyright…»

  Fuente: https://www.globalreporting.org/copyright/.
- **Programa de licencias:** contrato con cotización, calendario y verificación del contenido por GRI. No hay
  tarifas públicas. Fuente: https://globalreporting.org/reporting-support/reporting-tools/get-your-software-tools-licensed/.
- **Lo que no se encontró:** ninguna fuente autoriza de forma expresa mostrar solo número y título de un contenido
  dentro de un software.

**SASB y la Fundación IFRS.**
- **Página de licencias:**

  > «The ISSB Standards can be used for free for personal non-commercial purposes, such as preparing corporate
  > disclosures. Any other use, such as their integration into reporting software, investment analysis, data
  > services and product development, is not permitted without a separate licence from the IFRS Foundation.»

  > «Content that may be licensed includes IFRS S1, IFRS S2, SASB Standards and the Sustainable Industry
  > Classification System® (SICS®).»

  Fuente: https://www.ifrs.org/products-and-services/sustainability-products-and-services/ifrs-sustainability-licensing/.
- **Hoja «Licensing SASB Standards» (2022):**

  > «Commercial applications such as integration into investment analysis, research methodology, product
  > development, reprinting or creating derivative works would require a licensing relationship.»

  Nombra a los «corporate reporting software providers» y da como contacto sustainability_licensing@ifrs.org.
  Fuente: https://www.ifrs.org/content/dam/ifrs/products/sustainability/standards-1pager-2022.pdf.

**Y NIIF S1/S2, que ya están en la plataforma.** El texto oficial de IFRS S1 (HTML 2025) dice:

> «All other uses, such as reporting software, investment analysis, data services, and product development is not
> permitted without a separate licence from the IFRS Foundation.»

Contacto: licensing@ifrs.org.

**Consecuencia: las descripciones de NIIF S1/S2 que el catálogo muestra y exporta hoy caen en la misma regla.** No es
nuevo de este encargo, pero el encargo lo hace visible.

**Traducciones al español.**
- **GRI** tiene traducción oficial (1/08/2022) de GRI 1, 2, 3 y las temáticas. Hay dos excepciones: las sectoriales
  2025 (solo en inglés) y GRI 101/102/103, que no aparecen en la lista en español (sin verificar).
- **SASB** tiene una traducción al español de 2021, sobre las normas de 2018. No se encontró traducción oficial de la
  versión vigente.
- **Choque con CLAUDE.md §4:** §4 prevé traducción propia con glosario y revisión de IRStrat, y GRI la prohíbe sin
  permiso.

**Decisión de Esteban antes de cargar nada:** decisión 1 de §5.

### 0.5 Relación con `carga-lectura-texto`

**El encargo no existe en el repositorio.** Solo está `carga-lectura-primero`, cerrado. Esto se supone de lo que su
nombre indica: lectura de texto en la carga de evidencias (captura sugerida de texto).
- **Qué tocaría:** `lib/evidencias/*`, la cola de lectura, `sugerencias_captura` y las pantallas de carga y
  confirmación.
- **Qué toca este encargo:** `datapoints_taxonomia` (CHECK, columnas y datos), `seed.sql` (el catálogo regenerado),
  Cobertura, `lib/formato/llenar.ts` (las [8xxxxx]), la plantilla del Formato en Storage y un libro nuevo.
- **Pueden ir en paralelo, en ramas distintas,** con tres reglas:
  1. Este encargo **no toca** `export-taxonomia/route.ts` ni `lib/excel/depurar.ts`: va en libro aparte, con ruta
     propia. Si `carga-lectura-texto` lleva texto confirmado a las respuestas del Excel, el exportador sería solo
     suyo.
  2. Las migraciones de los dos se fechan sin traslape, y la segunda en mezclarse se rebasa sobre la primera.
  3. `lib/formato/llenar.ts` es el único archivo que podrían compartir. Si `carga-lectura-texto` lo toca, el segundo
     PR lo resuelve con revisión.
- **Si `carga-lectura-texto` ya existe en otro lugar** (Notion, otra rama), conviene leerlo antes de la Fase 1.

### 0.6 Complemento: fuentes, sustituciones, industrias y traducciones

Agregado el 31/10/2026, a pedido de Esteban.

**Fuentes en `normas/_fuentes/`.**
- **Dónde:** en el worktree `vert-evidencia-dev`. Ya las cubre `normas/` en `.gitignore`; se agregó también la línea
  explícita `normas/_fuentes/` hasta la decisión de licencia.
- **Qué hay:** 122 PDF, 74.4 MB, más un zip con el mismo juego GRI.
- **Inventario completo** (archivo, edición, KB y páginas), fuera del repositorio:
  `~/Downloads/catalogo-gri-sasb/inventario-fuentes.md`.

| Carpeta | PDF | Ediciones |
|---|---|---|
| Full set of GRI Standards - English | 42 | Ver abajo |
| SASB Standards, en 11 sectores | 77 | 74 en «VERSION 2023-12»; FN-AC, FN-CB y FN-IN en «2025-12»; IF-RE en «2023-06» |
| SASB Standards / Estandares ASG | 1 | «NIS 2024» (189 págs.): Normas de Información de Sostenibilidad del CINIF, no es de SASB |
| NIIF S1 y S2 | 2 | IFRS S1 e IFRS S2 (2023), en inglés |
| gri-es (agregada el 31/10/2026) | 43 | El juego oficial de GRI en español, 50.0 MB (ver «Traducciones») |

El juego GRI tiene:
- GRI 1, 2 y 3 (2021);
- las temáticas: 201–207 (207 de 2019), 301, 302, 303 (2018), 305, 306 (2016 y 2020), 308, 401–411, 413–418 (403 de
  2018), todas de 2016 salvo las señaladas;
- GRI 101 (2024), 102 y 103 (2025);
- las sectoriales 11, 12, 13 y 14 (V1.1);
- el Glosario 2025.

Al juego en inglés le faltan GRI 304 (la sustituye GRI 101) y GRI 412. El juego en español (`gri-es/`) sí trae GRI 304
(2016); GRI 412 no está en ninguno de los dos.

**Qué normas GRI sustituyen a otras.** Se tomó del aviso de cada PDF; la fecha es la de vigencia.

| Norma | Estado | Fuente |
|---|---|---|
| GRI 306: Effluents and Waste 2016 | 306-1, 306-2, 306-4 y 306-5 **ya no están vigentes**: los sustituyeron GRI 303 (2018) y GRI 306: Waste 2020 (vigente desde el 1/01/2022). **306-3, Derrames significativos, sigue vigente** | Aviso de GRI 306 (2016) |
| GRI 305: Emissions 2016 | El requisito 1.2 y **305-1 a 305-5** los sustituye **GRI 102: Climate Change 2025** desde el **1/01/2027**. 305-6 y 305-7 siguen | Aviso de GRI 305 |
| GRI 201: Economic Performance 2016 | **201-2** (implicaciones financieras del cambio climático) la sustituye **GRI 102** desde el 1/01/2027 | Aviso de GRI 201 |
| GRI 302: Energy 2016 | Vigente **hasta el 31/12/2026**; la sustituye entera **GRI 103: Energy 2025** desde el 1/01/2027 | Aviso de GRI 302 |
| GRI 304: Biodiversity 2016 | La sustituye **GRI 101: Biodiversity 2024**, vigente desde el 1/01/2026. GRI 304 no está en el juego y GRI 101 no lo dice en su texto: el dato sale de la página de GRI, no del PDF | Página de GRI, sin verificar en el PDF |

Consecuencia para el catálogo: el informe de 2025 (publicado en 2026) usa 302 y 305-1 a 305-5; el de 2026 (publicado
en 2027) usa 102 y 103. Los dos datapoints `GRI 303-5` y `GRI 306-3` de la «Extensión GRI» hoy:
- **GRI 303-5** (consumo de agua) es de GRI 303 (2018): vigente.
- **GRI 306-3 es ambiguo.** En GRI 306 (2020), 306-3 es «Residuos generados», y eso es lo que mide el datapoint. En
  GRI 306 (2016), 306-3 es «Derrames significativos». El catálogo debe decir la edición (decisión 5).

**Industrias SASB de Empresa Demo y de los 20 mockups.**
- Empresa Demo es FN-CB por su Perfil (`sector_sasb`).
- La de cada mockup es **juicio mío por giro**; hay que confirmarla con el `sector_sasb` de cada Perfil en staging.
- El número de métricas se contó en los PDF: códigos distintos, contables más de actividad.

| Industria (código, versión) | Métricas | Emisoras |
|---|---|---|
| FN-CB Commercial Banks (2025-12) | 15 + 2 = **17** | **Empresa Demo**, Afirme, Banco Base |
| IF-RE Real Estate (2023-06) | 14 + 4 = 18 | GAV, Planigrupo, Frisa, O'Donnell; Fibra Inn (o SV-HL) |
| SV-HL Hotels & Lodging (2023-12) | 9 + 4 = 13 | Fibra Inn, si se clasifica por su operación hotelera |
| IF-HB Home Builders (2023-12) | 14 + 3 = 17 | CADU, Inmobilia |
| FN-CF Consumer Finance (2023-12) | 10 + 2 = 12 | TRATON FS, Montepío |
| FN-AC Asset Management & Custody (2025-12) | 13 + 2 = 15 | Fondo de Fondos, AINDA, Portafolio Durango |
| FB-MP Meat, Poultry & Dairy (2023-12) | 24 + 2 = 26 | Bafar |
| EM-CM Construction Materials (2023-12) | 13 + 1 = 14 | GCC (y Carso) |
| IF-EN Engineering & Construction Services (2023-12) | 13 + 3 = 16 | CLEPSA, PINFRA (SASB no tiene industria de autopistas concesionadas: es la más cercana; y Carso) |
| TC-TL Telecommunication Services (2023-12) | 13 + 4 = 17 | Megacable |
| Rotoplas: CG-BF (8), RT-CP (18) o IF-WU (24) | 8–24 | Rotoplas (tinacos y soluciones de agua: a decidir) |
| CG-MR Multiline & Specialty Retailers (2023-12) | 11 + 2 = 13 | Carso |
| RT-EE Electrical & Electronic Equipment (2023-12) | 12 + 2 = 14 | Carso |

Notas:
- **FN-CB 2025-12 ya no tiene FN-CB-410a.1.** Trae 410a.2 y las cuatro de emisiones financiadas (410b.1 a 410b.4):
  la versión importa.
- Las [8xxxxx] del Formato listan las 68 industrias, así que cualquiera de estas tiene su sección.

**Traducciones oficiales al español.** Corregido el 31/10/2026: el juego completo de GRI en español ya está en
`normas/_fuentes/gri-es/` (43 PDF), así que GRI no tiene traducciones faltantes que importen al catálogo.

| Norma | Traducción oficial | Dónde |
|---|---|---|
| GRI 1, 2 y 3 (2021) | Sí | `gri-es/`; https://www.globalreporting.org/how-to-use-the-gri-standards/gri-standards-spanish-translations/ |
| GRI temáticas 201–207, 301–306 (304 de 2016; 306 de 2016 y de 2020), 308, 401–411 y 413–418 (303 y 403 de 2018) | Sí | `gri-es/` |
| GRI 101 (2024), 102 y 103 (2025) | Sí | `gri-es/` |
| GRI 11–14 | Sí, en su versión original (entrada en vigor 2023, 2024, 2024 y 2026). La versión 1.1, alineada en 2025 con 101–103, existe solo en inglés | `gri-es/` (original); `Full set…/` (V1.1) |
| Glosario GRI | Sí | `gri-es/` |
| GRI 412 | No está en ninguno de los dos juegos | — |
| SASB, 77 industrias | **Solo la de las normas de 2018** (anunciada en marzo de 2021). **No se encontró traducción oficial de las versiones 2023-12 ni 2025-12**; la página antigua de SASB redirige a ifrs.org, que no la lista. Sin verificar en fuente primaria | https://sust4in.com/en/sust4in-welcomes-the-spanish-translations-of-all-77-sasb-industry-standards/ (secundaria) |
| SASB, enmiendas 2025–2026 | Borradores en español, **no aprobados** por el Review Committee de la Fundación IFRS | https://www.ifrs.org/content/dam/ifrs/project/enhancing-sasb-standards-cont/es-sasb-ifrs-s2-ibg-ed-2026-1-proposed-amends.pdf |
| NIIF S1 y S2 | Sí (octubre de 2023), ya en `normas/` | https://www.iasplus.com/en/news/2023/10/ifrs-s1-spanish |

Consecuencia: GRI se carga con su texto oficial en español. SASB va en inglés hasta que haya traducción oficial
(decisión 8).

---

## 5. Decisiones de Esteban (31/10/2026)

1. **Licencias: vigentes** (§0.4). Texto literal de la norma, sin redacción propia ni marcador de licencia pendiente.
2. **Nivel mínimo:** GRI 2, GRI 3 y SASB FN-CB.
3. **FN-CB en la hoja «Métricas SASB»** del Formato, sin tocar la plantilla de la BMV (Fase 3).
4. **Libro aparte para GRI y SASB**, sin tocar el Excel de taxonomía.
5. **GRI 2021 con 302 y 305 de 2016;** la edición es columna obligatoria.
6. **Un código por contenido.**
7. **Marco NIIF/GRI/SASB** y columnas `estandar` y `edicion`.
8. **SASB en inglés** hasta que haya traducción oficial.
9. Las industrias de **Fibra Inn, CLEPSA, PINFRA y Rotoplas las confirma Esteban.**

Complemento del mismo día: el juego de GRI en español está en `normas/_fuentes/gri-es/`; GRI 2 y GRI 3 se cargan
directo del español, sin paso por el inglés ni marcador de «texto en español pendiente».

### 5.1 Preguntas de la Fase 1 (respondidas por Esteban el 31/10/2026)

1. **Vocabulario en texto literal de la norma:** excepción en CLAUDE.md §5 (v1.14) para la columna «Requisito» del
   libro GRI/SASB.
2. **Extensión GRI:** las cuatro filas toman su texto literal en español y se parten por contenido; donde el código ya
   existe por la carga de GRI 2 (`GRI 2-7`), se retira la fila vieja (`GRI 2-7 / 401-1`).
3. **Migraciones** `20261031120000` y `20261031130000` aprobadas como aditivas.

**Deuda registrada con nombre:** `relleno-norma-pilar-gri-sasb` (especificación §10, «Deudas conocidas»): `norma` y
`pilar` de GRI y SASB llevan relleno NIIF (GRI como S1, SASB como S2).

## 6. Paradas

1. **Paso 0:** este documento. Parada para las decisiones de §5.
2. **Fase 1** (después de la decisión 1): migraciones de esquema y SQL del catálogo, sin aplicar. Parada con el SQL.
3. **Fase 2:** catálogo aplicado en dev y local; Cobertura; FN-CB del demo. Parada con capturas.
4. **Fase 3:** salidas (Formato y libro aparte); despliegue a `traceline-dev` con humo; PR. Parada.
5. **Fase 4:** runbook del release a staging.

## 7. Registro

| Fecha | Qué | Resultado |
|---|---|---|
| 31/10/2026 | **Paso 0** (lectura). Catálogo de dev: 117 NIIF y 4 GRI («Extensión GRI», sin solicitudes ligadas), 0 SASB; `norma` no sirve para GRI/SASB. Plantilla de dev: 37 renglones, ninguno con GRI, ~15 con tema GRI. Excel de taxonomía: el esqueleto GRI 2/3 y 8 secciones temáticas sin códigos, retirado por la depuración del 26/10. Formato: 68 secciones [8xxxxx], [815200] FN-CB sin filas, las [8xxxxx] vacías «fuera de alcance». `normas/` sin GRI ni SASB. Licencias: GRI y la Fundación IFRS exigen licencia para uso en software comercial, también para el texto de S1/S2 que ya está en la plataforma. Tres niveles: ~5–6, ~9 y ~15–17 jornadas | **Parada:** decisiones de §5 |
| 31/10/2026 | **Complemento del Paso 0** (Esteban): fuentes en `normas/_fuentes/` (122 PDF, 74.4 MB; inventario en `~/Downloads/catalogo-gri-sasb/inventario-fuentes.md`), sin commitear y con línea explícita en `.gitignore`; sustituciones GRI tomadas del aviso de cada PDF (306 de 2016 solo con 306-3 vigente; 305-1 a 305-5 y 201-2 a GRI 102, y 302 a GRI 103, desde el 1/01/2027; 304 a GRI 101, sin verificar en el PDF); industrias SASB de los mockups con sus métricas contadas (FN-CB 2025-12: 17); traducciones al español con enlace (GRI completa salvo 412 y las sectoriales de 2025; SASB solo de 2018). Decisiones 8 y 9 agregadas | **Parada:** decisiones de §5 |
| 31/10/2026 | **Decisiones del Paso 0** (§5): licencias vigentes (registradas aquí y en el README en lugar de «pendiente de escalar», sin copiar el contrato) y (2)–(9). Complemento: juego GRI en español en `gri-es/` (43 PDF, 50.0 MB); traducciones de §0.6 corregidas | Hecho |
| 31/10/2026 | **Fase 1** (nivel mínimo), parada con el SQL antes de aplicarlo en dev | **Migraciones:** `20261031120000_catalogo_marco_sasb` (CHECK de `marco` sustituido por uno más amplio con `SASB`; `estandar`, `edicion` y `pagina_origen` nullable; CHECK nuevo «edición obligatoria para GRI y SASB», que las filas existentes cumplen porque las cuatro de la Extensión GRI se llenan antes; índice; barrera) y `20261031130000_catalogo_gri2_gri3_fncb` (50 filas, upsert idempotente, GENERADA por `scripts/catalogo/generar-gri-sasb.mjs` desde los PDF). **Conteo por estándar:** GRI 2: 30 · GRI 3: 3 · SASB FN-CB: 17 (15 contables y 2 de actividad), más las 4 de la Extensión GRI con su estándar y edición; NIIF sin cambio. **Texto:** GRI 2 y 3, el bloque «REQUERIMIENTOS» del PDF oficial en español, leído por posición en la página (el PDF es a dos columnas y la etiqueta «ORIENTACIONES» va al margen); FN-CB, el encabezado del protocolo y la tabla 2, en inglés. **Aplicadas solo en el stack local** (barrera 108); tipos de las tres columnas escritos a mano en `lib/database.types.ts`, iguales a los que genera la CLI. **Cobertura:** secciones GRI y SASB aparte (`lib/catalogo-marcos.ts`), SASB solo con la industria del Perfil; informe y Excel de cobertura con el estándar y la edición; el selector de datapoints rotula «GRI»/«SASB». **Libro GRI/SASB:** `/admin/cobertura/export-gri-sasb` (`lib/excel/gri-sasb.ts`), hojas «GRI» y «SASB <industria>», Código / Requisito (/ Respuesta con el generador encendido, como el Excel de taxonomía), edición en las propiedades; botón «Libro GRI/SASB» junto al Excel de taxonomía. **Pruebas:** `e2e-catalogo-gri-sasb` (nuevo) 30 en verde y un aviso (GRI 2-5, «solicitud», §5.1); validadores 90, métricas 19, Formato 29, alivios 20, respuestas 22, regeneración 9, declaraciones 20 y efectos 15 contra el stack local; `tsc` limpio, eslint sin errores. `verify:export` y `e2e-celdas-categoricas` necesitan dev con la migración: van después de aplicarla. **Errores propios:** el extractor de FN-CB cortaba el «3» final de «(3) Scope 3» (quitaba un número de nota al pie que ya no existía), y la primera versión del extractor GRI mezclaba la columna de orientaciones; corregidos y comprobados. **Errata de la fuente:** GRI 2-5 «de de gobierno», conservada (literal) | **Parada:** SQL y §5.1 |
| 31/10/2026 | **Fase 1 aprobada** y aplicada en dev y local; parada | **CLAUDE.md v1.14:** §5 no aplica a la columna «Requisito» del libro GRI/SASB (texto literal); el glosario sigue igual al del validador (e2e, 22 términos). **Extensión GRI:** migración nueva `20261031140000_catalogo_extension_gri_literal` (generada con `--extension`): texto literal en español de GRI 303-5 (2018), 306-3 (2020), 404-1 (2016) y 401-1 (2016, nueva); `GRI 2-7 / 401-1` retirada (`activo = false`), con sus enlaces y renglones de plantilla pasados a GRI 2-7 y GRI 401-1 (0 en dev). Cobertura y su Excel ocultan GRI/SASB retirados (NIIF, como siempre). **Deuda** `relleno-norma-pilar-gri-sasb` en la especificación §10 (0.51). **Migraciones:** las tres en dev (`db push --linked`, con la traza de `pg-delta` de siempre) y en local; 101 de 101 con 0 desalineadas en los dos; barrera 108 en los dos. **Tipos** regenerados desde dev: iguales, byte por byte, a los escritos a mano. **Conteo final (dev, activos):** GRI 2: 30 · GRI 3: 3 · GRI 303: 1 · GRI 306: 1 · GRI 401: 1 · GRI 404: 1 (GRI 37) · SASB FN-CB: 17 · NIIF: 117 sin cambio; retirada 1. **Fotos de Cobertura** (`~/Downloads/catalogo-gri-sasb/`): 121 → 172 códigos; diferencia exactamente la esperada, 52 celdas (51 nuevas sin solicitud y la compuesta que cambia a retirada); NIIF 117 → 117 con 0 celdas distintas y totales iguales. **Pruebas:** `verify:export` 81 contra dev con el código de la rama; `e2e-celdas-categoricas` 128 sobre el Formato y el Excel de dev; esos dos libros iguales celda por celda a los de `traceline-dev` v32 (4582 y 1251 celdas, 0 distintas); `e2e-catalogo-gri-sasb` 33 en verde; validadores con el glosario igual. **Libro GRI/SASB de dev:** `gri-sasb-empresa-demo-sab-2025-2026-10-31.xlsx`, hojas GRI (37) y SASB FN-CB (17), Código / Requisito / Respuesta («En preparación» en las 54: el generador está encendido y no hay respuestas GRI/SASB aún) | **Parada** |

