#!/usr/bin/env node
// =============================================================================
// GENERA LA MIGRACIÓN DE DATOS DEL CATÁLOGO GRI/SASB DESDE LOS PDF OFICIALES
// (encargo docs/encargos/2026-10-31-catalogo-gri-sasb.md, Fase 1, nivel mínimo).
//
//   node scripts/catalogo/generar-gri-sasb.mjs --salida supabase/migrations/<ts>_catalogo_gri2_gri3_fncb.sql
//   node scripts/catalogo/generar-gri-sasb.mjs --probar-extractor     # solo imprime conteos (no escribe)
//
// Las fuentes viven en normas/_fuentes/ (no se versionan: CLAUDE.md §2 y §4). Requiere `pdftotext` (poppler).
//
// QUÉ CARGA
//   · GRI 2: Contenidos Generales 2021 (2-1 a 2-30) y GRI 3: Temas Materiales 2021 (3-1 a 3-3), con el texto
//     LITERAL del requisito («REQUERIMIENTOS») del PDF oficial en español (normas/_fuentes/gri-es/), sin las
//     orientaciones. Sin paso por el inglés (decisión de Esteban, 31/10/2026).
//   · SASB FN-CB Commercial Banks, VERSION 2025-12, en inglés hasta que haya traducción oficial: las 15 métricas
//     contables (texto literal del encabezado de su protocolo técnico) y las 2 de actividad (texto literal de la
//     tabla 2), con el tema de la norma en `seccion_indice`.
// Cada fila lleva estándar, edición y página de origen (la página del ARCHIVO PDF, empezando en 1).
//
// RELLENO DE COLUMNAS NIIF. `norma` (enum S1/S2) y `pilar` (enum de los cuatro pilares NIIF) son NOT NULL y no
// tienen sentido para GRI ni SASB; se rellenan como ya se hacía con la «Extensión GRI»: GRI → S1, SASB → S2 (la
// guía por industria es de NIIF S2), y el pilar por sección (GRI 2: gobernanza en 2-9 a 2-21, estrategia en lo
// demás; GRI 3: estrategia; SASB: métricas). Ninguna pantalla los muestra para estos marcos.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const FUENTES = path.join(RAIZ, "normas/_fuentes");
const GRI_ES = path.join(FUENTES, "gri-es");
const SASB = path.join(FUENTES, "International Standards/SASB Standards");
const VERSION_TAXONOMIA = "2025";

const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
const salida = opcion("--salida");
const probar = argv.includes("--probar-extractor");
const salir = (m) => { console.error(`✗ ${m}`); process.exit(2); };
if (!salida && !probar) salir("Uso: --salida <archivo.sql> | --probar-extractor");

const paginas = (pdf) => Number(execFileSync("pdfinfo", [pdf], { encoding: "utf8" }).match(/^Pages:\s+(\d+)/m)[1]);
const texto = (pdf, p, layout = false) =>
  execFileSync("pdftotext", [...(layout ? ["-layout"] : []), "-f", String(p), "-l", String(p), pdf, "-"], { encoding: "utf8" });
const limpio = (s) => s.replace(/\s+/g, " ").trim();

// -----------------------------------------------------------------------------
// GRI
// -----------------------------------------------------------------------------
const GRI = [
  { estandar: "GRI 2", edicion: "2021", es: /^GRI 2_ Contenidos Generales 2021.*\.pdf$/i, n: 30 },
  { estandar: "GRI 3", edicion: "2021", es: /^GRI 3_ Temas Materiales 2021.*\.pdf$/i, n: 3 },
];
const pilarGri = (codigo) => {
  const [a, b] = codigo.replace(/^GRI /, "").split("-").map(Number);
  return a === 2 && b >= 9 && b <= 21 ? "gobernanza" : "estrategia";
};
// Pies de página y marcas de columna del PDF en español.

/**
 * Contenidos de una norma GRI en español: código, título del índice y página del ARCHIVO donde empieza el contenido
 * (la primera página después del índice con un encabezado «Contenido N-M …» compatible con el del índice).
 */
function contenidosGri(pdf, num) {
  const n = paginas(pdf);
  const re = new RegExp(`^Contenido (${num}-\\d+) (.+)$`);
  const indice = new Map();
  const porPagina = [];
  for (let p = 1; p <= n; p++) {
    const lineas = texto(pdf, p).split("\n").map((l) => l.trim());
    porPagina[p] = lineas;
    const hits = lineas.map((l) => l.match(re)).filter(Boolean);
    if (hits.length >= 3) for (const h of hits) if (!indice.has(h[1])) indice.set(h[1], { titulo: h[2].trim(), pIndice: p });
  }
  const ultimaIndice = Math.max(...[...indice.values()].map((x) => x.pIndice));
  const out = [];
  for (const [codigo, { titulo }] of indice) {
    let pagina = null, linea = null;
    for (let p = ultimaIndice + 1; p <= n && pagina === null; p++) {
      const lineas = porPagina[p];
      for (let i = 0; i < lineas.length; i++) {
        const m = lineas[i].match(re);
        if (m && m[1] === codigo && (titulo.startsWith(m[2].trim()) || m[2].trim().startsWith(titulo))) { pagina = p; linea = i; break; }
      }
    }
    out.push({ codigo, titulo, pagina, linea });
  }
  return { out, porPagina };
}

/** Palabras de una página con su posición (pdftotext -bbox-layout), y los bloques con su texto. */
function cajas(pdf, p) {
  const x = execFileSync("pdftotext", ["-bbox-layout", "-f", String(p), "-l", String(p), pdf, "-"], { encoding: "utf8" });
  const ent = (t) => t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const palabra = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)">([^<]*)<\/word>/g;
  const bloques = [...x.matchAll(/<block xMin="([\d.]+)" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)">([\s\S]*?)<\/block>/g)].map((b) => ({
    x0: +b[1], y0: +b[2], y1: +b[3], texto: limpio([...b[4].matchAll(palabra)].map((w) => ent(w[4])).join(" ")),
  }));
  const palabras = [...x.matchAll(palabra)].map((w) => ({ x: +w[1], y: +w[2], y1: +w[3], t: ent(w[4]) }));
  return { bloques, palabras };
}
const MARGEN = 120; // las etiquetas REQUERIMIENTOS / ORIENTACIONES van a la izquierda de esta x; el texto, a la derecha
const CABEZA = 60; // encabezado de página (número y nombre de la norma)
const PIE = 815;

/**
 * Texto literal del requisito: la columna principal entre el encabezado del contenido y la etiqueta
 * «ORIENTACIONES» (o «RECOMENDACIONES», o el siguiente contenido), aunque cruce de página. Las palabras se agrupan
 * por renglón (misma altura) y se leen de izquierda a derecha, para que el inciso («a.», «i.») quede con su texto.
 */
function requisitoGri(pdf, c) {
  const renglones = [];
  for (let p = c.pagina, primera = true; p <= c.paginas; p++, primera = false) {
    const { bloques, palabras } = cajas(pdf, p);
    let desde = CABEZA;
    if (primera) {
      const h = bloques.find((b) => b.texto.startsWith(`Contenido ${c.codigo} `));
      if (!h) salir(`GRI ${c.codigo}: no se encontró su encabezado en la página ${p}.`);
      desde = h.y1;
    }
    // La etiqueta del margen va centrada junto a su primer bloque: el corte es el inicio de ese bloque.
    const etiquetas = palabras.filter((w) => w.x < MARGEN && /^(ORIENTACIONES|RECOMENDACIONES)$/.test(w.t) && w.y > desde);
    const cortes = [
      ...etiquetas.map((w) => Math.min(w.y, ...bloques.filter((b) => b.x0 >= MARGEN && b.y0 <= w.y + 1 && b.y1 >= w.y - 1 && b.y0 > desde).map((b) => b.y0))),
      ...bloques.filter((b) => b.x0 >= MARGEN && /^(Contenido \d-\d+ |Orientaciones para |Orientaciones$)/.test(b.texto) && b.y0 > desde).map((b) => b.y0),
    ];
    const hasta = cortes.length ? Math.min(...cortes) : PIE;
    const zona = palabras.filter((w) => w.x >= MARGEN && w.y >= desde - 0.5 && w.y < hasta - 0.5 && w.y1 <= PIE);
    zona.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const w of zona) {
      const r = renglones.at(-1);
      if (r && r.p === p && Math.abs(r.y - w.y) < 3) r.ws.push(w);
      else renglones.push({ p, y: w.y, ws: [w] });
    }
    if (cortes.length) break;
  }
  return limpio(renglones.map((r) => r.ws.sort((a, b) => a.x - b.x).map((w) => w.t).join(" ")).join(" "));
}

const filasGri = [];
for (const g of GRI) {
  const num = g.estandar.split(" ")[1];
  const archivo = fs.existsSync(GRI_ES) ? fs.readdirSync(GRI_ES).find((f) => g.es.test(f)) : null;
  if (!archivo) salir(`${g.estandar}: no está el PDF oficial en español en normas/_fuentes/gri-es/.`);
  const es = contenidosGri(path.join(GRI_ES, archivo), num);
  if (es.out.length !== g.n || es.out.some((c) => !c.pagina)) salir(`${g.estandar}: se esperaban ${g.n} contenidos con página en ${archivo}; hay ${es.out.length} (${es.out.filter((c) => !c.pagina).map((c) => c.codigo).join(", ")} sin página).`);
  for (const c of es.out) {
    const req = requisitoGri(path.join(GRI_ES, archivo), { ...c, paginas: es.porPagina.length - 1 });
    if (!/^(La organización debe|Para cada tema material)/.test(req) || req.length < 40) salir(`GRI ${c.codigo}: el requisito extraído no empieza como un requisito (${req.slice(0, 80)}…); revisa el extractor.`);
    filasGri.push({
      codigo: `GRI ${c.codigo}`, marco: "GRI", norma: "S1", pilar: pilarGri(`GRI ${c.codigo}`), seccion_indice: null,
      estandar: g.estandar, edicion: g.edicion, descripcion: req, pagina_origen: c.pagina,
    });
    if (probar) console.log(`  GRI ${c.codigo} p${c.pagina} (${req.length} car.) ${req.slice(0, 110)}…${req.slice(-60)}`);
  }
  console.log(`${g.estandar} ${g.edicion}: ${g.n} contenidos, texto literal en español (${archivo})`);
}

// -----------------------------------------------------------------------------
// SASB FN-CB
// -----------------------------------------------------------------------------
const FNCB = { pdf: path.join(SASB, "Financials/commercial-banks-standard_en-gb.pdf"), estandar: "SASB FN-CB", edicion: "2025-12", prefijo: "FN-CB" };
const filasSasb = [];
{
  const pdf = FNCB.pdf;
  const n = paginas(pdf);
  const primera = texto(pdf, 1) + texto(pdf, 2);
  if (!/VERSION 2025-12/.test(primera)) salir("FN-CB: la portada no dice «VERSION 2025-12».");
  let tema = null;
  for (let p = 1; p <= n; p++) {
    const lineas = texto(pdf, p).split("\n").map((l) => l.trim());
    const iResumen = lineas.indexOf("Topic Summary");
    if (iResumen > 0) tema = limpio(lineas.slice(0, iResumen).filter(Boolean).join(" "));
    for (let i = 0; i < lineas.length; i++) {
      const m = lineas[i].match(/^(FN-CB-\d{3}[a-z]\.\d+)\. (.+)$/);
      if (!m) continue;
      const partes = [m[2]];
      for (const l of lineas.slice(i + 1, i + 8)) { if (!l || /^\d+(\.\d+)*\s/.test(l) || /^\d+$/.test(l)) break; partes.push(l); }
      filasSasb.push({ codigo: m[1], tema, descripcion: limpio(partes.join(" ")), pagina: p });
    }
    // Métricas de actividad: tabla 2 (no tienen protocolo propio). Columna izquierda de la tabla en modo -layout.
    const lay = texto(pdf, p, true).split("\n");
    const iT2 = lay.findIndex((l) => /Table 2\. Activity Metrics/.test(l));
    if (iT2 >= 0) {
      let bloque = [];
      const cerrar = () => {
        const cod = bloque.map((l) => l.match(/(FN-CB-000\.[A-Z])\s*$/)?.[1]).find(Boolean);
        if (cod) {
          const izq = bloque.map((l) => l.slice(0, 74).trim()).filter((t) => t && !/^(Number,|Presentation|currency)$/.test(t));
          filasSasb.push({ codigo: cod, tema: "Activity Metrics", descripcion: limpio(izq.join(" ")).replace(/([a-z])\d+$/, "$1"), pagina: p });
        }
        bloque = [];
      };
      for (const l of lay.slice(iT2 + 1)) {
        if (/^\s*\d+\s+Note to /.test(l) || /SUSTAINABILITY ACCOUNTING STANDARD/.test(l)) break;
        if (!l.trim()) { cerrar(); continue; }
        if (/ACTIVITY METRIC|UNIT OF|MEASURE/.test(l)) continue;
        bloque.push(l);
      }
      cerrar();
    }
  }
  const codigos = new Set(filasSasb.map((f) => f.codigo));
  if (filasSasb.length !== 17 || codigos.size !== 17) salir(`FN-CB: se esperaban 17 métricas (15 contables y 2 de actividad); hay ${filasSasb.length} (${[...codigos].join(", ")}).`);
  if (filasSasb.some((f) => !f.tema || f.descripcion.length < 20)) salir("FN-CB: alguna métrica quedó sin tema o con texto corto; revisa el extractor.");
  console.log(`${FNCB.estandar} ${FNCB.edicion}: 17 métricas (${filasSasb.filter((f) => !f.codigo.includes("000.")).length} contables y ${filasSasb.filter((f) => f.codigo.includes("000.")).length} de actividad), en inglés`);
  if (probar) for (const f of filasSasb) console.log(`  ${f.codigo} p${f.pagina} [${f.tema}] ${f.descripcion}`);
}
const filas = [
  ...filasGri,
  ...filasSasb.map((f) => ({
    codigo: f.codigo, marco: "SASB", norma: "S2", pilar: "metricas", seccion_indice: f.tema,
    estandar: FNCB.estandar, edicion: FNCB.edicion, descripcion: f.descripcion, pagina_origen: f.pagina,
  })),
];
if (probar) { console.log(`Total: ${filas.length} filas (prueba; no se escribió nada).`); process.exit(0); }

// -----------------------------------------------------------------------------
// SQL
// -----------------------------------------------------------------------------
const q = (v) => (v === null ? "null" : typeof v === "boolean" || typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const valores = filas.map((f) =>
  `  (${[f.codigo, f.marco, `${q(f.norma)}::public.norma_niif`, `${q(f.pilar)}::public.pilar_niif`, f.seccion_indice, f.estandar, f.edicion, f.descripcion, f.pagina_origen, VERSION_TAXONOMIA]
    .map((v, i) => (i === 2 || i === 3 ? v : q(v))).join(", ")})`
);
const conteo = Object.entries(filas.reduce((a, f) => ({ ...a, [f.estandar]: (a[f.estandar] ?? 0) + 1 }), {})).map(([k, v]) => `${k}: ${v}`).join(" · ");
const sql = `-- =============================================================================
-- CATÁLOGO GRI/SASB, NIVEL MÍNIMO (encargo docs/encargos/2026-10-31-catalogo-gri-sasb.md, Fase 1).
-- GENERADO por scripts/catalogo/generar-gri-sasb.mjs desde los PDF oficiales de normas/_fuentes/ el ${new Date().toISOString().slice(0, 10)}.
-- No se edita a mano: se corrige el generador y se genera una migración nueva.
--
-- ${conteo} · total ${filas.length}.
--
-- Licencias: las de la Fundación IFRS (NIIF S1/S2 y SASB) y la de GRI existen, son de reproducción en producto y
-- las resguarda el equipo legal de Apalache (confirmación de Esteban, 31/10/2026). El texto va literal de la norma.
-- GRI 2 y GRI 3: texto literal del requisito («REQUERIMIENTOS») del PDF oficial en español, sin las orientaciones.
-- SASB FN-CB 2025-12: texto literal en inglés hasta que haya traducción oficial.
--
-- IDEMPOTENTE: upsert por (codigo, version_taxonomia). Solo filas de marco GRI y SASB; no toca ninguna NIIF ni las
-- cuatro de la «Extensión GRI» (otros códigos). Una fila por código en docs/suplemento-s1s2/auditoria-catalogo.md.
-- =============================================================================

insert into public.datapoints_taxonomia
  (codigo, marco, norma, pilar, seccion_indice, estandar, edicion, descripcion, pagina_origen, version_taxonomia)
values
${valores.join(",\n")}
on conflict (codigo, version_taxonomia) do update set
  marco = excluded.marco,
  norma = excluded.norma,
  pilar = excluded.pilar,
  seccion_indice = excluded.seccion_indice,
  estandar = excluded.estandar,
  edicion = excluded.edicion,
  descripcion = excluded.descripcion,
  pagina_origen = excluded.pagina_origen,
  activo = true
where public.datapoints_taxonomia.marco in ('GRI', 'SASB');
`;
fs.writeFileSync(salida, sql);
console.log(`✓ ${salida}: ${filas.length} filas (${conteo}).`);
