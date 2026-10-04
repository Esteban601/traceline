#!/usr/bin/env node
// =============================================================================
// PRUEBA DEL PASO 3 de la captura sugerida: sugerencia de texto.
//
//   CRON_SECRET=… node scripts/captura-sugerida/probar-texto.mjs [baseUrl]
//   CRON_SECRET=… node scripts/captura-sugerida/probar-texto.mjs --reusar "<marca>"
//
// SOLO contra el stack local, con la app corriendo con ANTHROPIC_API_KEY y el
// mismo CRON_SECRET. Casos: los de texto del manifiesto (p03, w01, w03) y los
// del Paso 3 (t01 escaneado, t02 disperso, t03 que no cubre).
//
// Por el camino de la aplicación: solicitud narrativa (es_cuantitativa = false)
// en Empresa Demo, ligada a los códigos de la taxonomía del manifiesto (se
// buscan por igualdad con el código COPIADO del catálogo; si alguno no existe,
// aborta); el área sube el archivo; la cola lo lee y sugiere.
//
// Cada caso se califica:
//   · que cubre: extracto ≤ 150 palabras; cada fragmento ya viene verificado
//     literal en su fuente (lo exige el código; aquí se vuelve a comprobar);
//     frases clave del manifiesto presentes; fuentes esperadas citadas.
//     → completo / parcial (faltan frases o fuentes) / fallo (sin sugerencia).
//   · que no cubre (t03): «no» y sin extracto → correcto.
// Escribe resultados/paso3.json.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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
const MIME = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
const PALABRAS_MAX = 150;

if (!/127\.0\.0\.1|localhost/.test(URL_SB)) { console.error(`✗ Solo contra el stack local, no ${URL_SB}.`); process.exit(2); }
if (!CRON) { console.error("✗ Falta CRON_SECRET (el mismo con el que corre la app)."); process.exit(2); }

const casos = JSON.parse(fs.readFileSync(path.join(AQUI, "manifiesto.json"), "utf8")).casos.filter((c) => c.naturaleza === "texto");
const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "analista@irstrat.example", password: "Demo2025!" });
if (eLogin) throw new Error(`login staff: ${eLogin.message}`);

// Códigos → ids del catálogo, por igualdad con el código copiado verbatim.
const todos = [...new Set(casos.flatMap((c) => c.solicitud.codigos ?? []))];
const { data: dps } = await db.from("datapoints_taxonomia").select("id, codigo").in("codigo", todos);
const idDe = new Map((dps ?? []).map((d) => [d.codigo, d.id]));
const faltan = todos.filter((c) => !idDe.has(c));
if (faltan.length) { console.error(`✗ Códigos que no están en el catálogo: ${faltan.join(" · ")}`); process.exit(2); }

const t0 = Date.now();
let marca;
const ligados = [];
if (REUSAR) {
  marca = REUSAR;
  const { data: sols } = await db.from("solicitudes").select("id, descripcion").like("descripcion", `${marca} caso %`);
  for (const s of sols ?? []) {
    const caso = casos.find((c) => c.id === s.descripcion.split(" caso ").pop());
    if (caso) ligados.push({ caso, solicitudId: s.id });
  }
  const { data: conts } = await db.from("evidencias_contenido").select("id, solicitud_id").in("solicitud_id", ligados.map((l) => l.solicitudId)).eq("estado", "extraido");
  for (const c of conts ?? []) {
    const r = await fetch(`${BASE}/api/evidencias/sugerir?contenido=${c.id}`, { method: "POST", headers: { "x-cron-secret": CRON } });
    const j = await r.json();
    console.log(`  ${ligados.find((l) => l.solicitudId === c.solicitud_id)?.caso.id}: HTTP ${r.status} · ${j.estado}${j.detalle ? ` (${j.detalle})` : ""}`);
  }
} else {
  const area = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data: sesArea, error: eArea } = await area.auth.signInWithPassword({ email: "operaciones@empresademo.example", password: "Demo2025!" });
  if (eArea) throw new Error(`login área: ${eArea.message}`);
  marca = `[captura-sugerida-p3 ${new Date().toISOString().slice(0, 16)}]`;
  const { data: maxOrden } = await db.from("solicitudes").select("orden").eq("reporte_id", REPORTE_DEMO).order("orden", { ascending: false }).limit(1).maybeSingle();
  let orden = (maxOrden?.orden ?? 0) + 1;
  for (const c of casos) {
    const { data: sol, error: eSol } = await db.from("solicitudes").insert({
      reporte_id: REPORTE_DEMO, titulo: c.solicitud.titulo, descripcion: `${marca} caso ${c.id}`,
      area_asignada: "Operaciones", es_cuantitativa: false, estado: "solicitado", orden: orden++,
    }).select("id").single();
    if (eSol) throw new Error(`solicitud ${c.id}: ${eSol.message}`);
    const filas = (c.solicitud.codigos ?? []).map((cod) => ({ solicitud_id: sol.id, datapoint_id: idDe.get(cod) }));
    if (filas.length) {
      const { error: eMap } = await db.from("mapeo_solicitud_datapoint").insert(filas);
      if (eMap) throw new Error(`mapeo ${c.id}: ${eMap.message}`);
    }
    const bytes = fs.readFileSync(path.join(AQUI, "conjunto", c.archivo));
    const ruta = `${TENANT_DEMO}/${sol.id}/${c.archivo}`;
    const { error: eUp } = await area.storage.from("evidencias").upload(ruta, bytes, { contentType: MIME[c.archivo.split(".").pop()] });
    if (eUp) throw new Error(`subida ${c.id}: ${eUp.message}`);
    const { error: eEv } = await area.from("evidencias").insert({
      solicitud_id: sol.id, archivo_path: ruta, nombre_original: c.archivo, subido_por: sesArea.user.id, version: 0,
    });
    if (eEv) throw new Error(`evidencia ${c.id}: ${eEv.message}`);
    ligados.push({ caso: c, solicitudId: sol.id });
  }
  console.log(`${ligados.length} evidencias registradas (${marca})`);
  await area.auth.signOut();
  const ids = ligados.map((l) => l.solicitudId);
  for (let vuelta = 1; vuelta <= 20; vuelta++) {
    const r = await fetch(`${BASE}/api/evidencias/procesar?maximo=3`, { method: "POST", headers: { "x-cron-secret": CRON } });
    const cuerpo = await r.json();
    console.log(`  vuelta ${vuelta}: HTTP ${r.status} · ${(cuerpo.resultados ?? []).map((x) => `${x.estado}${x.detalle ? ` [${x.detalle}]` : ""}`).join(" · ") || "nada"}`);
    const { count } = await db.from("evidencias_contenido").select("id", { count: "exact", head: true })
      .in("solicitud_id", ids).in("estado", ["pendiente", "procesando"]);
    if (!count) break;
  }
}
const segundos = Math.round((Date.now() - t0) / 1000);

const ids = ligados.map((l) => l.solicitudId);
const [{ data: conts }, { data: sugs }] = await Promise.all([
  db.from("evidencias_contenido").select("solicitud_id, estado, contenido, costo_usd").in("solicitud_id", ids),
  db.from("sugerencias_captura").select("*").in("solicitud_id", ids).in("estado", ["sugerida", "fallida"]).order("created_at", { ascending: false }),
]);
const contDe = new Map((conts ?? []).map((c) => [c.solicitud_id, c]));
const sugDe = new Map();
for (const s of sugs ?? []) if (!sugDe.has(s.solicitud_id)) sugDe.set(s.solicitud_id, s);

// Recomprobación independiente de la literalidad (la misma regla que el código).
const norm = (t) => String(t ?? "").replace(/\s+/g, " ").trim();
function textoFuente(contenido, f) {
  if (f.tipo === "pagina") return contenido.paginas?.find((p) => p.pagina === f.pagina)?.texto ?? null;
  if (f.tipo === "imagen") return contenido.paginas?.map((p) => p.texto).join("\n") ?? null;
  if (f.tipo === "parrafo") return contenido.bloques?.find((b) => b.tipo === "parrafo" && b.n === f.parrafo)?.texto ?? null;
  if (f.tipo === "tabla") return contenido.bloques?.find((b) => b.tipo === "tabla" && b.n === f.tabla)?.filas?.[f.fila - 1]?.[f.columna - 1] ?? null;
  return null;
}
const mismaFuente = (a, b) => a.tipo === b.tipo && (a.tipo === "pagina" ? a.pagina === b.pagina : a.tipo === "parrafo" ? a.parrafo === b.parrafo : true);
const etiqueta = (f) => f.tipo === "pagina" ? `p. ${f.pagina}` : f.tipo === "parrafo" ? `párr. ${f.parrafo}` : f.tipo;

const resultados = [];
for (const { caso: c, solicitudId } of ligados) {
  const s = sugDe.get(solicitudId);
  const cont = contDe.get(solicitudId);
  const frags = s?.fuente?.fragmentos ?? [];
  const extracto = s?.extracto ?? "";
  const nPalabras = extracto ? extracto.replace(/\s*\[…\]\s*/g, " ").split(/\s+/).filter(Boolean).length : 0;
  const literales = frags.every((f) => { const t = textoFuente(cont?.contenido ?? {}, f.fuente); return t !== null && norm(t).includes(norm(f.texto)); });
  const fila = {
    id: c.id, archivo: c.archivo, feo: c.feo ?? null, codigos: c.solicitud.codigos ?? [],
    estado: s?.estado ?? null, cubre_requisito: s?.fuente?.cubre_requisito ?? null, confianza: s?.confianza ?? null,
    extracto: extracto || null, palabras: nPalabras, fuentes: frags.map((f) => etiqueta(f.fuente)), literales,
    cobertura: s?.cobertura ?? null, descartadas: s?.segunda_opinion?.descartadas ?? [], error: s?.error ?? null,
    tokens_entrada: s?.tokens_entrada ?? 0, tokens_salida: s?.tokens_salida ?? 0,
    costo_lectura: Number(cont?.costo_usd ?? 0), costo_sugerencia: Number(s?.costo_usd ?? 0),
    frases_faltantes: [], fuentes_faltantes: [], resultado: null,
  };
  if (c.esperado.cubre === false) {
    fila.resultado = s?.estado === "sugerida" && fila.cubre_requisito === "no" && !extracto ? "correcto (no cubre)" : "fallo";
  } else if (!s || s.estado !== "sugerida" || !extracto) {
    fila.resultado = "fallo";
  } else {
    fila.frases_faltantes = (c.esperado.extracto_contiene ?? []).filter((k) => !extracto.toLowerCase().includes(k.toLowerCase()));
    const esperadas = c.esperado.fuentes ?? [c.esperado.fuente];
    const citadas = esperadas.filter((e) => frags.some((f) => mismaFuente(f.fuente, e)));
    const minimo = c.esperado.minimo_fuentes ?? esperadas.length;
    fila.fuentes_faltantes = esperadas.filter((e) => !citadas.includes(e)).map(etiqueta);
    const ok = literales && nPalabras <= PALABRAS_MAX && fila.frases_faltantes.length === 0 && citadas.length >= minimo;
    fila.resultado = ok ? "completo" : "parcial";
  }
  resultados.push(fila);
}

fs.mkdirSync(path.join(AQUI, "resultados"), { recursive: true });
fs.writeFileSync(path.join(AQUI, "resultados", "paso3.json"), JSON.stringify({ corrida: marca, reusada: Boolean(REUSAR), segundos, resultados }, null, 2) + "\n");

console.log(`\n${marca} · ${segundos} s`);
for (const r of resultados) {
  console.log(`\n${r.id} ${r.resultado} · cubre: ${r.cubre_requisito} · conf: ${r.confianza} · ${r.palabras} palabras · fuentes: ${r.fuentes.join(", ") || "—"} · literal: ${r.literales ? "sí" : "NO"} · $${(r.costo_lectura + r.costo_sugerencia).toFixed(4)}`);
  if (r.extracto) console.log(`   extracto: ${r.extracto}`);
  console.log(`   cobertura: ${r.cobertura ?? "—"}`);
  if (r.frases_faltantes.length) console.log(`   faltan frases: ${r.frases_faltantes.join(" · ")}`);
  if (r.fuentes_faltantes.length) console.log(`   fuentes no citadas: ${r.fuentes_faltantes.join(", ")}`);
  if (r.descartadas.length) console.log(`   descartados: ${r.descartadas.map((d) => `${d.fuente}: ${d.motivo}`).join(" | ")}`);
  if (r.error) console.log(`   error: ${r.error}`);
}
const sumar = (k) => resultados.reduce((s, r) => s + r[k], 0);
console.log(`\n${resultados.filter((r) => r.resultado === "completo" || r.resultado.startsWith("correcto")).length}/${resultados.length} correctos · costo sugerencia $${sumar("costo_sugerencia").toFixed(4)} · lectura $${sumar("costo_lectura").toFixed(4)}`);
await db.auth.signOut();
