#!/usr/bin/env node
// =============================================================================
// VERIFICACIONES PREVIAS SOBRE STAGING PARA v40 (encargo
// 2026-10-11-suplemento-a-produccion, Paso 2). SOLO LECTURA.
//
//   (set -a; source .env.staging.local; set +a; node <rama>/scripts/despliegue/verificar-previas-v40.mjs [carpeta])
//   desde la copia del repositorio que tiene .env.staging.local y .credenciales-demo.
//
// Usa SOLO la sesión del analista de IRStrat (contraseña de .credenciales-demo,
// que no se imprime): ningún insert, update ni delete. Con [carpeta] escribe ahí
// carso-enlaces.json con el detalle de Grupo Carso (va a referencia/, que no se
// versiona: son datos de una emisora real).
//
//   (a) Enlaces que escribiría 20261007170000_catalogo_incisos, por emisora, y la
//       plantilla global; Grupo Carso aparte, con el detalle de sus filas
//       (solicitud y código agrupado → incisos).
//   (b) Datos que violarían un CHECK o un NOT NULL de las 18 migraciones de v40
//       sobre tablas que ya existen, y las precondiciones de la del catálogo.
//   (c) Banderas y topes por emisora.
//   (d) Lo que rellenan 150000 (lectura de adjuntos) y 170000 (versión 1 de
//       cada bloque), por emisora.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const REF_STAGING = "ewgnvjtjhvdltvkopptn";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!URL_SB.includes(REF_STAGING)) { console.error("✗ Este script solo corre contra staging (cárgalo con .env.staging.local en subshell)."); process.exit(2); }
const CARSO = "gcarso";
const carpeta = process.argv[2] ?? null;
// Los cuatro códigos agrupados y sus incisos, copiados de la migración 20261007170000.
const INCISOS = {
  "NIIF S2 25 (a)(i)a(v)": ["NIIF S2 25 (a)(i)", "NIIF S2 25 (a)(ii)", "NIIF S2 25 (a)(iii)", "NIIF S2 25 (a)(iv)", "NIIF S2 25 (a)(v)"],
  "NIIF S1 44 (a)(i)a(v)": ["NIIF S1 44 (a)(i)", "NIIF S1 44 (a)(ii)", "NIIF S1 44 (a)(iii)", "NIIF S1 44 (a)(iv)", "NIIF S1 44 (a)(v)"],
  "NIIF S2 36 (a)a(d)": ["NIIF S2 36 (a)", "NIIF S2 36 (b)", "NIIF S2 36 (c)", "NIIF S2 36 (d)"],
  "NIIF S2 36 (e)(i)a(iv)": ["NIIF S2 36 (e)(i)", "NIIF S2 36 (e)(ii)", "NIIF S2 36 (e)(iii)", "NIIF S2 36 (e)(iv)"],
};
const ESTADOS_BLOQUE = ["en_cola", "generando", "no_aplica", "no_seleccionado", "pendiente_adjunto", "error", "borrador", "en_revision", "aprobado"];

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

const tenants = await todas(() => db.from("tenants").select("id, slug, nombre, es_demo, activo, vitrina_habilitada, generador_activo, generaciones_mes_max, lectura_evidencias_activa, lecturas_mes_max").order("slug"));
const tenantPorId = new Map(tenants.map((t) => [t.id, t]));
const carso = tenants.find((t) => t.slug === CARSO);
const reportes = await todas(() => db.from("reportes").select("id, tenant_id"));
const tenantDeReporte = new Map(reportes.map((r) => [r.id, r.tenant_id]));
console.log(`Staging: ${tenants.length} emisoras (${tenants.filter((t) => t.es_demo).length} de demostración), ${reportes.length} reportes.`);

// ---------------------------------------------------------------- (a)
console.log("\n(a) Enlaces que escribiría la migración del catálogo (20261007170000)");
const catalogo = await todas(() => db.from("datapoints_taxonomia").select("id, codigo, version_taxonomia, activo"));
const porCodigo = new Map(catalogo.map((d) => [d.codigo, d]));
const agrupados = Object.keys(INCISOS).map((c) => porCodigo.get(c)).filter(Boolean);
const idAgrupado = new Map(agrupados.map((d) => [d.id, d.codigo]));
const enlaces = await todas(() => db.from("mapeo_solicitud_datapoint").select("solicitud_id, datapoint_id").in("datapoint_id", [...idAgrupado.keys()]));
const solicitudes = enlaces.length
  ? await todas(() => db.from("solicitudes").select("id, reporte_id, titulo, rubro_taxonomia").in("id", [...new Set(enlaces.map((e) => e.solicitud_id))]))
  : [];
const solPorId = new Map(solicitudes.map((s) => [s.id, s]));
const porEmisora = new Map();
const detalleCarso = [];
for (const e of enlaces) {
  const s = solPorId.get(e.solicitud_id);
  const t = tenantPorId.get(tenantDeReporte.get(s?.reporte_id));
  const codigo = idAgrupado.get(e.datapoint_id);
  const n = INCISOS[codigo].length;
  const fila = porEmisora.get(t?.slug ?? "?") ?? { demo: t?.es_demo, agrupados: 0, escribiria: 0, solicitudes: new Set() };
  fila.agrupados++;
  fila.escribiria += n;
  fila.solicitudes.add(e.solicitud_id);
  porEmisora.set(t?.slug ?? "?", fila);
  if (t?.slug === CARSO) detalleCarso.push({ solicitud_id: s.id, titulo: s.titulo, agrupado: codigo, incisos: INCISOS[codigo] });
}
for (const [slug, f] of [...porEmisora].sort((a, b) => Number(a[1].demo) - Number(b[1].demo) || a[0].localeCompare(b[0]))) {
  console.log(`  ${slug.padEnd(26)} ${f.demo ? "demo" : "REAL"} · ${String(f.solicitudes.size).padStart(2)} solicitudes · ${String(f.agrupados).padStart(2)} enlaces agrupados → ${String(f.escribiria).padStart(3)} enlaces nuevos a incisos`);
}
const total = [...porEmisora.values()].reduce((a, f) => a + f.escribiria, 0);
console.log(`  Total: ${enlaces.length} enlaces agrupados en ${porEmisora.size} emisoras → ${total} enlaces nuevos.`);
const plantillas = await todas(() => db.from("plantilla_solicitudes").select("id, titulo, datapoint_ids"));
const tocadas = plantillas.filter((p) => (p.datapoint_ids ?? []).some((id) => idAgrupado.has(id)));
const agregados = tocadas.reduce((a, p) => a + (p.datapoint_ids ?? []).filter((id) => idAgrupado.has(id)).reduce((x, id) => x + INCISOS[idAgrupado.get(id)].length, 0), 0);
console.log(`  Plantilla global: ${tocadas.length} filas de plantilla_solicitudes con un código agrupado → ${agregados} ids de incisos agregados.`);

console.log(`\n  Grupo Carso (${carso ? carso.nombre : "no encontrado"}): ${detalleCarso.length} enlaces agrupados → ${detalleCarso.reduce((a, d) => a + d.incisos.length, 0)} enlaces nuevos`);
for (const d of detalleCarso.sort((a, b) => a.titulo.localeCompare(b.titulo) || a.agrupado.localeCompare(b.agrupado))) {
  console.log(`    · «${d.titulo}» · ${d.agrupado} → ${d.incisos.length} incisos (${d.incisos.map((c) => c.replace(/^NIIF S[12] \d+ /, "")).join(", ")})`);
}
if (carpeta) {
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(path.join(carpeta, "carso-enlaces.json"), JSON.stringify(detalleCarso, null, 1));
  console.log(`  detalle de Carso → ${path.join(carpeta, "carso-enlaces.json")}`);
}

// ---------------------------------------------------------------- (b)
console.log("\n(b) Datos existentes frente a los CHECK y NOT NULL de las 18 migraciones");
const faltanAgrupados = Object.keys(INCISOS).filter((c) => !porCodigo.has(c));
ok(faltanAgrupados.length === 0, `los 4 códigos agrupados existen en el catálogo de staging${faltanAgrupados.length ? `; faltan: ${faltanAgrupados.join(", ")}` : ""} (sin ellos la migración no inserta nada y no avisa)`);
const versiones = new Set(agrupados.map((d) => d.version_taxonomia));
console.log(`    versión de taxonomía de los agrupados: ${[...versiones].join(", ")}`);
const yaIncisos = Object.values(INCISOS).flat().filter((c) => porCodigo.has(c));
ok(yaIncisos.length === 0, `ninguno de los 18 incisos existe todavía (${yaIncisos.length}); si existiera, ON CONFLICT lo salta`);

const bloques = await todas(() => db.from("documentos_bloques").select("documento_id, numero, estado, texto"));
const fueraDeCheck = bloques.filter((b) => !ESTADOS_BLOQUE.includes(b.estado));
ok(fueraDeCheck.length === 0, `documentos_bloques: ${bloques.length} filas; ${fueraDeCheck.length} con un estado fuera del CHECK nuevo de 20261006140000${fueraDeCheck.length ? ` (${[...new Set(fueraDeCheck.map((b) => b.estado))].join(", ")})` : ""}`);

const adjuntos = await todas(() => db.from("perfil_emisor_adjuntos").select("id, tenant_id, seccion, archivo_path, nombre_original"));
const conNulos = adjuntos.filter((a) => a.seccion == null || a.archivo_path == null || a.nombre_original == null);
ok(conNulos.length === 0, `perfil_emisor_adjuntos: ${adjuntos.length} filas; ${conNulos.length} con seccion, archivo_path o nombre_original nulos (el relleno de 20261006150000 los copia a columnas NOT NULL)`);
console.log("    Columnas nuevas sobre tablas existentes: todas nullable o con default (editoriales_incluidos, textos_literales,");
console.log("    texto_del_emisor default false, origen_texto, restaurada_de, versiones_aprobadas, cobertura, libro_id, anclas,");
console.log("    glosario default '[]', cierre_*). Los demás CHECK caen sobre tablas que nacen en el lote (hechos, libros_hechos).");

// ---------------------------------------------------------------- (c)
console.log("\n(c) Banderas y topes por emisora");
for (const t of tenants) {
  console.log(`  ${t.slug.padEnd(26)} ${t.es_demo ? "demo" : "REAL"} · ${t.activo ? "activa  " : "inactiva"} · vitrina ${t.vitrina_habilitada ? "on " : "off"} · generador ${t.generador_activo ? "on " : "off"} (${t.generaciones_mes_max}/mes) · lectura ${t.lectura_evidencias_activa ? "on " : "off"} (${t.lecturas_mes_max}/mes)`);
}
ok(!!carso && !carso.es_demo && !carso.vitrina_habilitada && !carso.generador_activo && !carso.lectura_evidencias_activa, "Grupo Carso: vitrina, generador y lectura apagados");
const realesEncendidas = tenants.filter((t) => !t.es_demo && (t.generador_activo || t.lectura_evidencias_activa));
ok(realesEncendidas.length === 0, `emisoras reales con generador o lectura encendidos: ${realesEncendidas.length}`);

// ---------------------------------------------------------------- (d)
console.log("\n(d) Lo que rellenan las migraciones, por emisora");
const docs = await todas(() => db.from("documentos_generados").select("id, tenant_id"));
const tenantDeDoc = new Map(docs.map((d) => [d.id, d.tenant_id]));
const cuenta = (filas, tenantDe) => filas.reduce((m, f) => { const s = tenantPorId.get(tenantDe(f))?.slug ?? "?"; m.set(s, (m.get(s) ?? 0) + 1); return m; }, new Map());
const adjPorTenant = cuenta(adjuntos, (a) => a.tenant_id);
const versPorTenant = cuenta(bloques.filter((b) => b.texto != null), (b) => tenantDeDoc.get(b.documento_id));
for (const t of tenants) {
  const a = adjPorTenant.get(t.slug) ?? 0, v = versPorTenant.get(t.slug) ?? 0;
  if (a || v) console.log(`  ${t.slug.padEnd(26)} adjuntos a la cola: ${a} (${t.lectura_evidencias_activa ? "pendiente" : "omitido"}) · versiones 1 de bloques: ${v}`);
}
console.log(`  Grupo Carso: ${adjPorTenant.get(CARSO) ?? 0} adjuntos (quedarían «omitido»), ${versPorTenant.get(CARSO) ?? 0} versiones de bloques.`);

await db.auth.signOut();
console.log(fallas.length ? `\n✗ ${fallas.length} falla(s)` : "\n✓ Sin bloqueos para migrar.");
process.exit(fallas.length ? 1 : 0);
