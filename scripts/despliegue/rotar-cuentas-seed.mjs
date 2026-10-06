#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Rota las contraseñas de las cuentas del seed que siguen entrando con la
// contraseña VERSIONADA del seed (hallazgo del ensayo del 30/09/2026, encargo
// rol auditor §7). Lo ejecuta una persona contra staging; Claude Code solo lo
// corre contra ensayo.
//
//   node scripts/despliegue/rotar-cuentas-seed.mjs --destino <ensayo|staging>             revisar
//   node scripts/despliegue/rotar-cuentas-seed.mjs --destino <ensayo|staging> --aplicar   rotar
//
// Lee NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y
// SUPABASE_SERVICE_ROLE_KEY SOLO del entorno (no abre ningún .env: el destino lo
// fija quien lo ejecuta, en un subshell), y exige que la URL sea la del destino.
//
// Sin --aplicar solo prueba, cuenta por cuenta, si la contraseña del seed entra.
// Con --aplicar, a cada cuenta expuesta:
//   1. le pone una contraseña aleatoria nueva (admin API);
//   2. le cierra TODAS las sesiones abiertas (admin signOut global, con el token
//      de la entrada de prueba), para que nadie siga dentro con la vieja;
//   3. comprueba que la vieja ya no entra y que la nueva sí.
// Las contraseñas nuevas se guardan en .credenciales-demo/seed-<ref>.json (modo
// 600, ignorado por git; se comprueba antes de escribir). No se imprimen.
// -----------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const REFS = { staging: "ewgnvjtjhvdltvkopptn", ensayo: "sqpxcxewoznhpwvhxamy" };
const PASSWORD_SEED = "Demo2025!";
// Las cuentas de supabase/seed.sql. Las que no existan en el destino se saltan.
const CUENTAS_SEED = [
  "coordinador@empresademo.example",
  "rh@empresademo.example",
  "operaciones@empresademo.example",
  "finanzas@empresademo.example",
  "admin.cliente@empresademo.example",
  "jefe.rh@empresademo.example",
  "auditor.externo@despacho.example",
  "analista@irstrat.example",
  "admin@irstrat.example",
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const destino = args[args.indexOf("--destino") + 1];
const aplicar = args.includes("--aplicar");
const salir = (m) => { console.error(`✗ ${m}`); process.exit(2); };

if (!args.includes("--destino") || !REFS[destino]) salir("Uso: --destino <ensayo|staging> [--aplicar]");
const REF = REFS[destino];
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB.includes(REF)) salir(`NEXT_PUBLIC_SUPABASE_URL no es la de ${destino} (${REF}).`);
for (const [otro, ref] of Object.entries(REFS)) {
  if (otro !== destino && URL_SB.includes(ref)) salir(`La URL contiene el ref de ${otro}.`);
}
if (!ANON || !SERVICE) salir("Faltan NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en el entorno.");

const ARCHIVO = path.join(RAIZ, ".credenciales-demo", `seed-${REF}.json`);
if (aplicar) {
  const r = spawnSync("git", ["check-ignore", "-q", ARCHIVO], { cwd: RAIZ });
  if (r.status !== 0) salir(`${path.relative(RAIZ, ARCHIVO)} NO está ignorado por git; no se escribe nada.`);
}

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient(URL_SB, SERVICE, opciones);

/** Intenta entrar; devuelve el token si entra, null si no. */
async function entra(email, password) {
  const c = createClient(URL_SB, ANON, opciones);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  return error ? null : { c, token: data.session.access_token };
}

const { data: lista, error: errLista } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (errLista) salir(`listUsers: ${errLista.message}`);
const porEmail = new Map(lista.users.map((u) => [u.email, u]));

console.log(`Destino: ${destino} (${REF}) · modo: ${aplicar ? "APLICAR" : "revisar"}\n`);
const guardadas = fs.existsSync(ARCHIVO) ? JSON.parse(fs.readFileSync(ARCHIVO, "utf8")) : {};
let expuestas = 0;
let fallas = 0;

for (const email of CUENTAS_SEED) {
  const usuario = porEmail.get(email);
  if (!usuario) { console.log(`  · ${email.padEnd(36)} no existe en ${destino}`); continue; }
  const prueba = await entra(email, PASSWORD_SEED);
  if (!prueba) { console.log(`  ✓ ${email.padEnd(36)} la contraseña del seed NO entra`); continue; }
  expuestas++;
  if (!aplicar) {
    await prueba.c.auth.signOut({ scope: "local" });
    console.log(`  ✗ ${email.padEnd(36)} ENTRA con la contraseña del seed`);
    continue;
  }

  const nueva = crypto.randomBytes(18).toString("base64url");
  const { error: errUpd } = await svc.auth.admin.updateUserById(usuario.id, { password: nueva });
  if (errUpd) { console.log(`  ✗ ${email.padEnd(36)} no se pudo rotar — ${errUpd.message}`); fallas++; continue; }
  guardadas[email] = { password: nueva, rotada_en: new Date().toISOString() };
  fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true });
  fs.writeFileSync(ARCHIVO, JSON.stringify(guardadas, null, 2) + "\n", { mode: 0o600 });

  // El cambio de contraseña por admin ya revoca todas las sesiones del usuario
  // (medido en ensayo: 0 sesiones después), y entonces el signOut global
  // contesta «Auth session missing». Se intenta igual, por si otra versión de
  // GoTrue no revocara, y lo que se AFIRMA es el efecto: el refresh token de la
  // sesión abierta antes de rotar ya no sirve.
  await svc.auth.admin.signOut(prueba.token, "global");
  const { error: errRefresh } = await prueba.c.auth.refreshSession();
  const sesionesCerradas = !!errRefresh;
  const vieja = await entra(email, PASSWORD_SEED);
  const conNueva = await entra(email, nueva);
  if (conNueva) await conNueva.c.auth.signOut({ scope: "local" });
  const bien = !vieja && !!conNueva && sesionesCerradas;
  if (!bien) fallas++;
  console.log(
    `  ${bien ? "✓" : "✗"} ${email.padEnd(36)} rotada · la sesión previa ya no refresca: ${sesionesCerradas ? "sí" : "NO"}` +
      ` · la vieja entra: ${vieja ? "SÍ" : "no"} · la nueva entra: ${conNueva ? "sí" : "NO"}`
  );
}

console.log(
  `\n${expuestas} cuenta(s) expuesta(s)` +
    (aplicar ? `; contraseñas nuevas en ${path.relative(RAIZ, ARCHIVO)} (modo 600, no se imprimen).` : ".")
);
if (!aplicar && expuestas > 0) {
  console.log(`Para rotarlas: el mismo comando con --aplicar.`);
}
process.exit(fallas > 0 || (!aplicar && expuestas > 0) ? 1 : 0);
