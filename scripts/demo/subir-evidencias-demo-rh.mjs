#!/usr/bin/env node
// =============================================================================
// SUBE LOS NUEVE PDF DE UN MOCKUP A SUS NUEVE SOLICITUDES DE DEMOSTRACIÓN DE RH
// (Fondo de Fondos, 22 de noviembre de 2026, decisión de Esteban).
//
//   node --env-file=.env.staging.local scripts/demo/subir-evidencias-demo-rh.mjs \
//        --destino staging --tenant fondo-de-fondos --carpeta <ruta de los PDF> \
//        --credenciales .credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json [--aplicar]
//
//   En local: --destino local --app http://localhost:<puerto del servidor contra el stack local>.
//
// Revisar (sin --aplicar) no escribe nada: imprime, por solicitud, su estado, si ya tiene evidencia, qué archivo le
// tocaría y, si ya tiene, cómo va su lectura.
//
// --aplicar pide el ref y sube por la MISMA RUTA QUE EL PORTAL: un navegador entra con la cuenta del usuario de área de
// RH del mockup, abre cada solicitud y usa su tarjeta (archivo, periodo 2025, «Enviar», que en una solicitud
// cuantitativa sería «Subir y leer»). Así corren la subida firmada, la acción `subirEvidencia` y, en su `after()`, la
// lectura que propone el extracto. Este script no confirma, no corrige ni rechaza ninguna propuesta.
// La solicitud que ya tiene evidencia se salta: una segunda pasada no sube nada.
// Al final espera a que terminen las lecturas (--espera <minutos>, 10 por omisión) y reporta por solicitud: con extracto
// propuesto, «no cubre» o sin hallazgo.
//
// Lecturas, con la sesión del staff del seed (la de --credenciales en staging; en local, la de supabase/seed.sql).
// La contraseña del usuario de RH sale de --cuentas (por omisión .credenciales-demo/prospectos-<ref|local>.json).
// Ninguna contraseña se imprime.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { createRequire } from "node:module";

const req = createRequire(path.join(process.cwd(), "package.json"));
const { createClient } = req("@supabase/supabase-js");

// Archivo → título de la solicitud. Los nombres se comparan en NFC (macOS guarda los acentos descompuestos).
const TABLA = [
  ["Politica_de_Inversion_Responsable_v2.pdf", "Política de Inversión Responsable"],
  ["Politica_de_Gestion_y_Comunicacion_Responsable_Stewardship.pdf", "Política de Gestión y Comunicación Responsable (Stewardship)"],
  ["Declaración+sobre+la+Relevancia+del+Desarrollo+Sostenible+para+FDF+2026.pdf", "Declaración sobre la relevancia del desarrollo sostenible 2026"],
  ["POLITICAS_GENERALES_DE_INVERSION.pdf", "Políticas Generales de Inversión"],
  ["Codigo_de_Etica_y_Conducta_Version_10_Mayo2023_FDF-.pdf", "Código de Ética y Conducta"],
  ["Manifiesto+Tolerancia+Cero+Corrupción+2026.pdf", "Manifiesto de Tolerancia Cero a la Corrupción 2026"],
  ["Politica_de_Diversidad_Equidad_e_Inclusion.pdf", "Política de Diversidad, Equidad e Inclusión"],
  ["Politica_de_Integridad_y_Anticorrupcion_FdeF.pdf", "Política de Integridad y Anticorrupción"],
  ["Politica_de_Privacidad_FdeF.pdf", "Política de Privacidad"],
];
const PERIODO = "2025";
const BYTES_MAX = 25 * 1024 * 1024;
const STAFF = "admin@irstrat.example";
const DESTINOS = {
  staging: { ref: "ewgnvjtjhvdltvkopptn", app: "https://traceline-staging-70ce5b369e7c.herokuapp.com", prueba: (u) => u.includes("ewgnvjtjhvdltvkopptn") },
  local: { ref: "local", app: null, prueba: (u) => /^http:\/\/(127\.0\.0\.1|localhost):54321/.test(u) },
};

const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
const salir = (m) => { console.error(`✗ ${m}`); process.exit(2); };
const nfc = (s) => s.normalize("NFC");

const destino = opcion("--destino");
const slug = opcion("--tenant");
const carpeta = opcion("--carpeta");
const aplicar = argv.includes("--aplicar");
const esperaMin = Number(opcion("--espera") ?? 10);
const cfg = DESTINOS[destino];
if (!cfg || !slug || !carpeta) salir("Uso: --destino <staging|local> --tenant <slug> --carpeta <ruta de los PDF> [--credenciales <seed>] [--cuentas <prospectos>] [--app <url>] [--espera <min>] [--aplicar]");
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!cfg.prueba(URL_SB)) salir(`NEXT_PUBLIC_SUPABASE_URL no es la de ${destino}.`);
const APP = (opcion("--app") ?? cfg.app ?? "").replace(/\/$/, "");
if (!APP) salir("En local hace falta --app con la URL del servidor que corre contra el stack local (no :3000, que va a dev).");
if (destino === "staging" && APP !== cfg.app) salir(`En staging la app es ${cfg.app}.`);
if (destino === "local" && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(APP)) salir("En local, --app es http://localhost:<puerto>.");

// --- Sesión del staff (solo lectura de la base) ----------------------------------------------------------------------
let passStaff;
if (destino === "staging") {
  const arch = opcion("--credenciales");
  if (!arch) salir("En staging hace falta --credenciales (contraseña del staff del seed).");
  passStaff = JSON.parse(fs.readFileSync(arch, "utf8"))[STAFF]?.password;
} else passStaff = fs.readFileSync(path.join(process.cwd(), "supabase/seed.sql"), "utf8").match(/crypt\('([^']+)'/)?.[1];
if (!passStaff) salir(`No se encontró la contraseña de ${STAFF}.`);
const db = createClient(URL_SB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
{
  const { data, error } = await db.auth.signInWithPassword({ email: STAFF, password: passStaff });
  if (error) salir(`No se pudo abrir la sesión de ${STAFF}.`);
  const { data: yo } = await db.from("perfiles_usuario").select("tenant_id").eq("id", data.user.id).maybeSingle();
  if (!yo || yo.tenant_id !== null) salir(`${STAFF} no es staff en ${destino}.`);
}

// --- Mockup, reporte, solicitudes y usuario de RH ----------------------------------------------------------------------
const { data: tenant } = await db.from("tenants").select("id, nombre, es_demo, activo, lectura_evidencias_activa, lecturas_mes_max").eq("slug", slug).maybeSingle();
if (!tenant) salir(`No hay tenant con slug «${slug}».`);
if (!tenant.es_demo) salir(`«${slug}» no es de demostración: este script es solo para mockups.`);
if (!tenant.activo) salir(`«${slug}» está inactivo.`);
const { data: reportes } = await db.from("reportes").select("id, estado").eq("tenant_id", tenant.id).eq("ejercicio", 2025);
if ((reportes ?? []).length !== 1) salir(`Se esperaba un reporte 2025 de ${tenant.nombre}; hay ${(reportes ?? []).length}.`);
const reporte = reportes[0];
const titulos = TABLA.map(([, t]) => t);
const { data: sols, error: eS } = await db.from("solicitudes").select("id, titulo, estado, es_cuantitativa, area_asignada, responsable_cliente_id").eq("reporte_id", reporte.id).in("titulo", titulos);
if (eS) salir(`Solicitudes: ${eS.message}`);
const porTitulo = new Map();
for (const s of sols ?? []) {
  if (porTitulo.has(s.titulo)) salir(`«${s.titulo}» está dos veces en el reporte 2025 de ${tenant.nombre}.`);
  porTitulo.set(s.titulo, s);
}
const faltantes = titulos.filter((t) => !porTitulo.has(t));
if (faltantes.length) salir(`Faltan solicitudes en ${tenant.nombre}: ${faltantes.join("; ")}. Corre antes solicitudes-demo-rh.mjs --tenant ${slug}.`);
const responsables = [...new Set([...porTitulo.values()].map((s) => s.responsable_cliente_id))];
if (responsables.length !== 1 || !responsables[0]) salir(`Las nueve deberían tener un solo responsable; tienen ${responsables.length}.`);
const { data: rh } = await db.from("perfiles_usuario").select("id, email, nombre, rol, area, activo, tenant_id").eq("id", responsables[0]).maybeSingle();
if (!rh || rh.tenant_id !== tenant.id || !rh.activo || rh.rol !== "cliente") salir("El responsable de las nueve no es un usuario de área activo del mockup.");
if ([...porTitulo.values()].some((s) => s.area_asignada !== rh.area)) salir(`Alguna de las nueve no está asignada al área «${rh.area}».`);

const cuentasArch = opcion("--cuentas") ?? path.join(process.cwd(), ".credenciales-demo", `prospectos-${cfg.ref}.json`);
let cuenta;
try { cuenta = JSON.parse(fs.readFileSync(cuentasArch, "utf8"))[rh.email]; } catch { salir(`No se pudo leer ${path.relative(process.cwd(), cuentasArch)}.`); }
if (!cuenta?.password) salir(`${rh.email} no está en ${path.relative(process.cwd(), cuentasArch)}.`);
if (cuenta.slug && cuenta.slug !== slug) salir(`${rh.email} es de «${cuenta.slug}» en el archivo de cuentas, no de «${slug}».`);

// --- Archivos ----------------------------------------------------------------------------------------------------------
if (!fs.existsSync(carpeta) || !fs.statSync(carpeta).isDirectory()) salir(`No existe la carpeta ${carpeta}.`);
const enCarpeta = new Map(fs.readdirSync(carpeta).map((n) => [nfc(n), path.join(carpeta, n)]));
const archivoDe = (nombre) => {
  const ruta = enCarpeta.get(nfc(nombre));
  if (!ruta) return { error: "no está en la carpeta" };
  const bytes = fs.statSync(ruta).size;
  if (bytes > BYTES_MAX) return { error: `pesa ${(bytes / 1048576).toFixed(1)} MB; el límite es 25 MB` };
  const cabeza = Buffer.alloc(5);
  const fd = fs.openSync(ruta, "r"); fs.readSync(fd, cabeza, 0, 5, 0); fs.closeSync(fd);
  if (cabeza.toString("latin1") !== "%PDF-") return { error: "no es un PDF" };
  return { ruta, bytes };
};

// --- Estado de cada solicitud -------------------------------------------------------------------------------------------
async function estadoDe(s) {
  const { data: evs, error } = await db.from("evidencias").select("id, version, nombre_original, created_at").eq("solicitud_id", s.id).order("version", { ascending: false });
  if (error) salir(`Evidencias de «${s.titulo}»: ${error.message}`);
  const ultima = (evs ?? [])[0] ?? null;
  let lectura = null, sugerencia = null;
  if (ultima) {
    const { data: c } = await db.from("evidencias_contenido").select("estado, mensaje, error").eq("evidencia_id", ultima.id).maybeSingle();
    lectura = c ?? null;
    const { data: sg } = await db.from("sugerencias_captura").select("estado, extracto, cobertura, fuente, motivo, error").eq("evidencia_id", ultima.id).neq("estado", "obsoleta").order("created_at", { ascending: false }).limit(1);
    sugerencia = (sg ?? [])[0] ?? null;
  }
  return { evidencias: (evs ?? []).length, ultima, lectura, sugerencia };
}
const TERMINADA = new Set(["extraido", "omitido", "error", "no_soportado"]);
function resultado(e) {
  if (!e.ultima) return "sin evidencia";
  const l = e.lectura?.estado ?? "sin fila de lectura";
  if (!TERMINADA.has(l)) return `leyendo (${l})`;
  if (l !== "extraido") return `lectura ${l}${e.lectura?.mensaje ? `: ${e.lectura.mensaje}` : ""}`;
  const sg = e.sugerencia;
  if (!sg) return "leída; propuesta en curso";
  const cubre = sg.fuente?.cubre_requisito ?? null;
  if (sg.estado === "sugerida") return `con extracto propuesto${cubre === "parcial" ? " (cubre en parte)" : ""}`;
  if (sg.estado === "sin_hallazgo") return cubre === "no" ? "no cubre" : "sin hallazgo";
  if (sg.estado === "fallida") return "propuesta fallida (error técnico)";
  return `propuesta ${sg.estado}`;
}
const terminado = (e) => !e.ultima || (TERMINADA.has(e.lectura?.estado) && (e.lectura.estado !== "extraido" || Boolean(e.sugerencia)));

async function lecturasDelMes() {
  const d = new Date();
  const desde = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  const cuenta = async (q) => { const { count, error } = await q; if (error || count == null) salir(`No se pudieron contar las lecturas del mes: ${error?.message ?? "sin conteo"}`); return count; };
  return (await cuenta(db.from("evidencias_contenido").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("estado", "extraido").gte("procesado_en", desde)))
    + (await cuenta(db.from("perfil_emisor_adjuntos_contenido").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("estado", "extraido").gte("procesado_en", desde)))
    + (await cuenta(db.from("sugerencias_captura").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("regenerada", true).gte("created_at", desde)))
    + (await cuenta(db.from("sugerencias_captura").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("segunda_opinion->relectura->>realizada", "true").gte("created_at", desde)));
}

console.log(`Destino: ${destino} · app ${APP} · ${aplicar ? "APLICAR" : "revisar, sin escribir"}`);
console.log(`Mockup: ${tenant.nombre} (${slug}) · reporte 2025 ${reporte.estado}`);
const usadas = await lecturasDelMes();
console.log(`Lectura de evidencias: ${tenant.lectura_evidencias_activa ? "ENCENDIDA" : "APAGADA"} · ${usadas} de ${tenant.lecturas_mes_max} lecturas este mes`);
console.log(`Sube: ${rh.email} (${rh.nombre}) · área «${rh.area}» · contraseña tomada de ${path.relative(process.cwd(), cuentasArch)}`);
console.log(`Carpeta: ${carpeta}\n`);

const plan = [];
let bloqueos = 0;
for (const [i, [nombre, titulo]] of TABLA.entries()) {
  const s = porTitulo.get(titulo);
  const e = await estadoDe(s);
  const a = archivoDe(nombre);
  let accion;
  if (e.evidencias) accion = `ya tiene evidencia (v${e.ultima.version} «${e.ultima.nombre_original}»), se salta · ${resultado(e)}`;
  else if (s.estado === "congelado" || reporte.estado === "congelado") { accion = "CONGELADA, no se puede subir"; bloqueos++; }
  else if (a.error) { accion = `FALTA ARCHIVO: ${nombre} ${a.error}`; bloqueos++; }
  else { accion = `subiría ${nombre} (${(a.bytes / 1024).toFixed(0)} KB) · periodo ${PERIODO}`; plan.push({ s, nombre, ruta: a.ruta }); }
  console.log(`  ${i + 1}. ${titulo} · ${s.estado}${s.es_cuantitativa ? " · cuantitativa" : ""}`);
  console.log(`     ${accion}`);
}
console.log("");
if (!tenant.lectura_evidencias_activa) salir("La lectura de evidencias está apagada en el mockup: no se lee nada. Alto.");
if (usadas + plan.length > tenant.lecturas_mes_max) salir(`El tope no alcanza: ${usadas} usadas + ${plan.length} por leer > ${tenant.lecturas_mes_max}. Alto.`);
if (bloqueos) salir(`${bloqueos} solicitud(es) sin evidencia no se pueden subir (arriba, en mayúsculas). Alto.`);
if (!aplicar) { console.log(`Revisión terminada: ${plan.length} por subir. Nada se escribió.`); process.exit(0); }

// --- Aplicar ------------------------------------------------------------------------------------------------------------
if (plan.length) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question(`Escribe el ref de ${destino} para subir ${plan.length} archivos como ${rh.email}: `)).trim();
  rl.close();
  if (r !== cfg.ref) salir("No coincide; no se subió nada.");

  const { chromium } = req("playwright");
  const navegador = await chromium.launch();
  const p = await navegador.newPage();
  const parar = async (m) => { await navegador.close(); salir(`${m} Las anteriores quedaron subidas; vuelve a correr y se saltan.`); };
  await p.goto(`${APP}/login`, { timeout: 90000 });
  await p.fill('input[type="email"]', rh.email);
  await p.fill('input[type="password"]', cuenta.password);
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }).catch(() => {}), p.click('button[type="submit"]')]);
  if (new URL(p.url()).pathname.startsWith("/login")) await parar(`No se pudo entrar como ${rh.email} en ${APP}.`);
  console.log(`Sesión abierta en el portal como ${rh.email}.`);

  for (const { s, nombre, ruta } of plan) {
    // Justo antes de subir, otra vez: si alguien subió mientras tanto, se salta.
    if ((await estadoDe(s)).evidencias) { console.log(`  · ${s.titulo}: ya tiene evidencia, se salta`); continue; }
    await p.goto(`${APP}/portal/solicitudes/${s.id}`, { timeout: 90000 });
    await p.waitForLoadState("networkidle").catch(() => {});
    if (!(await p.getByText(s.titulo, { exact: false }).first().isVisible().catch(() => false))) await parar(`La pantalla de «${s.titulo}» no la muestra: ¿la app apunta a otra base?`);
    await p.setInputFiles("#evidencia-file", ruta);
    await p.fill("#periodo", PERIODO);
    const boton = p.getByRole("button", { name: s.es_cuantitativa ? "Subir y leer" : "Enviar" });
    if (!(await boton.isEnabled().catch(() => false))) await parar(`«${s.titulo}»: el botón de envío no está disponible.`);
    await boton.click();
    const fin = Date.now() + 120000;
    let e;
    while (Date.now() < fin) {
      e = await estadoDe(s);
      if (e.evidencias) break;
      const aviso = await p.locator('[role="alert"], [role="status"]').allInnerTexts().catch(() => []);
      const err = aviso.find((t) => /no se pudo|falta|no se encontr|congelad|25 MB|error/i.test(t));
      if (err) await parar(`«${s.titulo}»: el portal respondió «${err.trim().slice(0, 200)}».`);
      await p.waitForTimeout(1000);
    }
    if (!e?.evidencias) await parar(`«${s.titulo}»: después de 2 min no hay evidencia registrada.`);
    console.log(`  ✓ ${s.titulo} ← ${nombre} (v${e.ultima.version})`);
  }
  await navegador.close();
}

// --- Esperar las lecturas y reportar -------------------------------------------------------------------------------------
console.log(`\nEsperando las lecturas (hasta ${esperaMin} min)…`);
const limite = Date.now() + esperaMin * 60000;
let estados;
for (;;) {
  estados = await Promise.all(TABLA.map(async ([, t]) => [t, await estadoDe(porTitulo.get(t))]));
  if (estados.every(([, e]) => terminado(e)) || Date.now() > limite) break;
  await new Promise((r) => setTimeout(r, 5000));
}
console.log("\nResultado por solicitud:");
const cuenta2 = {};
for (const [t, e] of estados) {
  const r = resultado(e);
  const clave = r.startsWith("con extracto") ? "con extracto propuesto" : r;
  cuenta2[clave] = (cuenta2[clave] ?? 0) + 1;
  console.log(`  ${t} · ${r}`);
  const sg = e.sugerencia;
  if (sg?.estado === "sin_hallazgo" && (sg.motivo || sg.cobertura)) console.log(`     ${(sg.motivo || sg.cobertura).replace(/\s+/g, " ").slice(0, 220)}`);
}
console.log(`\n${Object.entries(cuenta2).map(([k, v]) => `${v} ${k}`).join(" · ")}`);
const pendientes = estados.filter(([, e]) => !terminado(e)).length;
if (pendientes) {
  console.log(`⚠ ${pendientes} lectura(s) siguen en curso después de ${esperaMin} min; el cron las recoge. Vuelve a correr sin --aplicar para ver cómo terminan.`);
  process.exit(1);
}
console.log("✓ Las lecturas terminaron. Ninguna propuesta se confirmó, corrigió ni rechazó.");
