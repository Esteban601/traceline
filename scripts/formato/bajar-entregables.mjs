#!/usr/bin/env node
// =============================================================================
// Descarga, como el staff del seed, el Formato electrónico y el Excel de taxonomía
// de un reporte y, si se pide, el Word de un documento, desde una instancia de la
// aplicación (local o traceline-dev) que apunta al proyecto dev. Cierre del encargo
// 2026-10-26-formato-afirmaciones-y-voz (antes scratchpad fase1/bajar.mjs y
// fase5/bajar-word.mjs).
//
//   node --env-file=<.env.local de dev> scripts/formato/bajar-entregables.mjs <base> <prefijo> \
//        [--reporte <id>] [--word <documento_id>] [--sin-formato] [--sin-excel]
//
// Escribe <prefijo>-formato.xlsx, <prefijo>-taxonomia.xlsx y <prefijo>-suplemento.docx. --sin-formato omite el
// Formato electrónico y --sin-excel el Excel de taxonomía (antes --sin-excel omitía los dos).
// Por defecto, el reporte del demo. Sin contraseñas: la sesión sale de sesion-dev.mjs.
// =============================================================================
import fs from "node:fs";
import { sesionStaffDev } from "./sesion-dev.mjs";

const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const [base, prefijo] = args.filter((a, i) => !a.startsWith("--") && !["--reporte", "--word"].includes(args[i - 1]));
if (!base || !prefijo) { console.error("Uso: bajar-entregables.mjs <base> <prefijo> [--reporte <id>] [--word <documento_id>] [--sin-formato] [--sin-excel]"); process.exit(2); }
const reporte = opcion("--reporte") ?? "20000000-0000-0000-0000-000000000001";
const word = opcion("--word");

const { cookie } = await sesionStaffDev();
const bajar = async (ruta, archivo) => {
  const r = await fetch(`${base}${ruta}`, { headers: { cookie: cookie() } });
  const b = Buffer.from(await r.arrayBuffer());
  if (!r.ok) { console.error(`✗ ${ruta}: ${r.status}`); process.exitCode = 1; return; }
  fs.writeFileSync(archivo, b);
  console.log(`${archivo} · ${r.status} · ${b.length} bytes`);
};
if (!args.includes("--sin-formato")) await bajar(`/admin/cobertura/export-formato?reporte=${reporte}`, `${prefijo}-formato.xlsx`);
if (!args.includes("--sin-excel")) await bajar(`/admin/cobertura/export-taxonomia?reporte=${reporte}`, `${prefijo}-taxonomia.xlsx`);
if (word) await bajar(`/api/suplemento/${word}/word`, `${prefijo}-suplemento.docx`);
