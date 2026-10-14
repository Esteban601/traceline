#!/usr/bin/env node
// =============================================================================
// Sube la PLANTILLA del Formato electrónico NIIF S1/S2 a Storage de un ambiente
// y la verifica por sha256 (encargo 2026-10-14-excel-formato-a-produccion,
// Paso 1). En staging lo corre Esteban en su terminal (escritura en staging,
// CLAUDE.md §1); en ensayo, Claude Code.
//
//   (set -a; source .env.staging.local; set +a; \
//    node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//      scripts/formato/subir-plantilla.mjs referencia/formato-electronico/plantilla-formato-2025.xlsx \
//      --destino staging [--subir])
//
// Sin --subir solo lee: imprime el sha256 del archivo local, lo valida y dice si
// la ruta ya existe en Storage (y con qué sha256). Con --subir pide escribir el
// ref del destino, sube SIN reemplazar (si la ruta ya existe con otro archivo,
// falla; con el mismo, no hace nada), la descarga de vuelta e imprime su sha256:
// el de antes y el de después deben ser iguales al esperado.
//
// Barreras: el archivo tiene que ser la plantilla revisada (SHA_ESPERADO, la que
// está en Storage de dev desde el 13/10/2026), con sus 23 imágenes en celda
// enlazadas y sin menciones de la emisora de referencia; NEXT_PUBLIC_SUPABASE_URL
// tiene que ser la del destino. La llave (SUPABASE_SERVICE_ROLE_KEY) y la URL no
// se imprimen.
// =============================================================================
import fs from "node:fs";
import readline from "node:readline/promises";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { validarImagenesEnCelda } from "../../lib/formato/xlsx-xml.ts";
import { IMAGENES_EN_CELDA, RUTA_PLANTILLA_FORMATO } from "../../lib/formato/plantilla.ts";

// Sin proyecto de ensayo vivo (el de v41 se borró el 14/10/2026): con el marcador, «ensayo» falla.
const REFS = { dev: "kmjkoxecxcujxixlxwlb", ensayo: "PENDIENTE_REF_ENSAYO", staging: "ewgnvjtjhvdltvkopptn" };
const SHA_ESPERADO = "eb09aa55c5a6073fe9d3ec299f08cbac0b2a0c1fd4dc8ec4a2c00ffefc146786";
const TIPO = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const args = process.argv.slice(2);
const subir = args.includes("--subir");
const iDest = args.indexOf("--destino");
const destino = iDest === -1 ? null : args[iDest + 1];
const archivo = args.find((a, i) => !a.startsWith("--") && i !== iDest + 1);
const salir = (m, c = 2) => { console.error(`✗ ${m}`); process.exit(c); };
if (!archivo || !destino || !Object.hasOwn(REFS, destino)) salir("Uso: subir-plantilla.mjs <plantilla.xlsx> --destino <dev|ensayo|staging> [--subir]");

const ref = REFS[destino];
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (ref.startsWith("PENDIENTE_")) salir("No hay proyecto de ensayo: escribe su ref en REFS al crearlo.");
if (!URL_SB.includes(ref)) salir(`NEXT_PUBLIC_SUPABASE_URL no es la de ${destino} (${ref}).`);
for (const [otro, r] of Object.entries(REFS)) if (otro !== destino && URL_SB.includes(r)) salir(`NEXT_PUBLIC_SUPABASE_URL contiene el ref de ${otro}.`);
if (!LLAVE) salir("Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.");

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

// 1. El archivo local: la plantilla revisada, íntegra.
const buf = fs.readFileSync(archivo);
const huella = sha(buf);
console.log(`destino: ${destino} (${ref}) · documentos/${RUTA_PLANTILLA_FORMATO}`);
console.log(`archivo local: ${buf.length} bytes · sha256 ${huella}`);
if (huella !== SHA_ESPERADO) salir(`el archivo no es la plantilla revisada (se esperaba sha256 ${SHA_ESPERADO}).`, 1);
const zip = await JSZip.loadAsync(buf);
const hojas = {};
for (const n of Object.keys(zip.files).filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x))) hojas[n] = await zip.file(n).async("string");
const imagenes = validarImagenesEnCelda(hojas, Object.keys(zip.files), IMAGENES_EN_CELDA);
let menciones = 0;
for (const n of Object.keys(zip.files).filter((x) => /\.(xml|vml|rels)$/.test(x))) menciones += ((await zip.file(n).async("string")).match(/autl[aá]n/gi) ?? []).length;
if (imagenes.length || menciones) salir(`plantilla inválida · imágenes: ${imagenes.join("; ") || "ok"} · menciones de la emisora: ${menciones}`, 1);
console.log(`  ✓ sha256 esperado · ${IMAGENES_EN_CELDA} imágenes en celda enlazadas · 0 menciones de la emisora de referencia`);

// 2. Qué hay en Storage.
const db = createClient(URL_SB, LLAVE, { auth: { persistSession: false } });
const carpeta = RUTA_PLANTILLA_FORMATO.slice(0, RUTA_PLANTILLA_FORMATO.lastIndexOf("/"));
const nombre = RUTA_PLANTILLA_FORMATO.slice(carpeta.length + 1);
const enStorage = async () => {
  const { data, error } = await db.storage.from("documentos").list(carpeta, { search: nombre });
  if (error) salir(`listar Storage: ${error.message}`, 1);
  if (!(data ?? []).some((o) => o.name === nombre)) return null;
  const { data: blob, error: eDesc } = await db.storage.from("documentos").download(RUTA_PLANTILLA_FORMATO);
  if (eDesc || !blob) salir(`descargar de Storage: ${eDesc?.message ?? "sin contenido"}`, 1);
  const b = Buffer.from(await blob.arrayBuffer());
  return { bytes: b.length, sha: sha(b) };
};
const previo = await enStorage();
console.log(previo ? `en Storage: ya existe · ${previo.bytes} bytes · sha256 ${previo.sha}${previo.sha === huella ? " (= local)" : " (DISTINTO del local)"}` : "en Storage: no existe");

if (!subir) {
  console.log(`\nRevisión terminada.${previo ? "" : " Para subir: repite el comando con --subir."}`);
  process.exit(previo && previo.sha !== huella ? 1 : 0);
}
if (previo) {
  if (previo.sha === huella) { console.log("\n✓ Ya está la misma plantilla; no se sube nada."); process.exit(0); }
  salir("la ruta ya tiene OTRO archivo: no se reemplaza desde aquí. Revisa con Claude Code antes de seguir.", 1);
}

// 3. Subir sin reemplazar y verificar de vuelta.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const confirma = (await rl.question(`Escribe el ref de ${destino} para subir la plantilla: `)).trim();
rl.close();
if (confirma !== ref) salir("Ref distinto; no se sube nada.", 1);
const { error: eSub } = await db.storage.from("documentos").upload(RUTA_PLANTILLA_FORMATO, buf, { contentType: TIPO, upsert: false });
if (eSub) salir(`subir: ${eSub.message}`, 1);
const despues = await enStorage();
if (!despues) salir("tras subir, la ruta no aparece en Storage.", 1);
console.log(`subida · descargada de vuelta: ${despues.bytes} bytes · sha256 ${despues.sha}`);
if (despues.sha !== huella) salir("el sha256 de Storage no es el del archivo local.", 1);
console.log(`\n✓ Plantilla en documentos/${RUTA_PLANTILLA_FORMATO} (${destino}) · sha256 antes = después = esperado.`);
