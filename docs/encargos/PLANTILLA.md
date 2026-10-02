# Encargo: <título corto: qué se construye o se cambia>

Versión 1 · <fecha>. <Una o dos frases de contexto, si hace falta: de dónde sale el encargo y qué queda fuera.>

**Responsable:** <persona> (con Claude Code)
**Rama:** `feat/<encargo>` o `fix/<tema>` desde `dev/ajustes-sep26`, o `hotfix/<tema>` desde `main` si corrige lo
que corre en staging. Se integra por PR (`CLAUDE.md` §2).
**Fecha de inicio:** <fecha> · **Entrega:** <qué y para cuándo>.
**Referencia:** `CLAUDE.md` §<secciones que aplican>; especificación §<secciones>.

<!--
Cómo se usa esta plantilla (bórrese al llenarla):

- El encargo es la unidad de trabajo: alcance, entregable y definición de terminado (CLAUDE.md §8). Las
  instrucciones operativas puntuales no llevan encargo.
- Antes de escribir código, Claude Code lee la especificación y este encargo, y devuelve un resumen de una
  página: qué entendió, cómo lo va a hacer, qué va a tocar y qué no. El encargo no empieza hasta que se aprueba.
- Cada parada de §5 es una parada de verdad: se reporta con el formato de CLAUDE.md §7 y se espera el OK.
- Un cambio de alcance a medio encargo se escribe aquí (§2 y una fila en §7) antes de tocar el código.
- Modelo de referencia: docs/encargos/2026-09-29-rol-auditor.md.
-->

## 1. Objetivo

<Para qué sirve, en una o dos frases, y para quién. Lo que el usuario puede hacer al terminar, no cómo se hace.>

## 2. Alcance

<Lo que entra, en viñetas concretas: tablas, columnas, pantallas, rutas, scripts. Si hay migraciones, cuáles y
si son aditivas (CLAUDE.md §3). Si el encargo va por fases, una subsección por fase.>

## 3. Qué toca y qué no

- **Toca:** <archivos, tablas y ambientes que se modifican>.
- **No toca:** <lo que podría parecer incluido y no lo está, con el porqué>.
- **Ambientes:** <dónde se prueba (local, dev propio, ensayo) y dónde no se corre nada>.

## 4. Definición de terminado

- <Criterio verificable 1: qué prueba, qué comando, qué resultado esperado.>
- <Criterio verificable 2.>
- `tsc` limpio, `eslint` sin errores nuevos, `npm run verify:export` en verde (y `verify:word` si se toca la
  exportación a Word), e2e del área en verde (CLAUDE.md §7).
- <Si hay despliegue: registrado en la especificación §10.>

## 5. Entregables intermedios

- Paso 0: resumen de una página, con parada.
- Paso 1: <entregable>. Parada: <qué se revisa y quién lo revisa>.
- Paso N: <despliegue, si aplica>. Parada: informe.

### 5.1 Guion de despliegue · <release>

<Solo si el encargo llega a staging. Incluye el orden (migración antes o después del código, y por qué), los
comandos exactos en el orden en que se ejecutan, lo que cada uno debe imprimir si sale bien y qué hacer si no,
quién ejecuta cada paso (CLAUDE.md §1 y §9), las comprobaciones posteriores al release y el rollback. Si el
release cambia el esquema, va primero el ensayo en una copia de staging (especificación §10, «Ensayo de
despliegue»).>

## 6. Riesgos y dudas conocidas

- <Riesgo o duda, con lo que se va a hacer al respecto, o «se acepta» y por qué.>

## 7. Registro

| Fecha | Qué pasó | Decisión |
|---|---|---|
| <fecha> | Encargo escrito | <decisiones de partida> |
