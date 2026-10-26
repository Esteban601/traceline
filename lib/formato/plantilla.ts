import { aliviosVigentes, type Alivios } from "@/lib/perfil-emisor";

// =============================================================================
// Plantilla del Formato electrónico NIIF S1/S2 (encargo 2026-10-13, Paso 4).
//
// No está en git: trae los textos de la norma («Consideraciones para el
// llenado») y sale del formato de referencia de una emisora real (CLAUDE.md §4).
// La arma `scripts/formato/preparar-plantilla.mjs` —sin las respuestas de la
// referencia, a nivel zip para conservar las imágenes en celda— y una persona la
// sube a Storage en cada ambiente; el export la lee de aquí con service role. Un
// formato nuevo de la BMV es una ruta nueva.
// =============================================================================

export const RUTA_PLANTILLA_FORMATO = "plantillas/formato-electronico/2025/plantilla.xlsx";
export const HOJA_ESTRUCTURA = "Estructura Formato Electronico";
/** Tablas-plantilla de la BMV como imágenes en celda en el formato 2025. */
export const IMAGENES_EN_CELDA = 23;

/** Hoja «Leyenda» del formato (revisión externa): qué sale de dónde, alivios y «No aplica por actividad». */
export function leyendaDelFormato(alivios: Alivios, actividades: string[]): [string, string][] {
  return [
    ["Leyenda", ""],
    ["Columna «Respuesta» (K)", "Se llena desde el último documento del Suplemento NIIF S1/S2 APROBADO de la emisora: las narrativas resumen la sección aprobada que responde cada concepto; las cifras salen de capturas validadas; la identificación, del Perfil del emisor."],
    ["Celda vacía", "Tres casos: el concepto es un encabezado; se responde junto con la fila anterior; o falta un dato de la emisora (un pendiente), que se resuelve en la plataforma antes de presentar el formato. La revisión de IRStrat lista cada celda vacía con su caso."],
    ["«No aplica»", "El concepto no aplica en este ejercicio, por el régimen o por la condición de la emisora."],
    ["«No aplica por actividad»", `La sección de emisiones financiadas es de una actividad en la que la emisora no participa (actividades financieras del Perfil: ${actividades.join(", ") || "sin capturar"}).`],
    ["«No revelado · alivio C4»", "Alivio transitorio del primer año (NIIF S2 C4): no se revelan cifras de emisiones de Alcance 3, ni su total ni sus categorías, incluidas las emisiones financiadas."],
    ["«No revelado · alivio C3»", "Alivio transitorio del primer año (NIIF S2 C3): no se presentan comparativos del ejercicio anterior."],
    ["Oración del alivio E5", "Alivio transitorio del primer año (NIIF S1 E5): los conceptos de NIIF S1 se responden con la información sobre clima de su par de NIIF S2, precedida de la oración fija del alivio."],
    ["Métricas por industria (filas de riesgos y oportunidades)", "Si las métricas por industria podrían satisfacer los requerimientos es un juicio de la emisora, capturado en su Perfil y repetido en las tres filas. La plataforma todavía no incluye el catálogo SASB (Fase C)."],
    ["Hoja «Tabla NIIF»", "Riesgos y oportunidades relacionados con el clima, desde los registros de clima de la plataforma."],
    ["Hoja «Métricas SASB»", "Métricas por industria: pendiente de catálogo SASB (Fase C)."],
    ["Alivios de este reporte", aliviosVigentes(alivios)],
  ];
}
