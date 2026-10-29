#!/usr/bin/env node
// =============================================================================
// Prepara la PLANTILLA del Formato electrónico NIIF S1/S2 desde el formato de
// referencia (encargo 2026-10-13-excel-respuestas-narrativas, Paso 4).
//
//   node --env-file=.env.local --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/formato/preparar-plantilla.mjs <formato.xlsx> <salida.xlsx> [--subir]
//
// A NIVEL ZIP/XML (revisión externa, punto 1): el formato trae 23 imágenes en
// celda (xl/richData, xl/metadata.xml) que una librería que reescribe el libro
// pierde. Aquí solo se edita el XML de lo que se limpia; lo demás se copia.
//
// El formato de referencia es el de una emisora real con sus respuestas: no se
// versiona (CLAUDE.md §4) y sus respuestas no salen de él. La plantilla:
//   · «Estructura Formato Electronico»: la columna K vacía desde la fila 4;
//   · «Tabla NIIF»: sin datos desde la fila 3;
//   · la hoja de métricas SASB de la industria de la referencia queda vacía,
//     renombrada «Métricas SASB», solo con su título (sin nota interna: revisión externa v5, Fase 5);
//   · sin la ruta de OneDrive (x15ac:absPath) ni nombres en las propiedades;
//   · las cadenas compartidas que ya nadie usa, vacías (el texto de las
//     respuestas no queda en el archivo).
// Comprueba: 0 menciones de la emisora en todo el zip y las 23 imágenes
// enlazadas. La plantilla vive en Storage (bucket `documentos`,
// RUTA_PLANTILLA_FORMATO). Con --subir la sube a dev (solo dev).
// =============================================================================
import fs from "node:fs";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { celdasDeColumna, indicesCompartidos, ponerTexto, vaciarCelda, vaciarCompartidosSinUso, validarImagenesEnCelda } from "../../lib/formato/xlsx-xml.ts";
import { RUTA_PLANTILLA_FORMATO } from "../../lib/formato/plantilla.ts";

const args = process.argv.slice(2);
const subir = args.includes("--subir");
const [entrada, salida] = args.filter((a) => !a.startsWith("--"));
if (!entrada || !salida) { console.error("Uso: preparar-plantilla.mjs <formato.xlsx> <salida.xlsx> [--subir]"); process.exit(2); }

const zip = await JSZip.loadAsync(fs.readFileSync(entrada));
const leer = (n) => zip.file(n).async("string");
const wbXml = await leer("xl/workbook.xml");
const rels = await leer("xl/_rels/workbook.xml.rels");
const hojaDe = (nombre) => {
  const rid = wbXml.match(new RegExp(`<sheet name="${nombre}"[^>]*r:id="(rId\\d+)"`))?.[1];
  const destino = rid && rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1];
  if (!destino) throw new Error(`no encuentro la hoja «${nombre}»`);
  return `xl/${destino.replace(/^\/?xl\//, "")}`;
};
const nombreSasb = wbXml.match(/<sheet name="(Métricas SASB[^"]*)"/)?.[1];
const RUTAS = { estructura: hojaDe("Estructura Formato Electronico"), tabla: hojaDe("Tabla NIIF"), sasb: nombreSasb ? hojaDe(nombreSasb) : null };

// 1. Estructura: columna K vacía desde la fila 4.
let est = await leer(RUTAS.estructura);
const ks = celdasDeColumna(est, "K", 4);
for (const ref of ks) est = vaciarCelda(est, ref);
zip.file(RUTAS.estructura, est);

// 2. Tabla NIIF: sin datos desde la fila 3.
let tabla = await leer(RUTAS.tabla);
let celdasTabla = 0;
for (const m of [...tabla.matchAll(/<c r="([A-Z]+(\d+))"/g)]) if (Number(m[2]) >= 3) { tabla = vaciarCelda(tabla, m[1]); celdasTabla++; }
zip.file(RUTAS.tabla, tabla);

// 3. Métricas SASB: vacía, sin celdas combinadas, solo con su título.
let wb2 = wbXml;
if (RUTAS.sasb) {
  let sasb = await leer(RUTAS.sasb);
  for (const m of [...sasb.matchAll(/<c r="([A-Z]+\d+)"/g)]) sasb = vaciarCelda(sasb, m[1]);
  sasb = sasb.replace(/<mergeCells[\s\S]*?<\/mergeCells>/, "");
  sasb = ponerTexto(sasb, "A1", "Métricas por industria (SASB)");
  zip.file(RUTAS.sasb, sasb);
  wb2 = wb2.replace(`<sheet name="${nombreSasb}"`, '<sheet name="Métricas SASB"');
  const app = await leer("docProps/app.xml");
  zip.file("docProps/app.xml", app.split(nombreSasb).join("Métricas SASB"));
}

// 4. Sin la ruta de OneDrive de quien la editó.
wb2 = wb2.replace(/<mc:AlternateContent[^>]*>\s*<mc:Choice[^>]*>\s*<x15ac:absPath[^>]*\/>\s*<\/mc:Choice>\s*<\/mc:AlternateContent>/, "");
zip.file("xl/workbook.xml", wb2);

// 5. Propiedades sin nombres de personas ni títulos de la referencia.
const core = await leer("docProps/core.xml");
zip.file("docProps/core.xml", core.replace(/<(dc:creator|cp:lastModifiedBy|dc:title|dc:subject|dc:description)>[^<]*<\/\1>/g, (_m, t) => `<${t}>${t === "dc:creator" || t === "cp:lastModifiedBy" ? "IRStrat" : ""}</${t}>`));
const comentarios = zip.file("xl/comments1.xml");
if (comentarios) zip.file("xl/comments1.xml", (await comentarios.async("string")).replace(/<author>[^<]*<\/author>/g, "<author>IRStrat</author>"));

// 6. Cadenas compartidas sin uso: vacías.
const hojas = {};
for (const n of Object.keys(zip.files).filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x))) hojas[n] = await leer(n);
const usados = new Set(Object.values(hojas).flatMap(indicesCompartidos));
const sst = vaciarCompartidosSinUso(await leer("xl/sharedStrings.xml"), usados);
zip.file("xl/sharedStrings.xml", sst.xml);

// Comprobaciones.
let menciones = 0;
for (const n of Object.keys(zip.files).filter((x) => /\.(xml|vml|rels)$/.test(x))) menciones += ((await leer(n)).match(/autl[aá]n/gi) ?? []).length;
const imagenes = validarImagenesEnCelda(hojas, Object.keys(zip.files), 23);
if (menciones || imagenes.length) {
  console.error(`✗ menciones de la emisora: ${menciones} · imágenes: ${imagenes.join("; ") || "ok"}`);
  process.exit(1);
}
const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
fs.writeFileSync(salida, buf);
const huella = createHash("sha256").update(buf).digest("hex");
console.log(`plantilla: K vaciadas ${ks.length} · celdas de «Tabla NIIF» vaciadas ${celdasTabla} · hoja SASB ${nombreSasb ? "vaciada y renombrada" : "no estaba"} · cadenas sin uso vaciadas ${sst.vaciados} · menciones 0 · imágenes en celda 23 enlazadas · sha256 ${huella.slice(0, 12)}`);

if (subir) {
  const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!URL_SB.includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ --subir solo contra el proyecto dev."); process.exit(2); }
  const db = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error } = await db.storage.from("documentos").upload(RUTA_PLANTILLA_FORMATO, buf, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: true });
  if (error) { console.error(`✗ subir: ${error.message}`); process.exit(1); }
  console.log(`subida a documentos/${RUTA_PLANTILLA_FORMATO} (dev)`);
}
