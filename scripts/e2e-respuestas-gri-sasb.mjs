#!/usr/bin/env node
// =============================================================================
// E2E · respuestas GRI y SASB (encargo 2026-10-31-catalogo-gri-sasb, Fase 2a). Costo 0: la app de la rama corre
// SIN llave del modelo (ANTHROPIC_API_KEY=), así que lo que va por sección sale del respaldo con oraciones ancladas y
// lo que va por evidencia directa queda pendiente.
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-respuestas-gri-sasb.mjs [baseUrl]          (por omisión http://localhost:3016)
//
// SOLO contra el stack local. Documento, libro, hechos y solicitudes de prueba de Empresa Demo; se borran al terminar.
//   1. Aprobado un documento con los bloques 15 (gobierno) y 7 (materialidad), y la emisora con sector FN-CB:
//      · GRI 2-9 sale de la sección 15 y GRI 3-2 de la 7 (tabla FUENTE_GRI_SASB), con respuesta propia y SIN
//        remisión «Ver sección»;
//      · FN-CB-240a.4 sale de la captura confirmada de su solicitud cuantitativa;
//      · FN-CB-230a.2, con un extracto confirmado y sin modelo: pendiente, con el marcador que nombra la solicitud;
//      · GRI 2-7, sin fuente ni solicitud: pendiente «sin solicitud en el reporte ni sección del suplemento»;
//      · las 17 de FN-CB tienen fila; las NIIF siguen todas.
//   2. Libro GRI/SASB: las respuestas en su columna; el pendiente en texto plano.
//   3. Formato: hoja «Métricas SASB» con Código / Métrica / Respuesta, 17 métricas; la captura con respuesta y el
//      pendiente vacío.
//   4. Sin sector SASB y regeneradas las respuestas: ninguna fila SASB; GRI igual.
// =============================================================================
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";

const BASE = process.argv[2] || "http://localhost:3016";
if (!/127\.0\.0\.1|localhost/.test(BASE)) { console.error("✗ Solo contra una app local."); process.exit(2); }
const URL_SB = "http://127.0.0.1:54321";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const SECTOR = "[815200] Finanzas - Bancos comerciales (FN-CB)";
const CLAVE = fs.readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8").match(/crypt\('([^']+)'/)[1];
const psql = (sql, replica = false) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atq", "-c", `${replica ? "set session_replication_role = replica; " : ""}${sql}`], { env: { ...process.env, PGPASSWORD: "postgres" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const lit = (v) => (v === null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };
const t = (v) => (v == null ? "" : typeof v === "object" ? (v.richText ? v.richText.map((x) => x.text).join("") : v.text ?? String(v.result ?? "")) : String(v));
const id = (sql) => psql(sql).split("\n")[0];

const jar = new Map();
const sb = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
if ((await sb.auth.signInWithPassword({ email: "admin@irstrat.example", password: CLAVE })).error) { console.error("✗ login staff"); process.exit(2); }
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
const bajar = async (ruta) => { const r = await fetch(`${BASE}${ruta}`, { headers: { cookie: cookie() } }); return r.ok ? Buffer.from(await r.arrayBuffer()) : null; };
const resp = (doc, clave) => {
  const f = psql(`select estado || '¦' || origen || '¦' || coalesce(bloque::text, '') || '¦' || coalesce(texto, '') from respuestas_datapoint where documento_id=${lit(doc)} and destino='taxonomia' and clave=${lit(clave)}`);
  const [estado, origen, bloque, texto] = f.split("¦");
  return { estado, origen, bloque, texto };
};

if (psql(`select count(*) from respuestas_datapoint where reporte_id=${lit(REPORTE)}`) !== "0") { console.error("✗ El reporte ya tiene respuestas en local; la prueba necesita partir de cero."); process.exit(2); }
const inicio = psql("select now()");
const tenantAntes = psql(`select generador_activo || '|' || generaciones_mes_max from tenants where id=${lit(TENANT)}`);
const perfilAntes = psql(`select coalesce(json_build_object('s', sector_sasb)::text, '') from perfil_emisor where tenant_id=${lit(TENANT)}`);
psql(`update tenants set generador_activo = true, generaciones_mes_max = 100 where id=${lit(TENANT)}`);
const ponerSector = (arr) => {
  if (psql(`select count(*) from perfil_emisor where tenant_id=${lit(TENANT)}`) === "0") psql(`insert into perfil_emisor (tenant_id) values (${lit(TENANT)})`);
  psql(`update perfil_emisor set sector_sasb = ${arr ? `array[${arr.map(lit).join(",")}]::text[]` : "null"} where tenant_id=${lit(TENANT)}`);
};
ponerSector([SECTOR]);

let LIBRO = null, DOC = null, SOL_CAP = { s: null }, SOL_TXT = { s: null };
const nav = await chromium.launch();
try {
// --- Libro, hechos y documento ------------------------------------------------------------------
LIBRO = id(`insert into libros_hechos (tenant_id, reporte_id, estado) values (${lit(TENANT)}, ${lit(REPORTE)}, 'listo') returning id`);
const hecho = (clave, enunciado, bloque) => id(`insert into hechos (tenant_id, libro_id, clave, enunciado, extracto, tipo, rango_fuente, fuente_tipo, fuente_id, fuente_detalle, verificado, estado, bloque_dueno) values (${lit(TENANT)}, ${lit(LIBRO)}, ${lit(clave)}, ${lit(enunciado)}, ${lit(enunciado)}, 'otro', 'validado', 'extracto', 'e2e', 'Extracto de prueba', true, 'vigente', ${bloque}) returning id`);
const H15 = hecho("consejo.integracion", "El Consejo de Administración está integrado por once consejeros, cinco de ellos independientes.", 15);
const H7 = hecho("materialidad.temas", "La Compañía determinó cinco temas materiales mediante su proceso de materialidad.", 7);
const v = Number(psql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id=${lit(REPORTE)}`));
DOC = id(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos) values (${lit(TENANT)}, ${lit(REPORTE)}, ${v}, 'borrador', '{7}') returning id`);
const bloque = (n, clave, titulo, seccion, oracion, h, codigo) => {
  const cobertura = codigo ? [{ codigo, estado: "cubierto", bloque: null, hechos: [h], comentario: "" }] : [];
  const anclas = [{ oracion, hechos: [{ id: "h1", hecho: h, fuente: "Extracto de prueba" }] }];
  psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado, texto, origen_texto, fuentes, pendientes, generado_en, libro_id, cobertura, anclas) values (${lit(DOC)}, ${n}, ${lit(clave)}, ${lit(titulo)}, ${lit(seccion)}, 'es', 'borrador', ${lit(oracion)}, 'generacion', '[]', '[]', now(), ${lit(LIBRO)}, ${lit(JSON.stringify(cobertura))}::jsonb, ${lit(JSON.stringify(anclas))}::jsonb)`);
};
bloque(15, "roles_organo", "Roles y responsabilidades del órgano de gobierno", "II · Gobernanza", "El Consejo de Administración está integrado por once consejeros, cinco de ellos independientes.", H15, "NIIF S2 6 (a)");
bloque(7, "materialidad", "Materialidad: contexto y proceso", "I · Introducción", "La Compañía determinó cinco temas materiales mediante su proceso de materialidad.", H7, null);

// --- Solicitudes de prueba: captura (FN-CB-240a.4) y extracto confirmado (FN-CB-230a.2) ------------------------
const STAFF = psql(`select id from perfiles_usuario where email='admin@irstrat.example'`);
const dp = (c) => psql(`select id from datapoints_taxonomia where codigo=${lit(c)} and activo`);
const solicitud = (titulo, cuant, unidad, codigo) => {
  const s = id(`insert into solicitudes (reporte_id, titulo, area_asignada, es_cuantitativa, unidad_esperada, origen, estado, orden) values (${lit(REPORTE)}, ${lit(titulo)}, 'RH', ${cuant}, ${lit(unidad)}, 'irstrat', 'pendiente', 99990) returning id`);
  psql(`insert into mapeo_solicitud_datapoint (solicitud_id, datapoint_id) values (${lit(s)}, ${lit(dp(codigo))})`);
  const ev = id(`insert into evidencias (solicitud_id, version, archivo_path, nombre_original, subido_por) values (${lit(s)}, 1, ${lit(`${TENANT}/${s}/e2e.pdf`)}, 'e2e.pdf', ${lit(STAFF)}) returning id`);
  return { s, ev };
};
SOL_CAP = solicitud("[e2e-gri-sasb] Participantes en educación financiera 2025", true, "participantes", "FN-CB-240a.4");
psql(`insert into capturas_valor (solicitud_id, evidencia_id, valor, unidad, periodo, capturado_por, confirmado) values (${lit(SOL_CAP.s)}, ${lit(SOL_CAP.ev)}, 14200, 'participantes', '2025', ${lit(STAFF)}, true)`, true);
SOL_TXT = solicitud("[e2e-gri-sasb] Política de seguridad de la información", false, null, "FN-CB-230a.2");
// El trigger de evidencias ya creó su fila de lectura; se marca omitida (sin modelo) y se usa para el extracto.
const CONT = id(`update evidencias_contenido set estado = 'omitido' where evidencia_id = ${lit(SOL_TXT.ev)} returning id`);
psql(`insert into sugerencias_captura (solicitud_id, tenant_id, evidencia_id, contenido_id, evidencia_version, tipo, estado, extracto, decidido_en) values (${lit(SOL_TXT.s)}, ${lit(TENANT)}, ${lit(SOL_TXT.ev)}, ${lit(CONT)}, 1, 'texto', 'confirmada', 'La Compañía cuenta con una política de seguridad de la información revisada anualmente.', now())`);
psql(`update solicitudes set estado = 'validado' where id in (${lit(SOL_CAP.s)}, ${lit(SOL_TXT.s)})`, true);

  console.log("1. Aprobación y respuestas");
  const ctx = await nav.newContext();
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, url: BASE })));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/cobertura/suplemento/${DOC}`, { timeout: 180000 });
  await p.getByRole("button", { name: "Aprobar", exact: true }).click();
  const esperar = async () => {
    let e = "";
    for (let i = 0; i < 90 && e !== "listo" && e !== "error"; i++) { await new Promise((r) => setTimeout(r, 2000)); e = psql(`select coalesce(respuestas_estado, '') from documentos_generados where id=${lit(DOC)}`); }
    return e;
  };
  const e1 = await esperar();
  ok(e1 === "listo", `respuestas en «listo» (${e1 || "sin estado"})`);
  const g29 = resp(DOC, "GRI 2-9");
  ok(g29.estado === "respuesta" && g29.bloque === "15" && g29.texto.includes("once consejeros"), `GRI 2-9 de la sección 15 (${g29.estado}/${g29.origen}/${g29.bloque})`);
  ok(!/Ver sección/.test(g29.texto), "GRI 2-9 sin remisión «Ver sección»");
  const g32 = resp(DOC, "GRI 3-2");
  ok(g32.estado === "respuesta" && g32.bloque === "7", `GRI 3-2 de la sección 7 (${g32.estado}/${g32.bloque})`);
  const cap = resp(DOC, "FN-CB-240a.4");
  ok(cap.estado === "respuesta" && cap.origen === "captura" && /14,?200/.test(cap.texto), `FN-CB-240a.4 de la captura («${cap.texto}»)`);
  const ev = resp(DOC, "FN-CB-230a.2");
  ok(ev.estado === "pendiente" && /\[Pendiente: respuesta de FN-CB-230a\.2 desde su evidencia — solicitud \[e2e-gri-sasb\] Política de seguridad/.test(ev.texto), `FN-CB-230a.2 por evidencia directa, sin modelo: pendiente con la solicitud (${ev.estado}/${ev.origen})`);
  const g27 = resp(DOC, "GRI 2-7");
  ok(g27.estado === "pendiente" && /sin solicitud en el reporte ni sección del suplemento/.test(g27.texto), "GRI 2-7 sin fuente: pendiente «sin solicitud…»");
  ok(psql(`select count(*) from respuestas_datapoint where documento_id=${lit(DOC)} and destino='taxonomia' and clave like 'FN-CB-%'`) === "17", "las 17 de FN-CB con fila");
  ok(psql(`select count(*) from respuestas_datapoint where documento_id=${lit(DOC)} and destino='taxonomia' and clave like 'GRI %'`) === "37", "los 37 contenidos GRI con fila");
  ok(Number(psql(`select count(*) from respuestas_datapoint where documento_id=${lit(DOC)} and destino='taxonomia' and clave like 'NIIF%'`)) >= 110, "las NIIF siguen todas");
  ok(psql(`select count(*) from respuestas_datapoint where documento_id=${lit(DOC)} and destino='formato' and (clave like 'GRI %' or clave like 'FN-CB-%')`) === "0", "GRI y SASB solo en destino «taxonomia»");

  console.log("\n2. Libro GRI/SASB");
  const b = await bajar(`/admin/cobertura/export-gri-sasb?reporte=${REPORTE}`);
  ok(!!b, "export-gri-sasb 200");
  if (b) {
    const w = new ExcelJS.Workbook(); await w.xlsx.load(b);
    const fila = (hoja, cod) => { let r = null; w.getWorksheet(hoja)?.eachRow((x) => { if (t(x.getCell(1).value) === cod) r = t(x.getCell(3).value); }); return r; };
    ok(fila("GRI", "GRI 2-9") === g29.texto, "GRI 2-9 con su respuesta");
    ok(/^Pendiente: respuesta de FN-CB-230a\.2/.test(fila("SASB FN-CB", "FN-CB-230a.2") ?? ""), "FN-CB-230a.2 con el pendiente en texto plano");
  }

  console.log("\n3. Formato · hoja «Métricas SASB»");
  const f = await bajar(`/admin/cobertura/export-formato?reporte=${REPORTE}`);
  ok(!!f, "export-formato 200");
  if (f) {
    const w = new ExcelJS.Workbook(); await w.xlsx.load(f);
    const s = w.getWorksheet("Métricas SASB");
    const filas = []; s.eachRow((r, i) => { if (i >= 3) filas.push([t(r.getCell(1).value), t(r.getCell(2).value), t(r.getCell(3).value)]); });
    ok(t(s.getCell("A1").value) === "Métricas por industria (SASB)" && [1, 2, 3].map((c) => t(s.getRow(2).getCell(c).value)).join("|") === "Código|Métrica|Respuesta", "título y encabezado Código / Métrica / Respuesta");
    ok(filas.length === 17 && filas.every((x) => x[0].startsWith("FN-CB-") && x[1]), `17 métricas con su texto (${filas.length})`);
    ok(/14,?200/.test(filas.find((x) => x[0] === "FN-CB-240a.4")?.[2] ?? ""), "FN-CB-240a.4 con la respuesta de la captura");
    ok(filas.find((x) => x[0] === "FN-CB-230a.2")?.[2] === "", "FN-CB-230a.2 pendiente: celda vacía");
    ok(!filas.some((x) => x[2].startsWith("[")), "ninguna celda empieza con «[»");
    const zip = await JSZip.loadAsync(f);
    ok(Object.keys(zip.files).length > 5, "el archivo abre como xlsx");
  }

  console.log("\n4. Sin sector SASB: ninguna fila SASB");
  ponerSector(null);
  const r = await fetch(`${BASE}/api/suplemento/${DOC}/respuestas`, { method: "POST", headers: { cookie: cookie() } });
  ok(r.status === 200 || r.status === 202, `regenerar respuestas: ${r.status}`);
  const e4 = await esperar();
  ok(e4 === "listo", `respuestas en «listo» (${e4})`);
  ok(psql(`select count(*) from respuestas_datapoint where documento_id=${lit(DOC)} and clave like 'FN-CB-%'`) === "0", "0 filas SASB");
  ok(psql(`select count(*) from respuestas_datapoint where documento_id=${lit(DOC)} and destino='taxonomia' and clave like 'GRI %'`) === "37", "GRI sigue con 37");
} catch (e) {
  fallas.push(`excepción: ${e.message}`);
  console.log(`  ✗ excepción: ${e.message}`);
} finally {
  await nav.close();
  console.log("\nLimpieza");
  if (DOC) psql(`delete from documentos_generados where id=${lit(DOC)}`);
  if (LIBRO) psql(`delete from libros_hechos where id=${lit(LIBRO)}`);
  for (const s of [SOL_CAP.s, SOL_TXT.s].filter(Boolean)) {
    psql(`delete from sugerencias_captura where solicitud_id=${lit(s)}; delete from evidencias_contenido where solicitud_id=${lit(s)}; delete from capturas_valor where solicitud_id=${lit(s)}; delete from evidencias where solicitud_id=${lit(s)}; delete from solicitudes where id=${lit(s)}`, true);
  }
  const ids = [DOC, SOL_CAP.s, SOL_TXT.s].filter(Boolean);
  if (ids.length) psql(`delete from bitacora where created_at >= ${lit(inicio)}::timestamptz and entidad_id in (${ids.map(lit).join(",")})`, true);
  const [gA, m] = tenantAntes.split("|");
  psql(`update tenants set generador_activo = ${gA === "true" || gA === "t"}, generaciones_mes_max = ${m} where id=${lit(TENANT)}`);
  if (!perfilAntes) psql(`delete from perfil_emisor where tenant_id=${lit(TENANT)}`);
  else ponerSector(JSON.parse(perfilAntes).s);
  ok(psql(`select count(*) from respuestas_datapoint where reporte_id=${lit(REPORTE)}`) === "0" && psql(`select count(*) from solicitudes where titulo like '[e2e-gri-sasb]%'`) === "0", "sin restos de la prueba");
}
console.log(fallas.length ? `\n✗ ${fallas.length} falla(s).` : "\n✓ Respuestas GRI/SASB en orden.");
process.exit(fallas.length ? 1 : 0);
