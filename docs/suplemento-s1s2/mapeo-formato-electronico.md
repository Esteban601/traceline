# Mapeo concepto ↔ datapoint del Formato electrónico NIIF S1/S2

Encargo `2026-10-13-excel-respuestas-narrativas`, Paso 1. Generado por `scripts/formato/mapear-formato.mjs` (sin modelo) desde el asset `Estructura_Formato_NIIF_S1_S2_Autlan.xlsx` (sha256 `69b062137cd8`, hoja «Estructura Formato Electronico») y el catálogo de dev. **Pendiente de la revisión de Esteban** (revisión de IRStrat) en `referencia/formato-electronico/mapeo-revision.xlsx`.

Conforme a CLAUDE.md §4, este archivo no reproduce texto del formato: cada concepto se identifica por su **fila** en el asset, su sección y los párrafos que cita. Las etiquetas están en el asset y en el Excel de revisión (fuera de git).

## Resumen

- Filas en alcance: **364** (secciones [100000]–[211300] y [901000]; [8xxxxx] SASB fuera, Fase C).
- Clasificación: encabezado 5 · concepto 250 · subconcepto 106 · miembro de tabla 3.
- Capa que resolvió: — 8 · Perfil 16 · 1 · fuente 234 · 2 · etiqueta 83 · sin candidato 23.
- Confianza: — 31 · baja 14 · alta 217 · media 102.
- Con datapoint propuesto: 317; con bloque dueño: 204.

## Conceptos

| Fila | Sección | Tipo | Clasificación | Párrafos citados | Datapoint propuesto | Capa | Confianza | Bloque | Regla de llenado |
|---:|---|---|---|---|---|---|---|---:|---|
| 4 | 100000 | abstract | encabezado | — | — | — | — | — | Sin respuesta (encabezado) |
| 5 | 100000 | text | concepto | — | — | Perfil | baja | — | Perfil: campo por definir con Esteban |
| 6 | 100000 | enumeración | concepto | — | — | Perfil | alta | — | Desde perfil.tipo_instrumento (nuevo) |
| 7 | 100000 | enumeración | concepto | — | — | Perfil | alta | — | Desde perfil.fiduciario (nuevo) |
| 8 | 100000 | text block | concepto | — | — | Perfil | alta | — | Desde perfil.clave_cotizacion (nuevo) |
| 9 | 100000 | text block | concepto | — | — | Perfil | alta | — | Desde perfil.logo |
| 10 | 100000 | text block | concepto | — | — | Perfil | alta | — | Desde perfil.denominacion_formal |
| 11 | 100000 | text block | concepto | — | — | Perfil | alta | — | Desde reporte.ejercicio |
| 13 | 100000 | text block | concepto | — | — | Perfil | alta | — | Desde perfil.clave_cotizacion (nuevo) |
| 14 | 100000 | text block | concepto | — | — | Perfil | alta | — | Desde perfil.fiduciario (nuevo) |
| 15 | 100000 | text block | concepto | — | — | Perfil | alta | — | Desde perfil.fiduciario (nuevo) |
| 16 | 100000 | text block | concepto | — | — | Perfil | alta | — | Desde perfil.logo |
| 17 | 100000 | text block | concepto | — | — | Perfil | alta | — | Desde perfil.denominacion_formal |
| 18 | 100000 | (sin tipo) | subconcepto de la fila 17 | — | — | Perfil | alta | — | Se responde junto con la fila 17 (text block) |
| 19 | 100000 | text block | concepto | — | — | Perfil | alta | — | Desde perfil.denominacion_formal |
| 20 | 100000 | text block | concepto | — | — | Perfil | baja | — | Perfil: campo por definir con Esteban |
| 21 | 100000 | text block | concepto | — | — | Perfil | alta | — | Desde reporte.ejercicio |
| 24 | 200000 | abstract | encabezado | NIIF S1 26; NIIF S2 5 | — | — | — | — | Sin respuesta (encabezado) |
| 25 | 200000 | text block | concepto | NIIF S1 27 (a); NIIF S2 6 (a) | NIIF S1 27(a) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 27(a): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 26 | 200000 | (sin tipo) | subconcepto de la fila 25 | NIIF S1 27 (a); NIIF S2 6 (a) | NIIF S1 27(a) | 1 · fuente | media | — | Se responde junto con la fila 25 (text block) |
| 27 | 200000 | text | concepto | — | NIIF S1 27(b) | 2 · etiqueta | media | — | Sin bloque dueño para NIIF S1 27(b): «Pendiente» |
| 28 | 200000 | text block | concepto | NIIF S1 27 (a)(i); NIIF S2 6 (a)(i) | NIIF S1 27(a)(i) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 27(a)(i): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 30 | 200000 | text block | concepto | NIIF S1 27 (a)(ii); NIIF S2 6 (a)(ii) | NIIF S1 27(a)(ii) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 27(a)(ii): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 32 | 200000 | text block | concepto | NIIF S1 27 (a)(iii); NIIF S2 6 (a)(iii) | NIIF S1 27(a)(iii) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 27(a)(iii): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 34 | 200000 | text block | concepto | NIIF S1 27 (a)(iv); NIIF S2 6 (a)(iv) | NIIF S1 27(a)(iv) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 27(a)(iv): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 36 | 200000 | text block | concepto | NIIF S1 27 (a)(v); NIIF S2 6 (a)(v); NIIF S2 6; NIIF S2 29 (g)(i) | NIIF S1 27(a)(v) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 27(a)(v): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 38 | 200000 | booleano | concepto | NIIF S1 27 (a)(v); NIIF S2 6 (a)(v) | NIIF S1 27(a)(v) | 1 · fuente | media | — | Sí/No desde un hecho o declaración negativa de NIIF S1 27(a)(v) (2 códigos del párrafo; elegido por la etiqueta) |
| 39 | 200000 | (sin tipo) | subconcepto de la fila 38 | NIIF S1 27 (a)(v); NIIF S2 6 (a)(v) | NIIF S1 27(a)(v) | 1 · fuente | media | — | Se responde junto con la fila 38 (booleano) |
| 41 | 200000 | (sin tipo) | subconcepto de la fila 38 | NIIF S1 27 (a)(v); NIIF S2 6 (a)(v) | NIIF S1 27(a)(v) | 1 · fuente | media | — | Se responde junto con la fila 38 (booleano) |
| 43 | 200000 | text | concepto | NIIF S1 27 (b); NIIF S2 6 (b) | NIIF S1 27(b) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 27(b): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 44 | 200000 | booleano | concepto | NIIF S1 27 (b)(i); NIIF S2 6 (b)(i) | NIIF S2 6(b)(i) | 1 · fuente | media | 17 | Sí/No desde un hecho o declaración negativa de NIIF S2 6(b)(i) (2 códigos del párrafo; elegido por la etiqueta) |
| 45 | 200000 | (sin tipo) | subconcepto de la fila 44 | NIIF S1 27 (b)(i); NIIF S2 6 (b)(i) | NIIF S2 6(b)(i) | 1 · fuente | media | 17 | Se responde junto con la fila 44 (booleano) |
| 47 | 200000 | text block | concepto | NIIF S1 27 (b)(i); NIIF S2 6 (b)(i) | NIIF S1 27(b)(i) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 27(b)(i): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 49 | 200000 | booleano | concepto | NIIF S1 27 (b)(ii); NIIF S2 6 (b)(ii) | NIIF S1 27(b)(ii) | 1 · fuente | media | — | Sí/No desde un hecho o declaración negativa de NIIF S1 27(b)(ii) (2 códigos del párrafo; elegido por la etiqueta) |
| 50 | 200000 | (sin tipo) | subconcepto de la fila 49 | NIIF S1 27 (b)(ii); NIIF S2 6 (b)(ii) | NIIF S1 27(b)(ii) | 1 · fuente | media | — | Se responde junto con la fila 49 (booleano) |
| 52 | 200000 | text block | concepto | NIIF S1 27 (b)(ii); NIIF S2 6 (b)(ii) | NIIF S1 27(b)(ii) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 27(b)(ii): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 54 | 200000 | abstract | encabezado | NIIF S1 28; NIIF S1 29; NIIF S2 8; NIIF S2 9 | — | — | — | — | Sin respuesta (encabezado) |
| 55 | 200000 | text | concepto | NIIF S1 30; NIIF S2 10 | NIIF S1 30(a)y(b) | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 30(a)y(b): «Pendiente» (4 códigos del párrafo; elegido por la etiqueta) |
| 56 | 200000 | tabla | concepto | NIIF S1 30 (a); NIIF S2 10 (a); NIIF S2 11; NIIF S2 12 | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 57 | 200000 | text block | concepto | NIIF S1 30 (c); NIIF S2 10 (d); NIIF S1 31 | NIIF S1 30(c) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 30(c): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 59 | 200000 | text | concepto | NIIF S1 32; NIIF S2 13; NIIF S2 23 | NIIF S1 32(b) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 32(b): «Pendiente» (4 códigos del párrafo; elegido por la etiqueta) |
| 60 | 200000 | text block | concepto | NIIF S1 32 (a); NIIF S2 13 (a) | NIIF S1 32(a) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 32(a): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 62 | 200000 | text block | concepto | NIIF S1 32 (b); NIIF S2 13 (b) | NIIF S1 32(b) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 32(b): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 63 | 200000 | (sin tipo) | subconcepto de la fila 62 | NIIF S1 32 (b); NIIF S2 13 (b) | NIIF S1 32(b) | 1 · fuente | media | — | Se responde junto con la fila 62 (text block) |
| 64 | 200000 | text | concepto | NIIF S1 33; NIIF S2 14; NIIF S2 23 | NIIF S1 33(a) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 33(a): «Pendiente» (10 códigos del párrafo; elegido por la etiqueta) |
| 65 | 200000 | text block | concepto | NIIF S1 33 (a); NIIF S2 14 (a) | NIIF S1 33(a) | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 33(a): «Pendiente» |
| 67 | 200000 | text block | concepto | NIIF S2 14 (a)(i) | NIIF S2 14(a)(i) | 1 · fuente | alta | 22 | Modelo, desde el bloque 22 aprobado y los hechos de NIIF S2 14(a)(i) |
| 68 | 200000 | (sin tipo) | subconcepto de la fila 67 | — | NIIF S2 14(a)(i) | 1 · fuente | alta | 22 | Se responde junto con la fila 67 (text block) |
| 69 | 200000 | text block | concepto | NIIF S2 14 (a)(ii) | NIIF S2 14(a)(ii) | 1 · fuente | alta | 22 | Modelo, desde el bloque 22 aprobado y los hechos de NIIF S2 14(a)(ii) |
| 70 | 200000 | (sin tipo) | subconcepto de la fila 69 | NIIF S2 14 (a)(ii) | NIIF S2 14(a)(ii) | 1 · fuente | alta | 22 | Se responde junto con la fila 69 (text block) |
| 71 | 200000 | text block | concepto | NIIF S2 14 (a)(iii) | NIIF S2 14(a)(iii) | 1 · fuente | alta | 23 | Modelo, desde el bloque 23 aprobado y los hechos de NIIF S2 14(a)(iii) |
| 72 | 200000 | (sin tipo) | subconcepto de la fila 71 | NIIF S2 14 (a)(iii) | NIIF S2 14(a)(iii) | 1 · fuente | alta | 23 | Se responde junto con la fila 71 (text block) |
| 73 | 200000 | text block | concepto | NIIF S2 14 (a)(iv) | NIIF S2 14(a)(iv) | 1 · fuente | alta | 28 | Modelo, desde el bloque 28 aprobado y los hechos de NIIF S2 14(a)(iv) |
| 75 | 200000 | text block | concepto | NIIF S2 14 (a)(v) | NIIF S2 14(a)(v) | 1 · fuente | alta | 25 | Modelo, desde el bloque 25 aprobado y los hechos de NIIF S2 14(a)(v) |
| 77 | 200000 | text block | concepto | NIIF S2 14 (b) | NIIF S2 14(b) | 1 · fuente | alta | 25 | Modelo, desde el bloque 25 aprobado y los hechos de NIIF S2 14(b) |
| 79 | 200000 | text block | concepto | NIIF S1 33 (b); NIIF S2 14 (c) | NIIF S1 33(b) | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 33(b): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 81 | 200000 | text block | concepto | NIIF S1 33 (c) | NIIF S1 33(c) | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 33(c): «Pendiente» |
| 82 | 200000 | (sin tipo) | subconcepto de la fila 81 | — | NIIF S1 33(c) | 1 · fuente | alta | — | Se responde junto con la fila 81 (text block) |
| 83 | 200000 | text | concepto | NIIF S1 34; NIIF S2 15; NIIF S2 23 | NIIF S2 29 (d) · B65 (c) | 2 · etiqueta | media | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) · B65 (c) |
| 84 | 200000 | text | concepto | NIIF S1 36; NIIF S1 40 | NIIF S1 40(a) | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 40(a): «Pendiente» |
| 85 | 200000 | text block | concepto | NIIF S1 35 (a); NIIF S2 16 (a); NIIF S1 36; NIIF S1 40 | NIIF S1 35(a) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 35(a): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 86 | 200000 | (sin tipo) | subconcepto de la fila 85 | NIIF S1 35 (a); NIIF S2 16 (a); NIIF S1 36; NIIF S1 40 | NIIF S1 35(a) | 1 · fuente | media | — | Se responde junto con la fila 85 (text block) |
| 87 | 200000 | text block | concepto | NIIF S1 35 (a); NIIF S2 16 (a); NIIF S1 36; NIIF S1 40 | NIIF S1 35(a) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 35(a): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 88 | 200000 | (sin tipo) | subconcepto de la fila 87 | NIIF S1 35 (a); NIIF S2 16 (a); NIIF S1 36; NIIF S1 40 | NIIF S1 35(a) | 1 · fuente | media | — | Se responde junto con la fila 87 (text block) |
| 89 | 200000 | text block | concepto | NIIF S1 35 (a); NIIF S2 16 (a); NIIF S1 36; NIIF S1 40 | NIIF S1 35(a) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 35(a): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 90 | 200000 | (sin tipo) | subconcepto de la fila 89 | NIIF S1 35 (a); NIIF S2 16 (a); NIIF S1 36; NIIF S1 40 | NIIF S1 35(a) | 1 · fuente | media | — | Se responde junto con la fila 89 (text block) |
| 91 | 200000 | text | concepto | NIIF S1 36; NIIF S1 40 | NIIF S1 40(a) | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 40(a): «Pendiente» |
| 92 | 200000 | text block | concepto | NIIF S1 35 (b); NIIF S2 16 (b); NIIF S1 36; NIIF S1 40 | NIIF S1 35(b) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 35(b): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 93 | 200000 | (sin tipo) | subconcepto de la fila 92 | NIIF S1 36; NIIF S1 40 | NIIF S1 35(b) | 1 · fuente | media | — | Se responde junto con la fila 92 (text block) |
| 94 | 200000 | text | concepto | NIIF S1 35 (c)(i)(ii); NIIF S2 16 (c)(i)(ii); NIIF S1 36; NIIF S1 40 | NIIF S1 35(c)(i)(ii) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 35(c)(i)(ii): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 95 | 200000 | text block | concepto | NIIF S1 35 (c)(i)(ii); NIIF S2 16 (c)(i)(ii); NIIF S1 36; NIIF S1 40 | NIIF S1 35(c)(i)(ii) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 35(c)(i)(ii): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 96 | 200000 | text | concepto | NIIF S1 35 (d); NIIF S2 16 (d); NIIF S1 36; NIIF S1 40 | NIIF S1 35(d) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 35(d): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 97 | 200000 | text block | concepto | NIIF S1 35 (d); NIIF S2 16 (d); NIIF S1 36; NIIF S1 40 | NIIF S1 35(d) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 35(d): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 98 | 200000 | text | concepto | NIIF S1 35 (d); NIIF S2 16 (d); NIIF S1 36; NIIF S1 40 | NIIF S1 35(d) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 35(d): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 99 | 200000 | text block | concepto | NIIF S1 35 (d); NIIF S2 16 (d); NIIF S1 36; NIIF S1 40 | NIIF S1 35(d) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 35(d): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 100 | 200000 | text block | concepto | NIIF S1 40; NIIF S2 21; NIIF S1 36 | NIIF S1 40(a) | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 40(a): «Pendiente» |
| 102 | 200000 | (sin tipo) | subconcepto de la fila 100 | — | NIIF S1 40(a) | 1 · fuente | alta | — | Se responde junto con la fila 100 (text block) |
| 103 | 200000 | text block | concepto | NIIF S1 41; NIIF S1 42 | NIIF S1 41 | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 41: «Pendiente» |
| 105 | 200000 | text | concepto | NIIF S2 22; NIIF S2 B1; NIIF S2 B18 | NIIF S2 22(a)(ii) | 1 · fuente | media | 26 | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(a)(ii) (6 códigos del párrafo; elegido por la etiqueta) |
| 106 | 200000 | text block | concepto | NIIF S2 22 (a)(i) | NIIF S2 22(a)(i) | 1 · fuente | alta | 26 | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(a)(i) |
| 108 | 200000 | text block | concepto | NIIF S2 22 (a)(ii) | NIIF S2 22(a)(ii) | 1 · fuente | alta | 26 | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(a)(ii) |
| 110 | 200000 | text | concepto | NIIF S2 22 (a)(iii) | NIIF S2 22(a)(iii) | 1 · fuente | alta | 26 | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(a)(iii) |
| 112 | 200000 | text | concepto | NIIF S2 22 (b)(i) | NIIF S2 22(b)(i) | 1 · fuente | alta | 26 | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(b)(i) |
| 114 | 200000 | text | concepto | NIIF S2 22 (b)(ii) | NIIF S2 22(b)(ii) | 1 · fuente | alta | 26 | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(b)(ii) |
| 116 | 200000 | text | concepto | NIIF S2 22 (b)(iii) | NIIF S2 22(b)(iii) | 1 · fuente | alta | 26 | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(b)(iii) |
| 117 | 200000 | text block | concepto | NIIF S2 22 (b)(iii) | NIIF S2 22(b)(iii) | 1 · fuente | alta | 26 | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(b)(iii) |
| 119 | 200000 | text block | concepto | NIIF S2 22 (b)(iii) | NIIF S2 22(b)(iii) | 1 · fuente | alta | 26 | Modelo, desde el bloque 26 aprobado y los hechos de NIIF S2 22(b)(iii) |
| 121 | 200000 | abstract | encabezado | NIIF S1 43; NIIF S2 24 | — | — | — | — | Sin respuesta (encabezado) |
| 122 | 200000 | text block | concepto | NIIF S1 44 (a); NIIF S2 25 (a); NIIF S2 26 | NIIF S1 44 (a)(i)a(v) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 44 (a)(i)a(v): «Pendiente» (14 códigos del párrafo; elegido por la etiqueta) |
| 124 | 200000 | text block | concepto | NIIF S1 44 (a)(i); NIIF S2 25 (a)(i); NIIF S2 26 | NIIF S1 44 (a)(i) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 44 (a)(i): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 125 | 200000 | (sin tipo) | subconcepto de la fila 124 | NIIF S1 44 (a)(i); NIIF S2 25 (a)(i); NIIF S2 26 | NIIF S1 44 (a)(i) | 1 · fuente | media | — | Se responde junto con la fila 124 (text block) |
| 126 | 200000 | text block | concepto | NIIF S1 44 (a)(ii); NIIF S2 25 (a)(ii); NIIF S2 26 | NIIF S1 44 (a)(ii) | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 44 (a)(ii): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 128 | 200000 | text block | concepto | NIIF S1 44 (a)(iii); NIIF S2 25 (a)(iii); NIIF S2 26 | NIIF S1 44 (a)(iii) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 44 (a)(iii): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 129 | 200000 | (sin tipo) | subconcepto de la fila 128 | NIIF S1 44 (a)(iii); NIIF S2 25 (a)(iii); NIIF S2 26 | NIIF S1 44 (a)(iii) | 1 · fuente | media | — | Se responde junto con la fila 128 (text block) |
| 130 | 200000 | text block | concepto | NIIF S1 44 (a)(iv); NIIF S2 25 (a)(iv); NIIF S2 26 | NIIF S1 44 (a)(iv) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 44 (a)(iv): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 132 | 200000 | text block | concepto | NIIF S1 44 (a)(v); NIIF S2 25 (a)(v); NIIF S2 26 | NIIF S1 44 (a)(v) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 44 (a)(v): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 134 | 200000 | booleano | concepto | NIIF S1 44 (a)(vi); NIIF S2 25 (a)(vi); NIIF S2 26 | NIIF S1 44 (a)(vi) | 1 · fuente | media | — | Sí/No desde un hecho o declaración negativa de NIIF S1 44 (a)(vi) (2 códigos del párrafo; elegido por la etiqueta) |
| 135 | 200000 | (sin tipo) | subconcepto de la fila 134 | NIIF S1 44 (a)(vi); NIIF S2 25 (a)(vi); NIIF S2 26 | NIIF S1 44 (a)(vi) | 1 · fuente | media | — | Se responde junto con la fila 134 (booleano) |
| 137 | 200000 | text block | concepto | NIIF S1 44 (a)(vi); NIIF S2 25 (a)(vi); NIIF S2 26 | NIIF S1 44 (a)(vi) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 44 (a)(vi): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 139 | 200000 | text block | concepto | NIIF S1 44 (b); NIIF S2 25 (b); NIIF S2 26 | NIIF S1 44 (b) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 44 (b): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 141 | 200000 | text block | concepto | NIIF S1 44 (c); NIIF S2 25 (c); NIIF S2 26 | NIIF S1 44 (c) | 1 · fuente | media | — | Sin bloque dueño para NIIF S1 44 (c): «Pendiente» (2 códigos del párrafo; elegido por la etiqueta) |
| 143 | 200000 | abstract | encabezado | — | — | — | — | — | Sin respuesta (encabezado) |
| 144 | 200000 | text | concepto | NIIF S1 45; NIIF S1 27; NIIF S1 52; NIIF S1 53 | NIIF S1 27(a)(v) | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 27(a)(v): «Pendiente» (9 códigos del párrafo; elegido por la etiqueta) |
| 145 | 200000 | (sin tipo) | subconcepto de la fila 144 | NIIF S1 54; NIIF S1 59 | NIIF S1 27(a)(v) | 1 · fuente | alta | — | Se responde junto con la fila 144 (text) |
| 146 | 200000 | (sin tipo) | subconcepto de la fila 144 | NIIF S1 54; NIIF S1 59 | NIIF S1 27(a)(v) | 1 · fuente | alta | — | Se responde junto con la fila 144 (text) |
| 147 | 200000 | (sin tipo) | subconcepto de la fila 144 | NIIF S1 54; NIIF S1 59 | NIIF S1 27(a)(v) | 1 · fuente | alta | — | Se responde junto con la fila 144 (text) |
| 148 | 200000 | booleano | concepto | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 | NIIF S1 72 | 2 · etiqueta | media | — | Sí/No desde un hecho o declaración negativa de NIIF S1 72 |
| 149 | 200000 | text block | concepto | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 151 | 200000 | (sin tipo) | subconcepto de la fila 149 | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 | — | sin candidato | — | — | Se responde junto con la fila 149 (text block) |
| 152 | 200000 | enumeración | concepto | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 | NIIF S1 72 | 2 · etiqueta | media | — | Valor de la lista desde el Perfil o el hecho de NIIF S1 72 |
| 153 | 200000 | text block | concepto | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 | NIIF S1 32(b) | 2 · etiqueta | baja | — | Sin bloque dueño para NIIF S1 32(b): «Pendiente» |
| 155 | 200000 | text block | concepto | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 | NIIF S1 32(b) | 2 · etiqueta | media | — | Sin bloque dueño para NIIF S1 32(b): «Pendiente» |
| 157 | 200000 | text block | concepto | NIIF S1 50 (a); NIIF S1 54; NIIF S1 59 | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 159 | 200000 | text block | concepto | NIIF S1 50 (a); NIIF S1 54; NIIF S1 59 | NIIF S1 32(b) | 2 · etiqueta | media | — | Sin bloque dueño para NIIF S1 32(b): «Pendiente» |
| 161 | 200000 | booleano | concepto | NIIF S1 50 (a); NIIF S1 54; NIIF S1 59 | NIIF S1 72 | 2 · etiqueta | baja | — | Sí/No desde un hecho o declaración negativa de NIIF S1 72 |
| 162 | 200000 | (sin tipo) | subconcepto de la fila 161 | NIIF S1 50 (a); NIIF S1 54; NIIF S1 59 | NIIF S1 72 | 2 · etiqueta | baja | — | Se responde junto con la fila 161 (booleano) |
| 163 | 200000 | text block | concepto | NIIF S1 50 (a); NIIF S1 54; NIIF S1 59 | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 165 | 200000 | (sin tipo) | subconcepto de la fila 163 | NIIF S1 50 (b); NIIF S1 54; NIIF S1 59 | — | sin candidato | — | — | Se responde junto con la fila 163 (text block) |
| 166 | 200000 | enumeración | concepto | NIIF S1 50 (b); NIIF S1 54; NIIF S1 59 | NIIF S1 33(b) | 2 · etiqueta | baja | — | Valor de la lista desde el Perfil o el hecho de NIIF S1 33(b) |
| 167 | 200000 | text block | concepto | NIIF S1 50 (c); NIIF S1 54; NIIF S1 59 | NIIF S1 27(b)(ii) | 2 · etiqueta | baja | — | Sin bloque dueño para NIIF S1 27(b)(ii): «Pendiente» |
| 169 | 200000 | text block | concepto | NIIF S1 50 (d); NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Sin bloque dueño para NIIF S1 46 a 50: «Pendiente» |
| 171 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 172 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 173 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 174 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 175 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 176 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 177 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 178 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 179 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 180 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 181 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 182 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 183 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 184 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 185 | 200000 | (sin tipo) | subconcepto de la fila 169 | NIIF S1 54; NIIF S1 59 | NIIF S1 46 a 50 | 2 · etiqueta | media | — | Se responde junto con la fila 169 (text block) |
| 186 | 200000 | booleano | concepto | NIIF S1 52; NIIF S1 B52 | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 188 | 200000 | text block | concepto | NIIF S1 52; NIIF S1 B52 | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 190 | 200000 | text block | concepto | NIIF S1 52; NIIF S1 B52 | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 192 | 200000 | text block | concepto | NIIF S1 52; NIIF S1 B52 | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 194 | 200000 | text | concepto | — | NIIF S1 27(a)(v) | 2 · etiqueta | media | — | Sin bloque dueño para NIIF S1 27(a)(v): «Pendiente» |
| 195 | 200000 | text | concepto | NIIF S1 51; NIIF S2 33 | NIIF S2 33 | 1 · fuente | alta | 38 | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 (2 códigos del párrafo; elegido por la etiqueta) |
| 196 | 200000 | (sin tipo) | subconcepto de la fila 195 | — | NIIF S2 33 | 1 · fuente | alta | 38 | Se responde junto con la fila 195 (text) |
| 197 | 200000 | text block | concepto | NIIF S1 51; NIIF S2 33 | NIIF S2 33 | 1 · fuente | alta | 38 | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 (2 códigos del párrafo; elegido por la etiqueta) |
| 199 | 200000 | booleano | concepto | — | NIIF S2 13(a) | 2 · etiqueta | baja | 13 | Sí/No desde un hecho o declaración negativa de NIIF S2 13(a) |
| 200 | 200000 | enumeración valor unico | concepto | NIIF S1 51 | NIIF S1 51 | 1 · fuente | alta | — | Valor de la lista desde el Perfil o el hecho de NIIF S1 51 |
| 201 | 200000 | (sin tipo) | subconcepto de la fila 200 | NIIF S1 51 | NIIF S1 51 | 1 · fuente | alta | — | Se responde junto con la fila 200 (enumeración valor unico) |
| 202 | 200000 | text block | concepto | NIIF S1 51 (a) | NIIF S1 51 | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 51: «Pendiente» |
| 204 | 200000 | text block | concepto | NIIF S1 51 (b) | NIIF S1 51 | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 51: «Pendiente» |
| 206 | 200000 | text block | concepto | NIIF S1 51 (c) | NIIF S1 51 | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 51: «Pendiente» |
| 208 | 200000 | text block | concepto | NIIF S1 51 (d) | NIIF S1 51 | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 51: «Pendiente» |
| 210 | 200000 | text block | concepto | NIIF S1 51 (e) | NIIF S1 51 | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 51: «Pendiente» |
| 212 | 200000 | text block | concepto | NIIF S1 51 (f) | NIIF S1 51 | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 51: «Pendiente» |
| 214 | 200000 | text block | concepto | NIIF S1 51 (g) | NIIF S1 51 | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 51: «Pendiente» |
| 216 | 200000 | (sin tipo) | subconcepto de la fila 214 | — | NIIF S1 51 | 1 · fuente | alta | — | Se responde junto con la fila 214 (text block) |
| 217 | 200000 | text block | concepto | NIIF S2 33; NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 219 | 200000 | enumeración valor unico | concepto | NIIF S2 33; NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Valor de la lista desde el Perfil o el hecho de NIIF S2 33 |
| 220 | 200000 | (sin tipo) | subconcepto de la fila 219 | NIIF S2 33; NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Se responde junto con la fila 219 (enumeración valor unico) |
| 221 | 200000 | text block | concepto | NIIF S2 33 (a); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 223 | 200000 | text block | concepto | NIIF S2 33 (b); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 224 | 200000 | (sin tipo) | subconcepto de la fila 223 | NIIF S2 33 (b); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Se responde junto con la fila 223 (text block) |
| 225 | 200000 | text block | concepto | NIIF S2 33 (c); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 226 | 200000 | (sin tipo) | subconcepto de la fila 225 | NIIF S2 33 (c); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Se responde junto con la fila 225 (text block) |
| 227 | 200000 | text block | concepto | NIIF S2 33 (d); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 229 | 200000 | text block | concepto | NIIF S2 33 (e); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 231 | 200000 | text block | concepto | NIIF S2 33 (f); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 233 | 200000 | enumeración valor unico | concepto | NIIF S2 33 (g); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Valor de la lista desde el Perfil o el hecho de NIIF S2 33 |
| 234 | 200000 | (sin tipo) | subconcepto de la fila 233 | NIIF S2 33 (g); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Se responde junto con la fila 233 (enumeración valor unico) |
| 235 | 200000 | text block | concepto | NIIF S2 33 (h); NIIF S2 B66; NIIF S2 B67 | NIIF S2 33 | 1 · fuente | alta | 38 | Modelo, desde el bloque 38 aprobado y los hechos de NIIF S2 33 |
| 237 | 200000 | booleano | concepto | NIIF S2 34 (a) | NIIF S2 34 | 1 · fuente | alta | 39 | Sí/No desde un hecho o declaración negativa de NIIF S2 34 |
| 238 | 200000 | (sin tipo) | subconcepto de la fila 237 | NIIF S2 34 (a) | NIIF S2 34 | 1 · fuente | alta | 39 | Se responde junto con la fila 237 (booleano) |
| 239 | 200000 | text block | concepto | NIIF S2 34 (b) | NIIF S2 34 | 1 · fuente | alta | 39 | Modelo, desde el bloque 39 aprobado y los hechos de NIIF S2 34 |
| 241 | 200000 | text block | concepto | NIIF S2 34 (c) | NIIF S2 34 | 1 · fuente | alta | 39 | Modelo, desde el bloque 39 aprobado y los hechos de NIIF S2 34 |
| 243 | 200000 | text block | concepto | NIIF S2 34 (d) | NIIF S2 34 | 1 · fuente | alta | 39 | Modelo, desde el bloque 39 aprobado y los hechos de NIIF S2 34 |
| 245 | 200000 | text block | concepto | NIIF S2 35 | NIIF S2 35 | 1 · fuente | alta | 39 | Modelo, desde el bloque 39 aprobado y los hechos de NIIF S2 35 |
| 247 | 200000 | enumeración multiples valores | concepto | NIIF S2 36 (a) | NIIF S2 36 (a) | 1 · fuente | alta | 40 | Valor de la lista desde el Perfil o el hecho de NIIF S2 36 (a) |
| 248 | 200000 | (sin tipo) | subconcepto de la fila 247 | NIIF S2 36 (a) | NIIF S2 36 (a) | 1 · fuente | alta | 40 | Se responde junto con la fila 247 (enumeración multiples valores) |
| 249 | 200000 | enumeración multiples valores | concepto | NIIF S2 36 (b) | NIIF S2 36 (b) | 1 · fuente | alta | 40 | Valor de la lista desde el Perfil o el hecho de NIIF S2 36 (b) |
| 250 | 200000 | (sin tipo) | subconcepto de la fila 249 | NIIF S2 36 (b) | NIIF S2 36 (b) | 1 · fuente | alta | 40 | Se responde junto con la fila 249 (enumeración multiples valores) |
| 251 | 200000 | enumeración valor unico | concepto | NIIF S2 36 (c) | NIIF S2 36 (c) | 1 · fuente | alta | 40 | Valor de la lista desde el Perfil o el hecho de NIIF S2 36 (c) |
| 252 | 200000 | (sin tipo) | subconcepto de la fila 251 | NIIF S2 36 (c) | NIIF S2 36 (c) | 1 · fuente | alta | 40 | Se responde junto con la fila 251 (enumeración valor unico) |
| 253 | 200000 | booleano | concepto | NIIF S2 36 (d) | NIIF S2 36 (d) | 1 · fuente | alta | 40 | Sí/No desde un hecho o declaración negativa de NIIF S2 36 (d) |
| 254 | 200000 | (sin tipo) | subconcepto de la fila 253 | NIIF S2 36 (d) | NIIF S2 36 (d) | 1 · fuente | alta | 40 | Se responde junto con la fila 253 (booleano) |
| 255 | 200000 | text | concepto | NIIF S2 36 (e) | NIIF S2 36 (e)(i)a(iv) | 1 · fuente | alta | — | Sin bloque dueño para NIIF S2 36 (e)(i)a(iv): «Pendiente» (5 códigos del párrafo; elegido por la etiqueta) |
| 256 | 200000 | booleano | concepto | — | NIIF S2 36 (e)(i)a(iv) | 2 · etiqueta | alta | — | Sí/No desde un hecho o declaración negativa de NIIF S2 36 (e)(i)a(iv) |
| 257 | 200000 | text block | concepto | — | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 259 | 200000 | text block | concepto | NIIF S2 36 (e)(i) | NIIF S2 36 (e)(i) | 1 · fuente | alta | 40 | Modelo, desde el bloque 40 aprobado y los hechos de NIIF S2 36 (e)(i) |
| 261 | 200000 | text block | concepto | NIIF S2 36 (e)(ii) | NIIF S2 36 (e)(ii) | 1 · fuente | alta | 40 | Modelo, desde el bloque 40 aprobado y los hechos de NIIF S2 36 (e)(ii) |
| 263 | 200000 | enumeración valor unico | concepto | NIIF S2 36 (e)(iii) | NIIF S2 36 (e)(iii) | 1 · fuente | alta | 40 | Valor de la lista desde el Perfil o el hecho de NIIF S2 36 (e)(iii) |
| 264 | 200000 | (sin tipo) | subconcepto de la fila 263 | NIIF S2 36 (e)(iii) | NIIF S2 36 (e)(iii) | 1 · fuente | alta | 40 | Se responde junto con la fila 263 (enumeración valor unico) |
| 265 | 200000 | enumeración valor unico | concepto | NIIF S2 36 (e)(iii) | NIIF S2 36 (e)(iii) | 1 · fuente | alta | 40 | Valor de la lista desde el Perfil o el hecho de NIIF S2 36 (e)(iii) |
| 266 | 200000 | (sin tipo) | subconcepto de la fila 265 | NIIF S2 36 (e)(iii) | NIIF S2 36 (e)(iii) | 1 · fuente | alta | 40 | Se responde junto con la fila 265 (enumeración valor unico) |
| 267 | 200000 | text block | concepto | NIIF S2 36 (e)(iv) | NIIF S2 36 (e)(iv) | 1 · fuente | alta | 40 | Modelo, desde el bloque 40 aprobado y los hechos de NIIF S2 36 (e)(iv) |
| 268 | 200000 | (sin tipo) | subconcepto de la fila 267 | NIIF S2 36 (e)(iv) | NIIF S2 36 (e)(iv) | 1 · fuente | alta | 40 | Se responde junto con la fila 267 (text block) |
| 269 | 200000 | (sin tipo) | subconcepto de la fila 267 | — | NIIF S2 36 (e)(iv) | 1 · fuente | alta | 40 | Se responde junto con la fila 267 (text block) |
| 270 | 200000 | (sin tipo) | subconcepto de la fila 267 | — | NIIF S2 36 (e)(iv) | 1 · fuente | alta | 40 | Se responde junto con la fila 267 (text block) |
| 272 | 200000 | (sin tipo) | subconcepto de la fila 267 | NIIF S2 64; NIIF S2 65 | NIIF S2 36 (e)(iv) | 1 · fuente | alta | 40 | Se responde junto con la fila 267 (text block) |
| 273 | 200000 | booleano | concepto | NIIF S2 64; NIIF S2 65 | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 274 | 200000 | (sin tipo) | subconcepto de la fila 273 | NIIF S2 64; NIIF S2 65 | — | sin candidato | — | — | Se responde junto con la fila 273 (booleano) |
| 275 | 200000 | text block | concepto | NIIF S1 66 (a); NIIF S2 64; NIIF S2 65 | NIIF S1 35(b) | 2 · etiqueta | baja | — | Sin bloque dueño para NIIF S1 35(b): «Pendiente» |
| 277 | 200000 | text block | concepto | NIIF S1 66 (a); NIIF S2 64; NIIF S2 65 | NIIF S1 35(b) | 2 · etiqueta | media | — | Sin bloque dueño para NIIF S1 35(b): «Pendiente» |
| 279 | 200000 | text block | concepto | NIIF S1 66 (b); NIIF S2 64; NIIF S2 65 | NIIF S1 30(c) | 2 · etiqueta | media | — | Sin bloque dueño para NIIF S1 30(c): «Pendiente» |
| 281 | 200000 | text block | concepto | NIIF S1 66 (c); NIIF S2 64; NIIF S2 65 | NIIF S1 44 (a)(v) | 2 · etiqueta | baja | — | Sin bloque dueño para NIIF S1 44 (a)(v): «Pendiente» |
| 283 | 200000 | text block | concepto | NIIF S1 68; NIIF S1 67 | NIIF S1 35(a) | 2 · etiqueta | baja | — | Sin bloque dueño para NIIF S1 35(a): «Pendiente» |
| 285 | 200000 | text | concepto | NIIF S1 72 | NIIF S1 72 | 1 · fuente | alta | — | Sin bloque dueño para NIIF S1 72: «Pendiente» |
| 286 | 200000 | booleano | concepto | — | NIIF S1 72 | 2 · etiqueta | alta | — | Sí/No desde un hecho o declaración negativa de NIIF S1 72 |
| 287 | 200000 | text block | concepto | NIIF S1 74 | NIIF S1 74 | 1 · fuente | alta | 6 | Modelo, desde el bloque 6 aprobado y los hechos de NIIF S1 74 |
| 288 | 200000 | (sin tipo) | subconcepto de la fila 287 | NIIF S1 74; NIIF S1 76 | NIIF S1 74 | 1 · fuente | alta | 6 | Se responde junto con la fila 287 (text block) |
| 289 | 200000 | text block | concepto | NIIF S1 74; NIIF S1 76 | NIIF S1 74 | 1 · fuente | alta | 6 | Modelo, desde el bloque 6 aprobado y los hechos de NIIF S1 74 |
| 291 | 200000 | (sin tipo) | subconcepto de la fila 289 | NIIF S1 77; NIIF S1 82 | NIIF S1 74 | 1 · fuente | alta | 6 | Se responde junto con la fila 289 (text block) |
| 292 | 200000 | text block | concepto | NIIF S1 77; NIIF S1 82 | NIIF S1 74 | 2 · etiqueta | media | 6 | Modelo, desde el bloque 6 aprobado y los hechos de NIIF S1 74 |
| 294 | 200000 | (sin tipo) | subconcepto de la fila 292 | NIIF S1 83; NIIF S1 86; NIIF S1 B58 (a) | NIIF S1 74 | 2 · etiqueta | media | 6 | Se responde junto con la fila 292 (text block) |
| 295 | 200000 | text block | concepto | NIIF S1 83; NIIF S1 86; NIIF S1 B58 (a) | NIIF S1 33(b) | 2 · etiqueta | media | — | Sin bloque dueño para NIIF S1 33(b): «Pendiente» |
| 297 | 200000 | text block | concepto | NIIF S1 83; NIIF S1 86; NIIF S1 B58 (a) | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 299 | 200000 | text block | concepto | NIIF S1 83; NIIF S1 86; NIIF S1 B58 (a) | NIIF S1 35(b) | 2 · etiqueta | baja | — | Sin bloque dueño para NIIF S1 35(b): «Pendiente» |
| 301 | 200000 | (sin tipo) | subconcepto de la fila 299 | — | NIIF S1 35(b) | 2 · etiqueta | baja | — | Se responde junto con la fila 299 (text block) |
| 302 | 200000 | (sin tipo) | subconcepto de la fila 299 | — | NIIF S1 35(b) | 2 · etiqueta | baja | — | Se responde junto con la fila 299 (text block) |
| 303 | 200000 | booleano | concepto | — | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 306 | 210000 | (sin tipo) | subconcepto de la fila 303 | — | — | sin candidato | — | — | Se responde junto con la fila 303 (booleano) |
| 307 | 210000 | text | concepto | NIIF S2 23 | NIIF S2 29 (a)(i) | 2 · etiqueta | media | 29 | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 29 (a)(i) |
| 308 | 210000 | text | concepto | — | NIIF S2 EI14 a E18 | 2 · etiqueta | media | 29 | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 EI14 a E18 |
| 309 | 210000 | text | concepto | NIIF S2 23; NIIF S2 29 (a)(i); NIIF S2 B19; NIIF S2 B22 | NIIF S2 29 (a)(i) | 1 · fuente | alta | 29 | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 29 (a)(i) |
| 311 | 210000 | (sin tipo) | subconcepto de la fila 309 | NIIF S2 23; NIIF S2 29 (a)(i); NIIF S2 B19; NIIF S2 B22 | NIIF S2 29 (a)(i) | 1 · fuente | alta | 29 | Se responde junto con la fila 309 (text) |
| 313 | 210000 | booleano | concepto | NIIF S2 29 (a)(ii); NIIF S2 B23; NIIF S2 B25 | NIIF S2 29 (a)(ii) | 1 · fuente | alta | 30 | Sí/No desde un hecho o declaración negativa de NIIF S2 29 (a)(ii) |
| 315 | 210000 | (sin tipo) | subconcepto de la fila 313 | NIIF S2 29 (a)(ii); NIIF S2 B23; NIIF S2 B25 | NIIF S2 29 (a)(ii) | 1 · fuente | alta | 30 | Se responde junto con la fila 313 (booleano) |
| 317 | 210000 | text | concepto | NIIF S2 29 (a)(iii); NIIF S2 B26; NIIF S2 B29 | NIIF S2 29 (a)(iii) | 1 · fuente | alta | 30 | Modelo, desde el bloque 30 aprobado y los hechos de NIIF S2 29 (a)(iii) |
| 318 | 210000 | text block | concepto | NIIF S2 29 (a)(iii); NIIF S2 B26; NIIF S2 B29 | NIIF S2 29 (a)(iii) | 1 · fuente | alta | 30 | Modelo, desde el bloque 30 aprobado y los hechos de NIIF S2 29 (a)(iii) |
| 320 | 210000 | text block | concepto | NIIF S2 29 (a)(iii); NIIF S2 B26; NIIF S2 B29 | NIIF S2 29 (a)(iii) | 1 · fuente | alta | 30 | Modelo, desde el bloque 30 aprobado y los hechos de NIIF S2 29 (a)(iii) |
| 322 | 210000 | text block | concepto | NIIF S2 29 (a)(iii); NIIF S2 B26; NIIF S2 B29 | NIIF S2 29 (a)(iii) | 1 · fuente | alta | 30 | Modelo, desde el bloque 30 aprobado y los hechos de NIIF S2 29 (a)(iii) |
| 324 | 210000 | text | concepto | NIIF S2 29 (a)(iv); NIIF S2 5 | NIIF S2 EI14 a E18 | 2 · etiqueta | media | 29 | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 EI14 a E18 |
| 325 | 210000 | tabla | concepto | NIIF S2 29 (a)(iv); NIIF S2 5 | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 326 | 210000 | (sin tipo) | subconcepto de la fila 325 | — | — | sin candidato | — | — | Se responde junto con la fila 325 (tabla) |
| 327 | 210000 | text block | concepto | — | NIIF S2 EI14 a E18 | 2 · etiqueta | alta | 29 | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 EI14 a E18 |
| 328 | 210000 | (sin tipo) | subconcepto de la fila 327 | — | NIIF S2 EI14 a E18 | 2 · etiqueta | alta | 29 | Se responde junto con la fila 327 (text block) |
| 329 | 210000 | (sin tipo) | subconcepto de la fila 327 | NIIF S2 29 (a)(v); NIIF S2 B30; NIIF S2 B31 | NIIF S2 EI14 a E18 | 2 · etiqueta | alta | 29 | Se responde junto con la fila 327 (text block) |
| 330 | 210000 | text block | concepto | NIIF S2 29 (a)(v); NIIF S2 B30; NIIF S2 B31 | NIIF S2 29 (a)(v) | 1 · fuente | alta | 32 | Modelo, desde el bloque 32 aprobado y los hechos de NIIF S2 29 (a)(v) |
| 332 | 210000 | text block | concepto | NIIF S2 29 (a)(v); NIIF S2 B30; NIIF S2 B31 | NIIF S2 29 (a)(v) | 1 · fuente | alta | 32 | Modelo, desde el bloque 32 aprobado y los hechos de NIIF S2 29 (a)(v) |
| 334 | 210000 | text | concepto | NIIF S2 29 (a)(vi)(1); NIIF S2 B32; NIIF S2 B57 | NIIF S2 29 (a)(vi)(1) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(1) |
| 335 | 210000 | enumeración multiple | concepto | NIIF S2 29 (a)(vi)(1); NIIF S2 B32; NIIF S2 B57 | NIIF S2 29 (a)(vi)(1) | 1 · fuente | alta | 33 | Valor de la lista desde el Perfil o el hecho de NIIF S2 29 (a)(vi)(1) |
| 336 | 210000 | text | concepto | — | NIIF S2 EI14 a E18 | 2 · etiqueta | media | 29 | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 EI14 a E18 |
| 337 | 210000 | tabla | concepto | NIIF S2 29 (a)(vi)(1); NIIF S2 B32; NIIF S2 B57; NIIF S2 12 | NIIF S2 29 (a)(vi)(1) | 1 · fuente | alta | 33 | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(1)) |
| 338 | 210000 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B32; NIIF S2 B57 | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 339 | 210000 | enumeración multiple | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B32; NIIF S2 B57 | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Valor de la lista desde el Perfil o el hecho de NIIF S2 29 (a)(vi)(2) |
| 340 | 210000 | enumeración multiple | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B32; NIIF S2 B57 | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Valor de la lista desde el Perfil o el hecho de NIIF S2 29 (a)(vi)(2) |
| 342 | 210000 | text block | concepto | — | NIIF S2 EI19 a EI24 | 2 · etiqueta | alta | 29 | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 EI19 a EI24 |
| 343 | 210000 | (sin tipo) | subconcepto de la fila 342 | — | NIIF S2 EI19 a EI24 | 2 · etiqueta | alta | 29 | Se responde junto con la fila 342 (text block) |
| 344 | 210000 | text block | concepto | — | NIIF S2 29 (b) · B65 (b) | 2 · etiqueta | media | 34 | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) · B65 (b) |
| 345 | 210000 | (sin tipo) | subconcepto de la fila 344 | NIIF S2 29 (b) | NIIF S2 29 (b) · B65 (b) | 2 · etiqueta | media | 34 | Se responde junto con la fila 344 (text block) |
| 346 | 210000 | (sin tipo) | subconcepto de la fila 344 | — | NIIF S2 29 (b) · B65 (b) | 2 · etiqueta | media | 34 | Se responde junto con la fila 344 (text block) |
| 347 | 210000 | tabla | concepto | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (a) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Tabla desde registros de clima u objetivos (NIIF S2 29 (b)) |
| 348 | 210000 | text block | concepto | NIIF S2 29 (b) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 350 | 210000 | text block | concepto | NIIF S2 29 (e) | NIIF S2 29 (e) | 1 · fuente | alta | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (e) |
| 352 | 210000 | text block | concepto | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (b) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 353 | 210000 | (sin tipo) | subconcepto de la fila 352 | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (b) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Se responde junto con la fila 352 (text block) |
| 354 | 210000 | text block | concepto | NIIF S2 29 (b); NIIF S2 31; NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 356 | 210000 | text block | concepto | NIIF S2 29 (b); NIIF S2 31; NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 358 | 210000 | text block | concepto | NIIF S2 29 (b); NIIF S2 31; NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 360 | 210000 | text | concepto | NIIF S2 29 (b); NIIF S2 31; NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 361 | 210000 | text block | concepto | NIIF S2 29 (b); NIIF S2 31; NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Modelo, desde el bloque 34 aprobado y los hechos de NIIF S2 29 (b) |
| 363 | 210000 | (sin tipo) | subconcepto de la fila 361 | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (d) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Se responde junto con la fila 361 (text block) |
| 364 | 210000 | enumeración valor unico | concepto | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (d) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Valor de la lista desde el Perfil o el hecho de NIIF S2 29 (b) |
| 365 | 210000 | (sin tipo) | subconcepto de la fila 364 | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (e) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Se responde junto con la fila 364 (enumeración valor unico) |
| 367 | 210000 | text block | concepto | — | NIIF S2 29 (c) · B65 (b) | 2 · etiqueta | media | 35 | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) · B65 (b) |
| 368 | 210000 | (sin tipo) | subconcepto de la fila 367 | NIIF S2 29 (b) | NIIF S2 29 (c) · B65 (b) | 2 · etiqueta | media | 35 | Se responde junto con la fila 367 (text block) |
| 369 | 210000 | (sin tipo) | subconcepto de la fila 367 | — | NIIF S2 29 (c) · B65 (b) | 2 · etiqueta | media | 35 | Se responde junto con la fila 367 (text block) |
| 370 | 210000 | tabla | concepto | NIIF S2 29 (b); NIIF S2 B64; NIIF S2 B65 (a) | NIIF S2 29 (b) | 1 · fuente | alta | 34 | Tabla desde registros de clima u objetivos (NIIF S2 29 (b)) |
| 371 | 210000 | text block | concepto | NIIF S2 29 (c) | NIIF S2 29 (c) | 1 · fuente | alta | 35 | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 373 | 210000 | text block | concepto | NIIF S2 29 (e) | NIIF S2 29 (e) | 1 · fuente | alta | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (e) |
| 375 | 210000 | text block | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (b) | NIIF S2 29 (c) | 1 · fuente | alta | 35 | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 376 | 210000 | (sin tipo) | subconcepto de la fila 375 | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (b) | NIIF S2 29 (c) | 1 · fuente | alta | 35 | Se responde junto con la fila 375 (text block) |
| 377 | 210000 | text block | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (c) | 1 · fuente | alta | 35 | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 379 | 210000 | text block | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (c) | 1 · fuente | alta | 35 | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 381 | 210000 | text block | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (c) | 1 · fuente | alta | 35 | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 383 | 210000 | text | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (c) | 1 · fuente | alta | 35 | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 384 | 210000 | text block | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (c) | 1 · fuente | alta | 35 | Modelo, desde el bloque 35 aprobado y los hechos de NIIF S2 29 (c) |
| 386 | 210000 | (sin tipo) | subconcepto de la fila 384 | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (d) | NIIF S2 29 (c) | 1 · fuente | alta | 35 | Se responde junto con la fila 384 (text block) |
| 387 | 210000 | enumeración valor unico | concepto | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (d) | NIIF S2 29 (c) | 1 · fuente | alta | 35 | Valor de la lista desde el Perfil o el hecho de NIIF S2 29 (c) |
| 388 | 210000 | (sin tipo) | subconcepto de la fila 387 | NIIF S2 29 (c); NIIF S2 B64; NIIF S2 B65 (e) | NIIF S2 29 (c) | 1 · fuente | alta | 35 | Se responde junto con la fila 387 (enumeración valor unico) |
| 390 | 210000 | text block | concepto | — | NIIF S2 13(a) | 2 · etiqueta | media | 13 | Modelo, desde el bloque 13 aprobado y los hechos de NIIF S2 13(a) |
| 391 | 210000 | (sin tipo) | subconcepto de la fila 390 | NIIF S2 29 (b) | NIIF S2 13(a) | 2 · etiqueta | media | 13 | Se responde junto con la fila 390 (text block) |
| 392 | 210000 | (sin tipo) | subconcepto de la fila 390 | — | NIIF S2 13(a) | 2 · etiqueta | media | 13 | Se responde junto con la fila 390 (text block) |
| 393 | 210000 | tabla | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (a) | NIIF S2 29 (d) | 1 · fuente | alta | 36 | Tabla desde registros de clima u objetivos (NIIF S2 29 (d)) |
| 394 | 210000 | text block | concepto | NIIF S2 29 (d) | NIIF S2 29 (d) | 1 · fuente | alta | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 396 | 210000 | text block | concepto | NIIF S2 29 (e) | NIIF S2 29 (e) | 1 · fuente | alta | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (e) |
| 398 | 210000 | text block | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (b) | NIIF S2 29 (d) | 1 · fuente | alta | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 399 | 210000 | (sin tipo) | subconcepto de la fila 398 | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (b) | NIIF S2 29 (d) | 1 · fuente | alta | 36 | Se responde junto con la fila 398 (text block) |
| 400 | 210000 | text block | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (d) | 1 · fuente | alta | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 402 | 210000 | text block | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (d) | 1 · fuente | alta | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 404 | 210000 | text block | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (d) | 1 · fuente | alta | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 406 | 210000 | text | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (d) | 1 · fuente | alta | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 407 | 210000 | text block | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (c) | NIIF S2 29 (d) | 1 · fuente | alta | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (d) |
| 409 | 210000 | (sin tipo) | subconcepto de la fila 407 | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (d) | NIIF S2 29 (d) | 1 · fuente | alta | 36 | Se responde junto con la fila 407 (text block) |
| 410 | 210000 | enumeración valor unico | concepto | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (d) | NIIF S2 29 (d) | 1 · fuente | alta | 36 | Valor de la lista desde el Perfil o el hecho de NIIF S2 29 (d) |
| 411 | 210000 | (sin tipo) | subconcepto de la fila 410 | NIIF S2 29 (d); NIIF S2 B64; NIIF S2 B65 (e) | NIIF S2 29 (d) | 1 · fuente | alta | 36 | Se responde junto con la fila 410 (enumeración valor unico) |
| 413 | 210000 | text | concepto | — | NIIF S2 29 (e) | 2 · etiqueta | alta | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (e) |
| 414 | 210000 | text block | concepto | NIIF S2 29 (e) | NIIF S2 29 (e) | 1 · fuente | alta | 36 | Modelo, desde el bloque 36 aprobado y los hechos de NIIF S2 29 (e) |
| 416 | 210000 | text | concepto | — | NIIF S2 29 (f) (i) y (ii) | 2 · etiqueta | alta | 37 | Modelo, desde el bloque 37 aprobado y los hechos de NIIF S2 29 (f) (i) y (ii) |
| 417 | 210000 | booleano | concepto | NIIF S2 29 (f)(i) | NIIF S2 29 (f) (i) y (ii) | 2 · etiqueta | alta | 37 | Sí/No desde un hecho o declaración negativa de NIIF S2 29 (f) (i) y (ii) |
| 418 | 210000 | (sin tipo) | subconcepto de la fila 417 | NIIF S2 29 (f)(i) | NIIF S2 29 (f) (i) y (ii) | 2 · etiqueta | alta | 37 | Se responde junto con la fila 417 (booleano) |
| 420 | 210000 | text block | concepto | NIIF S2 29 (f)(i) | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 421 | 210000 | (sin tipo) | subconcepto de la fila 420 | NIIF S2 29 (f)(i) | — | sin candidato | — | — | Se responde junto con la fila 420 (text block) |
| 422 | 210000 | text block | concepto | NIIF S2 29 (f)(i) | NIIF S2 EI14 a E18 | 2 · etiqueta | alta | 29 | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 EI14 a E18 |
| 424 | 210000 | text | concepto | — | NIIF S1 27(a)(v) | 2 · etiqueta | media | — | Sin bloque dueño para NIIF S1 27(a)(v): «Pendiente» |
| 425 | 210000 | booleano | concepto | NIIF S2 29 (g)(i) | NIIF S2 29 (g) (i) y (ii) | 2 · etiqueta | alta | 37 | Sí/No desde un hecho o declaración negativa de NIIF S2 29 (g) (i) y (ii) |
| 426 | 210000 | (sin tipo) | subconcepto de la fila 425 | NIIF S2 29 (g)(i) | NIIF S2 29 (g) (i) y (ii) | 2 · etiqueta | alta | 37 | Se responde junto con la fila 425 (booleano) |
| 428 | 210000 | text block | concepto | NIIF S2 29 (g)(i) | NIIF S2 25 (b) | 2 · etiqueta | media | 27 | Modelo, desde el bloque 27 aprobado y los hechos de NIIF S2 25 (b) |
| 430 | 210000 | text block | concepto | NIIF S2 29 (g)(i) | NIIF S2 29 (g) (i) y (ii) | 2 · etiqueta | alta | 37 | Modelo, desde el bloque 37 aprobado y los hechos de NIIF S2 29 (g) (i) y (ii) |
| 432 | 210000 | (sin tipo) | subconcepto de la fila 430 | NIIF S2 29A | NIIF S2 29 (g) (i) y (ii) | 2 · etiqueta | alta | 37 | Se responde junto con la fila 430 (text block) |
| 433 | 210000 | booleano | concepto | NIIF S2 29B | NIIF S2 EI14 a E18 | 2 · etiqueta | alta | 29 | Sí/No desde un hecho o declaración negativa de NIIF S2 EI14 a E18 |
| 435 | 210000 | text block | concepto | NIIF S2 29B (a) | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 436 | 210000 | (sin tipo) | subconcepto de la fila 435 | — | — | sin candidato | — | — | Se responde junto con la fila 435 (text block) |
| 437 | 210000 | text block | concepto | NIIF S2 29B (b) | NIIF S2 EI14 a E18 | 2 · etiqueta | alta | 29 | Modelo, desde el bloque 29 aprobado y los hechos de NIIF S2 EI14 a E18 |
| 439 | 210000 | text block | concepto | NIIF S2 29C | NIIF S2 29 (a)(vi)(2) | 2 · etiqueta | media | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 441 | 210000 | text block | concepto | NIIF S2 29C | NIIF S2 29 (a)(vi)(2) | 2 · etiqueta | media | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 443 | 210000 | text block | concepto | NIIF S2 32 | NIIF S2 32 | 1 · fuente | alta | 4 | Modelo, desde el bloque 4 aprobado y los hechos de NIIF S2 32 |
| 444 | 210000 | (sin tipo) | subconcepto de la fila 443 | NIIF S2 32 | NIIF S2 32 | 1 · fuente | alta | 4 | Se responde junto con la fila 443 (text block) |
| 446 | 210000 | enumeración multiple | concepto | NIIF S2 32 | NIIF S2 32 | 1 · fuente | alta | 4 | Valor de la lista desde el Perfil o el hecho de NIIF S2 32 |
| 447 | 210000 | enumeración multiple | concepto | NIIF S2 32 | NIIF S2 32 | 1 · fuente | alta | 4 | Valor de la lista desde el Perfil o el hecho de NIIF S2 32 |
| 448 | 210000 | (sin tipo) | subconcepto de la fila 447 | NIIF S2 32 | NIIF S2 32 | 1 · fuente | alta | 4 | Se responde junto con la fila 447 (enumeración multiple) |
| 449 | 210000 | (sin tipo) | subconcepto de la fila 447 | NIIF S2 32 | NIIF S2 32 | 1 · fuente | alta | 4 | Se responde junto con la fila 447 (enumeración multiple) |
| 450 | 210000 | (sin tipo) | subconcepto de la fila 447 | NIIF S2 29 (a)(vi)(2); NIIF S2 58; NIIF S2 B63A | NIIF S2 32 | 1 · fuente | alta | 4 | Se responde junto con la fila 447 (enumeración multiple) |
| 452 | 211100 | (sin tipo) | subconcepto de la fila 447 | — | NIIF S2 32 | 1 · fuente | alta | 4 | Se responde junto con la fila 447 (enumeración multiple) |
| 453 | 211100 | (sin tipo) | subconcepto de la fila 447 | — | NIIF S2 32 | 1 · fuente | alta | 4 | Se responde junto con la fila 447 (enumeración multiple) |
| 454 | 211100 | text | concepto | — | NIIF S2 29 (a)(vi)(2) | 2 · etiqueta | alta | 33 | Solo sector financiero (Perfil); si no, «No aplica». Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 455 | 211100 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B61 (a); NIIF S2 32 | NIIF S2 29 (a)(vi)(2) | 1 · fuente | media | 33 | Solo sector financiero (Perfil); si no, «No aplica». Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) (2 códigos del párrafo; elegido por la etiqueta) |
| 456 | 211100 | porcentaje | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B61 (c) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Solo sector financiero (Perfil); si no, «No aplica». Cifra confirmada con unidad (NIIF S2 29 (a)(vi)(2)) |
| 458 | 211100 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B61 (c); NIIF S2 32 | NIIF S2 29 (a)(vi)(2) | 1 · fuente | media | 33 | Solo sector financiero (Perfil); si no, «No aplica». Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) (2 códigos del párrafo; elegido por la etiqueta) |
| 459 | 211100 | (sin tipo) | subconcepto de la fila 458 | NIIF S2 29 (a)(vi)(2); NIIF S2 B61 (c); NIIF S2 32 | NIIF S2 29 (a)(vi)(2) | 1 · fuente | media | 33 | Se responde junto con la fila 458 (text block) |
| 460 | 211100 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B61 (d) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Solo sector financiero (Perfil); si no, «No aplica». Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 462 | 211100 | text block | concepto | — | NIIF S2 29 (a)(iv) EI5 | 2 · etiqueta | media | 31 | Solo sector financiero (Perfil); si no, «No aplica». Modelo, desde el bloque 31 aprobado y los hechos de NIIF S2 29 (a)(iv) EI5 |
| 463 | 211100 | (sin tipo) | subconcepto de la fila 462 | — | NIIF S2 29 (a)(iv) EI5 | 2 · etiqueta | media | 31 | Se responde junto con la fila 462 (text block) |
| 466 | 211200 | (sin tipo) | subconcepto de la fila 462 | — | NIIF S2 29 (a)(iv) EI5 | 2 · etiqueta | media | 31 | Se responde junto con la fila 462 (text block) |
| 467 | 211200 | (sin tipo) | subconcepto de la fila 462 | — | NIIF S2 29 (a)(iv) EI5 | 2 · etiqueta | media | 31 | Se responde junto con la fila 462 (text block) |
| 468 | 211200 | text | concepto | — | NIIF S2 29 (a)(vi)(2) | 2 · etiqueta | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 469 | 211200 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62 (a) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) |
| 470 | 211200 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62 (a) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) |
| 471 | 211200 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62 (a) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) |
| 472 | 211200 | porcentaje | concepto | NIIF S2 B62 (c) | NIIF S2 29 (a)(vi)(2) | 2 · etiqueta | alta | 33 | Cifra confirmada con unidad (NIIF S2 29 (a)(vi)(2)) |
| 474 | 211200 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62 (c) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 476 | 211200 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62 (d) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 478 | 211200 | text | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62A (a)(i) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 479 | 211200 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62A (a)(ii) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 481 | 211200 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62A (a)(ii) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 483 | 211200 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B62A (b) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 484 | 211200 | (sin tipo) | subconcepto de la fila 483 | NIIF S2 29 (a)(vi)(2); NIIF S2 B62A (b) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Se responde junto con la fila 483 (text block) |
| 487 | 211300 | (sin tipo) | subconcepto de la fila 483 | — | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Se responde junto con la fila 483 (text block) |
| 488 | 211300 | text | concepto | — | NIIF S2 32 | 2 · etiqueta | alta | 4 | Modelo, desde el bloque 4 aprobado y los hechos de NIIF S2 32 |
| 489 | 211300 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (a) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) |
| 490 | 211300 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (a) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) |
| 491 | 211300 | tabla | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (a) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Tabla desde registros de clima u objetivos (NIIF S2 29 (a)(vi)(2)) |
| 492 | 211300 | porcentaje | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (c) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Cifra confirmada con unidad (NIIF S2 29 (a)(vi)(2)) |
| 494 | 211300 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (c) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 495 | 211300 | (sin tipo) | subconcepto de la fila 494 | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (c) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Se responde junto con la fila 494 (text block) |
| 496 | 211300 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63 (d) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 498 | 211300 | text | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63A (a)(i); NIIF S2 B62A (a)(i) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 499 | 211300 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63A (a)(ii) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 501 | 211300 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63A (a)(ii) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 503 | 211300 | text block | concepto | NIIF S2 29 (a)(vi)(2); NIIF S2 B63A (b) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Modelo, desde el bloque 33 aprobado y los hechos de NIIF S2 29 (a)(vi)(2) |
| 504 | 211300 | (sin tipo) | subconcepto de la fila 503 | NIIF S2 29 (a)(vi)(2); NIIF S2 B63A (b) | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Se responde junto con la fila 503 (text block) |
| 506 | 211300 | (sin tipo) | subconcepto de la fila 503 | — | NIIF S2 29 (a)(vi)(2) | 1 · fuente | alta | 33 | Se responde junto con la fila 503 (text block) |
| 582 | 901000 | (sin tipo) | miembro de tabla | NIIF S1 B50 | — | — | — | — | Miembro del eje de la tabla [901000]: se escribe como columna o fila de la tabla |
| 584 | 901000 | tabla | concepto | NIIF S1 B50; NIIF S1 B59 | — | sin candidato | — | — | Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo |
| 585 | 901000 | (sin tipo) | miembro de tabla | NIIF S1 B50; NIIF S1 B59 | — | — | — | — | Miembro del eje de la tabla [901000]: se escribe como columna o fila de la tabla |
| 587 | 901000 | (sin tipo) | miembro de tabla | NIIF S1 B54 | — | — | — | — | Miembro del eje de la tabla [901000]: se escribe como columna o fila de la tabla |

## Sin mapeo (propuesta de ampliación del catálogo; no se crea nada ahora)

### Conceptos con tipo sin datapoint (16)

| Fila | Sección | Tipo | Párrafos que piden |
|---:|---|---|---|
| 56 | 200000 | tabla | NIIF S1 30 (a); NIIF S2 10 (a); NIIF S2 11; NIIF S2 12 |
| 149 | 200000 | text block | NIIF S1 46; NIIF S1 49; NIIF S1 54; NIIF S1 59 |
| 157 | 200000 | text block | NIIF S1 50 (a); NIIF S1 54; NIIF S1 59 |
| 163 | 200000 | text block | NIIF S1 50 (a); NIIF S1 54; NIIF S1 59 |
| 186 | 200000 | booleano | NIIF S1 52; NIIF S1 B52 |
| 188 | 200000 | text block | NIIF S1 52; NIIF S1 B52 |
| 190 | 200000 | text block | NIIF S1 52; NIIF S1 B52 |
| 192 | 200000 | text block | NIIF S1 52; NIIF S1 B52 |
| 257 | 200000 | text block | (sin párrafo citado) |
| 273 | 200000 | booleano | NIIF S2 64; NIIF S2 65 |
| 297 | 200000 | text block | NIIF S1 83; NIIF S1 86; NIIF S1 B58 (a) |
| 303 | 200000 | booleano | (sin párrafo citado) |
| 325 | 210000 | tabla | NIIF S2 29 (a)(iv); NIIF S2 5 |
| 420 | 210000 | text block | NIIF S2 29 (f)(i) |
| 435 | 210000 | text block | NIIF S2 29B (a) |
| 584 | 901000 | tabla | NIIF S1 B50; NIIF S1 B59 |

### Párrafos citados por el formato que no tienen código en el catálogo (101)

| Párrafo | Filas que lo citan |
|---|---|
| NIIF S1 30 (a) | 1 (56) |
| NIIF S1 31 | 1 (57) |
| NIIF S1 34 | 1 (83) |
| NIIF S1 36 | 13 (84, 85, 87, 89, 91, 92, 94, 95, 96, 97, 98, 99, …) |
| NIIF S1 42 | 1 (103) |
| NIIF S1 45 | 1 (144) |
| NIIF S1 46 | 5 (148, 149, 152, 153, 155) |
| NIIF S1 49 | 5 (148, 149, 152, 153, 155) |
| NIIF S1 50 (a) | 4 (157, 159, 161, 163) |
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
| NIIF S1 52 | 5 (144, 186, 188, 190, 192) |
| NIIF S1 53 | 1 (144) |
| NIIF S1 54 | 12 (148, 149, 152, 153, 155, 157, 159, 161, 163, 166, 167, 169) |
| NIIF S1 59 | 12 (148, 149, 152, 153, 155, 157, 159, 161, 163, 166, 167, 169) |
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
| NIIF S2 15 | 1 (83) |
| NIIF S2 21 | 1 (100) |
| NIIF S2 23 | 5 (59, 64, 83, 307, 309) |
| NIIF S2 26 | 10 (122, 124, 126, 128, 130, 132, 134, 137, 139, 141) |
| NIIF S2 29 (a)(iv) | 2 (324, 325) |
| NIIF S2 29 (f)(i) | 3 (417, 420, 422) |
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
| NIIF S2 B19 | 1 (309) |
| NIIF S2 B22 | 1 (309) |
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
