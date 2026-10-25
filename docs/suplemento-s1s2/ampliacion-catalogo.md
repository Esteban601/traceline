# Ampliación del catálogo `datapoints_taxonomia` · deuda

Códigos que el Formato electrónico NIIF S1/S2 pide y que el catálogo no tiene. **No se crean en el encargo
2026-10-13-excel-respuestas-narrativas** (decisión de Esteban del 13 de octubre de 2026): se anotan aquí como deuda
y cada alta será una migración de datos idempotente con su fila en `auditoria-catalogo.md` (CLAUDE.md §4). Los
párrafos se citan por número; no se reproduce el texto de la norma.

| Código pedido | Dónde lo pide el formato | Hoy | Propuesta |
|---|---|---|---|
| NIIF S2 13 | fila 59 (modelo de negocio y cadena de valor). La fila 390 no lo pide: es la entrada de la métrica de oportunidades, 29(d), corregida el 24/10 | sus incisos (a) y (b) existen y son del bloque 13 | código padre del párrafo, como «NIIF S2 25 (a)(i)a(v)» · **Fase 3** del encargo 2026-10-24 |
| NIIF S2 22 | conceptos de resiliencia (bloque 26), fila 105 | sus incisos (a)(i)–(iii) y (b)(i)–(iii) existen | código padre del párrafo · **Fase 3** del encargo 2026-10-24 |
| NIIF S2 14(a) | filas 64 y 65 (bloques 22, 23, 25 y 28) | sus incisos (i)–(v) existen, con dueños distintos | código padre del párrafo · **Fase 3** del encargo 2026-10-24 |
| NIIF S2 21(a) | fila 100, par de NIIF S1 40(a) | **alta aplicada en dev el 24/10** (migración `20261024120000_catalogo_s2_21a`, dueño el bloque 10) | staging con el despliegue v42 |
| NIIF S2 28 | correspondencia de NIIF S1 46–50 (métricas) | no existe | **cerrada sin alta** (encargo 2026-10-24): párrafo que solo remite a 29–31, 32 y 33–37; lo resuelve la iteración de `lib/formato/metricas.ts` |
| NIIF S2 29B, 29B(a), 29B(b) | filas 433, 435–436 y 437 (limitación de la medición de la categoría 15) | no existen: son de la modificación de 2025 de NIIF S2, que `normas/` no tiene | **pospuesta** hasta que `normas/` tenga la modificación (la pone Esteban). Mientras, con C4 «No revelado · alivio C4» y sin C4 «sin mapeo». 433 y 437 dejaron de usar `NIIF S2 EI14 a E18` (Alcance 1) el 24/10 |
| NIIF S2 29C | filas 439 y 441 (total de la categoría 15 y subtotal de emisiones financiadas) | no existe (modificación de 2025) | pospuesta con 29B. Hoy usan `NIIF S2 29 (a)(vi)(2)`; con C4, «No revelado · alivio C4» |
| NIIF S2 15 y NIIF S1 34 (códigos padre) | filas 84 y 91 (efectos financieros actuales y previstos) | solo existen los incisos S2 16(a)–(d) y S1 35(a)–(d) | código padre · **Fase 3** del encargo 2026-10-24. Mientras, las filas se responden desde el bloque 10 con la clave `fila:N` |
| NIIF S2 EI25 a EI38 | filas 462 y 463 (desagregación de las emisiones financiadas por clase de activo, gestión de activos) | no existe | alta cuando se audite la sección de gestión de activos. Mientras, «No aplica por actividad» o «sin mapeo» |
