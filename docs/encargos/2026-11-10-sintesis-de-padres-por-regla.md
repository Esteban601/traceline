# Encargo: síntesis de códigos padre por regla

Versión 1 · 10 de noviembre de 2026. Encargo chico, registrado al cerrar el demo v6
(`perfil-declaraciones-alta`, «esperan v6»). Sale de la lectura de K91 y de los padres que quedaron sin respuesta en
el v6. Pertenece a la línea del encargo `formato-respuesta-por-inciso`. Sin empezar: el primer paso es el resumen de
una página (CLAUDE.md §8).

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/sintesis-de-padres-por-regla` desde `dev/ajustes-sep26`. Se integra por PR (`CLAUDE.md` §2).
**Fecha de inicio:** por definir · **Entrega:** código, e2e y el demo con sus padres llenos.
**Referencia:** `CLAUDE.md` §5 (cero dato inventado, voz de la emisora); `docs/encargos/2026-10-28-formato-respuesta-por-inciso.md`.

## 1. Objetivo

Que los códigos padre del Formato electrónico y del Excel de taxonomía no queden vacíos cuando sus incisos ya se
repartieron todos los hechos.

Hoy, en el demo v6, quedan sin respuesta:

| Código padre | Dónde | Repite a |
|---|---|---|
| NIIF S2 16(b)–(d) | K91 y Excel | 16(b) y 16(d) |
| NIIF S2 25(a)(i)–(v) | Excel, fila 113 | 25(a)(ii) |
| NIIF S2 36(a)–(d) | Excel, fila 267 | 36(a) y 36(b) |
| NIIF S2 22(a)–(b) | base (sin celda propia) | 22(a)(i) y 22(b)(iii) |

## 2. Alcance

**Causa.** La síntesis del padre no encuentra una oración propia cuando los hijos ya se reparten los hechos: todo lo
que podría decir ya lo dice algún inciso. El validador exige una síntesis propia («el código padre da una síntesis
propia») y la rechaza tres veces.

**Propuesta (la de K91).** Cuando a un padre no le quedan hechos que sus incisos no citen, la síntesis sale por regla,
sin modelo: una oración que nombra qué responde cada inciso y remite a ellos. Es lo que ya hace 36(e) con
`remisionAIncisos`. Con hechos propios, el padre sigue yendo al modelo como hoy.

- Los cuatro padres de §1. Se busca también si hay otros en el catálogo con la misma forma.
- La regla vive en `lib/suplemento/respuestas.ts`, junto a la de 36(e). La redacción es fija y en voz de la emisora,
  sin vocabulario de plataforma.
- En el Excel de taxonomía, la remisión usa la numeración de los incisos de su hoja; en el Formato, la de sus filas.

## 3. Qué toca y qué no

- **Toca:** `lib/suplemento/respuestas.ts` (plan de los padres) y los e2e de validadores y de celdas.
- **No toca:** la regla de que un padre con hechos propios no repita a sus incisos; los bloques del suplemento; el
  libro de hechos.
- **Ambientes:** local y dev; en el demo, solo se vuelven a correr las respuestas del documento aprobado. Costo
  menor a 1 USD.

## 4. Definición de terminado

- K91 y las filas 113 y 267 del Excel con su remisión a los incisos, y 22(a)–(b) con respuesta en la base, en el demo
  vigente.
- `e2e-celdas-categoricas` y `e2e-respuestas-validadores` en verde, con un caso por padre.
- 0 celdas con vocabulario de plataforma (`medir-formato.mjs`).

## 7. Registro

| Fecha | Qué | Resultado |
|---|---|---|
| 10/11/2026 | **Registrado** (decisión de Esteban), con la propuesta de K91 | En cola |
