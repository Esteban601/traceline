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
export const FUENTE_GRI_SASB: Record<string, { bloques: number[]; tema: RegExp }> = {
  // GRI 2 · 1. La organización y sus prácticas de presentación de informes
  "GRI 2-1": { bloques: [2, 4], tema: /denominaci|raz[oó]n social|S\.A\.B|sociedad an[oó]nima|forma jur[ií]dica|\bsede\b|domicilio|opera en|\bpa[ií]s(es)?\b/i },
  "GRI 2-2": { bloques: [4], tema: /subsidiari|entidades?|per[ií]metro|consolid/i },
  "GRI 2-3": { bloques: [2, 4], tema: /periodo (objeto|del informe|que cubre|de reporte)|frecuencia (del|de los) informe|se publica|punto de contacto|contacto/i },
  "GRI 2-4": { bloques: [3, 6], tema: /reexpres|actualizaci[oó]n de (la )?informaci|correcci[oó]n de (cifras|informaci)/i },
  "GRI 2-5": { bloques: [2, 30], tema: /verificaci[oó]n externa|aseguramiento|auditor[ií]a externa|tercero independiente/i },
  // 2. Actividades y trabajadores
  "GRI 2-6": { bloques: [12, 13], tema: /sector|producto|servicio|cadena de valor|proveedor|clientes?|mercado/i },
  // 3. Gobernanza
  "GRI 2-9": { bloques: [15, 18], tema: /consejo|comit[eé]|composici[oó]n|miembros|consejer|independ/i },
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
  "GRI 2-20": { bloques: [16, 37], tema: /remuneraci|compensaci|incentivo|bono/i },
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
  "FN-CB-410b.3": { bloques: [33], tema: /PCAF|porcentaje de la cartera|cartera empresarial cubierta|medici[oó]n/i },
  "FN-CB-410b.4": { bloques: [33], tema: /PCAF|metodolog|calidad de (los )?datos/i },
  "FN-CB-550a.2": { bloques: [26, 34], tema: /pruebas? de estr[eé]s|estr[eé]s financiero|suficiencia de capital|planeaci[oó]n de capital|solvencia/i },
};

/** Contenido GRI o SASB (no NIIF): lo que entra por esta vía. */
export const esGriSasb = (codigo: string): boolean => /^GRI \d|^[A-Z]{2}-[A-Z]{2}-/.test(codigo);

/** Descripción del requisito para el modelo: el texto literal de la norma, con el aviso de que no es NIIF. */
export function descripcionGriSasb(d: { codigo: string; estandar: string | null; edicion: string | null; descripcion: string }): string {
  const norma = `${d.estandar ?? ""}${d.edicion ? ` (${d.edicion})` : ""}`.trim();
  const idioma = d.estandar?.startsWith("SASB") ? " El requisito está en inglés (norma SASB sin traducción oficial); la respuesta va en español." : "";
  return `Contenido ${d.codigo} de ${norma}, no de NIIF S1/S2: ${d.descripcion}${idioma} Responde con lo que la fuente dice de este contenido, como respuesta propia; si la fuente no cubre una parte del contenido, no la afirmes ni la inventes.`;
}

export type HechoTema = { id: string; libro_id: string; estado: string; enunciado: string; bloque_dueno: number | null; bloques_referencia: number[] | null };

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
    if (ids.length) return { bloque: b, hechos: ids };
  }
  return null;
}
