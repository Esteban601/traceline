#!/usr/bin/env node
// =============================================================================
// Auditoría mecánica del mapeo del Formato electrónico (encargo
// 2026-10-24-deuda-s2-formato, Fase 1). Solo lectura.
//
//   node --env-file=../vert-evidencia/.env.local --experimental-strip-types \
//        --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/formato/auditar-mapeo.mjs <plantilla.xlsx> <salida.md> [--demo <reporte_id>]
//
// Para cada fila del JSON con datapoint, compara la referencia normativa de la
// fila en la plantilla con la del datapoint (norma, párrafo, inciso):
//   · primera pasada: columna A de la propia fila;
//   · segunda pasada (filas sin columna A): columna G de la fila o, si no tiene,
//     la columna A de la fila anterior más cercana que la tenga. Se marca la fuente.
// Relaciones: «igual»; «parcial» (el datapoint es un inciso de lo que pide la
// fila); «más general» (el datapoint es un ancestro de lo que pide la fila);
// «S1→S2» (la fila solo cita NIIF S1 y el datapoint es de NIIF S2: correspondencia
// del alivio E5, no se juzga aquí); «distinta» (ninguna relación).
// Con --demo, agrega qué escribe hoy el llenado en la columna K (solo contra dev).
// No imprime credenciales. La plantilla no está en git (CLAUDE.md §4).
// =============================================================================
import fs from "node:fs";
import JSZip from "jszip";
import mapeoVersionado from "../../docs/suplemento-s1s2/mapeo-formato-electronico.json" with { type: "json" };

const args = process.argv.slice(2);
const iDemo = args.indexOf("--demo");
const reporte = iDemo === -1 ? null : args[iDemo + 1];
// --mapeo <json>: otro JSON del mapeo (p. ej. el de antes de las correcciones); por omisión, el versionado.
const iMapeo = args.indexOf("--mapeo");
const mapeo = iMapeo === -1 ? mapeoVersionado : JSON.parse(fs.readFileSync(args[iMapeo + 1], "utf8"));
const valoresDeOpcion = new Set([iDemo, iMapeo].filter((i) => i !== -1).map((i) => i + 1));
const [plantilla, salida] = args.filter((a, i) => !a.startsWith("--") && !valoresDeOpcion.has(i));
if (!plantilla || !salida) { console.error("Uso: auditar-mapeo.mjs <plantilla.xlsx> <salida.md> [--demo <reporte_id>]"); process.exit(2); }

// ---------- Plantilla: columnas A, C, D y G por fila ----------
async function leerPlantilla(archivo) {
  const zip = await JSZip.loadAsync(fs.readFileSync(archivo));
  const wb = await zip.file("xl/workbook.xml").async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const rid = wb.match(/<sheet [^>]*name="Estructura Formato Electronico"[^>]*r:id="([^"]+)"/)[1];
  const target = (rels.match(new RegExp(`<Relationship [^>]*Id="${rid}"[^>]*/>`))[0].match(/Target="([^"]+)"/))[1];
  const ss = zip.file("xl/sharedStrings.xml")
    ? (await zip.file("xl/sharedStrings.xml").async("string")).split(/<si>/).slice(1).map((s) => [...s.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join(""))
    : [];
  const xml = await zip.file("xl/" + target.replace(/^\/?xl\//, "")).async("string");
  const dec = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#10;/g, " ").replace(/\s+/g, " ").trim();
  const filas = new Map();
  for (const row of xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const r = Number(row[1]);
    const celdas = {};
    for (const c of row[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, col, attrs, inner = ""] = c;
      if (!["A", "C", "D", "G"].includes(col)) continue;
      let v = inner.match(/<v>([^<]*)<\/v>/)?.[1];
      if (v === undefined) v = [...inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join("") || undefined;
      else if (/t="s"/.test(attrs)) v = ss[Number(v)];
      if (v !== undefined && dec(String(v))) celdas[col] = dec(String(v));
    }
    filas.set(r, celdas);
  }
  return filas;
}

// ---------- Referencias normativas: «NIIF S2 14(a)(i)» → {norma, ruta} ----------
const ROMANOS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
const LETRAS = "abcdefghijklmnopqrstuvwxyz".split("");
function rangoIncisos(de, a) {
  for (const serie of [ROMANOS, LETRAS, Array.from({ length: 20 }, (_, i) => String(i + 1))]) {
    const i = serie.indexOf(de), j = serie.indexOf(a);
    if (i !== -1 && j !== -1 && j >= i) return serie.slice(i, j + 1);
  }
  return [de, a];
}
function rangoParrafos(de, a) {
  const [, p1, n1] = de.match(/^([A-Z]*)(\d+)$/) ?? [];
  const [, p2, n2] = a.match(/^([A-Z]*)(\d+)$/) ?? [];
  if (!n1 || !n2) return [de, a];
  const pref = p1 || p2 === "E" ? p1 : p2; // «EI14 a E18»: errata del catálogo, se toma el prefijo del inicio
  return Array.from({ length: Number(n2) - Number(n1) + 1 }, (_, i) => `${pref}${Number(n1) + i}`);
}
function parsearTramo(norma, t) {
  // Párrafo(s): «46-49», «B1- B18», «14 a E18», «29B», «40».
  const m = t.match(/^((?:EI|E|B)?\d+[A-Z]?)(?:\s*(?:-|a(?=\s*(?:EI|E|B)?\d))\s*((?:EI|E|B)?\d+[A-Z]?))?/);
  if (!m) return [];
  const parrafos = m[2] ? rangoParrafos(m[1], m[2]) : [m[1]];
  let s = t.slice(m[0].length);
  const niveles = [];
  for (;;) {
    s = s.replace(/^\s+/, "");
    let x;
    if ((x = s.match(/^\(([a-z0-9]+)\)/))) { niveles.push([x[1]]); s = s.slice(x[0].length); continue; }
    if (niveles.length && (x = s.match(/^a\s*\(([a-z0-9]+)\)/))) { const nv = niveles[niveles.length - 1]; niveles[niveles.length - 1] = rangoIncisos(nv[nv.length - 1], x[1]); s = s.slice(x[0].length); continue; }
    if (niveles.length && (x = s.match(/^(?:,\s*|y\s*)\(([a-z0-9]+)\)/))) { niveles[niveles.length - 1].push(x[1]); s = s.slice(x[0].length); continue; }
    if (!niveles.length && (x = s.match(/^([a-z])(?![a-z])/))) { niveles.push([x[1]]); s = s.slice(x[0].length); continue; }
    break;
  }
  const rutas = [];
  const expandir = (pref, k) => { if (k === niveles.length) { rutas.push(pref); return; } for (const v of niveles[k]) expandir([...pref, v], k + 1); };
  for (const p of parrafos) expandir([p], 0);
  return rutas.map((ruta) => ({ norma, ruta }));
}
export function referencias(texto) {
  if (!texto) return [];
  const out = [];
  // «NIF S2 29 (e)»: errata de la plantilla (filas 350, 371, 373, 396); cuenta como NIIF.
  const partes = texto.replace(/NIIF\s+NIIF/g, "NIIF").split(/NII?F\s+(S[12])\s*/).slice(1);
  for (let i = 0; i < partes.length; i += 2) {
    const norma = partes[i];
    // «29 (b) · B65 (b)»: cada tramo separado por «·» es una referencia propia.
    // «23 y 29 (a)(i)», «B64 y B65 inciso (a)»: varios párrafos en un tramo; «inciso» es texto de la plantilla.
    const tramos = partes[i + 1].replace(/\binciso\s+/g, "").split(/·|\s+y\s+(?=(?:EI|E|B)?\d)|,\s*(?=(?:EI|E|B)?\d)|(?<!(?:-|\ba))\s+(?=(?:EI|E|B)\d)/);
    for (const tramo of tramos) out.push(...parsearTramo(norma, tramo.trim()));
  }
  return out;
}
const clave = (r) => `${r.norma} ${r.ruta[0]}${r.ruta.slice(1).map((x) => `(${x})`).join("")}`;
const esPrefijo = (a, b) => a.length <= b.length && a.every((x, i) => x === b[i]);

function relacion(refFila, refDp) {
  if (!refFila.length || !refDp.length) return "sin referencia";
  const s2 = refFila.filter((r) => r.norma === "S2");
  const normasDp = new Set(refDp.map((r) => r.norma));
  const comparables = s2.length && normasDp.has("S2") ? s2 : refFila.filter((r) => normasDp.has(r.norma));
  if (!comparables.length) return "S1→S2";
  let mejor = "distinta";
  const orden = ["distinta", "más general", "parcial", "igual"];
  for (const a of comparables) for (const d of refDp) {
    if (a.norma !== d.norma) continue;
    const r = esPrefijo(a.ruta, d.ruta) ? (a.ruta.length === d.ruta.length ? "igual" : "parcial") : esPrefijo(d.ruta, a.ruta) ? "más general" : "distinta";
    if (orden.indexOf(r) > orden.indexOf(mejor)) mejor = r;
  }
  return mejor;
}

// ---------- Valores del demo (opcional, solo dev) ----------
async function valoresDemo(reporteId) {
  const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!URL_SB.includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ --demo solo contra el proyecto dev."); process.exit(2); }
  const { createServerClient } = await import("@supabase/ssr");
  const { insumosDelFormato } = await import("../../lib/formato/datos.ts");
  const { llenarFormato } = await import("../../lib/formato/llenar.ts");
  const jar = new Map();
  const db = createServerClient(URL_SB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: process.env.STAFF_PASSWORD || "Demo2025!" });
  if (error) { console.error("✗ login del staff del seed falló"); process.exit(2); }
  const ins = await insumosDelFormato(db, reporteId);
  if (!ins.ok) { console.error(`✗ ${ins.status} ${ins.error}`); process.exit(1); }
  return llenarFormato(ins.datos);
}

// ---------- Auditoría ----------
const plantillaFilas = await leerPlantilla(plantilla);
const demo = reporte ? await valoresDemo(reporte) : null;
const corto = (s, n = 160) => { const t = (s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
const celdaK = (fila) => {
  if (!demo) return "—";
  const v = demo.get(fila);
  if (!v) return "(sin valor)";
  return `${v.origen}: ${v.texto == null ? "(vacía)" : `«${corto(v.texto, 150)}» (${v.texto.length} car.)`}`;
};
const etiqueta = (f) => corto([f.C, f.D].filter(Boolean).join(" · "), 120) || "(sin etiqueta)";
const esc = (s) => String(s).replace(/\|/g, "\\|");

const filas = [];
for (const c of mapeo.conceptos.filter((x) => x.datapoint)) {
  const f = plantillaFilas.get(c.fila) ?? {};
  let fuente = "A", texto = f.A ?? "";
  if (!referencias(texto).length) {
    if (referencias(f.G).length) { fuente = "G (2.ª pasada)"; texto = f.G; }
    else {
      let k = c.fila - 1;
      while (k > 0 && !referencias(plantillaFilas.get(k)?.A).length) k--;
      fuente = k > 0 ? `A de la fila ${k} (2.ª pasada)` : "ninguna";
      texto = k > 0 ? plantillaFilas.get(k).A : "";
    }
  }
  const refFila = referencias(texto), refDp = referencias(c.datapoint);
  filas.push({ c, f, fuente, texto, rel: relacion(refFila, refDp), refFila: refFila.map(clave), refDp: refDp.map(clave) });
}

const por = (rel) => filas.filter((x) => x.rel === rel);
const tabla = (lista) => [
  "| Fila | Etiqueta | Referencia de la fila (fuente) | Datapoint mapeado → referencia | Qué escribe hoy el demo, último documento aprobado (K) |",
  "|---:|---|---|---|---|",
  ...lista.map((x) => `| ${x.c.fila} | ${esc(etiqueta(x.f))} | ${esc(x.texto || "—")} (${x.fuente}) | \`${esc(x.c.datapoint)}\` → ${esc(x.refDp.join(", ") || "sin referencia")} | ${esc(celdaK(x.c.fila))} |`),
];
const resumen = Object.entries(filas.reduce((a, x) => ((a[`${x.rel}${x.fuente === "A" ? "" : " · 2.ª pasada"}`] = (a[`${x.rel}${x.fuente === "A" ? "" : " · 2.ª pasada"}`] ?? 0) + 1), a), {})).map(([k, v]) => `${k}: ${v}`).join(" · ");
const md = [
  `# Auditoría mecánica del mapeo del Formato · ${new Date().toISOString().slice(0, 10)}`,
  "",
  `Filas del JSON con datapoint: ${filas.length}. ${resumen}.`,
  "",
  `## Distintas (${por("distinta").length})`, "", ...tabla(por("distinta")), "",
  `## Datapoint más general que lo que pide la fila (${por("más general").length})`, "", ...tabla(por("más general")), "",
  `## Parciales: el datapoint es un inciso de lo que pide la fila (${por("parcial").length})`, "", ...tabla(por("parcial")), "",
  `## Solo NIIF S1 en la fila, datapoint de NIIF S2 (correspondencia E5, no se juzga) (${por("S1→S2").length})`, "", ...tabla(por("S1→S2")), "",
  `## Sin referencia comparable (${por("sin referencia").length})`, "", ...tabla(por("sin referencia")), "",
];
fs.writeFileSync(salida, md.join("\n"));
console.log(`Filas con datapoint: ${filas.length}. ${resumen}.`);
console.log(`Distintas: ${por("distinta").map((x) => x.c.fila).join(", ") || "ninguna"}`);
console.log(`Informe: ${salida}`);
