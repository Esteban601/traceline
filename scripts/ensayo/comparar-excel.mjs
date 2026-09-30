#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Comparador de libros Excel celda por celda (paso 4e del encargo rol auditor).
//
//   node scripts/ensayo/comparar-excel.mjs <antes.xlsx> <despues.xlsx>
//
// Compara hojas (nombres y orden), y en cada hoja cada celda con contenido de
// cualquiera de los dos libros: valor y nota, por hoja y dirección. No compara
// bytes: un libro regenerado difiere en bytes por las marcas de tiempo del zip
// y de docProps aunque su contenido sea idéntico. Tampoco compara estilos.
//
// Sale con código 0 si los libros son iguales y 1 si no; imprime hasta 40
// diferencias con su hoja y dirección.
// -----------------------------------------------------------------------------
import ExcelJS from "exceljs";

const [archivoA, archivoB] = process.argv.slice(2);
if (!archivoA || !archivoB) {
  console.error("Uso: node scripts/ensayo/comparar-excel.mjs <antes.xlsx> <despues.xlsx>");
  process.exit(2);
}

/** Reduce el valor de una celda de ExcelJS a una cadena comparable. */
function normalizar(valor) {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return `fecha:${valor.toISOString()}`;
  if (typeof valor !== "object") return `${typeof valor}:${valor}`;
  if (Array.isArray(valor.richText)) return `texto:${valor.richText.map((r) => r.text).join("")}`;
  if ("formula" in valor || "sharedFormula" in valor) {
    return `formula:${valor.formula ?? valor.sharedFormula}=${normalizar(valor.result)}`;
  }
  if ("hyperlink" in valor) return `vinculo:${valor.hyperlink}|${normalizar(valor.text)}`;
  if ("error" in valor) return `error:${valor.error}`;
  return `objeto:${JSON.stringify(valor)}`;
}

function normalizarNota(nota) {
  if (!nota) return "";
  if (typeof nota === "string") return nota;
  if (Array.isArray(nota.texts)) return nota.texts.map((t) => t.text).join("");
  return JSON.stringify(nota);
}

/** Mapa dirección → {valor, nota} de las celdas con contenido de una hoja. */
function celdas(hoja) {
  const mapa = new Map();
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    fila.eachCell({ includeEmpty: false }, (celda) => {
      // Las celdas combinadas repiten el valor de la maestra; se compara solo la
      // maestra para no contar la misma diferencia varias veces.
      if (celda.isMerged && celda.master && celda.master.address !== celda.address) return;
      const valor = normalizar(celda.value);
      const nota = normalizarNota(celda.note);
      if (valor || nota) mapa.set(celda.address, { valor, nota });
    });
  });
  return mapa;
}

async function leer(archivo) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(archivo);
  return libro;
}

const [libroA, libroB] = await Promise.all([leer(archivoA), leer(archivoB)]);
const hojasA = libroA.worksheets.map((h) => h.name);
const hojasB = libroB.worksheets.map((h) => h.name);

const diferencias = [];
if (hojasA.join("\u0000") !== hojasB.join("\u0000")) {
  diferencias.push(`hojas distintas: [${hojasA.join(", ")}] vs [${hojasB.join(", ")}]`);
}

let celdasComparadas = 0;
let notasComparadas = 0;
for (const nombre of hojasA.filter((n) => hojasB.includes(n))) {
  const a = celdas(libroA.getWorksheet(nombre));
  const b = celdas(libroB.getWorksheet(nombre));
  for (const dir of new Set([...a.keys(), ...b.keys()])) {
    const ca = a.get(dir) ?? { valor: "", nota: "" };
    const cb = b.get(dir) ?? { valor: "", nota: "" };
    celdasComparadas++;
    if (ca.nota || cb.nota) notasComparadas++;
    if (ca.valor !== cb.valor) diferencias.push(`${nombre}!${dir} valor: «${ca.valor}» → «${cb.valor}»`);
    if (ca.nota !== cb.nota) diferencias.push(`${nombre}!${dir} nota: «${ca.nota}» → «${cb.nota}»`);
  }
}

console.log(
  `${hojasA.length} hojas · ${celdasComparadas} celdas con contenido · ${notasComparadas} con nota`
);
if (diferencias.length === 0) {
  console.log("✓ libros idénticos celda por celda (valor, hoja, dirección y nota)");
  process.exit(0);
}
console.log(`✗ ${diferencias.length} diferencia(s):`);
for (const d of diferencias.slice(0, 40)) console.log(`  · ${d}`);
if (diferencias.length > 40) console.log(`  … y ${diferencias.length - 40} más`);
process.exit(1);
