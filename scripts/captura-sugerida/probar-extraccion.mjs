#!/usr/bin/env node
// =============================================================================
// PRUEBA DEL PASO 1 de la captura sugerida: extracción y almacenamiento.
//
//   CRON_SECRET=… node scripts/captura-sugerida/probar-extraccion.mjs [baseUrl]
//
// SOLO contra el stack local (aborta si NEXT_PUBLIC_SUPABASE_URL no es local).
// Requiere la app corriendo contra ese stack con ANTHROPIC_API_KEY y el mismo
// CRON_SECRET (las lecturas por visión llaman al modelo y cuestan).
//
// Por el MISMO camino que la aplicación: como staff crea una solicitud por caso
// en Empresa Demo (con el título del manifiesto), sube el archivo a storage y
// registra la evidencia; el trigger la encola; luego dispara la cola por
// /api/evidencias/procesar. Para cada caso comprueba que el valor conocido está
// en el contenido extraído EN LA FUENTE QUE DICE EL MANIFIESTO (celda, página,
// párrafo, tabla o imagen), que es lo que la sugerencia del Paso 2 va a citar.
// Escribe el detalle en scripts/captura-sugerida/resultados/paso1.json.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3003";
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

const { casos } = JSON.parse(fs.readFileSync(path.join(AQUI, "manifiesto.json"), "utf8"));
const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
const { data: sesion, error: eLogin } = await db.auth.signInWithPassword({ email: "analista@irstrat.example", password: "Demo2025!" });
if (eLogin) throw new Error(`login staff: ${eLogin.message}`);
void sesion;
// La evidencia la carga el ÁREA, no el staff: Empresa Demo tiene
// `staff_puede_cargar = false`, como un cliente real. Mismo camino que el portal.
const area = createClient(URL_SB, ANON, { auth: { persistSession: false } });
const { data: sesArea, error: eArea } = await area.auth.signInWithPassword({ email: "operaciones@empresademo.example", password: "Demo2025!" });
if (eArea) throw new Error(`login área: ${eArea.message}`);
const areaId = sesArea.user.id;

// 1. Una solicitud por caso, con su título; el archivo como evidencia.
const marca = `[captura-sugerida ${new Date().toISOString().slice(0, 16)}]`;
const { data: maxOrden } = await db.from("solicitudes").select("orden").eq("reporte_id", REPORTE_DEMO).order("orden", { ascending: false }).limit(1).maybeSingle();
let orden = (maxOrden?.orden ?? 0) + 1;
const ligados = [];
for (const c of casos) {
  const { data: sol, error: eSol } = await db.from("solicitudes").insert({
    reporte_id: REPORTE_DEMO, titulo: c.solicitud.titulo, descripcion: `${marca} caso ${c.id}`,
    area_asignada: "Operaciones", es_cuantitativa: c.naturaleza === "numerica", estado: "solicitado", orden: orden++,
  }).select("id").single();
  if (eSol) throw new Error(`solicitud ${c.id}: ${eSol.message}`);
  const bytes = fs.readFileSync(path.join(AQUI, "conjunto", c.archivo));
  const ruta = `${TENANT_DEMO}/${sol.id}/${c.archivo}`;
  const ext = c.archivo.split(".").pop();
  const { error: eUp } = await area.storage.from("evidencias").upload(ruta, bytes, { contentType: MIME[ext] ?? "application/octet-stream" });
  if (eUp) throw new Error(`subida ${c.id}: ${eUp.message}`);
  const { data: ev, error: eEv } = await area.from("evidencias").insert({
    solicitud_id: sol.id, archivo_path: ruta, nombre_original: c.archivo, subido_por: areaId, version: 0,
  }).select("id").single();
  if (eEv) throw new Error(`evidencia ${c.id}: ${eEv.message}`);
  ligados.push({ caso: c, evidenciaId: ev.id, bytes: bytes.length });
}
console.log(`${ligados.length} evidencias registradas (${marca})`);

// 2. La cola, por el endpoint del cron, hasta que no quede nada nuestro pendiente.
const t0 = Date.now();
const idsEv = ligados.map((l) => l.evidenciaId);
for (let vuelta = 1; vuelta <= 10; vuelta++) {
  const r = await fetch(`${BASE}/api/evidencias/procesar?maximo=50`, { method: "POST", headers: { "x-cron-secret": CRON } });
  const cuerpo = await r.json();
  console.log(`  vuelta ${vuelta}: HTTP ${r.status} · ${cuerpo.procesadas ?? 0} procesadas · ${JSON.stringify(cuerpo.porEstado ?? cuerpo.error)}`);
  const { count } = await db.from("evidencias_contenido").select("id", { count: "exact", head: true })
    .in("evidencia_id", idsEv).in("estado", ["pendiente", "procesando"]);
  if (!count) break;
}
const segundos = Math.round((Date.now() - t0) / 1000);

// 3. Verificación caso por caso contra el manifiesto.
const { data: filas } = await db.from("evidencias_contenido")
  .select("evidencia_id, estado, tipo, contenido, paginas, hojas, truncado, bytes, modelo, tokens_entrada, tokens_salida, costo_usd, error, mensaje")
  .in("evidencia_id", idsEv);
const porEv = new Map((filas ?? []).map((f) => [f.evidencia_id, f]));

const variantes = (v) => {
  const n = Number(v);
  const s = new Set([String(v), n.toLocaleString("en-US"), n.toLocaleString("en-US", { minimumFractionDigits: 1 })]);
  return [...s];
};
const plano = (t) => String(t ?? "").replace(/\s+/g, " ");
const aNumero = (x) => Number(String(x).replace(/[^0-9.\-]/g, ""));

function textoEnFuente(contenido, fuente) {
  if (!contenido) return null;
  if (fuente.tipo === "celda") {
    const h = contenido.hojas?.find((x) => x.nombre === fuente.hoja);
    const c = h?.celdas.find((x) => x.ref === fuente.celda);
    return c ? { valor: c.valor, texto: c.texto ?? String(c.valor) } : null;
  }
  if (fuente.tipo === "pagina") return contenido.paginas?.find((p) => p.pagina === fuente.pagina)?.texto ?? null;
  if (fuente.tipo === "imagen") return contenido.paginas?.map((p) => p.texto).join("\n") ?? null;
  if (fuente.tipo === "parrafo") return contenido.bloques?.find((b) => b.tipo === "parrafo" && b.n === fuente.parrafo)?.texto ?? null;
  if (fuente.tipo === "tabla") return contenido.bloques?.find((b) => b.tipo === "tabla" && b.n === fuente.tabla)?.filas?.[fuente.fila - 1]?.[fuente.columna - 1] ?? null;
  return null;
}

const resultados = [];
for (const { caso: c, bytes } of ligados) {
  const f = porEv.get(ligados.find((l) => l.caso === c).evidenciaId);
  let ok = false;
  let motivo = "";
  if (c.control) {
    ok = f?.estado === c.esperado.estado && plano(f?.mensaje).includes(".xlsx");
    motivo = ok ? `no soportado: «${f.mensaje}»` : `estado ${f?.estado} · ${f?.mensaje ?? f?.error ?? ""}`;
  } else if (f?.estado !== "extraido") {
    motivo = `estado ${f?.estado}: ${f?.error ?? f?.mensaje ?? ""}`;
  } else {
    const enFuente = textoEnFuente(f.contenido, c.esperado.fuente);
    if (c.esperado.extracto_contiene) {
      const faltan = c.esperado.extracto_contiene.filter((k) => !plano(enFuente).toLowerCase().includes(k.toLowerCase()));
      ok = enFuente !== null && faltan.length === 0;
      motivo = ok ? "las frases clave están en la fuente" : `faltan en la fuente: ${faltan.join(" · ") || "(fuente no encontrada)"}`;
    } else if (c.esperado.fuente.tipo === "celda") {
      const n = typeof enFuente?.valor === "number" ? enFuente.valor : aNumero(enFuente?.valor);
      ok = n === c.esperado.valor || Math.round(n * 1000) / 10 === c.esperado.valor;
      motivo = enFuente ? `${c.esperado.fuente.hoja}!${c.esperado.fuente.celda} = ${JSON.stringify(enFuente.valor)}${enFuente.texto !== String(enFuente.valor) ? ` («${enFuente.texto}»)` : ""}` : "celda no encontrada";
    } else {
      const t = plano(enFuente);
      const hallada = variantes(c.esperado.valor).find((v) => t.includes(v));
      ok = Boolean(hallada);
      motivo = hallada ? `«${hallada}» en ${c.esperado.fuente.tipo}${c.esperado.fuente.pagina ? ` ${c.esperado.fuente.pagina}` : ""}` : `no está en la fuente (${t.slice(0, 90)}…)`;
    }
    if (c.esperado.truncado !== undefined && f.truncado !== c.esperado.truncado) { ok = false; motivo += ` · truncado=${f.truncado}`; }
  }
  resultados.push({
    id: c.id, archivo: c.archivo, tipo: c.tipo, feo: c.feo ?? null, control: Boolean(c.control), ok, motivo,
    estado: f?.estado ?? null, origen: f?.contenido?.paginas?.some((p) => p.origen === "vision") ? "vision" : f?.estado === "extraido" ? "servidor" : null,
    paginas: f?.paginas ?? null, hojas: f?.hojas ?? null, truncado: f?.truncado ?? null, bytes,
    modelo: f?.modelo ?? null, tokens_entrada: f?.tokens_entrada ?? 0, tokens_salida: f?.tokens_salida ?? 0, costo_usd: Number(f?.costo_usd ?? 0),
    mensaje: f?.mensaje ?? null,
  });
}

// 4. Resumen.
fs.mkdirSync(path.join(AQUI, "resultados"), { recursive: true });
const muestra = {};
for (const tipo of ["excel", "pdf", "word", "imagen"]) {
  const r = resultados.find((x) => x.tipo === tipo && !x.control && x.ok && (tipo !== "pdf" || x.origen === "vision"));
  const f = r && porEv.get(ligados.find((l) => l.caso.id === r.id).evidenciaId);
  if (f) muestra[tipo] = { id: r.id, archivo: r.archivo, contenido: f.contenido };
}
fs.writeFileSync(path.join(AQUI, "resultados", "paso1.json"), JSON.stringify({ corrida: marca, segundos, resultados, muestra }, null, 2) + "\n");

const cuenta = resultados.filter((r) => !r.control);
console.log(`\ncola: ${segundos} s`);
for (const r of resultados) {
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.id} ${r.archivo.padEnd(32)} ${String(r.estado).padEnd(12)} ${(r.origen ?? "").padEnd(8)} $${r.costo_usd.toFixed(4)}  ${r.motivo}`);
}
const costo = cuenta.reduce((s, r) => s + r.costo_usd, 0);
const porTipo = {};
for (const r of cuenta) { porTipo[r.tipo] ??= { n: 0, costo: 0 }; porTipo[r.tipo].n++; porTipo[r.tipo].costo += r.costo_usd; }
console.log(`\n${cuenta.filter((r) => r.ok).length}/${cuenta.length} casos con el valor en su fuente · control ${resultados.filter((r) => r.control && r.ok).length}/${resultados.filter((r) => r.control).length}`);
console.log(`costo total $${costo.toFixed(4)} · ${Object.entries(porTipo).map(([t, v]) => `${t}: ${v.n} archivos, $${v.costo.toFixed(4)}`).join(" · ")}`);
await db.auth.signOut();
await area.auth.signOut();
process.exit(cuenta.every((r) => r.ok) && resultados.filter((r) => r.control).every((r) => r.ok) ? 0 : 1);
