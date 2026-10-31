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

## 1. Fase 2 · Paso 0 (lectura, sin cambios)

Que el libro GRI/SASB del demo salga con respuestas, y no con «En preparación». Leído el 31/10/2026 en
`lib/suplemento/respuestas.ts`, `lib/suplemento/hechos/fuentes.ts`, `lib/formato/llenar.ts`,
`scripts/formato/preparar-plantilla.mjs` y los datos del demo en dev. No se cambió nada.

### 1.1 Cómo se generarían hoy las respuestas de GRI y SASB

**Hoy no se generan.** `generarRespuestas` corre al aprobar un documento del suplemento y filtra el catálogo con
`codigo.startsWith("NIIF")`, así que ningún código GRI ni SASB recibe fila en `respuestas_datapoint`. El libro las
busca ahí por clave (= código), y por eso las 54 dicen «En preparación».

Las vías que existen para NIIF, en el orden en que `planDe` las prueba, y si servirían para GRI o SASB:

| Vía de NIIF | Fuente | ¿Sirve para GRI/SASB? |
|---|---|---|
| Regla (alivio, «no aplica» heredado, 36(e) desde cuestionario, 72) | Alivios, cuestionarios | No: son reglas de códigos NIIF concretos |
| **Bloque dueño** con cobertura | Texto aprobado del bloque y los hechos que su cobertura cita para el código | **No tal cual.** Los 40 bloques solo listan códigos NIIF en `BLOQUES[].datapoints`, y la cobertura del respaldo es por código NIIF; ningún bloque cubre un código GRI o SASB |
| Declaración del Perfil por clave (21(a), B65(e)) | Hecho del Perfil con clave fija | Es el patrón: una tabla código → claves de hechos |
| **Captura confirmada** de solicitud cuantitativa ligada | `capturas_valor` vía el ensamblador | **Sí, sin cambios de lógica**: basta incluir los códigos y ligar la solicitud |
| Pendiente | Marcador de §5 con la solicitud | Sí |

**Qué falta para que un código GRI 2 o FN-CB con solicitud y evidencia confirmada tenga respuesta:**

1. **Incluir GRI y SASB en `generarRespuestas`.** Hoy el filtro los excluye. SASB entra solo si la industria está en el
   Perfil, con la misma regla que Cobertura.
2. **Captura cuantitativa:** con (1), ya funciona. Una solicitud cuantitativa ligada a `FN-CB-000.B` y entregada sale
   como «<valor> <unidad> en 2025», sin modelo.
3. **Texto (políticas, descripciones):** no hay vía.
   - El extracto confirmado de una solicitud entra al libro de hechos solo con los bloques que la usan
     (`bloquesDeSolicitud`, de la completitud NIIF). Una solicitud ligada **solo** a GRI/SASB no tiene bloque.
   - Sus capturas caen en `fueraDelSuplemento` y sus extractos quedan sin bloque sugerido: el libro no la da como
     hecho de ningún bloque.

   Hace falta una vía nueva, **«evidencia directa»**: el modelo resume el extracto confirmado de las solicitudes
   ligadas al código. Es una llamada por código, con los mismos validadores (cifras solo de la fuente, longitud,
   vocabulario), sin bloque ni libro.
4. **Fuente prestada de un bloque aprobado:** muchos contenidos GRI 2 los responde un bloque NIIF ya aprobado.

   | Contenidos GRI 2 | Bloques NIIF |
   |---|---|
   | 2-9 a 2-18 (gobernanza) | 15–18 |
   | 2-22 (declaración de estrategia) | 1, la carta |
   | 2-29 y GRI 3-1/3-2 | 7, materialidad |
   | 2-1, 2-2 y 2-6 | 2 y 4 (identidad y perímetro), 12 y 13 (modelo y cadena de valor) |
   | FN-CB-410a.2 | El de gestión de riesgos |

   Hace falta una tabla código GRI/SASB → bloque(s) y claves de hechos, como `HECHOS_POR_CLAVE`. Con ella el modelo
   resume la sección aprobada, como hace con NIIF.
5. **Remisión en vez de repetir:** cuando el contenido GRI es el mismo que un NIIF ya respondido (2-9 con NIIF S2 6(a),
   por ejemplo), la respuesta puede remitir («Ver NIIF S2 6(a)») en lugar de llamar al modelo. Es tu decisión
   (pregunta 2 de §1.5).

**¿Intervienen los bloques del suplemento?** Hoy no. Con la propuesta, **solo como fuente de lectura**: no se cambia
ningún bloque, prompt ni cobertura, y no se regenera nada. Las respuestas GRI/SASB se generan, como las NIIF, al aprobar
el documento, desde su texto aprobado y sus libros.

**En el demo hay con qué.**
- 44 solicitudes con extracto de texto confirmado.
- El Perfil tiene denominación, entidad, perímetro, carta, materialidad, modelo, cadena de valor, gobierno, sector y
  las dos declaraciones.
- 17 solicitudes tienen, por título, tema de GRI 2 o FN-CB:
  - Consejo: composición, competencias, frecuencia de información y remuneración vinculada a clima;
  - plantilla, rotación, mujeres en plantilla y Consejo, y capacitación;
  - cartera total, cartera sostenible y cartera expuesta a transición.
- Ninguna está ligada todavía a un código GRI ni SASB.

### 1.2 Las nueve solicitudes de demostración de staging

Ligar es N:N: una solicitud conserva sus códigos NIIF y suma los GRI/SASB. **Juicio mío, por título**; se confirma
con el documento que suba RH.

| Solicitud | Nivel mínimo (ya en el catálogo) | Necesita nivel medio |
|---|---|---|
| 1. Política de Inversión Responsable (S2 25(a)) | FN-CB-410a.2 (factores ESG en el análisis de crédito), si la política cubre crédito | — |
| 2. Política de Gestión y Comunicación Responsable (Stewardship) (S2 6(a)) | GRI 2-23 (compromisos y políticas) | — |
| 3. Declaración sobre la relevancia del desarrollo sostenible 2026 (S2 13(a)) | **GRI 2-22** (declaración sobre la estrategia de desarrollo sostenible): coincide casi literal | — |
| 4. Políticas Generales de Inversión (S2 14(a)(i)) | FN-CB-410a.2, si incluye criterios de crédito | — |
| 5. Código de Ética y Conducta | **GRI 2-23**, **2-24** (incorporación) y **2-26** (mecanismos para plantear inquietudes, si el código los trae) | GRI 205 (anticorrupción) |
| 6. Manifiesto de Tolerancia Cero a la Corrupción 2026 | GRI 2-23 (compromiso de política) | **GRI 205-2** (comunicación y formación) y 205-3 |
| 7. Política de Diversidad, Equidad e Inclusión | GRI 2-23 (compromiso), solo en parte | **GRI 405-1** y 405-2: las cifras de diversidad son 405 |
| 8. Política de Integridad y Anticorrupción | **GRI 2-23**, **2-26**; **2-27** solo si informa casos de incumplimiento y multas (una política no los da: hace falta una cifra) | GRI 205-1 a 205-3 |
| 9. Política de Privacidad | GRI 2-23, solo en parte | **GRI 418-1** (reclamaciones por violación de la privacidad; pide cifras) y, para un banco, **FN-CB-230a.1/230a.2** (seguridad de datos: ya en el mínimo) |

En resumen:
- **Solo con el nivel mínimo:** la 3 (2-22); la 2, 5 y 8 (2-23, 2-24, 2-26); la 1 y la 4 (FN-CB-410a.2, según su
  contenido); y la 9 en parte (FN-CB-230a.2).
- **Necesitan el nivel medio:** la 6 (205), la 7 (405), la 8 en su parte de 205, y la 9 en su parte de 418.
- **Ninguna de las nueve da cifras:** 2-27, 205-3, 405-1 y 418-1 piden números que una política no trae.

### 1.3 FN-CB en la hoja «Métricas SASB» del Formato

**Hoy:** `preparar-plantilla.mjs` deja la hoja vacía, sin celdas combinadas y con solo «Métricas por industria (SASB)»
en A1. `llenar.ts` no la toca, y las 68 secciones [8xxxxx] de la hoja de estructura van vacías («fuera de alcance»). En
el Formato de dev (v32) la hoja tiene esa sola celda.

**Con las 17 métricas y sus respuestas:**
- Una fila de encabezado (Código / Métrica / Respuesta) y una fila por métrica de la industria del Perfil, en el orden
  de la norma (contables por tema y después las de actividad).
- La métrica va con su texto literal, en inglés.
- La respuesta sale de `respuestas_datapoint` con la regla del Formato: pendiente o sin respuesta deja la celda vacía
  (CLAUDE.md §5).
- La plantilla de la BMV no se toca: se escribe sobre la hoja que ya existe, con `llenar.ts`/`export-formato`.
- La categoría y la unidad de la tabla SASB **no** están en el catálogo. Si las quieres como columnas, hacen falta
  dos columnas más en `datapoints_taxonomia` (migración aditiva) o sacarlas del PDF al generar. Por defecto no las
  propongo.

**Emisora sin sector SASB:** la hoja queda como hoy (solo A1). NIIF S2 32 (K866–K870), el juicio de K786/K787 y las
[8xxxxx] no cambian. Con sector SASB pero sin métricas de esa industria en el catálogo (cualquiera menos FN-CB, en el
mínimo), igual: solo A1. El validador del Formato lo avisaría, como ya avisa el juicio «No» con sector capturado.

### 1.4 Estimación y fases propuestas

| Parte | Qué | Jornadas | Costo del modelo |
|---|---|---|---|
| A | Vía de respuestas GRI/SASB en `generarRespuestas`: incluir los marcos (SASB por industria), tabla código → bloque(s) y claves (fuente prestada), vía «evidencia directa» para extractos confirmados de solicitudes ligadas, captura cuantitativa (ya existe), pendiente con marcador; validadores y e2e sin modelo | 2–2.5 | — |
| B | Datos del demo: ligar en `poblar-demo` las 17 solicitudes de tema GRI 2/FN-CB (y las del Perfil que correspondan); FN-CB cuantitativas que falten (000.A cuentas por segmento, 000.B préstamos por segmento, 410b.1–410b.3 emisiones financiadas, si el demo las declara, o su negativa); plantilla de solicitudes | 0.75–1 | — |
| C | Hoja «Métricas SASB» del Formato con las métricas de la industria y sus respuestas | 0.5–0.75 | — |
| D | Generación en el demo: con la corrida del libro v6 (el 1 de noviembre o después, «esperan v6») y la nueva aprobación, una sola corrida produce NIIF y GRI/SASB | 0.25 | ~54 respuestas, ~0.3–0.5 USD (sin regenerar bloques) |
| E | `traceline-dev` con humo, PR y runbook (sin migración, salvo que se pida categoría/unidad) | 0.75 | — |
| **Total** | | **~4.25–5.25** | **~0.5 USD** |

**Fases:**
1. **2a:** partes A y C, en código, probadas en local sin modelo. Parada con la tabla código → fuente para revisión.
2. **2b:** parte B en dev, sin generar. Parada con la tabla de las 54 filas: código, vía y fuente que la responderá.
3. **2c:** parte D, dentro de la corrida v6 ya prevista: el libro GRI/SASB y la hoja «Métricas SASB» del demo con
   respuestas, y las que no tengan fuente, con su marcador. Parada con el libro.
4. **3:** parte E.

Así la Fase 2 no gasta una corrida aparte ni pide subir el tope: entra en la v6.

### 1.5 Preguntas

1. ¿Fases 2a–2c y la estimación como están?
2. ¿Un contenido GRI que repite un requisito NIIF ya respondido **remite** («Ver NIIF S2 6(a)»), sin modelo, o lleva
   **respuesta propia** resumida de la misma sección?
3. ¿«Métricas SASB» con solo Código / Métrica / Respuesta, o también categoría y unidad (dos columnas más en el
   catálogo, con migración)?
4. ¿Ligo ya en staging las nueve solicitudes de demostración a sus códigos del mínimo (§1.2)? Lo correrías tú, con un
   script como el de su creación.

### 1.6 Decisiones de Esteban sobre la Fase 2 (31/10/2026)

1. **Fase 2 aprobada, con un cambio:** la 2c (respuestas GRI/SASB del demo) corre **después de la aprobación del v6**,
   como regeneración de respuestas sin libro nuevo, no dentro de la corrida.
2. **Respuesta propia** desde la misma sección cuando un contenido GRI coincide con un NIIF ya respondido; nada de
   remisiones.
3. **Hoja «Métricas SASB»** con Código / Métrica / Respuesta, sin migración.
4. **Script de ligado** de las nueve solicitudes de staging a sus códigos del nivel mínimo, para el día de v45, después
   de las migraciones; probado en local.

### 1.7 Tabla código → sección (Fase 2a, en seco)

`lib/suplemento/gri-sasb.ts` (`FUENTE_GRI_SASB`): por contenido, los bloques que lo tratan y la expresión que reconoce
su tema en los hechos de esos bloques. Orden de las vías: captura confirmada → sección aprobada (el primer bloque de la
lista, aprobado, con hechos del tema) → evidencia directa (extractos confirmados de las solicitudes ligadas) →
pendiente. Planeada sobre el documento aprobado v5 del demo en dev **sin llave del modelo y sin guardar** (costo 0):

| Código | Bloques de la tabla | Vía en el demo (dev, documento v5) | Sección o fuente | Hechos del tema | Sin modelo |
|---|---|---|---|---:|---|
| `FN-CB-000.A` | — | pendiente | — |  | Pendiente: marcador |
| `FN-CB-000.B` | — | pendiente | — |  | Pendiente: marcador |
| `FN-CB-230a.1` | — | pendiente | — |  | Pendiente: marcador |
| `FN-CB-230a.2` | — | pendiente | — |  | Pendiente: marcador |
| `FN-CB-240a.1` | — | pendiente | — |  | Pendiente: marcador |
| `FN-CB-240a.2` | — | pendiente | — |  | Pendiente: marcador |
| `FN-CB-240a.3` | — | captura | Cuentas sin costo abiertas a clientes antes no bancarizados o subbancarizados 2025 |  | 21,500 cuentas (ejercicio 2025). |
| `FN-CB-240a.4` | — | captura | Participantes en iniciativas de educación financiera 2025 |  | 14,200 participantes (ejercicio 2025). |
| `FN-CB-410a.2` | 27, 22 | sección | 27 · Gestión y mitigación de riesgos y oportunidades | 10 | respaldo con oraciones ancladas |
| `FN-CB-410b.1` | 33 | pendiente | — |  | Pendiente: marcador |
| `FN-CB-410b.2` | 33, 34 | sección | 34 · Riesgos de transición: concentración, exposición y capital | 9 | respaldo con oraciones ancladas |
| `FN-CB-410b.3` | 33 | pendiente | — |  | Pendiente: marcador |
| `FN-CB-410b.4` | 33 | pendiente | — |  | Pendiente: marcador |
| `FN-CB-510a.1` | — | captura | Pérdidas monetarias por procedimientos legales 2025 |  | 0 MDP (ejercicio 2025). |
| `FN-CB-510a.2` | — | pendiente | — |  | Pendiente: marcador |
| `FN-CB-550a.1` | — | pendiente | — |  | Pendiente: marcador |
| `FN-CB-550a.2` | 26, 34 | sección | 26 · Resiliencia de la estrategia y análisis de escenarios | 1 | respaldo con oraciones ancladas |
| `GRI 2-1` | 2, 4 | sección | 4 · Entidad que informa, periodo y conectividad | 2 | respaldo con oraciones ancladas |
| `GRI 2-2` | 4 | sección | 4 · Entidad que informa, periodo y conectividad | 6 | respaldo con oraciones ancladas |
| `GRI 2-3` | 2, 4 | pendiente | — |  | Pendiente: marcador |
| `GRI 2-4` | 3, 6 | pendiente | — |  | Pendiente: marcador |
| `GRI 2-5` | 2, 30 | sección | 30 · Método de medición y datos de entrada | 1 | respaldo con oraciones ancladas |
| `GRI 2-6` | 12, 13 | sección | 12 · Modelo de negocio y cadena de valor | 10 | respaldo con oraciones ancladas |
| `GRI 2-7` | — | captura | Plantilla y rotación de personal 2025 |  | 2,860 personas (ejercicio 2025). |
| `GRI 2-8` | — | pendiente | — |  | Pendiente: marcador |
| `GRI 2-9` | 15, 18 | sección | 15 · Roles y responsabilidades del órgano de gobierno | 35 | respaldo con oraciones ancladas |
| `GRI 2-10` | 15, 18 | pendiente | — |  | Pendiente: marcador |
| `GRI 2-11` | 15, 18 | pendiente | — |  | Pendiente: marcador |
| `GRI 2-12` | 15, 16 | sección | 15 · Roles y responsabilidades del órgano de gobierno | 31 | respaldo con oraciones ancladas |
| `GRI 2-13` | 15, 17 | sección | 15 · Roles y responsabilidades del órgano de gobierno | 29 | respaldo con oraciones ancladas |
| `GRI 2-14` | 15, 16, 2 | sección | 15 · Roles y responsabilidades del órgano de gobierno | 15 | respaldo con oraciones ancladas |
| `GRI 2-15` | 18, 15 | pendiente | — |  | Pendiente: marcador |
| `GRI 2-16` | 16, 17, 15 | sección | 16 · Supervisión de la estrategia, objetivos y remuneración | 17 | respaldo con oraciones ancladas |
| `GRI 2-17` | 15 | sección | 15 · Roles y responsabilidades del órgano de gobierno | 14 | respaldo con oraciones ancladas |
| `GRI 2-18` | 15, 16 | pendiente | — |  | Pendiente: marcador |
| `GRI 2-19` | 16, 37 | sección | 16 · Supervisión de la estrategia, objetivos y remuneración | 6 | respaldo con oraciones ancladas |
| `GRI 2-20` | 16, 37 | sección | 16 · Supervisión de la estrategia, objetivos y remuneración | 6 | respaldo con oraciones ancladas |
| `GRI 2-21` | — | pendiente | — |  | Pendiente: marcador |
| `GRI 2-22` | 1 | sección | 1 · Carta de la Dirección | 1 | respaldo con oraciones ancladas |
| `GRI 2-23` | 27, 17 | pendiente | — |  | Pendiente: marcador |
| `GRI 2-24` | 27, 17 | sección | 27 · Gestión y mitigación de riesgos y oportunidades | 5 | respaldo con oraciones ancladas |
| `GRI 2-25` | — | pendiente | — |  | Pendiente: marcador |
| `GRI 2-26` | — | pendiente | — |  | Pendiente: marcador |
| `GRI 2-27` | — | pendiente | — |  | Pendiente: marcador |
| `GRI 2-28` | 19, 1 | sección | 19 · Trayectoria en sostenibilidad y clima | 1 | respaldo con oraciones ancladas |
| `GRI 2-29` | 7 | pendiente | — |  | Pendiente: marcador |
| `GRI 2-30` | — | pendiente | — |  | Pendiente: marcador |
| `GRI 3-1` | 7 | sección | 7 · Materialidad: contexto y proceso | 2 | respaldo con oraciones ancladas |
| `GRI 3-2` | 7 | pendiente | — |  | Pendiente: marcador |
| `GRI 3-3` | 7, 27 | sección | 27 · Gestión y mitigación de riesgos y oportunidades | 7 | respaldo con oraciones ancladas |
| `GRI 303-5` | — | pendiente | — |  | Pendiente: marcador |
| `GRI 306-3` | — | pendiente | — |  | Pendiente: marcador |
| `GRI 401-1` | — | captura | Índice de rotación voluntaria 2025 (%) |  | 11.8 % (ejercicio 2025). |
| `GRI 404-1` | — | pendiente | — |  | Pendiente: marcador |

Notas de la tabla:
- **«Sin modelo»** es lo que sale hoy sin llave: por sección, el respaldo de oraciones ancladas; con modelo, en la 2c,
  una respuesta propia del contenido, validada.
- **Evidencia directa: 0 en el demo.** Las solicitudes ligadas a GRI/SASB del demo caen antes en captura o en sección.
  La vía la ejercitan el e2e y las nueve de staging cuando RH suba sus documentos.
- **Temas ajustados al revisar la tabla:**
  - GRI 2-3 tomaba la cartera por «31 de diciembre»;
  - FN-CB-410a.2 tomaba la matriz de riesgos, porque «ESG» sin límite de palabra casa dentro de «riesgos»;
  - FN-CB-550a.2 tomaba el análisis de escenarios;
  - GRI 2-23 tomaba una decisión de riesgo, no una política.

  Revisados y aceptados: GRI 2-5 (inventario verificado por un tercero con aseguramiento limitado) y FN-CB-550a.2 (la
  prueba de estrés de cartera reduce el ICAP).
- **Quedan 29 pendientes:** contenidos sin sección ni fuente en el demo (2-3, 2-4, 2-8, 2-10, 2-11, 2-15, 2-18, 2-21,
  2-23, 2-25 a 2-27, 2-29, 2-30, 3-2), la Extensión GRI sin captura que corresponda (303-5, 306-3, 404-1) y 12
  métricas FN-CB sin dato.

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
| 31/10/2026 | **Desviación de regla** (anotada a pedido de Esteban) | La migración `20261031140000_catalogo_extension_gri_literal` se aplicó en dev **sin la parada del SQL**: implementaba la decisión del mismo mensaje (Extensión GRI literal y partida por contenido), pero su SQL no se presentó antes de aplicarla, como pide la práctica del encargo para toda migración contra dev. Es una desviación de regla, no un error de resultado: el SQL está en `~/Downloads/catalogo-gri-sasb/`, la foto de Cobertura dio exactamente la diferencia esperada y NIIF no cambió. En adelante, toda migración nueva se presenta antes de aplicarla en dev, aunque la decisión que implementa ya esté tomada | Anotado |
| 31/10/2026 | **Fase 2 · Paso 0** (lectura), parada | Hoy `generarRespuestas` excluye GRI y SASB (`startsWith("NIIF")`): las 54 dicen «En preparación». La captura cuantitativa ya serviría; para texto falta una vía («evidencia directa») porque una solicitud ligada solo a GRI/SASB no entra al libro de hechos; GRI 2 puede tomar como fuente bloques NIIF aprobados (lectura, sin regenerar). Nueve de staging: 2-22, 2-23, 2-24, 2-26 y FN-CB-410a.2/230a.2 en el mínimo; 205, 405 y 418 en el medio. «Métricas SASB» hoy solo con su título; con FN-CB, Código/Métrica/Respuesta. ~4.25–5.25 jornadas, ~0.5 USD dentro de la corrida v6 | **Parada:** §1.5 |
| 31/10/2026 | **Fase 2 aprobada** (§1.6) y **Fases 2a y 2b**, parada con la tabla código → sección | **2a:** `generarRespuestas` incluye GRI y SASB (SASB solo de la industria del Perfil) con `lib/suplemento/gri-sasb.ts`: captura → sección aprobada (`FUENTE_GRI_SASB`, §1.7) → evidencia directa (`responderEvidencia`: extractos confirmados de las solicitudes ligadas, mismos validadores y reintentos que las NIIF, lotes de 8) → pendiente con marcador; sin remisión «Ver sección» en GRI/SASB; solo destino «taxonomia». Hoja «Métricas SASB» del Formato (`lib/formato/metricas-sasb.ts`): Código / Métrica / Respuesta, pendiente vacío. **Pruebas:** `e2e-respuestas-gri-sasb` (nuevo) 26 en verde (sección 15 y 7, captura, evidencia sin modelo → pendiente, sin sector → 0 SASB, libro y Formato); validadores 90, métricas 19, Formato 29, alivios 20, respuestas 22, regeneración 9, declaraciones 20 y catálogo 34 contra el stack local; `tsc` y eslint limpios. **Script de ligado de staging** `~/Downloads/solicitudes-demo-rh/ligar-gri-sasb-demo-rh.mjs` (revisar y `--aplicar`, comandos L1–L4 en `comandos.md`): en local, 12 enlaces nuevos, los 6 de antes conservados, 9 filas de bitácora de demostración, segunda pasada en cero; local limpio después. **2b en dev** (`poblar-demo.mjs --solo gri-sasb`, contenido §7b): 9 de las 17 solicitudes con tema GRI 2/FN-CB ligadas; 8 no, con su razón (horas de capacitación es un total y 404-1 pide promedio; mujeres en plantilla es 405; cartera total, sostenible y expuesta no son métricas FN-CB tal cual; Alcance 3 y créditos de carbono no son GRI 2 ni FN-CB). Tres métricas FN-CB nuevas validadas con captura y extracto (240a.3, 240a.4, 510a.1), lectura omitida (0 lecturas pendientes del demo); segunda corrida sin cambios. **Tabla en seco** sobre el v5 de dev: 20 por sección, 5 por captura, 29 pendientes, costo 0. **Errores propios:** la primera corrida del e2e se cayó antes de su limpieza (el trigger de evidencias ya crea la fila de lectura); limpié a mano lo que dejó en el stack local (documento, libro, dos solicitudes, fila de perfil; tenant de vuelta a generador apagado y tope 10) y moví la preparación dentro del bloque con limpieza. Cuatro temas demasiado amplios en la primera tabla (§1.7), ajustados | **Parada:** tabla código → sección; nada generado con modelo |

