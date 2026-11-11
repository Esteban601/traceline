// =============================================================================
// DECLARACIÓN DE CUMPLIMIENTO DE LA EMISORA (NIIF S1 72; encargo
// s1-72-reserva-y-emisora, decisiones 2, 3 y 5).
//
// Vive en el reporte (`reportes.declaracion_cumplimiento` y `_texto`) y la
// escribe la emisora: el generador nunca la redacta. Va tal cual en el bloque 2,
// en NIIF S1 72 y en la fila 285 del Formato electrónico. Sin texto, el bloque 2
// lleva el marcador de pendiente y el documento no se aprueba (CLAUDE.md §5).
//
// El modo (con o sin reserva) decide la fila 286: con reserva, «No» siempre.
// =============================================================================

export type ModoDeclaracion = "sin_reserva" | "con_reserva";
export type Declaracion = { modo: ModoDeclaracion | null; texto: string | null };

export const MODOS_DECLARACION: { clave: ModoDeclaracion; titulo: string; ayuda: string }[] = [
  {
    clave: "sin_reserva",
    titulo: "Sin reserva",
    ayuda: "La emisora declara que cumple con todos los requerimientos de NIIF S1 y S2, explícitamente y sin reservas.",
  },
  {
    clave: "con_reserva",
    titulo: "Con reserva",
    ayuda: "La emisora no declara el cumplimiento total (p. ej., «preparado procurando el cumplimiento»). La fila 286 del Formato dice «No».",
  },
];

export const PENDIENTE_DECLARACION = "[Pendiente: declaración de cumplimiento de la emisora — Reportes, régimen del ejercicio]";

export function leerModoDeclaracion(x: unknown): ModoDeclaracion | null {
  return x === "sin_reserva" || x === "con_reserva" ? x : null;
}

/** La declaración de una fila de `reportes`: el texto sin espacios de sobra, o null. */
export function leerDeclaracion(rep: { declaracion_cumplimiento?: string | null; declaracion_cumplimiento_texto?: string | null } | null | undefined): Declaracion {
  const texto = (rep?.declaracion_cumplimiento_texto ?? "").trim();
  return { modo: leerModoDeclaracion(rep?.declaracion_cumplimiento), texto: texto || null };
}

/**
 * La declaración que vale para NIIF S1 72 y la fila 285: el texto de la emisora, si el bloque 2 aprobado lo lleva tal
 * cual. Si la declaración se cambió después de aprobar el bloque 2, null (pendiente hasta regenerar y reaprobar).
 */
export function declaracionVigente(decl: Declaracion, textoBloque2: string | null): string | null {
  if (!decl.texto || !textoBloque2) return null;
  return textoBloque2.includes(decl.texto) ? decl.texto : null;
}
