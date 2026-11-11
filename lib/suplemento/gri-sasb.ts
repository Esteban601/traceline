// =============================================================================
// RESPUESTAS GRI Y SASB (encargo 2026-10-31-catalogo-gri-sasb, Fase 2a).
//
// Los códigos GRI y SASB no son de ningún bloque del suplemento: los 40 bloques responden NIIF S1/S2. Su respuesta
// sale, en este orden (el primero que tenga fuente gana):
//   1. CAPTURA confirmada de una solicitud cuantitativa ligada al código — la cifra, sin modelo (como NIIF);
//   2. SECCIÓN APROBADA del suplemento que trata el contenido (tabla FUENTE_GRI_SASB): el modelo resume la sección
//      con los hechos del libro de esa sección que tratan el tema del contenido. Es una respuesta PROPIA del
//      contenido aunque coincida con un requisito NIIF ya respondido; nunca una remisión (decisión de Esteban,
//      31/10/2026, pregunta 2 de §1.5);
//   3. EVIDENCIA DIRECTA: el modelo resume los extractos de texto confirmados de las solicitudes ligadas al código;
//   4. si nada de eso hay, «Pendiente» con el marcador de CLAUDE.md §5.
// Las tres que usan modelo pasan por los mismos validadores que las NIIF (validarRespuesta, erroresDeForma).
// SASB solo entra para la industria del Perfil de la emisora (lib/catalogo-marcos.ts).
// =============================================================================

/**
 * Sección del suplemento que trata cada contenido: los bloques (el primero aprobado con hechos del tema es la
 * sección que se resume) y la expresión que reconoce, en el enunciado de un hecho de esos bloques, el tema del
 * contenido. Sin entrada: el contenido no tiene sección (va por captura o evidencia directa).
 */
export const FUENTE_GRI_SASB: Record<string, { bloques: number[]; tema: RegExp; extra?: RegExp[]; seccionPrimero?: boolean; evidenciaPrimero?: boolean; temaEnEvidencia?: boolean; extractosEnSeccion?: boolean }> = {
  // GRI 2 · 1. La organización y sus prácticas de presentación de informes
  "GRI 2-1": { bloques: [2, 4], tema: /denominaci|raz[oó]n social|S\.A\.B|sociedad an[oó]nima|forma jur[ií]dica|\bsede\b|domicilio|opera en|\bpa[ií]s(es)?\b/i },
  "GRI 2-2": { bloques: [4], tema: /subsidiari|entidades?|per[ií]metro|consolid/i },
  "GRI 2-3": { bloques: [2, 4], tema: /periodo (objeto|del informe|que cubre|de reporte)|frecuencia (del|de los) informe|se publica|punto de contacto|contacto/i },
  "GRI 2-4": { bloques: [3, 6], tema: /reexpres|actualizaci[oó]n de (la )?informaci|correcci[oó]n de (cifras|informaci)/i },
  "GRI 2-5": { bloques: [2, 30], tema: /verificaci[oó]n externa|aseguramiento|auditor[ií]a externa|tercero independiente/i },
  // 2. Actividades y trabajadores
  "GRI 2-6": { bloques: [12, 13], tema: /sector|producto|servicio|cadena de valor|proveedor|clientes?|mercado/i },
  // 2-7 (v6.1): primero los extractos confirmados de sus solicitudes (la plantilla y la composición por género, 54 % de
  // mujeres), que la captura sola no trae; el hecho de género del libro quedó descartado. Sin extractos, la sección.
  "GRI 2-7": { bloques: [12, 4], tema: /plantilla|emplea|personas|colaborador|mujeres/i, evidenciaPrimero: true },
  // 3. Gobernanza
  // 2-9 (v6.1): la sección 15 (Consejo y comités) más los extractos confirmados de sus solicitudes como hechos (las 3
  // consejeras de 11, que el libro descartó).
  "GRI 2-9": { bloques: [15, 18], tema: /consejo|comit[eé]|composici[oó]n|miembros|consejer|independ/i, seccionPrimero: true, extractosEnSeccion: true },
  "GRI 2-10": { bloques: [15, 18], tema: /designaci|selecci[oó]n|nombramient|asamblea de accionistas|elecci[oó]n de consejer/i },
  "GRI 2-11": { bloques: [15, 18], tema: /presidente del consejo|presidencia del consejo|presidente/i },
  "GRI 2-12": { bloques: [15, 16], tema: /supervis|revis|aprueb|consejo/i },
  "GRI 2-13": { bloques: [15, 17], tema: /deleg|direcci[oó]n general|comit[eé]|responsab/i },
  "GRI 2-14": { bloques: [15, 16, 2], tema: /aprob|revis|informe/i },
  "GRI 2-15": { bloques: [18, 15], tema: /conflictos? de inter[eé]s/i },
  "GRI 2-16": { bloques: [16, 17, 15], tema: /inform|frecuencia|report|comunic|sesi[oó]n/i },
  "GRI 2-17": { bloques: [15], tema: /competencia|capacitaci|conocimiento|experiencia|formaci[oó]n/i },
  "GRI 2-18": { bloques: [15, 16], tema: /evaluaci[oó]n del desempe|autoevaluaci/i },
  "GRI 2-19": { bloques: [16, 37], tema: /remuneraci|compensaci|incentivo|bono/i },
  // 2-20 (v6.1): solo el PROCESO de determinación de la remuneración; sin hechos de ese proceso, pendiente (antes
  // repetía la respuesta de 2-19, que sale de los mismos hechos de la política).
  "GRI 2-20": { bloques: [16, 37], tema: /determinaci[oó]n de (la )?remuneraci|proceso[^.]{0,50}(remuneraci|compensaci)|consultor(es|a)?[^.]{0,30}remuneraci|votaci[oó]n[^.]{0,40}remuneraci|aprobaci[oó]n de (la )?remuneraci/i, temaEnEvidencia: true },
  // 4. Estrategia, políticas y prácticas
  "GRI 2-22": { bloques: [1], tema: /sostenib|estrategia|compromiso|desarrollo|clima/i },
  "GRI 2-23": { bloques: [27, 17], tema: /pol[ií]tica de|c[oó]digo de [eé]tica|compromiso de|derechos humanos|principio precautorio|debida diligencia|conducta empresarial/i },
  "GRI 2-24": { bloques: [27, 17], tema: /pol[ií]tica|procedimient|integra|incorpora|capacitaci/i },
  "GRI 2-28": { bloques: [19, 1], tema: /asociaci|adhesi|iniciativa|firmante|signatari|principios/i },
  // 5. Participación de los grupos de interés
  "GRI 2-29": { bloques: [7], tema: /grupos? de inter[eé]s|partes interesadas|consulta|di[aá]logo|encuesta/i },
  // GRI 3
  "GRI 3-1": { bloques: [7], tema: /materialidad|temas? material|proceso|evaluaci/i },
  "GRI 3-2": { bloques: [7], tema: /temas? material/i },
  "GRI 3-3": { bloques: [7, 27], tema: /gesti[oó]n|medidas|pol[ií]tica|impacto|seguimiento/i },
  // SASB FN-CB
  // Siglas con límite de palabra: «ESG» sin él casa dentro de «riesgos».
  "FN-CB-410a.2": { bloques: [27, 22], tema: /cr[eé]dito|otorgamiento|originaci|l[ií]mites? (de concentraci[oó]n|sectorial)|criterios? (ambientales|sociales)|\bASG\b|\bESG\b/i },
  "FN-CB-410b.1": { bloques: [33], tema: /emisiones financiadas|PCAF/i },
  "FN-CB-410b.2": { bloques: [33, 34], tema: /exposici[oó]n|cartera.*sector|sector.*cartera/i },
  // 410b.3 y 410b.4 (v6.1): los hechos de PCAF viven en los bloques 25 y 39 (el 33 es «no aplica» por C4), más el hecho
  // del alivio C4, que explica por qué las cifras de emisiones financiadas no se revelan.
  "FN-CB-410b.3": { bloques: [33, 25, 39], tema: /PCAF|porcentaje de la cartera|cartera empresarial cubierta/i, extra: [/^alivios\.c4/] },
  "FN-CB-410b.4": { bloques: [33, 25, 39], tema: /PCAF|metodolog|calidad de (los )?datos/i, extra: [/^alivios\.c4/] },
  "FN-CB-550a.2": { bloques: [26, 34], tema: /pruebas? de estr[eé]s|estr[eé]s financiero|suficiencia de capital|planeaci[oó]n de capital|solvencia/i },
};

/**
 * Reglas de la tabla aprobada (Esteban, 10/11/2026) que se le dicen al modelo en la descripción del contenido:
 *   · GRI 2-5: nombra el alcance de lo verificado (el inventario de GEI) y no presenta el informe como verificado;
 *   · todo contenido GRI (regla general de v6.1; antes solo 2-24 y 3-3): si la fuente cubre solo parte del contenido,
 *     la respuesta nombra los incisos que no cubre.
 */
const COBERTURA_PARCIAL = "Si la fuente no cubre todos los incisos de este contenido, añade una oración que nombre los incisos que no se revelan (por ejemplo, «No se revelan los incisos b y c.»); no los afirmes ni los completes. Si cubre un inciso solo en parte, di qué parte de ese inciso falta (por ejemplo, «Del inciso b.ii no se revelan los estándares de verificación.»). No declares no revelado un inciso que la fuente sí cubre.";
export const REGLAS_GRI_SASB: Record<string, string> = {
  "GRI 2-5": "Nombra el alcance de lo que se verificó externamente (por ejemplo, el inventario de emisiones de GEI) y quién lo verificó, si la fuente lo dice. No presentes el informe ni la información de sostenibilidad en su conjunto como verificados. No describas el método de medición (protocolo, factores, datos de entrada): no es parte de este contenido. Declara qué parte del inciso b.ii no se revela (los estándares de verificación y las limitaciones del proceso, si la fuente no los da).",
  // v6.2 (lectura dirigida del libro GRI/SASB):
  "GRI 2-2": "El inciso b queda cubierto por la entidad que informa: las sociedades del informe son las subsidiarias consolidadas de los estados financieros. No lo declares no revelado.",
  "GRI 2-6": "Si la fuente no describe las entidades aguas abajo y sus actividades, declara no revelado el inciso b.iii.",
  "FN-CB-410b.2": "Si la fuente no da la exposición bruta desagregada, dilo exactamente así: «La información disponible no desglosa la exposición bruta por industria ni por clase de activo.»",
  "FN-CB-410b.4": "Si la fuente no describe cómo se atribuyen las emisiones a cada financiamiento, declara que no se describe el método de atribución.",
  "FN-CB-550a.2": "Responde con lo que la fuente dice de la prueba de estrés climática (escenario y efecto sobre el capital) y, si la fuente solo trata esa prueba, añade exactamente esta oración: «La Compañía describe únicamente la prueba de estrés climática de cartera; no revela la integración de las pruebas de estrés obligatorias y voluntarias en la planeación de capital.»",
  "GRI 2-24": COBERTURA_PARCIAL,
  "GRI 3-3": COBERTURA_PARCIAL,
};

/**
 * Validador determinista de las reglas que se pueden comprobar sin modelo: GRI 2-5 no presenta el informe como
 * verificado y, si afirma una verificación, nombra su alcance (inventario, emisiones, GEI, alcance).
 */
export function erroresGriSasb(texto: string, codigo: string): string[] {
  const errores: string[] = [];
  // v6.2: lo que cada contenido tiene que declarar, o no decir.
  const oraciones = texto.split(/(?<=\.)\s+/);
  const declara = (re: RegExp) => oraciones.some((o) => /\bno\b/i.test(o) && re.test(o));
  if (codigo === "GRI 2-2" && declara(/\bincisos?\b[^.]*\bb\b/i)) errores.push("declara no revelado el inciso b, que cubre la entidad que informa (las subsidiarias consolidadas)");
  if (codigo === "GRI 2-6" && !declara(/\bb\.?\s?iii\b/i)) errores.push("no declara no revelado el inciso b.iii (entidades aguas abajo), que la fuente no cubre");
  if (codigo === "FN-CB-410b.2" && !/no desglosa la exposición bruta por industria ni por clase de activo/i.test(texto)) errores.push("no dice «La información disponible no desglosa la exposición bruta por industria ni por clase de activo.»");
  if (codigo === "FN-CB-410b.4" && !declara(/m[eé]todo de atribuci[oó]n/i)) errores.push("no declara que no se describe el método de atribución de las emisiones financiadas");
  if (codigo === "FN-CB-550a.2" && !/La Compañía describe únicamente la prueba de estrés climática de cartera; no revela la integración de las pruebas de estrés obligatorias y voluntarias en la planeación de capital\./.test(texto)) errores.push("no dice «La Compañía describe únicamente la prueba de estrés climática de cartera; no revela la integración de las pruebas de estrés obligatorias y voluntarias en la planeación de capital.»");
  if (codigo === "FN-CB-550a.2" && oraciones.length < 2) errores.push("solo trae la declaración: di también lo que la fuente dice de la prueba de estrés (escenario y efecto sobre el capital)");
  if (codigo !== "GRI 2-5") return errores;
  if (/protocolo GEI|factores de emisi[oó]n|datos de entrada|m[eé]todo (de medici[oó]n|de c[aá]lculo)?/i.test(texto)) errores.push("describe el método de medición, que no es parte de GRI 2-5");
  // b.ii solo aplica si hubo verificación: con una verificación afirmada, la respuesta dice qué parte de b.ii falta.
  const verificada = /verificad|verificaci[oó]n|asegurad|aseguramiento/i.test(texto) && !/\bno\b[^.]{0,40}(verific|asegur)/i.test(texto);
  if (verificada && !declara(/\bb\.?\s?ii\b/i)) errores.push("no declara qué parte del inciso b.ii no se revela");
  if (/(el|este|el presente) (informe|reporte|documento)\b[^.]{0,80}\b(verificad|asegurad)|verificaci[oó]n (externa |independiente )?(del|de este|de todo el) (informe|reporte)|informaci[oó]n de sostenibilidad\b[^.]{0,60}\b(fue|ha sido|est[aá]) (verificad|asegurad)/i.test(texto)) {
    errores.push("presenta el informe como verificado; GRI 2-5 nombra solo el alcance de lo verificado (p. ej., el inventario de GEI)");
  }
  const afirma = /verificad|verificaci[oó]n|asegurad|aseguramiento/i.test(texto) && !/\bno\b[^.]{0,40}(verific|asegur)/i.test(texto);
  if (afirma && !/inventario|emisiones|\bGEI\b|alcance/i.test(texto)) errores.push("afirma una verificación externa sin decir su alcance (qué se verificó)");
  return errores;
}

/** Contenido GRI o SASB (no NIIF): lo que entra por esta vía. */
export const esGriSasb = (codigo: string): boolean => /^GRI \d|^[A-Z]{2}-[A-Z]{2}-/.test(codigo);

/** Descripción del requisito para el modelo: el texto literal de la norma, con el aviso de que no es NIIF. */
export function descripcionGriSasb(d: { codigo: string; estandar: string | null; edicion: string | null; descripcion: string }): string {
  const norma = `${d.estandar ?? ""}${d.edicion ? ` (${d.edicion})` : ""}`.trim();
  const idioma = d.estandar?.startsWith("SASB") ? " El requisito está en inglés (norma SASB sin traducción oficial); la respuesta va en español." : "";
  const reglas = [REGLAS_GRI_SASB[d.codigo], /^GRI /.test(d.codigo) && REGLAS_GRI_SASB[d.codigo] !== COBERTURA_PARCIAL ? COBERTURA_PARCIAL : null].filter(Boolean);
  const regla = reglas.length ? ` ${reglas.join(" ")}` : "";
  return `Contenido ${d.codigo} de ${norma}, no de NIIF S1/S2: ${d.descripcion}${idioma} Responde con lo que la fuente dice de este contenido, como respuesta propia; si la fuente no cubre una parte del contenido, no la afirmes ni la inventes.${regla}`;
}

export type HechoTema = { id: string; clave: string; libro_id: string; estado: string; enunciado: string; bloque_dueno: number | null; bloques_referencia: number[] | null };

/**
 * La sección aprobada que responde el contenido: el primer bloque de su lista aprobado en el documento que tenga
 * hechos vigentes del tema (dueño o referencia el propio bloque, en su libro). Null si ninguno.
 */
export function seccionDe<H extends HechoTema>(
  codigo: string,
  aprobados: Map<number, { libro_id: string | null }>,
  hechos: Iterable<H>
): { bloque: number; hechos: string[] } | null {
  const f = FUENTE_GRI_SASB[codigo];
  if (!f) return null;
  const todos = [...hechos];
  for (const b of f.bloques) {
    const libro = aprobados.get(b)?.libro_id;
    if (!libro) continue;
    const vistos = new Set<string>();
    const ids = todos
      .filter((h) => h.estado === "vigente" && h.libro_id === libro && (h.bloque_dueno === b || (h.bloques_referencia ?? []).includes(b)) && f.tema.test(h.enunciado))
      .filter((h) => !vistos.has(h.enunciado) && vistos.add(h.enunciado))
      .map((h) => h.id);
    if (ids.length) {
      // `extra`: hechos del mismo libro por clave, de cualquier bloque (la composición por género del Perfil, el alivio C4).
      const extra = (f.extra ?? []).length ? todos.filter((h) => h.estado === "vigente" && h.libro_id === libro && f.extra!.some((re) => re.test(h.clave)) && !ids.includes(h.id) && !vistos.has(h.enunciado) && vistos.add(h.enunciado)).map((h) => h.id) : [];
      return { bloque: b, hechos: [...ids, ...extra] };
    }
  }
  return null;
}

/**
 * GRI 2-3 por regla (v6.1): periodo, frecuencia y publicación salen del reporte y de su régimen (E4); el punto de
 * contacto no lo captura la plataforma y se declara no revelado (pendiente parcial, en las notas).
 */
export function respuestaGri23(c: { ejercicio: number; e4: boolean }): string {
  const publicacion = c.e4
    ? "Conforme a la medida transitoria del párrafo E4 de la NIIF S1, en este primer periodo anual la información se publica con posterioridad a los estados financieros del mismo periodo."
    : "La información se publica como parte del informe anual, junto con los estados financieros del mismo periodo.";
  return `El informe cubre el ejercicio ${c.ejercicio}, del 1 de enero al 31 de diciembre de ${c.ejercicio}, con frecuencia anual, el mismo periodo de los estados financieros. ${publicacion} No se revela un punto de contacto para preguntas sobre el informe.`;
}

/** GRI 2-4 por regla en el primer periodo (v6.2, como K718): no hay información de periodos anteriores que actualizar. */
export const RESPUESTA_GRI_24_PRIMER_ANIO = "Sin actualizaciones de información de periodos anteriores: primer periodo bajo NIIF S1 y S2.";

/**
 * FN-CB-550a.1 (puntuación G-SIB) por dato del Perfil (v6.1): «No aplica» si la emisora declara que no es un banco de
 * importancia sistémica global; si lo es o no lo declaró, null (pendiente).
 */
export function respuestaGsib(bancoSistemicoGlobal: boolean | null | undefined): string | null {
  return bancoSistemicoGlobal === false ? "No aplica: la Compañía no es un banco de importancia sistémica global (G-SIB), por lo que no tiene puntuación G-SIB." : null;
}

/**
 * Respuesta de una captura para GRI/SASB (v6.1): nombra qué mide la cifra (el título de su solicitud, sin el año ni la
 * unidad) antes del valor. En GRI 401-1 dice además si mide rotación o contrataciones y declara el desglose que la
 * captura no trae (edad, sexo, región).
 */
export function respuestaGriDeCaptura(codigo: string, titulo: string, cifra: string): string {
  const concepto = titulo.replace(/\s*\(([^)]*)\)\s*$/, "").replace(/\s+(19|20)\d{2}\b/g, "").trim();
  const base = `${concepto}: ${cifra.replace(/\.$/, "")}.`;
  if (codigo !== "GRI 401-1") return base;
  const mide = /rotaci[oó]n/i.test(titulo) ? "" : /contrataci/i.test(titulo) ? "" : " La cifra no indica si corresponde a nuevas contrataciones o a rotación de personal.";
  const noMide = /rotaci[oó]n/i.test(titulo) ? " No se revelan las nuevas contrataciones." : /contrataci/i.test(titulo) ? " No se revela la rotación de personal." : "";
  return `${base}${mide}${noMide} No se revela el desglose por grupo de edad, sexo y región.`;
}
