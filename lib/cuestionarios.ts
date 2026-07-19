// =============================================================================
// Catálogo de los cuestionarios narrativos (Fase 3, Sprint 4).
//
// Las PREGUNTAS son fijas de la estructura oficial de la taxonomía y NO viven en
// BD: viven aquí, tipadas por hoja. La BD (cuestionarios_respuestas) solo guarda
// la RESPUESTA (y la nota), ligada por (hoja, pregunta_orden). Este módulo es
// data pura (sin server-only): lo comparten la página server, la vista client y
// la ruta de export.
//
// Procedencia y validación:
//   · 'S2 36(e)'      → VERBATIM de la plantilla (celdas A3:A7).
//   · 'S2 22(b)(i)'   → estructura oficial de NIIF S2 22(b) (insumos / supuestos).
//     'S2 22(b)(ii)'     Alineadas 1:1 con los incisos de la norma. Todo el
//                        catálogo quedó VALIDADO contra la estructura oficial
//                        (pendienteValidacion: false).
//
// TIPO DE DATO POR PREGUNTA (estructura oficial): cada pregunta declara su
// `control` (cómo se captura y se lee la respuesta):
//   · "texto"      → bloque de texto libre (textarea). respuesta = el texto.
//   · "booleano"   → Verdadero / Falso. respuesta = "Verdadero" | "Falso".
//   · "enum_multi" → selección múltiple de `opciones`. respuesta = opciones
//                    elegidas unidas por "; " (en el orden del catálogo).
// `tipoDatoLabel` es la etiqueta legible de la columna "Tipo de dato" del Excel
// para las hojas 22(b) (estructura oficial). Ausente en 36(e): esa hoja conserva
// su "Tipo de dato" capturado libremente (sin cambios).
// =============================================================================

export type HojaCuestionario = "S2 22(b)(i)" | "S2 22(b)(ii)" | "S2 36(e)";

export type ControlCuestionario = "texto" | "booleano" | "enum_multi";

export const BOOLEANO_OPCIONES = ["Verdadero", "Falso"] as const;
export const SEPARADOR_ENUM = "; ";

export type PreguntaCuestionario = {
  /** Posición 1-based; liga la respuesta en BD (pregunta_orden). Estable: no reordenar. */
  orden: number;
  /** Texto de la pregunta/supuesto. */
  texto: string;
  /** Referencia al inciso de la norma (p. ej. "S2 22(b)(i)(3)"). */
  inciso: string;
  /** Cómo se captura y se serializa la respuesta. */
  control: ControlCuestionario;
  /** Opciones para control "enum_multi". */
  opciones?: string[];
  /** Etiqueta de la columna "Tipo de dato" del Excel (22(b); ausente en 36(e)). */
  tipoDatoLabel?: string;
  /** false = validado contra la estructura oficial. */
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

const LABEL_TEXTO = "Bloque de texto";
const LABEL_BOOLEANO = "Booleano";
const LABEL_ENUM = "Enumeración";

const RIESGOS_OPC = [
  "Riesgos físicos relacionados con el clima",
  "Riesgos de transición relacionados con el clima",
];
const HORIZONTES_OPC = ["Corto plazo", "Mediano plazo", "Largo plazo"];

// -----------------------------------------------------------------------------
// S2 22(b)(i) — Análisis de escenarios climáticos (cómo/cuándo + insumos).
//   orden 1: bloque "cómo y cuándo" (chapeau de 22(b)). orden 2-8: insumos
//   (i)(1)-(i)(7). Tipos de dato conforme a la estructura oficial.
// -----------------------------------------------------------------------------
const S2_22BI: PreguntaCuestionario[] = [
  { orden: 1, inciso: "S2 22(b)", control: "texto", tipoDatoLabel: LABEL_TEXTO,
    pendienteValidacion: false,
    texto: "Información sobre cómo y cuándo se llevó a cabo el análisis del escenario" },
  { orden: 2, inciso: "S2 22(b)(i)(1)", control: "texto", tipoDatoLabel: LABEL_TEXTO,
    pendienteValidacion: false,
    texto: "Escenarios climáticos utilizados en el análisis y sus fuentes" },
  { orden: 3, inciso: "S2 22(b)(i)(2)", control: "booleano", tipoDatoLabel: LABEL_BOOLEANO,
    pendienteValidacion: false,
    texto: "Si el análisis incluyó una gama diversa de escenarios climáticos" },
  { orden: 4, inciso: "S2 22(b)(i)(3)", control: "enum_multi", opciones: RIESGOS_OPC,
    tipoDatoLabel: LABEL_ENUM, pendienteValidacion: false,
    texto: "Riesgos climáticos con los que se asociaron los escenarios utilizados" },
  { orden: 5, inciso: "S2 22(b)(i)(4)", control: "booleano", tipoDatoLabel: LABEL_BOOLEANO,
    pendienteValidacion: false,
    texto: "Si se utilizó, entre los escenarios, uno alineado con el último acuerdo internacional sobre cambio climático" },
  { orden: 6, inciso: "S2 22(b)(i)(5)", control: "texto", tipoDatoLabel: LABEL_TEXTO,
    pendienteValidacion: false,
    texto: "Por qué la entidad determinó que los escenarios utilizados son pertinentes para evaluar su resiliencia" },
  { orden: 7, inciso: "S2 22(b)(i)(6)", control: "enum_multi", opciones: HORIZONTES_OPC,
    tipoDatoLabel: LABEL_ENUM, pendienteValidacion: false,
    texto: "Horizontes temporales utilizados en el análisis" },
  { orden: 8, inciso: "S2 22(b)(i)(7)", control: "texto", tipoDatoLabel: LABEL_TEXTO,
    pendienteValidacion: false,
    texto: "Alcance de las operaciones cubierto por el análisis (por ejemplo, las sedes operativas y las unidades de negocio utilizadas en el análisis)" },
];

// -----------------------------------------------------------------------------
// S2 22(b)(ii) — Supuestos clave del análisis de escenarios climáticos.
//   orden 1-5: supuestos (ii)(1)-(ii)(5). orden 6: "Otros supuestos" (cierre).
//   Todos bloque de texto.
// -----------------------------------------------------------------------------
const S2_22BII: PreguntaCuestionario[] = [
  { orden: 1, inciso: "S2 22(b)(ii)(1)", control: "texto", tipoDatoLabel: LABEL_TEXTO,
    pendienteValidacion: false,
    texto: "Supuestos sobre políticas climáticas en las jurisdicciones en las que opera la entidad" },
  { orden: 2, inciso: "S2 22(b)(ii)(2)", control: "texto", tipoDatoLabel: LABEL_TEXTO,
    pendienteValidacion: false,
    texto: "Supuestos sobre tendencias macroeconómicas" },
  { orden: 3, inciso: "S2 22(b)(ii)(3)", control: "texto", tipoDatoLabel: LABEL_TEXTO,
    pendienteValidacion: false,
    texto: "Supuestos sobre variables nacionales o regionales (por ejemplo, patrones climáticos locales, demografía, uso del suelo, infraestructuras y disponibilidad de recursos naturales)" },
  { orden: 4, inciso: "S2 22(b)(ii)(4)", control: "texto", tipoDatoLabel: LABEL_TEXTO,
    pendienteValidacion: false,
    texto: "Supuestos sobre el uso y la combinación de fuentes de energía" },
  { orden: 5, inciso: "S2 22(b)(ii)(5)", control: "texto", tipoDatoLabel: LABEL_TEXTO,
    pendienteValidacion: false,
    texto: "Supuestos sobre desarrollos tecnológicos" },
  { orden: 6, inciso: "S2 22(b)(ii)", control: "texto", tipoDatoLabel: LABEL_TEXTO,
    pendienteValidacion: false,
    texto: "Otros supuestos" },
];

// -----------------------------------------------------------------------------
// S2 36(e)(i)-(iv) — Créditos de carbono. VERBATIM de la plantilla (A3:A7).
//   Bloques de texto; el "Tipo de dato" se captura libre en esta hoja (sin
//   tipoDatoLabel) — sin cambios respecto de la versión anterior.
// -----------------------------------------------------------------------------
const S2_36E: PreguntaCuestionario[] = [
  { orden: 1, inciso: "S2 36(e)(i)", control: "texto", pendienteValidacion: false,
    texto: "En qué medida, y de qué manera, el logro de cualquier objetivo de emisiones netas de gases de efecto invernadero se basa en el uso de créditos de carbono" },
  { orden: 2, inciso: "S2 36(e)(ii)", control: "texto", pendienteValidacion: false,
    texto: "Régimen o regímenes de terceros que verificarán o certificarán los créditos de carbono" },
  { orden: 3, inciso: "S2 36(e)(iii)", control: "texto", pendienteValidacion: false,
    texto: "El crédito de carbono subyacente a la compensación se basará en la naturaleza o en la eliminación tecnológica de carbono" },
  { orden: 4, inciso: "S2 36(e)(iii)", control: "texto", pendienteValidacion: false,
    texto: "El crédito de carbono subyacente se compensa mediante la reducción o eliminación de carbono" },
  { orden: 5, inciso: "S2 36(e)(iv)", control: "texto", pendienteValidacion: false,
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
