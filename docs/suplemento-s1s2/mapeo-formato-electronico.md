# Mapeo concepto ↔ datapoint del Formato electrónico NIIF S1/S2

Encargo `2026-10-13-excel-respuestas-narrativas`, Paso 1. Generado por `scripts/formato/mapear-formato.mjs` (sin modelo) desde el asset `Estructura_Formato_NIIF_S1_S2_Autlan.xlsx` (sha256 `69b062137cd8`, hoja «Estructura Formato Electronico») y el catálogo de dev. **Pendiente de la revisión de Esteban** (revisión de IRStrat) en `referencia/formato-electronico/mapeo-revision.xlsx`.

Conforme a CLAUDE.md §4, este archivo no reproduce texto del formato: cada concepto se identifica por su **fila** en el asset, su sección y los párrafos que cita. Las etiquetas están en el asset y en el Excel de revisión (fuera de git).

## Resumen

- Filas en alcance: **370** (secciones [100000]–[211300] y [901000]; [8xxxxx] SASB fuera, Fase C).
- Clasificación: encabezado 44 · concepto 256 · subconcepto 58 · encabezado narrativo 7 · fuera de alcance (SASB, Fase C) 2 · miembro de tabla 3.
- Capa que resolvió: — 49 · regla fija 11 · Perfil 20 · 3 · revisión (S1→S2) 44 · 3 · revisión 11 · 1 · fuente 165 · 3 · revisión (tabla) 9 · 2 · etiqueta 29 · 1 · correspondencia S1→S2 17 · 3 · revisión (regla) 5 · regla primer año 8 · sin candidato 2.
- Confianza: — 52 · alta 316 · media 2.
- Con datapoint propuesto: 262; con bloque dueño: 265.

- Revisión de Esteban (`mapeo-revision.xlsx`): (sin decisión) 222 · regla fija 11 · subconcepto 1 · Perfil o reporte 6 · regla S1→S2 43 · encabezado narrativo 4 · confirmada 6 · tabla 8 · encabezado 39 · regla 5 · datapoint y bloque 7 · primer año 8 · corrección de Ref 1 · sector financiero 4 · confirmada (sector financiero) 3 · fuera de alcance 2. No interpretadas: ninguna.
- Llevan la oración fija del alivio E5: 88.

## Conceptos

| Fila | Sección | Tipo | Clasificación | Párrafos citados | Datapoint propuesto | Capa | Confianza | Bloque | E5 | Revisión | Regla de llenado |
|---:|---|---|---|---|---|---|---|---:|:-:|---|---|
| 4 | 100000 | abstract | encabezado | — | — | — | — | — |  |  | Sin respuesta (encabezado) |
| 5 | 100000 | text | concepto | — | — | regla fija | alta | — |  | regla fija (asesor (aceptada por Esteban)) | Regla fija: título «Informe de Sostenibilidad y Clima {reporte.ejercicio}». No es campo de Perfil |
| 6 | 100000 | enumeración | concepto | — | perfil.tipo_instrumento (nuevo) | Perfil | alta | — |  |  | Desde perfil.tipo_instrumento (nuevo) |
| 7 | 100000 | enumeración | subconcepto de la fila 6 | — | — | Perfil | alta | — |  | subconcepto (asesor (aceptada por Esteban)) | Lista de opciones de la fila 6 |
| 8 | 100000 | text block | concepto | — | perfil.clave_cotizacion (nuevo) | Perfil | alta | — |  |  | Desde perfil.clave_cotizacion (nuevo) |
| 9 | 100000 | text block | concepto | — | perfil.logo | Perfil | alta | — |  |  | Desde perfil.logo |
| 10 | 100000 | text block | concepto | — | perfil.denominacion_formal | Perfil | alta | — |  |  | Desde perfil.denominacion_formal |
| 11 | 100000 | text block | concepto | — | reporte.ejercicio | Perfil | alta | — |  |  | Desde reporte.ejercicio |
| 13 | 100000 | text block | concepto | — | perfil.clave_cotizacion (nuevo) | Perfil | alta | — |  |  | Desde perfil.clave_cotizacion (nuevo) |
| 14 | 100000 | text block | concepto | — | perfil.fiduciario (nuevo) | Perfil | alta | — |  |  | Desde perfil.fiduciario (nuevo) |
| 15 | 100000 | text block | concepto | — | perfil.fiduciario (nuevo) | Perfil | alta | — |  |  | Desde perfil.fiduciario (nuevo) |
| 16 | 100000 | text block | concepto | — | perfil.logo | Perfil | alta | — |  |  | Desde perfil.logo |
| 17 | 100000 | text block | concepto | — | perfil.denominacion_formal | Perfil | alta | — |  |  | Desde perfil.denominacion_formal |
| 18 | 100000 | (sin tipo) | subconcepto de la fila 17 | — | — | Perfil | alta | — |  |  | Se responde junto con la fila 17 (text block) |
| 19 | 100000 | text block | concepto | — | perfil.denominacion_formal | Perfil | alta | — |  |  | Desde perfil.denominacion_formal |
| 20 | 100000 | text block | concepto | — | perfil.numero_fideicomiso (nuevo) | Perfil | alta | — |  | Perfil o reporte (asesor (aceptada por Esteban)) | Desde perfil.numero_fideicomiso (campo nuevo): solo cuando tipo_instrumento = fideicomiso; |
| 21 | 100000 | text block | concepto | — | reporte.ejercicio | Perfil | alta | — |  |  | Desde reporte.ejercicio |
| 24 | 200000 | abstract | encabezado | NIIF S1 26; NIIF S2 5 | — | — | — | — |  |  | Sin respuesta (encabezado) |
| 25 | 200000 | text block | concepto | NIIF S1 27 (a); NIIF S2 6 (a) | NIIF S2 6 (a) | 3 · revisión (S1→S2) | alta | 15 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 15 aprobado y los hechos de NIIF S2 6 (a) · lleva la oración fija del alivio E5 |
| 26 | 200000 | (sin tipo) | concepto | NIIF S1 27 (a); NIIF S2 6 (a) | NIIF S2 6 (a) | 3 · revisión (S1→S2) | alta | 15 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 15 aprobado y los hechos de NIIF S2 6 (a) · lleva la oración fija del alivio E5 |
| 27 | 200000 | text | encabezado narrativo | — | — | 3 · revisión | alta | 15 |  | encabezado narrativo (asesor (aceptada por Esteban)) | Párrafo introductorio desde el bloque 15 aprobado |
| 28 | 200000 | text block | concepto | NIIF S1 27 (a)(i); NIIF S2 6 (a)(i) | NIIF S2 6 (a)(i) | 3 · revisión (S1→S2) | alta | 15 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 15 aprobado y los hechos de NIIF S2 6 (a)(i) · lleva la oración fija del alivio E5 |
| 30 | 200000 | text block | concepto | NIIF S1 27 (a)(ii); NIIF S2 6 (a)(ii) | NIIF S2 6 (a)(ii) | 3 · revisión (S1→S2) | alta | 15 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 15 aprobado y los hechos de NIIF S2 6 (a)(ii) · lleva la oración fija del alivio E5 |
| 32 | 200000 | text block | concepto | NIIF S1 27 (a)(iii); NIIF S2 6 (a)(iii) | NIIF S2 6 (a)(iii) | 3 · revisión (S1→S2) | alta | 16 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 16 aprobado y los hechos de NIIF S2 6 (a)(iii) · lleva la oración fija del alivio E5 |
| 34 | 200000 | text block | concepto | NIIF S1 27 (a)(iv); NIIF S2 6 (a)(iv) | NIIF S2 6 (a)(iv) | 3 · revisión (S1→S2) | alta | 16 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 16 aprobado y los hechos de NIIF S2 6 (a)(iv) · lleva la oración fija del alivio E5 |
| 36 | 200000 | text block | concepto | NIIF S1 27 (a)(v); NIIF S2 6 (a)(v); NIIF S2 6; NIIF S2 29 (g)(i) | NIIF S2 6 (a)(v) | 3 · revisión (S1→S2) | alta | 16 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 16 aprobado y los hechos de NIIF S2 6 (a)(v) · lleva la oración fija del alivio E5 |
| 38 | 200000 | booleano | concepto | NIIF S1 27 (a)(v); NIIF S2 6 (a)(v) | NIIF S2 6 (a)(v) | 3 · revisión (S1→S2) | alta | 16 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 16 aprobado y los hechos de NIIF S2 6 (a)(v) · lleva la oración fija del alivio E5 |
| 39 | 200000 | (sin tipo) | concepto | NIIF S1 27 (a)(v); NIIF S2 6 (a)(v) | NIIF S2 6 (a)(v) | 3 · revisión (S1→S2) | alta | 16 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 16 aprobado y los hechos de NIIF S2 6 (a)(v) · lleva la oración fija del alivio E5 |
| 41 | 200000 | (sin tipo) | concepto | NIIF S1 27 (a)(v); NIIF S2 6 (a)(v) | NIIF S2 6 (a)(v) | 3 · revisión (S1→S2) | alta | 16 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 16 aprobado y los hechos de NIIF S2 6 (a)(v) · lleva la oración fija del alivio E5 |
| 43 | 200000 | text | concepto | NIIF S1 27 (b); NIIF S2 6 (b) | NIIF S2 6(b) | 3 · revisión (S1→S2) | alta | 17 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 17 aprobado y los hechos de NIIF S2 6(b) · lleva la oración fija del alivio E5 |
| 44 | 200000 | booleano | concepto | NIIF S1 27 (b)(i); NIIF S2 6 (b)(i) | NIIF S2 6(b)(i) | 1 · fuente | alta | 17 | sí | confirmada (asesor (aceptada por Esteban)) | Sí/No desde un hecho o declaración negativa de NIIF S2 6(b)(i) · lleva la oración fija del alivio E5 |
| 45 | 200000 | (sin tipo) | subconcepto de la fila 44 | NIIF S1 27 (b)(i); NIIF S2 6 (b)(i) | NIIF S2 6(b)(i) | 1 · fuente | alta | 17 | sí |  | Se responde junto con la fila 44 (booleano) |
| 47 | 200000 | text block | concepto | NIIF S1 27 (b)(i); NIIF S2 6 (b)(i) | NIIF S2 6(b)(i) | 3 · revisión (S1→S2) | alta | 17 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 17 aprobado y los hechos de NIIF S2 6(b)(i) · lleva la oración fija del alivio E5 |
| 49 | 200000 | booleano | concepto | NIIF S1 27 (b)(ii); NIIF S2 6 (b)(ii) | NIIF S2 6(b)(ii) | 3 · revisión (S1→S2) | alta | 17 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 17 aprobado y los hechos de NIIF S2 6(b)(ii) · lleva la oración fija del alivio E5 |
| 50 | 200000 | (sin tipo) | concepto | NIIF S1 27 (b)(ii); NIIF S2 6 (b)(ii) | NIIF S2 6(b)(ii) | 3 · revisión (S1→S2) | alta | 17 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 17 aprobado y los hechos de NIIF S2 6(b)(ii) · lleva la oración fija del alivio E5 |
| 52 | 200000 | text block | concepto | NIIF S1 27 (b)(ii); NIIF S2 6 (b)(ii) | NIIF S2 6(b)(ii) | 3 · revisión (S1→S2) | alta | 17 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 17 aprobado y los hechos de NIIF S2 6(b)(ii) · lleva la oración fija del alivio E5 |
| 54 | 200000 | abstract | encabezado | NIIF S1 28; NIIF S1 29; NIIF S2 8; NIIF S2 9 | — | — | — | — |  |  | Sin respuesta (encabezado) |
| 55 | 200000 | text | concepto | NIIF S1 30; NIIF S2 10 | NIIF S2 10(a), (b)y(c) | 1 · fuente | alta | 21 | sí |  | Modelo, desde el bloque 21 aprobado y los hechos de NIIF S2 10(a), (b)y(c) · lleva la oración fija del alivio E5 |
| 56 | 200000 | tabla | concepto | NIIF S1 30 (a); NIIF S2 10 (a); NIIF S2 11; NIIF S2 12 | NIIF S2 10(a), (b)y(c) | 1 · fuente | alta | 21 | sí |  | Tabla desde registros de clima u objetivos (NIIF S2 10(a), (b)y(c)) · lleva la oración fija del alivio E5 · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 57 | 200000 | text block | concepto | NIIF S1 30 (c); NIIF S2 10 (d); NIIF S1 31 | NIIF S2 10(d) | 3 · revisión (S1→S2) | alta | 8 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 8 aprobado y los hechos de NIIF S2 10(d) · lleva la oración fija del alivio E5 |
| 59 | 200000 | text | concepto | NIIF S1 32; NIIF S2 13; NIIF S2 23 | — | 3 · revisión (S1→S2) | media | 13 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 13 aprobado; datapoint por decidir · lleva la oración fija del alivio E5 (NIIF S2 13 → sin código propio; sus 2 incisos son del bloque 13) |
| 60 | 200000 | text block | concepto | NIIF S1 32 (a); NIIF S2 13 (a) | NIIF S2 13(a) | 3 · revisión (S1→S2) | alta | 13 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 13 aprobado y los hechos de NIIF S2 13(a) · lleva la oración fija del alivio E5 |
| 62 | 200000 | text block | concepto | NIIF S1 32 (b); NIIF S2 13 (b) | NIIF S2 13(b) | 3 · revisión (S1→S2) | alta | 13 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 13 aprobado y los hechos de NIIF S2 13(b) · lleva la oración fija del alivio E5 |
| 63 | 200000 | (sin tipo) | concepto | NIIF S1 32 (b); NIIF S2 13 (b) | NIIF S2 13(b) | 3 · revisión (S1→S2) | alta | 13 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 13 aprobado y los hechos de NIIF S2 13(b) · lleva la oración fija del alivio E5 |
| 64 | 200000 | text | concepto | NIIF S1 33; NIIF S2 14; NIIF S2 23 | — | 3 · revisión (S1→S2) | — | — | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Sin datapoint en el catálogo: «Pendiente» (NIIF S2 14(a) no existe en el catálogo) |
| 65 | 200000 | text block | concepto | NIIF S1 33 (a); NIIF S2 14 (a) | NIIF S2 14(a)(i) | 1 · fuente | alta | 22 | sí |  | Modelo, desde el bloque 22 aprobado y los hechos de NIIF S2 14(a)(i) · lleva la oración fija del alivio E5 (5 códigos del párrafo; elegido por la etiqueta) |
| 67 | 200000 | text block | concepto | NIIF S2 14 (a)(i) | NIIF S2 14(a)(i) | 1 · fuente | alta | 22 |  |  | Modelo, desde el bloque 22 aprobado y los hechos de NIIF S2 14(a)(i) |
| 68 | 200000 | (sin tipo) | subconcepto de la fila 67 | — | NIIF S2 14(a)(i) | 1 · fuente | alta | 22 |  |  | Se responde junto con la fila 67 (text block) |
| 69 | 200000 | text block | concepto | NIIF S2 14 (a)(ii) | NIIF S2 14(a)(ii) | 1 · fuente | alta | 22 |  |  | Modelo, desde el bloque 22 aprobado y los hechos de NIIF S2 14(a)(ii) |
| 70 | 200000 | (sin tipo) | subconcepto de la fila 69 | NIIF S2 14 (a)(ii) | NIIF S2 14(a)(ii) | 1 · fuente | alta | 22 |  |  | Se responde junto con la fila 69 (text block) |
| 71 | 200000 | text block | concepto | NIIF S2 14 (a)(iii) | NIIF S2 14(a)(iii) | 1 · fuente | alta | 23 |  |  | Modelo, desde el bloque 23 aprobado y los hechos de NIIF S2 14(a)(iii) |
| 72 | 200000 | (sin tipo) | subconcepto de la fila 71 | NIIF S2 14 (a)(iii) | NIIF S2 14(a)(iii) | 1 · fuente | alta | 23 |  |  | Se responde junto con la fila 71 (text block) |
| 73 | 200000 | text block | concepto | NIIF S2 14 (a)(iv) | NIIF S2 14(a)(iv) | 1 · fuente | alta | 28 |  |  | Modelo, desde el bloque 28 aprobado y los hechos de NIIF S2 14(a)(iv) |
| 75 | 200000 | text block | concepto | NIIF S2 14 (a)(v) | NIIF S2 14(a)(v) | 1 · fuente | alta | 25 |  |  | Modelo, desde el bloque 25 aprobado y los hechos de NIIF S2 14(a)(v) |
| 77 | 200000 | text block | concepto | NIIF S2 14 (b) | NIIF S2 14(b) | 1 · fuente | alta | 25 |  |  | Modelo, desde el bloque 25 aprobado y los hechos de NIIF S2 14(b) |
| 79 | 200000 | text block | concepto | NIIF S1 33 (b); NIIF S2 14 (c) | NIIF S2 14(c) | 1 · fuente | alta | 25 | sí |  | Modelo, desde el bloque 25 aprobado y los hechos de NIIF S2 14(c) · lleva la oración fija del alivio E5 |
| 81 | 200000 | text block | concepto | NIIF S1 33 (c) | NIIF S1 33(c) | 1 · fuente | alta | — |  |  | Sin bloque dueño para NIIF S1 33(c): «Pendiente» |
| 82 | 200000 | (sin tipo) | subconcepto de la fila 81 | — | NIIF S1 33(c) | 1 · fuente | alta | — |  |  | Se responde junto con la fila 81 (text block) |
| 83 | 200000 | text | encabezado narrativo | NIIF S1 34; NIIF S2 15; NIIF S2 23 | — | 3 · revisión | alta | 10 |  | encabezado narrativo (asesor (aceptada por Esteban)) | Párrafo introductorio desde el bloque 10 aprobado |
| 84 | 200000 | text | concepto | NIIF S1 36; NIIF S1 40 | NIIF S1 40(a) | 1 · fuente | alta | — |  |  | Sin bloque dueño para NIIF S1 40(a): «Pendiente» |
| 85 | 200000 | text block | concepto | NIIF S1 35 (a); NIIF S2 16 (a); NIIF S1 36; NIIF S1 40 | NIIF S2 16(a) | 3 · revisión (S1→S2) | alta | 10 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 10 aprobado y los hechos de NIIF S2 16(a) · lleva la oración fija del alivio E5 |
| 86 | 200000 | (sin tipo) | concepto | NIIF S1 35 (a); NIIF S2 16 (a); NIIF S1 36; NIIF S1 40 | NIIF S2 16(a) | 3 · revisión (S1→S2) | alta | 10 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 10 aprobado y los hechos de NIIF S2 16(a) · lleva la oración fija del alivio E5 |
| 87 | 200000 | text block | concepto | NIIF S1 35 (a); NIIF S2 16 (a); NIIF S1 36; NIIF S1 40 | NIIF S2 16(a) | 3 · revisión (S1→S2) | alta | 10 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 10 aprobado y los hechos de NIIF S2 16(a) · lleva la oración fija del alivio E5 |
| 88 | 200000 | (sin tipo) | concepto | NIIF S1 35 (a); NIIF S2 16 (a); NIIF S1 36; NIIF S1 40 | NIIF S2 16(a) | 3 · revisión (S1→S2) | alta | 10 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 10 aprobado y los hechos de NIIF S2 16(a) · lleva la oración fija del alivio E5 |
| 89 | 200000 | text block | concepto | NIIF S1 35 (a); NIIF S2 16 (a); NIIF S1 36; NIIF S1 40 | NIIF S2 16(a) | 3 · revisión (S1→S2) | alta | 10 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 10 aprobado y los hechos de NIIF S2 16(a) · lleva la oración fija del alivio E5 |
| 90 | 200000 | (sin tipo) | concepto | NIIF S1 35 (a); NIIF S2 16 (a); NIIF S1 36; NIIF S1 40 | NIIF S2 16(a) | 3 · revisión (S1→S2) | alta | 10 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 10 aprobado y los hechos de NIIF S2 16(a) · lleva la oración fija del alivio E5 |
| 91 | 200000 | text | concepto | NIIF S1 36; NIIF S1 40 | NIIF S1 40(a) | 1 · fuente | alta | — |  |  | Sin bloque dueño para NIIF S1 40(a): «Pendiente» |
| 92 | 200000 | text block | concepto | NIIF S1 35 (b); NIIF S2 16 (b); NIIF S1 36; NIIF S1 40 | NIIF S2 16(b) | 3 · revisión (S1→S2) | alta | 10 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 10 aprobado y los hechos de NIIF S2 16(b) · lleva la oración fija del alivio E5 |
| 93 | 200000 | (sin tipo) | subconcepto de la fila 92 | NIIF S1 36; NIIF S1 40 | NIIF S2 16(b) | 3 · revisión (S1→S2) | alta | 10 | sí |  | Se responde junto con la fila 92 (text block) |
| 94 | 200000 | text | concepto | NIIF S1 35 (c)(i)(ii); NIIF S2 16 (c)(i)(ii); NIIF S1 36; NIIF S1 40 | NIIF S2 16(c)(i)(ii) | 3 · revisión (S1→S2) | alta | 10 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 10 aprobado y los hechos de NIIF S2 16(c)(i)(ii) · lleva la oración fija del alivio E5 (NIIF S2 16(c) → único inciso «NIIF S2 16(c)(i)(ii)») |
| 95 | 200000 | tabla | concepto | NIIF S1 35 (c)(i)(ii); NIIF S2 16 (c)(i)(ii); NIIF S1 36; NIIF S1 40 | NIIF S2 16(c)(i)(ii) | 3 · revisión (tabla) | alta | 10 | sí | tabla (asesor (aceptada por Esteban)) | Tabla TE: tres hechos (corto/mediano/largo) de S2 16(c); si solo hay texto, el mismo texto en las tres filas con el horizonte señalado (NIIF S2 16(c) → único inciso «NIIF S2 16(c)(i)(ii)») · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 96 | 200000 | text | concepto | NIIF S1 35 (d); NIIF S2 16 (d); NIIF S1 36; NIIF S1 40 | NIIF S2 16(d) | 3 · revisión (S1→S2) | alta | 10 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 10 aprobado y los hechos de NIIF S2 16(d) · lleva la oración fija del alivio E5 |
| 97 | 200000 | tabla | concepto | NIIF S1 35 (d); NIIF S2 16 (d); NIIF S1 36; NIIF S1 40 | NIIF S2 16(d) | 3 · revisión (tabla) | alta | 10 | sí | tabla (asesor (aceptada por Esteban)) | Tabla TE: tres hechos (corto/mediano/largo) de S2 16(d) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 98 | 200000 | text | concepto | NIIF S1 35 (d); NIIF S2 16 (d); NIIF S1 36; NIIF S1 40 | NIIF S2 16(d) | 3 · revisión (S1→S2) | alta | 10 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 10 aprobado y los hechos de NIIF S2 16(d) · lleva la oración fija del alivio E5 |
| 99 | 200000 | tabla | concepto | NIIF S1 35 (d); NIIF S2 16 (d); NIIF S1 36; NIIF S1 40 | NIIF S2 16(d) | 3 · revisión (tabla) | alta | 10 | sí | tabla (asesor (aceptada por Esteban)) | Tabla TE: tres hechos (corto/mediano/largo) de S2 16(d) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 100 | 200000 | text block | concepto | NIIF S1 40; NIIF S2 21; NIIF S1 36 | NIIF S1 40(a) | 2 · etiqueta | alta | — |  |  | Sin bloque dueño para NIIF S1 40(a): «Pendiente» |
| 102 | 200000 | (sin tipo) | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 103 | 200000 | text block | concepto | NIIF S1 41; NIIF S1 42 | — | 1 · correspondencia S1→S2 | media | 26 | sí |  | Modelo, desde el bloque 26 aprobado (incisos de NIIF S2 22); datapoint por decidir · lleva la oración fija del alivio E5 (NIIF S2 22 → sin código propio; sus 6 incisos son del bloque 26) |
| 105 | 200000 | text | concepto | NIIF S2 22; NIIF S2 B1; NIIF S2 B18 | NIIF S2 22(a)(ii) | 1 · fuente | alta | 26 |  | confirmada (asesor (aceptada por Esteban)) | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(a)(ii) (6 códigos del párrafo; elegido por la etiqueta) |
| 106 | 200000 | text block | concepto | NIIF S2 22 (a)(i) | NIIF S2 22(a)(i) | 1 · fuente | alta | 26 |  |  | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(a)(i) |
| 108 | 200000 | text block | concepto | NIIF S2 22 (a)(ii) | NIIF S2 22(a)(ii) | 1 · fuente | alta | 26 |  |  | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(a)(ii) |
| 110 | 200000 | text | concepto | NIIF S2 22 (a)(iii) | NIIF S2 22(a)(iii) | 1 · fuente | alta | 26 |  |  | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(a)(iii) |
| 111 | 200000 | tabla | concepto | NIIF S2 22 (a)(iii) | NIIF S2 22(a)(iii) | 3 · revisión (tabla) | alta | 26 |  | tabla (asesor (aceptada por Esteban)) | Tabla TE desde hechos de S2 22(a)(iii) por horizonte (bloque 26) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 112 | 200000 | text | concepto | NIIF S2 22 (b)(i) | NIIF S2 22(b)(i) | 1 · fuente | alta | 26 |  |  | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(b)(i) |
| 113 | 200000 | tabla | concepto | NIIF S2 22 (b)(i) | NIIF S2 22(b)(i) | 3 · revisión (tabla) | alta | 26 |  | tabla (asesor (aceptada por Esteban)) | Sub-tabla desde hechos de S2 22(b)(i) y B1–B18 (bloque 26); si no hay análisis de escenarios, los 8 campos llevan la declaración negativa de 112 · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 114 | 200000 | text | concepto | NIIF S2 22 (b)(ii) | NIIF S2 22(b)(ii) | 1 · fuente | alta | 26 |  |  | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(b)(ii) |
| 115 | 200000 | tabla | concepto | NIIF S2 22 (b)(ii) | NIIF S2 22(b)(ii) | 3 · revisión (tabla) | alta | 26 |  | tabla (asesor (aceptada por Esteban)) | Sub-tabla desde hechos de S2 22(b)(ii) (bloque 26); si no hay análisis, declaración negativa de 114 · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 116 | 200000 | text | concepto | NIIF S2 22 (b)(iii) | NIIF S2 22(b)(iii) | 1 · fuente | alta | 26 |  |  | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(b)(iii) |
| 117 | 200000 | text block | concepto | NIIF S2 22 (b)(iii) | NIIF S2 22(b)(iii) | 1 · fuente | alta | 26 |  |  | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(b)(iii) |
| 119 | 200000 | text block | concepto | NIIF S2 22 (b)(iii) | NIIF S2 22(b)(iii) | 1 · fuente | alta | 26 |  |  | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(b)(iii) |
| 121 | 200000 | abstract | encabezado | NIIF S1 43; NIIF S2 24 | — | — | — | — |  |  | Sin respuesta (encabezado) |
| 122 | 200000 | text block | concepto | NIIF S1 44 (a); NIIF S2 25 (a); NIIF S2 26 | NIIF S2 25 (a)(i)a(v) | 3 · revisión (S1→S2) | alta | — | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque null aprobado y los hechos de NIIF S2 25 (a)(i)a(v) · lleva la oración fija del alivio E5 (NIIF S2 25(a) → código agrupado «NIIF S2 25 (a)(i)a(v)») |
| 124 | 200000 | text block | concepto | NIIF S1 44 (a)(i); NIIF S2 25 (a)(i); NIIF S2 26 | NIIF S2 25 (a)(i) | 3 · revisión (S1→S2) | alta | 27 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (a)(i) · lleva la oración fija del alivio E5 |
| 125 | 200000 | (sin tipo) | concepto | NIIF S1 44 (a)(i); NIIF S2 25 (a)(i); NIIF S2 26 | NIIF S2 25 (a)(i) | 3 · revisión (S1→S2) | alta | 27 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (a)(i) · lleva la oración fija del alivio E5 |
| 126 | 200000 | text block | concepto | NIIF S1 44 (a)(ii); NIIF S2 25 (a)(ii); NIIF S2 26 | NIIF S2 25 (a)(ii) | 1 · fuente | alta | 27 | sí |  | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (a)(ii) · lleva la oración fija del alivio E5 |
| 128 | 200000 | text block | concepto | NIIF S1 44 (a)(iii); NIIF S2 25 (a)(iii); NIIF S2 26 | NIIF S2 25 (a)(iii) | 3 · revisión (S1→S2) | alta | 27 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (a)(iii) · lleva la oración fija del alivio E5 |
| 129 | 200000 | (sin tipo) | concepto | NIIF S1 44 (a)(iii); NIIF S2 25 (a)(iii); NIIF S2 26 | NIIF S2 25 (a)(iii) | 3 · revisión (S1→S2) | alta | 27 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (a)(iii) · lleva la oración fija del alivio E5 |
| 130 | 200000 | text block | concepto | NIIF S1 44 (a)(iv); NIIF S2 25 (a)(iv); NIIF S2 26 | NIIF S2 25 (a)(iv) | 3 · revisión (S1→S2) | alta | 27 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (a)(iv) · lleva la oración fija del alivio E5 |
| 132 | 200000 | text block | concepto | NIIF S1 44 (a)(v); NIIF S2 25 (a)(v); NIIF S2 26 | NIIF S2 25 (a)(v) | 3 · revisión (S1→S2) | alta | 27 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (a)(v) · lleva la oración fija del alivio E5 |
| 134 | 200000 | booleano | concepto | NIIF S1 44 (a)(vi); NIIF S2 25 (a)(vi); NIIF S2 26 | NIIF S2 25 (a)(vi) | 3 · revisión (S1→S2) | alta | 27 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (a)(vi) · lleva la oración fija del alivio E5 |
| 135 | 200000 | (sin tipo) | concepto | NIIF S1 44 (a)(vi); NIIF S2 25 (a)(vi); NIIF S2 26 | NIIF S2 25 (a)(vi) | 3 · revisión (S1→S2) | alta | 27 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (a)(vi) · lleva la oración fija del alivio E5 |
| 137 | 200000 | text block | concepto | NIIF S1 44 (a)(vi); NIIF S2 25 (a)(vi); NIIF S2 26 | NIIF S2 25 (a)(vi) | 3 · revisión (S1→S2) | alta | 27 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (a)(vi) · lleva la oración fija del alivio E5 |
| 139 | 200000 | text block | concepto | NIIF S1 44 (b); NIIF S2 25 (b); NIIF S2 26 | NIIF S2 25 (b) | 3 · revisión (S1→S2) | alta | 27 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (b) · lleva la oración fija del alivio E5 |
| 141 | 200000 | text block | concepto | NIIF S1 44 (c); NIIF S2 25 (c); NIIF S2 26 | NIIF S2 25 (c) | 3 · revisión (S1→S2) | alta | 27 | sí | regla S1→S2 (asesor (aceptada por Esteban)) | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (c) · lleva la oración fija del alivio E5 |
| 143 | 200000 | abstract | encabezado | — | — | — | — | — |  |  | Sin respuesta (encabezado) |
| 144 | 200000 | text | encabezado | NIIF S1 45; NIIF S1 27; NIIF S1 52; NIIF S1 53 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 145 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 146 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 147 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 148 | 200000 | booleano | concepto | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 | — | regla fija | alta | — |  | regla fija (asesor (aceptada por Esteban)) | Regla fija: «Verdadero» (todas las métricas provienen de NIIF S2 29) · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 149 | 200000 | text block | concepto | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 | — | 3 · revisión (regla) | alta | — | sí | regla (asesor (aceptada por Esteban)) | nombre de la métrica = denominación del catálogo S2 29(a)–(g) correspondiente (no es «sin candidato») · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 151 | 200000 | (sin tipo) | concepto | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 | — | regla fija | alta | — |  | regla fija (asesor (aceptada por Esteban)) | Regla fija: «Norma NIIF de Información a Revelar sobre Sostenibilidad» · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 152 | 200000 | enumeración | concepto | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 | — | regla fija | alta | — |  | regla fija (asesor (aceptada por Esteban)) | Regla fija: opción «Norma NIIF de Información a Revelar sobre Sostenibilidad» · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 153 | 200000 | text block | concepto | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 | — | regla fija | alta | — |  | regla fija (asesor (aceptada por Esteban)) | Regla fija: «NIIF S2 párrafo 29(x)» según la métrica · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 155 | 200000 | text block | concepto | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 | — | 3 · revisión (regla) | alta | — | sí | regla (asesor (aceptada por Esteban)) | descripción del catálogo de la métrica S2 29(x) · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 157 | 200000 | text block | concepto | NIIF S1 50 (a); NIIF S1 54; NIIF S1 59 | — | 3 · revisión (regla) | alta | — | sí | regla (asesor (aceptada por Esteban)) | nombre de la métrica = denominación del catálogo S2 29(a)–(g) correspondiente (no es «sin candidato») · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 159 | 200000 | text block | concepto | NIIF S1 50 (a); NIIF S1 54; NIIF S1 59 | — | 3 · revisión (regla) | alta | — | sí | regla (asesor (aceptada por Esteban)) | descripción del catálogo de la métrica S2 29(x) · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 161 | 200000 | booleano | concepto | NIIF S1 50 (a); NIIF S1 54; NIIF S1 59 | — | regla fija | alta | — |  | regla fija (asesor (aceptada por Esteban)) | Regla fija: «No» · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 162 | 200000 | (sin tipo) | concepto | NIIF S1 50 (a); NIIF S1 54; NIIF S1 59 | — | regla fija | alta | — |  | regla fija (asesor (aceptada por Esteban)) | Regla fija: «No» · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 163 | 200000 | text block | concepto | NIIF S1 50 (a); NIIF S1 54; NIIF S1 59 | — | regla fija | alta | — |  | regla fija (asesor (aceptada por Esteban)) | Regla fija: «No aplica: la métrica se toma sin ajuste de NIIF S2» · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 165 | 200000 | (sin tipo) | encabezado | NIIF S1 50 (b); NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 166 | 200000 | enumeración | concepto | NIIF S1 50 (b); NIIF S1 54; NIIF S1 59 | — | 3 · revisión (regla) | alta | — | sí | regla (asesor (aceptada por Esteban)) | absoluta (tCO2e, montos), relativa (intensidad, %), cualitativa · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 167 | 200000 | text block | concepto | NIIF S1 50 (c); NIIF S1 54; NIIF S1 59 | NIIF S2 29 (a)(iii) | 3 · revisión | alta | 30 | sí | datapoint y bloque (asesor (aceptada por Esteban)) | Hecho de verificación externa del inventario GEI (bloque 30 · S2 29(a)(iii)); si el catálogo no lo tiene, campo de Perfil «verificador». · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 169 | 200000 | text block | concepto | NIIF S1 50 (d); NIIF S1 54; NIIF S1 59 | NIIF S2 29 (a)(iii) | 3 · revisión | alta | 30 | sí | datapoint y bloque (asesor (aceptada por Esteban)) | S2 29(a)(iii) · bloque 30 (método de medición), no «S1 46 a 50» · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 171 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 172 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 173 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 174 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 175 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 176 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 177 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 178 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 179 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 180 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 181 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 182 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 183 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 184 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 185 | 200000 | (sin tipo) | encabezado | NIIF S1 54; NIIF S1 59 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Estructura de plantilla: se genera al iterar la tabla o las métricas · métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56 |
| 186 | 200000 | booleano | concepto | NIIF S1 52; NIIF S1 B52 | — | regla primer año | alta | — | sí | primer año (asesor (aceptada por Esteban)) | Primer año: regla fija «No» (S1 52 no aplica sin periodo previo). Segundo año: ligar al eje [901000] |
| 188 | 200000 | text block | concepto | NIIF S1 52; NIIF S1 B52 | — | regla primer año | alta | — | sí | primer año (asesor (aceptada por Esteban)) | Primer año: «No aplica». Segundo año: eje [901000] |
| 190 | 200000 | text block | concepto | NIIF S1 52; NIIF S1 B52 | — | regla primer año | alta | — | sí | primer año (asesor (aceptada por Esteban)) | Primer año: «No aplica». Segundo año: eje [901000] |
| 192 | 200000 | text block | concepto | NIIF S1 52; NIIF S1 B52 | — | regla primer año | alta | — | sí | primer año (asesor (aceptada por Esteban)) | Primer año: «No aplica». Segundo año: eje [901000] |
| 194 | 200000 | text | encabezado narrativo | — | — | 3 · revisión | alta | 38 |  | encabezado narrativo (asesor (aceptada por Esteban)) | Párrafo introductorio desde el bloque 38 aprobado |
| 195 | 200000 | text | concepto | NIIF S1 51; NIIF S2 33 | NIIF S2 33 | 1 · fuente | alta | 38 | sí |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 · lleva la oración fija del alivio E5 |
| 196 | 200000 | (sin tipo) | subconcepto de la fila 195 | — | NIIF S2 33 | 1 · fuente | alta | 38 | sí |  | Se responde junto con la fila 195 (text) |
| 197 | 200000 | text block | concepto | NIIF S1 51; NIIF S2 33 | NIIF S2 33 | 1 · fuente | alta | 38 | sí |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 · lleva la oración fija del alivio E5 |
| 199 | 200000 | booleano | concepto | — | — | regla fija | alta | — |  | regla fija (asesor (aceptada por Esteban)) | Regla fija: «Verdadero» (bajo E5 todos los objetivos revelados son climáticos) |
| 200 | 200000 | enumeración valor unico | concepto | NIIF S1 51 | NIIF S2 33 | 1 · correspondencia S1→S2 | alta | 38 | sí |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 33 · lleva la oración fija del alivio E5 |
| 201 | 200000 | (sin tipo) | subconcepto de la fila 200 | NIIF S1 51 | NIIF S2 33 | 1 · correspondencia S1→S2 | alta | 38 | sí |  | Se responde junto con la fila 200 (enumeración valor unico) |
| 202 | 200000 | text block | concepto | NIIF S1 51 (a) | NIIF S2 33 | 1 · correspondencia S1→S2 | alta | 38 | sí |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 · lleva la oración fija del alivio E5 |
| 204 | 200000 | text block | concepto | NIIF S1 51 (b) | NIIF S2 33 | 1 · correspondencia S1→S2 | alta | 38 | sí |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 · lleva la oración fija del alivio E5 |
| 206 | 200000 | text block | concepto | NIIF S1 51 (c) | NIIF S2 33 | 1 · correspondencia S1→S2 | alta | 38 | sí |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 · lleva la oración fija del alivio E5 |
| 208 | 200000 | text block | concepto | NIIF S1 51 (d) | NIIF S2 33 | 1 · correspondencia S1→S2 | alta | 38 | sí |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 · lleva la oración fija del alivio E5 |
| 210 | 200000 | text block | concepto | NIIF S1 51 (e) | NIIF S2 33 | 1 · correspondencia S1→S2 | alta | 38 | sí |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 · lleva la oración fija del alivio E5 |
| 212 | 200000 | text block | concepto | NIIF S1 51 (f) | NIIF S2 33 | 1 · correspondencia S1→S2 | alta | 38 | sí |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 · lleva la oración fija del alivio E5 |
| 214 | 200000 | text block | concepto | NIIF S1 51 (g) | NIIF S2 33 | 1 · correspondencia S1→S2 | alta | 38 | sí |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 · lleva la oración fija del alivio E5 |
| 216 | 200000 | (sin tipo) | subconcepto de la fila 214 | — | NIIF S2 33 | 1 · correspondencia S1→S2 | alta | 38 | sí |  | Se responde junto con la fila 214 (text block) |
| 217 | 200000 | text block | concepto | NIIF S2 33; NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 219 | 200000 | enumeración valor unico | concepto | NIIF S2 33; NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 33 |
| 220 | 200000 | (sin tipo) | subconcepto de la fila 219 | NIIF S2 33; NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Se responde junto con la fila 219 (enumeración valor unico) |
| 221 | 200000 | text block | concepto | NIIF S2 33 (a); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 223 | 200000 | text block | concepto | NIIF S2 33 (b); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 224 | 200000 | (sin tipo) | subconcepto de la fila 223 | NIIF S2 33 (b); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Se responde junto con la fila 223 (text block) |
| 225 | 200000 | text block | concepto | NIIF S2 33 (c); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 226 | 200000 | (sin tipo) | subconcepto de la fila 225 | NIIF S2 33 (c); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Se responde junto con la fila 225 (text block) |
| 227 | 200000 | text block | concepto | NIIF S2 33 (d); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 229 | 200000 | text block | concepto | NIIF S2 33 (e); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 231 | 200000 | text block | concepto | NIIF S2 33 (f); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 233 | 200000 | enumeración valor unico | concepto | NIIF S2 33 (g); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 33 |
| 234 | 200000 | (sin tipo) | subconcepto de la fila 233 | NIIF S2 33 (g); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Se responde junto con la fila 233 (enumeración valor unico) |
| 235 | 200000 | text block | concepto | NIIF S2 33 (h); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 |  |  | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 237 | 200000 | booleano | concepto | NIIF S2 34 (a) | NIIF S2 34 | 1 · fuente | alta | 39 |  |  | Sí/No desde un hecho o declaración negativa de NIIF S2 34 |
| 238 | 200000 | (sin tipo) | subconcepto de la fila 237 | NIIF S2 34 (a) | NIIF S2 34 | 1 · fuente | alta | 39 |  |  | Se responde junto con la fila 237 (booleano) |
| 239 | 200000 | text block | concepto | NIIF S2 34 (b) | NIIF S2 34 | 1 · fuente | alta | 39 |  |  | Modelo, desde el bloque 39 aprobado y los hechos de NIIF S2 34 |
| 241 | 200000 | text block | concepto | NIIF S2 34 (c) | NIIF S2 34 | 1 · fuente | alta | 39 |  |  | Modelo, desde el bloque 39 aprobado y los hechos de NIIF S2 34 |
| 243 | 200000 | text block | concepto | NIIF S2 34 (d) | NIIF S2 34 | 1 · fuente | alta | 39 |  |  | Modelo, desde el bloque 39 aprobado y los hechos de NIIF S2 34 |
| 245 | 200000 | text block | concepto | NIIF S2 35 | NIIF S2 35 | 1 · fuente | alta | 39 |  |  | Modelo, desde el bloque 39 aprobado y los hechos de NIIF S2 35 |
| 247 | 200000 | enumeración multiples valores | concepto | NIIF S2 36 (a) | NIIF S2 36 (a) | 1 · fuente | alta | 40 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 36 (a) |
| 248 | 200000 | (sin tipo) | subconcepto de la fila 247 | NIIF S2 36 (a) | NIIF S2 36 (a) | 1 · fuente | alta | 40 |  |  | Se responde junto con la fila 247 (enumeración multiples valores) |
| 249 | 200000 | enumeración multiples valores | concepto | NIIF S2 36 (b) | NIIF S2 36 (b) | 1 · fuente | alta | 40 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 36 (b) |
| 250 | 200000 | (sin tipo) | subconcepto de la fila 249 | NIIF S2 36 (b) | NIIF S2 36 (b) | 1 · fuente | alta | 40 |  |  | Se responde junto con la fila 249 (enumeración multiples valores) |
| 251 | 200000 | enumeración valor unico | concepto | NIIF S2 36 (c) | NIIF S2 36 (c) | 1 · fuente | alta | 40 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 36 (c) |
| 252 | 200000 | (sin tipo) | subconcepto de la fila 251 | NIIF S2 36 (c) | NIIF S2 36 (c) | 1 · fuente | alta | 40 |  |  | Se responde junto con la fila 251 (enumeración valor unico) |
| 253 | 200000 | booleano | concepto | NIIF S2 36 (d) | NIIF S2 36 (d) | 1 · fuente | alta | 40 |  |  | Sí/No desde un hecho o declaración negativa de NIIF S2 36 (d) |
| 254 | 200000 | (sin tipo) | subconcepto de la fila 253 | NIIF S2 36 (d) | NIIF S2 36 (d) | 1 · fuente | alta | 40 |  |  | Se responde junto con la fila 253 (booleano) |
| 255 | 200000 | text | concepto | NIIF S2 36 (e) | NIIF S2 36 (e)(i)a(iv) | 1 · fuente | alta | — |  |  | Sin bloque dueño para NIIF S2 36 (e)(i)a(iv): «Pendiente» (5 códigos del párrafo; elegido por la etiqueta) |
| 256 | 200000 | booleano | concepto | — | NIIF S2 36 (e)(i)a(iv) | 2 · etiqueta | alta | — |  |  | Sí/No desde un hecho o declaración negativa de NIIF S2 36 (e)(i)a(iv) |
| 257 | 200000 | text block | concepto | — | NIIF S2 36 (e)(i)a(iv) | 3 · revisión | alta | 40 |  | datapoint y bloque (asesor (aceptada por Esteban)) | S2 36(e) · bloque 40: si no hay uso previsto de créditos, texto fijo «No se prevé el uso de créditos de carbono»; si lo hay, desde los hechos del bloque 40 (NIIF S2 36(e) → código agrupado «NIIF S2 36 (e)(i)a(iv)») |
| 259 | 200000 | text block | concepto | NIIF S2 36 (e)(i) | NIIF S2 36 (e)(i) | 1 · fuente | alta | 40 |  |  | Modelo, desde el bloque 40 aprobado y los hechos de NIIF S2 36 (e)(i) |
| 261 | 200000 | text block | concepto | NIIF S2 36 (e)(ii) | NIIF S2 36 (e)(ii) | 1 · fuente | alta | 40 |  |  | Modelo, desde el bloque 40 aprobado y los hechos de NIIF S2 36 (e)(ii) |
| 263 | 200000 | enumeración valor unico | concepto | NIIF S2 36 (e)(iii) | NIIF S2 36 (e)(iii) | 1 · fuente | alta | 40 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 36 (e)(iii) |
| 264 | 200000 | (sin tipo) | subconcepto de la fila 263 | NIIF S2 36 (e)(iii) | NIIF S2 36 (e)(iii) | 1 · fuente | alta | 40 |  |  | Se responde junto con la fila 263 (enumeración valor unico) |
| 265 | 200000 | enumeración valor unico | concepto | NIIF S2 36 (e)(iii) | NIIF S2 36 (e)(iii) | 1 · fuente | alta | 40 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 36 (e)(iii) |
| 266 | 200000 | (sin tipo) | subconcepto de la fila 265 | NIIF S2 36 (e)(iii) | NIIF S2 36 (e)(iii) | 1 · fuente | alta | 40 |  |  | Se responde junto con la fila 265 (enumeración valor unico) |
| 267 | 200000 | text block | concepto | NIIF S2 36 (e)(iv) | NIIF S2 36 (e)(iv) | 1 · fuente | alta | 40 |  |  | Modelo, desde el bloque 40 aprobado y los hechos de NIIF S2 36 (e)(iv) |
| 268 | 200000 | (sin tipo) | subconcepto de la fila 267 | NIIF S2 36 (e)(iv) | NIIF S2 36 (e)(iv) | 1 · fuente | alta | 40 |  |  | Se responde junto con la fila 267 (text block) |
| 269 | 200000 | (sin tipo) | subconcepto de la fila 267 | — | NIIF S2 36 (e)(iv) | 1 · fuente | alta | 40 |  |  | Se responde junto con la fila 267 (text block) |
| 270 | 200000 | (sin tipo) | subconcepto de la fila 267 | — | NIIF S2 36 (e)(iv) | 1 · fuente | alta | 40 |  |  | Se responde junto con la fila 267 (text block) |
| 272 | 200000 | (sin tipo) | encabezado | NIIF S2 64; NIIF S2 65 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 273 | 200000 | booleano | concepto | NIIF S2 64; NIIF S2 65 | reporte.ejercicio | Perfil | alta | — |  | Perfil o reporte (asesor (aceptada por Esteban)) | Desde reporte.ejercicio: «No» cuando el periodo es de 12 meses (siempre, salvo que el Perfil diga otra cosa). |
| 274 | 200000 | (sin tipo) | encabezado | NIIF S2 64; NIIF S2 65 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 275 | 200000 | text block | concepto | NIIF S1 66 (a); NIIF S2 64; NIIF S2 65 | reporte.ejercicio (fechas) | Perfil | alta | — |  | Perfil o reporte (asesor (aceptada por Esteban)) | Desde reporte.ejercicio (fechas): Perfil/reporte: fecha de inicio del ejercicio (01/01/{ejercicio}) |
| 277 | 200000 | text block | concepto | NIIF S1 66 (a); NIIF S2 64; NIIF S2 65 | reporte.ejercicio (fechas) | Perfil | alta | — |  | Perfil o reporte (asesor (aceptada por Esteban)) | Desde reporte.ejercicio (fechas): Perfil/reporte: fecha de fin del ejercicio (31/12/{ejercicio}) |
| 279 | 200000 | text block | concepto | NIIF S1 66 (b); NIIF S2 64; NIIF S2 65 | — | regla fija | alta | — |  | regla fija (asesor (aceptada por Esteban)) | Regla fija: «No aplica» (periodo de 12 meses) salvo Perfil |
| 281 | 200000 | text block | concepto | NIIF S1 66 (c); NIIF S2 64; NIIF S2 65 | — | regla fija | alta | — |  | regla fija (asesor (aceptada por Esteban)) | Regla fija: «Las cantidades reveladas corresponden al mismo periodo que los estados financieros» (S1 66(c)) |
| 283 | 200000 | text block | concepto | NIIF S1 68; NIIF S1 67 | perfil.hechos_posteriores (nuevo) | Perfil | alta | — |  | Perfil o reporte (asesor (aceptada por Esteban)) | Desde perfil.hechos_posteriores (campo nuevo) |
| 285 | 200000 | text | concepto | NIIF S1 72 | — | 1 · correspondencia S1→S2 | alta | 2 | sí |  | Declaración de cumplimiento: bloque 2 (plantilla) · lleva la oración fija del alivio E5 |
| 286 | 200000 | booleano | concepto | — | NIIF S1 72 | 2 · etiqueta | alta | — |  |  | Sí/No desde un hecho o declaración negativa de NIIF S1 72 |
| 287 | 200000 | text block | concepto | NIIF S1 74 | — | 1 · correspondencia S1→S2 | alta | 6 | sí |  | Juicios e incertidumbres: bloque 6 · lleva la oración fija del alivio E5 |
| 288 | 200000 | (sin tipo) | subconcepto de la fila 287 | NIIF S1 74; NIIF S1 76 | — | 1 · correspondencia S1→S2 | alta | 6 | sí |  | Se responde junto con la fila 287 (text block) |
| 289 | 200000 | text block | concepto | NIIF S1 74; NIIF S1 76 | — | 1 · correspondencia S1→S2 | alta | 6 | sí |  | Juicios e incertidumbres: bloque 6 · lleva la oración fija del alivio E5 |
| 291 | 200000 | (sin tipo) | subconcepto de la fila 289 | NIIF S1 77; NIIF S1 82 | — | 1 · correspondencia S1→S2 | alta | 6 | sí |  | Se responde junto con la fila 289 (text block) |
| 292 | 200000 | text block | concepto | NIIF S1 77; NIIF S1 82 | — | 1 · correspondencia S1→S2 | alta | 6 | sí | confirmada (asesor (aceptada por Esteban)) | Juicios e incertidumbres: bloque 6 · lleva la oración fija del alivio E5 |
| 294 | 200000 | (sin tipo) | encabezado | NIIF S1 83; NIIF S1 86; NIIF S1 B58 (a) | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 295 | 200000 | text block | concepto | NIIF S1 83; NIIF S1 86; NIIF S1 B58 (a) | — | regla primer año | alta | — | sí | primer año (asesor (aceptada por Esteban)) | Primer año: regla fija «No se identificaron errores de periodos anteriores» |
| 297 | 200000 | text block | concepto | NIIF S1 83; NIIF S1 86; NIIF S1 B58 (a) | — | regla primer año | alta | — | sí | primer año (asesor (aceptada por Esteban)) | Primer año: «No aplica» (texto fijo); segundo año: eje [901000] |
| 299 | 200000 | text block | concepto | NIIF S1 83; NIIF S1 86; NIIF S1 B58 (a) | — | regla primer año | alta | — | sí | primer año (asesor (aceptada por Esteban)) | Primer año: «No aplica» |
| 301 | 200000 | (sin tipo) | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 302 | 200000 | (sin tipo) | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 303 | 200000 | booleano | concepto | — | reporte.alivios | Perfil | alta | — |  | Perfil o reporte (asesor (aceptada por Esteban)) | Desde reporte.alivios: (ya existe desde A2): «Sí» cuando el régimen marca E5. |
| 306 | 210000 | (sin tipo) | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 307 | 210000 | text | encabezado | NIIF S2 23 | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 308 | 210000 | text | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 309 | 210000 | text | concepto | NIIF S2 23; NIIF S2 29 (a)(i); NIIF S2 B19; NIIF S2 B22 | NIIF S2 29 (a)(i) | 1 · fuente | alta | 29 |  |  | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 29 (a)(i) |
| 310 | 210000 | tabla | concepto | NIIF S2 23; NIIF S2 29 (a)(i); NIIF S2 B19; NIIF S2 B22 | NIIF S2 29 (a)(i) | 3 · revisión (tabla) | alta | 29 |  | tabla (asesor (aceptada por Esteban)) | S2 29(a)(i) · bloque 29: tabla Alcance 1/2/3 con comparativo (20X1 vacío el primer año; E6). · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 311 | 210000 | (sin tipo) | subconcepto de la fila 310 | NIIF S2 23; NIIF S2 29 (a)(i); NIIF S2 B19; NIIF S2 B22 | NIIF S2 29 (a)(i) | 3 · revisión (tabla) | alta | 29 |  |  | Se responde junto con la fila 310 (tabla) |
| 313 | 210000 | booleano | concepto | NIIF S2 29 (a)(ii); NIIF S2 B23; NIIF S2 B25 | NIIF S2 29 (a)(ii) | 1 · fuente | alta | 30 |  |  | Sí/No desde un hecho o declaración negativa de NIIF S2 29 (a)(ii) |
| 315 | 210000 | (sin tipo) | subconcepto de la fila 313 | NIIF S2 29 (a)(ii); NIIF S2 B23; NIIF S2 B25 | NIIF S2 29 (a)(ii) | 1 · fuente | alta | 30 |  |  | Se responde junto con la fila 313 (booleano) |
| 317 | 210000 | text | concepto | NIIF S2 29 (a)(iii); NIIF S2 B26; NIIF S2 B29 | NIIF S2 29 (a)(iii) | 1 · fuente | alta | 30 |  |  | Modelo, desde el bloque 30 aprobado y los hechos de NIIF S2 29 (a)(iii) |
| 318 | 210000 | text block | concepto | NIIF S2 29 (a)(iii); NIIF S2 B26; NIIF S2 B29 | NIIF S2 29 (a)(iii) | 1 · fuente | alta | 30 |  |  | Modelo, desde el bloque 30 aprobado y los hechos de NIIF S2 29 (a)(iii) |
| 320 | 210000 | text block | concepto | NIIF S2 29 (a)(iii); NIIF S2 B26; NIIF S2 B29 | NIIF S2 29 (a)(iii) | 1 · fuente | alta | 30 |  |  | Modelo, desde el bloque 30 aprobado y los hechos de NIIF S2 29 (a)(iii) |
| 322 | 210000 | text block | concepto | NIIF S2 29 (a)(iii); NIIF S2 B26; NIIF S2 B29 | NIIF S2 29 (a)(iii) | 1 · fuente | alta | 30 |  |  | Modelo, desde el bloque 30 aprobado y los hechos de NIIF S2 29 (a)(iii) |
| 324 | 210000 | text | concepto | NIIF S2 29 (a)(iv); NIIF S2 5 | NIIF S2 29 (a)(iv) EI5 | 3 · revisión | alta | 31 |  | datapoint y bloque (asesor (aceptada por Esteban)) | S2 29(a)(iv) · bloque 31 (desagregación grupo consolidado / otras participadas); el EI14-E18 propuesto es el de desagregación por gas (NIIF S2 29(a)(iv) → nombre combinado «NIIF S2 29 (a)(iv) EI5») |
| 325 | 210000 | tabla | concepto | NIIF S2 29 (a)(iv); NIIF S2 5 | NIIF S2 29 (a)(iv) EI5 | 3 · revisión (tabla) | alta | 31 |  | tabla (asesor (aceptada por Esteban)) | Tabla desde los hechos de S2 29(a)(iv) (bloque 31): Alcance 1 y 2 por grupo contable consolidado y otras participadas. eso va en 327/328 (NIIF S2 29(a)(iv) → nombre combinado «NIIF S2 29 (a)(iv) EI5») · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 326 | 210000 | (sin tipo) | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 327 | 210000 | text block | concepto | — | NIIF S2 EI14 a E18 | 2 · etiqueta | alta | 29 |  |  | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 EI14 a E18 |
| 328 | 210000 | (sin tipo) | subconcepto de la fila 327 | — | NIIF S2 EI14 a E18 | 2 · etiqueta | alta | 29 |  |  | Se responde junto con la fila 327 (text block) |
| 329 | 210000 | (sin tipo) | subconcepto de la fila 327 | NIIF S2 29 (a)(v); NIIF S2 B30; NIIF S2 B31 | NIIF S2 EI14 a E18 | 2 · etiqueta | alta | 29 |  |  | Se responde junto con la fila 327 (text block) |
| 330 | 210000 | text block | concepto | NIIF S2 29 (a)(v); NIIF S2 B30; NIIF S2 B31 | NIIF S2 29 (a)(v) | 1 · fuente | alta | 32 |  |  | Modelo, desde el bloque 32 aprobado y los hechos de NIIF S2 29 (a)(v) |
| 332 | 210000 | text block | concepto | NIIF S2 29 (a)(v); NIIF S2 B30; NIIF S2 B31 | NIIF S2 29 (a)(v) | 1 · fuente | alta | 32 |  |  | Modelo, desde el bloque 32 aprobado y los hechos de NIIF S2 29 (a)(v) |
| 334 | 210000 | text | concepto | NIIF S2 29 (a)(vi)(1); NIIF S2 B32; NIIF S2 B57 | NIIF S2 29 (a)(vi)(1) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(1) |
| 335 | 210000 | enumeración multiple | concepto | NIIF S2 29 (a)(vi)(1); NIIF S2 B32; NIIF S2 B57 | NIIF S2 29 (a)(vi)(1) | 1 · fuente | alta | 33 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 29 (a)(vi)(1) |
| 336 | 210000 | text | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 337 | 210000 | tabla | concepto | NIIF S2 29 (a)(vi)(1); NIIF S2 B32; NIIF S2 B57; NIIF S2 12 | NIIF S2 29 (a)(vi)(1) | 1 · fuente | alta | 33 |  |  | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(1)) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 338 | 210000 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B32; NIIF S2 B57 | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 339 | 210000 | enumeración multiple | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B32; NIIF S2 B57 | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 29 (a)(vi)(2) |
| 340 | 210000 | enumeración multiple | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B32; NIIF S2 B57 | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 29 (a)(vi)(2) |
| 342 | 210000 | text block | concepto | — | NIIF S2 EI19 a EI24 | 2 · etiqueta | alta | 29 |  |  | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 EI19 a EI24 |
| 343 | 210000 | (sin tipo) | subconcepto de la fila 342 | — | NIIF S2 EI19 a EI24 | 2 · etiqueta | alta | 29 |  |  | Se responde junto con la fila 342 (text block) |
| 344 | 210000 | text block | encabezado narrativo | — | NIIF S2 29 (b) · B65 (b) | 2 · etiqueta | alta | 34 |  | confirmada (asesor (aceptada por Esteban)) | Párrafo introductorio desde el bloque 34 aprobado |
| 345 | 210000 | (sin tipo) | subconcepto de la fila 344 | NIIF S2 29 (b) | NIIF S2 29 (b) · B65 (b) | 2 · etiqueta | alta | 34 |  |  | Se responde junto con la fila 344 (text block) |
| 346 | 210000 | (sin tipo) | subconcepto de la fila 344 | — | NIIF S2 29 (b) · B65 (b) | 2 · etiqueta | alta | 34 |  |  | Se responde junto con la fila 344 (text block) |
| 347 | 210000 | tabla | concepto | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (a) | NIIF S2 29 (b) | 1 · fuente | alta | 34 |  |  | Tabla desde registros de clima u objetivos (NIIF S2 29 (b)) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 348 | 210000 | text block | concepto | NIIF S2 29 (b) | NIIF S2 29 (b) | 1 · fuente | alta | 34 |  |  | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 350 | 210000 | text block | concepto | NIIF S2 29 (e) | NIIF S2 29 (e) | 1 · fuente | alta | 36 |  |  | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (e) |
| 352 | 210000 | text block | concepto | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (b) | NIIF S2 29 (b) | 1 · fuente | alta | 34 |  |  | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 353 | 210000 | (sin tipo) | subconcepto de la fila 352 | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (b) | NIIF S2 29 (b) | 1 · fuente | alta | 34 |  |  | Se responde junto con la fila 352 (text block) |
| 354 | 210000 | text block | concepto | NIIF S2 29 (b); NIIF S2 31; NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (b) | 1 · fuente | alta | 34 |  |  | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 356 | 210000 | text block | concepto | NIIF S2 29 (b); NIIF S2 31; NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (b) | 1 · fuente | alta | 34 |  |  | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 358 | 210000 | text block | concepto | NIIF S2 29 (b); NIIF S2 31; NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (b) | 1 · fuente | alta | 34 |  |  | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 360 | 210000 | text | concepto | NIIF S2 29 (b); NIIF S2 31; NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (b) | 1 · fuente | alta | 34 |  |  | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 361 | 210000 | text block | concepto | NIIF S2 29 (b); NIIF S2 31; NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (b) | 1 · fuente | alta | 34 |  |  | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 363 | 210000 | (sin tipo) | subconcepto de la fila 361 | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (d) | NIIF S2 29 (b) | 1 · fuente | alta | 34 |  |  | Se responde junto con la fila 361 (text block) |
| 364 | 210000 | enumeración valor unico | concepto | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (d) | NIIF S2 29 (b) | 1 · fuente | alta | 34 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 29 (b) |
| 365 | 210000 | (sin tipo) | subconcepto de la fila 364 | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (e) | NIIF S2 29 (b) | 1 · fuente | alta | 34 |  |  | Se responde junto con la fila 364 (enumeración valor unico) |
| 367 | 210000 | text block | encabezado narrativo | — | NIIF S2 29 (c) · B65 (b) | 2 · etiqueta | alta | 35 |  | confirmada (asesor (aceptada por Esteban)) | Párrafo introductorio desde el bloque 35 aprobado |
| 368 | 210000 | (sin tipo) | subconcepto de la fila 367 | NIIF S2 29 (b) | NIIF S2 29 (c) · B65 (b) | 2 · etiqueta | alta | 35 |  |  | Se responde junto con la fila 367 (text block) |
| 369 | 210000 | (sin tipo) | subconcepto de la fila 367 | — | NIIF S2 29 (c) · B65 (b) | 2 · etiqueta | alta | 35 |  |  | Se responde junto con la fila 367 (text block) |
| 370 | 210000 | tabla | concepto | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (a) | NIIF S2 29 (c) | 1 · fuente | alta | 35 |  | corrección de Ref (Esteban (13 de octubre de 2026)) | Tabla desde registros de clima u objetivos (NIIF S2 29 (c)) (corrección de Ref: la fila está en la sección de riesgos físicos; el Ref del formato dice 29(b)) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 371 | 210000 | text block | concepto | NIIF S2 29 (c) | NIIF S2 29 (c) | 1 · fuente | alta | 35 |  |  | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 373 | 210000 | text block | concepto | NIIF S2 29 (e) | NIIF S2 29 (e) | 1 · fuente | alta | 36 |  |  | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (e) |
| 375 | 210000 | text block | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (b) | NIIF S2 29 (c) | 1 · fuente | alta | 35 |  |  | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 376 | 210000 | (sin tipo) | subconcepto de la fila 375 | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (b) | NIIF S2 29 (c) | 1 · fuente | alta | 35 |  |  | Se responde junto con la fila 375 (text block) |
| 377 | 210000 | text block | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (c) | 1 · fuente | alta | 35 |  |  | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 379 | 210000 | text block | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (c) | 1 · fuente | alta | 35 |  |  | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 381 | 210000 | text block | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (c) | 1 · fuente | alta | 35 |  |  | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 383 | 210000 | text | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (c) | 1 · fuente | alta | 35 |  |  | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 384 | 210000 | text block | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (c) | 1 · fuente | alta | 35 |  |  | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 386 | 210000 | (sin tipo) | subconcepto de la fila 384 | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (d) | NIIF S2 29 (c) | 1 · fuente | alta | 35 |  |  | Se responde junto con la fila 384 (text block) |
| 387 | 210000 | enumeración valor unico | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (d) | NIIF S2 29 (c) | 1 · fuente | alta | 35 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 29 (c) |
| 388 | 210000 | (sin tipo) | subconcepto de la fila 387 | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (e) | NIIF S2 29 (c) | 1 · fuente | alta | 35 |  |  | Se responde junto con la fila 387 (enumeración valor unico) |
| 390 | 210000 | text block | encabezado narrativo | — | NIIF S2 13(a) | 2 · etiqueta | alta | 36 |  | confirmada (asesor (aceptada por Esteban)) | Párrafo introductorio desde el bloque 36 aprobado |
| 391 | 210000 | (sin tipo) | subconcepto de la fila 390 | NIIF S2 29 (b) | NIIF S2 13(a) | 2 · etiqueta | alta | 36 |  |  | Se responde junto con la fila 390 (text block) |
| 392 | 210000 | (sin tipo) | subconcepto de la fila 390 | — | NIIF S2 13(a) | 2 · etiqueta | alta | 36 |  |  | Se responde junto con la fila 390 (text block) |
| 393 | 210000 | tabla | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (a) | NIIF S2 29 (d) | 1 · fuente | alta | 36 |  |  | Tabla desde registros de clima u objetivos (NIIF S2 29 (d)) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 394 | 210000 | text block | concepto | NIIF S2 29 (d) | NIIF S2 29 (d) | 1 · fuente | alta | 36 |  |  | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 396 | 210000 | text block | concepto | NIIF S2 29 (e) | NIIF S2 29 (e) | 1 · fuente | alta | 36 |  |  | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (e) |
| 398 | 210000 | text block | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (b) | NIIF S2 29 (d) | 1 · fuente | alta | 36 |  |  | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 399 | 210000 | (sin tipo) | subconcepto de la fila 398 | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (b) | NIIF S2 29 (d) | 1 · fuente | alta | 36 |  |  | Se responde junto con la fila 398 (text block) |
| 400 | 210000 | text block | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (d) | 1 · fuente | alta | 36 |  |  | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 402 | 210000 | text block | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (d) | 1 · fuente | alta | 36 |  |  | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 404 | 210000 | text block | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (d) | 1 · fuente | alta | 36 |  |  | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 406 | 210000 | text | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (d) | 1 · fuente | alta | 36 |  |  | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 407 | 210000 | text block | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (d) | 1 · fuente | alta | 36 |  |  | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 409 | 210000 | (sin tipo) | subconcepto de la fila 407 | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (d) | NIIF S2 29 (d) | 1 · fuente | alta | 36 |  |  | Se responde junto con la fila 407 (text block) |
| 410 | 210000 | enumeración valor unico | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (d) | NIIF S2 29 (d) | 1 · fuente | alta | 36 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 29 (d) |
| 411 | 210000 | (sin tipo) | subconcepto de la fila 410 | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (e) | NIIF S2 29 (d) | 1 · fuente | alta | 36 |  |  | Se responde junto con la fila 410 (enumeración valor unico) |
| 413 | 210000 | text | concepto | — | NIIF S2 29 (e) | 2 · etiqueta | alta | 36 |  |  | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (e) |
| 414 | 210000 | text block | concepto | NIIF S2 29 (e) | NIIF S2 29 (e) | 1 · fuente | alta | 36 |  |  | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (e) |
| 416 | 210000 | text | concepto | — | NIIF S2 29 (f) (i) y (ii) | 2 · etiqueta | alta | 37 |  |  | Modelo, desde el bloque 37 aprobado y los hechos de NIIF S2 29 (f) (i) y (ii) |
| 417 | 210000 | booleano | concepto | NIIF S2 29 (f)(i) | NIIF S2 29 (f) (i) y (ii) | 1 · fuente | alta | 37 |  |  | Sí/No desde un hecho o declaración negativa de NIIF S2 29 (f) (i) y (ii) |
| 418 | 210000 | (sin tipo) | subconcepto de la fila 417 | NIIF S2 29 (f)(i) | NIIF S2 29 (f) (i) y (ii) | 1 · fuente | alta | 37 |  |  | Se responde junto con la fila 417 (booleano) |
| 420 | 210000 | text block | concepto | NIIF S2 29 (f)(i) | NIIF S2 29 (f) (i) y (ii) | 3 · revisión | alta | 37 |  | datapoint y bloque (asesor (aceptada por Esteban)) | S2 29(f)(i) · bloque 37, condicionado a 417 = Verdadero; si 417 = No, no se despliega. No es «sin candidato» (NIIF S2 29(f)(i) → nombre combinado «NIIF S2 29 (f) (i) y (ii)») |
| 421 | 210000 | (sin tipo) | concepto | NIIF S2 29 (f)(i) | NIIF S2 29 (f) (i) y (ii) | 3 · revisión | alta | 37 |  | datapoint y bloque (asesor (aceptada por Esteban)) | S2 29(f)(i) · bloque 37, condicionado a 417 = Verdadero; si 417 = No, no se despliega. No es «sin candidato» (NIIF S2 29(f)(i) → nombre combinado «NIIF S2 29 (f) (i) y (ii)») |
| 422 | 210000 | text block | concepto | NIIF S2 29 (f)(i) | NIIF S2 29 (f) (i) y (ii) | 1 · fuente | alta | 37 |  |  | Modelo, desde el bloque 37 aprobado y los hechos de NIIF S2 29 (f) (i) y (ii) |
| 424 | 210000 | text | encabezado narrativo | — | — | 3 · revisión | alta | 37 |  | encabezado narrativo (asesor (aceptada por Esteban)) | Párrafo introductorio desde el bloque 37 aprobado |
| 425 | 210000 | booleano | concepto | NIIF S2 29 (g)(i) | NIIF S2 29 (g) (i) y (ii) | 1 · fuente | alta | 37 |  |  | Sí/No desde un hecho o declaración negativa de NIIF S2 29 (g) (i) y (ii) |
| 426 | 210000 | (sin tipo) | subconcepto de la fila 425 | NIIF S2 29 (g)(i) | NIIF S2 29 (g) (i) y (ii) | 1 · fuente | alta | 37 |  |  | Se responde junto con la fila 425 (booleano) |
| 428 | 210000 | text block | concepto | NIIF S2 29 (g)(i) | NIIF S2 29 (g) (i) y (ii) | 3 · revisión | alta | 37 |  | datapoint y bloque (asesor (aceptada por Esteban)) | S2 29(g)(i) · bloque 37 (NIIF S2 29(g)(i) → nombre combinado «NIIF S2 29 (g) (i) y (ii)») |
| 430 | 210000 | text block | concepto | NIIF S2 29 (g)(i) | NIIF S2 29 (g) (i) y (ii) | 1 · fuente | alta | 37 |  |  | Modelo, desde el bloque 37 aprobado y los hechos de NIIF S2 29 (g) (i) y (ii) |
| 432 | 210000 | (sin tipo) | encabezado | NIIF S2 29A | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 433 | 210000 | booleano | concepto | NIIF S2 29B | NIIF S2 EI14 a E18 | 2 · etiqueta | alta | 29 |  |  | Sí/No desde un hecho o declaración negativa de NIIF S2 EI14 a E18 |
| 435 | 210000 | text block | concepto | NIIF S2 29B (a) | — | sin candidato | — | — |  | sector financiero (asesor (aceptada por Esteban)) | Solo sector financiero (Perfil); si no, «No aplica». Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo (NIIF S2 29B(a) no existe en el catálogo) |
| 436 | 210000 | (sin tipo) | subconcepto de la fila 435 | — | — | sin candidato | — | — |  | sector financiero (asesor (aceptada por Esteban)) | Solo sector financiero (Perfil); si no, «No aplica». Se responde junto con la fila 435 (text block) (NIIF S2 29B(a) no existe en el catálogo) |
| 437 | 210000 | text block | concepto | NIIF S2 29B (b) | NIIF S2 EI14 a E18 | 2 · etiqueta | alta | 29 |  |  | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 EI14 a E18 |
| 439 | 210000 | text block | concepto | NIIF S2 29C | NIIF S2 29 (a)(vi)(2) | 2 · etiqueta | alta | 33 |  | sector financiero (asesor (aceptada por Esteban)) | Solo sector financiero (Perfil); si no, «No aplica». Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 441 | 210000 | text block | concepto | NIIF S2 29C | NIIF S2 29 (a)(vi)(2) | 2 · etiqueta | alta | 33 |  | sector financiero (asesor (aceptada por Esteban)) | Solo sector financiero (Perfil); si no, «No aplica». Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 443 | 210000 | text block | concepto | NIIF S2 32 | NIIF S2 32 | 1 · fuente | alta | 4 |  |  | Modelo, desde el bloque 4 aprobado y los hechos de NIIF S2 32 |
| 444 | 210000 | (sin tipo) | subconcepto de la fila 443 | NIIF S2 32 | NIIF S2 32 | 1 · fuente | alta | 4 |  |  | Se responde junto con la fila 443 (text block) |
| 446 | 210000 | enumeración multiple | concepto | NIIF S2 32 | NIIF S2 32 | 1 · fuente | alta | 4 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 32 |
| 447 | 210000 | enumeración multiple | concepto | NIIF S2 32 | NIIF S2 32 | 1 · fuente | alta | 4 |  |  | Valor de la lista desde el Perfil o el hecho de NIIF S2 32 |
| 448 | 210000 | (sin tipo) | subconcepto de la fila 447 | NIIF S2 32 | NIIF S2 32 | 1 · fuente | alta | 4 |  |  | Se responde junto con la fila 447 (enumeración multiple) |
| 449 | 210000 | (sin tipo) | subconcepto de la fila 447 | NIIF S2 32 | NIIF S2 32 | 1 · fuente | alta | 4 |  |  | Se responde junto con la fila 447 (enumeración multiple) |
| 450 | 210000 | (sin tipo) | encabezado | NIIF S2 29 (a)(vi)(2); NIIF S2 58; NIIF S2 B63A | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 452 | 211100 | (sin tipo) | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 453 | 211100 | (sin tipo) | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 454 | 211100 | text | concepto | — | NIIF S2 29 (a)(vi)(2) | 2 · etiqueta | alta | 33 |  |  | Solo sector financiero (Perfil); si no, «No aplica». Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 455 | 211100 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B61 (a); NIIF S2 32 | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  | confirmada (sector financiero) (asesor (aceptada por Esteban)) | Solo sector financiero (Perfil); si no, «No aplica». Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) (2 códigos del párrafo; elegido por la etiqueta) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 456 | 211100 | porcentaje | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B61 (c) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Solo sector financiero (Perfil); si no, «No aplica». Cifra confirmada con unidad (NIIF S2 29 (a)(vi)(2)) |
| 458 | 211100 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B61 (c); NIIF S2 32 | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  | confirmada (sector financiero) (asesor (aceptada por Esteban)) | Solo sector financiero (Perfil); si no, «No aplica». Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) (2 códigos del párrafo; elegido por la etiqueta) |
| 459 | 211100 | (sin tipo) | subconcepto de la fila 458 | NIIF S2 29 (a)(vi)(2); NIIF S2 B61 (c); NIIF S2 32 | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Se responde junto con la fila 458 (text block) |
| 460 | 211100 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B61 (d) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Solo sector financiero (Perfil); si no, «No aplica». Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 462 | 211100 | text block | concepto | — | NIIF S2 29 (a)(iv) EI5 | 2 · etiqueta | alta | 31 |  | confirmada (sector financiero) (asesor (aceptada por Esteban)) | Solo sector financiero (Perfil); si no, «No aplica». Modelo, desde el bloque 31 aprobado y los hechos de NIIF S2 29 (a)(iv) EI5 |
| 463 | 211100 | (sin tipo) | subconcepto de la fila 462 | — | NIIF S2 29 (a)(iv) EI5 | 2 · etiqueta | alta | 31 |  |  | Se responde junto con la fila 462 (text block) |
| 466 | 211200 | (sin tipo) | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 467 | 211200 | (sin tipo) | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 468 | 211200 | text | concepto | — | NIIF S2 29 (a)(vi)(2) | 2 · etiqueta | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 469 | 211200 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62 (a) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 470 | 211200 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62 (a) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 471 | 211200 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62 (a) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 472 | 211200 | porcentaje | concepto | NIIF S2 B62 (c) | NIIF S2 29 (a)(vi)(2) | 2 · etiqueta | alta | 33 |  |  | Cifra confirmada con unidad (NIIF S2 29 (a)(vi)(2)) |
| 474 | 211200 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62 (c) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 476 | 211200 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62 (d) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 478 | 211200 | text | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62A (a)(i) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 479 | 211200 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62A (a)(ii) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 481 | 211200 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62A (a)(ii) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 483 | 211200 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62A (b) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 484 | 211200 | (sin tipo) | subconcepto de la fila 483 | NIIF S2 29 (a)(vi)(2); NIIF S2 B62A (b) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Se responde junto con la fila 483 (text block) |
| 487 | 211300 | (sin tipo) | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 488 | 211300 | text | concepto | — | NIIF S2 32 | 2 · etiqueta | alta | 4 |  |  | Modelo, desde el bloque 4 aprobado y los hechos de NIIF S2 32 |
| 489 | 211300 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (a) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 490 | 211300 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (a) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 491 | 211300 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (a) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 492 | 211300 | porcentaje | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (c) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Cifra confirmada con unidad (NIIF S2 29 (a)(vi)(2)) |
| 494 | 211300 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (c) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 495 | 211300 | (sin tipo) | subconcepto de la fila 494 | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (c) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Se responde junto con la fila 494 (text block) |
| 496 | 211300 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (d) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 498 | 211300 | text | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63A (a)(i); NIIF S2 B62A (a)(i) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 499 | 211300 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63A (a)(ii) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 501 | 211300 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63A (a)(ii) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 503 | 211300 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63A (b) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 504 | 211300 | (sin tipo) | subconcepto de la fila 503 | NIIF S2 29 (a)(vi)(2); NIIF S2 B63A (b) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 |  |  | Se responde junto con la fila 503 (text block) |
| 506 | 211300 | (sin tipo) | encabezado | — | — | — | — | — |  | encabezado (asesor (aceptada por Esteban)) | Sin respuesta (encabezado) |
| 508 | 805100 | tabla | fuera de alcance (SASB, Fase C) | — | — | — | — | — |  | fuera de alcance (asesor (aceptada por Esteban)) | Métricas por industria: pendiente de catálogo SASB · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 509 | 805100 | tabla | fuera de alcance (SASB, Fase C) | — | — | — | — | — |  | fuera de alcance (asesor (aceptada por Esteban)) | Métricas por industria: pendiente de catálogo SASB · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 582 | 901000 | (sin tipo) | miembro de tabla | NIIF S1 B50 | — | — | — | — |  |  | Miembro del eje de la tabla [901000]: se escribe como columna o fila de la tabla |
| 584 | 901000 | tabla | concepto | NIIF S1 B50; NIIF S1 B59 | — | regla primer año | alta | — |  | primer año (asesor (aceptada por Esteban)) | Primer año: «sin mapeo» (eje [901000] no aplica sin comparativos). Segundo año: alimentar desde el historial de versiones por bloque · tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git |
| 585 | 901000 | (sin tipo) | miembro de tabla | NIIF S1 B50; NIIF S1 B59 | — | — | — | — |  |  | Miembro del eje de la tabla [901000]: se escribe como columna o fila de la tabla |
| 587 | 901000 | (sin tipo) | miembro de tabla | NIIF S1 B54 | — | — | — | — |  |  | Miembro del eje de la tabla [901000]: se escribe como columna o fila de la tabla |

## Sin mapeo (propuesta de ampliación del catálogo; no se crea nada ahora)

### Conceptos con tipo sin datapoint (1)

| Fila | Sección | Tipo | Párrafos que piden |
|---:|---|---|---|
| 435 | 210000 | text block | NIIF S2 29B (a) |

### Párrafos citados por el formato que no tienen código en el catálogo (97)

| Párrafo | Filas que lo citan |
|---|---|
| NIIF S1 30 (a) | 1 (56) |
| NIIF S1 31 | 1 (57) |
| NIIF S1 36 | 16 (84, 85, 86, 87, 88, 89, 90, 91, 92, 94, 95, 96, …) |
| NIIF S1 42 | 1 (103) |
| NIIF S1 46 | 6 (148, 149, 151, 152, 153, 155) |
| NIIF S1 49 | 6 (148, 149, 151, 152, 153, 155) |
| NIIF S1 50 (a) | 5 (157, 159, 161, 162, 163) |
| NIIF S1 50 (b) | 1 (166) |
| NIIF S1 50 (c) | 1 (167) |
| NIIF S1 50 (d) | 1 (169) |
| NIIF S1 51 (a) | 1 (202) |
| NIIF S1 51 (b) | 1 (204) |
| NIIF S1 51 (c) | 1 (206) |
| NIIF S1 51 (d) | 1 (208) |
| NIIF S1 51 (e) | 1 (210) |
| NIIF S1 51 (f) | 1 (212) |
| NIIF S1 51 (g) | 1 (214) |
| NIIF S1 52 | 4 (186, 188, 190, 192) |
| NIIF S1 54 | 14 (148, 149, 151, 152, 153, 155, 157, 159, 161, 162, 163, 166, …) |
| NIIF S1 59 | 14 (148, 149, 151, 152, 153, 155, 157, 159, 161, 162, 163, 166, …) |
| NIIF S1 66 (a) | 2 (275, 277) |
| NIIF S1 66 (b) | 1 (279) |
| NIIF S1 66 (c) | 1 (281) |
| NIIF S1 67 | 1 (283) |
| NIIF S1 68 | 1 (283) |
| NIIF S1 76 | 1 (289) |
| NIIF S1 77 | 1 (292) |
| NIIF S1 82 | 1 (292) |
| NIIF S1 83 | 3 (295, 297, 299) |
| NIIF S1 86 | 3 (295, 297, 299) |
| NIIF S1 B50 | 1 (584) |
| NIIF S1 B52 | 4 (186, 188, 190, 192) |
| NIIF S1 B58 (a) | 3 (295, 297, 299) |
| NIIF S1 B59 | 1 (584) |
| NIIF S2 10 (a) | 1 (56) |
| NIIF S2 11 | 1 (56) |
| NIIF S2 12 | 2 (56, 337) |
| NIIF S2 21 | 1 (100) |
| NIIF S2 23 | 4 (59, 64, 309, 310) |
| NIIF S2 26 | 13 (122, 124, 125, 126, 128, 129, 130, 132, 134, 135, 137, 139, …) |
| NIIF S2 29 (a)(iv) | 2 (324, 325) |
| NIIF S2 29 (f)(i) | 4 (417, 420, 421, 422) |
| NIIF S2 29 (g)(i) | 4 (36, 425, 428, 430) |
| NIIF S2 29B (a) | 1 (435) |
| NIIF S2 29B (b) | 1 (437) |
| NIIF S2 29B | 1 (433) |
| NIIF S2 29C | 2 (439, 441) |
| NIIF S2 31 | 5 (354, 356, 358, 360, 361) |
| NIIF S2 33 (a) | 1 (221) |
| NIIF S2 33 (b) | 1 (223) |
| NIIF S2 33 (c) | 1 (225) |
| NIIF S2 33 (d) | 1 (227) |
| NIIF S2 33 (e) | 1 (229) |
| NIIF S2 33 (f) | 1 (231) |
| NIIF S2 33 (g) | 1 (233) |
| NIIF S2 33 (h) | 1 (235) |
| NIIF S2 34 (a) | 1 (237) |
| NIIF S2 34 (b) | 1 (239) |
| NIIF S2 34 (c) | 1 (241) |
| NIIF S2 34 (d) | 1 (243) |
| NIIF S2 5 | 2 (324, 325) |
| NIIF S2 64 | 5 (273, 275, 277, 279, 281) |
| NIIF S2 65 | 5 (273, 275, 277, 279, 281) |
| NIIF S2 B1 | 1 (105) |
| NIIF S2 B18 | 1 (105) |
| NIIF S2 B19 | 2 (309, 310) |
| NIIF S2 B22 | 2 (309, 310) |
| NIIF S2 B23 | 1 (313) |
| NIIF S2 B25 | 1 (313) |
| NIIF S2 B26 | 4 (317, 318, 320, 322) |
| NIIF S2 B29 | 4 (317, 318, 320, 322) |
| NIIF S2 B30 | 2 (330, 332) |
| NIIF S2 B31 | 2 (330, 332) |
| NIIF S2 B32 | 6 (334, 335, 337, 338, 339, 340) |
| NIIF S2 B57 | 6 (334, 335, 337, 338, 339, 340) |
| NIIF S2 B61 (a) | 1 (455) |
| NIIF S2 B61 (c) | 2 (456, 458) |
| NIIF S2 B61 (d) | 1 (460) |
| NIIF S2 B62 (a) | 3 (469, 470, 471) |
| NIIF S2 B62 (c) | 2 (472, 474) |
| NIIF S2 B62 (d) | 1 (476) |
| NIIF S2 B62A (a)(i) | 2 (478, 498) |
| NIIF S2 B62A (a)(ii) | 2 (479, 481) |
| NIIF S2 B62A (b) | 1 (483) |
| NIIF S2 B63 (a) | 3 (489, 490, 491) |
| NIIF S2 B63 (c) | 2 (492, 494) |
| NIIF S2 B63 (d) | 1 (496) |
| NIIF S2 B63A (a)(i) | 1 (498) |
| NIIF S2 B63A (a)(ii) | 2 (499, 501) |
| NIIF S2 B63A (b) | 1 (503) |
| NIIF S2 B64 | 24 (347, 352, 354, 356, 358, 360, 361, 364, 370, 375, 377, 379, …) |
| NIIF S2 B65 (a) | 3 (347, 370, 393) |
| NIIF S2 B65 (b) | 3 (352, 375, 398) |
| NIIF S2 B65 (c) | 15 (354, 356, 358, 360, 361, 377, 379, 381, 383, 384, 400, 402, …) |
| NIIF S2 B65 (d) | 3 (364, 387, 410) |
| NIIF S2 B66 | 10 (217, 219, 221, 223, 225, 227, 229, 231, 233, 235) |
| NIIF S2 B67 | 10 (217, 219, 221, 223, 225, 227, 229, 231, 233, 235) |
