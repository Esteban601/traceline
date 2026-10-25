#!/usr/bin/env node
// =============================================================================
// Aplica las CORRECCIONES de filas (scripts/formato/correcciones-mapeo.mjs) al
// JSON versionado del mapeo y regenera su .md, sin volver a leer el asset del
// formato (encargo 2026-10-24-deuda-s2-formato, Fase 2). Idempotente.
//
//   node scripts/formato/aplicar-correcciones-mapeo.mjs --catalogo <catalogo.json>
//
// <catalogo.json>: {codigo: descripcion} de datapoints_taxonomia activos (el
// mismo insumo que mapear-formato.mjs), para recalcular los párrafos sin código.
// =============================================================================
import fs from "node:fs";
import { aplicarCorrecciones } from "./correcciones-mapeo.mjs";
import { sinMapeoDe, parrafosSinCodigoDe, resumenDe, jsonDe, mdDe } from "./mapeo-salidas.mjs";

const i = process.argv.indexOf("--catalogo");
const CATALOGO = i > -1 ? process.argv[i + 1] : null;
if (!CATALOGO) { console.error("Uso: aplicar-correcciones-mapeo.mjs --catalogo <catalogo.json>"); process.exit(2); }
const JSON_MAPEO = "docs/suplemento-s1s2/mapeo-formato-electronico.json";
const MD_MAPEO = "docs/suplemento-s1s2/mapeo-formato-electronico.md";

const j = JSON.parse(fs.readFileSync(JSON_MAPEO, "utf8"));
const claves = Object.keys(JSON.parse(fs.readFileSync(CATALOGO, "utf8"))).filter((c) => c.startsWith("NIIF")).map((c) => c.toLowerCase().replace(/\s+/g, ""));
const conceptos = aplicarCorrecciones(j.conceptos);
const sinMapeo = sinMapeoDe(conceptos);
const parrafosSinCodigo = parrafosSinCodigoDe(conceptos, claves);
const resumen = resumenDe(conceptos, { formato: j.resumen.formato, revision: j.resumen.revision?.archivo ?? null, noInterpretadas: j.resumen.revision?.noInterpretadas ?? [] });
fs.writeFileSync(JSON_MAPEO, jsonDe(resumen, conceptos, sinMapeo, parrafosSinCodigo));
fs.writeFileSync(MD_MAPEO, mdDe(resumen, conceptos, sinMapeo, parrafosSinCodigo));
console.log(`Correcciones aplicadas a ${conceptos.filter((c) => c.correccion).length} filas · sin mapeo: ${sinMapeo.map((x) => x.fila).join(", ")} · párrafos sin código: ${parrafosSinCodigo.size}`);
