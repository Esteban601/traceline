#!/usr/bin/env node
// =============================================================================
// QUÉ RECIBE UN BLOQUE (Paso 5b, segunda revisión, punto 9). Sin modelo, sin
// costo: arma el prompt de cada bloque pedido contra un documento del demo
// (libro vigente) y reporta el tamaño de la capa estable y de cada sección de
// la volátil, en caracteres y tokens aproximados (÷ 3.5 en español).
//
//   node --env-file=.env.local --experimental-strip-types \
//        --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/suplemento/medir-prompt.mjs <documentoId> 15 18 27
// =============================================================================
import { createClient } from "@supabase/supabase-js";
import { generarBloque } from "../../lib/suplemento/generar-bloque.ts";

const [documento, ...nums] = process.argv.slice(2);
if (!documento || !nums.length) { console.error("Uso: medir-prompt.mjs <documentoId> <n>…"); process.exit(2); }
if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ Solo contra el proyecto dev."); process.exit(2); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const tok = (c) => Math.round(c / 3.5);
for (const n of nums.map(Number)) {
  let m = null;
  await generarBloque(db, documento, n, { sinPersistir: true, salidaDePrueba: { texto: "x", fuentes_usadas: [] }, medir: (x) => (m = x) });
  if (!m) { console.log(`bloque ${n}: sin prompt (plantilla, literal o no aplica)`); continue; }
  const vol = Object.values(m.volatil).reduce((a, b) => a + b, 0);
  console.log(`\nbloque ${n} · estable ${m.estable.reduce((a, b) => a + b, 0)} car. (~${tok(m.estable.reduce((a, b) => a + b, 0))} tok) · volátil ${vol} car. (~${tok(vol)} tok)`);
  for (const [k, v] of Object.entries(m.volatil).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(7)}  ~${String(tok(v)).padStart(5)} tok  ${k}`);
  console.log("  Datos, por clave (JSON):");
  for (const [k, v] of Object.entries(m.datos).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(7)}  ~${String(tok(v)).padStart(5)} tok  ${k}`);
}
process.exit(0);
