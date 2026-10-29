#!/usr/bin/env node
// =============================================================================
// COMPROBACIONES DE v42 DESPUÉS DEL RELEASE (runbook docs/encargos/2026-10-28-
// runbook-v42.md, paso 6). SOLO LECTURA: no migra, no sube, no genera, no llama
// al modelo. Se probó contra dev.
//
//   staging (Esteban o, con su OK, Claude Code):
//     (set -a; source .env.staging.local; set +a; \
//      node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/despliegue/comprobar-v42.mjs --destino staging --antes ~/Downloads/v42/foto-antes.json \
//        --despues ~/Downloads/v42/foto-despues.json --credenciales .credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json)
//   dev (prueba):
//     node --env-file=<.env.local de dev> --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//       scripts/despliegue/comprobar-v42.mjs --destino dev --antes <foto-antes.json> --despues <foto-despues.json>
//
// Comprueba:
//   1. /login de la app del destino: 200.
//   2. Emisoras: staging, 22; dev, las de la foto «antes» (el conteo del día).
//   3. Foto «después» (la toma con foto-cobertura.mjs y la escribe en --despues) contra la «antes» y el esperado
//      del destino: staging, esperado-cobertura-v42.json (los 5 códigos nuevos); dev, ninguna diferencia (las
//      cuatro migraciones ya están aplicadas en dev).
//   4. La plantilla del Formato en Storage: sha256 2179124…bad46 (descarga con la sesión de staff).
//   5. El Formato de Empresa Demo: staging, 409 (sin documento aprobado, como en v41); dev, 200 (demo v5 aprobado).
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

const DESTINOS = {
  staging: {
    ref: "ewgnvjtjhvdltvkopptn",
    app: "https://traceline-staging-70ce5b369e7c.herokuapp.com",
    emisoras: 22,
    esperado: "esperado-cobertura-v42.json",
    formatoDemo: 409,
  },
  dev: {
    ref: "kmjkoxecxcujxixlxwlb",
    app: "https://traceline-dev-d4fd7a3cda04.herokuapp.com",
    emisoras: "foto-antes",
    esperado: null,
    formatoDemo: 200,
  },
};
const SHA_PLANTILLA = "217912465e5c0d2141604250f3946f147c6cc0953a4b10df3a8cbeecec9bad46";
const REPORTE_DEMO = "20000000-0000-0000-0000-000000000001";
const AQUI = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
const destino = opcion("--destino");
const fotoAntes = opcion("--antes");
const fotoDespues = opcion("--despues");
const credArch = opcion("--credenciales");
const salir = (m) => { console.error(`✗ ${m}`); process.exit(2); };
const cfg = DESTINOS[destino];
if (!cfg || !fotoAntes || !fotoDespues) salir("Uso: comprobar-v42.mjs --destino <staging|dev> --antes <foto-antes.json> --despues <foto-despues.json> [--credenciales <archivo>]");
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
const esperadoArch = cfg.esperado ? path.join(AQUI, cfg.esperado) : path.join(path.dirname(fotoDespues), "esperado-vacio.json");
if (!cfg.esperado) fs.writeFileSync(esperadoArch, "[]\n");
if (foto.status === 0) {
  const cmp = spawnSync(process.execPath, [...nodo, "--comparar", fotoAntes, fotoDespues, "--esperado", esperadoArch], { encoding: "utf8", env: process.env });
  console.log((cmp.stdout || "").trim().split("\n").map((l) => `    ${l}`).join("\n"));
  ok(cmp.status === 0, `diferencia igual a la esperada (${cfg.esperado ?? "ninguna: dev ya tiene las cuatro migraciones"})`);
}

console.log("\n4. Plantilla del Formato en Storage");
const { data: blob, error: eP } = await db.storage.from("documentos").download(RUTA_PLANTILLA_FORMATO);
if (eP || !blob) ok(false, `documentos/${RUTA_PLANTILLA_FORMATO}: no se pudo descargar (${eP?.message ?? "sin contenido"})`);
else {
  const b = Buffer.from(await blob.arrayBuffer());
  ok(sha(b) === SHA_PLANTILLA, `${b.length} bytes · sha256 ${sha(b).slice(0, 12)}… (se espera ${SHA_PLANTILLA.slice(0, 12)}…)`);
}

console.log("\n5. Formato electrónico de Empresa Demo");
const r = await fetch(`${cfg.app}/admin/cobertura/export-formato?reporte=${REPORTE_DEMO}`, { headers: { cookie: cookie() }, redirect: "manual" });
const cuerpo = r.status === 200 ? `${(await r.arrayBuffer()).byteLength} bytes` : (await r.text()).slice(0, 160).replace(/\s+/g, " ");
ok(r.status === cfg.formatoDemo, `${r.status} (se espera ${cfg.formatoDemo}) · ${cuerpo}`);

console.log(fallas.length ? `\n✗ ${fallas.length} comprobación(es) en rojo.` : "\n✓ v42 comprobado.");
process.exit(fallas.length ? 1 : 0);
