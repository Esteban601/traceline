#!/usr/bin/env node
// =============================================================================
// PRECARGA DEL REPORTE 2025 DE O'DONNELL, vía C (como el histórico de GCARSO), en lugar del panel. Encargo
// docs/encargos/2026-11-10-odonnell-alta-real.md, Fase 3. Lo corre Esteban en staging; Claude Code lo prueba solo en el
// stack local, con el tenant de prueba del alta.
//
//   node --env-file=.env.staging.local scripts/alta/precarga-odonnell-2025.mjs --destino staging \
//        --credenciales .credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json \
//        --formato "normas/_fuentes/odonnell/ODOCK -.pdf" --ias normas/_fuentes/odonnell/IAS-OD-VF-ESP-2025.pdf [--aplicar]
//
// Datos: scripts/alta/datos/precarga-odonnell-2025.json, generado del texto de los dos PDF (Formato BMV 2025 publicado e
// IAS 2025): cada cifra y cada texto es literal y lleva su página del PDF. Lo que no está en las fuentes no se carga:
// queda pendiente, nunca en cero (Alcance 1, Alcance 3 y sus categorías, capex por partida, metas numéricas de agua y
// GEI, verificación y lo que la guía marca sin dato).
//
// Qué escribe en el reporte 2025 del tenant `odonnell` (cada cosa solo si no está ya; nada se sobrescribe):
//   1. Perfil: el criterio de cuantificación (NIIF S2 21(a), Formato p. 31), si el campo está vacío.
//   2. Registro de clima: los 9 riesgos y oportunidades con tipo, horizontes y descripción, y sus valores 2025 (activos
//      y %); el capital publicado en $0 queda vacío, con nota.
//   3. Objetivos: los 6 del Formato; los 3 climáticos con sus campos y su detalle, y las metas EDGE publicadas.
//   4. Solicitudes: por cada cifra o texto, la página del PDF recortada como evidencia (en nombre del área de la
//      solicitud), la captura confirmada con la cita en `justificacion`, o el extracto confirmado con su página.
//      La fila de lectura de esas evidencias queda «omitido»: el contenido ya viene transcrito, no se lee con el modelo.
//   5. Cuestionarios: escenarios (22(b)(i) y (ii)) y 36(e)(i). Cambios en el enfoque de medición (29(a)(iii)): sin
//      fuente, pendiente.
// Bitácora: un evento `precarga_irstrat` por cosa escrita, «precarga 2025 por IRStrat», con la fecha de los datos.
//
// Sin --aplicar solo revisa e imprime, solicitud por solicitud: valor, unidad, página, archivo y fuente, para cotejar.
// Idempotente por detección: lo escrito lleva la marca de los datos y no se vuelve a escribir. Evidencias, capturas y
// bitácora son de solo agregar; retractar es rehacer el reporte desde el alta.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline/promises";
import { createRequire } from "node:module";

const req = createRequire(path.join(process.cwd(), "package.json"));
const { createClient } = req("@supabase/supabase-js");
const { PDFDocument } = req("pdf-lib");

const DESTINOS = {
  staging: { ref: "ewgnvjtjhvdltvkopptn", prueba: (u) => u.includes("ewgnvjtjhvdltvkopptn") },
  local: { ref: "local", prueba: (u) => /^http:\/\/(127\.0\.0\.1|localhost):54321/.test(u) },
};
const STAFF = "admin@irstrat.example";
const SCRIPT = "precarga-odonnell-2025.mjs";
const TENANT_SLUG = "odonnell";
const EJERCICIO = 2025;

const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
const salir = (m) => { console.error(`✗ ${m}`); process.exit(2); };
const destino = opcion("--destino");
const aplicar = argv.includes("--aplicar");
const cfg = DESTINOS[destino];
if (!cfg) salir("Uso: --destino <staging|local> --formato <pdf> --ias <pdf> [--credenciales <archivo>] [--datos <json>] [--aplicar]");
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!cfg.prueba(URL_SB) || (destino !== "staging" && URL_SB.includes(DESTINOS.staging.ref))) salir(`NEXT_PUBLIC_SUPABASE_URL no es la de ${destino}.`);
if (!ANON || !SERVICE) salir("Faltan NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en el entorno.");

// --- Datos y fuentes --------------------------------------------------------------------------------------------
const D = JSON.parse(fs.readFileSync(opcion("--datos") ?? path.join(process.cwd(), "scripts/alta/datos/precarga-odonnell-2025.json"), "utf8"));
const MARCA = D.marca;
const PDF = {};
for (const [clave, arg] of [["formato", "--formato"], ["ias", "--ias"]]) {
  const f = opcion(arg);
  if (!f || !fs.existsSync(f)) salir(`Falta ${arg} <pdf> (${D.fuentes[clave].archivo}).`);
  const buf = fs.readFileSync(f);
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  if (sha !== D.fuentes[clave].sha256) salir(`${arg}: el PDF no es el de los datos (sha256 ${sha.slice(0, 12)}…, se espera ${D.fuentes[clave].sha256.slice(0, 12)}…).`);
  PDF[clave] = buf;
}
const ETIQUETA = { formato: "Formato BMV 2025", ias: "IAS 2025" };
const PREFIJO = { formato: "ODOCK-Formato-2025", ias: "ODOCK-IAS-2025" };
const paginasTxt = (ps) => (ps.length === 1 ? `p. ${ps[0]}` : `pp. ${ps.join(", ")}`);
const archivoDe = (fuente, ps) => `${PREFIJO[fuente]}-p${ps.join("-")}.pdf`;
async function recortar(fuente, ps) {
  const original = await PDFDocument.load(PDF[fuente], { ignoreEncryption: true });
  const salida = await PDFDocument.create();
  for (const pg of await salida.copyPages(original, ps.map((p) => p - 1))) salida.addPage(pg);
  return Buffer.from(await salida.save());
}

// --- Sesión ------------------------------------------------------------------------------------------------------
let password;
if (destino === "staging") {
  const credArch = opcion("--credenciales");
  if (!credArch) salir("En staging hace falta --credenciales (contraseña del staff del seed).");
  password = JSON.parse(fs.readFileSync(credArch, "utf8"))[STAFF]?.password;
} else password = fs.readFileSync(path.join(process.cwd(), "supabase/seed.sql"), "utf8").match(/crypt\('([^']+)'/)?.[1];
if (!password) salir(`No se encontró la contraseña de ${STAFF}.`);
const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
const { data: sesion, error: eLogin } = await db.auth.signInWithPassword({ email: STAFF, password });
if (eLogin) salir(`No se pudo abrir la sesión de ${STAFF}.`);
const { data: yo } = await db.from("perfiles_usuario").select("id, rol, tenant_id").eq("id", sesion.user.id).single();
if (!yo || yo.tenant_id !== null) salir(`${STAFF} no es staff en ${destino}.`);
console.log(`Destino: ${destino} · sesión de ${STAFF} (rol ${yo.rol}) · ${aplicar ? "APLICAR" : "revisar, sin escribir"} · datos del ${D.fecha}`);

const leer = (r, que) => { if (r.error) salir(`${que}: ${r.error.message}`); return r.data; };
const log = async (tenantId, entidad, entidadId, detalle) => {
  const { error } = await db.rpc("fn_log_evento", {
    p_tenant_id: tenantId, p_usuario_id: yo.id, p_accion: "precarga_irstrat", p_entidad: entidad, p_entidad_id: entidadId,
    p_detalle: { motivo: "precarga 2025 por IRStrat", fecha: D.fecha, via: SCRIPT, ...detalle },
  });
  if (error) salir(`bitácora: ${error.message}`);
};

// --- Tenant, reporte y solicitudes --------------------------------------------------------------------------------
const tenant = leer(await db.from("tenants").select("id, nombre, es_demo, staff_puede_cargar").eq("slug", TENANT_SLUG).maybeSingle(), "tenant");
if (!tenant || tenant.es_demo) salir(`No existe el tenant real «${TENANT_SLUG}»: el alta va antes.`);
if (!tenant.staff_puede_cargar) salir(`«${TENANT_SLUG}» no tiene la carga por IRStrat encendida.`);
const reporte = leer(await db.from("reportes").select("id, nombre").eq("tenant_id", tenant.id).eq("ejercicio", EJERCICIO).maybeSingle(), "reporte");
if (!reporte) salir(`«${TENANT_SLUG}» no tiene reporte ${EJERCICIO}.`);
const sols = leer(await db.from("solicitudes").select("id, orden, titulo, area_asignada, estado").eq("reporte_id", reporte.id), "solicitudes");
const porOrden = new Map(sols.map((s) => [s.orden, s]));
const esperadas = Object.entries(D.solicitudes);
const distintas = esperadas.filter(([o, t]) => porOrden.get(Number(o))?.titulo !== t);
if (sols.length !== esperadas.length || distintas.length) {
  for (const [o, t] of distintas) console.log(`  ✗ ${o}: se espera «${t}», hay «${porOrden.get(Number(o))?.titulo ?? "nada"}»`);
  salir(`El reporte ${EJERCICIO} tiene ${sols.length} solicitudes y ${distintas.length} títulos distintos de los datos: la tabla se rehace con las de este destino.`);
}
console.log(`Cliente: ${tenant.nombre} · ${reporte.nombre} · ${sols.length} solicitudes, títulos como los datos ✓`);

// --- Plan por solicitud ---------------------------------------------------------------------------------------------
const plan = new Map(); // orden → { tipo, ... }
for (const c of D.capturas) plan.set(c.orden, { tipo: "cifra", ...c });
for (const t of D.textos) plan.set(t.orden, { tipo: "texto", ...t });
for (const p of D.pendientes) for (const o of p.ordenes) plan.set(o, { tipo: "pendiente", motivo: p.motivo });
const sinPlan = [...porOrden.keys()].filter((o) => !plan.has(o));
if (sinPlan.length) salir(`Solicitudes sin destino en los datos: ${sinPlan.join(", ")}.`);

const evidenciaPrevia = async (sol, nombre) => {
  const r = leer(await db.from("evidencias").select("id, version").eq("solicitud_id", sol.id).eq("nombre_original", nombre).like("notas", `${MARCA}%`).limit(1), "evidencias");
  return r[0] ?? null;
};
const capturaPrevia = async (sol, justificacion) =>
  leer(await db.from("capturas_valor").select("id").eq("solicitud_id", sol.id).eq("periodo", String(EJERCICIO)).eq("justificacion", justificacion).limit(1), "capturas").length > 0;
const extractoPrevio = async (sol, texto) =>
  leer(await db.from("sugerencias_captura").select("id").eq("solicitud_id", sol.id).eq("tipo", "texto").eq("estado", "confirmada").eq("extracto", texto).limit(1), "extractos").length > 0;

const filas = [];
for (const [orden, sol] of [...porOrden.entries()].sort((a, b) => a[0] - b[0])) {
  const p = plan.get(orden);
  const fila = { orden, titulo: sol.titulo, area: sol.area_asignada, p, sol };
  if (p.tipo !== "pendiente") {
    fila.archivo = archivoDe(p.fuente, p.paginas);
    fila.cita = `${MARCA} ${ETIQUETA[p.fuente]} (${D.fuentes[p.fuente].archivo}), ${paginasTxt(p.paginas)}: ${p.cita ?? `extracto literal de ${paginasTxt(p.paginas)}.`}`;
    fila.evidencia = await evidenciaPrevia(sol, fila.archivo);
    fila.hecho = p.tipo === "cifra" ? await capturaPrevia(sol, fila.cita) : await extractoPrevio(sol, p.extracto);
  }
  filas.push(fila);
}

// --- Revisión ---------------------------------------------------------------------------------------------------------
const corto = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
console.log("\n## Solicitudes del reporte 2025\n");
console.log("| # | Solicitud | Qué | Valor | Unidad | Página | Archivo | Fuente | Estado |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const f of filas) {
  const { p } = f;
  if (p.tipo === "pendiente") { console.log(`| ${f.orden} | ${corto(f.titulo, 48)} | pendiente | — | — | — | — | — | ${corto(p.motivo, 70)} |`); continue; }
  const valor = p.tipo === "cifra" ? p.valor.toLocaleString("en-US") : `texto (${p.extracto.length} car.): «${corto(p.extracto, 50)}»`;
  console.log(`| ${f.orden} | ${corto(f.titulo, 48)} | ${p.tipo === "cifra" ? "captura" : "extracto"} | ${valor} | ${p.unidad ?? "—"} | ${paginasTxt(p.paginas)} | ${f.archivo} | ${ETIQUETA[p.fuente]} | ${f.hecho ? "ya está" : "por escribir"} |`);
}

const perfil = leer(await db.from("perfil_emisor").select("criterio_cuantificacion, congruencia_estados_financieros").eq("tenant_id", tenant.id).maybeSingle(), "perfil");
const crit = D.perfil.criterio_cuantificacion;
const perfilEstado = (perfil?.criterio_cuantificacion ?? "").trim() === crit.texto ? "ya está" : (perfil?.criterio_cuantificacion ?? "").trim() ? "TIENE OTRO TEXTO: no se toca" : "por escribir";
console.log(`\n## Perfil\n- Criterio de cuantificación (NIIF S2 21(a)): ${crit.texto.length} car., ${ETIQUETA[crit.fuente]} ${paginasTxt(crit.paginas)} · ${perfilEstado}`);
console.log(`- Congruencia con los estados financieros (B65(e)): pendiente. ${D.perfil.congruencia_estados_financieros.pendiente}`);

const regs = leer(await db.from("registros_clima").select("id, nombre").eq("reporte_id", reporte.id), "registros");
console.log("\n## Registro de clima (valores 2025)\n");
console.log("| # | Nombre | Tipo | Horizontes | Activos | % | Capital | Páginas | Estado |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const r of D.registros) console.log(`| ${r.n} | ${r.nombre} | ${r.tipo} | ${r.horizontes.join(", ")} | ${r.valores.cantidad_activos} | ${r.valores.porcentaje} | vacío (publicado $0) | ${paginasTxt(r.paginas)} | ${regs.some((x) => x.nombre === r.nombre) ? "ya está" : "por escribir"} |`);

const objs = leer(await db.from("objetivos").select("id, nombre").eq("reporte_id", reporte.id), "objetivos");
console.log("\n## Objetivos\n");
console.log("| Objetivo | Ámbito | Tipo | Periodo | Base | Meta | Páginas | Estado |");
console.log("|---|---|---|---|---|---|---|---|");
for (const o of D.objetivos) console.log(`| ${o.nombre} | ${o.ambito} | ${o.tipo_objetivo ?? "—"} | ${o.periodo_aplicacion ?? "—"} | ${o.periodo_base ?? "—"} | ${o.meta ? corto(o.meta, 60) : o.ambito === "climatico" ? "sin meta numérica publicada" : "—"} | ${paginasTxt(o.paginas)} | ${objs.some((x) => x.nombre === o.nombre) ? "ya está" : "por escribir"} |`);

const cuests = leer(await db.from("cuestionarios_respuestas").select("hoja, pregunta_orden, respuesta").eq("reporte_id", reporte.id), "cuestionarios");
const cuestEstado = (c) => { const x = cuests.find((y) => y.hoja === c.hoja && y.pregunta_orden === c.orden); return !x ? "por escribir" : x.respuesta === c.respuesta ? "ya está" : "TIENE OTRA RESPUESTA: no se toca"; };
console.log("\n## Cuestionarios\n");
console.log("| Hoja | # | Respuesta | Páginas | Estado |");
console.log("|---|---|---|---|---|");
for (const c of D.cuestionarios) console.log(`| ${c.hoja} | ${c.orden} | ${corto(String(c.respuesta), 70)} | ${paginasTxt(c.paginas)} | ${cuestEstado(c)} |`);
console.log("| S2 29(a)(iii) | 1 | pendiente: ni el Formato ni el IAS dicen si cambió el enfoque de medición | — | — |");

console.log("\n## Otros pendientes a propósito\n");
for (const o of D.otros_pendientes) console.log(`- ${o}`);

const porEscribir = {
  solicitudes: filas.filter((f) => f.p.tipo !== "pendiente" && !f.hecho).length,
  perfil: perfilEstado === "por escribir" ? 1 : 0,
  registros: D.registros.filter((r) => !regs.some((x) => x.nombre === r.nombre)).length,
  objetivos: D.objetivos.filter((o) => !objs.some((x) => x.nombre === o.nombre)).length,
  cuestionarios: D.cuestionarios.filter((c) => cuestEstado(c) === "por escribir").length,
};
const total = Object.values(porEscribir).reduce((a, b) => a + b, 0);
console.log(`\nPor escribir: ${Object.entries(porEscribir).map(([k, v]) => `${k} ${v}`).join(" · ")} (${total} en total).`);
if (!aplicar) { console.log("Revisión terminada. Nada se escribió."); process.exit(0); }
if (!total) { console.log("Nada que hacer: la precarga ya está."); process.exit(0); }

// --- Aplicar ------------------------------------------------------------------------------------------------------------
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const resp = (await rl.question(`\nEscribe el ref de ${destino} para precargar ${total} cosas en «${TENANT_SLUG}» ${EJERCICIO}: `)).trim();
rl.close();
if (resp !== cfg.ref) salir("No coincide; no se escribió nada.");

// 1. Perfil
if (porEscribir.perfil) {
  const r = await db.from("perfil_emisor").upsert({ tenant_id: tenant.id, criterio_cuantificacion: crit.texto, actualizado_por: yo.id, actualizado_en: new Date().toISOString() }, { onConflict: "tenant_id" });
  if (r.error) salir(`perfil: ${r.error.message}`);
  await log(tenant.id, "perfil_emisor", tenant.id, { objeto: "perfil", campo: "criterio_cuantificacion", fuente: ETIQUETA[crit.fuente], paginas: crit.paginas });
  console.log("  ✓ Perfil: criterio de cuantificación");
}

// 2. Registro de clima
for (const [i, r] of D.registros.entries()) {
  if (regs.some((x) => x.nombre === r.nombre)) continue;
  const ins = await db.from("registros_clima").insert({ reporte_id: reporte.id, tipo: r.tipo, nombre: r.nombre, descripcion: r.descripcion, horizontes: r.horizontes, orden: i, activo: true }).select("id").single();
  if (ins.error) salir(`registro «${r.nombre}»: ${ins.error.message}`);
  const v = await db.from("registros_clima_valores").insert({ registro_id: ins.data.id, ejercicio: EJERCICIO, cantidad_activos: r.valores.cantidad_activos, porcentaje: r.valores.porcentaje, notas: r.valores.notas, capturado_por: yo.id });
  if (v.error) salir(`valores de «${r.nombre}»: ${v.error.message}`);
  await log(tenant.id, "registros_clima", ins.data.id, { objeto: "registro de clima", nombre: r.nombre, fuente: ETIQUETA.formato, paginas: r.paginas });
  console.log(`  ✓ Registro: ${r.nombre}`);
}

// 3. Objetivos
for (const [i, o] of D.objetivos.entries()) {
  if (objs.some((x) => x.nombre === o.nombre)) continue;
  const { detalle, paginas, nota, ...campos } = o;
  const ins = await db.from("objetivos").insert({ reporte_id: reporte.id, orden: i, activo: true, ...campos }).select("id").single();
  if (ins.error) salir(`objetivo «${o.nombre}»: ${ins.error.message}`);
  if (detalle) {
    const d = await db.from("objetivos_detalle").insert({ objetivo_id: ins.data.id, ...Object.fromEntries(Object.entries(detalle).filter(([, v]) => v != null)) });
    if (d.error) salir(`detalle de «${o.nombre}»: ${d.error.message}`);
  }
  await log(tenant.id, "objetivos", ins.data.id, { objeto: "objetivo", nombre: o.nombre, fuente: ETIQUETA.formato, paginas, nota: nota ?? null });
  console.log(`  ✓ Objetivo: ${o.nombre}`);
}

// 4. Solicitudes: evidencia (recorte), captura o extracto
for (const f of filas.filter((x) => x.p.tipo !== "pendiente" && !x.hecho)) {
  const { p, sol } = f;
  let ev = f.evidencia;
  if (!ev) {
    const cuerpo = await recortar(p.fuente, p.paginas);
    const ruta = `${tenant.id}/${sol.id}/${f.archivo}`;
    const up = await admin.storage.from("evidencias").upload(ruta, cuerpo, { contentType: "application/pdf", upsert: true });
    if (up.error) salir(`storage ${f.archivo}: ${up.error.message}`);
    const previas = leer(await db.from("evidencias").select("version").eq("solicitud_id", sol.id), "versiones");
    const version = Math.max(0, ...previas.map((x) => x.version)) + 1;
    const ins = await db.from("evidencias").insert({
      solicitud_id: sol.id, version, archivo_path: ruta, nombre_original: f.archivo, periodo_cubierto: String(EJERCICIO),
      area_origen: sol.area_asignada, subido_por: yo.id,
      notas: `${MARCA} ${ETIQUETA[p.fuente]} (${D.fuentes[p.fuente].archivo}), ${paginasTxt(p.paginas)}, recortada del PDF publicado. Precarga 2025 por IRStrat (${D.fecha}).`,
    }).select("id, version").single();
    if (ins.error) salir(`evidencia ${f.archivo}: ${ins.error.message}`);
    ev = ins.data;
    // El contenido ya viene transcrito con su página: la lectura con el modelo no se pide.
    const om = await admin.from("evidencias_contenido").update({ estado: "omitido", mensaje: `Precarga 2025 por IRStrat (${D.fecha}): la cifra o el texto vienen transcritos de ${ETIQUETA[p.fuente]}, ${paginasTxt(p.paginas)}; no se lee con el modelo.` }).eq("evidencia_id", ev.id).eq("estado", "pendiente");
    if (om.error) salir(`lectura de ${f.archivo}: ${om.error.message}`);
  }
  if (p.tipo === "cifra") {
    const c = await db.from("capturas_valor").insert({ solicitud_id: sol.id, evidencia_id: ev.id, valor: p.valor, unidad: p.unidad, periodo: String(EJERCICIO), capturado_por: yo.id, confirmado: true, justificacion: f.cita });
    if (c.error) salir(`captura ${f.orden}: ${c.error.message}`);
  } else {
    const cont = leer(await db.from("evidencias_contenido").select("id").eq("evidencia_id", ev.id).single(), "contenido");
    // Con la llave de servicio, como poblar-demo: `authenticated` no tiene INSERT en sugerencias_captura (la aplicación
    // las escribe la cola de lectura y las decide fn_decidir_sugerencia).
    const s = await admin.from("sugerencias_captura").insert({
      solicitud_id: sol.id, tenant_id: tenant.id, evidencia_id: ev.id, contenido_id: cont.id, evidencia_version: ev.version, tipo: "texto",
      estado: "confirmada", extracto: p.extracto, cita: `${ETIQUETA[p.fuente]}, ${paginasTxt(p.paginas)}`,
      fuente: { documento: D.fuentes[p.fuente].archivo, fragmentos: p.paginas.map((pagina) => ({ fuente: { tipo: "pagina", pagina } })) },
      confianza: "alta", prompt_version: "precarga-odonnell-2025", decidido_por: yo.id, decidido_en: new Date().toISOString(),
    });
    if (s.error) salir(`extracto ${f.orden}: ${s.error.message}`);
  }
  await log(tenant.id, "solicitudes", sol.id, { objeto: p.tipo === "cifra" ? "captura" : "extracto", orden: f.orden, titulo: sol.titulo, valor: p.valor ?? null, unidad: p.unidad ?? null, archivo: f.archivo, fuente: ETIQUETA[p.fuente], paginas: p.paginas });
  console.log(`  ✓ ${f.orden} ${corto(sol.titulo, 50)}: ${p.tipo === "cifra" ? `${p.valor} ${p.unidad}` : "extracto"} (${f.archivo})`);
}

// 5. Cuestionarios
for (const c of D.cuestionarios.filter((x) => cuestEstado(x) === "por escribir")) {
  const r = await db.from("cuestionarios_respuestas").insert({ reporte_id: reporte.id, hoja: c.hoja, pregunta_orden: c.orden, respuesta: c.respuesta, notas: `${MARCA} ${ETIQUETA.formato}, ${paginasTxt(c.paginas)}.` });
  if (r.error) salir(`cuestionario ${c.hoja} ${c.orden}: ${r.error.message}`);
  await log(tenant.id, "cuestionarios_respuestas", null, { objeto: "cuestionario", hoja: c.hoja, pregunta: c.orden, fuente: ETIQUETA.formato, paginas: c.paginas });
}
if (porEscribir.cuestionarios) console.log(`  ✓ Cuestionarios: ${porEscribir.cuestionarios} respuestas`);

console.log(`\n✓ Precarga aplicada (${total}). Segunda pasada sin --aplicar: «Por escribir: … (0 en total)».`);
