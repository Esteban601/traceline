#!/usr/bin/env node
// =============================================================================
// CIERRA UN DOCUMENTO SIN REGENERARLO (Paso 5c): cierre de pendientes verificado,
// validador cruzado, pasada de coherencia y Word. Para después de regenerar
// bloques sueltos con regenerar-bloques.mjs.
//
//   node --env-file=.env.local scripts/suplemento/cerrar-documento.mjs <documento> <carpeta> [baseUrl]
//
// CUESTA DINERO: la verificación del cierre (centavos) y la coherencia (~$1.2).
// Solo contra una app local apuntada al proyecto dev. Escribe <carpeta>/resumen.json,
// <carpeta>/documento.docx y .pdf. No imprime credenciales.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";

const [documento, carpeta, BASE = "http://localhost:3014"] = process.argv.slice(2);
if (!documento || !carpeta) { console.error("Uso: cerrar-documento.mjs <documento> <carpeta> [baseUrl]"); process.exit(2); }
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE)) { console.error(`✗ Solo contra una app local, no ${BASE}.`); process.exit(2); }
if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ Solo contra el proyecto dev."); process.exit(2); }
const jar = new Map();
const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "analista@irstrat.example", password: process.env.ANALISTA_PASSWORD || "Demo2025!" });
if (eLogin) { console.error(`✗ login: ${eLogin.message}`); process.exit(2); }
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
const api = (m, r, c) => fetch(`${BASE}${r}`, { method: m, headers: { cookie: cookie(), "content-type": "application/json" }, body: c ? JSON.stringify(c) : undefined });

const resumen = {};
const ci = await api("POST", `/api/suplemento/${documento}/cierre`);
resumen.cierre = ci.ok ? await ci.json() : { error: ci.status };
console.log(`cierre: ${resumen.cierre.cierres?.filter((c) => c.veredicto === "responde").length ?? "—"} de ${resumen.cierre.cierres?.length ?? "—"}`);
const cr = await api("GET", `/api/suplemento/${documento}/cruzado`);
resumen.cruzado = cr.ok ? (await cr.json()).discrepancias.map((d) => ({ bloque: d.bloque, tipo: d.tipo, otro: d.otroBloque, detalle: d.detalle.slice(0, 200) })) : { error: cr.status };
console.log(`validador cruzado: ${Array.isArray(resumen.cruzado) ? resumen.cruzado.length : "error"}`);
const pc = await api("POST", `/api/suplemento/${documento}/coherencia`, { origen: "manual" });
if (pc.status === 202) {
  const hasta = Date.now() + 8 * 60 * 1000;
  while (Date.now() < hasta) {
    await new Promise((r) => setTimeout(r, 5000));
    const c = await api("GET", `/api/suplemento/${documento}/coherencia`);
    if (!c.ok) continue;
    const d = await c.json();
    if (d.estado !== "generando") { resumen.coherencia = { estado: d.estado, observaciones: (d.observaciones ?? []).length, costoUsd: Number(d.costo_usd), porTipo: (d.observaciones ?? []).reduce((a, o) => ((a[`${o.origen ?? "modelo"}:${o.tipo}`] = (a[`${o.origen ?? "modelo"}:${o.tipo}`] ?? 0) + 1), a), {}) }; break; }
  }
} else resumen.coherencia = { error: pc.status };
console.log(`coherencia: ${JSON.stringify(resumen.coherencia)}`);
fs.mkdirSync(carpeta, { recursive: true });
const w = await api("GET", `/api/suplemento/${documento}/word`);
const docx = path.join(carpeta, "documento.docx");
fs.writeFileSync(docx, Buffer.from(await w.arrayBuffer()));
execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", carpeta, docx], { stdio: "ignore" });
resumen.word = w.status;
fs.writeFileSync(path.join(carpeta, "resumen.json"), JSON.stringify(resumen, null, 1));
console.log(`word: ${w.status}`);
