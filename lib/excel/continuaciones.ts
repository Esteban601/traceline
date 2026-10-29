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
  // 104 (flujos previstos a corto, medio y largo plazo): la tabla por plazo del Formato (K99); K98 no tiene hechos sin fecha.
  "NIIF S2 16(d)": { 0: "fila:96", 1: "K:99" },
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
  // Fase 5 · NIIF S2 29(a)(iii) por inciso (f130–f133): enfoque, datos y supuestos, razón, cambios. La plantilla repite
  // las cuatro preguntas en f134–f137; esa copia queda vacía para no repetir texto (deuda conocida de la plantilla).
  "NIIF S2 29 (a)(iii)": { 0: "fila:317", 1: "fila:318", 2: "fila:320", 3: "K:322" },
  // Fase 5 · 29(e) por tipo: el despliegue de capital de cada tipo (f153, f162, f171), como K629, K652 y K675.
  "NIIF S2 29 (b)": { 1: "fila:350" },
  "NIIF S2 29 (c)": { 1: "fila:373" },
  "NIIF S2 29 (d)": { 1: "fila:396" },
};

/**
 * Marcador de §5 (texto plano en el Excel) cuando falta la respuesta de una continuación que sí debería tenerla. Las que
 * no están aquí quedan vacías si falta (por ejemplo, 29(e) de un tipo sin despliegue de capital en el libro).
 */
export const PENDIENTE_CONTINUACION: Record<string, string> = {
  "fila:320": "Pendiente: razón por la que se eligieron el enfoque de medición, los datos de entrada y los supuestos de GEI — hecho del bloque de métricas de GEI",
  "K:322": "Pendiente: respuesta de la emisora a esta pregunta — cuestionario NIIF S2 29(a)(iii)",
};
