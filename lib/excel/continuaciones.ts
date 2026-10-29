/**
 * Filas de un código en la hoja «Taxonomía NIIF S1 S2» que piden una parte del requisito. Índice 1 = la segunda fila con
 * requisito del código; índice 0, la primera, que si está aquí deja de llevar la respuesta completa del código (que
 * repetiría lo que dicen las demás) y toma solo su parte, como en el Formato. Cada una toma:
 *   · «fila:N»: la respuesta propia del Formato con esa clave;
 *   · «K:N»: el valor que el Formato electrónico escribe en su fila N del mapeo (booleanos y sus ramas, con las mismas
 *     reglas: rama cerrada, vacía);
 *   · «madre»: la respuesta de la primera fila del código (las de NIIF S1 bajo E5 llevan su remisión).
 * Encargo formato-respuesta-por-inciso, Fases 2 y 3; antes quedaban vacías.
 */
export const CONTINUACIONES: Record<string, Record<number, string>> = {
  // Fase 2 · NIIF S2 16 y NIIF S1 35.
  "NIIF S2 16(a)": { 0: "fila:85", 1: "fila:87", 2: "fila:89" },
  "NIIF S2 16(d)": { 0: "fila:96", 1: "fila:98" },
  "NIIF S1 35(a)": { 1: "madre", 2: "madre" },
  "NIIF S1 35(d)": { 1: "madre" },
  // Fase 3 · NIIF S1 bajo E5: la remisión de la fila madre.
  "NIIF S1 27(a)": { 1: "madre" },
  "NIIF S1 27(a)(v)": { 1: "madre", 2: "madre", 3: "madre" },
  "NIIF S1 27(b)(i)": { 1: "madre", 2: "madre", 3: "madre" },
  "NIIF S1 44 (a)(vi)": { 1: "madre", 2: "madre" },
  // Fase 3 · booleanos de NIIF S2 y sus ramas, como el Formato (K38–K41, K44–K47, K49–K52, K134–K137, K696–K699,
  // K704–K707, K535–K536). La rama «Si» de 36(e) (f275) no tiene fila en el Formato: queda vacía.
  // La primera fila de estos códigos toma la celda del Formato que contesta su pregunta (K36, o el booleano), y las
  // ramas dan el cómo o el porqué: así ninguna fila del código repite a otra.
  "NIIF S2 6 (a)(v)": { 0: "fila:36", 1: "K:38", 2: "K:39", 3: "K:41" },
  "NIIF S2 6(b)(i)": { 0: "K:44", 1: "K:45", 2: "K:47" },
  "NIIF S2 6(b)(ii)": { 0: "K:49", 1: "K:50", 2: "K:52" },
  "NIIF S2 25 (a)(vi)": { 0: "K:134", 1: "K:135", 2: "K:137" },
  "NIIF S2 29 (f) (i) y (ii)": { 0: "K:417", 1: "K:418", 2: "K:420" },
  "NIIF S2 29 (g) (i) y (ii)": { 0: "K:425", 1: "K:426", 2: "K:428" },
  "NIIF S2 36 (e)(i)a(iv)": { 1: "K:256", 2: "K:257" },
};
