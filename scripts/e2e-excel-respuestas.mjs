#!/usr/bin/env node
// =============================================================================
// E2E · respuestas en el Excel de taxonomía (encargo 2026-10-13-excel-respuestas-
// narrativas, Pasos 2 y 3).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-excel-respuestas.mjs [baseUrl]          (default http://localhost:3016)
//
// SOLO contra el stack local, con la app de la rama corriendo contra él y SIN
// llave del modelo (ANTHROPIC_API_KEY=): las respuestas de bloque salen del
// respaldo con oraciones ancladas. Costo 0. Documentos de prueba de Empresa
// Demo; se borran al terminar.
//
//   1. Con el suplemento en borrador, el auditor descarga el Excel: la columna
//      «Respuesta» dice «En preparación» y ningún texto del borrador está en el
//      libro.
//   2. El staff aprueba por la pantalla: se generan las respuestas (estado
//      «listo»), con la del bloque anclada y la remisión «Ver sección N · título».
//   3. El auditor descarga el Excel del aprobado: la respuesta está, los incisos
//      hijos quedan agrupados bajo su padre.
//   4. Se abre una versión nueva en borrador: el auditor sigue viendo el último
//      aprobado, nunca el texto nuevo del borrador.
//   5. El auditor no regenera respuestas ni escribe en la tabla.
//   6. Con el generador apagado, el Excel sale sin la columna.
// =============================================================================
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3016";
const URL_SB = "http://127.0.0.1:54321";
// Llave PÚBLICA de demostración del stack local de Supabase (la misma de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const CLAVE = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const CODIGO = "NIIF S2 6 (a)(i)";
const SENAL_APROBADA = "Ruta-Alfa-7731";
const SENAL_BORRADOR = "Ruta-Beta-9912";
if (!/127\.0\.0\.1|localhost/.test(BASE)) { console.error("✗ Solo contra una app local."); process.exit(2); }

const psql = (sql, replica = false) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atq", "-c", `${replica ? "set session_replication_role = replica; " : ""}${sql}`], {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

async function sesion(email) {
  const jar = new Map();
  const db = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await db.auth.signInWithPassword({ email, password: CLAVE });
  if (error) throw new Error(`login ${email}`);
  return { db, jar, cookie: () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ") };
}
const texto = (v) => (v == null ? "" : typeof v === "object" && v.richText ? v.richText.map((x) => x.text).join("") : typeof v === "object" && "result" in v ? String(v.result) : String(v));
async function bajarExcel(s) {
  const r = await fetch(`${BASE}/admin/cobertura/export-taxonomia?reporte=${REPORTE}`, { headers: { cookie: s.cookie() } });
  if (r.status !== 200) return { status: r.status };
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
  const ws = wb.getWorksheet("Taxonomía NIIF S1 S2");
  const todo = [];
  wb.eachSheet((h) => h.eachRow((row) => row.eachCell((c) => todo.push(texto(c.value)))));
  const porCodigo = new Map();
  ws.eachRow((row, n) => {
    const c = texto(row.getCell(2).value).replace(/\s+/g, " ").trim();
    if (n > 1 && c && !porCodigo.has(c)) porCodigo.set(c, { e: texto(row.getCell(5).value), nivel: row.outlineLevel ?? 0 });
  });
  return { status: 200, e1: texto(ws.getCell("E1").value), porCodigo, todo: todo.join("\n") };
}

// --- Preparación -----------------------------------------------------------------
const staff = await sesion("admin@irstrat.example");
const auditor = await sesion("auditor.externo@despacho.example");
const tenantAntes = psql(`select generador_activo || '|' || generaciones_mes_max from tenants where id=${lit(TENANT)}`);
psql(`update tenants set generador_activo = true, generaciones_mes_max = 100 where id=${lit(TENANT)}`);
const respAntes = psql(`select count(*) from respuestas_datapoint where reporte_id=${lit(REPORTE)}`);
if (respAntes !== "0") { console.error(`✗ El reporte ya tiene ${respAntes} respuestas en local; la prueba necesita partir de cero.`); process.exit(2); }
const inicioPrueba = psql(`select now()`);
const LIBRO = psql(`insert into libros_hechos (tenant_id, reporte_id, estado) values (${lit(TENANT)}, ${lit(REPORTE)}, 'listo') returning id`).split("\n")[0];
const ORACION = `El Consejo de Administración supervisa los riesgos climáticos con el apoyo de su comité (${SENAL_APROBADA}).`;
const HECHO = psql(`insert into hechos (tenant_id, libro_id, clave, enunciado, extracto, tipo, rango_fuente, fuente_tipo, fuente_id, fuente_detalle, verificado, estado, bloque_dueno) values (${lit(TENANT)}, ${lit(LIBRO)}, 'consejo.supervision', 'El Consejo supervisa los riesgos climáticos.', ${lit(ORACION)}, 'responsable', 'validado', 'extracto', 'e2e', 'Extracto de prueba', true, 'vigente', 15) returning id`).split("\n")[0];
const docs = [];
function nuevoDocumento(oracion) {
  const v = Number(psql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id=${lit(REPORTE)}`));
  const doc = psql(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos) values (${lit(TENANT)}, ${lit(REPORTE)}, ${v}, 'borrador', '{}') returning id`).split("\n")[0];
  docs.push(doc);
  const cobertura = [{ codigo: CODIGO, estado: "cubierto", bloque: null, hechos: [HECHO], comentario: "" }, { codigo: "NIIF S2 6 (a)", estado: "cubierto", bloque: null, hechos: [HECHO], comentario: "" }, { codigo: "NIIF S2 6 (a)(ii)", estado: "cubierto", bloque: null, hechos: [HECHO], comentario: "" }];
  const anclas = [{ oracion, hechos: [{ id: "h1", hecho: HECHO, fuente: "Extracto de prueba" }] }];
  psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado, texto, origen_texto, fuentes, pendientes, generado_en, libro_id, cobertura, anclas) values (${lit(doc)}, 15, 'roles_organo', 'Roles y responsabilidades del órgano de gobierno', 'II · Gobernanza', 'es', 'borrador', ${lit(`${oracion} La Compañía revisa su estrategia cada año.`)}, 'generacion', '[]', '[]', now(), ${lit(LIBRO)}, ${lit(JSON.stringify(cobertura))}::jsonb, ${lit(JSON.stringify(anclas))}::jsonb)`);
  return doc;
}

const nav = await chromium.launch();
try {
  const DOC = nuevoDocumento(ORACION);

  console.log("\n1. Suplemento en borrador: el auditor descarga «En preparación»");
  const x1 = await bajarExcel(auditor);
  ok(x1.status === 200 && x1.e1 === "Respuesta", `el auditor descarga el Excel con la columna «Respuesta» (${x1.status})`);
  const valores1 = [...(x1.porCodigo?.values() ?? [])].map((x) => x.e);
  ok(valores1.length > 100 && valores1.every((e) => e === "En preparación"), `las ${valores1.length} respuestas dicen «En preparación»`);
  ok(!x1.todo?.includes(SENAL_APROBADA), "ningún texto del borrador aparece en el libro");

  console.log("\n2. El staff aprueba por la pantalla: se generan las respuestas");
  const ctx = await nav.newContext();
  await ctx.addCookies([...staff.jar].map(([name, value]) => ({ name, value, url: BASE })));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/cobertura/suplemento/${DOC}`, { timeout: 180000 });
  await p.getByRole("button", { name: "Aprobar", exact: true }).click();
  let estado = "";
  for (let i = 0; i < 90 && estado !== "listo" && estado !== "error"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    estado = psql(`select coalesce(respuestas_estado, '') from documentos_generados where id=${lit(DOC)}`);
  }
  ok(psql(`select estado from documentos_generados where id=${lit(DOC)}`) === "aprobado", "el documento quedó aprobado");
  ok(estado === "listo", `la generación de respuestas terminó en «listo» (${estado || "sin estado"})`);
  const fila = psql(`select estado || '|' || origen || '|' || bloque || '|' || texto from respuestas_datapoint where documento_id=${lit(DOC)} and destino='taxonomia' and clave=${lit(CODIGO)}`);
  const [eF, oF, bF, tF] = fila.split("|");
  ok(eF === "respuesta" && oF === "bloque" && bF === "15", `${CODIGO}: respuesta del bloque 15, por oraciones ancladas sin modelo (${eF}/${oF}/${bF})`);
  // Numeración consecutiva del Word: el documento de prueba solo lleva el bloque 15, que es su sección 1.
  ok((tF ?? "").includes(SENAL_APROBADA) && (tF ?? "").endsWith("Ver sección 1 · Roles y responsabilidades del órgano de gobierno."), "lleva la oración aprobada y la remisión con la numeración del documento («Ver sección 1 · …»)");
  ok(psql(`select count(*) from respuestas_datapoint where documento_id=${lit(DOC)} and destino='formato' and clave=${lit(CODIGO)}`) === "1", "y su variante para el Formato electrónico");
  ok(Number(psql(`select count(*) from respuestas_datapoint where documento_id=${lit(DOC)} and destino='taxonomia'`)) >= 110, "una fila por código del catálogo");
  ok(Number(psql(`select count(*) from respuestas_datapoint where documento_id=${lit(DOC)} and estado='no_aplica'`)) > 0 && Number(psql(`select count(*) from respuestas_datapoint where documento_id=${lit(DOC)} and estado='pendiente'`)) > 0, "con «no aplica» y «pendiente» explícitos donde no hay sección");

  console.log("\n3. El auditor descarga el Excel del aprobado");
  const x3 = await bajarExcel(auditor);
  ok(x3.porCodigo.get(CODIGO)?.e.includes(SENAL_APROBADA), `${CODIGO} con la respuesta aprobada`);
  ok(![...x3.porCodigo.values()].some((x) => x.e === "En preparación"), "ninguna celda «En preparación»");
  ok(x3.porCodigo.get("NIIF S2 25 (a)(i)")?.nivel === 1 && x3.porCodigo.get("NIIF S2 25 (a)(i)a(v)")?.nivel === 0, "los incisos hijos quedan agrupados bajo su padre (nivel 1)");
  const pendiente = psql(`select clave from respuestas_datapoint where documento_id=${lit(DOC)} and destino='taxonomia' and estado='pendiente' and clave in (${[...x3.porCodigo.keys()].map(lit).join(",")}) order by clave limit 1`);
  ok(/^\[Pendiente: .+ — .+\]$/.test(x3.porCodigo.get(pendiente)?.e ?? ""), `el pendiente lleva el marcador del Word (${pendiente}: «${(x3.porCodigo.get(pendiente)?.e ?? "").slice(0, 60)}…»)`);

  console.log("\n4. Versión nueva en borrador: sigue el último aprobado");
  nuevoDocumento(`El Consejo de Administración supervisa los riesgos climáticos (${SENAL_BORRADOR}).`);
  const x4 = await bajarExcel(auditor);
  ok(x4.porCodigo.get(CODIGO)?.e.includes(SENAL_APROBADA), "el auditor sigue viendo la respuesta aprobada");
  ok(!x4.todo.includes(SENAL_BORRADOR), "el texto del borrador nuevo no aparece en el libro");

  console.log("\n5. El auditor no regenera ni escribe");
  const r5 = await fetch(`${BASE}/api/suplemento/${DOC}/respuestas`, { method: "POST", headers: { cookie: auditor.cookie() } });
  ok(r5.status === 403, `POST …/respuestas como auditor → ${r5.status}`);
  const { error: eIns } = await auditor.db.from("respuestas_datapoint").update({ texto: "alterado" }).eq("documento_id", DOC).select("id");
  ok(psql(`select count(*) from respuestas_datapoint where documento_id=${lit(DOC)} and texto = 'alterado'`) === "0", `update directo como auditor no escribe (${eIns ? "rechazado" : "0 filas"})`);
  const { data: vistas } = await auditor.db.from("respuestas_datapoint").select("id").eq("documento_id", DOC);
  ok((vistas ?? []).length > 0, "pero sí las lee (las de su emisora)");

  console.log("\n6. Generador apagado: el libro sale como antes");
  psql(`update tenants set generador_activo = false where id=${lit(TENANT)}`);
  const x6 = await bajarExcel(auditor);
  ok(x6.status === 200 && x6.e1 === "" && !x6.todo.includes(SENAL_APROBADA), "sin la columna «Respuesta»");
} finally {
  await nav.close();
  console.log("\nLimpieza");
  for (const d of docs) psql(`delete from documentos_generados where id=${lit(d)}`);
  psql(`delete from libros_hechos where id=${lit(LIBRO)}`);
  psql(`delete from bitacora where created_at >= ${lit(inicioPrueba)}::timestamptz and entidad_id in (${docs.map(lit).join(",") || "null"})`, true);
  const [gA, m] = tenantAntes.split("|");
  psql(`update tenants set generador_activo = ${gA === "true" || gA === "t"}, generaciones_mes_max = ${m} where id=${lit(TENANT)}`);
  ok(psql(`select count(*) from respuestas_datapoint where reporte_id=${lit(REPORTE)}`) === "0" && psql(`select count(*) from documentos_generados where id in (${docs.map(lit).join(",")})`) === "0", "sin restos de los documentos de prueba");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
