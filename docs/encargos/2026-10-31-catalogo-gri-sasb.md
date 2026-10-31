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

**`normas/`.** Solo tiene NIIF S1 y S2, en español e inglés. **No hay ningún documento de GRI ni de SASB.**
Tendrían que entrar, sin versionarse (CLAUDE.md §4):
- GRI 1, 2 y 3 (2021) y las temáticas en su edición vigente. La traducción oficial al español es del 1/08/2022.
- Las normas SASB por industria, en la versión que se adopte: FN-CB va en «VERSION 2025-12».

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
| **Datapoints nuevos** | 30 + 3 + ~14 de FN-CB (12 contables y 2 de actividad; confirmar contra la versión 2025-12) ≈ **47** | ≈ **53** más (201:4, 205:3, 302:5, 303:5, 305:7, 306:5, 401:3, 403:10, 404:3, 405:2, 406:1, 408:1, 409:1, 413:2, 418:1), ≈ 100 en total | ~11 industrias más (abajo), ~10–15 métricas cada una: ≈ **120–170** más |
| **Vínculo con solicitudes** | El de siempre (`mapeo_solicitud_datapoint`, lo hace el staff). En el demo, 2 o 3 solicitudes nuevas para FN-CB (`poblar-demo`); GRI 2 se cubre en gran parte con Perfil y Gobierno | Se re-mapean ~15 de los 37 renglones de la plantilla (columna `datapoint_ids`) y las solicitudes ya creadas que se quieran; las 4 GRI actuales pasan a su código propio (decisión 6) | Por mockup, solicitudes SASB nuevas con `crear-demo-prospecto` (sin regenerar contraseñas, como siempre) |
| **Cobertura** | Dos secciones propias, «GRI» y «SASB · industria», **con conteo aparte**, fuera del avance NIIF (el patrón de «Extensión GRI»). La foto de despliegue sigue contando NIIF | Igual | Igual, filtrando SASB por el `sector_sasb` del Perfil |
| **Migraciones** | (1) CHECK de `marco` sustituido por uno más amplio (`'NIIF','GRI','SASB'`); (2) columnas nullable `estandar` (p. ej. «GRI 305», «SASB FN-CB»), `edicion` y `tipo_metrica`; (3) datos idempotentes del catálogo, una fila por cambio en `auditoria-catalogo.md`. Todas aditivas y con barrera | (3) con más filas; re-código de las 4 GRI | (3) con más filas |
| **Salidas** | Formato: [815200] con las filas de FN-CB, o la hoja «Métricas SASB» (decisión 3). Libro aparte con el índice GRI 2/3 | Más el índice GRI temático | Más las [8xxxxx] de cada sector |
| **Jornadas** | **~5–6**: esquema y catálogo 1.5; FN-CB del demo 1; Cobertura 1; Formato y libro aparte 1.5; runbook 0.5 | **+3–4**, ≈ 9 | **+6–8**, ≈ 15–17 |
| **Costo del modelo** | ~0 (catálogo y salidas por regla); regenerar el bloque de NIIF S2 32 del demo, ~0.3 USD | ~0 | ~0 |

Industrias SASB probables de los 20 mockups. Es **juicio mío, por giro; hay que confirmarlas** con el `sector_sasb`
de cada Perfil en staging:

| Industria | Mockups |
|---|---|
| IF-RE, bienes raíces | GAV, Fibra Inn, Planigrupo, Frisa, O'Donnell |
| IF-HB, desarrolladores de vivienda | CADU, Inmobilia |
| FN-CB, bancos comerciales | Afirme, Banco Base |
| FN-CF, crédito al consumo | TRATON FS, Montepío |
| FN-AC, gestión y custodia de activos | Fondo de Fondos, AINDA, Portafolio Durango |
| FB-MP, carne, aves y lácteos | Bafar |
| EM-CM, materiales de construcción | GCC |
| IF-EN, ingeniería y construcción | CLEPSA, PINFRA |
| TC-TL, telecomunicaciones | Megacable |
| CG-BF o IF-WU | Rotoplas |

Carso agrega CG-MR, RT-EE, IF-EN y EM-CM.

**El Informe Anual GRI/SASB queda fuera de los tres niveles.** Es un encargo aparte, estimado en más de 10 jornadas.

### 0.4 Licencias

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

---

## 5. Decisiones de Esteban (pendientes)

1. **Licencias.** Ninguna carga empieza sin esta decisión. Las opciones:
   - **(a)** pedir cotización a la Fundación IFRS (SASB, y regularizar S1/S2) y al programa de GRI, y no cargar texto
     hasta tener contrato;
   - **(b)** cargar solo códigos y títulos cortos, sin el texto del requisito, con permiso escrito de GRI y de IFRS;
   - **(c)** solo GRI, que tiene traducción oficial al español, con licencia de GRI, y SASB después.

   Además: quién lleva el contacto, y si pasa por asesoría legal de propiedad intelectual.
2. **Nivel:** mínimo, medio o completo (§0.3). Mi recomendación es el mínimo, para tener FN-CB en el demo y el índice
   GRI 2/3, con el medio como segunda entrega.
3. **FN-CB en el Formato:** ¿insertar las filas de métrica dentro de [815200] (cambia la plantilla en Storage y lleva
   runbook con plantilla) o escribir la tabla en la hoja «Métricas SASB» (sin tocar la estructura)?
4. **Excel:** ¿libro aparte para GRI y SASB, que es mi propuesta, o filas en el Excel de taxonomía?
5. **Edición de las normas:** ¿GRI 2021 con 302 y 305, o ya GRI 102 y 103 (2025)? ¿SASB FN-CB «2025-12»?
6. **Las 4 GRI actuales:** ¿partir `GRI 2-7 / 401-1` en dos códigos y re-mapear las solicitudes (dato del cliente),
   o dejarlo compuesto?
7. **Columna `norma`:** ¿columnas nuevas `estandar` y `edicion` (mi propuesta), o un valor nuevo en el enum
   `norma_niif` (va en migración propia)?

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
