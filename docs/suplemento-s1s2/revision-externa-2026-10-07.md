# Revisión externa de los bloques 15, 18 y 27 (v1 contra v2)

7 de octubre de 2026. Revisión de los bloques 15, 18 y 27 del demo antes y después de entregar al generador los
adjuntos del Perfil (encargo `docs/encargos/2026-10-06-suplemento-calidad.md`, Paso 2; comparación en
`referencia/suplemento-calidad/paso2/bloques-15-18-27.docx`, no versionado). Texto recibido de Esteban; se
guarda tal cual. Al final, cómo se atiende cada punto.

---

Antes de pulir el prompt: la suposición de que "más adjuntos = mejor bloque" no se sostiene leyendo los tres bloques juntos. Cada bloque v2 es más rico aislado, pero el documento empeoró: los tres repiten la misma frase de los estatutos, dos bloques se contradicen sobre de dónde salió un mismo dato, y v2 introdujo afirmaciones que no están en ninguna fuente sino en una inferencia del modelo. Eso lo detectaría un auditor en la primera lectura. Los hallazgos por bloque están abajo; las fallas que importan son estructurales, no de redacción.

## Lo incómodo primero

[Seguro] Duplicación textual entre bloques. El párrafo "vigila la gestión y supervisa los principales riesgos… incluidos los ambientales y los relacionados con el clima, con base en la información que le presentan los comités, el Director General y el auditor externo… aprueba, con la opinión previa del comité… las políticas en materia de riesgos, financiamiento sostenible y revelación…" aparece casi idéntico en 15 v2 y 18 v2, y su cola ("informa al Consejo… que supervisa los principales riesgos") reaparece en 27 v2. "La Dirección de Riesgos coordina la identificación… la Dirección de Crédito aplica los criterios climáticos en la originación" está literal en 18 y en 27. Esto es exactamente lo que S2 §7 / S1 B42(b) y D26(b) prohíben. La causa es mecánica: cada bloque recibe los mismos adjuntos completos y nadie le dice qué le toca. En v1 no pasaba porque los adjuntos no existían. La "pasada de coherencia" que dejaste como pendiente del encargo deja de ser opcional: sin ella, v2 no es publicable.

[Seguro] La procedencia que reporta el modelo no es confiable. El mismo hecho (el Comité informa al Consejo dos veces al año) lo atribuye 15 v2 "al organigrama y al acta" y 18 v2 "al perfil, no a los adjuntos". Uno de los dos miente. Las secciones "Citas a documentos adjuntos" son una lista de archivos, no un mapa afirmación→fuente, y son autoinforme del modelo. Para un auditor eso no es trazabilidad; es decoración. Lo único auditable es un extracto literal verificado por código contra el texto extraído.

[Probable] Inferencias presentadas como hechos. 27 v2 abre con "conforme a las políticas de riesgos aprobadas por el Consejo". En v1 la nota decía que la solicitud no nombra ninguna política. En v2 el modelo leyó en los estatutos que el Consejo aprueba políticas de riesgos y concluyó que existe una aplicable al clima. Lo mismo con el Código de Ética "dispone que las decisiones de crédito, inversión y operación consideren los riesgos relacionados con el clima": si el código real del demo lo dice, bien; si es paráfrasis generosa, en un cliente real eso es una afirmación falsa firmada por el emisor. Los adjuntos invitan cadenas de inferencia que las solicitudes validadas no permitían.

[Seguro] La regla "no publicar datos que solo vienen de un adjunto" se aplica a conveniencia. 15 v2 la invoca para omitir composición y fechas del acta, pero publica la frecuencia de sesiones que, según su propia nota, salió del acta y el organigrama. La regla la está inventando el modelo sobre la marcha. Es una decisión de política que les corresponde a ti y a Manuel: ¿un adjunto cargado al Perfil por el admin del cliente tiene menos rango que una solicitud validada? Si sí, hay que decirlo en el prompt y aplicarlo; si no, el bloque 15 está omitiendo información útil sin razón.

## Por bloque, contra la norma

### Bloque 15 (S2 6(a))

[Seguro] Cubre (i) términos de referencia y (ii) competencias. (iii) frecuencia de información queda cubierta por una frase. (iv) transacciones importantes aparece como función del Comité pero no dice cómo el Consejo las considera ni si evaluó compensaciones. (v) objetivos y remuneración, ausente. No sé si el índice de 40 bloques asigna (iii)–(v) a otro bloque; si no, hay hueco.

[Seguro] Contradicción interna en v2: los términos de referencia dicen que el Comité evalúa la suficiencia de competencias del Consejo; el párrafo siguiente dice que el Consejo se autoevalúa anualmente por estatutos. Dos órganos para la misma función, sin conciliar.

[Probable] v2 perdió la frase de cierre de v1 que respondía literalmente a 6(a)(ii) ("cómo determina si dispone o desarrollará las habilidades"). v2 lo deja implícito en "pudiendo acordar programas de capacitación". v1 era más directo contra el requisito.

[Seguro] Las notas sobre "acta recoge 16 horas como propuesta, solicitud afirma que se impartió" y "aprueba vs. propone" son el tipo de hallazgo que sí justifica dar adjuntos al generador. Eso es valor real; consérvalo.

### Bloque 18 (organigrama; debería mapear a S2 6(b))

[Seguro] 6(b)(ii) —si la gerencia usa controles y procedimientos y cómo se integran con otras funciones internas— no está en v1 ni en v2. Si 18 es un bloque "no exigido por la norma" (de los que pasan a opcionales), entonces 6(b) tiene que vivir en el 16 o el 17; confírmalo contra el índice.

[Seguro] v2 agregó relleno estatutario: "la administración está encomendada al Consejo y al Director General en sus respectivas esferas de competencia" es texto LMV genérico que no dice nada del clima. S1 D26(a) lo llama información estandarizada y pide evitarla. Aquí v2 es peor que v1 pese a tener 114 palabras más.

[Seguro] Publica "Crédito y Banca" y "Dirección de Crédito" en el mismo bloque y lo anota. Un texto publicable no puede usar dos nombres para un órgano; el generador debe tomar el canónico del Perfil y anotar la discrepancia, no reproducirla.

[Seguro] "De los estatutos solo se leyó la primera parte (primeras páginas de 80)" es una limitación de plataforma (presupuesto de contexto) escondida en una nota de un bloque. Eso va en el semáforo de completitud a nivel documento.

### Bloque 27 (S2 25)

[Seguro] 25(a)(ii) pide decir si la entidad usa análisis de escenarios para identificar riesgos y cómo. Ambas versiones solo hablan de escenarios para oportunidades (25(b)). El requisito queda sin responder y ninguna nota lo detecta; el revisor tendría que saberse el párrafo de memoria.

[Seguro] "escala de 1 a 5… severidad de 0 a 25": el producto mínimo de 1×1 es 1. Es dato del demo, pero el generador lo reprodujo dos veces sin reparar. Un validador aritmético trivial lo atrapa.

[Probable] v2 embellece: "colaterales que respaldan la cartera crediticia" y "actividades financiadas" (v1: "sectores en los que opera") no están en la solicitud tal como la citan. Pequeño, pero es el patrón: cuando hay más contexto, el modelo rellena.

[Seguro] CENAPRED se desarrolló en v1 sin nota y en v2 con nota. La higiene de notas es inconsistente entre corridas del mismo prompt.

[Seguro] "acta-gobierno.pdf no pudo leerse" repetida en los tres bloques. Es un defecto de insumo de nivel documento; debe fallar en pre-vuelo, una sola vez.

## Qué cambiar en la herramienta (no en el prompt)

Libro de hechos antes de generar. Una pasada previa, con Sonnet, que extraiga de solicitudes + Perfil + adjuntos una tabla de hechos atómicos: hecho, archivo, página/párrafo, extracto literal, rango de fuente (validada / perfil / adjunto). Luego una asignación: cada hecho tiene un bloque dueño y, opcionalmente, bloques que pueden referirlo en una frase. Los bloques generan desde su subconjunto, no desde los adjuntos completos. Esto resuelve duplicación, procedencia y coste de golpe, y es más barato que una pasada de coherencia correctiva sobre 40 bloques.

Cita verificada por código. El modelo devuelve extracto + archivo + ubicación; la plataforma hace búsqueda de subcadena normalizada en el texto extraído y marca ✔/✘. Lo que no coincide no se cita. Ahí la trazabilidad deja de ser autoinforme.

Jerarquía de fuentes explícita y única regla de inferencia: solo se afirma lo que un hecho del libro sostiene; "el Consejo aprueba políticas de riesgos" no habilita "existe una política de riesgo climático". Si dos fuentes se contradicen (aprueba vs. propone, propuesta vs. impartida), el bloque no elige: pone marcador y lo manda a notas_revision.

Lista de verificación por subrequisito en la salida. Para cada bloque, el prompt recibe los incisos literales (6(a)(i)–(v), 25(a)(i)–(vi), 25(b), 25(c)) y devuelve por cada uno: cubierto / parcial / pendiente / asignado a bloque N. Convierte la revisión de "leer y recordar la norma" a "verificar una tabla", y el hueco de 25(a)(ii) habría saltado solo.

Validadores deterministas post-generación: nomenclatura canónica de órganos y direcciones (del Perfil), rangos numéricos coherentes, el mismo hecho con la misma cifra en todos los bloques que lo mencionan (frecuencia, integrantes, fechas).

Pre-vuelo de insumos a nivel documento: archivos ilegibles, truncados o fuera de presupuesto se reportan en el semáforo antes de gastar un centavo; no en 40 notas repetidas.

Caché de prompt para el bloque de contexto compartido (Perfil + adjuntos). Hoy v2 cuesta 1.5–3× v1 por bloque, en buena parte por reenviar los mismos PDF 40 veces. [Adivinando] con caché el sobrecosto de v2 cae a menos de la mitad.

Separar las notas en tres cubetas: decisiones del emisor (contradicciones entre fuentes), revelación voluntaria, y defectos de insumo. Hoy van mezcladas y las de insumo se repiten entre bloques.

Lo que v2 sí demostró es que vale la pena darle los adjuntos al generador: las notas de 15 sobre "propuesta vs. contratada" y "aprueba vs. propone" son hallazgos que un consultor humano tardaría una hora en encontrar. El problema no es la idea; es que la estás ejecutando bloque por bloque sin una capa de hechos en medio, y a 40 bloques esa capa es la diferencia entre un suplemento y 40 ensayos que se pisan.

---

## Cómo se atiende (encargo suplemento-calidad)

Cierre punto por punto, 7 de octubre de 2026. «Paso 5» es el redefinido por esta revisión; las piezas son las
del resumen aprobado ese día.

| Punto de la revisión | Estado | Cómo |
|---|---|---|
| Duplicación textual entre bloques | Paso 5 | Libro de hechos con un bloque dueño por hecho; los demás reciben referencias de una línea. La pasada de coherencia (Paso 3, ya construida) queda como segunda red, no como la corrección |
| La pasada de coherencia «deja de ser opcional» | **Ya resuelto** | Construida en el Paso 3; se dispara al terminar de generar. En el demo encontró 26 observaciones, varias de este tipo |
| Procedencia no confiable | Paso 5 (primera parada) | Cada hecho trae extracto literal y ubicación; el código lo busca en el texto extraído y descarta lo que no está. Los bloques citan hechos, no archivos |
| Inferencias presentadas como hechos | Paso 5 | Regla única de inferencia: solo se afirma lo que dice un hecho. El caso del Código de Ética se puede verificar: su extracto literal tiene que estar en el Word del demo |
| La regla «no publicar datos que solo vienen de un adjunto» aplicada a conveniencia | Paso 5, con decisión tomada | Jerarquía explícita validado > perfil > adjunto, aplicada por código y no por el modelo. Validado = capturas confirmadas, extractos confirmados y respuestas de cuestionarios; la descripción de una solicitud no es fuente (decisión de Esteban, 7 de octubre) |
| 15: (iii)–(v) de 6(a) | **Ya resuelto en el índice** | `bloques.ts` asigna 6(a)(iii), (iv) y (v) al bloque 16 (`supervision_estrategia`); el 15 lleva 6(a), (i) y (ii). La lista por subrequisito del Paso 5 lo hará explícito («asignado a bloque 16») |
| 15: contradicción Comité/Consejo sobre las competencias | Paso 5 | Mismo hecho (misma clave) de dos fuentes con contenido incompatible → contradicción detectada al armar el libro → marcador y nota, nunca elección |
| 15: v2 perdió la respuesta literal a 6(a)(ii) | Paso 5 | La lista por subrequisito la exige explícitamente; se medirá con la rúbrica |
| 15: notas «propuesta vs. impartida», «aprueba vs. propone» | Se conserva | Pasan a ser contradicciones del libro (cubeta «decisiones del emisor») |
| 18: 6(b)(ii) ausente | **Ya resuelto en el índice** | El 18 es editorial recomendado (Paso 1); 6(b) vive en el 17 (`gerencia_controles`). La lista por subrequisito del 17 lo hará visible |
| 18: relleno estatutario | Paso 5 | Sin adjuntos completos en el bloque, solo hechos asignados; un artículo genérico de estatutos no tiene dueño climático |
| 18: «Crédito y Banca» y «Dirección de Crédito» | Paso 5 | Glosario canónico desde el Perfil en la capa estable y validador de nombres después de generar |
| 18: «solo se leyó la primera parte de los estatutos» en una nota | Paso 5 | Pre-vuelo de insumos a nivel documento; el Perfil ya lo muestra por archivo desde el Paso 2 |
| 18: «el organigrama que acompaña» sin organigrama | **Ya resuelto** | Desde el Paso 4 el Word inserta la figura con su pie |
| 27: 25(a)(ii) sin responder | Paso 5 | Lista por subrequisito |
| 27: severidad «0 a 25» | Paso 5 | Validador de rangos; el dato también está en el Perfil del demo (`matriz_riesgos`, nivel Bajo con mínimo 0) y se corrige en el repoblado |
| 27: embellecimientos («colaterales», «actividades financiadas») | Paso 5 | Regla única de inferencia y bloques sin contexto crudo |
| 27: CENAPRED con y sin nota | Paso 5 | Notas en tres cubetas con criterio fijo; un desarrollo de sigla que no está en una fuente va a «defectos de insumo» |
| 27: «acta-gobierno.pdf no pudo leerse» en tres bloques | **Ya resuelto** el caso; Paso 5 la regla | El acta se reemplazó en el Paso 3; el pre-vuelo hará que un ilegible se reporte una vez, a nivel documento |
| Cita verificada por código | Paso 5 (primera parada) | Ver «Procedencia» |
| Caché del contexto compartido | Paso 5 | Capa estable común a todos los bloques (reglas, ejemplo, índice, emisora, glosario); los requisitos pasan a la volátil |
| Notas en tres cubetas | Paso 5 | Decisiones del emisor, revelación voluntaria, defectos de insumo |
