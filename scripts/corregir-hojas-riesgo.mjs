#!/usr/bin/env node
// -----------------------------------------------------------------------------
// CORRIGE LA ETIQUETA DE LAS DOS HOJAS DE RIESGO Y LOS CÓDIGOS DE LA HOJA ÍNDICE.
//
// EL DIAGNÓSTICO. Las dos hojas eran coherentes consigo mismas —la de contenido
// físico hablaba de riesgos físicos en todas sus columnas, la de transición de
// transición— pero llevaban el código equivocado en el nombre de la pestaña y en
// su cabecera: NIIF S2 29(b) son los riesgos de TRANSICIÓN y 29(c) los FÍSICOS,
// y el párrafo 30 no es una revelación sino la exención por costo o esfuerzo
// desproporcionado. No hay cifras que mover: solo etiquetas que corregir.
//
// EL INTERCAMBIO DE PESTAÑAS VA EN TRES PASOS, por un nombre temporal, porque el
// destino de una es el nombre actual de la otra y Excel no admite dos hojas
// homónimas ni un instante.
//
// LA HOJA ÍNDICE usaba «NIIF S2 30» como código de las filas de cantidad,
// porcentaje y despliegue de capital de los TRES bloques. Cada fila se reasigna
// por el subtítulo bajo el que vive.
//
//   node scripts/corregir-hojas-riesgo.mjs [--revisar]
// -----------------------------------------------------------------------------
import ExcelJS from "exceljs";
import path from "node:path";

const PLANTILLA = path.join(process.cwd(), "assets", "taxonomia-base.xlsx");
const SOLO_REVISAR = process.argv.includes("--revisar");
const INDICE = "Taxonomía NIIF S1 S2";
const TEMPORAL = "__intercambio__";

const texto = (v) =>
  v === null || v === undefined
    ? ""
    : typeof v === "object" && "richText" in v
      ? v.richText.map((r) => r.text).join("")
      : typeof v === "object" && "result" in v
        ? String(v.result)
        : String(v);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(PLANTILLA);

// --- 1. Pestañas ------------------------------------------------------------
// El estado corregido se reconoce por lo que YA NO está: si no hay hoja
// «NIIF S2 30» y sí hay «NIIF S2 29(c)», el intercambio ya ocurrió. Sin esta
// comprobación el script se confunde al correrlo dos veces, porque el nombre de
// destino de una hoja es el nombre actual de la otra.
const yaCorregido = !wb.getWorksheet("NIIF S2 30") && !!wb.getWorksheet("NIIF S2 29(c)");
const fisicos = yaCorregido ? null : wb.getWorksheet("NIIF S2 29(b)");
const transicion = yaCorregido ? null : wb.getWorksheet("NIIF S2 30");
if (!yaCorregido && (!fisicos || !transicion)) {
  throw new Error("No se reconocen las dos hojas de riesgo en la plantilla.");
}

const A1_FISICOS =
  "NIIF S2 29(c) — Riesgos físicos relacionados con el clima: vulnerabilidad de activos y despliegue de capital";
const A1_TRANSICION =
  "NIIF S2 29(b) — Riesgos de transición relacionados con el clima: vulnerabilidad de activos y despliegue de capital";

if (yaCorregido) {
  console.log("pestañas: ya estaban corregidas");
} else {
  if (!SOLO_REVISAR) {
    fisicos.name = TEMPORAL;           // libera «NIIF S2 29(b)»
    transicion.name = "NIIF S2 29(b)"; // la de transición toma su código correcto
    fisicos.name = "NIIF S2 29(c)";    // y la de físicos, el suyo
    // A1 está combinada A1:K1: basta escribir la ancla.
    fisicos.getCell("A1").value = A1_FISICOS;
    transicion.getCell("A1").value = A1_TRANSICION;
  }
  console.log("pestañas:");
  console.log(`  físicos:    «NIIF S2 29(b)» → «NIIF S2 29(c)»`);
  console.log(`  transición: «NIIF S2 30»    → «NIIF S2 29(b)»`);
}

// --- 2. Hoja índice: reasignar los códigos por subtítulo ---------------------
const ws = wb.getWorksheet(INDICE);
const DESTINO = {
  "Riesgos de transición relacionados con el clima": "NIIF S2 29 (b)",
  "Riesgos físicos relacionados con el clima": "NIIF S2 29 (c)",
  "oportunidades relacionadas con el clima": "NIIF S2 29 (d)",
};
// Los códigos que hay que reasignar: «NIIF S2 30», que no es una revelación, y
// «NIIF S2 29 (b)» cuando aparece bajo el subtítulo de riesgos FÍSICOS.
const REASIGNABLES = new Set(["NIIF S2 30", "NIIF S2 29 (b)"]);

let sub = null;
const cambios = [];
ws.eachRow((_f, nf) => {
  const B = norm(texto(ws.getCell(`B${nf}`).value));
  const D = norm(texto(ws.getCell(`D${nf}`).value));
  if (!B && D) { sub = D; return; }
  if (!B || !REASIGNABLES.has(B)) return;
  const destino = DESTINO[sub];
  if (!destino || destino === B) return;
  cambios.push([nf, B, destino, sub]);
  if (!SOLO_REVISAR) ws.getCell(`B${nf}`).value = destino;
});
console.log(`\ncódigos reasignados en la hoja índice: ${cambios.length}`);
for (const [f, v, n, s] of cambios) console.log(`  fila ${String(f).padStart(3)}: «${v}» → «${n}»   (${s})`);

// --- 3. Las dos filas que faltaban ------------------------------------------
// De abajo hacia arriba: insertar arriba desplazaría el número de la de abajo.
const NUEVAS = [
  { tras: 179, codigo: "NIIF S2 B65 inciso (e)" },
  { tras: 17, codigo: "NIIF S1 27(b)(ii)" },
];
for (const nueva of NUEVAS) {
  const ya = [];
  ws.eachRow((_f, nf) => { if (norm(texto(ws.getCell(`B${nf}`).value)) === nueva.codigo) ya.push(nf); });
  if (ya.length) { console.log(`\n«${nueva.codigo}» ya tiene fila (${ya.join(", ")}): no se inserta.`); continue; }
  console.log(`\ninsertar «${nueva.codigo}» tras la fila ${nueva.tras}`);
  if (SOLO_REVISAR) continue;
  insertarFila(ws, nueva.tras + 1);
  const nf = nueva.tras + 1;
  // El estilo se copia de la fila de arriba para que la inserción no se note.
  const modelo = ws.getRow(nueva.tras);
  const fila = ws.getRow(nf);
  fila.height = modelo.height;
  for (const col of ["A", "B", "C", "D"]) {
    fila.getCell(col).style = { ...modelo.getCell(col).style };
  }
  // La columna A NO se escribe. La etiqueta de sección vive en un rango
  // COMBINADO que abarca todo el bloque (A16:A31 y equivalentes), y la fila
  // nueva cae dentro de él: escribir ahí no rellena una celda, reemplaza el
  // valor de las dieciséis. La fila hereda la sección de su bloque, que es lo
  // que se quiere.
  fila.getCell("B").value = nueva.codigo;
  // D se deja vacía a propósito: la escribe el export desde el catálogo.
}

/**
 * Inserta una fila vacía RESPETANDO LAS CELDAS COMBINADAS.
 *
 * `spliceRows` por sí solo deja la hoja ilegible: no reajusta los 98 rangos
 * combinados de esta hoja y el archivo resultante falla al abrirse con «Cannot
 * merge already merged cells». Hay que deshacerlos todos, insertar, y rehacerlos
 * con las filas corridas.
 *
 * Tres casos por rango, y el tercero es el que se olvida: un rango que EMPIEZA
 * antes del punto de inserción y TERMINA después no se desplaza, CRECE.
 */
function insertarFila(hoja, en) {
  const rangos = [...(hoja.model?.merges ?? [])];
  const partes = (r) => {
    const [a, b] = r.split(":");
    const fa = parseInt(a.replace(/[^0-9]/g, ""), 10);
    const fb = parseInt(b.replace(/[^0-9]/g, ""), 10);
    return { colA: a.replace(/[0-9]/g, ""), fa, colB: b.replace(/[0-9]/g, ""), fb };
  };

  for (const r of rangos) hoja.unMergeCells(r);
  hoja.spliceRows(en, 0, []);

  for (const r of rangos) {
    const { colA, fa, colB, fb } = partes(r);
    const na = fa >= en ? fa + 1 : fa;
    const nb = fb >= en ? fb + 1 : fb;
    hoja.mergeCells(`${colA}${na}:${colB}${nb}`);
  }
}

if (SOLO_REVISAR) { console.log("\n(--revisar: no se escribió nada)"); process.exit(0); }
await wb.xlsx.writeFile(PLANTILLA);
console.log("\nplantilla escrita.");
