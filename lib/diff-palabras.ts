// =============================================================================
// DIFF POR PALABRAS entre dos textos (historial de bloques del Suplemento,
// encargo suplemento-calidad, Paso 4).
//
// LCS sobre palabras y espacios: lo que el revisor quiere ver es qué frase
// cambió, no qué carácter. Un bloque son unas 600 palabras, así que la tabla
// cuadrática cabe de sobra; para textos más largos se recorta el prefijo y el
// sufijo comunes antes de comparar, que es donde suele estar casi todo.
// =============================================================================

export type Trozo = { tipo: "igual" | "quitado" | "agregado"; texto: string };

const partir = (t: string) => t.split(/(\s+)/).filter((x) => x.length > 0);

export function diffPalabras(antes: string, despues: string): Trozo[] {
  const a = partir(antes);
  const b = partir(despues);
  let ini = 0;
  while (ini < a.length && ini < b.length && a[ini] === b[ini]) ini++;
  let fa = a.length;
  let fb = b.length;
  while (fa > ini && fb > ini && a[fa - 1] === b[fb - 1]) { fa--; fb--; }

  const x = a.slice(ini, fa);
  const y = b.slice(ini, fb);
  const n = x.length;
  const m = y.length;
  // lcs[i][j] = longitud de la subsecuencia común de x[i..] y y[j..].
  const lcs: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: Trozo[] = [];
  const empujar = (tipo: Trozo["tipo"], texto: string) => {
    const ult = out[out.length - 1];
    if (ult && ult.tipo === tipo) ult.texto += texto;
    else out.push({ tipo, texto });
  };
  if (ini) empujar("igual", a.slice(0, ini).join(""));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { empujar("igual", x[i]); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { empujar("quitado", x[i]); i++; }
    else { empujar("agregado", y[j]); j++; }
  }
  while (i < n) empujar("quitado", x[i++]);
  while (j < m) empujar("agregado", y[j++]);
  if (fa < a.length) empujar("igual", a.slice(fa).join(""));
  return out;
}
