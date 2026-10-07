#!/usr/bin/env node
// =============================================================================
// HOJA DE TAXONOMÍA: FILAS DE LOS INCISOS (catálogo partido, 7 de octubre de 2026;
// migración 20261007170000_catalogo_incisos).
//
//   node scripts/catalogo/partir-incisos-xlsx.mjs [--escribir]
//
// Inserta en «Taxonomía NIIF S1 S2» de assets/taxonomia-base.xlsx una fila por
// inciso debajo de cada código agrupado (y de sus preguntas de captura). La fila
// agrupada y sus preguntas se quedan. La columna B lleva el código; la D la
// escribe el export desde el catálogo (export-taxonomia/route.ts).
//
// Los merges son verticales (A: sección del índice, B: código, C: ODS): se
// quitan, se insertan las filas de abajo hacia arriba y se vuelven a poner
// desplazados o ampliados (un merge que contiene la fila agrupada se amplía).
// Antes de escribir se comprueba celda por celda que todo el contenido anterior
// está en su fila desplazada. Sin --escribir solo reporta. Idempotente: si ya
// están las filas, no hace nada.
// =============================================================================
import ExcelJS from "exceljs";

const RUTA = "assets/taxonomia-base.xlsx";
const HOJA = "Taxonomía NIIF S1 S2";
const INCISOS = {
  "NIIF S1 44 (a)(i)a(v)": ["NIIF S1 44 (a)(i)", "NIIF S1 44 (a)(ii)", "NIIF S1 44 (a)(iii)", "NIIF S1 44 (a)(iv)", "NIIF S1 44 (a)(v)"],
  "NIIF S2 25 (a)(i)a(v)": ["NIIF S2 25 (a)(i)", "NIIF S2 25 (a)(ii)", "NIIF S2 25 (a)(iii)", "NIIF S2 25 (a)(iv)", "NIIF S2 25 (a)(v)"],
  "NIIF S2 36 (a)a(d)": ["NIIF S2 36 (a)", "NIIF S2 36 (b)", "NIIF S2 36 (c)", "NIIF S2 36 (d)"],
  "NIIF S2 36 (e)(i)a(iv)": ["NIIF S2 36 (e)(i)", "NIIF S2 36 (e)(ii)", "NIIF S2 36 (e)(iii)", "NIIF S2 36 (e)(iv)"],
};
const escribir = process.argv.includes("--escribir");
const texto = (v) => (v && typeof v === "object" && "richText" in v ? v.richText.map((r) => r.text).join("") : v == null ? "" : String(v)).replace(/\s+/g, " ").trim();

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(RUTA);
const ws = wb.getWorksheet(HOJA);
const COLS = 4;
const codigoDe = (n) => texto(ws.getCell(n, 2).value);

const yaEstan = Object.values(INCISOS).flat().filter((c) => { let hay = false; ws.eachRow((_, n) => { if (codigoDe(n) === c) hay = true; }); return hay; });
if (yaEstan.length) { console.log(`Ya están ${yaEstan.length} filas de incisos: no se hace nada.`); process.exit(0); }

// Fila tras la que se inserta: la última fila del código agrupado (con sus preguntas).
const puntos = Object.entries(INCISOS).map(([agrupado, codigos]) => {
  let ultima = 0;
  ws.eachRow((_, n) => { if (codigoDe(n) === agrupado) ultima = n; });
  if (!ultima) throw new Error(`No está ${agrupado} en la hoja`);
  return { agrupado, codigos, despues: ultima };
}).sort((a, b) => b.despues - a.despues);

// Foto antes: valores y estilos por fila.
const total = ws.rowCount;
const antes = [];
for (let n = 1; n <= total; n++) antes[n] = Array.from({ length: COLS }, (_, c) => texto(ws.getCell(n, c + 1).value));
const merges = [...ws.model.merges].map((m) => {
  const [a, b] = m.split(":");
  const p = (x) => ({ col: x.replace(/\d+/g, ""), fila: Number(x.replace(/[A-Z]+/g, "")) });
  return { c1: p(a).col, r1: p(a).fila, c2: p(b).col, r2: p(b).fila };
});
for (const m of [...ws.model.merges]) ws.unMergeCells(m);

let desplazados = merges.map((m) => ({ ...m }));
for (const { agrupado, codigos, despues } of puntos) {
  const k = codigos.length;
  ws.spliceRows(despues + 1, 0, ...codigos.map(() => []));
  const modelo = ws.getRow(despues);
  codigos.forEach((codigo, i) => {
    const fila = ws.getRow(despues + 1 + i);
    for (let c = 1; c <= COLS; c++) fila.getCell(c).style = JSON.parse(JSON.stringify(modelo.getCell(c).style ?? {}));
    fila.height = modelo.height;
    fila.getCell(2).value = codigo;
  });
  desplazados = desplazados.map((m) =>
    m.r1 > despues ? { ...m, r1: m.r1 + k, r2: m.r2 + k } : m.r1 <= despues && despues < m.r2 ? { ...m, r2: m.r2 + k } : m
  );
  console.log(`+${k} filas tras la ${despues} (${agrupado})`);
}
for (const m of desplazados) ws.mergeCells(`${m.c1}${m.r1}:${m.c2}${m.r2}`);

// Verificación celda por celda: cada fila original en su lugar desplazado.
const corrimiento = (n) => puntos.filter((p) => n > p.despues).reduce((s, p) => s + p.codigos.length, 0);
let distintas = 0;
for (let n = 1; n <= total; n++) {
  const nueva = n + corrimiento(n);
  for (let c = 0; c < COLS; c++) {
    // Las celdas no superiores de un merge se leen como el valor del merge: se comparan solo las que tenían valor propio.
    const v = texto(ws.getCell(nueva, c + 1).value);
    if (antes[n][c] && v !== antes[n][c]) distintas++;
  }
}
const nuevas = Object.values(INCISOS).flat().length;
console.log(`filas ${total} → ${ws.rowCount} (+${nuevas}) · merges ${merges.length} → ${ws.model.merges.length} · celdas que no coinciden: ${distintas}`);
if (distintas || ws.model.merges.length !== merges.length || ws.rowCount !== total + nuevas) { console.error("✗ No se escribe: la verificación falló."); process.exit(1); }
if (escribir) { await wb.xlsx.writeFile(RUTA); console.log(`✓ Escrito ${RUTA}`); } else console.log("(sin --escribir: no se tocó el archivo)");
