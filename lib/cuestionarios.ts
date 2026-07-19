// =============================================================================
// Catálogo de los cuestionarios narrativos (Fase 3, Sprint 4).
//
// Las PREGUNTAS son fijas de la plantilla oficial y NO viven en BD: viven aquí,
// tipadas por hoja. La BD (cuestionarios_respuestas) solo guarda la RESPUESTA,
// ligada por (hoja, pregunta_orden). Este módulo es data pura (sin server-only):
// lo comparten la página server, la vista client y la ruta de export.
//
// Procedencia de las preguntas:
//   · 'S2 36(e)'      → VERBATIM de la plantilla (celdas A3:A7 de la hoja
//                        "NIIF S2 36(e)(i)-(iv)"). No requieren validación.
//   · 'S2 22(b)(i)'   → la plantilla trae la hoja EN BLANCO (solo encabezados).
//     'S2 22(b)(ii)'     Las preguntas se derivan 1:1 de los incisos del párrafo
//                        NIIF S2 22(b): (i) insumos, (ii) supuestos clave. Cada
//                        pregunta guarda su `inciso` (referencia a la norma) y
//                        queda marcada PENDIENTE-VALIDACIÓN hasta confirmación
//                        manual contra el texto oficial. Redacción fiel al
//                        requerimiento, sin ampliar ni interpretar.
// =============================================================================

export type HojaCuestionario = "S2 22(b)(i)" | "S2 22(b)(ii)" | "S2 36(e)";

export type PreguntaCuestionario = {
  /** Posición 1-based; liga la respuesta en BD (pregunta_orden). Estable: no reordenar. */
  orden: number;
  /** Texto de la pregunta/supuesto. */
  texto: string;
  /** Referencia al inciso de la norma (p. ej. "S2 22(b)(i)(3)"). */
  inciso: string;
  /**
   * true cuando la redacción está derivada de la norma y espera validación
   * manual de IRStrat contra el texto oficial. false cuando es verbatim de la
   * plantilla.
   */
  pendienteValidacion: boolean;
};

export type SeccionCuestionario = {
  hoja: HojaCuestionario;
  /** Nombre EXACTO de la hoja en la plantilla (assets/taxonomia-base.xlsx). */
  hojaExcel: string;
  /** Título de la hoja / tema del cuestionario. */
  titulo: string;
  /** Encabezado de la 1.ª columna en la plantilla ("Pregunta" o "Supuesto"). */
  etiquetaColumna: string;
  preguntas: PreguntaCuestionario[];
};

// -----------------------------------------------------------------------------
// S2 22(b)(i) — Insumos del análisis de escenarios climáticos.
//   Derivadas 1:1 de los siete insumos enumerados en NIIF S2 22(b)(i)(1)-(7).
//   PENDIENTE-VALIDACIÓN.
// -----------------------------------------------------------------------------
const S2_22BI: PreguntaCuestionario[] = [
  { orden: 1, inciso: "S2 22(b)(i)(1)", pendienteValidacion: true,
    texto: "Escenarios climáticos utilizados en el análisis y sus fuentes" },
  { orden: 2, inciso: "S2 22(b)(i)(2)", pendienteValidacion: true,
    texto: "Si el análisis incluyó una gama diversa de escenarios climáticos" },
  { orden: 3, inciso: "S2 22(b)(i)(3)", pendienteValidacion: true,
    texto: "Si los escenarios utilizados se asociaron con riesgos climáticos de transición o riesgos climáticos físicos" },
  { orden: 4, inciso: "S2 22(b)(i)(4)", pendienteValidacion: true,
    texto: "Si se utilizó, entre los escenarios, uno alineado con el último acuerdo internacional sobre cambio climático" },
  { orden: 5, inciso: "S2 22(b)(i)(5)", pendienteValidacion: true,
    texto: "Por qué la entidad determinó que los escenarios utilizados son pertinentes para evaluar su resiliencia" },
  { orden: 6, inciso: "S2 22(b)(i)(6)", pendienteValidacion: true,
    texto: "Horizontes temporales utilizados en el análisis" },
  { orden: 7, inciso: "S2 22(b)(i)(7)", pendienteValidacion: true,
    texto: "Alcance de las operaciones cubierto por el análisis" },
];

// -----------------------------------------------------------------------------
// S2 22(b)(ii) — Supuestos clave del análisis de escenarios climáticos.
//   Derivadas 1:1 de los cinco supuestos enumerados en NIIF S2 22(b)(ii)(1)-(5).
//   PENDIENTE-VALIDACIÓN.
// -----------------------------------------------------------------------------
const S2_22BII: PreguntaCuestionario[] = [
  { orden: 1, inciso: "S2 22(b)(ii)(1)", pendienteValidacion: true,
    texto: "Supuestos sobre políticas climáticas en las jurisdicciones en las que opera la entidad" },
  { orden: 2, inciso: "S2 22(b)(ii)(2)", pendienteValidacion: true,
    texto: "Supuestos sobre tendencias macroeconómicas" },
  { orden: 3, inciso: "S2 22(b)(ii)(3)", pendienteValidacion: true,
    texto: "Supuestos sobre variables nacionales o regionales" },
  { orden: 4, inciso: "S2 22(b)(ii)(4)", pendienteValidacion: true,
    texto: "Supuestos sobre el uso y la combinación de fuentes de energía" },
  { orden: 5, inciso: "S2 22(b)(ii)(5)", pendienteValidacion: true,
    texto: "Supuestos sobre desarrollos tecnológicos" },
];

// -----------------------------------------------------------------------------
// S2 36(e)(i)-(iv) — Créditos de carbono. VERBATIM de la plantilla (A3:A7).
//   La hoja desglosa el inciso (iii) en dos filas (naturaleza/tecnológica y
//   reducción/eliminación), por eso son 5 preguntas para 4 incisos.
// -----------------------------------------------------------------------------
const S2_36E: PreguntaCuestionario[] = [
  { orden: 1, inciso: "S2 36(e)(i)", pendienteValidacion: false,
    texto: "En qué medida, y de qué manera, el logro de cualquier objetivo de emisiones netas de gases de efecto invernadero se basa en el uso de créditos de carbono" },
  { orden: 2, inciso: "S2 36(e)(ii)", pendienteValidacion: false,
    texto: "Régimen o regímenes de terceros que verificarán o certificarán los créditos de carbono" },
  { orden: 3, inciso: "S2 36(e)(iii)", pendienteValidacion: false,
    texto: "El crédito de carbono subyacente a la compensación se basará en la naturaleza o en la eliminación tecnológica de carbono" },
  { orden: 4, inciso: "S2 36(e)(iii)", pendienteValidacion: false,
    texto: "El crédito de carbono subyacente se compensa mediante la reducción o eliminación de carbono" },
  { orden: 5, inciso: "S2 36(e)(iv)", pendienteValidacion: false,
    texto: "Información sobre cualquier otro factor necesario para que los usuarios de informes financieros con propósito general comprendan la credibilidad e integridad de los créditos de carbono que la entidad prevé utilizar" },
];

export const CUESTIONARIOS: SeccionCuestionario[] = [
  {
    hoja: "S2 22(b)(i)",
    hojaExcel: "NIIF S2 22(b)(i)",
    titulo: "Análisis de escenarios climáticos — insumos",
    etiquetaColumna: "Pregunta",
    preguntas: S2_22BI,
  },
  {
    hoja: "S2 22(b)(ii)",
    hojaExcel: "NIIF S2 22(b)(ii)",
    titulo: "Supuestos clave del análisis de escenarios climáticos",
    etiquetaColumna: "Supuesto",
    preguntas: S2_22BII,
  },
  {
    hoja: "S2 36(e)",
    hojaExcel: "NIIF S2 36(e)(i)-(iv)",
    titulo: "Créditos de carbono para objetivos de emisiones netas",
    etiquetaColumna: "Pregunta",
    preguntas: S2_36E,
  },
];

export const HOJAS_CUESTIONARIO: HojaCuestionario[] = CUESTIONARIOS.map((s) => s.hoja);

/** Valida que un `hoja` de entrada sea una de las 3 conocidas. */
export function esHojaCuestionario(v: string): v is HojaCuestionario {
  return (HOJAS_CUESTIONARIO as string[]).includes(v);
}

/** Preguntas de una hoja (o [] si la hoja no existe). */
export function preguntasDe(hoja: string): PreguntaCuestionario[] {
  return CUESTIONARIOS.find((s) => s.hoja === hoja)?.preguntas ?? [];
}
