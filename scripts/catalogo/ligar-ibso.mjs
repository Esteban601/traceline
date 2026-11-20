#!/usr/bin/env node
// =============================================================================
// LIGA LOS INDICADORES IBSO (NIS A-1) A LAS SOLICITUDES, por título exacto (encargo
// docs/encargos/2026-11-17-catalogo-ibso.md, Fase 1; decisión 1 de Esteban del 17/11/2026). Correspondencia en
// scripts/catalogo/datos/ibso-correspondencia.json. Se corre DESPUÉS de las migraciones del catálogo IBSO.
//
//   conjunto «plantilla» (por omisión): los renglones de toda plantilla con esos títulos (los reportes nuevos nacen
//     ligados) y las solicitudes que ya existen con esos títulos en todos los reportes de todas las emisoras;
//   conjunto «fondo-de-fondos»: las nueve solicitudes de demostración (políticas de Fondo de Fondos), solo en el
//     reporte 2025 de un mockup: Empresa Demo por omisión, u otro con --tenant <slug> (el mockup «fondo-de-fondos»,
//     decisión de Esteban del 19/11/2026; sus nueve las crea solicitudes-demo-rh.mjs con el mismo --tenant).
//
//   staging (lo corre Esteban; CLAUDE.md §1 y §9):
//     node --env-file=.env.staging.local scripts/catalogo/ligar-ibso.mjs --destino staging \
//          --credenciales .credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json [--conjunto fondo-de-fondos [--tenant <slug>]] [--aplicar]
//   dev:   node --env-file=<.env.local de dev> scripts/catalogo/ligar-ibso.mjs --destino dev [--aplicar]
//   local: node --env-file=<entorno local> scripts/catalogo/ligar-ibso.mjs --destino local [--aplicar]
//
// Solo AGREGA enlaces (`plantilla_solicitudes.datapoint_ids` y `mapeo_solicitud_datapoint`): nunca quita uno. Una fila
// «solicitud_editada» por solicitud en la bitácora, con los códigos agregados. Idempotente: si no falta ninguno, no
// escribe nada. Sesión de staff del seed, como el panel (RLS). No imprime contraseñas, llaves ni URL de base.
// Las funciones `planIbso` y `aplicarIbso` las usa también poblar-demo (--solo ibso), con su propio cliente.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const VERSION_TAXONOMIA = "2025";
export const REPORTE_DEMO = "20000000-0000-0000-0000-000000000001";

/** Título → códigos IBSO («IBSO A.1»), de los conjuntos pedidos del JSON de correspondencia. */
export function correspondencia(conjuntos) {
  const datos = JSON.parse(fs.readFileSync(path.join(AQUI, "datos/ibso-correspondencia.json"), "utf8"));
  const m = new Map();
  for (const c of conjuntos) {
    if (!datos[c]) throw new Error(`No hay conjunto «${c}» en ibso-correspondencia.json.`);
    for (const [titulo, claves] of Object.entries(datos[c])) m.set(titulo, [...new Set([...(m.get(titulo) ?? []), ...claves.map((k) => `IBSO ${k}`)])]);
  }
  return m;
}

const leer = (r, que) => { if (r.error) throw new Error(`${que}: ${r.error.message}`); return r.data; };
const trozos = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/**
 * Lo que falta ligar. `plantillas`: también los renglones de plantilla. `reporte`: solo las solicitudes de ese reporte
 * (sin él, las de todos los reportes visibles para el cliente de base de datos que se pase).
 */
export async function planIbso(db, { conjuntos, plantillas = true, reporte = null }) {
  const mapa = correspondencia(conjuntos);
  const titulos = [...mapa.keys()];
  const cat = leer(await db.from("datapoints_taxonomia").select("id, codigo").eq("marco", "NIS").eq("activo", true).eq("version_taxonomia", VERSION_TAXONOMIA), "catálogo IBSO");
  const idDe = new Map(cat.map((d) => [d.codigo, d.id]));
  const faltanEnCatalogo = [...new Set([...mapa.values()].flat())].filter((c) => !idDe.has(c));
  if (faltanEnCatalogo.length) throw new Error(`El catálogo no tiene ${faltanEnCatalogo.join(", ")}: las migraciones de IBSO no están aplicadas.`);
  const ibsoIds = new Set(cat.map((d) => d.id));

  const renglones = [];
  if (plantillas) {
    const rs = leer(await db.from("plantilla_solicitudes").select("id, titulo, datapoint_ids, plantilla:plantillas(nombre)").in("titulo", titulos), "plantillas");
    for (const r of rs) {
      const faltan = mapa.get(r.titulo).filter((c) => !(r.datapoint_ids ?? []).includes(idDe.get(c)));
      renglones.push({ id: r.id, plantilla: r.plantilla?.nombre ?? "?", titulo: r.titulo, datapoint_ids: r.datapoint_ids ?? [], faltan });
    }
  }

  const sols = [];
  for (let desde = 0; ; desde += 1000) {
    let q = db.from("solicitudes").select("id, titulo, reporte_id, reporte:reportes!inner(tenant_id, ejercicio, tenant:tenants!reportes_tenant_id_fkey(nombre))").in("titulo", titulos).order("id").range(desde, desde + 999);
    if (reporte) q = q.eq("reporte_id", reporte);
    const pag = leer(await q, "solicitudes");
    sols.push(...pag);
    if (pag.length < 1000) break;
  }
  const yaLigados = new Set();
  for (const t of trozos(sols.map((s) => s.id), 200)) {
    const ms = leer(await db.from("mapeo_solicitud_datapoint").select("solicitud_id, datapoint_id").in("solicitud_id", t), "enlaces");
    for (const m of ms) if (ibsoIds.has(m.datapoint_id)) yaLigados.add(`${m.solicitud_id}|${m.datapoint_id}`);
  }
  const solicitudes = sols.map((s) => ({
    id: s.id, titulo: s.titulo, tenantId: s.reporte.tenant_id, tenant: s.reporte.tenant?.nombre ?? "?", ejercicio: s.reporte.ejercicio,
    faltan: mapa.get(s.titulo).filter((c) => !yaLigados.has(`${s.id}|${idDe.get(c)}`)),
  }));
  return { idDe, renglones, solicitudes, titulos: titulos.length };
}

/** Escribe lo que falta. `registrar(tenantId, solicitudId, detalle)`: bitácora (opcional). */
export async function aplicarIbso(db, plan, { registrar } = {}) {
  let renglones = 0, enlaces = 0;
  for (const r of plan.renglones.filter((x) => x.faltan.length)) {
    const ids = [...r.datapoint_ids, ...r.faltan.map((c) => plan.idDe.get(c))];
    leer(await db.from("plantilla_solicitudes").update({ datapoint_ids: ids }).eq("id", r.id).select("id"), `plantilla «${r.titulo}»`);
    renglones++;
  }
  for (const s of plan.solicitudes.filter((x) => x.faltan.length)) {
    leer(await db.from("mapeo_solicitud_datapoint").upsert(s.faltan.map((c) => ({ solicitud_id: s.id, datapoint_id: plan.idDe.get(c) })), { onConflict: "solicitud_id,datapoint_id", ignoreDuplicates: true }), `enlaces de «${s.titulo}»`);
    enlaces += s.faltan.length;
    if (registrar) await registrar(s.tenantId, s.id, { titulo: s.titulo, codigos_agregados: s.faltan, motivo: "Indicadores IBSO (NIS A-1) ligados a la solicitud por su título." });
  }
  return { renglones, enlaces };
}

/** Resumen legible del plan, por plantilla y por emisora. */
export function imprimirPlan(plan, log = console.log) {
  if (plan.renglones.length) {
    log("Plantillas:");
    const porPlantilla = new Map();
    for (const r of plan.renglones) porPlantilla.set(r.plantilla, [...(porPlantilla.get(r.plantilla) ?? []), r]);
    for (const [p, rs] of porPlantilla) log(`  · ${p}: ${rs.length} renglones con IBSO, ${rs.reduce((a, r) => a + r.faltan.length, 0)} enlaces por agregar`);
  }
  log("Solicitudes por emisora:");
  const porTenant = new Map();
  for (const s of plan.solicitudes) porTenant.set(s.tenant, [...(porTenant.get(s.tenant) ?? []), s]);
  for (const [t, ss] of [...porTenant].sort((a, b) => a[0].localeCompare(b[0], "es"))) log(`  · ${t}: ${ss.length} solicitudes, ${ss.reduce((a, s) => a + s.faltan.length, 0)} enlaces por agregar`);
  const total = plan.renglones.reduce((a, r) => a + r.faltan.length, 0) + plan.solicitudes.reduce((a, s) => a + s.faltan.length, 0);
  log(`Por agregar: ${plan.renglones.reduce((a, r) => a + r.faltan.length, 0)} en plantillas y ${plan.solicitudes.reduce((a, s) => a + s.faltan.length, 0)} enlaces de solicitudes (${plan.solicitudes.filter((s) => s.faltan.length).length} solicitudes, ${porTenant.size} emisoras).`);
  return total;
}

// --- CLI ------------------------------------------------------------------------------------------------------------------
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { createRequire } = await import("node:module");
  const req = createRequire(path.join(process.cwd(), "package.json"));
  const { createClient } = req("@supabase/supabase-js");
  const DESTINOS = {
    staging: { ref: "ewgnvjtjhvdltvkopptn", prueba: (u) => u.includes("ewgnvjtjhvdltvkopptn") },
    dev: { ref: "kmjkoxecxcujxixlxwlb", prueba: (u) => u.includes("kmjkoxecxcujxixlxwlb") },
    local: { ref: "local", prueba: (u) => /^http:\/\/(127\.0\.0\.1|localhost):54321/.test(u) },
  };
  const STAFF = "admin@irstrat.example";
  const argv = process.argv.slice(2);
  const opcion = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
  const salir = (m) => { console.error(`✗ ${m}`); process.exit(2); };
  const destino = opcion("--destino");
  const conjunto = opcion("--conjunto") ?? "plantilla";
  const slugTenant = opcion("--tenant");
  const aplicar = argv.includes("--aplicar");
  const cfg = DESTINOS[destino];
  if (!cfg || !["plantilla", "fondo-de-fondos"].includes(conjunto)) salir("Uso: --destino <staging|dev|local> [--conjunto plantilla|fondo-de-fondos [--tenant <slug>]] [--credenciales <archivo>] [--aplicar]");
  if (slugTenant && conjunto !== "fondo-de-fondos") salir("--tenant solo va con --conjunto fondo-de-fondos.");
  const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!cfg.prueba(URL_SB) || Object.entries(DESTINOS).some(([k, d]) => k !== destino && k !== "local" && URL_SB.includes(d.ref))) salir(`NEXT_PUBLIC_SUPABASE_URL no es la de ${destino}.`);

  let db, staffId;
  if (destino === "dev") {
    const { sesionStaffDev } = await import(path.join(AQUI, "../formato/sesion-dev.mjs"));
    ({ db } = await sesionStaffDev());
  } else {
    let password;
    if (destino === "staging") {
      const credArch = opcion("--credenciales");
      if (!credArch) salir("En staging hace falta --credenciales (contraseña del staff del seed).");
      password = JSON.parse(fs.readFileSync(credArch, "utf8"))[STAFF]?.password;
    } else password = fs.readFileSync(path.join(process.cwd(), "supabase/seed.sql"), "utf8").match(/crypt\('([^']+)'/)?.[1];
    if (!password) salir(`No se encontró la contraseña de ${STAFF}.`);
    db = createClient(URL_SB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email: STAFF, password });
    if (error) salir(`No se pudo abrir la sesión de ${STAFF}.`);
  }
  const { data: u } = await db.auth.getUser();
  const { data: yo } = await db.from("perfiles_usuario").select("id, rol, tenant_id").eq("id", u?.user?.id ?? "").maybeSingle();
  if (!yo || yo.tenant_id !== null) salir(`${STAFF} no es staff en ${destino}.`);
  staffId = yo.id;
  console.log(`Destino: ${destino} · sesión de ${STAFF} (rol ${yo.rol}) · conjunto «${conjunto}» · ${aplicar ? "APLICAR" : "revisar, sin escribir"}`);

  // Reporte del conjunto «fondo-de-fondos»: el de Empresa Demo, o el 2025 del mockup de --tenant.
  let reporteFdf = REPORTE_DEMO, nombreFdf = "Empresa Demo";
  if (slugTenant) {
    const { data: t, error: eT } = await db.from("tenants").select("id, nombre, es_demo, activo").eq("slug", slugTenant).maybeSingle();
    if (eT || !t) salir(`No hay tenant con slug «${slugTenant}».`);
    if (!t.es_demo) salir(`«${slugTenant}» no es de demostración: el conjunto «fondo-de-fondos» es solo para mockups.`);
    const { data: rs, error: eR } = await db.from("reportes").select("id").eq("tenant_id", t.id).eq("ejercicio", 2025);
    if (eR || (rs ?? []).length !== 1) salir(`Se esperaba un reporte 2025 de ${t.nombre}; hay ${(rs ?? []).length}.`);
    reporteFdf = rs[0].id;
    nombreFdf = t.nombre;
    console.log(`Mockup: ${t.nombre} (${slugTenant}) · ${t.activo ? "activo" : "INACTIVO"} · reporte 2025`);
  }
  const pedir = () => (conjunto === "plantilla" ? { conjuntos: ["plantilla"], plantillas: true } : { conjuntos: ["fondo-de-fondos"], plantillas: false, reporte: reporteFdf });
  let plan;
  try {
    plan = await planIbso(db, pedir());
  } catch (e) { salir(e.message); }
  if (conjunto === "fondo-de-fondos") {
    for (const s of plan.solicitudes) console.log(`  ${s.faltan.length ? "→" : "✓"} ${s.titulo} · ${s.faltan.length ? `agrega ${s.faltan.join(", ")}` : "ya ligada"}`);
    if (plan.solicitudes.length !== plan.titulos) console.log(`  ⚠ ${plan.titulos - plan.solicitudes.length} de las ${plan.titulos} no están en el reporte de ${nombreFdf}`);
  }
  const total = imprimirPlan(plan);
  if (!aplicar) { console.log(`Revisión terminada: ${total} enlaces por agregar. Nada se escribió.`); process.exit(0); }
  if (!total) { console.log("Nada que hacer: todo está ligado."); process.exit(0); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question(`\nEscribe el ref de ${destino} para agregar ${total} enlaces: `)).trim();
  rl.close();
  if (r !== cfg.ref) salir("No coincide; no se escribió nada.");
  const hecho = await aplicarIbso(db, plan, {
    registrar: async (tenantId, solicitudId, detalle) => {
      const { error } = await db.rpc("fn_log_evento", { p_tenant_id: tenantId, p_usuario_id: staffId, p_accion: "solicitud_editada", p_entidad: "solicitudes", p_entidad_id: solicitudId, p_detalle: { ...detalle, via: "ligar-ibso.mjs", demostracion: conjunto === "fondo-de-fondos" } });
      if (error) throw new Error(`bitácora: ${error.message}`);
    },
  });
  const despues = await planIbso(db, pedir());
  const restante = despues.renglones.reduce((a, x) => a + x.faltan.length, 0) + despues.solicitudes.reduce((a, x) => a + x.faltan.length, 0);
  console.log(`✓ ${hecho.renglones} renglones de plantilla y ${hecho.enlaces} enlaces de solicitudes agregados; por agregar ahora: ${restante}.`);
  if (restante) process.exit(1);
}
