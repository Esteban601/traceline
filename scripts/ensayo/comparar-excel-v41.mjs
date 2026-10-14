#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Compara el Excel de taxonomía de antes de v41 con el de después y clasifica
// cada celda distinta como ESPERADA o NO ESPERADA (encargo
// 2026-10-14-excel-formato-a-produccion, Paso 1; diferencias de §2.2). Parte de
// comparar-excel-v40.mjs: v41 no cambia la plantilla ni el catálogo, así que el
// índice y las hojas de datos tienen que salir iguales salvo lo de abajo.
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//     scripts/ensayo/comparar-excel-v41.mjs <antes.xlsx> <despues.xlsx> \
//     --plantilla <assets/taxonomia-base.xlsx> --contexto <antes/contexto.json> --emisora <slug> [--respuestas]
//
// <contexto.json> lo deja comprobar-v41.mjs --antes: por emisora, generador,
// alivios vigentes, registros de clima y objetivos. --respuestas: la emisora ya
// tiene respuestas de un documento aprobado (POST …/respuestas, §2.3); sin él,
// la columna «Respuesta» solo puede decir «En preparación».
//
// Qué cuenta como esperado, y nada más:
//   · Hojas: las de ANTES son las de la plantilla; DESPUÉS, las mismas y en el
//     mismo orden, más «Leyenda» al final, con los alivios de la emisora.
//   · Índice «Taxonomía NIIF S1 S2», columna E (solo con el generador encendido):
//     «Respuesta» en E1 y, en la primera fila de cada código, «En preparación»
//     (o, con --respuestas, un texto que no empieza con «[» ni lleva
//     «[Pendiente»). Aparte, el nivel de esquema: 1 en las filas de los incisos
//     hijos con el generador encendido; 0 en todo lo demás, y 0 en ANTES.
//   · «NIIF S1 46-50»: filas de instancias de métricas (D «NIIF S2 párrafo
//     29(x)», G «No», H el texto fijo), donde ANTES había plantilla o nada; la
//     plantilla desplazada si hay más de 12 riesgos; la oración del alivio en A2
//     solo con E5. Sin registros de clima, ninguna instancia.
//   · «NIIF S1 51», solo con E5 y objetivos no climáticos: cada valor nuevo ya
//     estaba en la hoja de ANTES (salen los no climáticos; los demás suben).
//   · Hojas de datos, solo con C3/C4: «No revelado · alivio C3|C4» del alivio
//     vigente, y notas que pierden causas «Sin evidencia (año)» / «Pendiente de
//     validación en plataforma (año)» / «Sin solicitud en el reporte» sin ganar
//     ninguna.
//   · El pie «Generado por TRACELINE — <fecha>…»: cambia la fecha, se mueve de
//     fila sin cambiar de texto, o aparece en «NIIF S1 46-50» (ahora siempre se
//     escribe).
// Cualquier otra diferencia es NO ESPERADA. Sale con 1 si hay alguna.
// -----------------------------------------------------------------------------
import fs from "node:fs/promises";
import ExcelJS from "exceljs";
import { PADRE_DE } from "../../lib/suplemento/catalogo-incisos.ts";

const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); if (i === -1) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const bandera = (n) => { const i = argv.indexOf(n); if (i === -1) return false; argv.splice(i, 1); return true; };
const plantillaArch = opcion("--plantilla");
const contextoArch = opcion("--contexto");
const emisora = opcion("--emisora");
const conRespuestas = bandera("--respuestas");
const [antesArch, despuesArch] = argv;
if (!antesArch || !despuesArch || !plantillaArch || !contextoArch || !emisora) {
  console.error("Uso: comparar-excel-v41.mjs <antes.xlsx> <despues.xlsx> --plantilla <x> --contexto <json> --emisora <slug> [--respuestas]");
  process.exit(2);
}
const ctx = JSON.parse(await fs.readFile(contextoArch, "utf8"))[emisora];
if (!ctx) { console.error(`✗ ${contextoArch} no trae la emisora ${emisora}.`); process.exit(2); }
const alivio = (k) => ctx.alivios.includes(k);

const HOJA_INDICE = "Taxonomía NIIF S1 S2";
const HOJA_LEYENDA = "Leyenda";
const HOJA_METRICAS = "NIIF S1 46-50";
const HOJA_S51 = "NIIF S1 51";
// El nombre de la app cambia por ambiente (NEXT_PUBLIC_APP_NAME: «TRACELINE», «TRACELINE DEV»).
const PIE = /^string:Generado por TRACELINE[^—]* — (.+)$/;
const NO_REVELADO = /^string:No revelado · alivio (C3|C4)$/;
const CAUSA = /^(Sin evidencia \(\d{4}\)|Pendiente de validación en plataforma \(\d{4}\)|Sin solicitud en el reporte)$/;
// Plantilla de «NIIF S1 46-50»: 12 lugares de riesgos (filas 6–17), «OPORTUNIDADES» en la 18.
const FILA_OPORTUNIDADES = 18;
const FIJO_H = "No aplica: la métrica se toma sin ajuste de NIIF S2";

/** Igual que comparar-excel-v40.mjs: el valor de una celda como cadena comparable. */
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
const separar = (dir) => { const m = /^([A-Z]+)(\d+)$/.exec(dir); return { col: m[1], fila: Number(m[2]) }; };

async function leer(archivo) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(archivo);
  return libro;
}
const [antes, despues, plantilla] = await Promise.all([antesArch, despuesArch, plantillaArch].map(leer));

const esperadas = new Map(); // motivo → cuántas
const noEsperadas = [];
const esperada = (motivo) => esperadas.set(motivo, (esperadas.get(motivo) ?? 0) + 1);

// 1. Hojas: ANTES como la plantilla; DESPUÉS, igual más «Leyenda» al final.
const nombres = (l) => l.worksheets.map((h) => h.name);
const nPlantilla = nombres(plantilla).join(" | ");
if (nombres(antes).join(" | ") !== nPlantilla) noEsperadas.push(`hojas de ANTES ≠ plantilla: [${nombres(antes).join(" | ")}]`);
if (nombres(despues).join(" | ") !== `${nPlantilla} | ${HOJA_LEYENDA}`) noEsperadas.push(`hojas de DESPUÉS ≠ plantilla + «${HOJA_LEYENDA}»: [${nombres(despues).join(" | ")}]`);

// 2. «Leyenda»: hoja nueva, con los alivios de la emisora en la última fila.
const ley = despues.getWorksheet(HOJA_LEYENDA);
if (ley) {
  const c = celdas(ley);
  const alivios = ["C3", "C4", "E5"].filter(alivio).join(", ") || "Ninguno vigente en este ejercicio.";
  const ultima = Math.max(...[...c.keys()].map((d) => separar(d).fila));
  if (textoPlano(c.get("A1") ?? "") !== "Leyenda") noEsperadas.push(`${HOJA_LEYENDA}!A1 no es «Leyenda»`);
  else if (textoPlano(c.get(`A${ultima}`) ?? "") !== "Alivios de este reporte" || textoPlano(c.get(`B${ultima}`) ?? "") !== alivios) {
    noEsperadas.push(`${HOJA_LEYENDA}: la última fila no dice «Alivios de este reporte: ${alivios}»`);
  } else for (let i = 0; i < c.size; i++) esperada(`hoja «${HOJA_LEYENDA}» (alivios: ${alivios})`);
}

// 3. Índice: nivel de esquema de los incisos hijos (no es un valor de celda).
const hIA = antes.getWorksheet(HOJA_INDICE), hID = despues.getWorksheet(HOJA_INDICE);
const primeraDe = new Map(); // fila → código, solo la primera fila de cada código (DESPUÉS)
if (hID) {
  const vistos = new Set();
  hID.eachRow((_f, nf) => {
    if (nf === 1) return;
    const codigo = textoPlano(normalizar(hID.getCell(`B${nf}`).value));
    if (!codigo || vistos.has(codigo)) return;
    vistos.add(codigo);
    primeraDe.set(nf, codigo);
  });
  let hijos = 0;
  for (let nf = 1; nf <= hID.rowCount; nf++) {
    const debe = ctx.generador && Object.hasOwn(PADRE_DE, primeraDe.get(nf) ?? "") ? 1 : 0;
    const nivelD = hID.getRow(nf).outlineLevel ?? 0, nivelA = hIA?.getRow(nf).outlineLevel ?? 0;
    if (nivelA !== 0) noEsperadas.push(`${HOJA_INDICE}: la fila ${nf} ya tenía nivel de esquema ${nivelA} ANTES`);
    if (nivelD !== debe) noEsperadas.push(`${HOJA_INDICE}: la fila ${nf} (${primeraDe.get(nf) ?? "—"}) tiene nivel ${nivelD}; se esperaba ${debe}`);
    else if (debe) hijos++;
  }
  if (ctx.generador) {
    if (hijos !== Object.keys(PADRE_DE).length) noEsperadas.push(`${HOJA_INDICE}: ${hijos} incisos hijos con nivel 1; se esperaban ${Object.keys(PADRE_DE).length}`);
    else for (let i = 0; i < hijos; i++) esperada("índice: inciso hijo con nivel de esquema 1 (bajo su padre)");
  }
}

// 4. «NIIF S1 46-50»: dónde quedó «OPORTUNIDADES» dice cuántas filas se insertaron.
const hMD = despues.getWorksheet(HOJA_METRICAS);
let filaOpp = FILA_OPORTUNIDADES;
if (hMD) hMD.eachRow((f, nf) => { if (textoPlano(normalizar(f.getCell(1).value)) === "OPORTUNIDADES") filaOpp = nf; });
const extra = filaOpp - FILA_OPORTUNIDADES;
const esInstancia = (hoja, nf) => {
  const v = (c) => textoPlano(normalizar(hoja.getCell(`${c}${nf}`).value));
  return /^NIIF S2 párrafo 29\([a-e]\)$/.test(v("D")) && v("G") === "No" && v("H") === FIJO_H && !!v("A");
};
const filasInstancia = new Set();
if (hMD) hMD.eachRow((_f, nf) => { if (nf > 5 && nf !== filaOpp && esInstancia(hMD, nf)) filasInstancia.add(nf); });
if (ctx.registros === 0 && filasInstancia.size) noEsperadas.push(`${HOJA_METRICAS}: ${filasInstancia.size} instancias sin registros de clima`);
if (ctx.registros > 0 && !filasInstancia.size) noEsperadas.push(`${HOJA_METRICAS}: sin instancias con ${ctx.registros} registros de clima`);

// 5. Celda por celda.
let comparadas = 0;
for (const hA of antes.worksheets) {
  const hD = despues.getWorksheet(hA.name);
  if (!hD) { noEsperadas.push(`la hoja «${hA.name}» no está DESPUÉS`); continue; }
  const a = celdas(hA), d = celdas(hD), p = celdas(plantilla.getWorksheet(hA.name));
  const valoresAntes = new Set(a.values());
  const tienePieAntes = [...a.values()].some((v) => PIE.test(v));

  for (const dir of new Set([...a.keys(), ...d.keys()])) {
    comparadas++;
    const va = a.get(dir) ?? "", vd = d.get(dir) ?? "";
    if (va === vd) continue;
    const { col, fila } = separar(dir);
    const lugar = `${hA.name}!${dir}`;
    const antesEsPlantilla = va === "" || va === (p.get(dir) ?? "");

    // Pie.
    const pieA = va.match(PIE), pieD = vd.match(PIE);
    if (pieA && pieD) { esperada("pie: fecha"); continue; }
    if ((pieA && !vd && [...d.values()].includes(va)) || (pieD && !va && [...a.values()].includes(vd))) { esperada("pie: cambia de fila"); continue; }
    if (pieD && !va && hA.name === HOJA_METRICAS && !tienePieAntes) { esperada(`pie nuevo en «${HOJA_METRICAS}»`); continue; }
    if (pieA && !vd && hA.name === HOJA_METRICAS) {
      // El pie de ANTES se movió y además cambió la fecha.
      if ([...d.values()].some((x) => PIE.test(x))) { esperada("pie: cambia de fila"); continue; }
    }

    // Índice, columna E.
    if (hA.name === HOJA_INDICE && col === "E" && ctx.generador && antesEsPlantilla) {
      if (fila === 1 && textoPlano(vd) === "Respuesta") { esperada("índice: encabezado «Respuesta» (E1)"); continue; }
      if (primeraDe.has(fila)) {
        const t = textoPlano(vd);
        if (t === "En preparación") { esperada("índice: «En preparación» (columna E)"); continue; }
        if (conRespuestas && t && !t.startsWith("[") && !t.includes("[Pendiente")) { esperada("índice: respuesta del documento aprobado (columna E)"); continue; }
      }
    }

    // «NIIF S1 46-50».
    if (hA.name === HOJA_METRICAS) {
      if (dir === "A2" && alivio("E5") && antesEsPlantilla && vd) { esperada("S1 46-50: oración del alivio E5 (A2)"); continue; }
      if (filasInstancia.has(fila) && antesEsPlantilla && "ABCDEFGHIJK".includes(col)) { esperada("S1 46-50: celda de instancia de métrica"); continue; }
      if (extra > 0 && fila >= FILA_OPORTUNIDADES) {
        const pDesplazada = p.get(`${col}${fila - extra}`) ?? "";
        if (vd === pDesplazada && antesEsPlantilla) { esperada("S1 46-50: plantilla desplazada por más de 12 riesgos"); continue; }
        if (!vd && va === (p.get(dir) ?? "") && va) { esperada("S1 46-50: plantilla desplazada por más de 12 riesgos"); continue; }
      }
    }

    // «NIIF S1 51» con E5: salen los objetivos no climáticos.
    if (hA.name === HOJA_S51 && alivio("E5") && ctx.objetivosNoClimaticos > 0 && (!vd || valoresAntes.has(vd))) { esperada("S1 51 con E5: solo objetivos climáticos"); continue; }

    // Hojas de datos con C3/C4.
    const nr = vd.match(NO_REVELADO);
    if (nr && alivio(nr[1])) { esperada(`«No revelado · alivio ${nr[1]}»`); continue; }
    if ((alivio("C3") || alivio("C4")) && va) {
      const partesA = textoPlano(va).split("; "), partesD = vd ? textoPlano(vd).split("; ") : [];
      const quitadas = partesA.filter((x) => !partesD.includes(x));
      if (partesD.every((x) => partesA.includes(x)) && quitadas.length && quitadas.every((x) => CAUSA.test(x))) { esperada("nota sin la causa que cubre el alivio"); continue; }
    }

    noEsperadas.push(`${lugar}: «${va.slice(0, 120)}» → «${vd.slice(0, 120)}»`);
  }
}

const totalEsperadas = [...esperadas.values()].reduce((s, n) => s + n, 0);
console.log(`${emisora} · generador ${ctx.generador ? "on" : "off"} · alivios ${ctx.alivios.join(",") || "—"} · registros ${ctx.registros} · instancias S1 46-50: ${filasInstancia.size}${extra ? ` (+${extra} filas)` : ""}`);
console.log(`${antes.worksheets.length}→${despues.worksheets.length} hojas · ${comparadas} celdas comparadas · ${totalEsperadas} diferencias esperadas · ${noEsperadas.length} no esperadas`);
for (const [motivo, n] of esperadas) console.log(`  esperada  ${String(n).padStart(4)}  ${motivo}`);
for (const x of noEsperadas.slice(0, 60)) console.log(`  ✗ NO ESPERADA  ${x}`);
if (noEsperadas.length > 60) console.log(`  … y ${noEsperadas.length - 60} más`);
process.exit(noEsperadas.length ? 1 : 0);
