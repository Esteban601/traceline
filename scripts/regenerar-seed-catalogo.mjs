#!/usr/bin/env node
// -----------------------------------------------------------------------------
// REGENERA EL BLOQUE DEL CATÁLOGO EN supabase/seed.sql DESDE LA BASE.
//
// POR QUÉ EXISTE. Las correcciones de la auditoría viven en migraciones, y el
// seed traía las descripciones viejas. Un `db reset` de dev aplicaba las
// migraciones (que corrigen filas que todavía no existen, o sea, nada) y
// después el seed (que reinsertaba el texto equivocado): la corrección se
// deshacía sola y en silencio.
//
// Se regenera DESDE LA BASE y no a mano para que seed y catálogo no puedan
// divergir: si mañana hay otra corrección, se aplica y se vuelve a correr esto.
//
// QUÉ TOCA: solo el bloque `insert into public.datapoints_taxonomia (...) values`
// del seed. Nada más del archivo.
//
// QUÉ NO INCLUYE: las filas que insertan las MIGRACIONES (la extensión GRI y los
// códigos que añadió la auditoría). En un `db reset` las migraciones corren
// antes que el seed, así que volver a insertarlas aquí chocaría con la clave
// única. El script las detecta comparando el catálogo vivo contra los códigos
// que el seed ya traía, y las lista al final para que quede constancia.
//
//   node scripts/regenerar-seed-catalogo.mjs            # escribe el seed
//   node scripts/regenerar-seed-catalogo.mjs --revisar  # solo compara
// -----------------------------------------------------------------------------
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const RAIZ = process.cwd();
const SEED = path.join(RAIZ, "supabase", "seed.sql");
const SOLO_REVISAR = process.argv.includes("--revisar");

function leerEnvLocal() {
  const out = {};
  for (const l of readFileSync(path.join(RAIZ, ".env.local"), "utf8").split("\n")) {
    if (!l.includes("=") || l.trimStart().startsWith("#")) continue;
    out[l.slice(0, l.indexOf("=")).trim()] = l.slice(l.indexOf("=") + 1).trim();
  }
  return out;
}

const env = { ...leerEnvLocal(), ...process.env };
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

// El seed es el de DESARROLLO. Regenerarlo desde staging metería en el
// repositorio el catálogo de producción de facto.
if (ref !== "kmjkoxecxcujxixlxwlb" && env.SEED_TARGET_OK !== "1") {
  console.error(`Este script regenera el seed de DEV y el proyecto enlazado es ${ref}.`);
  console.error("Si es deliberado: SEED_TARGET_OK=1 node scripts/regenerar-seed-catalogo.mjs");
  process.exit(2);
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// --- 1. El bloque actual del seed, para saber qué códigos le pertenecen -------
const seed = readFileSync(SEED, "utf8");
const ANCLA = "insert into public.datapoints_taxonomia (codigo, norma, pilar, seccion_indice, descripcion, ods) values";
const ini = seed.indexOf(ANCLA);
if (ini === -1) throw new Error("No se encontró el bloque del catálogo en el seed.");
const fin = seed.indexOf(");", ini) + 2;
const bloqueViejo = seed.slice(ini, fin);

// Primer literal de cada fila = el código. Basta para saber qué traía el seed.
const codigosDelSeed = [...bloqueViejo.matchAll(/^\s*\('((?:[^']|'')*)'/gm)].map((m) =>
  m[1].replace(/''/g, "'")
);
console.log(`seed actual: ${codigosDelSeed.length} filas`);

// --- 2. El catálogo vivo -----------------------------------------------------
const { data: vivo, error } = await db
  .from("datapoints_taxonomia")
  .select("codigo, norma, pilar, seccion_indice, descripcion, ods, marco, version_taxonomia")
  .eq("marco", "NIIF")
  .eq("version_taxonomia", "2025")
  .order("codigo");
if (error) throw new Error("catálogo: " + error.message);

// --- 3. Qué filas inserta una MIGRACIÓN y por tanto NO van al seed ------------
// Se detectan leyendo los INSERT de las migraciones, no por una lista a mano:
// una lista a mano se queda vieja en cuanto haya otra migración.
const migraciones = readFileSync(
  path.join(RAIZ, "supabase", "migrations", "20260912120000_catalogo_niif_correcciones.sql"),
  "utf8"
);
const iIns = migraciones.indexOf("insert into public.datapoints_taxonomia");
const bloqueMig = migraciones.slice(iIns, migraciones.indexOf("on conflict", iIns));
const deMigracion = new Set(
  [...bloqueMig.matchAll(/^\s*\('((?:[^']|'')*)'/gm)].map((m) => m[1].replace(/''/g, "'"))
);

const paraElSeed = vivo.filter((d) => !deMigracion.has(d.codigo));

// --- 4. Emitir --------------------------------------------------------------
const lit = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const filas = paraElSeed.map(
  (d) =>
    `  (${lit(d.codigo)}, ${lit(d.norma)}, ${lit(d.pilar)}, ${lit(d.seccion_indice)}, ${lit(d.descripcion)}, ${lit(d.ods)})`
);

const bloqueNuevo =
  ANCLA +
  "\n" +
  filas.join(",\n") +
  "\n" +
  // ON CONFLICT porque las migraciones de la auditoría insertan antes que el
  // seed y podrían solaparse si mañana alguna repite un código.
  "on conflict (codigo, version_taxonomia) do nothing;";

// --- 5. Informe -------------------------------------------------------------
const enSeed = new Set(codigosDelSeed);
const enVivo = new Set(vivo.map((d) => d.codigo));
const desaparecidos = codigosDelSeed.filter((c) => !enVivo.has(c));
const nuevosEnVivo = vivo.filter((d) => !enSeed.has(d.codigo)).map((d) => d.codigo);

console.log(`catálogo vivo NIIF: ${vivo.length} · al seed: ${paraElSeed.length} · por migración: ${deMigracion.size}`);
if (desaparecidos.length) {
  console.log("\nCódigos que el seed traía y ya no existen (renombrados o borrados):");
  for (const c of desaparecidos) console.log("  ·", c);
}
if (nuevosEnVivo.length) {
  console.log("\nCódigos del catálogo que el seed no traía:");
  for (const c of nuevosEnVivo) console.log(`  · ${c}${deMigracion.has(c) ? "  [lo inserta una migración]" : ""}`);
}

if (SOLO_REVISAR) {
  console.log(bloqueNuevo === bloqueViejo ? "\nEl seed ya está al día." : "\nEl seed DIFIERE del catálogo.");
  process.exit(bloqueNuevo === bloqueViejo ? 0 : 1);
}

writeFileSync(SEED, seed.slice(0, ini) + bloqueNuevo + seed.slice(fin));
console.log(`\nseed.sql regenerado: ${filas.length} filas.`);
