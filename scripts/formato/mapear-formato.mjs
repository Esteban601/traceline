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
import { aplicarCorrecciones } from "./correcciones-mapeo.mjs";
import { sinMapeoDe, parrafosSinCodigoDe, resumenDe, jsonDe, mdDe } from "./mapeo-salidas.mjs";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");
const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const [FORMATO, CATALOGO, JSON_OUT, MD_OUT, REVISION, DECISIONES] = ["--formato", "--catalogo", "--json", "--md", "--revision", "--decisiones"].map(arg);
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

/**
 * Un código escrito a mano («NIIF S2 29(f)(i)») contra el catálogo, con su nombre
 * EXACTO (CLAUDE.md §4: nunca por igualdad de cadena escrita a mano). Igual sin
 * espacios; si no, el único código que lo contiene con un nombre combinado
 * («NIIF S2 29 (f) (i) y (ii)», «NIIF S2 10(a), (b)y(c)», «… EI5»); si hay varios,
 * el agrupado («… (a)(i)a(v)»). Sin nada: null, y se reporta.
 */
function resolver(codigo) {
  const k = clave(codigo);
  const exacto = catalogo.find((c) => c.k === k);
  if (exacto) return { c: exacto, como: "exacto" };
  const contienen = catalogo.filter((c) => c.k.startsWith(k) && c.k !== k);
  const combinados = contienen.filter((c) => !c.k.slice(k.length).startsWith("(") || /\)y\(|,\(/.test(c.k.slice(k.length)));
  if (combinados.length === 1) return { c: combinados[0], como: `nombre combinado «${combinados[0].codigo}»` };
  const agrupado = contienen.find((c) => /\)a\(/.test(c.k));
  if (agrupado) return { c: agrupado, como: `código agrupado «${agrupado.codigo}»` };
  if (contienen.length === 1) return { c: contienen[0], como: `único inciso «${contienen[0].codigo}»` };
  // Párrafo sin código propio con varios incisos del MISMO bloque dueño: el bloque
  // se sabe, el datapoint no (lo decide Esteban).
  const duenos = new Set(contienen.map((c) => duenoDe.get(c.codigo)).filter((n) => n != null));
  if (contienen.length > 1 && duenos.size === 1) return { c: null, bloque: [...duenos][0], como: `sin código propio; sus ${contienen.length} incisos son del bloque ${[...duenos][0]}` };
  return null;
}

/**
 * Regla S1→S2 de la revisión del 13 de octubre (hoja Leyenda): con el alivio E5 el
 * suplemento responde lo general de NIIF S1 con su equivalente de NIIF S2, que es
 * el que tiene bloque dueño. Si el Ref cita el par S1/S2, se usa el S2; para los
 * párrafos de S1 sin par, esta tabla. Toda respuesta así lleva la oración fija del
 * alivio E5.
 */
const CORRESPONDENCIAS = [
  { s1: /^NIIF S1 40 ?\(a\)/, s2: "NIIF S2 21(a)" },
  { s1: /^NIIF S1 41\b/, s2: "NIIF S2 22" },
  { s1: /^NIIF S1 (?:46|47|48|49|50)\b/, regla: "Métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56", metricas: true },
  { s1: /^NIIF S1 51\b/, s2: "NIIF S2 33" },
  { s1: /^NIIF S1 B?52\b/, regla: "«No aplica» el primer año (sin periodo comparativo)", primerAnio: true },
  { s1: /^NIIF S1 66\b/, regla: "Desde el reporte: fechas del ejercicio (Perfil)", perfil: "reporte.ejercicio" },
  { s1: /^NIIF S1 68\b/, regla: "Campo nuevo del Perfil: hechos posteriores al cierre", perfil: "perfil.hechos_posteriores (nuevo)" },
  { s1: /^NIIF S1 72\b/, bloque: 2, regla: "Declaración de cumplimiento: bloque 2 (plantilla)" },
  { s1: /^NIIF S1 (?:7[4-9]|8[0-2])\b/, bloque: 6, regla: "Juicios e incertidumbres: bloque 6" },
  { s1: /^NIIF S1 8[3-6]\b/, regla: "«No aplica» el primer año", primerAnio: true },
];

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
  const vD = ws.getCell(`D${r}`).value;
  // Imagen dentro de la celda (tabla-plantilla de la BMV): ExcelJS la lee como error (#VALUE!).
  const imagen = !!(vD && typeof vD === "object" && "error" in vD);
  if (/^8/.test(seccion) && !imagen) continue; // métricas por industria (SASB): Fase C
  const tipo = txt(ws.getCell(`F${r}`).value).trim().toLowerCase() || (imagen ? "tabla" : "");
  if (!d && !tipo) continue;
  if (tipo === "tipo de formato") continue; // encabezado repetido dentro de la hoja
  filas.push({ fila: r, seccion, imagen, etiqueta: d, tipo: tipo || null, ref: txt(ws.getCell(`A${r}`).value).trim(), fuente: txt(ws.getCell(`G${r}`).value).trim(), lista: txt(ws.getCell(`E${r}`).value).trim(), respondidaEnReferencia: !!txt(ws.getCell(`K${r}`).value).trim() });
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
  const base = { fila: f.fila, seccion: f.seccion, tipo: f.tipo ?? "(sin tipo)", parrafos: [...new Set([...parrafos(f.ref), ...parrafos(f.fuente)].map((p) => p.codigo))], lista: !!f.lista, respondidaEnReferencia: f.respondidaEnReferencia };
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
      // Nombre combinado («NIIF S2 10(a), (b)y(c)»): cuenta como exacto.
      const res = resolver(p.codigo);
      if (res?.c && /^nombre combinado/.test(res.como) && !exactos.includes(res.c)) exactos.push(res.c);
    }
    let capa, elegido = null, confianza, nota = null, alivioE5 = false, reglaFija = null;
    // Regla S1→S2: con el par en el Ref, solo cuentan los códigos de S2.
    const par = normas.has("S1") && normas.has("S2");
    const soloS2 = (l) => (par ? l.filter((c) => c.norma === "S2") : l);
    const [ex, hi, pa] = [soloS2(exactos), soloS2(hijos), soloS2(padres)];
    if (par && (ex.length || hi.length || pa.length)) alivioE5 = true;
    const capa1 = ex.length ? ex : hi.length ? hi : pa;
    const corr = normas.size === 1 && normas.has("S1") ? CORRESPONDENCIAS.find((x) => ps.some((p) => x.s1.test(p.codigo))) : null;
    if (corr) {
      alivioE5 = true;
      capa = "1 · correspondencia S1→S2";
      if (corr.s2) {
        const res = resolver(corr.s2);
        elegido = res?.c ?? null;
        confianza = res?.c ? (res.como === "exacto" ? "alta" : "media") : res ? "media" : "—";
        nota = res ? (res.como === "exacto" ? null : `${corr.s2} → ${res.como}`) : `${corr.s2} no existe en el catálogo`;
        if (res && !res.c) { corr.bloqueComun = res.bloque; reglaFija = `Modelo, desde el bloque ${res.bloque} aprobado (incisos de ${corr.s2}); datapoint por decidir`; }
        if (!res) capa = "sin candidato";
      } else { reglaFija = corr.regla; confianza = "alta"; }
    } else if (capa1.length) {
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
    const bloque = elegido ? duenoDe.get(elegido.codigo) ?? null : corr?.bloque ?? corr?.bloqueComun ?? null;
    const regla = reglaFija ? reglaFija : !elegido ? "Sin datapoint en el catálogo: «Pendiente» hasta ampliar el catálogo"
      : /text/.test(f.tipo) ? (bloque ? `Modelo, desde el bloque ${bloque} aprobado y los hechos de ${elegido.codigo}` : `Sin bloque dueño para ${elegido.codigo}: «Pendiente»`)
      : f.tipo === "booleano" ? `Sí/No desde un hecho o declaración negativa de ${elegido.codigo}`
      : /enumeraci/.test(f.tipo) ? `Valor de la lista desde el Perfil o el hecho de ${elegido.codigo}`
      : f.tipo === "porcentaje" ? `Cifra confirmada con unidad (${elegido.codigo})`
      : f.tipo === "tabla" ? `Tabla desde registros de clima u objetivos (${elegido.codigo})`
      : `Revisar tipo «${f.tipo}»`;
    r = { ...base, clasificacion: "concepto", capa, datapoint: elegido?.codigo ?? null, confianza, bloque, regla: regla + (alivioE5 ? " · lleva la oración fija del alivio E5" : ""), nota, alivioE5, perfil: corr?.perfil ?? undefined };
    if (/^2111/.test(f.seccion)) r.regla = `Solo sector financiero (Perfil); si no, «No aplica». ${r.regla}`;
  }
  padre = r;
  return r;
});

// --- Revisión de Esteban (13 de octubre de 2026) -------------------------------------
// La decisión de cada fila es la columna N del Excel revisado (Esteban) o, si está
// vacía, la P (propuesta del asesor, que Esteban acepta al dejar N vacía). Cada
// decisión se interpreta con patrones explícitos; la que no encaja se reporta, no
// se adivina. De su texto no pasa al repositorio nada que nombre a una emisora.
const noInterpretadas = [];
const estructuraImagen = new Set();
if (DECISIONES) {
  const rv = new ExcelJS.Workbook();
  await rv.xlsx.readFile(DECISIONES);
  const hm = rv.getWorksheet("Mapeo");
  const col = {};
  hm.getRow(1).eachCell((c, i) => { const t = txt(c.value); if (/^Fila$/.test(t)) col.fila = i; if (/^Decisión de Esteban/.test(t)) col.n = i; if (/^Propuesta del asesor/.test(t)) col.p = i; if (/^Etiqueta leída de la imagen|imagen/i.test(t)) col.o = i; });
  const dec = new Map();
  hm.eachRow((f, nf) => {
    if (nf === 1) return;
    const fila = Number(txt(f.getCell(col.fila).value));
    const n = txt(f.getCell(col.n).value).trim(), pr = txt(f.getCell(col.p).value).trim();
    if (col.o && txt(f.getCell(col.o).value).trim()) estructuraImagen.add(fila);
    if (n || pr) dec.set(fila, { texto: n || pr, origen: n ? "Esteban" : "asesor (aceptada por Esteban)" });
  });
  const porFila = new Map(resultado.map((x) => [x.fila, x]));
  const sinEmisora = (t) => t.split(/(?<=[.;])\s+|\s+\(?(?=Ojo:)/).filter((x) => !/Autl[aá]n/i.test(x)).join(" ").replace(/;?\s*(?:el|la|los) [^;.]*propuest[oa]s? (?:es|son) incorrect[oa]s?\.?/gi, "").replace(/\s+/g, " ").trim();
  const codigosS2 = (t) => [...t.matchAll(/S2\s*(\d+[A-Z]?)\s*((?:\([a-z0-9ivx]+\))*)/g)].map((m) => `NIIF S2 ${m[1]}${m[2]}`);
  const resolverTexto = (t) => { for (const c of codigosS2(t)) { const r = resolver(c) ?? resolver(c + "(a)"); if (r) return { ...r, pedido: c }; } return codigosS2(t).length ? { c: null, pedido: codigosS2(t)[0] } : null; };
  const bloqueDe = (t, res) => { const m = t.match(/bloque (\d+)/); return m ? Number(m[1]) : res?.c ? duenoDe.get(res.c.codigo) ?? null : res?.bloque ?? null; };
  const aplicar = (x, d) => {
    const t = d.texto;
    let m;
    x.revision = { origen: d.origen };
    if ((m = t.match(/^Igual que (?:la fila )?(\d+)/))) { const otra = dec.get(Number(m[1])); if (otra) return aplicar(x, { ...otra, origen: d.origen }); }
    if ((m = t.match(/^Regla S1→S2: usar (NIIF S2 [^ ]+(?: [^ (]+)?)/))) {
      const res = resolver(m[1].replace(/\s*\(el código.*$/, ""));
      Object.assign(x, { clasificacion: "concepto", capa: "3 · revisión (S1→S2)", datapoint: res?.c?.codigo ?? null, bloque: res?.c ? duenoDe.get(res.c.codigo) ?? null : res?.bloque ?? null, confianza: res?.c ? "alta" : res ? "media" : "—", alivioE5: true, nota: res && res.como !== "exacto" ? `${m[1]} → ${res.como}` : res ? null : `${m[1]} no existe en el catálogo` });
      x.regla = x.datapoint ? `Modelo, desde el bloque ${x.bloque} aprobado y los hechos de ${x.datapoint} · lleva la oración fija del alivio E5`
        : x.bloque ? `Modelo, desde el bloque ${x.bloque} aprobado; datapoint por decidir · lleva la oración fija del alivio E5` : "Sin datapoint en el catálogo: «Pendiente»";
      return (x.revision.categoria = "regla S1→S2");
    }
    if (/^Fuera de alcance/.test(t)) { Object.assign(x, { clasificacion: "fuera de alcance (SASB, Fase C)", capa: "—", datapoint: null, bloque: null, confianza: "—", regla: "Métricas por industria: pendiente de catálogo SASB" }); return (x.revision.categoria = "fuera de alcance"); }
    if ((m = t.match(/^Corrección: es la lista de opciones de la fila (\d+)/))) { const pa = porFila.get(Number(m[1])); Object.assign(x, { clasificacion: `subconcepto de la fila ${m[1]}`, capa: pa?.capa ?? "—", datapoint: pa?.datapoint ?? null, bloque: pa?.bloque ?? null, confianza: pa?.confianza ?? "—", regla: `Lista de opciones de la fila ${m[1]}`, perfil: undefined }); return (x.revision.categoria = "subconcepto"); }
    if (/^(Estructura|Etiqueta de|Encabezado «|Encabezado \(gris\)|Encabezado de \[|Corrección: es (?:la etiqueta|el encabezado)|Corrección: «[^»]+» es encabezado)/.test(t) || (/^Encabezado/.test(t) && /\(gris\)/.test(t))) {
      Object.assign(x, { clasificacion: "encabezado", capa: "—", datapoint: null, bloque: null, confianza: "—", regla: /plantilla/.test(t) ? "Estructura de plantilla: se genera al iterar la tabla o las métricas" : "Sin respuesta (encabezado)", alivioE5: false, nota: null });
      return (x.revision.categoria = "encabezado");
    }
    if (/^Encabezado/.test(t)) {
      const res = resolverTexto(t);
      Object.assign(x, { clasificacion: "encabezado narrativo", capa: "3 · revisión", datapoint: null, bloque: bloqueDe(t, res), confianza: "alta", regla: `Párrafo introductorio desde el bloque ${bloqueDe(t, res) ?? "?"} aprobado`, nota: null });
      return (x.revision.categoria = "encabezado narrativo");
    }
    if (/^Confirmo regla sector/.test(t)) { x.confianza = "alta"; return (x.revision.categoria = "confirmada (sector financiero)"); }
    if (/^Confirmo encabezado desde bloque (\d+)/.test(t)) { const b = Number(t.match(/bloque (\d+)/)[1]); Object.assign(x, { clasificacion: "encabezado narrativo", bloque: b, confianza: "alta", regla: `Párrafo introductorio desde el bloque ${b} aprobado` }); return (x.revision.categoria = "confirmada"); }
    if (/^Confirmo/.test(t)) { const res = resolverTexto(t); if (res?.c && !x.datapoint) { x.datapoint = res.c.codigo; } if (/bloque (\d+)/.test(t)) x.bloque = Number(t.match(/bloque (\d+)/)[1]); x.confianza = "alta"; return (x.revision.categoria = "confirmada"); }
    if ((m = t.match(/^Regla fija: (.+)$/))) { Object.assign(x, { clasificacion: "concepto", capa: "regla fija", datapoint: null, bloque: null, confianza: "alta", regla: `Regla fija: ${sinEmisora(m[1])}`, alivioE5: false, nota: null }); return (x.revision.categoria = "regla fija"); }
    if (/^Primer año/.test(t)) { Object.assign(x, { capa: "regla primer año", datapoint: x.datapoint, confianza: "alta", regla: sinEmisora(t), primerAnio: true }); return (x.revision.categoria = "primer año"); }
    if (/^(Tabla|Sub-tabla)/.test(t) || (x.tipo === "tabla" && codigosS2(t).length)) {
      const res = resolverTexto(t);
      Object.assign(x, { tipo: "tabla", clasificacion: "concepto", capa: "3 · revisión (tabla)", datapoint: res?.c?.codigo ?? null, bloque: bloqueDe(t, res), confianza: res?.c ? "alta" : "media", regla: sinEmisora(t), nota: res && !res.c ? `${res.pedido} no existe en el catálogo` : res?.como && res.como !== "exacto" ? `${res.pedido} → ${res.como}` : null });
      return (x.revision.categoria = "tabla");
    }
    if (/^(?:Regla: )?(?:Perfil\/reporte|perfil\.|reporte\.|Regla desde reporte\.)/.test(t) || /campo nuevo de Perfil/.test(t)) {
      const campo = t.match(/(perfil\.[a-z_]+|reporte\.[a-z_]+)/)?.[1] ?? (/hechos posteriores/.test(t) ? "perfil.hechos_posteriores" : /fecha de (inicio|fin)/.test(t) ? "reporte.ejercicio (fechas)" : null);
      const resto = sinEmisora(t).replace(/^(?:Regla desde |Perfil\/reporte: )?(?:perfil|reporte)\.[a-z_]+(?: \(nuevo\))?[,:;]?\s*/, "").replace(/^S1 \d+ [^:]*:\s*/, "").replace(/\s*No es [^.]*\.?$/, "").trim();
      Object.assign(x, { clasificacion: "concepto", capa: "Perfil", datapoint: null, bloque: null, confianza: "alta", perfil: campo + (/nuevo/.test(t) ? " (nuevo)" : ""), regla: `Desde ${campo}${/nuevo/.test(t) ? " (campo nuevo)" : ""}${resto ? `: ${resto}` : ""}`, alivioE5: false, nota: null });
      return (x.revision.categoria = "Perfil o reporte");
    }
    if ((m = t.match(/^Regla(?: por [a-zé]+)?: (.+)$/))) { Object.assign(x, { capa: "3 · revisión (regla)", datapoint: null, bloque: null, confianza: "alta", regla: sinEmisora(m[1]) }); return (x.revision.categoria = "regla"); }
    if (/Solo sector financiero|S2 29B/.test(t)) {
      const res = resolverTexto(t);
      Object.assign(x, { regla: `Solo sector financiero (Perfil); si no, «No aplica». ${x.regla}`, confianza: x.datapoint ? "alta" : "—" });
      if (res && !res.c) { Object.assign(x, { capa: "sin candidato", datapoint: null, nota: `${res.pedido} no existe en el catálogo` }); }
      return (x.revision.categoria = "sector financiero");
    }
    const res = resolverTexto(t);
    if (res) {
      Object.assign(x, { clasificacion: "concepto", capa: res.c ? "3 · revisión" : "sin candidato", datapoint: res.c?.codigo ?? null, bloque: bloqueDe(t, res), confianza: res.c ? "alta" : "—", regla: sinEmisora(t), nota: !res.c ? (res.bloque ? `${res.pedido}: ${res.como}` : `${res.pedido} no existe en el catálogo`) : res.como !== "exacto" ? `${res.pedido} → ${res.como}` : null, alivioE5: x.alivioE5 && !!res.c });
      return (x.revision.categoria = "datapoint y bloque");
    }
    noInterpretadas.push({ fila: x.fila });
    x.revision.categoria = "no interpretada";
  };
  for (const x of resultado) { const d = dec.get(x.fila); if (d) aplicar(x, d); }
  // Ref del formato que contradice su sección (decisión de Esteban, 13 de octubre
  // de 2026): la fila 370 está en la sección de riesgos físicos y su Ref dice
  // 29(b); es 29(c). El código se resuelve contra el catálogo por nombre exacto.
  const CORRECCIONES_DE_REF = [{ fila: 370, codigo: "NIIF S2 29 (c)", motivo: "la fila está en la sección de riesgos físicos; el Ref del formato dice 29(b)" }];
  for (const k of CORRECCIONES_DE_REF) {
    const x = porFila.get(k.fila);
    const c = catalogo.find((y) => y.k === clave(k.codigo));
    if (!x || !c) { noInterpretadas.push({ fila: k.fila }); continue; }
    Object.assign(x, { datapoint: c.codigo, bloque: duenoDe.get(c.codigo) ?? null, confianza: "alta", nota: `corrección de Ref: ${k.motivo}` });
    x.regla = (x.regla ?? "").replace(/NIIF S2 29 \(b\)/g, c.codigo);
    x.revision = { origen: "Esteban (13 de octubre de 2026)", categoria: "corrección de Ref" };
  }
  // Códigos que el catálogo no tiene: van a la lista de ampliación como deuda
  // (decisión de Esteban, 13 de octubre de 2026); la fila queda «sin mapeo».
  for (const x of resultado) if (x.capa === "sin candidato" && x.nota && !/ampliación/.test(x.nota)) x.nota += " · en la lista de ampliación del catálogo (docs/suplemento-s1s2/ampliacion-catalogo.md)";
  // Las filas sin decisión propia que son subconceptos vuelven a heredar de su padre ya revisado.
  for (const x of resultado) {
    const m = !x.revision && x.clasificacion.match(/^subconcepto de la fila (\d+)/);
    const pa = m && porFila.get(Number(m[1]));
    if (pa) Object.assign(x, { capa: pa.capa, datapoint: pa.datapoint, bloque: pa.bloque, confianza: pa.confianza, alivioE5: pa.alivioE5, primerAnio: pa.primerAnio, regla: `Se responde junto con la fila ${pa.fila} (${pa.tipo})` });
  }
  // Métricas S1 46–50 (filas 144–185): un solo bloque que se itera por métrica de S2 29.
  for (const x of resultado) if (x.fila >= 144 && x.fila <= 185) x.grupo = "métricas S1 46–50: una fila por métrica intersectorial de NIIF S2 29, ligada a cada riesgo u oportunidad de la fila 56";
  for (const x of resultado) if (estructuraImagen.has(x.fila)) x.estructura = "tabla-plantilla de la BMV (imagen en la celda): estructura en la columna O de la revisión, fuera de git";
}

// --- Correcciones de filas aprobadas después de la revisión (encargo 2026-10-24) ------
aplicarCorrecciones(resultado);

// --- Sin mapeo y salidas (scripts/formato/mapeo-salidas.mjs) -------------------------
const sinMapeo = sinMapeoDe(resultado);
const parrafosSinCodigo = parrafosSinCodigoDe(resultado, catalogo.map((c) => c.k));
const resumen = resumenDe(resultado, { formato: { archivo: path.basename(FORMATO), sha256: huella, hoja: HOJA }, revision: DECISIONES ? path.basename(DECISIONES) : null, noInterpretadas: noInterpretadas.map((x) => x.fila) });
fs.writeFileSync(JSON_OUT, jsonDe(resumen, resultado, sinMapeo, parrafosSinCodigo));
fs.writeFileSync(MD_OUT, mdDe(resumen, resultado, sinMapeo, parrafosSinCodigo));

// --- Excel de revisión (fuera de git): con etiquetas, semáforo y «Decisión de Esteban»
const out = new ExcelJS.Workbook();
const hoja = out.addWorksheet("Mapeo");
hoja.columns = [
  { header: "Fila", key: "fila", width: 7 }, { header: "Sección", key: "seccion", width: 9 }, { header: "Concepto (etiqueta del formato)", key: "etiqueta", width: 70 },
  { header: "Tipo", key: "tipo", width: 18 }, { header: "Clasificación", key: "clasificacion", width: 22 }, { header: "Ref / Fuente", key: "parrafos", width: 26 },
  { header: "Datapoint propuesto", key: "datapoint", width: 24 }, { header: "Capa", key: "capa", width: 14 }, { header: "Confianza", key: "confianza", width: 11 },
  { header: "Semáforo", key: "semaforo", width: 10 }, { header: "Bloque dueño", key: "bloque", width: 34 }, { header: "Regla de llenado", key: "regla", width: 60 },
  { header: "Respondida en la referencia", key: "referencia", width: 11 }, { header: "Revisión aplicada", key: "revision", width: 30 }, { header: "Decisión de Esteban", key: "decision", width: 40 },
];
const etiquetaDe = new Map(filas.map((f) => [f.fila, f.etiqueta]));
const COLOR = { verde: "FFC6EFCE", amarillo: "FFFFEB9C", rojo: "FFFFC7CE", gris: "FFE7E6E6" };
for (const x of resultado) {
  const semaforo = /^(encabezado$|fuera|miembro)/.test(x.clasificacion) ? "gris" : x.confianza === "alta" ? "verde" : x.confianza === "media" ? "amarillo" : x.confianza === "baja" || x.capa === "sin candidato" ? "rojo" : "gris";
  const fila = hoja.addRow({ fila: x.fila, seccion: x.seccion, etiqueta: etiquetaDe.get(x.fila), tipo: x.tipo, clasificacion: x.clasificacion, parrafos: x.parrafos.join("; "), datapoint: x.datapoint ?? x.perfil ?? "", capa: x.capa, confianza: x.confianza, semaforo, bloque: x.bloque ? `${x.bloque} · ${tituloDe.get(x.bloque)}` : "", regla: x.regla + (x.nota ? ` (${x.nota})` : ""), referencia: x.respondidaEnReferencia ? "Sí" : "", revision: x.revision ? `${x.revision.categoria} (${x.revision.origen})` : "", decision: "" });
  fila.getCell("semaforo").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR[semaforo] } };
  fila.alignment = { vertical: "top", wrapText: true };
}
hoja.getRow(1).font = { bold: true };
hoja.views = [{ state: "frozen", ySplit: 1 }];
hoja.autoFilter = { from: "A1", to: "O1" };
const leyenda = out.addWorksheet("Leyenda");
leyenda.addRows([["Semáforo", "Significado"], ["verde", "Confianza alta: código exacto del párrafo, o elegido con margen claro"], ["amarillo", "Confianza media: revisar el datapoint propuesto"], ["rojo", "Confianza baja o sin candidato: decidir o pasar a «sin mapeo»"], ["gris", "Encabezado, Perfil sin regla o miembro de tabla: sin datapoint"], [], ["Decisión de Esteban", "Vacío = de acuerdo. Si no: el datapoint correcto, «sin mapeo» o la regla que corresponda."]]);
await out.xlsx.writeFile(REVISION);
console.log(JSON.stringify(resumen));
console.log(`sin mapeo: ${sinMapeo.length} conceptos · párrafos sin código en el catálogo: ${parrafosSinCodigo.size}`);
