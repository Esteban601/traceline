# Segunda revisión externa: bloques 15, 18 y 27 desde el libro de hechos

7 de octubre de 2026. Revisión de los bloques 15, 18 y 27 generados solo desde el libro de hechos (encargo
`docs/encargos/2026-10-06-suplemento-calidad.md`, Paso 5, punto 3; comparación en
`referencia/suplemento-calidad/paso5/bloques-15-18-27-libro.docx`, no versionado). Primera revisión:
`revision-externa-2026-10-07.md`. Texto recibido de Esteban; se guarda tal cual. Al final, cómo se atiende cada
punto (Paso 5b).

---

La premisa de "se tomó en cuenta la revisión" es cierta en lo que señalé —duplicación, procedencia, inferencias— y los tres problemas están resueltos o casi. Pero el libro de hechos cambió el modo de falla, no lo eliminó: ahora los bloques se contradicen entre sí sobre el mismo hecho (el 15 marca pendiente lo que el 18 afirma), publican hechos irrelevantes solo porque les fueron asignados, y la etiqueta "verificada por código" sobre la cobertura normativa es falsa. Un auditor ya no te va a reclamar que repites párrafos; te va a reclamar que una sección dice que el Comité fue creado el 27 de febrero y otra dice que no se sabe si existe.

## Lo incómodo primero

[Seguro] Contradicción entre bloques del mismo libro. 18-libro publica: "El Comité… fue creado por acuerdo del Consejo en su sesión del 27 de febrero de 2025". 15-libro, tres páginas antes, deja un pendiente: "confirmar la fecha y el acto de creación del Comité, ya que los documentos difieren entre su constitución en febrero de 2025 y su mera propuesta". La propia nota del 15 admite que las referencias del 18 lo resuelven "pero este bloque no la afirma". Esto es peor que la duplicación de v2: antes el informe se repetía; ahora se desmiente a sí mismo. La causa es que cada bloque razona sobre sus hechos sin ver las conclusiones de los demás, y no hay validador cruzado todavía (sé que está en el pendiente del Paso 5; esto lo vuelve lo primero de la lista, no lo último).

[Seguro] c1 y c3 son falsos positivos; c2 y c4 son reales. El libro reportó 0 contradicciones y el bloque 15 encontró 4. Las dos detecciones están desacopladas y ninguna es correcta sola:

- c1 (creado vs. propuesto): acta-gobierno registra la propuesta en la sesión del Consejo; acta-comité registra la instalación con consejeros "designados por el Consejo en su sesión del 27 de febrero". Eso es una secuencia, no una contradicción. El modelo trató una cronología como conflicto.
- c3 (Comité evalúa vs. Consejo evalúa): la nota misma dice "pueden ser compatibles (el Comité evalúa y propone, el Consejo decide)". Es gobierno corporativo estándar: el comité hace el trabajo, el consejo decide. Debió redactarse así y anotarse, no marcarse pendiente.
- c2 (aprueba vs. propone) y c4 (impartida vs. propuesta) sí son excluyentes y sí afectan lo publicado. Esos pendientes son correctos.

El costo de sobre-marcar no es cero: el bloque 15 tiene 4 pendientes en 432 palabras, un tercio del texto es marcador, y el emisor va a dejar de leer los pendientes si la mitad son triviales. Falta un umbral: pendiente solo cuando los hechos son mutuamente excluyentes y el texto no puede redactarse de forma compatible con ambos.

[Seguro] "Cobertura por subrequisito (verificada por código)" no es verificable por código. El código verifica que un extracto exista en su fuente. Que un párrafo cubra 6(a)(ii) es juicio del modelo. Rotularlo como verificado hace que el revisor confíe en algo que es exactamente tan fiable como las "fuentes declaradas" de v2. Y el 27 lo demuestra: la lista y la nota dicen que falta "25(a)(iii)"; el inciso de análisis de escenarios es 25(a)(ii), (iii) es naturaleza/probabilidad/magnitud. Además colapsa (i)–(v) en una línea, cuando el punto era una línea por inciso. Una lista de verificación con el número equivocado es peor que ninguna.

[Seguro] Los bloques publican lo que les toca, no lo que corresponde. 18-libro dedica un párrafo entero a la línea de denuncia, el Comité de Ética y la capacitación anual de RH: cero clima, fuera del alcance E5, y en la misma nota el bloque excluye el 54% de mujeres en plantilla precisamente por E5. Mismo criterio, aplicado al revés en el mismo bloque. También publica que "el Secretario del Consejo fue designado delegado para formalizar los acuerdos": trivia de acta que ningún inversionista necesita. La asignación es por captura/adjunto, no por hecho, así que el bloque recibe hechos irrelevantes y los usa porque están ahí. Hace falta la regla explícita: no hay obligación de usar todos los hechos asignados.

## Lo que sí mejoró (breve, porque es real)

[Seguro] La duplicación entre 15, 18 y 27 desapareció; el 18 remite al 15 y el 27 ya no repite direcciones. La inferencia "conforme a las políticas aprobadas por el Consejo" del 27 v2 se fue. "Actividades financiadas" y "colaterales que respaldan la cartera" volvieron al texto literal de la fuente. CENAPRED se mantiene como sigla, fiel a la solicitud. El 0 vs. 1 de la matriz se detectó y se remitió al bloque 9. acta-gobierno ya es legible y aporta. El c4 (16 horas propuestas vs. impartidas) es un hallazgo que a un cliente real le ahorra una observación del auditor. Esto justifica la arquitectura; lo de arriba es afinación.

## Por bloque

**15** · [Seguro] Correcto en estructura; sobre-marcado (c1, c3). [Probable] Perdió frente a v2 la función del Comité de "proponer criterios climáticos en transacciones importantes y presupuesto"; si estaba en el acta, el libro no la extrajo; si era invención de v2, bien perdida. Verifícalo contra el acta. [Seguro] Costó $0.51 contra $0.36 de v2 con menos contenido publicable: el bloque sigue recibiendo mucho más que sus hechos, o el razonamiento de contradicciones se está pagando en cada bloque en vez de una vez en el libro.

**18** · [Seguro] El párrafo del organigrama está mal: "el Comité de Sostenibilidad… forma parte de la estructura de gobierno y en él se distinguen las áreas de Riesgos, Sostenibilidad, Crédito y Banca…" dice que las direcciones están dentro del Comité. v2 describía la jerarquía correctamente (Consejo → comités; Dirección General → direcciones). El libro redujo la imagen a dos extractos de etiquetas y perdió la estructura. Una imagen de organigrama necesita extracción estructurada (nodos y dependencias), no OCR de rótulos. [Seguro] Desapareció todo el nivel ejecutivo (Dirección General, Comité de Dirección, funciones de las direcciones); si 6(b) vive en el 17, bien, pero un bloque titulado "estructura de gobierno" que no describe la estructura ejecutiva quedó cojo. [Seguro] La composición del Consejo (11 / 5 independientes / 3 mujeres) es la mejor adición de esta versión. [Seguro] La nota "verificar que el bloque 15 cuente con sustento validado o perfil para esas cifras" es innecesaria: el 15 ya cita el Perfil para los tres consejeros; el 18 no ve los hechos del 15.

**27** · [Seguro] Contradicción interna no detectada: "Durante 2025 la Compañía integró criterios climáticos en la evaluación de crédito" (párrafo 1) y "los procesos no registraron cambios, salvo… colaterales" (párrafo 3). Integrar criterios climáticos en la evaluación crediticia es un cambio de proceso en 2025. [Probable] El origen del problema es la fuente: "Perfil, Carta de la Dirección". Una carta es narrativa aspiracional de un bloque editorial opcional; darle rango "perfil" la pone al nivel de un registro de clima. Las cartas no deberían ser fuente de hechos. [Seguro] El pendiente de 25(a)(ii) está bien puesto (mal numerado). [Seguro] El párrafo final del Código de Ética aquí sí es pertinente (canal de identificación ascendente), y la nota deja al revisor quitarlo; correcto.

## Qué cambiar

- Validador cruzado antes de entregar: para cada hecho con dueño, comprobar que ningún otro bloque lo afirme con otro valor ni lo marque pendiente. El caso 15/18 se atrapa con una regla de 20 líneas sobre el libro.json.
- Contradicciones: una sola instancia decide. El libro las detecta (con la segunda pasada por bloque dueño que propusiste, y además una regla temporal: propuesta→creación→instalación es secuencia), las clasifica en excluyente / compatible, y el bloque solo recibe el veredicto. Hoy el libro dice 0 y el bloque dice 4.
- Umbral de pendiente: excluyente y sin redacción compatible. Lo compatible se redacta conciliado y va a notas.
- Cobertura: una línea por inciso literal, con el texto del inciso tomado de la norma (no escrito por el modelo), rotulada "juicio del generador". Reserva "verificado por código" para lo que lo es.
- Asignación por hecho, no por captura, y en el prompt: "usa solo los hechos que respondan al subrequisito; los demás, ignóralos". Más un filtro de alcance E5 aplicado por hecho, no por intuición del bloque.
- Imágenes: extracción estructurada (nodo, padre, nivel) con Sonnet en el libro; el bloque recibe el árbol, no etiquetas sueltas.
- Fuentes: Carta de la Dirección y demás editoriales fuera del libro como fuente de rango "perfil"; a lo sumo rango propio "narrativo" que no sostiene afirmaciones solo.
- Validador de cambios de proceso: si un bloque afirma "sin cambios respecto del periodo anterior", buscar en sus propios hechos verbos de cambio con fecha del ejercicio ("integró", "incorporó", "creó en 2025"). Trivial y habría cazado el 27.
- Anclas inline en modo revisión ([h12] al final de cada oración, retiradas al publicar). "Fuentes de cada afirmación" sigue siendo una lista que el auditor tiene que casar a mano con el texto.
- Costo: si el 15 cuesta más que en v2 con menos palabras, mide qué está recibiendo el bloque. [Adivinando] le estás mandando el libro entero o las referencias de los bloques vecinos; con solo sus hechos y caché del contexto compartido debería bajar del 50% de v2.

---

## Cómo se atiende (Paso 5b)

Se llena al cerrar el Paso 5b, punto por punto.
