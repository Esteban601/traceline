#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Compara el Excel de taxonomía de antes de v40 con el de después y clasifica
// cada celda distinta como ESPERADA o NO ESPERADA (encargo
// 2026-10-11-suplemento-a-produccion, Paso 4). Copia de comparar-excel-v33.mjs
// con dos cambios: v40 no renombra hojas, y la columna D del índice de ANTES
// también puede ser la descripción del catálogo, porque las 18 filas de incisos
// de la plantilla desplazan la hoja.
//
//   node scripts/ensayo/comparar-excel-v40.mjs <antes.xlsx> <despues.xlsx> \
//        --plantilla-antes <taxonomia-base de v39> --plantilla-despues <la de v40> \
//        --catalogo <catalogo.json>
//
// <catalogo.json> es {codigo: descripcion} de datapoints_taxonomia activos de la
// base de la que salió <despues.xlsx> (códigos con trim, como el export).
//
// Qué cuenta como esperado, y nada más:
//   · Hojas: las tres que v33 renombra (migraciones 121100 y 121200) se emparejan
//     por su nombre nuevo; el resto, por nombre. El orden y la lista de hojas de
//     cada libro tienen que ser los de su plantilla.
//   · Una celda cuyo valor ANTES es el de la plantilla de main y DESPUÉS el de la
//     plantilla de dev: es texto de la plantilla, no dato de la emisora.
//   · En la hoja índice, columna D de la primera fila de cada código: DESPUÉS
//     debe ser la descripción del catálogo para ese código (el export de dev la
//     escribe desde la base, no desde la plantilla).
//   · El pie «Generado por TRACELINE — <fecha>…»: cambia la fecha, o se mueve de
//     fila sin cambiar de texto.
// Cualquier otra diferencia es NO ESPERADA. Sale con 1 si hay alguna.
// -----------------------------------------------------------------------------
import ExcelJS from "exceljs";

const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); if (i === -1) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const plantillaAntesArch = opcion("--plantilla-antes");
const plantillaDespuesArch = opcion("--plantilla-despues");
const catalogoArch = opcion("--catalogo");
const [antesArch, despuesArch] = argv;
if (!antesArch || !despuesArch || !plantillaAntesArch || !plantillaDespuesArch || !catalogoArch) {
  console.error("Uso: comparar-excel-v40.mjs <antes.xlsx> <despues.xlsx> --plantilla-antes <x> --plantilla-despues <x> --catalogo <json>");
  process.exit(2);
}

// v40 no renombra hojas (los renombres de v33 ya están en staging): se emparejan por nombre.
const HOJA_INDICE_DESPUES = "Taxonomía NIIF S1 S2";
const RENOMBRES = {};
const PIE = /^string:Generado por TRACELINE — (.+)$/;

/** Igual que comparar-excel.mjs: el valor de una celda como cadena comparable. */
function normalizar(valor) {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return `fecha:${valor.toISOString()}`;
  if (typeof valor !== "object") return `${typeof valor}:${valor}`;
  if (Array.isArray(valor.richText)) return `texto:${valor.richText.map((r) => r.text).join("")}`;
  if ("formula" in valor || "sharedFormula" in valor) return `formula:${valor.formula ?? valor.sharedFormula}=${normalizar(valor.result)}`;
  if ("hyperlink" in valor) return `vinculo:${valor.hyperlink}|${normalizar(valor.text)}`;
  if ("error" in valor) return `error:${valor.error}`;
  return `objeto:${JSON.stringify(valor)}`;
}
const textoPlano = (v) => v.replace(/^(string|texto):/, "").replace(/\s+/g, " ").trim();

function celdas(hoja) {
  const mapa = new Map();
  if (!hoja) return mapa;
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    fila.eachCell({ includeEmpty: false }, (celda) => {
      if (celda.isMerged && celda.master && celda.master.address !== celda.address) return;
      const valor = normalizar(celda.value);
      if (valor) mapa.set(celda.address, valor);
    });
  });
  return mapa;
}

async function leer(archivo) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(archivo);
  return libro;
}

const [antes, despues, plAntes, plDespues] = await Promise.all(
  [antesArch, despuesArch, plantillaAntesArch, plantillaDespuesArch].map(leer)
);
const catalogo = new Map(Object.entries(JSON.parse(await (await import("node:fs/promises")).readFile(catalogoArch, "utf8"))));

const esperadas = new Map(); // motivo → cuántas
const noEsperadas = [];
const esperada = (motivo) => esperadas.set(motivo, (esperadas.get(motivo) ?? 0) + 1);

// 1. Hojas: cada libro, con la lista y el orden de su plantilla.
const nombres = (l) => l.worksheets.map((h) => h.name).join(" | ");
if (nombres(antes) !== nombres(plAntes)) noEsperadas.push(`hojas de ANTES ≠ plantilla de main: [${nombres(antes)}]`);
if (nombres(despues) !== nombres(plDespues)) noEsperadas.push(`hojas de DESPUÉS ≠ plantilla de dev: [${nombres(despues)}]`);
for (const h of antes.worksheets) {
  const destino = RENOMBRES[h.name] ?? h.name;
  if (!despues.getWorksheet(destino)) noEsperadas.push(`la hoja «${h.name}» no tiene par «${destino}» después`);
  else if (destino !== h.name) esperada(`hoja renombrada «${h.name}» → «${destino}»`);
}
for (const h of despues.worksheets) {
  const origen = Object.entries(RENOMBRES).find(([, d]) => d === h.name)?.[0] ?? h.name;
  if (!antes.getWorksheet(origen)) noEsperadas.push(`hoja nueva sin par antes: «${h.name}»`);
}

// 2. Celda por celda en cada par de hojas.
let comparadas = 0;
for (const hA of antes.worksheets) {
  const nombreD = RENOMBRES[hA.name] ?? hA.name;
  const hD = despues.getWorksheet(nombreD);
  if (!hD) continue;
  const a = celdas(hA), d = celdas(hD);
  const pa = celdas(plAntes.getWorksheet(hA.name)), pd = celdas(plDespues.getWorksheet(nombreD));
  const indice = nombreD === HOJA_INDICE_DESPUES;

  // En el índice, la columna D esperada de la primera fila de cada código sale
  // del catálogo, como en escribirRequisitos() del export.
  // v40: la plantilla inserta 18 filas de incisos y desplaza el índice, así que
  // la columna D de ANTES también puede ser la descripción del catálogo para el
  // código que esa fila tenía antes (los códigos existentes no cambian de
  // descripción en v40: la migración del catálogo solo inserta).
  const catalogoDe = (hoja) => {
    const m = new Map();
    if (!indice) return m;
    const vistos = new Set();
    hoja.eachRow((_f, nf) => {
      if (nf === 1) return;
      const codigo = textoPlano(normalizar(hoja.getCell(`B${nf}`).value));
      if (!codigo || vistos.has(codigo)) return;
      vistos.add(codigo);
      if (catalogo.has(codigo)) m.set(`D${nf}`, catalogo.get(codigo));
    });
    return m;
  };
  const dCatalogo = catalogoDe(hD);
  const dCatalogoAntes = catalogoDe(hA);

  for (const dir of new Set([...a.keys(), ...d.keys()])) {
    comparadas++;
    const va = a.get(dir) ?? "", vd = d.get(dir) ?? "";
    if (va === vd) continue;
    const lugar = `${hA.name === nombreD ? nombreD : `${hA.name}→${nombreD}`}!${dir}`;

    const pieA = va.match(PIE), pieD = vd.match(PIE);
    if (pieA && pieD) { esperada("pie: fecha"); continue; }
    if ((pieA && !vd && [...d.values()].includes(va)) || (pieD && !va && [...a.values()].includes(vd))) { esperada("pie: cambia de fila"); continue; }

    const antesDelCatalogo = indice && dCatalogoAntes.has(dir) && textoPlano(va) === textoPlano(dCatalogoAntes.get(dir));
    const antesEsPlantilla = va === (pa.get(dir) ?? "") || antesDelCatalogo;
    if (indice && dCatalogo.has(dir)) {
      if (antesEsPlantilla && textoPlano(vd) === textoPlano(dCatalogo.get(dir))) { esperada("índice: descripción del catálogo (col. D)"); continue; }
    } else if (antesEsPlantilla && vd === (pd.get(dir) ?? "")) {
      esperada(indice ? (antesDelCatalogo ? "índice: descripción del catálogo → texto de la plantilla (fila desplazada)" : "índice: texto de la plantilla") : "texto de la plantilla (títulos y encabezados)");
      continue;
    }
    noEsperadas.push(`${lugar}: «${va.slice(0, 120)}» → «${vd.slice(0, 120)}»`);
  }
}

const totalEsperadas = [...esperadas.values()].reduce((s, n) => s + n, 0);
console.log(`${antes.worksheets.length}→${despues.worksheets.length} hojas · ${comparadas} celdas comparadas · ${totalEsperadas} diferencias esperadas · ${noEsperadas.length} no esperadas`);
for (const [motivo, n] of esperadas) console.log(`  esperada  ${String(n).padStart(4)}  ${motivo}`);
for (const x of noEsperadas.slice(0, 60)) console.log(`  ✗ NO ESPERADA  ${x}`);
if (noEsperadas.length > 60) console.log(`  … y ${noEsperadas.length - 60} más`);
process.exit(noEsperadas.length ? 1 : 0);
