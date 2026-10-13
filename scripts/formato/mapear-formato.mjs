#!/usr/bin/env node
// =============================================================================
// MAPEO CONCEPTO ↔ DATAPOINT DEL FORMATO ELECTRÓNICO NIIF S1/S2 (encargo
// 2026-10-13-excel-respuestas-narrativas, Paso 1). Sin modelo: el modelo nunca
// decide el mapeo (decisión de Esteban, Paso 0).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//     scripts/formato/mapear-formato.mjs --formato <Estructura_Formato_…xlsx> --catalogo <catalogo.json> \
//     --json docs/suplemento-s1s2/mapeo-formato-electronico.json \
//     --md docs/suplemento-s1s2/mapeo-formato-electronico.md \
//     --revision referencia/formato-electronico/mapeo-revision.xlsx
//
// <catalogo.json>: {codigo: descripcion} de datapoints_taxonomia activos.
//
// CLAUDE.md §4: el JSON y el .md (versionados) NO llevan texto del formato: cada
// concepto se identifica por su FILA en el asset, su sección y los párrafos que
// cita. Las etiquetas completas solo van al Excel de revisión, que vive en
// referencia/ (fuera de git), igual que el asset.
//
// Capas del mapeo, por concepto con tipo de campo:
//   1 · fuente   los párrafos de las columnas Ref (A) y Fuente (G) cruzados con los
//                códigos del catálogo: igual, inciso hijo o código padre. Entre
//                varios candidatos decide la etiqueta (capa 2 restringida a ellos).
//   2 · etiqueta similitud de palabras entre la etiqueta del concepto y la
//                descripción de cada datapoint NIIF (de la norma que cite la fila,
//                si cita una). Solo propone: confianza media o baja = revisión.
//   sin candidato  ninguna coincidencia útil: va a la lista «sin mapeo».
// Además, sin capa: [100000] se llena desde el Perfil; las filas sin tipo son
// subconceptos de la fila con tipo anterior (heredan su datapoint) o, en [901000],
// miembros de la tabla del eje.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { BLOQUES } from "../../lib/suplemento/bloques.ts";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");
const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const [FORMATO, CATALOGO, JSON_OUT, MD_OUT, REVISION] = ["--formato", "--catalogo", "--json", "--md", "--revision"].map(arg);
if (!FORMATO || !CATALOGO || !JSON_OUT || !MD_OUT || !REVISION) { console.error("Uso: mapear-formato.mjs --formato … --catalogo … --json … --md … --revision …"); process.exit(2); }

const HOJA = "Estructura Formato Electronico";
const txt = (v) => v == null ? "" : typeof v === "object" ? (v.richText ? v.richText.map((r) => r.text).join("") : v.result ?? v.text ?? "") : String(v);
const VACIAS = new Set("para como sobre entre desde hasta este esta estos estas cada otro otra otros otras donde cual cuales cuando tiene tienen tanto según durante ante bajo cuyo cuya entidad información revelar relacionados relacionadas relacionado relacionada descripción incluye incluidos".split(" "));
const palabras = (t) => new Set(t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9ñ]+/).filter((x) => x.length >= 4 && !VACIAS.has(x)));
const clave = (c) => c.toLowerCase().replace(/\s+/g, "");

/** Párrafos citados en un texto de Ref o Fuente: «NIIF S2 29 (b)», «NIIF S1 31 / NIIF S2 13», «B65 inciso (a)». */
function parrafos(t) {
  const out = []; let norma = null;
  const limpio = t.replace(/inciso\s*/gi, "");
  for (const m of limpio.matchAll(/(?:NIIF\s*)?(S[12])?\s*((?:B|C|E)?\d+[A-Z]?)\s*((?:\s*\([a-z0-9ivx]+\))*)/gi)) {
    if (m[1]) norma = m[1].toUpperCase();
    if (!norma || !/\d/.test(m[2])) continue;
    const incisos = (m[3] ?? "").replace(/\s+/g, "");
    out.push({ norma, codigo: `NIIF ${norma} ${m[2].toUpperCase()}${incisos ? " " + incisos : ""}` });
  }
  const vistos = new Set();
  return out.filter((p) => !vistos.has(p.codigo) && vistos.add(p.codigo));
}

// --- Catálogo y dueños -------------------------------------------------------
const catalogo = Object.entries(JSON.parse(fs.readFileSync(CATALOGO, "utf8"))).filter(([c]) => c.startsWith("NIIF")).map(([codigo, d]) => ({ codigo, k: clave(codigo), norma: codigo.match(/NIIF (S[12])/)[1], w: palabras(d) }));
const duenoDe = new Map(); for (const b of BLOQUES) for (const d of b.datapoints) duenoDe.set(d, b.numero);
const tituloDe = new Map(BLOQUES.map((b) => [b.numero, b.titulo]));

function similitud(etiqueta, candidatos) {
  const e = palabras(etiqueta);
  return candidatos
    .map((c) => ({ c, s: [...e].filter((x) => c.w.has(x)).length / Math.max(1, Math.min(e.size, c.w.size)) }))
    .sort((a, b) => b.s - a.s);
}

// --- Lectura del formato ---------------------------------------------------------
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FORMATO);
const ws = wb.getWorksheet(HOJA);
const huella = crypto.createHash("sha256").update(fs.readFileSync(FORMATO)).digest("hex").slice(0, 12);
const filas = [];
let seccion = "100000";
for (let r = 4; r <= ws.rowCount; r++) {
  const d = txt(ws.getCell(`D${r}`).value).trim();
  const m = d.match(/^\[(\d{6})\]/);
  if (m) { seccion = m[1]; continue; }
  if (/^8/.test(seccion)) continue; // métricas por industria (SASB): Fase C
  const tipo = txt(ws.getCell(`F${r}`).value).trim().toLowerCase();
  if (!d && !tipo) continue;
  if (tipo === "tipo de formato") continue; // encabezado repetido dentro de la hoja
  filas.push({ fila: r, seccion, etiqueta: d, tipo: tipo || null, ref: txt(ws.getCell(`A${r}`).value).trim(), fuente: txt(ws.getCell(`G${r}`).value).trim(), lista: txt(ws.getCell(`E${r}`).value).trim(), respondidaAutlan: !!txt(ws.getCell(`K${r}`).value).trim() });
}

// --- Perfil para [100000] (campos nuevos: clave de cotización, tipo de instrumento, fiduciario)
const PERFIL = [
  [/clave de cotizaci/i, "perfil.clave_cotizacion (nuevo)"],
  [/tipo de instrumento/i, "perfil.tipo_instrumento (nuevo)"],
  [/fiduciari/i, "perfil.fiduciario (nuevo)"],
  [/raz[oó]n social|denominaci|nombre de la (?:entidad|emisora)/i, "perfil.denominacion_formal"],
  [/logo/i, "perfil.logo"],
  [/a[ñn]o|ejercicio|periodo/i, "reporte.ejercicio"],
  [/fecha/i, "reporte (fechas del periodo)"],
  [/moneda|unidad/i, "perfil (moneda de presentación)"],
];

// --- Mapeo -----------------------------------------------------------------------
let padre = null;
const resultado = filas.map((f) => {
  const base = { fila: f.fila, seccion: f.seccion, tipo: f.tipo ?? "(sin tipo)", parrafos: [...new Set([...parrafos(f.ref), ...parrafos(f.fuente)].map((p) => p.codigo))], lista: !!f.lista, respondidaAutlan: f.respondidaAutlan };
  if (!f.tipo) {
    if (f.seccion === "901000") return { ...base, clasificacion: "miembro de tabla", capa: "—", datapoint: null, confianza: "—", bloque: null, regla: "Miembro del eje de la tabla [901000]: se escribe como columna o fila de la tabla" };
    if (padre) return { ...base, clasificacion: `subconcepto de la fila ${padre.fila}`, capa: padre.capa, datapoint: padre.datapoint, confianza: padre.confianza, bloque: padre.bloque, regla: `Se responde junto con la fila ${padre.fila} (${padre.tipo})` };
    return { ...base, clasificacion: "subconcepto sin padre", capa: "sin candidato", datapoint: null, confianza: "baja", bloque: null, regla: "Revisar" };
  }
  let r;
  if (f.tipo === "abstract") r = { ...base, clasificacion: "encabezado", capa: "—", datapoint: null, confianza: "—", bloque: null, regla: "Sin respuesta (encabezado)" };
  else if (f.seccion === "100000") {
    const campo = PERFIL.find(([re]) => re.test(f.etiqueta))?.[1] ?? null;
    r = { ...base, clasificacion: "concepto", capa: "Perfil", datapoint: null, perfil: campo, confianza: campo ? "alta" : "baja", bloque: null, regla: campo ? `Desde ${campo}` : "Perfil: campo por definir con Esteban" };
  } else {
    const ps = parrafos(f.ref + "\n" + f.fuente);
    const normas = new Set(ps.map((p) => p.norma));
    const exactos = [], hijos = [], padres = [];
    for (const p of ps) {
      const k = clave(p.codigo);
      for (const c of catalogo) {
        if (c.k === k) exactos.push(c);
        else if (c.k.startsWith(k + "(")) hijos.push(c);
        else if (k.startsWith(c.k + "(")) padres.push(c);
      }
    }
    let capa, elegido = null, confianza, nota = null;
    const capa1 = exactos.length ? exactos : hijos.length ? hijos : padres;
    if (capa1.length) {
      capa = "1 · fuente";
      const orden = similitud(f.etiqueta, [...new Set(capa1)]);
      elegido = orden[0].c;
      confianza = exactos.length === 1 || orden.length === 1 ? "alta" : orden[0].s >= 0.35 && orden[0].s - (orden[1]?.s ?? 0) >= 0.1 ? "alta" : "media";
      if (orden.length > 1) nota = `${orden.length} códigos del párrafo; elegido por la etiqueta`;
    } else {
      const universo = normas.size ? catalogo.filter((c) => normas.has(c.norma)) : catalogo;
      const orden = similitud(f.etiqueta, universo);
      const s = orden[0]?.s ?? 0, margen = s - (orden[1]?.s ?? 0);
      if (s >= 0.2) {
        capa = "2 · etiqueta"; elegido = orden[0].c;
        confianza = s >= 0.5 && margen >= 0.1 ? "alta" : s >= 0.35 ? "media" : "baja";
      } else { capa = "sin candidato"; confianza = "—"; }
    }
    const bloque = elegido ? duenoDe.get(elegido.codigo) ?? null : null;
    const regla = !elegido ? "Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo"
      : /text/.test(f.tipo) ? (bloque ? `Modelo, desde el bloque ${bloque} aprobado y los hechos de ${elegido.codigo}` : `Sin bloque dueño para ${elegido.codigo}: «Pendiente»`)
      : f.tipo === "booleano" ? `Sí/No desde un hecho o declaración negativa de ${elegido.codigo}`
      : /enumeraci/.test(f.tipo) ? `Valor de la lista desde el Perfil o el hecho de ${elegido.codigo}`
      : f.tipo === "porcentaje" ? `Cifra confirmada con unidad (${elegido.codigo})`
      : f.tipo === "tabla" ? `Tabla desde registros de clima u objetivos (${elegido.codigo})`
      : `Revisar tipo «${f.tipo}»`;
    r = { ...base, clasificacion: "concepto", capa, datapoint: elegido?.codigo ?? null, confianza, bloque, regla, nota };
    if (/^2111/.test(f.seccion)) r.regla = `Solo sector financiero (Perfil); si no, «No aplica». ${r.regla}`;
  }
  padre = r;
  return r;
});

// --- Sin mapeo: conceptos con tipo sin datapoint, con los párrafos que piden ------
const sinMapeo = resultado.filter((x) => x.clasificacion === "concepto" && x.capa === "sin candidato");
const parrafosSinCodigo = new Map();
for (const x of resultado.filter((y) => y.clasificacion === "concepto")) for (const p of x.parrafos) if (!catalogo.some((c) => c.k === clave(p) || c.k.startsWith(clave(p) + "("))) parrafosSinCodigo.set(p, [...(parrafosSinCodigo.get(p) ?? []), x.fila]);

// --- Salidas -----------------------------------------------------------------------
const cuenta = (f) => resultado.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
const resumen = {
  formato: { archivo: path.basename(FORMATO), sha256: huella, hoja: HOJA },
  filas: resultado.length,
  porClasificacion: cuenta((x) => x.clasificacion.startsWith("subconcepto de") ? "subconcepto" : x.clasificacion),
  porCapa: cuenta((x) => x.capa),
  porConfianza: cuenta((x) => x.confianza),
  conDatapoint: resultado.filter((x) => x.datapoint).length,
  conBloque: resultado.filter((x) => x.bloque).length,
};
fs.writeFileSync(JSON_OUT, JSON.stringify({ resumen, conceptos: resultado, sinMapeo: sinMapeo.map((x) => ({ fila: x.fila, seccion: x.seccion, tipo: x.tipo, parrafos: x.parrafos })), parrafosSinCodigo: Object.fromEntries([...parrafosSinCodigo].sort()) }, null, 1));

const md = [];
md.push(`# Mapeo concepto ↔ datapoint del Formato electrónico NIIF S1/S2`, "");
md.push(`Encargo \`2026-10-13-excel-respuestas-narrativas\`, Paso 1. Generado por \`scripts/formato/mapear-formato.mjs\` (sin modelo) desde el asset \`${path.basename(FORMATO)}\` (sha256 \`${huella}\`, hoja «${HOJA}») y el catálogo de dev. **Pendiente de la revisión de Esteban** (revisión de IRStrat) en \`referencia/formato-electronico/mapeo-revision.xlsx\`.`, "");
md.push(`Conforme a CLAUDE.md §4, este archivo no reproduce texto del formato: cada concepto se identifica por su **fila** en el asset, su sección y los párrafos que cita. Las etiquetas están en el asset y en el Excel de revisión (fuera de git).`, "");
md.push(`## Resumen`, "", `- Filas en alcance: **${resumen.filas}** (secciones [100000]–[211300] y [901000]; [8xxxxx] SASB fuera, Fase C).`);
md.push(`- Clasificación: ${Object.entries(resumen.porClasificacion).map(([k, v]) => `${k} ${v}`).join(" · ")}.`);
md.push(`- Capa que resolvió: ${Object.entries(resumen.porCapa).map(([k, v]) => `${k} ${v}`).join(" · ")}.`);
md.push(`- Confianza: ${Object.entries(resumen.porConfianza).map(([k, v]) => `${k} ${v}`).join(" · ")}.`);
md.push(`- Con datapoint propuesto: ${resumen.conDatapoint}; con bloque dueño: ${resumen.conBloque}.`, "");
md.push(`## Conceptos`, "", `| Fila | Sección | Tipo | Clasificación | Párrafos citados | Datapoint propuesto | Capa | Confianza | Bloque | Regla de llenado |`, `|---:|---|---|---|---|---|---|---|---:|---|`);
for (const x of resultado) md.push(`| ${x.fila} | ${x.seccion} | ${x.tipo} | ${x.clasificacion} | ${x.parrafos.join("; ") || "—"} | ${x.datapoint ?? (x.perfil ? "—" : "—")} | ${x.capa} | ${x.confianza} | ${x.bloque ?? "—"} | ${x.regla}${x.nota ? ` (${x.nota})` : ""} |`);
md.push("", `## Sin mapeo (propuesta de ampliación del catálogo; no se crea nada ahora)`, "", `### Conceptos con tipo sin datapoint (${sinMapeo.length})`, "", `| Fila | Sección | Tipo | Párrafos que piden |`, `|---:|---|---|---|`);
for (const x of sinMapeo) md.push(`| ${x.fila} | ${x.seccion} | ${x.tipo} | ${x.parrafos.join("; ") || "(sin párrafo citado)"} |`);
md.push("", `### Párrafos citados por el formato que no tienen código en el catálogo (${parrafosSinCodigo.size})`, "", `| Párrafo | Filas que lo citan |`, `|---|---|`);
for (const [p, fs_] of [...parrafosSinCodigo].sort()) md.push(`| ${p} | ${fs_.length} (${fs_.slice(0, 12).join(", ")}${fs_.length > 12 ? ", …" : ""}) |`);
fs.writeFileSync(MD_OUT, md.join("\n") + "\n");

// --- Excel de revisión (fuera de git): con etiquetas, semáforo y «Decisión de Esteban»
const out = new ExcelJS.Workbook();
const hoja = out.addWorksheet("Mapeo");
hoja.columns = [
  { header: "Fila", key: "fila", width: 7 }, { header: "Sección", key: "seccion", width: 9 }, { header: "Concepto (etiqueta del formato)", key: "etiqueta", width: 70 },
  { header: "Tipo", key: "tipo", width: 18 }, { header: "Clasificación", key: "clasificacion", width: 22 }, { header: "Ref / Fuente", key: "parrafos", width: 26 },
  { header: "Datapoint propuesto", key: "datapoint", width: 24 }, { header: "Capa", key: "capa", width: 14 }, { header: "Confianza", key: "confianza", width: 11 },
  { header: "Semáforo", key: "semaforo", width: 10 }, { header: "Bloque dueño", key: "bloque", width: 34 }, { header: "Regla de llenado", key: "regla", width: 60 },
  { header: "Respondida por Autlán", key: "autlan", width: 11 }, { header: "Decisión de Esteban", key: "decision", width: 40 },
];
const etiquetaDe = new Map(filas.map((f) => [f.fila, f.etiqueta]));
const COLOR = { verde: "FFC6EFCE", amarillo: "FFFFEB9C", rojo: "FFFFC7CE", gris: "FFE7E6E6" };
for (const x of resultado) {
  const semaforo = x.confianza === "alta" ? "verde" : x.confianza === "media" ? "amarillo" : x.confianza === "baja" || x.capa === "sin candidato" ? "rojo" : "gris";
  const fila = hoja.addRow({ fila: x.fila, seccion: x.seccion, etiqueta: etiquetaDe.get(x.fila), tipo: x.tipo, clasificacion: x.clasificacion, parrafos: x.parrafos.join("; "), datapoint: x.datapoint ?? x.perfil ?? "", capa: x.capa, confianza: x.confianza, semaforo, bloque: x.bloque ? `${x.bloque} · ${tituloDe.get(x.bloque)}` : "", regla: x.regla + (x.nota ? ` (${x.nota})` : ""), autlan: x.respondidaAutlan ? "Sí" : "", decision: "" });
  fila.getCell("semaforo").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR[semaforo] } };
  fila.alignment = { vertical: "top", wrapText: true };
}
hoja.getRow(1).font = { bold: true };
hoja.views = [{ state: "frozen", ySplit: 1 }];
hoja.autoFilter = { from: "A1", to: "N1" };
const leyenda = out.addWorksheet("Leyenda");
leyenda.addRows([["Semáforo", "Significado"], ["verde", "Confianza alta: código exacto del párrafo, o elegido con margen claro"], ["amarillo", "Confianza media: revisar el datapoint propuesto"], ["rojo", "Confianza baja o sin candidato: decidir o pasar a «sin mapeo»"], ["gris", "Encabezado, Perfil sin regla o miembro de tabla: sin datapoint"], [], ["Decisión de Esteban", "Vacío = de acuerdo. Si no: el datapoint correcto, «sin mapeo» o la regla que corresponda."]]);
await out.xlsx.writeFile(REVISION);
console.log(JSON.stringify(resumen));
console.log(`sin mapeo: ${sinMapeo.length} conceptos · párrafos sin código en el catálogo: ${parrafosSinCodigo.size}`);
