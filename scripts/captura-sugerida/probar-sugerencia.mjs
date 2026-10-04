#!/usr/bin/env node
// =============================================================================
// PRUEBA DEL PASO 2 de la captura sugerida: sugerencia numérica con fuente.
//
//   CRON_SECRET=… node --experimental-strip-types scripts/captura-sugerida/probar-sugerencia.mjs [baseUrl]
//   CRON_SECRET=… node --experimental-strip-types scripts/captura-sugerida/probar-sugerencia.mjs --reusar "<marca>"
//
// SOLO contra el stack local. Requiere la app corriendo contra ese stack con
// ANTHROPIC_API_KEY y el mismo CRON_SECRET: cada sugerencia llama al modelo y
// cuesta (Sonnet 5.5; Fable 5.1 cuando la confianza es baja).
//
// Mismo camino que la aplicación: una solicitud por caso en Empresa Demo, con
// la unidad esperada del manifiesto; el área sube el archivo; la cola lo lee y,
// al quedar extraído, genera la sugerencia. Con --reusar se regeneran solo las
// sugerencias de una corrida anterior por /api/evidencias/sugerir, sin volver a
// leer los archivos.
//
// Además de los 24 casos, dos VARIANTES DE CONVERSIÓN (no cuentan en los 24):
// el mismo archivo con una solicitud que espera otra unidad.
//
// Clasifica cada caso numérico:
//   principal  — la cifra principal (convertida si hubo conversión) es la correcta
//   candidato  — la correcta está entre los candidatos
//   fallo      — hay sugerencia, pero la correcta no está
//   sin sugerencia — `fallida` (ninguna cifra con fuente localizable)
// y si la fuente citada para la cifra correcta es la del manifiesto. Las
// solicitudes de texto son del Paso 3: aquí solo se comprueba que no generan
// sugerencia numérica. Escribe resultados/paso2.json.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { mismaUnidad } from "../../lib/evidencias/unidades.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const iReusar = args.indexOf("--reusar");
const REUSAR = iReusar >= 0 ? args[iReusar + 1] : null;
const BASE = args.find((a, i) => !a.startsWith("--") && i !== iReusar + 1) || process.env.BASE_URL || "http://localhost:3003";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const CRON = process.env.CRON_SECRET;
const TENANT_DEMO = "10000000-0000-0000-0000-000000000001";
const REPORTE_DEMO = "20000000-0000-0000-0000-000000000001";
const MIME = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel", csv: "text/csv",
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png", jpg: "image/jpeg", webp: "image/webp", heic: "image/heic" };

if (!/127\.0\.0\.1|localhost/.test(URL_SB)) { console.error(`✗ Solo contra el stack local, no ${URL_SB}.`); process.exit(2); }
if (!CRON) { console.error("✗ Falta CRON_SECRET (el mismo con el que corre la app)."); process.exit(2); }

const { casos: base } = JSON.parse(fs.readFileSync(path.join(AQUI, "manifiesto.json"), "utf8"));
const porId = Object.fromEntries(base.map((c) => [c.id, c]));
const VARIANTES = [
  { ...porId.x01, id: "v01", variante: true, solicitud: { ...porId.x01.solicitud, unidad: "MWh" },
    esperado: { ...porId.x01.esperado, valor: 376.3, unidad: "MWh" }, notas: "Conversión kWh → MWh (factor 0.001)." },
  { ...porId.p06, id: "v02", variante: true, solicitud: { ...porId.p06.solicitud, unidad: "m3" },
    esperado: { ...porId.p06.esperado, valor: 18.9, unidad: "m3" }, notas: "Conversión L → m3 sobre un escaneado (factor 0.001)." },
];
const casos = [...base, ...VARIANTES];

const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "analista@irstrat.example", password: "Demo2025!" });
if (eLogin) throw new Error(`login staff: ${eLogin.message}`);

const t0 = Date.now();
let marca;
let ligados = []; // { caso, solicitudId }

if (REUSAR) {
  marca = REUSAR;
  const { data: sols } = await db.from("solicitudes").select("id, descripcion").like("descripcion", `${marca} caso %`);
  for (const s of sols ?? []) {
    const id = s.descripcion.split(" caso ").pop();
    const caso = casos.find((c) => c.id === id);
    if (caso) ligados.push({ caso, solicitudId: s.id });
  }
  console.log(`reusando ${ligados.length} solicitudes de ${marca}`);
  const { data: conts } = await db.from("evidencias_contenido").select("id, solicitud_id, estado")
    .in("solicitud_id", ligados.map((l) => l.solicitudId)).eq("estado", "extraido");
  for (const c of conts ?? []) {
    const r = await fetch(`${BASE}/api/evidencias/sugerir?contenido=${c.id}`, { method: "POST", headers: { "x-cron-secret": CRON } });
    const j = await r.json();
    const l = ligados.find((x) => x.solicitudId === c.solicitud_id);
    console.log(`  ${l?.caso.id}: HTTP ${r.status} · ${j.estado}${j.detalle ? ` (${j.detalle})` : ""}`);
  }
} else {
  // La evidencia la carga el ÁREA (Empresa Demo tiene staff_puede_cargar = false).
  const area = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data: sesArea, error: eArea } = await area.auth.signInWithPassword({ email: "operaciones@empresademo.example", password: "Demo2025!" });
  if (eArea) throw new Error(`login área: ${eArea.message}`);
  marca = `[captura-sugerida-p2 ${new Date().toISOString().slice(0, 16)}]`;
  const { data: maxOrden } = await db.from("solicitudes").select("orden").eq("reporte_id", REPORTE_DEMO).order("orden", { ascending: false }).limit(1).maybeSingle();
  let orden = (maxOrden?.orden ?? 0) + 1;
  for (const c of casos) {
    const { data: sol, error: eSol } = await db.from("solicitudes").insert({
      reporte_id: REPORTE_DEMO, titulo: c.solicitud.titulo, descripcion: `${marca} caso ${c.id}`,
      unidad_esperada: c.solicitud.unidad ?? null,
      area_asignada: "Operaciones", es_cuantitativa: c.naturaleza === "numerica", estado: "solicitado", orden: orden++,
    }).select("id").single();
    if (eSol) throw new Error(`solicitud ${c.id}: ${eSol.message}`);
    const bytes = fs.readFileSync(path.join(AQUI, "conjunto", c.archivo));
    const ruta = `${TENANT_DEMO}/${sol.id}/${c.archivo}`;
    const ext = c.archivo.split(".").pop();
    const { error: eUp } = await area.storage.from("evidencias").upload(ruta, bytes, { contentType: MIME[ext] ?? "application/octet-stream" });
    if (eUp) throw new Error(`subida ${c.id}: ${eUp.message}`);
    const { error: eEv } = await area.from("evidencias").insert({
      solicitud_id: sol.id, archivo_path: ruta, nombre_original: c.archivo, subido_por: sesArea.user.id, version: 0,
    });
    if (eEv) throw new Error(`evidencia ${c.id}: ${eEv.message}`);
    ligados.push({ caso: c, solicitudId: sol.id });
  }
  console.log(`${ligados.length} evidencias registradas (${marca})`);
  await area.auth.signOut();

  // La cola por el endpoint del cron, de tres en tres: cada elemento es una
  // lectura más una sugerencia (y a veces una segunda opinión), y fetch corta
  // una respuesta que tarda más de 300 s.
  const ids = ligados.map((l) => l.solicitudId);
  for (let vuelta = 1; vuelta <= 30; vuelta++) {
    const r = await fetch(`${BASE}/api/evidencias/procesar?maximo=3`, { method: "POST", headers: { "x-cron-secret": CRON } });
    const cuerpo = await r.json();
    console.log(`  vuelta ${vuelta}: HTTP ${r.status} · ${(cuerpo.resultados ?? []).map((x) => `${x.estado}${x.detalle ? ` [${x.detalle}]` : ""}`).join(" · ") || JSON.stringify(cuerpo.error ?? "nada")}`);
    const { count } = await db.from("evidencias_contenido").select("id", { count: "exact", head: true })
      .in("solicitud_id", ids).in("estado", ["pendiente", "procesando"]);
    if (!count) break;
  }
}
const segundos = Math.round((Date.now() - t0) / 1000);

// Lectura de resultados como staff (RLS: el staff ve todo).
const ids = ligados.map((l) => l.solicitudId);
const [{ data: conts }, { data: sugs }] = await Promise.all([
  db.from("evidencias_contenido").select("solicitud_id, estado, costo_usd, mensaje").in("solicitud_id", ids),
  db.from("sugerencias_captura").select("*").in("solicitud_id", ids).in("estado", ["sugerida", "fallida"]).order("created_at", { ascending: false }),
]);
const contDe = new Map((conts ?? []).map((c) => [c.solicitud_id, c]));
const sugDe = new Map();
for (const s of sugs ?? []) if (!sugDe.has(s.solicitud_id)) sugDe.set(s.solicitud_id, s); // la más reciente

const iguales = (a, b) => Math.abs(Number(a) - Number(b)) <= Math.max(1e-6, Math.abs(Number(b)) * 1e-6);
function mismaFuente(f, e) {
  if (!f || f.tipo !== e.tipo) return false;
  switch (e.tipo) {
    case "celda": return f.hoja === e.hoja && String(f.celda).toUpperCase() === e.celda;
    case "pagina": return f.pagina === e.pagina;
    case "parrafo": return f.parrafo === e.parrafo;
    case "tabla": return f.tabla === e.tabla && f.fila === e.fila && f.columna === e.columna;
    case "imagen": return true;
    default: return false;
  }
}
/** La cifra de una lectura en la unidad que espera el manifiesto. */
function enUnidadEsperada(l, unidad) {
  if (mismaUnidad(l.unidad, unidad)) return Number(l.valor);
  if (l.conversion && mismaUnidad(l.conversion.unidad, unidad)) return Number(l.conversion.valor);
  return null;
}
const describir = (f) => !f ? "—" : f.tipo === "celda" ? `${f.hoja}!${f.celda}` : f.tipo === "pagina" ? `p. ${f.pagina}` :
  f.tipo === "parrafo" ? `párr. ${f.parrafo}` : f.tipo === "tabla" ? `tabla ${f.tabla} f${f.fila} c${f.columna}` : "imagen";

const resultados = [];
for (const { caso: c, solicitudId } of ligados) {
  const s = sugDe.get(solicitudId);
  const cont = contDe.get(solicitudId);
  const costoLectura = Number(cont?.costo_usd ?? 0);
  const costoSug = Number(s?.costo_usd ?? 0);
  const fila = {
    id: c.id, archivo: c.archivo, tipo: c.tipo, variante: Boolean(c.variante), naturaleza: c.naturaleza,
    control: Boolean(c.control), lectura: cont?.estado ?? null,
    esperado: c.esperado.valor !== undefined ? `${c.esperado.valor} ${c.esperado.unidad} · ${describir(c.esperado.fuente)}` : null,
    estado_sugerencia: s?.estado ?? null,
    sugerido: s?.valor != null ? `${Number(s.valor)} ${s.unidad}${s.conversion ? ` → ${s.conversion.valor} ${s.conversion.unidad} (×${s.conversion.factor}, ${s.conversion.origen})` : ""} · ${describir(s.fuente)}` : null,
    periodo: s?.periodo ?? null, confianza: s?.confianza ?? null,
    candidatos: (s?.candidatos ?? []).map((k) => `${k.valor} ${k.unidad} ${k.periodo ?? ""} · ${describir(k.fuente)}${k.origen === "segunda_opinion" ? " (Fable)" : ""}`),
    segunda_opinion: s?.segunda_opinion?.modelo ? { modelo: s.segunda_opinion.modelo, coincide: s.segunda_opinion.coincide, costo_usd: s.segunda_opinion.costo_usd } : null,
    descartadas: s?.segunda_opinion?.descartadas ?? [],
    motivo: s?.motivo ?? s?.error ?? null, modelo: s?.modelo ?? null,
    tokens_entrada: s?.tokens_entrada ?? 0, tokens_salida: s?.tokens_salida ?? 0,
    costo_lectura: costoLectura, costo_sugerencia: costoSug,
    resultado: null, fuente_correcta: null,
  };
  if (c.control) {
    fila.resultado = !s && cont?.estado === "no_soportado" ? "control ok" : "control mal";
  } else if (c.naturaleza === "texto") {
    fila.resultado = !s ? "texto (Paso 3)" : "texto con sugerencia numérica (mal)";
  } else if (!s || s.estado === "fallida") {
    fila.resultado = "sin sugerencia";
  } else {
    const unidad = c.esperado.unidad;
    const principal = { valor: s.valor, unidad: s.unidad, conversion: s.conversion, fuente: s.fuente };
    if (iguales(enUnidadEsperada(principal, unidad), c.esperado.valor)) {
      fila.resultado = "principal";
      fila.fuente_correcta = mismaFuente(s.fuente, c.esperado.fuente);
    } else {
      const k = (s.candidatos ?? []).find((x) => iguales(enUnidadEsperada(x, unidad), c.esperado.valor));
      fila.resultado = k ? "candidato" : "fallo";
      fila.fuente_correcta = k ? mismaFuente(k.fuente, c.esperado.fuente) : null;
    }
  }
  resultados.push(fila);
}

fs.mkdirSync(path.join(AQUI, "resultados"), { recursive: true });
fs.writeFileSync(path.join(AQUI, "resultados", "paso2.json"), JSON.stringify({ corrida: marca, reusada: Boolean(REUSAR), segundos, resultados }, null, 2) + "\n");

console.log(`\n${marca} · ${segundos} s`);
for (const r of resultados) {
  console.log(`${r.id.padEnd(4)} ${r.resultado.padEnd(15)} fuente:${r.fuente_correcta === null ? "—" : r.fuente_correcta ? "✓" : "✗"}  conf:${(r.confianza ?? "—").padEnd(5)} ${r.segunda_opinion ? `2ª:${r.segunda_opinion.coincide ? "=" : "≠"} ` : ""}$${(r.costo_lectura + r.costo_sugerencia).toFixed(4)}`);
  if (r.esperado && r.naturaleza === "numerica") console.log(`       esperado ${r.esperado}\n       sugerido ${r.sugerido ?? "—"}${r.candidatos.length ? `\n       candidatos ${r.candidatos.join(" | ")}` : ""}${r.descartadas.length ? `\n       descartadas ${r.descartadas.map((d) => d.motivo).join(" | ")}` : ""}`);
}
const num = resultados.filter((r) => r.naturaleza === "numerica" && !r.control && !r.variante);
const cuenta = (k) => num.filter((r) => r.resultado === k).length;
const aciertos = num.filter((r) => r.resultado === "principal" || r.resultado === "candidato");
console.log(`\nnuméricos (${num.length}): principal ${cuenta("principal")} · candidato ${cuenta("candidato")} · fallo ${cuenta("fallo")} · sin sugerencia ${cuenta("sin sugerencia")}`);
console.log(`fuente correcta en ${aciertos.filter((r) => r.fuente_correcta).length} de ${aciertos.length} aciertos`);
const varis = resultados.filter((r) => r.variante);
console.log(`variantes de conversión: ${varis.map((r) => `${r.id} ${r.resultado}`).join(" · ")}`);
const sumar = (xs, k) => xs.reduce((s, r) => s + r[k], 0);
console.log(`costo de sugerencia: $${sumar(resultados, "costo_sugerencia").toFixed(4)} · lectura: $${sumar(resultados, "costo_lectura").toFixed(4)} · segundas opiniones: ${resultados.filter((r) => r.segunda_opinion).length}`);
await db.auth.signOut();
