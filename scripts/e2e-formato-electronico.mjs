#!/usr/bin/env node
// =============================================================================
// E2E · Formato electrónico NIIF S1/S2 (encargo 2026-10-13-excel-respuestas-
// narrativas, Paso 4).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-formato-electronico.mjs [baseUrl]          (default http://localhost:3016)
//
// SOLO contra el stack local, con la app de la rama corriendo contra él. Sin
// modelo, costo 0. Necesita la plantilla limpia en
// referencia/formato-electronico/plantilla-formato-2025.xlsx (fuera de git;
// la arma scripts/formato/preparar-plantilla.mjs) y la sube al Storage LOCAL.
//
//   1. El auditor no descarga el Formato electrónico (403).
//   2. Sin documento aprobado (sin respuestas): 409 con el motivo.
//   3. Con respuestas: staff y admin del cliente lo descargan; la respuesta va en
//      K por su fila, el alivio E5 antepone su oración, un pendiente deja la
//      celda vacía, ninguna celda empieza con «[», la «Tabla NIIF» lleva los
//      registros y la hoja SASB su nota de Fase C.
//   4. Con el generador apagado no se ofrece (409).
// =============================================================================
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.argv[2] || "http://localhost:3016";
const URL_SB = "http://127.0.0.1:54321";
// Llaves PÚBLICAS de demostración del stack local de Supabase (las mismas de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const PLANTILLA = "referencia/formato-electronico/plantilla-formato-2025.xlsx";
const RUTA = "plantillas/formato-electronico/2025/plantilla.xlsx";
if (!/127\.0\.0\.1|localhost/.test(BASE)) { console.error("✗ Solo contra una app local."); process.exit(2); }
if (!fs.existsSync(PLANTILLA)) { console.error(`✗ Falta ${PLANTILLA} (scripts/formato/preparar-plantilla.mjs).`); process.exit(2); }

const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atq", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };
const texto = (v) => (v == null ? "" : typeof v === "object" && v.richText ? v.richText.map((x) => x.text).join("") : String(v));

async function sesion(email) {
  const jar = new Map();
  const db = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
  if ((await db.auth.signInWithPassword({ email, password: "Demo2025!" })).error) throw new Error(`login ${email}`);
  return () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
}
const bajar = async (cookie) => fetch(`${BASE}/admin/cobertura/export-formato?reporte=${REPORTE}`, { headers: { cookie: cookie() } });

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
const { error: eUp } = await admin.storage.from("documentos").upload(RUTA, fs.readFileSync(PLANTILLA), { upsert: true, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
if (eUp) { console.error(`✗ plantilla al Storage local: ${eUp.message}`); process.exit(2); }

const staff = await sesion("admin@irstrat.example");
const cliente = await sesion("admin.cliente@empresademo.example");
const auditor = await sesion("auditor.externo@despacho.example");
const genAntes = psql(`select generador_activo || '|' || generaciones_mes_max from tenants where id=${lit(TENANT)}`);
const regAntes = psql(`select coalesce(anio_adopcion::text, 'null') || '|' || alivios::text from reportes where id=${lit(REPORTE)}`);
if (psql(`select count(*) from respuestas_datapoint where reporte_id=${lit(REPORTE)}`) !== "0") { console.error("✗ El reporte ya tiene respuestas en local."); process.exit(2); }
psql(`update tenants set generador_activo = true, generaciones_mes_max = 100 where id=${lit(TENANT)}`);
const ejercicio = Number(psql(`select ejercicio from reportes where id=${lit(REPORTE)}`));
psql(`update reportes set anio_adopcion = ${ejercicio}, alivios = '{"E5": true, "C4": true}'::jsonb where id=${lit(REPORTE)}`);
let doc = null;
try {
  console.log("\n1. El auditor no lo descarga");
  ok((await bajar(auditor)).status === 403, "auditor → 403");

  console.log("\n2. Sin documento aprobado");
  const r2 = await bajar(staff);
  const j2 = await r2.json().catch(() => ({}));
  ok(r2.status === 409 && /suplemento aprobado/.test(j2.error ?? ""), `sin respuestas → 409 con el motivo (${r2.status})`);

  console.log("\n3. Con respuestas del documento aprobado");
  const v = Number(psql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id=${lit(REPORTE)}`));
  doc = psql(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos) values (${lit(TENANT)}, ${lit(REPORTE)}, ${v}, 'aprobado', '{}') returning id`).split("\n")[0];
  const fila = (destino, clave, estado, t) => `(${lit(TENANT)}, ${lit(REPORTE)}, ${lit(doc)}, ${v}, ${lit(destino)}, ${lit(clave)}, ${lit(estado)}, 'modelo', ${lit(t)})`;
  psql(`insert into respuestas_datapoint (tenant_id, reporte_id, documento_id, version_documento, destino, clave, estado, origen, texto) values
    ${fila("formato", "NIIF S2 6 (a)", "respuesta", "El Consejo de Administración supervisa los riesgos climáticos (prueba-formato).")},
    ${fila("taxonomia", "NIIF S2 6 (a)", "respuesta", "El Consejo supervisa. Ver sección 1 · Roles y responsabilidades del órgano de gobierno.")},
    ${fila("formato", "NIIF S2 6 (a)(i)", "pendiente", "[Pendiente: órgano responsable — solicitud Órgano responsable del clima]")}`);
  for (const [quien, ck] of [["staff", staff], ["admin del cliente", cliente]]) {
    const r = await bajar(ck);
    ok(r.status === 200 && /Formato_electronico_NIIF_.+_\d{4}\.xlsx/.test(r.headers.get("content-disposition") ?? ""), `${quien} → 200 con Formato_electronico_NIIF_<emisora>_<ejercicio>.xlsx`);
    if (quien !== "staff") continue;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
    const ws = wb.getWorksheet("Estructura Formato Electronico");
    const k = (n) => texto(ws.getCell(`K${n}`).value);
    ok(k(25).includes("(prueba-formato)") && k(25).includes("párrafo E5"), "fila 25 (NIIF S2 6 (a)): la respuesta, con la oración fija del E5");
    ok(k(28) === "", "fila 28 (NIIF S2 6 (a)(i)): pendiente → celda vacía");
    ok(k(5) === `Informe de Sostenibilidad y Clima ${ejercicio}`, "fila 5: regla fija con el ejercicio");
    let corchete = 0;
    let menciones = 0;
    wb.eachSheet((h) => h.eachRow((row) => row.eachCell((c) => { if (/autl[aá]n/i.test(texto(c.value))) menciones++; })));
    // Las respuestas (columna K y «Tabla NIIF»); los encabezados «[100000] …» de la columna D son estructura del formato.
    ws.eachRow((row, n) => { if (n > 3 && texto(row.getCell(11).value).startsWith("[")) corchete++; });
    wb.getWorksheet("Tabla NIIF").eachRow((row) => row.eachCell((c) => { if (texto(c.value).startsWith("[")) corchete++; }));
    ok(corchete === 0, "ninguna respuesta (columna K, «Tabla NIIF») empieza con «[»");
    ok(menciones === 0, "ninguna celda nombra a la emisora de referencia");
    const registros = Number(psql(`select count(*) from registros_clima where reporte_id=${lit(REPORTE)} and activo`));
    let filasTN = 0;
    wb.getWorksheet("Tabla NIIF").eachRow((row, n) => { if (n > 2 && texto(row.getCell(1).value) && texto(row.getCell(1).value) !== "OPORTUNIDADES") filasTN++; });
    ok(filasTN === registros, `«Tabla NIIF»: los ${registros} registros de clima activos (${filasTN})`);
    ok(/pendiente de catálogo SASB/.test(texto(wb.getWorksheet("Métricas SASB")?.getCell("A2").value)), "«Métricas SASB»: nota de Fase C");
  }

  console.log("\n4. Generador apagado");
  psql(`update tenants set generador_activo = false where id=${lit(TENANT)}`);
  ok((await bajar(staff)).status === 409, "no se ofrece → 409");
} finally {
  console.log("\nLimpieza");
  if (doc) psql(`delete from documentos_generados where id=${lit(doc)}`);
  const [gA, m] = genAntes.split("|");
  psql(`update tenants set generador_activo = ${gA === "true" || gA === "t"}, generaciones_mes_max = ${m} where id=${lit(TENANT)}`);
  const [anio, ...resto] = regAntes.split("|");
  psql(`update reportes set anio_adopcion = ${anio === "null" ? "null" : anio}, alivios = ${lit(resto.join("|"))}::jsonb where id=${lit(REPORTE)}`);
  ok(psql(`select count(*) from respuestas_datapoint where reporte_id=${lit(REPORTE)}`) === "0", "sin respuestas de prueba");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
