#!/usr/bin/env node
// =============================================================================
// Arma el libro de hechos del reporte demo y lo deja legible (encargo
// 2026-10-06-suplemento-calidad, Paso 5).
//
//   node --env-file=.env.local scripts/suplemento/libro-demo.mjs <carpeta> [baseUrl] [--forzar]
//
// CUESTA DINERO (centavos: Sonnet 5.5). Solo contra una app LOCAL apuntada al
// proyecto dev. Entra como el analista del seed, POST …/hechos y espera el GET.
// Escribe en <carpeta>: libro.json (todo) y libro.md (por bloque dueño, con
// rango, verificación, extracto y fuente; contradicciones y descartes aparte).
// No imprime credenciales.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";

const args = process.argv.slice(2);
const forzar = args.includes("--forzar");
const [carpeta, BASE = "http://localhost:3014"] = args.filter((a) => !a.startsWith("--"));
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const REPORTE = process.env.REPORTE_ID || "20000000-0000-0000-0000-000000000001";
if (!carpeta) { console.error("Uso: libro-demo.mjs <carpeta> [baseUrl] [--forzar]"); process.exit(2); }
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE)) { console.error(`✗ Solo contra una app local, no ${BASE}.`); process.exit(2); }
if (!URL_SB.includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ Solo contra el proyecto dev."); process.exit(2); }

const jar = new Map();
const db = createServerClient(URL_SB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "analista@irstrat.example", password: process.env.ANALISTA_PASSWORD || "Demo2025!" });
if (eLogin) { console.error(`✗ login: ${eLogin.message}`); process.exit(2); }
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
const api = (m, r, c) => fetch(`${BASE}${r}`, { method: m, headers: { cookie: cookie(), "content-type": "application/json" }, body: c ? JSON.stringify(c) : undefined });

const p = await api("POST", `/api/suplemento/${REPORTE}/hechos`, { forzar });
const abierto = await p.json();
if (p.status !== 202) { console.error(`✗ POST hechos: ${p.status} ${abierto.error}`); process.exit(1); }
console.log(`libro ${abierto.id.slice(0, 8)}… armándose`);
let d = null;
const hasta = Date.now() + 15 * 60 * 1000;
while (Date.now() < hasta) {
  await new Promise((r) => setTimeout(r, 5000));
  const g = await api("GET", `/api/suplemento/${REPORTE}/hechos`);
  if (!g.ok) continue;
  d = await g.json();
  if (d.libro.id === abierto.id && d.libro.estado !== "generando") break;
}
if (!d || d.libro.estado !== "listo") { console.error(`✗ libro: ${d?.libro.estado} ${d?.libro.error ?? ""}`); process.exit(1); }

fs.mkdirSync(carpeta, { recursive: true });
fs.writeFileSync(path.join(carpeta, "libro.json"), JSON.stringify(d, null, 1));

const { libro, hechos } = d;
const r = libro.resumen;
const md = [
  `# Libro de hechos del demo`,
  "",
  `Libro ${libro.id} · ${libro.modelo} · ${libro.prompt_version} · ${libro.llamadas} llamadas · $${Number(libro.costo_usd).toFixed(4)} · ${(libro.duracion_ms / 1000).toFixed(0)} s`,
  `Tokens: entrada ${libro.tokens_entrada}, caché ${libro.tokens_entrada_cache_escritura}/${libro.tokens_entrada_cache_lectura}, salida ${libro.tokens_salida}.${libro.error ? ` Avisos: ${libro.error}` : ""}`,
  "",
  "## Conteos",
  "",
  "| Rango | Total | Verificados | Descartados | En contradicción |",
  "|---|---|---|---|---|",
  ...Object.entries(r.por_rango).map(([k, v]) => `| ${k} | ${v.total} | ${v.verificados} | ${v.descartados} | ${v.en_conflicto} |`),
  "",
  `Vigentes ${r.vigentes} · en contradicción ${r.en_conflicto} (${r.grupos_en_conflicto} grupos) · descartados ${r.descartados}. Por fuente: ${Object.entries(r.por_fuente).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
  `Bloques sin hechos propios: ${r.bloques_sin_hechos.join(", ") || "ninguno"}.`,
  `Insumos: ${r.insumos.adjuntos.map((a) => `${a.archivo} (${a.enviadas} de ${a.unidades} partes${a.truncado ? ", recortado" : ""})`).join("; ")}. Solicitudes validadas sin fuente de texto ni captura: ${r.insumos.solicitudesValidadasSinFuente}.`,
  "",
  "## Contradicciones",
  "",
  ...Object.values(Object.groupBy(hechos.filter((h) => h.grupo_conflicto), (h) => h.grupo_conflicto)).flatMap((g) => [
    `- **${g[0].clave}** — ${g[0].conflicto}`,
    ...g.map((h) => `  - (${h.rango_fuente}) ${h.enunciado} — «${h.extracto}» · ${h.fuente_detalle}`),
  ]),
  "",
  "## Hechos por bloque dueño",
  "",
  ...Object.entries(Object.groupBy(hechos.filter((h) => h.estado !== "descartado"), (h) => String(h.bloque_dueno))).flatMap(([n, hs]) => [
    `### Bloque ${n}`,
    "",
    ...hs.map((h) => `- ${h.estado === "en_conflicto" ? "⚠ " : ""}[${h.rango_fuente}] ${h.enunciado} — «${h.extracto.slice(0, 160)}${h.extracto.length > 160 ? "…" : ""}» · ${h.fuente_detalle}${h.bloques_referencia.length ? ` · referencia: ${h.bloques_referencia.join(", ")}` : ""}`),
    "",
  ]),
  "## Descartados",
  "",
  ...hechos.filter((h) => h.estado === "descartado").map((h) => `- ${h.verificacion} — ${h.enunciado} — «${h.extracto}» (${h.fuente_detalle})`),
].join("\n");
fs.writeFileSync(path.join(carpeta, "libro.md"), md);
console.log(JSON.stringify({ costo: Number(libro.costo_usd), segundos: Math.round(libro.duracion_ms / 1000), llamadas: libro.llamadas, ...r, insumos: undefined, motivos_descarte: r.motivos_descarte }, null, 1));
