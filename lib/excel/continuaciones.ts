/**
 * Filas de continuación de la hoja «Taxonomía NIIF S1 S2» (la 2.ª, 3.ª… fila con el mismo código, que piden un
 * inciso): su respuesta propia del Formato (`fila:N`) o la de su fila madre (las de NIIF S1 bajo E5 llevan su
 * remisión). Encargo formato-respuesta-por-inciso, Fase 2; antes quedaban vacías. Índice 1 = la segunda fila del código.
 */
export const CONTINUACIONES: Record<string, Record<number, string>> = {
  "NIIF S2 16(a)": { 1: "fila:87", 2: "fila:89" },
  "NIIF S2 16(d)": { 1: "fila:99" },
  "NIIF S1 35(a)": { 1: "madre", 2: "madre" },
  "NIIF S1 35(d)": { 1: "madre" },
};
