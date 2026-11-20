#!/usr/bin/env node
// =============================================================================
// NOMBRE VISIBLE DEL MOCKUP RETIRADO: «<nombre> (demo)». Para los mockups cuyo alta de cliente real se hizo antes de
// que alta-cliente-real.mjs cambiara también el nombre (primer caso: O'Donnell en staging, alta del 10/11/2026, cuyo
// mockup «odonnell-demo» seguía llamándose «O'Donnell», igual que el real; cierre de v48).
//
//   node --env-file=.env.staging.local scripts/alta/nombre-mockup-demo.mjs --destino staging \
//        --credenciales .credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json --slug odonnell-demo [--aplicar]
//   local: node --env-file=<entorno local> scripts/alta/nombre-mockup-demo.mjs --destino local --slug <slug> [--aplicar]
//
// Solo toca `tenants.nombre` del tenant con ese slug, y solo si es de demostración, está inactivo y hay un cliente
// real (es_demo = false) con el mismo nombre sin «(demo)». Sin --aplicar revisa e imprime; con --aplicar pide el ref.
// Una fila «tenant_renombrado» en la bitácora. Idempotente. Sesión del staff del seed (RLS), como el alta. No imprime
// contraseñas, llaves ni URL de base.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { createRequire } from "node:module";

const { createClient } = createRequire(path.join(process.cwd(), "package.json"))("@supabase/supabase-js");
const DESTINOS = {
  staging: { ref: "ewgnvjtjhvdltvkopptn", prueba: (u) => u.includes("ewgnvjtjhvdltvkopptn") },
  local: { ref: "local", prueba: (u) => /^http:\/\/(127\.0\.0\.1|localhost):54321/.test(u) },
};
const STAFF = "admin@irstrat.example";
const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
const salir = (m) => { console.error(`✗ ${m}`); process.exit(2); };
const destino = opcion("--destino"), slug = opcion("--slug"), aplicar = argv.includes("--aplicar");
const cfg = DESTINOS[destino];
if (!cfg || !slug) salir("Uso: --destino <staging|local> --slug <slug del mockup> [--credenciales <archivo>] [--aplicar]");
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
if (!cfg.prueba(URL_SB) || (destino !== "staging" && URL_SB.includes(DESTINOS.staging.ref))) salir(`NEXT_PUBLIC_SUPABASE_URL no es la de ${destino}.`);
if (!ANON) salir("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.");

let password;
if (destino === "staging") {
  const credArch = opcion("--credenciales");
  if (!credArch) salir("En staging hace falta --credenciales (contraseña del staff del seed).");
  password = JSON.parse(fs.readFileSync(credArch, "utf8"))[STAFF]?.password;
} else password = fs.readFileSync(path.join(process.cwd(), "supabase/seed.sql"), "utf8").match(/crypt\('([^']+)'/)?.[1];
if (!password) salir(`No se encontró la contraseña de ${STAFF}.`);
const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
const { data: sesion, error: eLogin } = await db.auth.signInWithPassword({ email: STAFF, password });
if (eLogin) salir(`No se pudo abrir la sesión de ${STAFF}.`);
const { data: yo } = await db.from("perfiles_usuario").select("id, rol, tenant_id").eq("id", sesion.user.id).single();
if (!yo || yo.tenant_id !== null) salir(`${STAFF} no es staff en ${destino}.`);
console.log(`Destino: ${destino} · sesión de ${STAFF} (rol ${yo.rol}) · ${aplicar ? "APLICAR" : "revisar, sin escribir"}`);

const leer = (r, que) => { if (r.error) salir(`${que}: ${r.error.message}`); return r.data; };
const nombreDemo = (n) => (/ \(demo\)$/.test(n) ? n : `${n} (demo)`);
const base = (n) => n.replace(/ \(demo\)$/, "");

const mock = leer(await db.from("tenants").select("id, nombre, slug, es_demo, activo").eq("slug", slug).maybeSingle(), "mockup");
if (!mock) salir(`No hay tenant con slug «${slug}».`);
if (!mock.es_demo) salir(`«${slug}» NO es de demostración: no es un mockup. No se toca.`);
if (mock.activo) salir(`«${slug}» está activo: este script es solo para mockups retirados (inactivos).`);
const reales = leer(await db.from("tenants").select("id, slug").eq("nombre", base(mock.nombre)).eq("es_demo", false), "cliente real");
if (reales.length !== 1) salir(`Se esperaba un cliente real llamado «${base(mock.nombre)}»; hay ${reales.length}.`);
const nuevo = nombreDemo(mock.nombre);
console.log(`Mockup «${mock.slug}» (demo, inactivo) · cliente real del mismo nombre: «${reales[0].slug}»`);
if (mock.nombre === nuevo) { console.log(`  ✓ ya se llama «${mock.nombre}»: nada que hacer.`); process.exit(0); }
console.log(`  → nombre «${mock.nombre}» → «${nuevo}»`);
if (!aplicar) { console.log("\nRevisión terminada: 1 cambio. Nada se escribió."); process.exit(0); }

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const r = (await rl.question(`\nEscribe el ref de ${destino} para renombrar «${mock.nombre}» a «${nuevo}»: `)).trim();
rl.close();
if (r !== cfg.ref) salir("No coincide; no se escribió nada.");
leer(await db.from("tenants").update({ nombre: nuevo }).eq("id", mock.id), "renombrar");
const { error } = await db.rpc("fn_log_evento", { p_tenant_id: mock.id, p_usuario_id: yo.id, p_accion: "tenant_renombrado", p_entidad: "tenants", p_entidad_id: mock.id, p_detalle: { nombre_anterior: mock.nombre, nombre: nuevo, motivo: `El mockup lleva «(demo)» para no repetir el nombre del cliente real «${reales[0].slug}».`, via: "nombre-mockup-demo.mjs" } });
if (error) salir(`bitácora: ${error.message}`);
const despues = leer(await db.from("tenants").select("nombre").eq("id", mock.id).single(), "comprobar");
console.log(despues.nombre === nuevo ? `✓ «${nuevo}» · bitácora «tenant_renombrado». Segunda pasada: nada que hacer.` : `✗ el nombre quedó «${despues.nombre}»`);
process.exit(despues.nombre === nuevo ? 0 : 1);
