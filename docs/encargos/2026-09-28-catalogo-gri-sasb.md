# Encargo: Fase C · Catálogo GRI y SASB

**Responsable:** Quique
**Rama:** `feat/catalogo-gri-sasb` desde `dev/ajustes-sep26`
**Fecha de inicio:** 28 de septiembre de 2026 · **Entrega estimada:** por acordar en el Paso 0
**Referencia en la especificación:** `docs/suplemento-s1s2/especificacion.md` §1 (Fase C), §4 y §5;
`docs/suplemento-s1s2/auditoria-catalogo.md` como modelo de rigor.

### 1. Objetivo

Extraer los estándares GRI y SASB a la estructura de `datapoints_taxonomia` (código, título, descripción del
requisito, marco, versión, sector cuando aplique, fuente del texto en español), con un glosario ES↔EN de
terminología oficial, para que los menús GRI y SASB y el generador puedan usarlos. Entregable: archivos de datos
revisables y una migración de datos idempotente propuesta, **sin cargar nada** en ningún proyecto compartido.

### 2. Alcance

Incluye: GRI Universal Standards (1, 2, 3) y los estándares temáticos; SASB para las industrias de los 17
tenants de staging (bancos comerciales, bienes raíces, construcción de vivienda, materiales de construcción,
alimentos, telecomunicaciones, infraestructura de transporte, financieras no bancarias); glosario ES↔EN;
documento de metodología con las decisiones de traducción.

No incluye: menús ni pantallas; cambios al generador; carga en dev de Esteban o en staging; GRI sectoriales.

### 3. Qué toca y qué no

Toca: `docs/catalogo/` (nuevo), `supabase/migrations/<fecha>_catalogo_gri_sasb.sql` (propuesta, aplicada solo
en su propio proyecto), `scripts/validar-catalogo-gri-sasb.mjs`.

No toca: `lib/suplemento/*`, `lib/reporte/*`, `datapoints_taxonomia` de ningún proyecto ajeno, `seed.sql`.

Ambiente: solo el proyecto Supabase propio de Quique.

### 4. Definición de terminado (verificable)

- `tsc` limpio, `eslint` sin errores nuevos, `npm run verify:export` verde.
- Archivo por estándar en `docs/catalogo/gri/` y `docs/catalogo/sasb/<industria>/` con todas las columnas y
  la fuente del español por fila (oficial / propia).
- Glosario `docs/catalogo/glosario-es-en.md` con término, fuente y ejemplo de uso.
- Validador que confirme: sin códigos duplicados, sin colisiones con los 98 códigos NIIF actuales, sin filas
  con descripción vacía, versión del estándar en cada fila.
- Migración aplicada dos veces en su propio proyecto sin error (idempotencia) y `validarMapeo()` con 0
  faltantes después.
- Muestra de 30 filas (10 GRI, 20 SASB) revisadas por alguien de IRStrat con oficio en GRI, con su visto bueno
  registrado en §7.
- PR abierto hacia `dev/ajustes-sep26` con descripción que siga el formato de reporte (§7 de CLAUDE.md).

### 5. Entregables intermedios

- **Paso 0 (obligatorio):** resumen de una página con qué se entendió, cómo se va a hacer, qué se va a tocar y
  qué no. Se aprueba antes de escribir código.
- Paso 1: GRI 2 completo como prueba de formato; revisión antes de seguir.
- Paso 2: el resto de GRI.
- Paso 3: SASB por industria.
- Paso 4: glosario y migración.

### 6. Riesgos y dudas conocidas

- La licencia permite traducir alineándose a la terminología oficial; toda traducción propia queda marcada.
- Las traducciones oficiales de GRI no cubren todos los estándares ni todas las versiones: el inglés vigente
  es la fuente de verdad y el español se construye encima.
- SASB no tiene traducción oficial: toda su descripción en español es traducción propia y requiere revisión.
- El script `scripts/poblar-demo.mjs` aborta si la URL de Supabase no es un ref de dev autorizado. Para que
  Quique pueda reproducir el demo en su propio proyecto, su ref tiene que estar en `DEV_REFS_AUTORIZADOS` de
  su `.env.local`.

### 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| 2026-09-28 | Encargo entregado | |
