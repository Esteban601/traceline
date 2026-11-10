# Encargo: declaración de cumplimiento con reserva, fideicomisos en el Formato y forma de referencia

Versión 1 · 10 de noviembre de 2026. Encargo corto que sale de `odonnell-alta-real` (§0.8 y §5.3): es la pieza 4,
antes del primer documento 2026 de O'Donnell. Tiene una sola parada, después de este Paso 0.

**Responsable:** Esteban (con Claude Code)
**Rama:** `feat/s1-72-reserva-y-emisora` desde `dev/ajustes-sep26` (`736b777`). Se integra por PR (`CLAUDE.md` §2).
**Referencia:** `CLAUDE.md` v1.13 §3 y §5; decisiones 5 y 7 de `odonnell-alta-real` (§5.1).

---

## 0. Paso 0 (lectura, sin cambios)

### 0.1 Declaración de cumplimiento con o sin reserva

**Hoy:**
- **El bloque 2** es una plantilla, sin modelo (`plantillas.ts`, `presentacion`), que dice siempre «preparada **de
  conformidad con** las Normas NIIF S1 y NIIF S2».
- **NIIF S1 72** toma ese párrafo (`declaracionDeCumplimiento`) y le suma las oraciones del E5 y del E4 si están
  vigentes.
- **Formato, fila 285:** el mismo párrafo.
- **Formato, fila 286:** «Sí» solo con cero pendientes y cero «parcial»; si no, «No. Falta completar…».
- **`datos.ts`** decide `declaraCumplimiento` buscando «de conformidad con» en el bloque 2.

**Ya hay una incoherencia, sin reserva:** con pendientes o parciales, la fila 286 dice «No» y la 285 afirma
conformidad.

**Con la decisión 5** (vive en el reporte, la escribe la emisora y el generador nunca la redacta):
1. **Migración aditiva:**
   - `reportes.declaracion_cumplimiento`, nullable, con CHECK `sin_reserva` | `con_reserva`;
   - `reportes.declaracion_cumplimiento_texto`, nullable.
2. **Captura** en la pantalla del régimen del reporte (`/admin/reportes`), junto al año de adopción y los alivios, con
   bitácora.
3. **Bloque 2:**
   - el párrafo de la declaración es el **texto de la emisora, tal cual**;
   - sin texto, el marcador `[Pendiente: declaración de cumplimiento de la emisora — Reportes, régimen del ejercicio]`;
   - el resto del bloque (quién presenta, ejercicio, relación con los estados financieros y el E4) sigue siendo
     plantilla, sin la frase «de conformidad con».
4. **NIIF S1 72 y la fila 285:** el texto de la emisora. Se conservan las oraciones del E5 y del E4 que hoy se le
   suman, como la decisión de la Fase 3 de `formato-afirmaciones-y-voz`.
5. **Fila 286:**
   - con reserva: «No», siempre;
   - sin reserva, con cero pendientes y cero parciales: «Sí»;
   - sin reserva con pendientes o parciales: «No. Falta completar…», como hoy, y además un **aviso** del validador.
     El aviso va en el log de la descarga y en la hoja «Avisos» de la revisión, como los booleanos contradichos.
6. **`datos.ts`:** `declaraCumplimiento` sale del campo, no de una expresión sobre el bloque 2.
7. **`poblar-demo`:** el demo queda «sin reserva», con la oración que hoy escribe la plantilla. Así su NIIF S1 72 y su
   fila 285 no cambian de texto. O'Donnell 2025: «con reserva», con el texto de la p. 41 (dato del alta).

**Efecto en staging:** los documentos nuevos de las 22 emisoras llevan el marcador en el bloque 2 hasta que se capture
la declaración, y un documento con pendientes no se aprueba (CLAUDE.md §5). Hoy hay 0 aprobados, así que ninguno
cambia. Va en la nota del runbook del release.

### 0.2 Fideicomisos en el Formato

**Hoy:** `llenar.ts` decide el bloque «Para: Fideicomisos» (filas 13–21, fila 255 del código) y el fiduciario y el número
(fila 428) con `/fideicomiso/i` sobre `perfil.tipo_instrumento`. De las nueve opciones de la plantilla, solo
«Fideicomisos sobre bienes distintos de acciones» lo contiene. CKD, CERPI, FIBRA y FIBRAE salen «No aplica».

**Cambio:**
- Una función `esInstrumentoFiduciario`, con la lista exacta de las cinco opciones fiduciarias de la fila 7 de la
  plantilla.
- La usan las dos reglas de `llenar.ts`.
- La lista de opciones de la pantalla del Perfil, si existe, sale de la misma constante.
- El guion del alta deja de avisarlo.
- Un caso por opción en `e2e-formato-electronico`.

### 0.3 Forma de referencia

**Hoy:** `perfil_emisor.forma_de_referencia` existe (sección Identidad), sin default.
- **Lo leen:** el prompt de los bloques (con «la Emisora» si falta), las plantillas y la coherencia.
- **«La Compañía» escrito a mano**, fuera de comentarios, en estos lugares:

  | Dónde | Qué |
  |---|---|
  | `respuestas.ts` | El sistema de respuestas («tercera persona, «la Compañía»»), los «No aplica» heredados (36(c), 36(e), genérico), las descripciones de conceptos con enfoque (22(a)(iii), 16(a), 16(d), 29(a)(iii), 29(e), K576) y los mensajes de los validadores |
  | `alivios.ts` | Las oraciones publicadas del E5 y del E4 |
  | `hechos/fuentes.ts` | Dos hechos de regla: el C3 del primer año y el C5 |
  | `llenar.ts` | «No aplica por actividad: la Compañía no participa…» |
  | `prompt.ts` | Tres ejemplos de redacción de la capa estable (C4 y Alcance 3) |
  | `razones.ts`, `vias.ts`, `catalogo-incisos.ts` | Instrucciones al modelo y una nota para el revisor |

**Cambio** (decisión 7):
1. **Una función `formaDeReferencia(perfil)`**: la del Perfil, o «la Compañía» por defecto, con mayúscula inicial
   cuando abre oración.
2. **Se lee en todo lo que se publica:** las respuestas (sistema y textos fijos), los alivios, los hechos de regla, el
   Formato y los ejemplos del prompt.
   - Los ejemplos están en la **capa estable**. Pasarlos a variable cambia la versión del prompt (CLAUDE.md §5), así que
     se anota la versión nueva.
   - Para los tenants con el default, el texto que ve el modelo no cambia.
3. **Validador de voz**, en los bloques y en las respuestas: la respuesta usa la forma del Perfil. Si el Perfil dice
   «la Emisora» y el texto dice «la Compañía» (u otra forma conocida: «la Entidad», «la Sociedad»), es un error con
   reintento, como la primera persona.
4. **Sin efecto en el demo ni en staging:** sin forma en el Perfil, todo sale igual que hoy. Ninguna respuesta
   reutilizada cambia de firma, porque la descripción no cambia con el default.

### 0.4 Qué no toca

- El régimen sin E5, A9 y el catálogo IF-RE/IF-EN (encargos aparte).
- Ningún documento se regenera: costo del modelo **0**. Los e2e van sin modelo.
- Staging: la migración va en el siguiente release (después de v44 y de v45), con su runbook.

### 0.5 Estimación

| Parte | Qué | Jornadas |
|---|---|---|
| 1 | Declaración de cumplimiento: migración aditiva y tipos, captura en el régimen del reporte, bloque 2, NIIF S1 72, filas 285 y 286 con su aviso, `datos.ts`, `poblar-demo`; e2e de las cuatro combinaciones (sin texto, sin reserva limpio, sin reserva con pendientes, con reserva) | 1.25–1.5 |
| 2 | Fideicomisos: `esInstrumentoFiduciario`, las dos reglas, la pantalla, el guion del alta; casos en el e2e del Formato | 0.25 |
| 3 | Forma de referencia: la función con su default, los textos de §0.3, los ejemplos del prompt (versión nueva), el validador de voz; e2e con «la Emisora» y con el default (sin modelo) | 1–1.25 |
| 4 | Batería del área, `verify:export`, `traceline-dev` con humo, PR | 0.5 |
| **Total** | | **~3–3.5** |

## 5. Preguntas (una sola parada)

1. ¿Fases y estimación como están?
2. **Declaración sin texto:** ¿marcador de pendiente en el bloque 2, que bloquea la aprobación (mi propuesta), o la
   redacción de hoy («de conformidad con…») como respaldo? La decisión 5 dice que el generador nunca la redacta, así
   que propongo el marcador.
3. **Fila 286, sin reserva y con pendientes:** ¿«No. Falta completar…» con aviso (mi propuesta), o se bloquea la
   descarga del Formato hasta que cuadren?
4. **Validador de voz:** ¿la forma del Perfil es obligatoria en toda oración que nombre a la emisora (mi propuesta), o
   se admite también la denominación corta («O'Donnell»), como ya admite el prompt?

## 7. Registro

| Fecha | Qué | Resultado |
|---|---|---|
| 10/11/2026 | **Paso 0** (lectura) | Declaración: hoy el bloque 2 siempre afirma conformidad y la 286 ya puede contradecirla; propuesta con columnas en el reporte, texto de la emisora, marcador si falta y aviso. Fideicomisos: solo una de las cinco opciones fiduciarias contiene «fideicomiso». Forma de referencia: el campo existe; «la Compañía» escrito a mano en respuestas, alivios, hechos de regla, Formato y ejemplos del prompt. ~3–3.5 jornadas, costo 0 | **Parada:** §5 |
