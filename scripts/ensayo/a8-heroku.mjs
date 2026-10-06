#!/usr/bin/env node
// =============================================================================
// A8 · PRUEBAS EN HEROKU (encargo 2026-10-05-generador-a-produccion, Paso 3).
//
//   NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… \
//     node scripts/ensayo/a8-heroku.mjs <estado|bloque|documento|aislamiento|subida20|cron> [--base URL]
//
// Contra `traceline-dev` (código de dev/ajustes-sep26) y el proyecto de ensayo
// (copia de staging). Aborta si la URL de Supabase no es la del ensayo. Las
// cuentas salen de .credenciales-demo (las de staging, copiadas a ensayo); no se
// imprime ninguna contraseña. Se corre desde la copia que tiene .credenciales-demo.
//
//   estado       banderas por emisora (§3) y régimen del reporte del demo
//   bloque       un bloque (29) del demo generado desde Heroku: tiempo, costo, fuentes
//   documento    el documento completo del demo, con la misma orquestación que la
//                pantalla (bloque 29 primero, luego de tres en tres, un reintento)
//   aislamiento  una emisora no alcanza el generador ni la captura de otra: rechazo
//                del SERVIDOR (rutas y base), no de la pantalla
//   subida20     evidencia de 20 MB por URL firmada desde el portal en Heroku, y su
//                lectura por la cola (after())
//   cron         una evidencia registrada sin pasar por la app queda «pendiente» y
//                la procesa el job del Scheduler
// Escribe cada resultado en scripts/ensayo/resultados/a8-<subcomando>.json.
// =============================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REF_ENSAYO = "sqpxcxewoznhpwvhxamy";
const args = process.argv.slice(2);
const SUB = args[0];
const iBase = args.indexOf("--base");
const BASE = iBase >= 0 ? args[iBase + 1] : "https://traceline-dev-d4fd7a3cda04.herokuapp.com";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
if (!URL_SB.includes(REF_ENSAYO) || !ANON) { console.error(`✗ Solo contra el proyecto de ensayo ${REF_ENSAYO}.`); process.exit(2); }

const SEED = JSON.parse(fs.readFileSync(".credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json", "utf8"));
const PROSP = JSON.parse(fs.readFileSync(".credenciales-demo/prospectos-ewgnvjtjhvdltvkopptn.json", "utf8"));
const clave = (email) => (SEED[email] ?? PROSP[email])?.password;
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };
const guardar = (nombre, datos) => {
  fs.mkdirSync(path.join(AQUI, "resultados"), { recursive: true });
  fs.writeFileSync(path.join(AQUI, "resultados", `a8-${nombre}.json`), JSON.stringify(datos, null, 2) + "\n");
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function sesion(email) {
  const c = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: clave(email) });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { c, id: data.user.id };
}
let navegador = null;
async function app(email) {
  navegador ??= await chromium.launch();
  const ctx = await navegador.newContext();
  const p = await ctx.newPage();
  const errores = [];
  p.on("console", (m) => { if (m.type() === "error") errores.push(m.text().slice(0, 160)); });
  p.on("pageerror", (e) => errores.push(String(e).slice(0, 160)));
  await p.goto(`${BASE}/login`, { timeout: 120000 });
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"]', clave(email));
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120000 }), p.click('button[type="submit"]')]);
  return { ctx, p, req: ctx.request, errores };
}

const staff = await sesion("analista@irstrat.example");
const { data: tenants } = await staff.c.from("tenants").select("id, slug, es_demo, vitrina_habilitada, generador_activo, lectura_evidencias_activa, generaciones_mes_max, lecturas_mes_max").order("slug");
const tid = (slug) => tenants.find((t) => t.slug === slug)?.id;
const { data: repDemo } = await staff.c.from("reportes").select("id, nombre, ejercicio, anio_adopcion").eq("tenant_id", tid("empresa-demo-sab")).order("ejercicio", { ascending: false }).limit(1).single();

// Generación de un bloque por la ruta, como la pantalla: POST (202) y consulta cada 2 s.
async function generarUno(req, destino, n) {
  const t0 = Date.now();
  const r = await req.post(`${BASE}/api/suplemento/${destino}/bloque/${n}`, { data: {}, timeout: 60000 });
  if (r.status() !== 202) return { n, ok: false, http: r.status(), error: (await r.json().catch(() => ({}))).error, ms: Date.now() - t0 };
  const docId = (await r.json()).documentoId;
  for (;;) {
    await dormir(2000);
    const c = await req.get(`${BASE}/api/suplemento/${docId}/bloque/${n}`, { timeout: 60000 });
    const b = await c.json().catch(() => ({}));
    if (b.estado === "generando" || b.estado === "en_cola") continue;
    return { n, ok: ["borrador", "no_aplica", "pendiente_adjunto"].includes(b.estado), estado: b.estado, docId, ms: Date.now() - t0 };
  }
}
async function filaBloque(docId, n) {
  const { data } = await staff.c.from("documentos_bloques").select("numero, estado, modelo, prompt_version, duracion_ms, costo_usd, tokens_entrada, tokens_salida, intentos, fuentes, pendientes").eq("documento_id", docId).eq("numero", n).maybeSingle();
  return data;
}
/** Las fuentes `evi:` de un bloque, con la emisora de cada evidencia. */
async function emisorasCitadas(fuentes) {
  const ids = [...new Set((fuentes ?? []).map((f) => f.id).filter((i) => i.startsWith("evi:")).map((i) => i.split(":")[1]))];
  if (!ids.length) return [];
  const { data } = await staff.c.from("evidencias_contenido").select("evidencia_id, tenant_id").in("evidencia_id", ids);
  return [...new Set((data ?? []).map((d) => tenants.find((t) => t.id === d.tenant_id)?.slug))];
}

try {
  if (SUB === "estado") {
    console.log("Banderas por emisora (§3)");
    for (const t of tenants) {
      const esperado = t.es_demo ? { gen: true, lec: true, vit: t.slug === "ainda" ? false : true } : { gen: false, lec: false, vit: false };
      const bien = t.generador_activo === esperado.gen && t.lectura_evidencias_activa === esperado.lec && t.vitrina_habilitada === esperado.vit;
      ok(bien, `${t.slug.padEnd(20)} demo=${t.es_demo} vitrina=${t.vitrina_habilitada} generador=${t.generador_activo} lectura=${t.lectura_evidencias_activa} (${t.generaciones_mes_max}/${t.lecturas_mes_max})`);
    }
    console.log(`\nReporte del demo: ${repDemo.nombre} · ejercicio ${repDemo.ejercicio} · año de adopción ${repDemo.anio_adopcion ?? "SIN DECLARAR (el generador responde 422)"}`);
    guardar("estado", { tenants, repDemo });
  }

  if (SUB === "bloque") {
    const s = await app("admin@irstrat.example");
    const r = await generarUno(s.req, repDemo.id, 29);
    const fila = r.docId ? await filaBloque(r.docId, 29) : null;
    const citadas = await emisorasCitadas(fila?.fuentes);
    ok(r.ok, `bloque 29 desde Heroku: ${r.estado ?? r.http} en ${(r.ms / 1000).toFixed(1)} s de reloj · ${fila?.duracion_ms ? (fila.duracion_ms / 1000).toFixed(1) + " s en el servidor" : ""} · $${fila?.costo_usd ?? "—"} · ${fila?.modelo ?? ""} · intentos ${fila?.intentos ?? "—"}${r.error ? ` · ${r.error}` : ""}`);
    ok(citadas.every((x) => x === "empresa-demo-sab"), `las evidencias citadas son de la propia emisora (${citadas.join(", ") || "ninguna evidencia citada"})`);
    guardar("bloque", { r, fila });
  }

  if (SUB === "documento") {
    const s = await app("admin@irstrat.example");
    const t0 = Date.now();
    const a = await s.req.post(`${BASE}/api/suplemento/${repDemo.id}/generar`, { timeout: 60000 });
    const abierto = await a.json().catch(() => ({}));
    ok(a.status() === 200, `POST generar → ${a.status()} ${abierto.error ?? `documento ${abierto.documentoId} · ${abierto.porGenerar?.length ?? 0} bloques por generar`}`);
    if (a.status() === 200) {
      const docId = abierto.documentoId;
      const porGenerar = abierto.porGenerar ?? [];
      const primero = abierto.primero;
      const resultados = [];
      if (primero) resultados.push(await generarUno(s.req, docId, primero));
      const cola = porGenerar.filter((n) => n !== primero);
      const obrero = async () => { while (cola.length) { const n = cola.shift(); resultados.push(await generarUno(s.req, docId, n)); } };
      await Promise.all([obrero(), obrero(), obrero()]);
      const fallidos = resultados.filter((r) => !r.ok).map((r) => r.n);
      const reintento = [];
      for (const n of fallidos) reintento.push(await generarUno(s.req, docId, n));
      const pared = Date.now() - t0;
      const { data: doc } = await staff.c.from("documentos_generados").select("costo_usd, tokens_entrada, tokens_salida").eq("id", docId).single();
      const filas = [];
      for (const n of porGenerar) filas.push(await filaBloque(docId, n));
      const dur = filas.map((f) => f?.duracion_ms ?? 0).filter(Boolean).sort((x, y) => x - y);
      const p = (q) => (dur[Math.min(dur.length - 1, Math.floor(q * dur.length))] / 1000).toFixed(1);
      const estados = {};
      for (const f of filas) estados[f?.estado ?? "—"] = (estados[f?.estado ?? "—"] ?? 0) + 1;
      const conCortes = filas.filter((f) => (f?.intentos ?? 0) > 0).length;
      const citadas = [...new Set((await Promise.all(filas.map((f) => emisorasCitadas(f?.fuentes)))).flat())];
      ok(reintento.every((r) => r.ok), `documento completo en ${(pared / 60000).toFixed(1)} min · ${porGenerar.length} bloques · fallidos al primer paso ${fallidos.length}, al reintento ${reintento.filter((r) => !r.ok).length}`);
      console.log(`    estados: ${JSON.stringify(estados)} · bloques con corte por tiempo: ${conCortes}`);
      console.log(`    duración en el servidor por bloque: mediana ${p(0.5)} s · p90 ${p(0.9)} s · máxima ${p(1)} s`);
      console.log(`    costo del documento: $${Number(doc.costo_usd).toFixed(2)} · tokens ${doc.tokens_entrada} entrada / ${doc.tokens_salida} salida`);
      ok(citadas.every((x) => x === "empresa-demo-sab"), `las evidencias citadas son de la propia emisora (${citadas.join(", ") || "ninguna"})`);
      guardar("documento", { docId, pared, fallidos, reintento, estados, conCortes, costo: doc, filas: filas.map((f) => ({ n: f?.numero, estado: f?.estado, duracion_ms: f?.duracion_ms, costo_usd: f?.costo_usd, intentos: f?.intentos })) });
    }
  }

  if (SUB === "aislamiento") {
    // Emisora A: CLEPSA (su administrador). Emisora B: Empresa Demo.
    const A = "admin@clepsa.example";
    const s = await app(A);
    const sa = await sesion(A);
    const { data: docB } = await staff.c.from("documentos_generados").select("id").eq("reporte_id", repDemo.id).limit(1).maybeSingle();
    const r1 = await s.req.post(`${BASE}/api/suplemento/${repDemo.id}/bloque/29`, { data: {} });
    ok(r1.status() === 404, `admin de CLEPSA → bloque del reporte de Empresa Demo: ${r1.status()} (no lo ve)`);
    const r2 = await s.req.post(`${BASE}/api/suplemento/${repDemo.id}/generar`);
    ok(r2.status() === 403 || r2.status() === 404, `→ generar documento de Empresa Demo: ${r2.status()}`);
    if (docB) {
      const r3 = await s.req.get(`${BASE}/api/suplemento/${docB.id}/word`);
      ok(r3.status() === 404, `→ Word del documento de Empresa Demo: ${r3.status()}`);
      const r3b = await s.req.get(`${BASE}/api/suplemento/${docB.id}/bloque/29`);
      ok(r3b.status() === 404, `→ consultar un bloque de ese documento: ${r3b.status()}`);
    }
    const { data: evB } = await staff.c.from("evidencias").select("id, solicitud_id").in("solicitud_id", (await staff.c.from("solicitudes").select("id").eq("reporte_id", repDemo.id)).data.map((x) => x.id)).limit(1).single();
    const r4 = await s.req.get(`${BASE}/portal/descargar/${evB.id}`, { maxRedirects: 0 });
    ok(r4.status() === 404, `→ descargar una evidencia de Empresa Demo: ${r4.status()}`);
    const { count: cCont } = await sa.c.from("evidencias_contenido").select("id", { count: "exact", head: true }).eq("tenant_id", tid("empresa-demo-sab"));
    const { count: cSug } = await sa.c.from("sugerencias_captura").select("id", { count: "exact", head: true }).eq("tenant_id", tid("empresa-demo-sab"));
    const { count: cCap } = await sa.c.from("capturas_valor").select("id", { count: "exact", head: true }).eq("solicitud_id", evB.solicitud_id);
    ok(!cCont && !cSug && !cCap, `RLS: contenido ${cCont ?? 0}, sugerencias ${cSug ?? 0} y capturas ${cCap ?? 0} de Empresa Demo visibles para CLEPSA`);
    const { data: sugB } = await staff.c.from("sugerencias_captura").select("id").eq("tenant_id", tid("empresa-demo-sab")).limit(1).maybeSingle();
    if (sugB) {
      const { error } = await sa.c.rpc("fn_decidir_sugerencia", { p_sugerencia_id: sugB.id, p_accion: "confirmar" });
      ok(Boolean(error), `→ decidir una sugerencia de Empresa Demo: rechazada («${error?.message ?? "la aceptó"}»)`);
    } else {
      console.log("    (aún no hay sugerencias en Empresa Demo: la decisión cruzada se prueba después de subida20)");
    }
    const { data: contB } = await staff.c.from("evidencias_contenido").select("id").eq("tenant_id", tid("empresa-demo-sab")).limit(1).maybeSingle();
    if (contB) {
      const r5 = await s.req.post(`${BASE}/api/evidencias/sugerir?contenido=${contB.id}`);
      ok(r5.status() === 401, `→ regenerar una sugerencia sin el secreto del cron: ${r5.status()}`);
    }
    guardar("aislamiento", { fallas });
  }

  if (SUB === "subida20") {
    // Un PDF de ~20 MB: una página con texto (la cifra) y páginas con imágenes de
    // ruido, que no se comprimen. El portal lo sube con URL firmada.
    // Fuera del repositorio: 20 MB no se versionan.
    const archivo = path.join(os.tmpdir(), "a8-evidencia-20mb.pdf");
    if (!fs.existsSync(archivo)) {
      const doc = await PDFDocument.create();
      const f = await doc.embedFont(StandardFonts.Helvetica);
      const p1 = doc.addPage([595, 842]);
      p1.drawText("Bitácora de combustibles 2025 (prueba A8)", { x: 60, y: 780, size: 16, font: f });
      p1.drawText("Consumo de diésel 2025: 18,900 L", { x: 60, y: 750, size: 12, font: f });
      const sharp = (await import("sharp")).default;
      let bytes;
      for (;;) {
        const ruido = Buffer.alloc(1400 * 1400 * 3);
        for (let i = 0; i < ruido.length; i++) ruido[i] = (Math.random() * 256) | 0;
        const png = await sharp(ruido, { raw: { width: 1400, height: 1400, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
        doc.addPage([595, 842]).drawImage(await doc.embedPng(png), { x: 0, y: 0, width: 595, height: 842 });
        bytes = await doc.save();
        if (bytes.length >= 19.5 * 1024 * 1024) break;
      }
      fs.writeFileSync(archivo, bytes);
    }
    const mb = fs.statSync(archivo).size / 1048576;
    console.log(`  archivo: ${mb.toFixed(1)} MB`);
    const { data: sol } = await staff.c.from("solicitudes").select("id, titulo, estado, area_asignada").eq("reporte_id", repDemo.id).eq("area_asignada", "Operaciones").in("estado", ["solicitado", "recibido", "observaciones"]).limit(1).single();
    const s = await app("operaciones@empresademo.example");
    const firmadas = [];
    s.p.on("request", (r) => { if (r.method() !== "GET" && /\/storage\/v1\/object\/upload\/sign\//.test(r.url())) firmadas.push(r.url()); });
    await s.p.goto(`${BASE}/portal/solicitudes/${sol.id}`, { timeout: 120000 });
    await s.p.waitForLoadState("networkidle").catch(() => {});
    await s.p.setInputFiles("#evidencia-file", archivo);
    await s.p.fill("#periodo", "2025");
    const area = s.p.locator('input[placeholder="Ej. Operaciones"]');
    if (await area.count()) await area.first().fill("Operaciones");
    const { data: previa } = await staff.c.from("evidencias").select("version").eq("solicitud_id", sol.id).order("version", { ascending: false }).limit(1).maybeSingle();
    const t0 = Date.now();
    await s.p.getByRole("button", { name: /^(Enviar|Reenviar)$/ }).click();
    // El tiempo de subida se mide hasta que la fila nueva existe en la base (subida
    // firmada + registro por la acción), no por el aviso de la pantalla.
    let ev = null;
    while (Date.now() - t0 < 300000) {
      const { data } = await staff.c.from("evidencias").select("id, version, created_at").eq("solicitud_id", sol.id).order("version", { ascending: false }).limit(1).maybeSingle();
      if (data && data.version > (previa?.version ?? 0)) { ev = data; break; }
      await dormir(1000);
    }
    const subida = Date.now() - t0;
    if (!ev) throw new Error("la evidencia no se registró en 5 minutos");
    ok(firmadas.length === 1, `${mb.toFixed(1)} MB subidos con URL firmada desde el portal en Heroku en ${(subida / 1000).toFixed(1)} s · evidencia v${ev.version} registrada`);
    let cont = null;
    const t1 = Date.now();
    while (Date.now() - t1 < 420000) {
      const { data } = await staff.c.from("evidencias_contenido").select("estado, paginas, truncado, costo_usd, modelo, error, mensaje, procesado_en, created_at").eq("evidencia_id", ev.id).maybeSingle();
      cont = data;
      if (data && !["pendiente", "procesando"].includes(data.estado)) break;
      await dormir(5000);
    }
    const lect = cont?.procesado_en ? (new Date(cont.procesado_en) - new Date(cont.created_at)) / 1000 : null;
    ok(cont?.estado === "extraido", `la cola la leyó con after(): ${cont?.estado} · ${cont?.paginas ?? "—"} páginas · ${lect != null ? lect.toFixed(0) + " s" : "—"} · $${cont?.costo_usd ?? "—"}${cont?.error ? ` · ${cont.error}` : ""}`);
    const { data: sug } = await staff.c.from("sugerencias_captura").select("estado, valor, unidad, costo_usd").eq("evidencia_id", ev.id).maybeSingle();
    console.log(`    sugerencia: ${sug ? `${sug.estado} · ${sug.valor ?? ""} ${sug.unidad ?? ""} · $${sug.costo_usd}` : "ninguna (la solicitud puede ser de texto)"}`);
    ok(s.errores.length === 0, `consola limpia en el portal (${s.errores.length})`);
    guardar("subida20", { mb, subida_ms: subida, contenido: cont, sugerencia: sug });
  }

  if (SUB === "cron") {
    // Evidencia registrada SIN pasar por la app: nadie llama a after(); la fila
    // nace «pendiente» y solo el job del Scheduler (cada 10 min) la procesa.
    const area = await sesion("operaciones@empresademo.example");
    const { data: sol } = await staff.c.from("solicitudes").select("id").eq("reporte_id", repDemo.id).eq("area_asignada", "Operaciones").in("estado", ["solicitado", "recibido", "observaciones", "en_revision"]).limit(1).single();
    const ruta = `${tid("empresa-demo-sab")}/${sol.id}/${Date.now()}-a8-cron.csv`;
    const { error: eUp } = await area.c.storage.from("evidencias").upload(ruta, Buffer.from("concepto,valor\nDiésel 2025 (L),18900\n"), { contentType: "text/csv" });
    if (eUp) throw new Error(eUp.message);
    const { data: ev, error: eEv } = await area.c.from("evidencias").insert({ solicitud_id: sol.id, archivo_path: ruta, nombre_original: "a8-cron.csv", subido_por: area.id, version: 0, periodo_cubierto: "2025" }).select("id").single();
    if (eEv) throw new Error(eEv.message);
    const t0 = Date.now();
    let cont = null;
    console.log("  esperando al job del Scheduler (hasta 12 min)…");
    while (Date.now() - t0 < 12 * 60000) {
      const { data } = await staff.c.from("evidencias_contenido").select("estado, procesado_en, created_at, error").eq("evidencia_id", ev.id).maybeSingle();
      cont = data;
      if (data && !["pendiente", "procesando"].includes(data.estado)) break;
      await dormir(15000);
    }
    const espera = cont?.procesado_en ? (new Date(cont.procesado_en) - new Date(cont.created_at)) / 60000 : null;
    ok(cont?.estado === "extraido", `el job del Scheduler procesó la fila pendiente: ${cont?.estado} · a los ${espera != null ? espera.toFixed(1) + " min" : "—"}${cont?.error ? ` · ${cont.error}` : ""}`);
    guardar("cron", { contenido: cont, espera_min: espera });
  }
} finally {
  await navegador?.close();
}
console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ OK");
process.exit(fallas.length ? 1 : 0);
