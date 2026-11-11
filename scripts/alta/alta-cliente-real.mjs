#!/usr/bin/env node
// =============================================================================
// ALTA DE UN CLIENTE REAL que antes fue mockup (encargo docs/encargos/2026-11-10-odonnell-alta-real.md, Fase 1).
// Primer uso: O'Donnell (ODOCK). Sirve igual para CLEPSA. Lo ejecuta una persona en staging (CLAUDE.md §1 y §9);
// Claude Code lo prueba solo en el stack local.
//
// Se corre desde la raíz del repositorio, con el entorno del destino y un archivo de datos que NO se versiona
// (lleva correos reales):
//
//   node --env-file=.env.staging.local scripts/alta/alta-cliente-real.mjs --destino staging \
//        --credenciales .credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json --datos ~/Downloads/odonnell-alta/datos.json \
//        --paso <tenant|reportes|verificar> [--aplicar]
//
// Pasos (cada uno revisa sin escribir; con --aplicar pide escribir el ref y escribe):
//   tenant     1. el mockup: slug y prefijo nuevos (p. ej. odonnell-demo / ODND) y activo = false; sin borrar nada;
//              2. el tenant real: es_demo = false, nombre, slug y prefijo del real, banderas y topes de los datos
//                 (vitrina apagada, lectura y generador según el contrato), áreas;
//              3. el Perfil: identidad, fideicomiso, forma de referencia y sector SASB (solo campos que existen en el
//                 destino; los demás los captura la emisora).
//              Entre «tenant» y «reportes», Esteban da de alta a los usuarios desde /admin/usuarios (invitación de un
//              solo uso; la persona fija su contraseña) y sube el logo desde /admin/clientes.
//   reportes   el reporte del año base desde la plantilla «con rubros», SIN escena (sin evidencias, capturas, fechas
//              ni estados que no sean «pendiente»), con responsables por área; y el reporte siguiente vacío. Año de
//              adopción y alivios de los datos.
//   verificar  solo lectura: todo lo anterior, con ✓/✗, más los usuarios esperados por área.
//
// Sesión del staff del seed (admin@irstrat.example), como el panel: RLS activo. Bitácora con los mismos eventos que
// las acciones del panel. Idempotente: lo que ya está como dicen los datos no se toca. No imprime contraseñas,
// llaves, URL de base ni correos (solo cuántos).
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { createRequire } from "node:module";

const req = createRequire(path.join(process.cwd(), "package.json"));
const { createClient } = req("@supabase/supabase-js");

const DESTINOS = {
  staging: { ref: "ewgnvjtjhvdltvkopptn", prueba: (u) => u.includes("ewgnvjtjhvdltvkopptn") },
  local: { ref: "local", prueba: (u) => /^http:\/\/(127\.0\.0\.1|localhost):54321/.test(u) },
};
const STAFF = "admin@irstrat.example";
const SCRIPT = "alta-cliente-real.mjs";
// Campos del Perfil que el guion escribe, si existen en el destino (los de fideicomiso llegan con v42).
const CAMPOS_PERFIL = ["denominacion_formal", "nombre_corto", "forma_de_referencia", "tipo_instrumento", "clave_cotizacion", "fiduciario", "numero_fideicomiso", "fideicomitente", "administrador_patrimonio", "sector_sasb"];
// Opciones de «Tipo de Instrumento» del Formato electrónico (fila 7 de la plantilla).
const INSTRUMENTOS = ["Acciones", "Deuda Largo Plazo", "Deuda Corto plazo", "Sociedad Anónima Promotora de Inversión Bursátil", "Fideicomisos sobre bienes distintos de acciones", "Certificados Bursátiles Fiduciarios de Desarrollo (CKD)", "Certificados Bursátiles Fiduciarios Inmobiliarios (CERPI)", "Certificados Bursátiles Fiduciarios de Proyectos de Inversión (FIBRA)", "Certificados Bursátiles Fiduciarios de Inversión en Energia e Infraestructura  (FIBRAE)"];

const argv = process.argv.slice(2);
const opcion = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
const destino = opcion("--destino");
const paso = opcion("--paso");
const aplicar = argv.includes("--aplicar");
const salir = (m) => { console.error(`✗ ${m}`); process.exit(2); };
const cfg = DESTINOS[destino];
if (!cfg || !["tenant", "reportes", "verificar"].includes(paso)) salir("Uso: --destino <staging|local> --datos <archivo> --paso <tenant|reportes|verificar> [--credenciales <archivo>] [--aplicar]");
if (paso === "verificar" && aplicar) salir("«verificar» es de solo lectura: sin --aplicar.");
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
if (!cfg.prueba(URL_SB) || (destino !== "staging" && URL_SB.includes(DESTINOS.staging.ref))) salir(`NEXT_PUBLIC_SUPABASE_URL no es la de ${destino}.`);
if (!ANON) salir("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.");

// --- Datos del cliente ------------------------------------------------------------------------------------------
const archivoDatos = opcion("--datos");
if (!archivoDatos || !fs.existsSync(archivoDatos)) salir("Falta --datos <archivo> (no se versiona: lleva correos reales).");
const D = JSON.parse(fs.readFileSync(archivoDatos, "utf8"));
const pendientes = JSON.stringify(D).match(/CONFIRMAR[^"]*/g) ?? [];
if (pendientes.length) salir(`El archivo de datos tiene ${pendientes.length} valor(es) por confirmar («CONFIRMAR»). Complétalos antes de correr.`);
for (const k of ["mockup", "tenant", "areas", "perfil", "plantilla", "mapa_areas", "responsables", "reportes", "usuarios"]) if (D[k] == null) salir(`Al archivo de datos le falta «${k}».`);
if (!INSTRUMENTOS.includes(D.perfil.tipo_instrumento)) salir(`tipo_instrumento no es una opción del Formato: ${D.perfil.tipo_instrumento}`);
if (D.tenant.slug !== D.mockup.slug && D.mockup.nuevo_slug == null) salir("Datos incoherentes: mockup y real.");
for (const a of Object.values(D.mapa_areas)) if (!D.areas.includes(a)) salir(`mapa_areas lleva «${a}», que no está en «areas».`);
for (const a of Object.keys(D.responsables)) if (!D.areas.includes(a)) salir(`responsables lleva «${a}», que no está en «areas».`);
for (const u of D.usuarios) if (u.area && !D.areas.includes(u.area)) salir(`Un usuario trae un área que no está en «areas» (${u.area}).`);

// --- Sesión ------------------------------------------------------------------------------------------------------
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
console.log(`Destino: ${destino} · sesión de ${STAFF} (rol ${yo.rol}) · paso «${paso}» · ${aplicar ? "APLICAR" : "revisar, sin escribir"}`);

const leer = (r, que) => { if (r.error) salir(`${que}: ${r.error.message}`); return r.data; };
const log = async (tenantId, accion, entidad, entidadId, detalle) => {
  const { error } = await db.rpc("fn_log_evento", { p_tenant_id: tenantId, p_usuario_id: yo.id, p_accion: accion, p_entidad: entidad, p_entidad_id: entidadId, p_detalle: { ...detalle, via: SCRIPT } });
  if (error) salir(`bitácora (${accion}): ${error.message}`);
};
const confirmar = async (que) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question(`\nEscribe el ref de ${destino} para ${que}: `)).trim();
  rl.close();
  if (r !== cfg.ref) salir("No coincide; no se escribió nada.");
};
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Estado actual ----------------------------------------------------------------------------------------------------
const COLS_TENANT = "id, nombre, slug, prefijo_folio, activo, es_demo, vitrina_habilitada, lectura_evidencias_activa, generador_activo, staff_puede_cargar, generaciones_mes_max, lecturas_mes_max";
const porSlug = async (slug) => leer(await db.from("tenants").select(COLS_TENANT).eq("slug", slug).maybeSingle(), "tenant");
const porPrefijo = async (p) => leer(await db.from("tenants").select("id, slug").eq("prefijo_folio", p).maybeSingle(), "tenant por prefijo");
const columnasPerfil = async () => {
  // Qué campos del Perfil existen en el destino (los de fideicomiso llegan con v42; los de efectos financieros, con v44).
  const r = await db.from("perfil_emisor").select(CAMPOS_PERFIL.join(", ")).limit(1);
  if (!r.error) return CAMPOS_PERFIL;
  return CAMPOS_PERFIL.filter((c) => !new RegExp(`\\b${c}\\b`).test(r.error.message));
};
const bandera = (t) => ({
  activo: true, es_demo: false,
  vitrina_habilitada: D.tenant.vitrina_habilitada, lectura_evidencias_activa: D.tenant.lectura_evidencias_activa,
  generador_activo: D.tenant.generador_activo, staff_puede_cargar: D.tenant.staff_puede_cargar,
  generaciones_mes_max: D.tenant.generaciones_mes_max, lecturas_mes_max: D.tenant.lecturas_mes_max,
  ...(t ? {} : {}),
});

// =================================================================================================================
// Paso «tenant»
// =================================================================================================================
async function pasoTenant() {
  // El mockup: por su slug nuevo (ya renombrado) o por el original solo si es de demostración. El slug original,
  // después del alta, es del tenant real.
  const renombrado = await porSlug(D.mockup.nuevo_slug);
  const original = await porSlug(D.mockup.slug);
  if (renombrado && !renombrado.es_demo) salir(`«${renombrado.slug}» existe y NO es de demostración: no es el mockup. No se toca.`);
  const mock = renombrado ?? (original?.es_demo ? original : null);
  const mockRenombrado = !!renombrado;
  console.log("\n1. Mockup");
  if (!mock) console.log(`  · no hay mockup «${D.mockup.slug}» de demostración ni «${D.mockup.nuevo_slug}»: nada que renombrar`);
  else if (mockRenombrado && !mock.activo) console.log(`  · ya renombrado y desactivado: ${mock.slug} / ${mock.prefijo_folio}`);
  else console.log(`  · ${mock.slug} / ${mock.prefijo_folio} · demo=${mock.es_demo} · activo=${mock.activo} → ${D.mockup.nuevo_slug} / ${D.mockup.nuevo_prefijo} · activo=false`);
  const choquePrefijoMock = await porPrefijo(D.mockup.nuevo_prefijo);
  if (choquePrefijoMock && choquePrefijoMock.id !== mock?.id) salir(`El prefijo ${D.mockup.nuevo_prefijo} ya lo usa «${choquePrefijoMock.slug}».`);

  console.log("\n2. Tenant real");
  const real = original && !original.es_demo ? original : null;
  const objetivo = { nombre: D.tenant.nombre, slug: D.tenant.slug, prefijo_folio: D.tenant.prefijo, ...bandera(true) };
  if (real) {
    if (real.es_demo) salir(`«${real.slug}» es de demostración: el real no puede reusarlo.`);
    const difs = Object.entries(objetivo).filter(([k, v]) => !igual(real[k], v)).map(([k]) => k);
    console.log(`  · ya existe «${real.slug}»${difs.length ? ` · por ajustar: ${difs.join(", ")}` : " · como dicen los datos"}`);
  } else console.log(`  · se crea «${D.tenant.slug}» / ${D.tenant.prefijo} · es_demo=false · vitrina=${D.tenant.vitrina_habilitada} · lectura=${D.tenant.lectura_evidencias_activa} · generador=${D.tenant.generador_activo} · carga por IRStrat=${D.tenant.staff_puede_cargar} · topes ${D.tenant.generaciones_mes_max}/${D.tenant.lecturas_mes_max}`);
  const areasYa = real ? leer(await db.from("areas_tenant").select("nombre").eq("tenant_id", real.id), "áreas").map((a) => a.nombre) : [];
  const areasNuevas = D.areas.filter((a) => !areasYa.includes(a));
  console.log(`  · áreas: ${D.areas.length} (${areasNuevas.length} por crear)`);

  console.log("\n3. Perfil");
  const cols = await columnasPerfil();
  const faltan = CAMPOS_PERFIL.filter((c) => !cols.includes(c));
  if (faltan.length) console.log(`  ⚠ el destino no tiene ${faltan.join(", ")}: esos campos se omiten`);
  const perfilYa = real ? leer(await db.from("perfil_emisor").select(cols.join(", ")).eq("tenant_id", real.id).maybeSingle(), "perfil") : null;
  const perfilObjetivo = Object.fromEntries(cols.filter((c) => D.perfil[c] !== undefined).map((c) => [c, D.perfil[c]]));
  const perfilDifs = Object.keys(perfilObjetivo).filter((k) => !igual(perfilYa?.[k], perfilObjetivo[k]));
  console.log(`  · ${Object.keys(perfilObjetivo).length} campos (${perfilDifs.length} por escribir): ${Object.keys(perfilObjetivo).join(", ")}`);

  const hayQueHacer = (mock && (!mockRenombrado || mock.activo)) || !real || areasNuevas.length || perfilDifs.length || (real && Object.entries(objetivo).some(([k, v]) => !igual(real[k], v)));
  if (!aplicar) { console.log(`\nRevisión terminada${hayQueHacer ? "" : ": nada que hacer"}. Nada se escribió.`); return; }
  if (!hayQueHacer) { console.log("\nNada que hacer: todo está como dicen los datos."); return; }
  await confirmar(`renombrar y desactivar el mockup y dar de alta «${D.tenant.slug}»`);

  if (mock && (!mockRenombrado || mock.activo)) {
    const r = await db.from("tenants").update({ slug: D.mockup.nuevo_slug, prefijo_folio: D.mockup.nuevo_prefijo, activo: false }).eq("id", mock.id);
    if (r.error) salir(`mockup: ${r.error.message}`);
    await log(mock.id, "tenant_desactivado", "tenants", mock.id, { nombre: mock.nombre, slug_anterior: mock.slug, slug: D.mockup.nuevo_slug, prefijo_anterior: mock.prefijo_folio, prefijo_folio: D.mockup.nuevo_prefijo, motivo: `El mockup se retira: ${D.tenant.nombre} pasa a cliente real; se conserva sin borrar.` });
    console.log(`  ✓ mockup → ${D.mockup.nuevo_slug} / ${D.mockup.nuevo_prefijo}, inactivo`);
  }
  let t = real ?? (await porSlug(D.tenant.slug));
  if (!t) {
    const r = await db.from("tenants").insert({ nombre: D.tenant.nombre, slug: D.tenant.slug, prefijo_folio: D.tenant.prefijo, activo: true }).select(COLS_TENANT).single();
    if (r.error) salir(`tenant real: ${r.error.message}`);
    t = r.data;
    await log(t.id, "tenant_creado", "tenants", t.id, { nombre: t.nombre, slug: t.slug, prefijo_folio: t.prefijo_folio, es_demo: false, motivo: "Alta de cliente real (antes mockup)." });
    console.log(`  ✓ tenant real «${t.slug}»`);
  }
  const ajustes = Object.fromEntries(Object.entries(objetivo).filter(([k, v]) => !igual(t[k], v) && !["slug", "prefijo_folio", "es_demo"].includes(k)));
  if (Object.keys(ajustes).length) {
    const r = await db.from("tenants").update(ajustes).eq("id", t.id);
    if (r.error) salir(`banderas: ${r.error.message}`);
    for (const [k, v] of Object.entries(ajustes)) {
      const accion = { generador_activo: v ? "tenant_generador_habilitado" : "tenant_generador_deshabilitado", lectura_evidencias_activa: v ? "tenant_lectura_evidencias_habilitada" : "tenant_lectura_evidencias_deshabilitada", staff_puede_cargar: v ? "tenant_carga_staff_habilitada" : "tenant_carga_staff_deshabilitada" }[k];
      if (accion) await log(t.id, accion, "tenants", t.id, { nombre: t.nombre, motivo: "Alta de cliente real: bandera según contrato." });
    }
    console.log(`  ✓ banderas y topes: ${Object.keys(ajustes).join(", ")}`);
  }
  if (areasNuevas.length) {
    const r = await db.from("areas_tenant").insert(areasNuevas.map((nombre) => ({ tenant_id: t.id, nombre, orden: D.areas.indexOf(nombre) })));
    if (r.error) salir(`áreas: ${r.error.message}`);
    for (const nombre of areasNuevas) await log(t.id, "area_creada", "areas_tenant", null, { nombre });
    console.log(`  ✓ ${areasNuevas.length} áreas`);
  }
  if (perfilDifs.length) {
    const fila = { tenant_id: t.id, ...perfilObjetivo, actualizado_por: yo.id, actualizado_en: new Date().toISOString() };
    const r = await db.from("perfil_emisor").upsert(fila, { onConflict: "tenant_id" });
    if (r.error) salir(`perfil: ${r.error.message}`);
    await log(t.id, "perfil_emisor_actualizado", "perfil_emisor", t.id, { seccion: "identidad", campos: perfilDifs });
    console.log(`  ✓ Perfil: ${perfilDifs.join(", ")}`);
  }
  console.log("\n✓ Paso «tenant» aplicado. Sigue: usuarios por invitación y logo desde el panel; después «--paso reportes».");
}

// =================================================================================================================
// Paso «reportes»
// =================================================================================================================
async function pasoReportes() {
  const t = await porSlug(D.tenant.slug);
  if (!t || t.es_demo) salir(`No existe el tenant real «${D.tenant.slug}»: corre antes «--paso tenant».`);
  const usuarios = leer(await db.from("perfiles_usuario").select("id, email, rol, area, activo").eq("tenant_id", t.id), "usuarios");
  const resp = new Map();
  for (const [area, correo] of Object.entries(D.responsables)) {
    const u = usuarios.find((x) => x.email?.toLowerCase() === correo.toLowerCase() && x.activo);
    if (!u) salir(`Falta dar de alta al responsable de «${area}» (correo de los datos) desde /admin/usuarios.`);
    if (u.area !== area) salir(`El responsable de «${area}» está dado de alta en otra área («${u.area}»).`);
    resp.set(area, u.id);
  }
  console.log(`Responsables: ${resp.size} de ${D.areas.length} áreas`);
  const plantillas = leer(await db.from("plantillas").select("id, nombre").eq("nombre", D.plantilla), "plantillas");
  if (plantillas.length !== 1) salir(`Se esperaba una plantilla «${D.plantilla}»; hay ${plantillas.length}.`);
  const items = leer(await db.from("plantilla_solicitudes").select("titulo, descripcion, area_asignada, es_cuantitativa, unidad_esperada, orden, datapoint_ids, rubro_taxonomia").eq("plantilla_id", plantillas[0].id).order("orden"), "renglones");
  const sinMapa = [...new Set(items.map((i) => i.area_asignada))].filter((a) => !D.mapa_areas[a]);
  if (sinMapa.length) salir(`La plantilla trae áreas que mapa_areas no traduce: ${sinMapa.join(", ")}`);
  const conRubro = items.filter((i) => i.rubro_taxonomia).length;
  console.log(`Plantilla «${D.plantilla}»: ${items.length} renglones, ${conRubro} con rubro`);

  const plan = [];
  for (const r of D.reportes) {
    const ya = leer(await db.from("reportes").select("id, nombre, ejercicio, anio_adopcion, alivios").eq("tenant_id", t.id).eq("ejercicio", r.ejercicio), "reportes");
    if (ya.length > 1) salir(`Hay ${ya.length} reportes ${r.ejercicio} de «${t.slug}»: revisa antes de seguir.`);
    plan.push({ r, ya: ya[0] ?? null });
    console.log(`  · ${r.ejercicio} «${r.nombre}» · adopción ${r.anio_adopcion} · alivios ${JSON.stringify(r.alivios)} · ${r.desde_plantilla ? `${items.length} solicitudes de la plantilla, sin escena` : "vacío"}${plan.at(-1).ya ? " · YA EXISTE, se salta" : ""}`);
  }
  const nuevos = plan.filter((p) => !p.ya);
  if (!aplicar) { console.log(`\nRevisión terminada: ${nuevos.length} reporte(s) por crear. Nada se escribió.`); return; }
  if (!nuevos.length) { console.log("\nNada que hacer: los reportes ya existen."); return; }
  await confirmar(`crear ${nuevos.length} reporte(s) de «${t.slug}»`);
  for (const { r } of nuevos) {
    const ins = await db.from("reportes").insert({ tenant_id: t.id, nombre: r.nombre, ejercicio: r.ejercicio, anio_adopcion: r.anio_adopcion, alivios: r.alivios, estado: "activo" }).select("id").single();
    if (ins.error) salir(`reporte ${r.ejercicio}: ${ins.error.message}`);
    const rid = ins.data.id;
    let n = 0;
    if (r.desde_plantilla) {
      for (const it of items) {
        const area = D.mapa_areas[it.area_asignada];
        const s = await db.from("solicitudes").insert({
          reporte_id: rid, titulo: it.titulo, descripcion: it.descripcion, area_asignada: area, es_cuantitativa: it.es_cuantitativa,
          unidad_esperada: it.unidad_esperada, orden: it.orden, rubro_taxonomia: it.rubro_taxonomia, responsable_cliente_id: resp.get(area) ?? null, origen: "irstrat",
        }).select("id").single();
        if (s.error) salir(`solicitud «${it.titulo.slice(0, 40)}»: ${s.error.message}. Borra el reporte ${r.ejercicio} incompleto desde el panel antes de reintentar.`);
        const dps = (it.datapoint_ids ?? []).filter(Boolean);
        if (dps.length) { const m = await db.from("mapeo_solicitud_datapoint").insert(dps.map((datapoint_id) => ({ solicitud_id: s.data.id, datapoint_id }))); if (m.error) salir(`mapeo: ${m.error.message}`); }
        const rec = await db.from("solicitudes_recordatorios").insert([7, 1].map((dias_antes) => ({ solicitud_id: s.data.id, dias_antes, activo: true })));
        if (rec.error) salir(`recordatorios: ${rec.error.message}`);
        n++;
      }
      await log(t.id, "reporte_creado_desde_plantilla", "reportes", rid, { nombre: r.nombre, ejercicio: r.ejercicio, plantilla: D.plantilla, plantilla_id: plantillas[0].id, solicitudes: n, fallidas: 0, anio_adopcion: r.anio_adopcion, alivios: r.alivios, sin_escena: true });
    } else {
      await log(t.id, "reporte_creado", "reportes", rid, { nombre: r.nombre, ejercicio: r.ejercicio, anio_adopcion: r.anio_adopcion, alivios: r.alivios, vacio: true });
    }
    console.log(`  ✓ ${r.ejercicio}: ${n} solicitudes`);
  }
  console.log("\n✓ Paso «reportes» aplicado. Sigue: «--paso verificar».");
}

// =================================================================================================================
// Paso «verificar» (solo lectura)
// =================================================================================================================
async function pasoVerificar() {
  console.log("\n1. Mockup");
  const mock = await porSlug(D.mockup.nuevo_slug);
  ok(!!mock && mock.es_demo && !mock.activo && mock.prefijo_folio === D.mockup.nuevo_prefijo, `«${D.mockup.nuevo_slug}» / ${D.mockup.nuevo_prefijo}, demo e inactivo, sin borrar`);
  if (mock) {
    const { count } = await db.from("reportes").select("id", { count: "exact", head: true }).eq("tenant_id", mock.id);
    ok((count ?? 0) > 0, `el mockup conserva sus reportes (${count})`);
  }
  console.log("\n2. Tenant real");
  const t = await porSlug(D.tenant.slug);
  ok(!!t && !t.es_demo && t.activo && t.prefijo_folio === D.tenant.prefijo && t.nombre === D.tenant.nombre, `«${D.tenant.slug}» / ${D.tenant.prefijo}: real (es_demo = false) y activo`);
  if (!t) { console.log(`\n✗ ${fallas.length} comprobación(es) en rojo.`); process.exit(1); }
  for (const [k, v] of Object.entries(bandera(true))) ok(igual(t[k], v), `${k} = ${JSON.stringify(v)}`);
  const areas = leer(await db.from("areas_tenant").select("nombre").eq("tenant_id", t.id), "áreas").map((a) => a.nombre);
  ok(D.areas.every((a) => areas.includes(a)) && areas.length === D.areas.length, `áreas: ${areas.length} de ${D.areas.length}`);
  console.log("\n3. Perfil");
  const cols = await columnasPerfil();
  const p = leer(await db.from("perfil_emisor").select(cols.join(", ")).eq("tenant_id", t.id).maybeSingle(), "perfil");
  for (const c of cols.filter((c) => D.perfil[c] !== undefined)) ok(igual(p?.[c], D.perfil[c]), `${c}`);
  // El Formato decide el bloque «Para: Fideicomisos» con /fideicomiso/ (lib/formato/llenar.ts): «Certificados Bursátiles
  // Fiduciarios de Desarrollo (CKD)» no lo contiene. Hasta corregir esa regla (encargo odonnell-alta-real, §0.12), aviso.
  if (/fiduciari/i.test(p?.tipo_instrumento ?? "") && !/fideicomiso/i.test(p?.tipo_instrumento ?? "")) {
    console.log("  ⚠ el Formato todavía no reconoce un CKD como fideicomiso (busca «fideicomiso»): K13–K21 saldrían «No aplica» hasta la corrección de llenar.ts");
  }
  console.log("\n4. Usuarios (alta por invitación desde el panel)");
  const us = leer(await db.from("perfiles_usuario").select("email, rol, area, activo").eq("tenant_id", t.id), "usuarios");
  const esperados = D.usuarios.map((u) => u.email.toLowerCase());
  const presentes = us.filter((u) => esperados.includes(u.email?.toLowerCase()));
  ok(presentes.length === esperados.length, `usuarios dados de alta: ${presentes.length} de ${esperados.length}`);
  ok(D.usuarios.every((u) => { const x = us.find((y) => y.email?.toLowerCase() === u.email.toLowerCase()); return x && x.rol === u.rol && (x.area ?? null) === (u.area ?? null); }), "cada uno con su rol y su área");
  ok(!us.some((u) => /\.example$/i.test(u.email ?? "")), "ninguna cuenta de dominio reservado (@…example) en el tenant real");
  console.log("\n5. Reportes");
  for (const r of D.reportes) {
    const rep = leer(await db.from("reportes").select("id, anio_adopcion, alivios").eq("tenant_id", t.id).eq("ejercicio", r.ejercicio).maybeSingle(), "reporte");
    ok(!!rep && rep.anio_adopcion === r.anio_adopcion && igual(rep.alivios ?? {}, r.alivios), `${r.ejercicio}: adopción ${r.anio_adopcion}, alivios ${JSON.stringify(r.alivios)}`);
    if (!rep) continue;
    const sols = leer(await db.from("solicitudes").select("id, estado, area_asignada, responsable_cliente_id, fecha_limite").eq("reporte_id", rep.id), "solicitudes");
    if (r.desde_plantilla) {
      const ids = sols.map((s) => s.id);
      const [{ count: ev }, { count: cap }] = ids.length ? await Promise.all([
        db.from("evidencias").select("id", { count: "exact", head: true }).in("solicitud_id", ids),
        db.from("capturas_valor").select("id", { count: "exact", head: true }).in("solicitud_id", ids),
      ]) : [{ count: 0 }, { count: 0 }];
      ok(sols.length > 0 && sols.every((s) => s.estado === "pendiente" && !s.fecha_limite), `${r.ejercicio}: ${sols.length} solicitudes, todas «pendiente» y sin fecha límite (sin escena)`);
      ok((ev ?? 0) === 0 && (cap ?? 0) === 0, `${r.ejercicio}: sin evidencias ni capturas`);
      ok(sols.every((s) => D.areas.includes(s.area_asignada)), `${r.ejercicio}: todas en áreas del cliente`);
      ok(sols.every((s) => s.responsable_cliente_id || !D.responsables[s.area_asignada]), `${r.ejercicio}: responsables asignados por área`);
    } else ok(sols.length === 0, `${r.ejercicio}: vacío`);
  }
  console.log(fallas.length ? `\n✗ ${fallas.length} comprobación(es) en rojo.` : "\n✓ Alta verificada.");
  process.exit(fallas.length ? 1 : 0);
}

if (paso === "tenant") await pasoTenant();
else if (paso === "reportes") await pasoReportes();
else await pasoVerificar();
