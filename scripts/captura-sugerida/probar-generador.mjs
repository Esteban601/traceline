#!/usr/bin/env node
// =============================================================================
// PRUEBA DEL PASO 5 de la captura sugerida: el generador lee las evidencias.
//
//   CRON_SECRET=… node scripts/captura-sugerida/probar-generador.mjs [baseUrl] [--solo-generar]
//
// SOLO contra el stack local, con la app corriendo con ANTHROPIC_API_KEY y el
// mismo CRON_SECRET. Cuesta: lectura y sugerencia de dos evidencias (~$0.02) y
// dos bloques generados con el modelo del generador (~$0.2–0.5 cada uno).
//
// Prepara (se salta con --solo-generar):
//   · Bloque 29 (GEI). El área sube una versión nueva a «Inventario GEI Alcance 1»
//     (x02: Excel con 2025 = 12,480.5 y 2024 = 13,105.2) y a «Alcance 2» (w02:
//     Word con la tabla de los tres alcances, 2024 y 2025). La cola lee y sugiere;
//     el área CONFIRMA la sugerencia y el staff valida. Lo confirmado son solo las
//     cifras 2025 de Alcance 1 y 2: las de 2024 y el Alcance 3 están en los
//     archivos pero nadie las confirmó, así que el texto no puede usarlas.
//   · Bloque 16 (supervisión de la estrategia). El administrador del cliente
//     confirma el extracto de R4 (t02, tres párrafos) y el staff valida.
// Genera los dos bloques por la ruta de la aplicación (POST /api/suplemento/…)
// y escribe texto, fuentes, pendientes, notas y costo en resultados/paso5.json.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const SOLO_GENERAR = args.includes("--solo-generar");
const BASE = args.find((a) => !a.startsWith("--")) || "http://localhost:3003";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const CLAVE_DEMO = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const SOL_A1 = "c0000000-0000-0000-0000-000000000007";
const SOL_A2 = "c0000000-0000-0000-0000-000000000008";
const CRON = process.env.CRON_SECRET;
if (!/127\.0\.0\.1|localhost/.test(URL_SB)) { console.error("✗ Solo contra el stack local."); process.exit(2); }
if (!CRON) { console.error("✗ Falta CRON_SECRET."); process.exit(2); }

async function sesion(email) {
  const c = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: CLAVE_DEMO });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { c, id: data.user.id };
}
const staff = await sesion("analista@irstrat.example");

if (!SOLO_GENERAR) {
  const area = await sesion("operaciones@empresademo.example");
  const admin = await sesion("admin.cliente@empresademo.example");
  const MIME = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  const subir = async (solicitudId, archivo) => {
    const ruta = `${TENANT}/${solicitudId}/${Date.now()}-${archivo}`;
    const { error: eUp } = await area.c.storage.from("evidencias").upload(ruta, fs.readFileSync(path.join(AQUI, "conjunto", archivo)), { contentType: MIME[archivo.split(".").pop()] });
    if (eUp) throw new Error(`subida ${archivo}: ${eUp.message}`);
    const { error } = await area.c.from("evidencias").insert({
      solicitud_id: solicitudId, archivo_path: ruta, nombre_original: archivo, subido_por: area.id, version: 0,
      periodo_cubierto: "2025", area_origen: "Operaciones", justificacion: "Inventario GEI 2025 actualizado con la memoria de cálculo final.",
    });
    if (error) throw new Error(`evidencia ${archivo}: ${error.message}`);
  };
  await subir(SOL_A1, "x02_emisiones_gei.xlsx");
  await subir(SOL_A2, "w02_tabla_emisiones.docx");
  for (let i = 0; i < 8; i++) {
    await fetch(`${BASE}/api/evidencias/procesar?maximo=3`, { method: "POST", headers: { "x-cron-secret": CRON } });
    const { count } = await staff.c.from("sugerencias_captura").select("id", { count: "exact", head: true }).in("solicitud_id", [SOL_A1, SOL_A2]).eq("estado", "sugerida");
    if (count === 2) break;
  }
  const { data: sugs } = await staff.c.from("sugerencias_captura").select("id, solicitud_id, valor, unidad, periodo").in("solicitud_id", [SOL_A1, SOL_A2]).eq("estado", "sugerida");
  for (const s of sugs ?? []) {
    const { error } = await area.c.rpc("fn_decidir_sugerencia", { p_sugerencia_id: s.id, p_accion: "confirmar" });
    console.log(`confirmada ${s.solicitud_id === SOL_A1 ? "Alcance 1" : "Alcance 2"}: ${s.valor} ${s.unidad} ${s.periodo} ${error ? `✗ ${error.message}` : "✓"}`);
  }
  // R4: el extracto de texto de la revisión del Paso 4.
  const { data: r4 } = await staff.c.from("solicitudes").select("id").like("titulo", "[Revisión Paso 4] Cómo y con qué frecuencia%").order("created_at", { ascending: false }).limit(1).single();
  const { data: sugTxt } = await staff.c.from("sugerencias_captura").select("id").eq("solicitud_id", r4.id).eq("estado", "sugerida").maybeSingle();
  if (sugTxt) {
    const { error } = await admin.c.rpc("fn_decidir_sugerencia", { p_sugerencia_id: sugTxt.id, p_accion: "confirmar" });
    console.log(`extracto de R4 confirmado ${error ? `✗ ${error.message}` : "✓"}`);
  }
  for (const id of [SOL_A1, SOL_A2, r4.id]) {
    const { data: s } = await staff.c.from("solicitudes").select("estado").eq("id", id).single();
    for (const e of s.estado === "validado" ? [] : s.estado === "en_revision" ? ["validado"] : ["en_revision", "validado"]) {
      const { error } = await staff.c.from("solicitudes").update({ estado: e }).eq("id", id);
      if (error) throw new Error(`validar ${id}: ${error.message}`);
    }
  }
  console.log("Alcance 1, Alcance 2 y R4 validadas");
}

// Generación por la ruta de la aplicación, con sesión de staff.
const jar = new Map();
const ssr = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
await ssr.auth.signInWithPassword({ email: "admin@irstrat.example", password: CLAVE_DEMO });
const cookie = [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");

const resultados = [];
for (const n of [29, 16]) {
  const r = await fetch(`${BASE}/api/suplemento/${REPORTE}/bloque/${n}`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ reiniciarIntentos: true }) });
  const j = await r.json().catch(() => ({}));
  console.log(`\nbloque ${n}: POST ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
  const documento = j.documentoId ?? j.documento ?? null;
  let fila = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((res) => setTimeout(res, 5000));
    const { data: doc } = await staff.c.from("documentos_generados").select("id").eq("reporte_id", REPORTE).order("created_at", { ascending: false }).limit(1).single();
    const { data } = await staff.c.from("documentos_bloques").select("estado, texto, fuentes, pendientes, modelo, prompt_version, tokens_entrada, tokens_salida, costo_usd").eq("documento_id", documento ?? doc.id).eq("numero", n).maybeSingle();
    if (data && !["generando", "en_cola"].includes(data.estado)) { fila = data; break; }
  }
  resultados.push({ bloque: n, ...fila });
  console.log(`estado: ${fila?.estado} · ${fila?.modelo} · ${fila?.prompt_version} · $${fila?.costo_usd}`);
  console.log(fila?.texto ?? "(sin texto)");
  console.log("fuentes:", (fila?.fuentes ?? []).map((f) => `${f.id} — ${f.detalle}`).join("\n        "));
  console.log("pendientes y notas:", JSON.stringify(fila?.pendientes ?? []).slice(0, 600));
}
fs.mkdirSync(path.join(AQUI, "resultados"), { recursive: true });
fs.writeFileSync(path.join(AQUI, "resultados", "paso5.json"), JSON.stringify(resultados, null, 2) + "\n");
