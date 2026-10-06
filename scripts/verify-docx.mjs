#!/usr/bin/env node
// =============================================================================
// VALIDACIÓN ESTRUCTURAL DE UN .docx
//
// Por qué existe: la primera marca de agua del Suplemento era una forma VML
// escrita a mano. El archivo abría en Vista Previa, en Quick Look y en la
// conversión de `textutil` —los tres leen lo que pueden y callan lo que no— y
// Microsoft Word se negaba a abrirlo. Un visor indulgente no prueba nada.
//
// QUÉ PRUEBA ESTE ARNÉS, Y QUÉ NO. Comprueba que el paquete OOXML está bien
// formado y es internamente coherente: que el zip abre, que cada parte
// declarada existe, que cada XML es parseable, que cada `r:id` citado resuelve
// a una relación real, y que no hay VML. Eso es lo que atrapa la clase de fallo
// que ya nos costó un entregable.
//
// Lo que NO prueba: que Word lo abra. Word valida contra el esquema completo de
// ECMA-376 y tiene reglas propias que ningún arnés casero reproduce. La única
// prueba de que un .docx abre en Word es abrirlo en Word. Este script reduce el
// riesgo y da un veredicto rápido; no sustituye esa prueba.
//
//   node scripts/verify-docx.mjs <archivo.docx> [--esperar-marca|--sin-marca]
// =============================================================================

import { readFileSync } from "node:fs";
import JSZip from "jszip";
import sax from "sax";

const MARCA = "BORRADOR GENERADO";

const archivo = process.argv[2];
if (!archivo) {
  console.error("uso: node scripts/verify-docx.mjs <archivo.docx> [--esperar-marca|--sin-marca]");
  process.exit(2);
}
const esperaMarca = process.argv.includes("--esperar-marca");
const esperaSinMarca = process.argv.includes("--sin-marca");

let fallos = 0;
const ok = (cond, etq) => {
  console.log(`  ${cond ? "✓" : "✗"} ${etq}`);
  if (!cond) fallos++;
};

/** Parseo estricto: el parser lanza al primer XML mal formado. */
function parsear(nombre, xml) {
  const parser = sax.parser(true, { xmlns: true, position: true });
  let error = null;
  parser.onerror = (e) => {
    error = e.message.split("\n")[0];
    parser.resume();
  };
  try {
    parser.write(xml).close();
  } catch (e) {
    error = error ?? String(e.message ?? e);
  }
  return error;
}

const zip = await JSZip.loadAsync(readFileSync(archivo));
const nombres = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
console.log(`\n${archivo}\n${nombres.length} partes en el paquete\n`);

// --- 1. Partes obligatorias --------------------------------------------------
console.log("Partes obligatorias del paquete:");
for (const req of ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]) {
  ok(nombres.includes(req), req);
}

// --- 2. Todo XML es parseable ------------------------------------------------
console.log("\nXML bien formado:");
const xmls = new Map();
let malos = 0;
for (const n of nombres) {
  if (!/\.(xml|rels)$/i.test(n)) continue;
  const texto = await zip.file(n).async("string");
  xmls.set(n, texto);
  const err = parsear(n, texto);
  if (err) {
    console.log(`  ✗ ${n}: ${err}`);
    malos++;
  }
}
ok(malos === 0, `las ${xmls.size} partes XML parsean sin error`);

// --- 3. Content types: cada override apunta a una parte que existe -----------
console.log("\nContent types:");
const ct = xmls.get("[Content_Types].xml") ?? "";
const overrides = [...ct.matchAll(/PartName="([^"]+)"/g)].map((m) => m[1].replace(/^\//, ""));
const faltantes = overrides.filter((p) => !nombres.includes(p));
ok(faltantes.length === 0, `los ${overrides.length} Override apuntan a partes existentes${faltantes.length ? ` (faltan: ${faltantes.join(", ")})` : ""}`);
ok(
  /ContentType="application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\.main\+xml"/.test(ct),
  "declara el content type de documento principal de Word"
);

// --- 4. Relaciones: cada r:id citado resuelve --------------------------------
// Es el fallo silencioso más común: una parte referencia una relación que su
// .rels no declara, y el lector se encuentra con un hueco a mitad de camino.
console.log("\nRelaciones:");
let idsRotos = 0;
for (const [n, xml] of xmls) {
  if (n.endsWith(".rels")) continue;
  const rels = `${n.replace(/\/[^/]+$/, "")}/_rels/${n.split("/").pop()}.rels`;
  const declarados = new Set(
    [...(xmls.get(rels) ?? "").matchAll(/Id="([^"]+)"/g)].map((m) => m[1])
  );
  const citados = new Set([...xml.matchAll(/r:(?:id|embed|link)="([^"]+)"/g)].map((m) => m[1]));
  for (const id of citados) {
    if (!declarados.has(id)) {
      console.log(`  ✗ ${n} cita ${id}, que ${rels} no declara`);
      idsRotos++;
    }
  }
}
ok(idsRotos === 0, "todo r:id citado está declarado en el .rels de su parte");

// --- 5. Nada de VML ----------------------------------------------------------
// La regresión concreta que este arnés existe para impedir.
console.log("\nConstrucciones que Word rechaza:");
// Se buscan ELEMENTOS, no la declaración de espacio de nombres. La librería
// `docx` declara xmlns:v en la raíz de cada parte como plantilla y no emite un
// solo elemento VML; confundir una cosa con la otra marcaba siete partes sanas.
const conVml = [...xmls.entries()].filter(
  ([, x]) => /<w:pict[\s>]/.test(x) || /<v:[a-zA-Z]/.test(x) || /<o:[a-zA-Z]/.test(x)
);
ok(conVml.length === 0, `sin elementos VML ni <w:pict>${conVml.length ? ` (en: ${conVml.map(([n]) => n).join(", ")})` : ""}`);

// --- 6. El documento tiene cuerpo -------------------------------------------
console.log("\nContenido:");
const doc = xmls.get("word/document.xml") ?? "";
const parrafos = (doc.match(/<w:p[ >]/g) ?? []).length;
const tablas = (doc.match(/<w:tbl>/g) ?? []).length;
ok(parrafos > 0, `el cuerpo tiene párrafos (${parrafos})`);
ok(/<w:body>/.test(doc) && /<\/w:body>/.test(doc), "el cuerpo abre y cierra");
console.log(`  · ${tablas} tabla(s)`);

// --- 7. La marca de agua, si se esperaba ------------------------------------
const cabeceras = [...xmls.keys()].filter((n) => /^word\/header\d*\.xml$/.test(n));
const marcaEnCabecera = cabeceras.some((n) => (xmls.get(n) ?? "").includes(MARCA));
const marcaEnCuerpo = doc.includes(MARCA);
if (esperaMarca || esperaSinMarca) {
  console.log("\nMarca de agua:");
  if (esperaMarca) {
    ok(cabeceras.length > 0, `hay encabezado (${cabeceras.join(", ") || "ninguno"})`);
    ok(marcaEnCabecera, "la marca está en el encabezado, así que se repite en cada página");
    ok(marcaEnCuerpo, "la marca está también en la portada, para lectores que no pinten el encabezado");
  }
  if (esperaSinMarca) {
    ok(!marcaEnCabecera && !marcaEnCuerpo, "el documento aprobado NO lleva marca de borrador");
  }
}

// --- Veredicto ---------------------------------------------------------------
console.log(`\n${fallos === 0 ? "✅ ESTRUCTURA VÁLIDA" : `❌ ${fallos} problema(s)`}`);
if (fallos === 0) {
  console.log("   (estructura y coherencia interna; que Word lo abra solo lo prueba Word)");
}
process.exit(fallos === 0 ? 0 : 1);
