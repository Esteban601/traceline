#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Lee por stdin la salida de `supabase migration list` y escribe
// «<filas leídas> <filas desalineadas>». Entiende las dos formas de la CLI: JSON
// (2.109) y tabla con «|» (anteriores). Una fila está desalineada cuando local y
// remoto no coinciden. Si no pudo leer ninguna fila escribe «0 0»: quien lo
// llama tiene que tratar 0 filas leídas como falla, no como «todo alineado».
// -----------------------------------------------------------------------------
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  let filas = [];
  try {
    filas = JSON.parse(s.slice(s.indexOf("{"))).migrations.map((m) => [m.local ?? "", m.remote ?? ""]);
  } catch {
    filas = s
      .split("\n")
      .map((l) => l.split("|").map((c) => c.trim()))
      .filter((c) => c.length >= 3 && /^\d+$/.test(c[0] || c[1]));
  }
  console.log(`${filas.length} ${filas.filter(([l, r]) => l !== r).length}`);
});
