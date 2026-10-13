#!/usr/bin/env node
// =============================================================================
// Genera el Suplemento del demo con una selección de editoriales y cuenta lo
// que sale (encargo 2026-10-06-suplemento-calidad, Paso 1).
//
//   node scripts/suplemento/generar-demo.mjs <solo-normativo|recomendados|todos> <carpeta> [baseUrl]
//
// CUESTA DINERO: cada bloque es una llamada al modelo (~$0.22). Solo contra una
// app LOCAL apuntada al proyecto dev (NEXT_PUBLIC_SUPABASE_URL con el ref de
// dev) o contra traceline-dev, que apunta al mismo proyecto; nunca staging. Entra como el analista del seed (ANALISTA_PASSWORD o la
// del seed local) por la misma ruta que la pantalla: POST …/generar con la
// selección, cada bloque por su ruta (el 29 primero, luego de tres en tres) y el
// Word por …/word. Convierte el Word a PDF con LibreOffice para contar páginas.
//
// Escribe en <carpeta>: <selección>.docx, <selección>.pdf y <selección>.json con
// bloques por estado, páginas, costo y tokens. No imprime credenciales.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";

const [seleccion, carpeta, BASE = "http://localhost:3014"] = process.argv.slice(2);
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REF_DEV = "kmjkoxecxcujxixlxwlb";
const REPORTE = process.env.REPORTE_ID || "20000000-0000-0000-0000-000000000001";
// Claves de los editoriales, copiadas de lib/suplemento/bloques.ts (clase). Si la
// clasificación cambia, se actualizan aquí: la ruta ignora claves que no existan.
const RECOMENDADOS = ["materialidad", "estructura_gobierno"];
const OPCIONALES = ["carta_direccion", "historia", "modelo_negocio", "intro_gobernanza", "trayectoria_sostenibilidad", "contexto_estrategico"];

if (!["solo-normativo", "recomendados", "todos"].includes(seleccion) || !carpeta) {
  console.error("Uso: generar-demo.mjs <solo-normativo|recomendados|todos> <carpeta> [baseUrl]");
  process.exit(2);
}
// traceline-dev también vale: apunta al proyecto dev de Esteban (especificación §10) y es
// donde se mide el A8 de v40 en un dyno real (encargo 2026-10-11-suplemento-a-produccion, Paso 3).
const APP_DEV = "https://traceline-dev-d4fd7a3cda04.herokuapp.com";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE) && BASE !== APP_DEV) { console.error(`✗ Solo contra una app local o traceline-dev, no ${BASE}.`); process.exit(2); }
if (!URL_SB.includes(REF_DEV)) { console.error("✗ Solo contra el proyecto dev (NEXT_PUBLIC_SUPABASE_URL de dev)."); process.exit(2); }

const jar = new Map();
const db = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "analista@irstrat.example", password: process.env.ANALISTA_PASSWORD || "Demo2025!" });
if (eLogin) { console.error(`✗ login: ${eLogin.message}`); process.exit(2); }
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
// Cada petición se mide desde el cliente: ninguna debe pasar de los 30 s del router de Heroku.
const peticiones = [];
const api = async (metodo, ruta, cuerpo) => {
  const t0 = Date.now();
  const r = await fetch(`${BASE}${ruta}`, { method: metodo, headers: { cookie: cookie(), "content-type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  peticiones.push({ metodo, ruta: ruta.replace(/[0-9a-f-]{36}/g, ":id").replace(/\/bloque\/\d+/, "/bloque/:n"), status: r.status, ms: Date.now() - t0 });
  return r;
};

const editoriales = seleccion === "solo-normativo" ? [] : seleccion === "recomendados" ? RECOMENDADOS : [...RECOMENDADOS, ...OPCIONALES];

const inicio = Date.now();
const r = await api("POST", `/api/suplemento/${REPORTE}/generar`, { editoriales });
const abierto = await r.json();
if (!r.ok) { console.error(`✗ generar: ${r.status} ${abierto.error}`); process.exit(1); }
console.log(`documento ${abierto.documentoId.slice(0, 8)}… v${abierto.version} · por generar ${abierto.porGenerar.length} · no aplican ${abierto.noAplican.length} · no seleccionados ${abierto.noSeleccionados.length}`);

async function uno(n) {
  const p = await api("POST", `/api/suplemento/${abierto.documentoId}/bloque/${n}`, {});
  if (p.status !== 202 && p.status !== 409) return false;
  const hasta = Date.now() + 4 * 60 * 1000;
  while (Date.now() < hasta) {
    await new Promise((res) => setTimeout(res, 3000));
    const c = await api("GET", `/api/suplemento/${abierto.documentoId}/bloque/${n}`);
    if (!c.ok) continue;
    const b = await c.json();
    if (b.estado !== "generando" && b.estado !== "en_cola") return ["borrador", "no_aplica", "pendiente_adjunto"].includes(b.estado);
  }
  return false;
}
const cola = abierto.porGenerar.filter((n) => n !== abierto.primero);
const fallos = [];
if (abierto.primero !== undefined && !(await uno(abierto.primero))) fallos.push(abierto.primero);
await Promise.all(Array.from({ length: 3 }, async () => { for (;;) { const n = cola.shift(); if (n === undefined) return; if (!(await uno(n))) fallos.push(n); } }));
for (const n of [...fallos]) { if (await uno(n)) fallos.splice(fallos.indexOf(n), 1); }

// Cierre de pendientes (Paso 5c) y coherencia encadenada, como la pantalla: el
// servidor los corre fuera de la petición (fix/pre-v40); aquí se consulta el estado.
const inicioCierre = new Date().toISOString();
const cierre = await api("POST", `/api/suplemento/${abierto.documentoId}/cierre`, { coherencia: true });
let cierreJson = null;
if (cierre.status === 202) {
  const hasta = Date.now() + 15 * 60 * 1000;
  while (Date.now() < hasta) {
    await new Promise((res) => setTimeout(res, 4000));
    const e = await (await api("GET", `/api/suplemento/${abierto.documentoId}/cierre`)).json();
    if (e.estado === "listo") { cierreJson = { cierres: e.resultado?.cierres ?? [], costo: e.resultado?.costo_usd ?? 0 }; break; }
    if (e.estado === "error") break;
  }
}
const cierres = cierreJson ? { verificados: cierreJson.cierres.map((c) => ({ bloque: c.bloque, dueno: c.dueno, veredicto: c.veredicto })), costoUsd: cierreJson.costo } : null;
console.log(`cierre de pendientes: ${cierres ? `${cierres.verificados.filter((c) => c.veredicto === "responde").length} cerrados de ${cierres.verificados.length} verificados ($${cierres.costoUsd.toFixed(4)})` : `error ${cierre.status}`}`);

// Validador cruzado (Paso 5b): solo se cuenta. Ya no reintenta (decisión de
// Esteban al cerrar el 5b); sus discrepancias llegan a la coherencia.
const cruzado = { discrepancias: null };
{
  const v = await api("GET", `/api/suplemento/${abierto.documentoId}/cruzado`);
  if (v.ok) cruzado.discrepancias = (await v.json()).discrepancias.map((x) => ({ bloque: x.bloque, tipo: x.tipo, otro: x.otroBloque, detalle: x.detalle.slice(0, 200) }));
  else cruzado.error = v.status;
}
console.log(`validador cruzado: ${cruzado.discrepancias?.length ?? "—"} discrepancias (a la coherencia, sin reintento)`);

// Pasada de coherencia al final (Paso 3): la lanzó el servidor al terminar el
// cierre; se espera la que se abrió después de pedirlo y se cuenta.
let coherencia = { http: cierre.status };
{
  const hasta = Date.now() + 8 * 60 * 1000;
  while (Date.now() < hasta) {
    await new Promise((res) => setTimeout(res, 5000));
    const c = await api("GET", `/api/suplemento/${abierto.documentoId}/coherencia`);
    const d = c.ok ? await c.json() : null;
    if (d && new Date(d.created_at) >= new Date(inicioCierre) && d.estado !== "generando") {
      coherencia = { estado: d.estado, observaciones: (d.observaciones ?? []).length, descartadas: d.descartadas, costoUsd: Number(d.costo_usd), segundos: Math.round(d.duracion_ms / 1000), error: d.error };
      break;
    }
  }
}

const { data: bloques } = await db.from("documentos_bloques").select("numero, estado, costo_usd, tokens_entrada, tokens_salida, pendientes, duracion_ms").eq("documento_id", abierto.documentoId);
const segs = bloques.filter((b) => b.duracion_ms).map((b) => b.duracion_ms / 1000).sort((a, b) => a - b);
const pct = (q) => (segs.length ? Number(segs[Math.min(segs.length - 1, Math.floor(q * segs.length))].toFixed(1)) : null);
const porRuta = {};
for (const x of peticiones) { const k = `${x.metodo} ${x.ruta}`; porRuta[k] = { n: (porRuta[k]?.n ?? 0) + 1, maxMs: Math.max(porRuta[k]?.maxMs ?? 0, x.ms) }; }
const porEstado = {};
for (const b of bloques) porEstado[b.estado] = (porEstado[b.estado] ?? 0) + 1;
const costo = bloques.reduce((s, b) => s + Number(b.costo_usd ?? 0), 0);

fs.mkdirSync(carpeta, { recursive: true });
const w = await api("GET", `/api/suplemento/${abierto.documentoId}/word`);
const docx = path.join(carpeta, `${seleccion}.docx`);
fs.writeFileSync(docx, Buffer.from(await w.arrayBuffer()));
execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", carpeta, docx], { stdio: "ignore" });
const pdf = fs.readFileSync(path.join(carpeta, `${seleccion}.pdf`)).toString("latin1");
const paginas = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length;

const resumen = {
  seleccion,
  editoriales,
  documento: abierto.documentoId,
  version: abierto.version,
  bloquesPorEstado: porEstado,
  bloquesEnElWord: bloques.filter((b) => b.estado === "borrador").length,
  fallos,
  paginas,
  costoUsd: Number(costo.toFixed(4)),
  tokensEntrada: bloques.reduce((s, b) => s + (b.tokens_entrada ?? 0), 0),
  tokensSalida: bloques.reduce((s, b) => s + (b.tokens_salida ?? 0), 0),
  minutos: Number(((Date.now() - inicio) / 60000).toFixed(1)),
  bloquesSegundos: { mediana: pct(0.5), p90: pct(0.9), maximo: segs.length ? Number(segs.at(-1).toFixed(1)) : null },
  peticiones: { total: peticiones.length, maxMs: Math.max(...peticiones.map((x) => x.ms)), masDe30s: peticiones.filter((x) => x.ms > 30000).length, status5xx: peticiones.filter((x) => x.status >= 500).length, porRuta },
  coherencia,
  cruzado,
  cierres,
  word: w.status,
};
fs.writeFileSync(path.join(carpeta, `${seleccion}.json`), JSON.stringify(resumen, null, 1));
console.log(JSON.stringify(resumen));
process.exit(fallos.length ? 1 : 0);
