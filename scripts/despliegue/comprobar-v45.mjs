#!/usr/bin/env node
// =============================================================================
// COMPROBACIONES DE v45 DESPUÉS DEL RELEASE (runbook docs/encargos/2026-11-10-
// runbook-v45.md, paso 5). SOLO LECTURA: no migra, no sube, no genera, no llama
// al modelo. Se probó contra dev. Copia de comprobar-v44.mjs con lo de v45
// (encargo catalogo-gri-sasb).
//
//   staging (Esteban o, con su OK, Claude Code):
//     (set -a; source .env.staging.local; set +a; \
//      node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/despliegue/comprobar-v45.mjs --destino staging --antes ~/Downloads/v45/foto-antes.json \
//        --despues ~/Downloads/v45/foto-despues.json --credenciales .credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json)
//   dev (prueba; dev ya tiene el catálogo, así que su esperado es vacío):
//     node --env-file=<.env.local de dev> --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//       scripts/despliegue/comprobar-v45.mjs --destino dev --antes <foto-antes.json> --despues <foto-despues.json>
//
// Comprueba:
//   1. /login de la app del destino: 200.
//   2. Emisoras: staging, 22; dev, las de la foto «antes».
//   3. Foto «después» contra la «antes» con esperado-cobertura-v45.json (staging): 51 códigos nuevos sin solicitud en
//      todas las emisoras (GRI 2: 30, GRI 3: 3, FN-CB: 17, GRI 401-1), la fila compuesta «GRI 2-7 / 401-1» cambia (se
//      retira) y NIIF sin cambio (totales iguales emisora por emisora). En dev, ninguna diferencia.
//   4. La plantilla del Formato en Storage: sha256 2179124…bad46 (v45 no la cambia).
//   5. El Formato de Empresa Demo: staging, 409 (sin documento aprobado); dev, 200 con la hoja «Métricas SASB»
//      (Código / Métrica / Respuesta y las 17 FN-CB si el Perfil tiene FN-CB). Excel de taxonomía: 200.
//   6. El catálogo desde la app: activos por estándar (GRI 37, de ellos GRI 2: 30 y GRI 3: 3; SASB FN-CB: 17; NIIF
//      117) y «GRI 2-7 / 401-1» con activo = false.
//   7. Libro GRI/SASB de Empresa Demo (/admin/cobertura/export-gri-sasb): 200, hoja «GRI» con 37 contenidos y, si el
//      Perfil tiene FN-CB, hoja «SASB FN-CB» con 17.
// La sesión de staff: en staging, el analista del seed con la contraseña del archivo de credenciales (no se
// imprime); en dev, sesion-dev.mjs, sin contraseña. Ninguna llave ni URL de base se imprime.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createServerClient } from "@supabase/ssr";
import { RUTA_PLANTILLA_FORMATO } from "../../lib/formato/plantilla.ts";
import { sesionStaffDev } from "../formato/sesion-dev.mjs";
import ExcelJS from "exceljs";

const DESTINOS = {
  staging: {
    ref: "ewgnvjtjhvdltvkopptn",
    app: "https://traceline-staging-70ce5b369e7c.herokuapp.com",
    emisoras: 22,
    esperado: "esperado-cobertura-v45.json",
    formatoDemo: 409,
  },
  dev: {
    ref: "kmjkoxecxcujxixlxwlb",
    app: "https://traceline-dev-d4fd7a3cda04.herokuapp.com",
    emisoras: "foto-antes",
    esperado: "esperado-cobertura-v45-dev.json",
    formatoDemo: 200,
  },
};
const SHA_PLANTILLA = "217912465e5c0d2141604250f3946f147c6cc0953a4b10df3a8cbeecec9bad46";
const REPORTE_DEMO = "20000000-0000-0000-0000-000000000001";
const TENANT_DEMO = "10000000-0000-0000-0000-000000000001";
const AQUI = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
const destino = opcion("--destino");
const fotoAntes = opcion("--antes");
const fotoDespues = opcion("--despues");
const credArch = opcion("--credenciales");
const salir = (m) => { console.error(`✗ ${m}`); process.exit(2); };
const cfg = DESTINOS[destino];
if (!cfg || !fotoAntes || !fotoDespues) salir("Uso: comprobar-v45.mjs --destino <staging|dev> --antes <foto-antes.json> --despues <foto-despues.json> [--credenciales <archivo>]");
if (destino === "staging" && !credArch) salir("En staging hace falta --credenciales (contraseña del analista del seed).");
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!URL_SB.includes(cfg.ref) || Object.values(DESTINOS).some((d) => d !== cfg && URL_SB.includes(d.ref))) salir(`NEXT_PUBLIC_SUPABASE_URL no es la de ${destino}.`);
if (!fs.existsSync(fotoAntes)) salir(`No existe la foto «antes»: ${fotoAntes}`);
if (fs.existsSync(fotoDespues)) salir(`La foto «después» ya existe; no se sobrescribe: ${fotoDespues}`);

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/** Sesión de staff: el analista del seed en staging; sesion-dev.mjs en dev. */
async function sesionStaff() {
  if (destino === "dev") return sesionStaffDev();
  const password = JSON.parse(fs.readFileSync(credArch, "utf8"))["analista@irstrat.example"]?.password;
  if (!password) salir(`${credArch} no trae la contraseña del analista.`);
  const jar = new Map();
  const db = createServerClient(URL_SB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) },
  });
  const { error } = await db.auth.signInWithPassword({ email: "analista@irstrat.example", password });
  if (error) salir("No se pudo abrir la sesión del analista.");
  return { db, cookie: () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ") };
}

console.log(`Destino: ${destino} · app ${cfg.app}`);
const { db, cookie } = await sesionStaff();

console.log("\n1. Aplicación");
const login = await fetch(`${cfg.app}/login`, { redirect: "manual" });
ok(login.status === 200, `/login: ${login.status}`);

console.log("\n2. Emisoras");
const antes = JSON.parse(fs.readFileSync(fotoAntes, "utf8"));
const enAntes = Object.keys(antes.emisoras ?? {}).length;
const { data: tenants, error: eT } = await db.from("tenants").select("id");
if (eT) salir(`leer tenants: ${eT.message}`);
const esperadas = cfg.emisoras === "foto-antes" ? enAntes : cfg.emisoras;
ok(tenants.length === esperadas, `${tenants.length} emisoras en la base; se esperan ${esperadas}${cfg.emisoras === "foto-antes" ? " (las de la foto «antes»)" : ""}`);
ok(enAntes === esperadas, `foto «antes» con ${enAntes} emisoras`);

console.log("\n3. Cobertura: foto «después» contra la «antes» y el esperado");
const nodo = ["--experimental-strip-types", "--import", path.join(AQUI, "../captura-sugerida/node/registrar.mjs"), path.join(AQUI, "foto-cobertura.mjs")];
const foto = spawnSync(process.execPath, [...nodo, "--destino", destino, "--salida", fotoDespues], { encoding: "utf8", env: process.env });
console.log((foto.stdout || "").trim().split("\n").map((l) => `    ${l}`).join("\n"));
ok(foto.status === 0, `foto «después» tomada (${fotoDespues})`);
const esperadoArch = path.join(AQUI, cfg.esperado);
if (foto.status === 0) {
  const cmp = spawnSync(process.execPath, [...nodo, "--comparar", fotoAntes, fotoDespues, "--esperado", esperadoArch], { encoding: "utf8", env: process.env });
  console.log((cmp.stdout || "").trim().split("\n").map((l) => `    ${l}`).join("\n"));
  ok(cmp.status === 0, `diferencia igual a la esperada (${cfg.esperado})`);
}

console.log("\n4. Plantilla del Formato en Storage");
const { data: blob, error: eP } = await db.storage.from("documentos").download(RUTA_PLANTILLA_FORMATO);
if (eP || !blob) ok(false, `documentos/${RUTA_PLANTILLA_FORMATO}: no se pudo descargar (${eP?.message ?? "sin contenido"})`);
else {
  const b = Buffer.from(await blob.arrayBuffer());
  ok(sha(b) === SHA_PLANTILLA, `${b.length} bytes · sha256 ${sha(b).slice(0, 12)}… (se espera ${SHA_PLANTILLA.slice(0, 12)}…)`);
}

const { data: perfilDemo } = await db.from("perfil_emisor").select("sector_sasb").eq("tenant_id", TENANT_DEMO).maybeSingle();
const conFncb = (perfilDemo?.sector_sasb ?? []).some((x) => /\(FN-CB\)/.test(x));
const txt = (v) => (v == null ? "" : typeof v === "object" ? (v.richText ? v.richText.map((r) => r.text).join("") : String(v.text ?? v.result ?? "")) : String(v));
const libro = async (buf) => { const w = new ExcelJS.Workbook(); await w.xlsx.load(buf); return w; };

console.log("\n5. Formato electrónico y Excel de taxonomía de Empresa Demo");
const r = await fetch(`${cfg.app}/admin/cobertura/export-formato?reporte=${REPORTE_DEMO}`, { headers: { cookie: cookie() }, redirect: "manual" });
if (r.status === 200) {
  const w = await libro(Buffer.from(await r.arrayBuffer()));
  const m = w.getWorksheet("Métricas SASB");
  let n = 0;
  m?.eachRow((x) => { if (/^FN-CB-/.test(txt(x.getCell(1).value))) n++; });
  const enc = m ? [1, 2, 3].map((c) => txt(m.getRow(2).getCell(c).value)).join(" / ") : "";
  ok(r.status === cfg.formatoDemo, `${r.status} (se espera ${cfg.formatoDemo})`);
  ok(!!m && enc === "Código / Métrica / Respuesta" && n === (conFncb ? 17 : 0), `hoja «Métricas SASB»: ${m ? `«${enc}», ${n} métricas FN-CB` : "no está"} (se esperan ${conFncb ? 17 : 0})`);
} else {
  const cuerpo = (await r.text()).slice(0, 160).replace(/\s+/g, " ");
  ok(r.status === cfg.formatoDemo, `${r.status} (se espera ${cfg.formatoDemo}) · ${cuerpo}`);
}

const x = await fetch(`${cfg.app}/admin/cobertura/export-taxonomia?reporte=${REPORTE_DEMO}`, { headers: { cookie: cookie() }, redirect: "manual" });
const xCuerpo = x.status === 200 ? `${(await x.arrayBuffer()).byteLength} bytes` : (await x.text()).slice(0, 160).replace(/\s+/g, " ");
ok(x.status === 200, `Excel de taxonomía de Empresa Demo: ${x.status} · ${xCuerpo}`);

console.log("\n6. Catálogo desde la app");
const { data: cat, error: eC } = await db.from("datapoints_taxonomia").select("codigo, marco, estandar, activo");
if (eC) salir(`leer el catálogo: ${eC.message}`);
const activos = cat.filter((c) => c.activo);
const de = (f) => activos.filter(f).length;
const gri = de((c) => c.marco === "GRI"), gri2 = de((c) => c.marco === "GRI" && /^GRI 2-\d+$/.test(c.codigo)), gri3 = de((c) => c.marco === "GRI" && /^GRI 3-\d+$/.test(c.codigo));
const fncb = de((c) => c.marco === "SASB" && /^FN-CB-/.test(c.codigo)), niif = de((c) => c.marco === "NIIF");
ok(gri === 37 && gri2 === 30 && gri3 === 3, `GRI activos: ${gri} (GRI 2: ${gri2}, GRI 3: ${gri3}); se esperan 37 (30 y 3)`);
ok(fncb === 17, `SASB FN-CB activos: ${fncb}; se esperan 17`);
ok(niif === 117, `NIIF activos: ${niif}; se esperan 117 (sin cambio)`);
const compuesta = cat.find((c) => c.codigo === "GRI 2-7 / 401-1");
ok(!!compuesta && compuesta.activo === false, `«GRI 2-7 / 401-1»: ${compuesta ? `activo = ${compuesta.activo}` : "no está"} (se espera retirada)`);

console.log("\n7. Libro GRI/SASB de Empresa Demo");
const g = await fetch(`${cfg.app}/admin/cobertura/export-gri-sasb?reporte=${REPORTE_DEMO}`, { headers: { cookie: cookie() }, redirect: "manual" });
if (g.status !== 200) ok(false, `export-gri-sasb: ${g.status} · ${(await g.text()).slice(0, 160).replace(/\s+/g, " ")}`);
else {
  const w = await libro(Buffer.from(await g.arrayBuffer()));
  const filas = (h) => { let n = 0; w.getWorksheet(h)?.eachRow((x, i) => { if (i > 1 && txt(x.getCell(1).value)) n++; }); return w.getWorksheet(h) ? n : null; };
  ok(filas("GRI") === 37, `hoja «GRI»: ${filas("GRI") ?? "no está"} contenidos (se esperan 37)`);
  ok(conFncb ? filas("SASB FN-CB") === 17 : filas("SASB FN-CB") === null, `hoja «SASB FN-CB»: ${filas("SASB FN-CB") ?? "no está"} (se espera ${conFncb ? 17 : "ninguna: el Perfil no tiene FN-CB"})`);
}

console.log(fallas.length ? `\n✗ ${fallas.length} comprobación(es) en rojo.` : "\n✓ v45 comprobado.");
process.exit(fallas.length ? 1 : 0);
