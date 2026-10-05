#!/usr/bin/env node
// =============================================================================
// VERIFICACIONES PREVIAS SOBRE STAGING PARA v33 (encargo
// 2026-10-05-generador-a-produccion, Paso 2). SOLO LECTURA.
//
//   (set -a; source .env.staging.local; set +a; node <rama>/scripts/despliegue/verificar-previas-v33.mjs)
//   desde la copia del repositorio que tiene .env.staging.local y .credenciales-demo.
//
// Usa la sesión del analista de IRStrat (contraseña de .credenciales-demo, que
// no se imprime) para todo, y la llave de servicio SOLO para comprobar que
// service_role puede LEER las tablas que la aplicación le pide (head + count;
// ningún insert, update ni delete). No imprime nombres de archivo ni rutas.
//
//   (a) Evidencias de más de 25 MB: conteo y tamaño mayor por emisora.
//   (b) Filas que tocaría 20261005130000_catalogo_repunte_riesgos_fisicos, por
//       emisora, y el detalle de las de Grupo Carso.
//   (c) Datos que chocarían con las migraciones de datos del lote: renombres de
//       códigos del catálogo (clave única codigo + versión), códigos nuevos,
//       renombres de hojas de mapeo_export y la corrección de la plantilla.
//   (d) Banderas por emisora hoy y las que tomarán al desplegar.
//   (e) Lectura por service_role de las tablas que la aplicación le pide.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const REF_STAGING = "ewgnvjtjhvdltvkopptn";
// Las migraciones se leen junto al script (su rama), no del directorio desde el que se corre:
// se corre desde la copia que tiene .env.staging.local y .credenciales-demo.
const MIGRACIONES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations");
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!URL_SB.includes(REF_STAGING)) { console.error("✗ Este script solo corre contra staging (cárgalo con .env.staging.local en subshell)."); process.exit(2); }
const LIMITE = 25 * 1024 * 1024;
const CARSO = "gcarso";

const pw = JSON.parse(fs.readFileSync(".credenciales-demo/seed-ewgnvjtjhvdltvkopptn.json", "utf8"))["analista@irstrat.example"].password;
const db = createClient(URL_SB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "analista@irstrat.example", password: pw });
if (eLogin) { console.error(`✗ login: ${eLogin.message}`); process.exit(2); }

const todas = async (consulta) => {
  const fuera = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta().range(desde, desde + 999);
    if (error) throw new Error(error.message);
    fuera.push(...data);
    if (data.length < 1000) return fuera;
  }
};

const { data: tenants } = await db.from("tenants").select("id, slug, nombre, es_demo, activo, vitrina_habilitada").order("slug");
const slug = new Map(tenants.map((t) => [t.id, t.slug]));
const reportes = await todas(() => db.from("reportes").select("id, tenant_id, nombre, ejercicio"));
const tenantDeReporte = new Map(reportes.map((r) => [r.id, r.tenant_id]));

// ---------------------------------------------------------------- (a)
console.log("\n(a) Evidencias de más de 25 MB");
const evs = await todas(() => db.from("evidencias").select("archivo_path"));
const carpetas = new Map();
for (const e of evs) {
  const i = e.archivo_path.lastIndexOf("/");
  const c = e.archivo_path.slice(0, i);
  if (!carpetas.has(c)) carpetas.set(c, new Set());
  carpetas.get(c).add(e.archivo_path.slice(i + 1));
}
const porTenant = new Map();
let medidas = 0, sinTamano = 0, mayorGlobal = 0;
const sinObjeto = new Map(); // evidencias registradas cuyo archivo no aparece en storage, por emisora
for (const [carpeta, nombres] of carpetas) {
  const { data } = await db.storage.from("evidencias").list(carpeta, { limit: 1000 });
  const presentes = new Set((data ?? []).map((o) => o.name));
  const faltan = [...nombres].filter((n) => !presentes.has(n)).length;
  if (faltan) sinObjeto.set(carpeta.split("/")[0], (sinObjeto.get(carpeta.split("/")[0]) ?? 0) + faltan);
  for (const o of data ?? []) {
    if (!nombres.has(o.name)) continue;
    const b = o.metadata?.size;
    if (typeof b !== "number") { sinTamano++; continue; }
    medidas++;
    mayorGlobal = Math.max(mayorGlobal, b);
    const t = carpeta.split("/")[0];
    const acc = porTenant.get(t) ?? { mayores: 0, mayor: 0 };
    if (b > LIMITE) acc.mayores++;
    acc.mayor = Math.max(acc.mayor, b);
    porTenant.set(t, acc);
  }
}
console.log(`  evidencias registradas: ${evs.length} · objetos medidos: ${medidas} · sin tamaño en storage: ${sinTamano}`);
const exceden = [...porTenant].filter(([, v]) => v.mayores > 0);
console.log(exceden.length ? exceden.map(([t, v]) => `  ✗ ${slug.get(t) ?? t}: ${v.mayores} de más de 25 MB · mayor ${(v.mayor / 1048576).toFixed(1)} MB`).join("\n") : "  ✓ ninguna emisora tiene evidencias de más de 25 MB");
console.log(`  mayor de todo staging: ${(mayorGlobal / 1048576).toFixed(2)} MB`);
const totalSinObjeto = [...sinObjeto.values()].reduce((a, b) => a + b, 0);
console.log(`  registradas sin archivo en storage: ${totalSinObjeto}${totalSinObjeto ? " · " + [...sinObjeto].map(([t, n]) => `${slug.get(t) ?? t} ${n}`).join(", ") : ""}`);

// ---------------------------------------------------------------- (b)
console.log("\n(b) Repunte de «Riesgos físicos climáticos en instalaciones» (20261005130000)");
const VIEJOS = ["NIIF S2 29 (b) B64 y B65 inciso (a)", "NIIF S2 29 (b)"];
const { data: dpViejos } = await db.from("datapoints_taxonomia").select("id, codigo, version_taxonomia").in("codigo", VIEJOS);
const { data: dpNuevo } = await db.from("datapoints_taxonomia").select("id").eq("codigo", "NIIF S2 29 (c)").eq("version_taxonomia", "2025");
console.log(`  código viejo en el catálogo de staging: ${dpViejos.map((d) => `«${d.codigo}» (${d.version_taxonomia})`).join(", ") || "ninguno"} · «NIIF S2 29 (c)»: ${dpNuevo.length ? "ya existe" : "no existe todavía (lo inserta 20261005120700)"}`);
const viejos2025 = dpViejos.filter((d) => d.version_taxonomia === "2025").map((d) => d.id);
const sols = await todas(() => db.from("solicitudes").select("id, titulo, reporte_id, area_asignada, estado").eq("titulo", "Riesgos físicos climáticos en instalaciones"));
const mapeos = viejos2025.length && sols.length
  ? await todas(() => db.from("mapeo_solicitud_datapoint").select("solicitud_id, datapoint_id").in("datapoint_id", viejos2025).in("solicitud_id", sols.map((s) => s.id)))
  : [];
const porEmisora = new Map();
for (const m of mapeos) {
  const s = sols.find((x) => x.id === m.solicitud_id);
  const t = slug.get(tenantDeReporte.get(s.reporte_id)) ?? "?";
  porEmisora.set(t, (porEmisora.get(t) ?? 0) + 1);
}
console.log(`  solicitudes con ese título: ${sols.length} · enlaces que se repuntarían: ${mapeos.length} (cada uno: se inserta el de 29(c) y se borra el de 29(b))`);
for (const [t, n] of [...porEmisora].sort()) console.log(`    ${t}: ${n}`);
const deCarso = mapeos.filter((m) => slug.get(tenantDeReporte.get(sols.find((x) => x.id === m.solicitud_id).reporte_id)) === CARSO);
if (deCarso.length) {
  console.log(`  ⚠ Grupo Carso: ${deCarso.length} fila(s), una por una:`);
  for (const m of deCarso) {
    const s = sols.find((x) => x.id === m.solicitud_id);
    const r = reportes.find((x) => x.id === s.reporte_id);
    const { count: nEv } = await db.from("evidencias").select("id", { count: "exact", head: true }).eq("solicitud_id", s.id);
    const { count: nCap } = await db.from("capturas_valor").select("id", { count: "exact", head: true }).eq("solicitud_id", s.id);
    const cod = dpViejos.find((d) => d.id === m.datapoint_id)?.codigo;
    console.log(`    · solicitud ${s.id} · «${s.titulo}» · ${r?.nombre} ${r?.ejercicio} · área ${s.area_asignada ?? "—"} · estado ${s.estado} · evidencias ${nEv} · capturas ${nCap} · «${cod}» → «NIIF S2 29 (c)»`);
  }
} else {
  console.log("  ✓ ninguna fila es de Grupo Carso");
}

// ---------------------------------------------------------------- (c)
console.log("\n(c) Datos que chocarían con las migraciones de datos del lote");
const ren = fs.readFileSync(path.join(MIGRACIONES, "20261005121000_catalogo_codigos_malformados.sql"), "utf8");
const pares = [...ren.matchAll(/set codigo = '([^']+)'\s*\n\s*where codigo = '([^']+)'/g)].map((m) => ({ nuevo: m[1], viejo: m[2] }));
const { data: cat } = await db.from("datapoints_taxonomia").select("codigo, version_taxonomia");
const existe = (c) => cat.filter((d) => d.codigo === c).map((d) => d.version_taxonomia);
let choques = 0;
for (const p of pares) {
  const vs = existe(p.viejo), ns = existe(p.nuevo);
  const choque = vs.filter((v) => ns.includes(v));
  if (choque.length) { choques++; console.log(`  ✗ renombre «${p.viejo}» → «${p.nuevo}» chocaría en versión ${choque.join(", ")}`); }
}
console.log(`  renombres de códigos (20261005121000): ${pares.length} · con el código viejo presente: ${pares.filter((p) => existe(p.viejo).length).length} · choques con un código nuevo ya existente: ${choques}`);
const cor = fs.readFileSync(path.join(MIGRACIONES, "20261005120700_catalogo_niif_correcciones.sql"), "utf8");
const iIns = cor.indexOf("insert into public.datapoints_taxonomia");
const insertados = [...cor.slice(iIns, cor.indexOf("on conflict", iIns)).matchAll(/^\s*\('((?:[^']|'')*)'/gm)].map((m) => m[1].replace(/''/g, "'"));
console.log(`  códigos nuevos (20261005120700): ${insertados.length} · ya presentes en staging: ${insertados.filter((c) => existe(c).length).length} (ON CONFLICT DO NOTHING: no fallan)`);
const actualizados = [...cor.matchAll(/where codigo = '([^']+)'/g)].map((m) => m[1]);
console.log(`  descripciones corregidas: ${actualizados.length} · cuyo código no existe en staging (el UPDATE no haría nada): ${actualizados.filter((c) => !existe(c).length).length}`);
const me = await todas(() => db.from("mapeo_export").select("hoja"));
const hojas = (h) => me.filter((x) => x.hoja === h).length;
console.log(`  mapeo_export: ${me.length} filas · «Fondo I» ${hojas("Fondo I")} · «NIIF S2 29(b)» ${hojas("NIIF S2 29(b)")} · «NIIF S2 30» ${hojas("NIIF S2 30")} · «NIIF S2 29(c)» ${hojas("NIIF S2 29(c)")} · «Taxonomía NIIF S1 S2» ${hojas("Taxonomía NIIF S1 S2")}`);
const { count: plantillas } = await db.from("plantilla_solicitudes").select("id", { count: "exact", head: true });
console.log(`  plantilla_solicitudes: ${plantillas} filas (la corrección quita el id equivocado y agrega el correcto solo si falta)`);

// ---------------------------------------------------------------- (d)
console.log("\n(d) Banderas por emisora: hoy → al desplegar");
const { error: eCol } = await db.from("tenants").select("lectura_evidencias_activa").limit(1);
const { error: eCol2 } = await db.from("tenants").select("generador_activo").limit(1);
console.log(`  columnas: lectura_evidencias_activa ${eCol ? "no existe todavía" : "YA EXISTE"} · generador_activo ${eCol2 ? "no existe todavía" : "YA EXISTE"}`);
console.log("  emisora · es_demo · vitrina hoy → vitrina | generador | lectura (tope gen/mes, lecturas/mes)");
for (const t of tenants) {
  const vit = t.es_demo ? t.vitrina_habilitada : false;
  console.log(`  ${t.slug.padEnd(24)} ${t.es_demo ? "demo " : "REAL "} ${t.vitrina_habilitada ? "on " : "off"} → ${vit ? "on " : "off"} | ${t.es_demo ? "on " : "off"} | ${t.es_demo ? "on " : "off"} (10, 500)${t.activo ? "" : " · inactiva"}`);
}

// ---------------------------------------------------------------- (e)
console.log("\n(e) Lectura por service_role de las tablas que la aplicación le pide (head + count, sin escribir)");
const svc = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
for (const tabla of ["tenants", "solicitudes", "reportes", "mapeo_solicitud_datapoint", "datapoints_taxonomia", "evidencias", "capturas_valor", "bitacora", "perfiles_usuario", "areas_tenant", "invitaciones", "auditor_actividad", "comentarios"]) {
  const { count, error } = await svc.from(tabla).select("*", { count: "exact", head: true });
  console.log(`  ${error ? "✗" : "✓"} ${tabla.padEnd(28)} ${error ? error.message : `lee (${count} filas)`}`);
}
const { error: eSt } = await svc.storage.from("evidencias").list("", { limit: 1 });
console.log(`  ${eSt ? "✗" : "✓"} storage evidencias (list)        ${eSt ? eSt.message : "lee"}`);
await db.auth.signOut();
