#!/usr/bin/env node
// =============================================================================
// Genera (o solo lee, con --leer) las respuestas por datapoint de un documento
// APROBADO y las deja legibles (encargo 2026-10-13-excel-respuestas-narrativas,
// Paso 2).
//
//   node --env-file=.env.local scripts/suplemento/respuestas-demo.mjs <documento> <carpeta> [baseUrl] [--leer]
//
// CUESTA DINERO sin --leer (una llamada a Sonnet 5.5 por bloque; < $1 por
// emisora). Solo contra una app LOCAL apuntada al proyecto dev. Entra como el
// staff del seed por la misma ruta que la pantalla (POST …/respuestas y consulta
// hasta que termina). Escribe en <carpeta>: respuestas.json y respuestas.md (una
// tabla por destino, con estado, origen, bloque, texto y notas). No imprime
// credenciales.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";

const args = process.argv.slice(2);
const soloLeer = args.includes("--leer");
const [documento, carpeta, BASE = "http://localhost:3014"] = args.filter((a) => !a.startsWith("--"));
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!documento || !carpeta) { console.error("Uso: respuestas-demo.mjs <documento> <carpeta> [baseUrl] [--leer]"); process.exit(2); }
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE)) { console.error(`✗ Solo contra una app local, no ${BASE}.`); process.exit(2); }
if (!URL_SB.includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ Solo contra el proyecto dev."); process.exit(2); }

const jar = new Map();
const db = createServerClient(URL_SB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: process.env.STAFF_PASSWORD || "Demo2025!" });
if (eLogin) { console.error(`✗ login: ${eLogin.message}`); process.exit(2); }
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");

if (!soloLeer) {
  const r = await fetch(`${BASE}/api/suplemento/${documento}/respuestas`, { method: "POST", headers: { cookie: cookie() } });
  console.log(`POST → ${r.status} ${JSON.stringify(await r.json().catch(() => ({})))}`);
  if (r.status !== 202) process.exit(1);
  const inicio = Date.now();
  for (;;) {
    await new Promise((res) => setTimeout(res, 5000));
    const g = await (await fetch(`${BASE}/api/suplemento/${documento}/respuestas`, { headers: { cookie: cookie() } })).json();
    if (g.estado === "listo" || g.estado === "error") {
      console.log(`${g.estado} en ${Math.round((Date.now() - inicio) / 1000)} s · ${JSON.stringify({ ...g.resultado, reserva: undefined })}`);
      if (g.estado === "error") process.exit(1);
      break;
    }
  }
}

const { data: filas, error } = await db
  .from("respuestas_datapoint")
  .select("destino, clave, estado, origen, texto, bloque, bloque_version, hechos, notas, costo_usd, tokens_entrada, tokens_cache_lectura, tokens_salida")
  .eq("documento_id", documento)
  .order("destino")
  .order("clave");
if (error) { console.error(`✗ ${error.message}`); process.exit(1); }
fs.mkdirSync(carpeta, { recursive: true });
fs.writeFileSync(path.join(carpeta, "respuestas.json"), JSON.stringify(filas, null, 1));

const celda = (t) => String(t ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ");
const md = [`# Respuestas por datapoint · documento ${documento}`, ""];
const costo = filas.reduce((a, f) => a + Number(f.costo_usd), 0);
md.push(`Filas: ${filas.length} · costo: $${costo.toFixed(4)}`, "");
for (const destino of ["taxonomia", "formato"]) {
  const fs_ = filas.filter((f) => f.destino === destino);
  const cuenta = (k) => Object.entries(fs_.reduce((a, f) => ((a[f[k]] = (a[f[k]] ?? 0) + 1), a), {})).map(([x, n]) => `${x} ${n}`).join(" · ");
  md.push(`## ${destino} (${fs_.length})`, "", `Por estado: ${cuenta("estado")}. Por origen: ${cuenta("origen")}.`, "");
  md.push("| Código | Estado | Origen | Bloque (v) | Respuesta | Hechos | Notas |", "|---|---|---|---|---|---|---|");
  for (const f of fs_) md.push(`| ${celda(f.clave)} | ${f.estado} | ${f.origen} | ${f.bloque ?? ""}${f.bloque_version ? ` (v${f.bloque_version})` : ""} | ${celda(f.texto)} | ${f.hechos.length} | ${celda((f.notas ?? []).join(" / "))} |`);
  md.push("");
}
fs.writeFileSync(path.join(carpeta, "respuestas.md"), md.join("\n"));
console.log(`escrito: ${path.join(carpeta, "respuestas.md")} · ${filas.length} filas · $${costo.toFixed(4)}`);
