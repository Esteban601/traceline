# Deudas conocidas · demo vigente (Formato electrónico, Excel de taxonomía, libro GRI/SASB y Word)

<!--
PLANTILLA. La lista que se entrega se GENERA desde el informe de e2e-celdas-categoricas
(scripts/formato/deudas-desde-e2e.mjs; decisión de Esteban, v6.2). Cada `{{e2e:<prefijo>}}` se sustituye por el estado
de los casos cuyo mensaje empieza así: una deuda solo sale «corregida» si su caso pasa. Las deudas sin caso son
abiertas por definición. No se edita la salida a mano: se edita esta plantilla o el caso.
-->

Empresa Demo, ejercicio 2025. Documento vigente: v6 (`8accfc41`) con las correcciones v6.1 y v6.2 de las respuestas;
el Word es el del v6 aprobado. Numeración de las celdas K: la de v5.2.

## 1. Deudas con caso de prueba

### Formato y Excel

| Deuda | Dónde | Estado |
|---|---|---|
| Efectos actuales de las oportunidades con sus partidas (31.0 millones capitalizados) | K823 | {{e2e:(1) K823}} |
| Efectos actuales sobre el rendimiento (0.4 millones registrados como gasto) | K825 | {{e2e:(1) K825}} |
| NIIF S1 41 bajo E5: remisión a NIIF S2 22 (a)–(b), sin depender del padre | K103 | {{e2e:(2) K103}} |
| Regla de ramas: la razón en la rama, la fila de sección vacía (29(f)) | K839, K841 | {{e2e:[v6.2-1] K839}} |
| Regla de ramas (29(g)) | K847, K849 | {{e2e:[v6.2-1] K847}} |
| Rama del Excel con la razón (29(f)) | Excel 182, 183 | {{e2e:[v6.2-1] Excel 182}} |
| Rama del Excel con la razón (29(g)) | Excel 187, 188 | {{e2e:[v6.2-1] Excel 187}} |
| Sin «Sí,» inicial en la fila de continuación de 6(b)(ii) | Excel 79 | {{e2e:[v6.2-2] Excel 79}} |
| Composición de la cartera por producto, como K866 | Excel 192 | {{e2e:[v6.2-3] Excel 192}} |
| 36(d) solo con el objetivo de emisiones de GEI | Excel 271 | {{e2e:(4) Excel 271}} |
| Remisión por nombre de sección, nunca por número | Excel 268 y todo el Excel | {{e2e:(5) Excel 268}} |
| Enfoque y datos de entrada de 29(a)(iii) sin repetirse, con los 488,000 litros | K740, K741 | {{e2e:K596 el enfoque}} |
| Razón de la elección del enfoque | K743 | {{e2e:K599 (razón de la elección)}} |
| Cambios en el enfoque, sin la razón de la elección | K745 | {{e2e:K601 (cambios en el enfoque)}} |
| Razón de no cuantificar de NIIF S2 21, solo en K100 | K100 | {{e2e:(1) K100}} |
| Lo no fechado de 16(d), sin la razón de no cuantificar | K96 | {{e2e:K96:}} |

### Libro GRI/SASB

| Deuda | Contenido | Estado |
|---|---|---|
| Sin «no se revela b» | GRI 2-2 | {{e2e:[v6.2-4] GRI 2-2}} |
| Declara lo que falta de b.ii, sin la oración del método | GRI 2-5 | {{e2e:[v6.2-4] GRI 2-5}} |
| Declara b.iii no revelado | GRI 2-6 | {{e2e:[v6.2-4] GRI 2-6}} |
| «No desglosa la exposición bruta por industria ni por clase de activo» | FN-CB-410b.2 | {{e2e:[v6.2-4] FN-CB-410b.2}} |
| Declara que no describe el método de atribución | FN-CB-410b.4 | {{e2e:[v6.2-4] FN-CB-410b.4}} |
| Declara que solo cubre la prueba de estrés climática | FN-CB-550a.2 | {{e2e:[v6.2-4] FN-CB-550a.2}} |
| «No revelado · alivio C4» | FN-CB-410b.1 | {{e2e:[v6.2-4] FN-CB-410b.1}} |
| Sin actualizaciones: primer periodo, por regla como K718 | GRI 2-4 | {{e2e:[v6.2-4] GRI 2-4}} |
| Pendiente con causa, sin repetir 2-19 | GRI 2-20 | {{e2e:[v6.1-GRI] 2-20}} |
| Nombra lo que mide y lo que no desglosa | GRI 401-1 | {{e2e:[v6.1-GRI] 401-1}} |
| Periodo, frecuencia y publicación por regla; punto de contacto no revelado | GRI 2-3 | {{e2e:[v6.1-GRI] 2-3}} |
| Desde los hechos de PCAF, con el alivio C4 | FN-CB-410b.3, 410b.4 | {{e2e:[v6.1-GRI] 410b.3}} |
| «No aplica» por el dato G-SIB del Perfil | FN-CB-550a.1 | {{e2e:[v6.1-GRI] 550a.1}} |
| Composición por género (54 % de mujeres; 3 de 11 consejeras) | GRI 2-7, 2-9 | {{e2e:[v6.1-GRI] 2-7}} |
| Sin llamar «exención» a NIIF S2 30 | FN-CB-410b.2 | {{e2e:[v6.1-GRI] 410b.2}} |
| 13,900 participantes | FN-CB-240a.4 | {{e2e:[v6.1-GRI] 240a.4}} |
| Pendientes en voz de la emisora | todo el libro | {{e2e:[v6.1-GRI] todo pendiente}} |

## 2. Deudas abiertas sin caso de prueba

Abiertas por definición: no tienen caso, así que no se marcan corregidas.

- **K43 (NIIF S2 6(b), papel de la gerencia), vacía.** Deuda de datos del demo: separar en `poblar-demo.mjs` la oración
  de la Dirección de Crédito y Banca antes del próximo libro de hechos.
- **K91 y los padres de 25(a), 36(a) y 22(a)–(b), vacíos.** Encargo `sintesis-de-padres-por-regla`.
- **Word v6 aprobado:** se corrige con el encargo en cola `correccion-puntual-de-bloque-aprobado`.
  - **Cuatro remisiones falsas** (remiten a secciones que no tienen el dato):
    - 15 → 17: programa de capacitación;
    - 30 → 29: litros de combustibles;
    - 35 → 21: 12.3 y 6.2 millones (están en el 10);
    - 36 → 24: 6.1 % de ingresos (está en el propio 36).
  - **Tres de redacción:**
    - el 27 omite cambios de 2025;
    - el 19 anuncia una línea de tiempo que el Word no incluye;
    - la cronología entre el 16, el 26 y el 27.
  - **La lectura errónea de NIIF S2 30 en el bloque 6:** «no se acoge a la exención…».
- **Campo G-SIB sin pantalla en el Perfil** (`perfil_emisor.banco_sistemico_global`): hoy solo lo escribe un guion.
- **29A–29C, B62/B63 sin datapoints propios** (K855–K864, K901–K902, K921–K922): ampliación del catálogo.
- **B65(e): un solo texto en K788, K811 y K834.** Es un solo código en el catálogo.
- **Plantilla BMV: erratas, etiquetas copiadas y duplicados:**
  - Excel, filas 134–137;
  - K771, K873, K891, K906, K879/K881, K895/K915 y K885.
- **Base de materialidad (NIIF S1 B19–B21):** el Word no la declara.
- **Libro GRI/SASB:** los contenidos sin solicitud ni sección siguen pendientes, con «información no disponible en el
  reporte».
