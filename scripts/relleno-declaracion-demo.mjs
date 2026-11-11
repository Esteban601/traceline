#!/usr/bin/env node
// =============================================================================
// Relleno de la declaración de cumplimiento de los tenants de demostración (decisión de Esteban del 10/11/2026,
// después del release v44 de staging; especificación §10). La migración 20261110120000 dejó los reportes es_demo en
// «sin_reserva» y escribió la oración solo donde el Perfil tenía denominación formal. En staging ningún tenant tiene
// Perfil, así que los 21 quedaron sin texto. Este script lo completa en dos pasos, que corre Esteban:
//
//   1. --paso denominacion: la denominación formal en el Perfil de cada tenant de demostración, desde el seed
//      (`denominacion_formal` de cada prospecto en scripts/crear-demo-prospecto.mjs; Empresa Demo, desde el PERFIL de
//      scripts/poblar-demo.mjs). Crea la fila de perfil_emisor si no existe; solo escribe un campo vacío y nunca
//      sobrescribe una denominación distinta (la reporta y se detiene).
//   2. --paso declaracion: la oración de la migración 20261110120000 en los reportes es_demo en «sin_reserva» sin
//      texto, cuyo Perfil ya tiene denominación formal. Nunca toca un texto escrito ni un tenant real.
//
// Sin --aplicar solo revisa: imprime, por tenant, qué haría. Con --aplicar escribe; una segunda pasada sin --aplicar
// debe dar 0 por escribir. O'Donnell queda fuera (pasó a cliente real; su prospecto está retirado en el seed).
//
//   (set -a; source .env.staging.local; set +a; node scripts/relleno-declaracion-demo.mjs --destino staging --paso denominacion)
//   (set -a; source .env.staging.local; set +a; node scripts/relleno-declaracion-demo.mjs --destino staging --paso denominacion --aplicar)
//   … y lo mismo con --paso declaracion.
//
// --aplicar del paso 1 se niega mientras algún prospecto tenga la denominación vacía en el seed: no corre hasta que
// Esteban dé las denominaciones. Ninguna llave ni URL de base se imprime.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const DESTINOS = { staging: "ewgnvjtjhvdltvkopptn", dev: "kmjkoxecxcujxixlxwlb" };
const TENANT_DEMO = "10000000-0000-0000-0000-000000000001";
const FORMA_POR_DEFECTO = "la Compañía"; // lib/suplemento/forma.ts y la migración 20261110120000
const AQUI = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
const salir = (m) => { console.error(`✗ ${m}`); process.exit(2); };
const destino = opcion("--destino");
const paso = opcion("--paso");
const aplicar = argv.includes("--aplicar");
if (!DESTINOS[destino] || !["denominacion", "declaracion"].includes(paso)) {
  salir("Uso: relleno-declaracion-demo.mjs --destino <staging|dev> --paso <denominacion|declaracion> [--aplicar]");
}
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!URL_SB.includes(DESTINOS[destino]) || Object.entries(DESTINOS).some(([k, r]) => k !== destino && URL_SB.includes(r))) {
  salir(`NEXT_PUBLIC_SUPABASE_URL no es la de ${destino}.`);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) salir("Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.");
const db = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** O'Donnell no se toca, por su prospecto retirado o por su nombre (en staging su tenant sigue como es_demo). */
const esOdonnell = (t) => /o.?donnell/i.test(`${t.slug ?? ""} ${t.nombre ?? ""}`);

/** Los prospectos del seed, leídos del texto (importarlo lo ejecutaría). El patrón se valida contra el conteo. */
function prospectosDelSeed() {
  const s = fs.readFileSync(path.join(AQUI, "crear-demo-prospecto.mjs"), "utf8");
  const ini = s.indexOf("const PROSPECTOS = [");
  const fin = s.indexOf("\n];\n", ini);
  if (ini === -1 || fin === -1) salir("No encuentro PROSPECTOS en crear-demo-prospecto.mjs.");
  const arr = s.slice(ini, fin);
  const re = /\n {4}slug: "([^"]+)",\n {4}nombre: "([^"]+)",\n {4}denominacion_formal: "([^"]*)",\n/g;
  const hallados = [...arr.matchAll(re)];
  const slugs = (arr.match(/\n {4}slug: "/g) ?? []).length;
  if (!hallados.length || hallados.length !== slugs) salir(`El seed tiene ${slugs} prospectos y ${hallados.length} con slug, nombre y denominacion_formal seguidos.`);
  return hallados.map((m, i) => {
    const bloque = arr.slice(m.index, hallados[i + 1]?.index ?? arr.length);
    return { slug: m[1], nombre: m[2], denominacion: m[3].trim(), retirado: /\n {4}retirado: "/.test(bloque) };
  });
}

/** La denominación de Empresa Demo: la del PERFIL de poblar-demo (ficticia). */
function denominacionDemo() {
  const s = fs.readFileSync(path.join(AQUI, "poblar-demo.mjs"), "utf8");
  const m = [...s.matchAll(/\n {2}denominacion_formal: "([^"]+)",\n/g)];
  if (m.length !== 1) salir(`poblar-demo.mjs tiene ${m.length} denominaciones en su PERFIL; se espera 1.`);
  return m[0][1];
}

/** La oración de la declaración: la misma de la migración 20261110120000. */
const oracion = (denominacion, forma, ejercicio) =>
  `${denominacion} (en adelante, ${forma}) presenta la información a revelar relacionada con la sostenibilidad y con el clima correspondiente al ejercicio ${ejercicio}, preparada de conformidad con las Normas NIIF S1 y NIIF S2 emitidas por el Consejo de Normas Internacionales de Sostenibilidad.`;

const { data: tenants, error: eT } = await db.from("tenants").select("id, slug, nombre, es_demo");
if (eT) salir(`leer tenants: ${eT.message}`);
const { data: perfiles, error: eP } = await db.from("perfil_emisor").select("tenant_id, denominacion_formal, forma_de_referencia");
if (eP) salir(`leer perfil_emisor: ${eP.message}`);
const perfilDe = new Map(perfiles.map((p) => [p.tenant_id, p]));
const vacio = (v) => !(v ?? "").trim();

console.log(`Destino: ${destino} · paso ${paso} · ${aplicar ? "APLICAR" : "revisar (no escribe)"}`);
console.log(`Tenants: ${tenants.length} (${tenants.filter((t) => t.es_demo).length} es_demo) · perfiles: ${perfiles.length}`);
let altos = 0;
const alto = (m) => { altos++; console.log(`  ✗ ${m}`); };

if (paso === "denominacion") {
  // Objetivos: los prospectos no retirados del seed y Empresa Demo.
  const objetivos = [];
  for (const p of prospectosDelSeed()) {
    if (p.retirado || esOdonnell(p)) { console.log(`  · ${p.nombre}: fuera (prospecto retirado; O'Donnell es cliente real)`); continue; }
    const t = tenants.find((x) => x.slug === p.slug);
    if (!t) { if (destino === "staging") alto(`${p.nombre}: sin tenant con slug «${p.slug}»`); else console.log(`  · ${p.nombre}: sin tenant en ${destino}`); continue; }
    objetivos.push({ t, denominacion: p.denominacion });
  }
  const demo = tenants.find((x) => x.id === TENANT_DEMO);
  if (demo) objetivos.push({ t: demo, denominacion: denominacionDemo() });
  else alto("Empresa Demo: sin tenant");

  const porEscribir = [];
  let sinDato = 0, yaEstan = 0;
  for (const { t, denominacion } of objetivos) {
    if (!t.es_demo || esOdonnell(t)) { alto(`${t.nombre}: no es un tenant de demostración (o es O'Donnell); no se toca`); continue; }
    const pf = perfilDe.get(t.id);
    if (!denominacion) { sinDato++; console.log(`  … ${t.nombre}: sin denominación en el seed (la da Esteban)`); continue; }
    if (pf && !vacio(pf.denominacion_formal)) {
      if (pf.denominacion_formal.trim() === denominacion) { yaEstan++; console.log(`  ✓ ${t.nombre}: ya tiene «${denominacion}»`); }
      else alto(`${t.nombre}: el Perfil ya tiene «${pf.denominacion_formal.trim()}», distinta de la del seed «${denominacion}»; no se sobrescribe`);
      continue;
    }
    porEscribir.push({ t, denominacion, crea: !pf });
    console.log(`  → ${t.nombre}: ${pf ? "Perfil sin denominación" : "sin Perfil (se crea la fila)"} → «${denominacion}»`);
  }
  console.log(`Por escribir: ${porEscribir.length} · ya están: ${yaEstan} · sin denominación en el seed: ${sinDato} · altos: ${altos}`);
  if (aplicar) {
    if (altos) salir("Hay altos: no se escribe nada.");
    if (sinDato) salir(`${sinDato} prospectos sin denominación en el seed: no se escribe nada hasta tenerlas todas.`);
    for (const { t, denominacion, crea } of porEscribir) {
      const q = crea
        ? db.from("perfil_emisor").insert({ tenant_id: t.id, denominacion_formal: denominacion }).select("tenant_id")
        : db.from("perfil_emisor").update({ denominacion_formal: denominacion }).eq("tenant_id", t.id).or("denominacion_formal.is.null,denominacion_formal.eq.").select("tenant_id");
      const { data, error } = await q;
      if (error || data?.length !== 1) salir(`${t.nombre}: ${error?.message ?? `${data?.length ?? 0} filas escritas`}. Lo anterior quedó escrito; corre de nuevo sin --aplicar.`);
      console.log(`  ✓ ${t.nombre}: escrito`);
    }
    console.log(`✓ ${porEscribir.length} denominaciones escritas. Segunda pasada sin --aplicar: «Por escribir: 0».`);
  }
}

if (paso === "declaracion") {
  const { data: reportes, error: eR } = await db.from("reportes").select("id, tenant_id, ejercicio, declaracion_cumplimiento, declaracion_cumplimiento_texto");
  if (eR) salir(`leer reportes: ${eR.message}`);
  const porEscribir = [];
  let conTexto = 0, sinDenominacion = 0, fuera = 0;
  for (const r of reportes) {
    const t = tenants.find((x) => x.id === r.tenant_id);
    if (!t?.es_demo || esOdonnell(t)) { fuera++; continue; }
    if (r.declaracion_cumplimiento !== "sin_reserva") { alto(`${t.nombre} ${r.ejercicio}: declaración «${r.declaracion_cumplimiento ?? "∅"}», no «sin_reserva»; no se toca`); continue; }
    if (r.declaracion_cumplimiento_texto !== null) { conTexto++; console.log(`  ✓ ${t.nombre} ${r.ejercicio}: ya tiene texto`); continue; }
    const pf = perfilDe.get(t.id);
    if (vacio(pf?.denominacion_formal)) { sinDenominacion++; console.log(`  … ${t.nombre} ${r.ejercicio}: sin denominación en el Perfil (paso 1)`); continue; }
    const texto = oracion(pf.denominacion_formal.trim(), vacio(pf.forma_de_referencia) ? FORMA_POR_DEFECTO : pf.forma_de_referencia.trim(), r.ejercicio);
    porEscribir.push({ r, t, texto });
    console.log(`  → ${t.nombre} ${r.ejercicio}: «${texto.slice(0, 90)}…»`);
  }
  console.log(`Por escribir: ${porEscribir.length} · ya con texto: ${conTexto} · sin denominación: ${sinDenominacion} · fuera (reales y O'Donnell): ${fuera} · altos: ${altos}`);
  if (aplicar) {
    if (altos) salir("Hay altos: no se escribe nada.");
    for (const { r, t, texto } of porEscribir) {
      const { data, error } = await db.from("reportes").update({ declaracion_cumplimiento_texto: texto })
        .eq("id", r.id).eq("declaracion_cumplimiento", "sin_reserva").is("declaracion_cumplimiento_texto", null).select("id");
      if (error || data?.length !== 1) salir(`${t.nombre} ${r.ejercicio}: ${error?.message ?? `${data?.length ?? 0} filas escritas`}. Lo anterior quedó escrito; corre de nuevo sin --aplicar.`);
      console.log(`  ✓ ${t.nombre} ${r.ejercicio}: escrito`);
    }
    console.log(`✓ ${porEscribir.length} declaraciones escritas. Segunda pasada sin --aplicar: «Por escribir: 0».`);
  }
}

if (!aplicar && altos) { console.log(`✗ ${altos} alto(s): revísalos antes de --aplicar.`); process.exit(1); }
