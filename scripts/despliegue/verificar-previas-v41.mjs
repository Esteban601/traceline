#!/usr/bin/env node
// =============================================================================
// VERIFICACIONES PREVIAS SOBRE STAGING PARA v41 (encargo
// 2026-10-14-excel-formato-a-produccion, Paso 2). SOLO LECTURA.
//
//   (set -a; source .env.staging.local; set +a; \
//    node --experimental-strip-types --import <rama>/scripts/captura-sugerida/node/registrar.mjs \
//      <rama>/scripts/despliegue/verificar-previas-v41.mjs [carpeta])
//   desde la copia del repositorio que tiene .env.staging.local y .credenciales-demo.
//
// Usa SOLO la sesión del analista de IRStrat (contraseña de .credenciales-demo,
// que no se imprime): ningún insert, update ni delete, y en Storage solo
// listados. Con [carpeta] escribe ahí previas.json (línea base de incisos y
// enlaces por emisora; va a referencia/, que no se versiona).
//
//   (a) Banderas y topes por emisora.
//   (b) Documentos aprobados por emisora y las respuestas que se pedirían con la
//       propuesta de §2.3 (Empresa Demo y mockups con aprobado; Carso nada). Al
//       desplegar no se genera ninguna.
//   (c) CHECK y NOT NULL de las 5 migraciones: todos caen sobre columnas nuevas o
//       sobre la tabla nueva, así que ningún dato existente los viola SI esas
//       columnas y la tabla no existen ya (con «if not exists» se conservarían
//       con lo que tuvieran). Se comprueba que no existen.
//   (d) Perfil por emisora: si tiene fila, y los campos nuevos (no existen aún:
//       nacen vacíos).
//   (e) Bucket y ruta de la plantilla del Formato: si el bucket existe y si ya
//       hay un objeto en la ruta.
//   (f) Incisos del catálogo y enlaces a ellos, por emisora (v41 no los toca:
//       deben quedar iguales después).
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PADRE_DE } from "../../lib/suplemento/catalogo-incisos.ts";
import { RUTA_PLANTILLA_FORMATO } from "../../lib/formato/plantilla.ts";

const REF_STAGING = "ewgnvjtjhvdltvkopptn";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!URL_SB.includes(REF_STAGING)) { console.error("✗ Este script solo corre contra staging (cárgalo con .env.staging.local en subshell)."); process.exit(2); }
const CARSO = "gcarso";
const carpeta = process.argv[2] ?? null;
// Medido en dev con el documento v3 del demo (14/10/2026): 112 de taxonomía + 72 del Formato, ~$0.45–0.50.
const FILAS_POR_DOCUMENTO = 184;
const COSTO_POR_DOCUMENTO = 0.5;
const NUEVAS = {
  perfil_emisor: ["clave_cotizacion", "tipo_instrumento", "fiduciario", "numero_fideicomiso", "hechos_posteriores", "actividades_financieras", "sector_sasb", "metricas_industria"],
  registros_clima: ["metricas_asociadas"],
  objetivos: ["origen_objetivo"],
  documentos_generados: ["respuestas_estado", "respuestas_resultado", "respuestas_actualizado_en"],
};

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
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };
const tipo = (t) => (t.slug === CARSO ? "REAL" : t.es_demo ? "demo" : "mock");

const tenants = await todas(() => db.from("tenants").select("id, slug, nombre, es_demo, activo, vitrina_habilitada, generador_activo, generaciones_mes_max, lectura_evidencias_activa, lecturas_mes_max").order("slug"));
const carso = tenants.find((t) => t.slug === CARSO);
const reportes = await todas(() => db.from("reportes").select("id, tenant_id"));
const tenantDeReporte = new Map(reportes.map((r) => [r.id, r.tenant_id]));
console.log(`Staging: ${tenants.length} emisoras (${tenants.filter((t) => t.es_demo).length} con es_demo), ${reportes.length} reportes.`);

// ---------------------------------------------------------------- (a)
console.log("\n(a) Banderas y topes por emisora");
for (const t of tenants) {
  console.log(`  ${t.slug.padEnd(26)} ${tipo(t)} ${t.activo ? "     " : "INACT"} · vitrina ${t.vitrina_habilitada ? "on " : "off"} · generador ${t.generador_activo ? "on " : "off"} (${t.generaciones_mes_max}/mes) · lectura ${t.lectura_evidencias_activa ? "on " : "off"} (${t.lecturas_mes_max}/mes)`);
}
ok(!!carso && !carso.es_demo && !carso.vitrina_habilitada && !carso.generador_activo && !carso.lectura_evidencias_activa, "Grupo Carso: vitrina, generador y lectura apagados");

// ---------------------------------------------------------------- (b)
console.log("\n(b) Documentos aprobados por emisora y respuestas que se pedirían (propuesta §2.3)");
const docs = await todas(() => db.from("documentos_generados").select("id, tenant_id, reporte_id, estado, version, aprobado_en"));
const aprobados = docs.filter((d) => d.estado === "aprobado");
let docsPropuesta = 0;
for (const t of tenants) {
  const suyos = docs.filter((d) => d.tenant_id === t.id);
  const ap = aprobados.filter((d) => d.tenant_id === t.id).sort((a, b) => b.version - a.version);
  if (!suyos.length) continue;
  const entra = ap.length > 0 && t.slug !== CARSO && t.generador_activo;
  if (entra) docsPropuesta++;
  const motivo = !ap.length ? "sin aprobado" : t.slug === CARSO ? "Carso: nada" : !t.generador_activo ? "generador apagado: nada" : `pedir respuestas del v${ap[0].version} (${ap[0].id.slice(0, 8)})`;
  console.log(`  ${t.slug.padEnd(26)} ${tipo(t)} · documentos ${suyos.length} · aprobados ${ap.length}${ap.length ? ` (último v${ap[0].version}, ${(ap[0].aprobado_en ?? "sin fecha").slice(0, 10)})` : ""} → ${motivo}`);
}
console.log(`  Emisoras sin ningún documento: ${tenants.filter((t) => !docs.some((d) => d.tenant_id === t.id)).map((t) => t.slug).join(", ") || "ninguna"}.`);
console.log(`  Al desplegar: 0 respuestas (solo nacen al aprobar o con POST …/respuestas).`);
console.log(`  Con la propuesta: ${docsPropuesta} documento(s) → ~${docsPropuesta * FILAS_POR_DOCUMENTO} filas, ~$${(docsPropuesta * COSTO_POR_DOCUMENTO).toFixed(2)}.`);
ok(!carso || !aprobados.some((d) => d.tenant_id === carso.id) || !carso.generador_activo, "Grupo Carso: ninguna respuesta posible (generador apagado)");

// ---------------------------------------------------------------- (c)
console.log("\n(c) CHECK y NOT NULL de las 5 migraciones: las columnas y la tabla nuevas no existen todavía");
for (const [tabla, cols] of Object.entries(NUEVAS)) {
  for (const c of cols) {
    const { error } = await db.from(tabla).select(c).limit(1);
    // 42703: la columna no existe (PostgREST la reporta así o como PGRST204/«column … does not exist»).
    const noExiste = !!error && (error.code === "42703" || /does not exist|Could not find/i.test(error.message));
    ok(noExiste, `${tabla}.${c}: ${noExiste ? "no existe" : error ? `error inesperado (${error.code})` : "YA EXISTE"}`);
  }
}
{
  const { error } = await db.from("respuestas_datapoint").select("id").limit(1);
  const noExiste = !!error && (error.code === "PGRST205" || error.code === "42P01" || /does not exist|Could not find/i.test(error.message));
  ok(noExiste, `tabla respuestas_datapoint: ${noExiste ? "no existe" : error ? `error inesperado (${error.code})` : "YA EXISTE"}`);
}
console.log("    Con eso, los CHECK nuevos (respuestas_estado, metricas_industria, metricas_asociadas, origen_objetivo) caen sobre");
console.log("    columnas que nacen en null, y los NOT NULL, sobre una tabla vacía: ningún dato existente puede violarlos.");

// ---------------------------------------------------------------- (d)
console.log("\n(d) Perfil del emisor por emisora (los 8 campos nuevos nacen vacíos en todas)");
const perfiles = await todas(() => db.from("perfil_emisor").select("tenant_id, denominacion_formal"));
for (const t of tenants) {
  const p = perfiles.find((x) => x.tenant_id === t.id);
  console.log(`  ${t.slug.padEnd(26)} ${tipo(t)} · ${p ? `Perfil sí · denominación formal ${p.denominacion_formal ? "sí" : "VACÍA"}` : "SIN Perfil"} · campos nuevos: vacíos (8 de 8)`);
}

// ---------------------------------------------------------------- (e)
console.log("\n(e) Bucket y ruta de la plantilla del Formato");
const carpetaPl = RUTA_PLANTILLA_FORMATO.slice(0, RUTA_PLANTILLA_FORMATO.lastIndexOf("/"));
const nombrePl = RUTA_PLANTILLA_FORMATO.slice(carpetaPl.length + 1);
const raiz = await db.storage.from("documentos").list("", { limit: 1000 });
ok(!raiz.error, `bucket «documentos»: ${raiz.error ? raiz.error.message : `existe y se lista (${raiz.data.length} entradas en la raíz)`}`);
const plantillas = await db.storage.from("documentos").list("plantillas", { limit: 1000 });
console.log(`    documentos/plantillas/: ${plantillas.error ? plantillas.error.message : plantillas.data.length ? plantillas.data.map((o) => o.name).join(", ") : "vacía (no existe)"}`);
const enRuta = await db.storage.from("documentos").list(carpetaPl, { limit: 1000 });
const yaEsta = (enRuta.data ?? []).some((o) => o.name === nombrePl);
ok(!enRuta.error && !yaEsta, `documentos/${RUTA_PLANTILLA_FORMATO}: ${enRuta.error ? enRuta.error.message : yaEsta ? "YA EXISTE un objeto" : "no existe (se sube en el paso 4 del guion)"}`);

// ---------------------------------------------------------------- (f)
console.log("\n(f) Incisos del catálogo y enlaces (v41 no los toca)");
const catalogo = await todas(() => db.from("datapoints_taxonomia").select("id, codigo, activo"));
const codigosIncisos = Object.keys(PADRE_DE);
const codigosPadres = [...new Set(Object.values(PADRE_DE))];
const porCodigo = new Map(catalogo.map((d) => [d.codigo.trim(), d]));
const incisos = codigosIncisos.map((c) => porCodigo.get(c)).filter(Boolean);
const padres = codigosPadres.map((c) => porCodigo.get(c)).filter(Boolean);
ok(incisos.length === 18 && incisos.every((d) => d.activo), `incisos en el catálogo: ${incisos.length} de 18, activos ${incisos.filter((d) => d.activo).length}`);
ok(padres.length === 4 && padres.every((d) => d.activo), `códigos padre: ${padres.length} de 4, activos ${padres.filter((d) => d.activo).length}`);
console.log(`    catálogo: ${catalogo.length} códigos, ${catalogo.filter((d) => d.activo).length} activos`);
const idsIncisos = incisos.map((d) => d.id), idsPadres = padres.map((d) => d.id);
const enlacesIncisos = await todas(() => db.from("mapeo_solicitud_datapoint").select("solicitud_id, datapoint_id").in("datapoint_id", idsIncisos));
const enlacesPadres = await todas(() => db.from("mapeo_solicitud_datapoint").select("solicitud_id, datapoint_id").in("datapoint_id", idsPadres));
const { count: enlacesTotal } = await db.from("mapeo_solicitud_datapoint").select("*", { count: "exact", head: true });
const sols = await todas(() => db.from("solicitudes").select("id, reporte_id").in("id", [...new Set([...enlacesIncisos, ...enlacesPadres].map((e) => e.solicitud_id))]));
const tenantDeSol = new Map(sols.map((s) => [s.id, tenantDeReporte.get(s.reporte_id)]));
const porEmisora = {};
for (const t of tenants) {
  const ni = enlacesIncisos.filter((e) => tenantDeSol.get(e.solicitud_id) === t.id).length;
  const np = enlacesPadres.filter((e) => tenantDeSol.get(e.solicitud_id) === t.id).length;
  porEmisora[t.slug] = { incisos: ni, padres: np };
  if (ni || np) console.log(`  ${t.slug.padEnd(26)} ${tipo(t)} · enlaces a incisos ${String(ni).padStart(3)} · a padres ${String(np).padStart(3)}`);
}
console.log(`    total: ${enlacesIncisos.length} enlaces a incisos, ${enlacesPadres.length} a padres, ${enlacesTotal} en mapeo_solicitud_datapoint`);
if (carpeta) {
  fs.mkdirSync(carpeta, { recursive: true });
  const destino = path.join(carpeta, "previas.json");
  fs.writeFileSync(destino, JSON.stringify({ incisos: incisos.length, padres: padres.length, catalogo: catalogo.length, enlacesIncisos: enlacesIncisos.length, enlacesPadres: enlacesPadres.length, enlacesTotal, porEmisora }, null, 1));
  console.log(`    línea base → ${destino}`);
}

await db.auth.signOut();
console.log(fallas.length ? `\n✗ ${fallas.length} falla(s)` : "\n✓ Todo verde.");
process.exit(fallas.length ? 1 : 0);
