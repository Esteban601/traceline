#!/usr/bin/env node
// =============================================================================
// PRUEBA DE ESTABILIDAD DEL LIBRO DE HECHOS (Paso 5b, segunda revisión, punto 10).
//
//   node --env-file=.env.local scripts/suplemento/estabilidad-libro.mjs <carpeta> [baseUrl]
//
// CUESTA DINERO (dos libros completos, ~$1–2 con Sonnet 5.5). Arma el libro del
// demo DOS veces sobre los mismos insumos (libro-demo.mjs --forzar, en
// <carpeta>/a y <carpeta>/b) y compara el conjunto de hechos vigentes.
//
// Identidad de un hecho entre corridas: su oración (`<fuente>#n`, partida por
// código); para los hechos directos y el organigrama, fuente + clave. Diferencia
// = |A △ B| / |A ∪ B|. Falla si pasa del 2 %. Informa además, sobre los hechos
// comunes, cuántos cambiaron de bloque dueño o de clave, y los grupos en
// contradicción de cada corrida.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [carpeta, BASE = "http://localhost:3014"] = process.argv.slice(2);
if (!carpeta) { console.error("Uso: estabilidad-libro.mjs <carpeta> [baseUrl]"); process.exit(2); }
const UMBRAL = 0.02;
const script = path.join(path.dirname(new URL(import.meta.url).pathname), "libro-demo.mjs");

for (const c of ["a", "b"]) {
  console.log(`— corrida ${c}`);
  execFileSync(process.execPath, [script, path.join(carpeta, c), BASE, "--forzar"], { stdio: ["ignore", "ignore", "inherit"], env: process.env });
}
const leer = (c) => JSON.parse(fs.readFileSync(path.join(carpeta, c, "libro.json"), "utf8"));
const [A, B] = [leer("a"), leer("b")];
const idDe = (h) => h.oracion ?? `${h.fuente_id}|${h.clave}`;
const vivos = (d) => new Map(d.hechos.filter((h) => h.estado !== "descartado").map((h) => [idDe(h), h]));
const [va, vb] = [vivos(A), vivos(B)];
const union = new Set([...va.keys(), ...vb.keys()]);
const soloA = [...va.keys()].filter((k) => !vb.has(k));
const soloB = [...vb.keys()].filter((k) => !va.has(k));
const comunes = [...va.keys()].filter((k) => vb.has(k));
const dif = union.size ? (soloA.length + soloB.length) / union.size : 0;
const cambioDueno = comunes.filter((k) => va.get(k).bloque_dueno !== vb.get(k).bloque_dueno);
const cambioClave = comunes.filter((k) => va.get(k).clave !== vb.get(k).clave);
const cambioEstado = comunes.filter((k) => va.get(k).estado !== vb.get(k).estado);
// Veredicto de contradicción (informativo): el mismo hecho, decidido distinto.
const cambioVeredicto = comunes.filter((k) => (va.get(k).veredicto ?? null) !== (vb.get(k).veredicto ?? null));
const linea = (h) => `- [${h.bloque_dueno}] ${h.enunciado.slice(0, 140)} — ${idDe(h)}`;

const informe = {
  corridas: [A, B].map((d) => ({ libro: d.libro.id.slice(0, 8), costo: Number(d.libro.costo_usd), segundos: Math.round(d.libro.duracion_ms / 1000), vigentes: d.libro.resumen.vigentes, en_conflicto: d.libro.resumen.en_conflicto, descartados: d.libro.resumen.descartados, contradicciones: d.libro.resumen.contradicciones })),
  vivos: [va.size, vb.size],
  union: union.size,
  solo_a: soloA.length,
  solo_b: soloB.length,
  diferencia: Number((dif * 100).toFixed(2)),
  comunes: comunes.length,
  cambio_de_dueno: cambioDueno.length,
  cambio_de_clave: cambioClave.length,
  cambio_de_estado: cambioEstado.length,
  cambio_de_veredicto: cambioVeredicto.length,
};
fs.writeFileSync(
  path.join(carpeta, "estabilidad.md"),
  [
    "# Estabilidad del libro de hechos",
    "",
    "```json",
    JSON.stringify(informe, null, 1),
    "```",
    "",
    `## Solo en A (${soloA.length})`, "", ...soloA.map((k) => linea(va.get(k))), "",
    `## Solo en B (${soloB.length})`, "", ...soloB.map((k) => linea(vb.get(k))), "",
    `## Cambio de bloque dueño (${cambioDueno.length})`, "", ...cambioDueno.map((k) => `- ${va.get(k).bloque_dueno} → ${vb.get(k).bloque_dueno}: ${va.get(k).enunciado.slice(0, 120)}`), "",
    `## Cambio de estado (${cambioEstado.length})`, "", ...cambioEstado.map((k) => `- ${va.get(k).estado} → ${vb.get(k).estado}: ${va.get(k).enunciado.slice(0, 120)}`), "",
    `## Cambio de veredicto (${cambioVeredicto.length})`, "", ...cambioVeredicto.map((k) => `- ${va.get(k).veredicto ?? "—"} → ${vb.get(k).veredicto ?? "—"}: ${va.get(k).enunciado.slice(0, 120)}`),
  ].join("\n")
);
console.log(JSON.stringify(informe, null, 1));
console.log(dif <= UMBRAL ? `✓ Libro estable: ${informe.diferencia} % ≤ 2 %` : `✗ Libro inestable: ${informe.diferencia} % > 2 %`);
process.exit(dif <= UMBRAL ? 0 : 1);
