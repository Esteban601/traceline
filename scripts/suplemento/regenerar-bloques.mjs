#!/usr/bin/env node
// =============================================================================
// Regenera bloques sueltos de un documento del Suplemento y compara antes y
// después (encargo 2026-10-06-suplemento-calidad, Paso 2).
//
//   node scripts/suplemento/regenerar-bloques.mjs <documento> <n,n,n> <carpeta> [baseUrl]
//
// CUESTA DINERO: una llamada al modelo por bloque (~$0.10–0.30). Solo contra una
// app LOCAL apuntada al proyecto dev; nunca staging. Entra como el analista del
// seed por la misma ruta que la pantalla (POST …/bloque/N y consulta hasta que
// termina). REEMPLAZA el texto del bloque en ese documento: guarda antes el
// estado anterior en <carpeta>/antes-<n>.json y después el nuevo en
// <carpeta>/despues-<n>.json, y escribe <carpeta>/comparacion.json con costo,
// tokens, fuentes (cuántas de documentos del Perfil, `adj:`) y pendientes.
// No imprime credenciales.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";

const [documento, lista, carpeta, BASE = "http://localhost:3014"] = process.argv.slice(2);
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REF_DEV = "kmjkoxecxcujxixlxwlb";

if (!documento || !lista || !carpeta) {
  console.error("Uso: regenerar-bloques.mjs <documento> <n,n,n> <carpeta> [baseUrl]");
  process.exit(2);
}
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE)) { console.error(`✗ Solo contra una app local, no ${BASE}.`); process.exit(2); }
if (!URL_SB.includes(REF_DEV)) { console.error("✗ Solo contra el proyecto dev (NEXT_PUBLIC_SUPABASE_URL de dev)."); process.exit(2); }
const numeros = lista.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 40);

const jar = new Map();
const db = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "analista@irstrat.example", password: process.env.ANALISTA_PASSWORD || "Demo2025!" });
if (eLogin) { console.error(`✗ login: ${eLogin.message}`); process.exit(2); }
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
const api = (metodo, ruta, cuerpo) => fetch(`${BASE}${ruta}`, { method: metodo, headers: { cookie: cookie(), "content-type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });

const CAMPOS = "numero, estado, texto, fuentes, pendientes, costo_usd, tokens_entrada, tokens_entrada_cache_escritura, tokens_entrada_cache_lectura, tokens_salida, duracion_ms, prompt_version";
const leer = async (n) => (await db.from("documentos_bloques").select(CAMPOS).eq("documento_id", documento).eq("numero", n).maybeSingle()).data;
const resumen = (b) => b && {
  estado: b.estado,
  costo: Number(b.costo_usd ?? 0),
  tokens: { entrada: b.tokens_entrada, cache_escritura: b.tokens_entrada_cache_escritura, cache_lectura: b.tokens_entrada_cache_lectura, salida: b.tokens_salida },
  segundos: Number(((b.duracion_ms ?? 0) / 1000).toFixed(1)),
  prompt: b.prompt_version,
  fuentes: (b.fuentes ?? []).length,
  fuentesDocumentos: (b.fuentes ?? []).filter((f) => String(f.id).startsWith("adj:")).map((f) => f.detalle),
  pendientes: (b.pendientes ?? []).length,
  palabras: (b.texto ?? "").split(/\s+/).filter(Boolean).length,
};

fs.mkdirSync(carpeta, { recursive: true });
const comparacion = [];
for (const n of numeros) {
  const antes = await leer(n);
  fs.writeFileSync(path.join(carpeta, `antes-${n}.json`), JSON.stringify(antes, null, 1));
  const p = await api("POST", `/api/suplemento/${documento}/bloque/${n}`, {});
  if (p.status !== 202 && p.status !== 409) { console.error(`✗ bloque ${n}: ${p.status} ${(await p.json().catch(() => ({}))).error ?? ""}`); continue; }
  const hasta = Date.now() + 4 * 60 * 1000;
  let estado = "generando";
  while (Date.now() < hasta && (estado === "generando" || estado === "en_cola")) {
    await new Promise((r) => setTimeout(r, 3000));
    const c = await api("GET", `/api/suplemento/${documento}/bloque/${n}`);
    if (c.ok) estado = (await c.json()).estado;
  }
  const despues = await leer(n);
  fs.writeFileSync(path.join(carpeta, `despues-${n}.json`), JSON.stringify(despues, null, 1));
  const fila = { bloque: n, antes: resumen(antes), despues: resumen(despues) };
  comparacion.push(fila);
  console.log(`bloque ${n}: ${fila.antes?.estado} $${fila.antes?.costo} → ${fila.despues?.estado} $${fila.despues?.costo} · fuentes de documentos ${fila.despues?.fuentesDocumentos.length} · pendientes ${fila.antes?.pendientes} → ${fila.despues?.pendientes}`);
}
fs.writeFileSync(path.join(carpeta, "comparacion.json"), JSON.stringify(comparacion, null, 1));
