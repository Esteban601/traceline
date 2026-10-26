#!/usr/bin/env node
// =============================================================================
// E2E · alivios en el Excel de taxonomía, marcadores en texto plano y
// numeración consecutiva del Word (revisión externa del Excel; especificación
// 0.41, §3 y §6.1).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-excel-alivios.mjs [baseUrl]          (default http://localhost:3016)
//
// SOLO contra el stack local, con la app de la rama corriendo contra él. Sin
// modelo, costo 0. Cambia por un momento el régimen del reporte demo local y
// lo restaura al terminar.
//
//   1. Sin alivios: comparativos, Alcance 3 y NIIF S1 se exportan como siempre.
//   2. Con C3, C4 y E5 en el primer año: «No revelado · alivio C3/C4» en las
//      celdas que deja fuera, sin nota de brecha; la Leyenda lo explica.
//   3. Los mismos alivios en un año subsecuente no aplican.
//   4. Ninguna celda exportada empieza con «[»: el pendiente va en texto plano.
//   5. Word: la numeración del índice es consecutiva entre las secciones que van.
// =============================================================================
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { createServerClient } from "@supabase/ssr";

const BASE = process.argv[2] || "http://localhost:3016";
const URL_SB = "http://127.0.0.1:54321";
// Llave PÚBLICA de demostración del stack local de Supabase (la misma de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const NR = (a) => `No revelado · alivio ${a}`;
if (!/127\.0\.0\.1|localhost/.test(BASE)) { console.error("✗ Solo contra una app local."); process.exit(2); }

const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atq", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

const jar = new Map();
const db = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
if ((await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: "Demo2025!" })).error) throw new Error("login staff");
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
const texto = (v) => (v == null ? "" : typeof v === "object" && v.richText ? v.richText.map((x) => x.text).join("") : String(v));

async function libro() {
  const r = await fetch(`${BASE}/admin/cobertura/export-taxonomia?reporte=${REPORTE}`, { headers: { cookie: cookie() } });
  if (r.status !== 200) throw new Error(`export ${r.status}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
  const c = (hoja, celda) => texto(wb.getWorksheet(hoja)?.getCell(celda).value);
  const todas = [];
  wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((x) => todas.push(texto(x.value)))));
  return { wb, c, todas };
}
const regimen = (anio, alivios) => psql(`update reportes set anio_adopcion = ${anio ?? "null"}, alivios = ${lit(JSON.stringify(alivios))}::jsonb where id=${lit(REPORTE)}`);

const antes = psql(`select coalesce(anio_adopcion::text, 'null') || '|' || alivios::text from reportes where id=${lit(REPORTE)}`);
const genAntes = psql(`select generador_activo || '|' || generaciones_mes_max from tenants where id=${lit(TENANT)}`);
const ejercicio = Number(psql(`select ejercicio from reportes where id=${lit(REPORTE)}`));
const docs = [];
try {
  // Solo preguntas y respuestas (regla de Esteban del 26/10): sin hoja «Leyenda» ni notas; los alivios se
  // enuncian dentro de las respuestas (E5 en los encabezados de pilar de S1, E4 en la declaración de cumplimiento,
  // C3 y C4 en la cifra que los invocan). Sin fila de título, las filas se buscan por etiqueta.
  const filaDe = (ws, t, col = 1) => { let f = 0; ws.eachRow((row, n) => { if (!f && texto(row.getCell(col).value).replace(/\s+/g, " ").trim() === t) f = n; }); return f; };
  const E5 = "En este primer periodo anual de aplicación, la Compañía se acoge a la exención del párrafo E5 de la NIIF S1";

  console.log("\n1. Sin alivios: el libro sale como siempre");
  regimen(ejercicio, {});
  const a = await libro();
  const ga = a.wb.getWorksheet("NIIF S2 29(a)(i)");
  ok(!a.todas.some((t) => t.startsWith("No revelado")), "ninguna celda «No revelado»");
  ok(a.c("NIIF S2 29(a)(vi)(1)", "B3") !== NR("C4") && a.c("NIIF S2 29(a)(i)", `D${filaDe(ga, "Alcance 1")}`) !== NR("C3"), "Alcance 3 y la columna del año anterior, con su dato o su marcador");
  ok(a.c("NIIF S1 51", "A2").length > 0 && !a.c("NIIF S1 51", "A2").startsWith("No revelado"), "NIIF S1 51 con sus objetivos");
  ok(!a.wb.getWorksheet("Leyenda") && !a.todas.some((t) => t.startsWith(E5)), "sin «Leyenda» y sin la oración del E5 en ninguna celda");

  console.log("\n2. C3, C4, E4 y E5 en el primer año de adopción");
  regimen(ejercicio, { E4: true, C3: true, C4: true, E5: true });
  const b = await libro();
  const gb = b.wb.getWorksheet("NIIF S2 29(a)(i)");
  const [f1, f2, f3] = ["Alcance 1", "Alcance 2", "Alcance 3"].map((x) => filaDe(gb, x));
  ok(b.c("NIIF S2 29(a)(i)", `C${f3}`) === NR("C4") && b.c("NIIF S2 29(a)(i)", `D${f3}`) === NR("C4"), "C4: Alcance 3 total no se revela, en su celda");
  let cat = 0;
  b.wb.getWorksheet("NIIF S2 29(a)(vi)(1)").eachRow((row, n) => { if (/^Categoría \d/.test(texto(row.getCell(1).value)) && b.c("NIIF S2 29(a)(vi)(1)", `B${n}`) === NR("C4") && b.c("NIIF S2 29(a)(vi)(1)", `C${n}`) === NR("C4")) cat++; });
  ok(cat === 15, `C4: las 15 categorías de Alcance 3 en su celda (${cat})`);
  ok(b.c("NIIF S2 29(a)(i)", `D${f1}`) === NR("C3") && b.c("NIIF S2 29(a)(i)", `D${f2}`) === NR("C3"), "C3: la columna del año anterior de Alcance 1 y 2");
  const regHoja = ["NIIF S2 29(c)", "NIIF S2 29(b)", "NIIF S2 29(d)"].find((h) => b.c(h, "A4"));
  ok(!!regHoja && b.c(regHoja, "H4") === NR("C3"), `C3: los registros de clima tampoco muestran el año anterior (${regHoja} H4)`);
  // E5 (decisión de Esteban, 14 de octubre): las hojas de S1 llevan la información sobre clima, la misma del Formato.
  const climaticos = psql(`select string_agg(replace(nombre, '[DEMO] ', ''), '|') from objetivos where reporte_id=${lit(REPORTE)} and activo and ambito='climatico'`).split("|");
  ok(!b.c("NIIF S1 51", "A2").startsWith("No revelado") && climaticos.includes(b.c("NIIF S1 51", "A2")) && !b.todas.some((t) => t === NR("E5")), "E5: NIIF S1 51 lleva solo objetivos climáticos, sin «No revelado · alivio E5»");
  ok(b.c("NIIF S1 46-50", "C3") !== "" && ["Riesgo", "Oportunidad"].includes(b.c("NIIF S1 46-50", "B3")), "E5: NIIF S1 46-50 con las instancias de métricas y su tipo");
  const tb = b.wb.getWorksheet("Taxonomía NIIF S1 S2");
  const pilares = [];
  tb.eachRow((row, n) => { if (n > 1 && !texto(row.getCell(1).value) && texto(row.getCell(3).value).startsWith(E5)) pilares.push(texto(row.getCell(2).value)); });
  ok(["Gobernanza (S1)", "Estrategia", "Gestión del riesgo", "Métricas y Objetivos"].every((x) => pilares.includes(x)), `E5: en los encabezados de pilar de NIIF S1 (${pilares.join(", ")})`);
  ok(!b.wb.getWorksheet("Leyenda") && !b.todas.some((t) => /^(E4, )?E5, C3, C4$/.test(t)), "sin «Leyenda»: los alivios no van en una nota");

  console.log("\n3. Los mismos alivios en un año subsecuente no aplican");
  regimen(ejercicio - 1, { C3: true, C4: true, E5: true });
  const c3 = await libro();
  ok(!c3.todas.some((t) => t.startsWith("No revelado")), "ninguna celda «No revelado»: los alivios solo rigen el primer año");

  console.log("\n4. Pendientes en texto plano");
  regimen(ejercicio, { C3: true, C4: true, E5: true });
  psql(`update tenants set generador_activo = true, generaciones_mes_max = 100 where id=${lit(TENANT)}`);
  const v = Number(psql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id=${lit(REPORTE)}`));
  const doc = psql(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos) values (${lit(TENANT)}, ${lit(REPORTE)}, ${v}, 'aprobado', '{}') returning id`).split("\n")[0];
  docs.push(doc);
  psql(`insert into respuestas_datapoint (tenant_id, reporte_id, documento_id, version_documento, destino, clave, estado, origen, texto) values (${lit(TENANT)}, ${lit(REPORTE)}, ${lit(doc)}, ${v}, 'taxonomia', 'NIIF S2 B65 inciso (e)', 'pendiente', 'regla', '[Pendiente: información que responda NIIF S2 B65 inciso (e) — sin solicitud en el reporte]')`);
  const d = await libro();
  const hoja = d.wb.getWorksheet("Taxonomía NIIF S1 S2");
  let fila = null;
  hoja.eachRow((row, n) => { if (texto(row.getCell(1).value).replace(/\s+/g, " ").trim() === "NIIF S2 B65 inciso (e)" && fila == null) fila = n; });
  ok(d.c("Taxonomía NIIF S1 S2", `C${fila}`) === "Pendiente: información que responda NIIF S2 B65 inciso (e) — sin solicitud en el reporte", `fila ${fila} (B65(e)): «Pendiente: …» en texto plano`);
  ok(!d.todas.some((t) => t.startsWith("[")), "ninguna celda del libro empieza con «[»");
  ok(psql(`select texto from respuestas_datapoint where documento_id=${lit(doc)}`).startsWith("[Pendiente: "), "la base conserva el marcador con el formato de §5");

  console.log("\n5. Word: numeración consecutiva");
  const v2 = v + 1;
  const docW = psql(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos) values (${lit(TENANT)}, ${lit(REPORTE)}, ${v2}, 'borrador', '{}') returning id`).split("\n")[0];
  docs.push(docW);
  for (const [n, clave, titulo] of [[19, "b19", "Proceso de identificación de riesgos y oportunidades"], [21, "b21", "Riesgos climáticos prioritarios"]]) {
    psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado, texto, origen_texto, fuentes, pendientes, generado_en) values (${lit(docW)}, ${n}, ${lit(clave)}, ${lit(titulo)}, 'IV · Riesgos', 'es', 'borrador', 'Texto de prueba de la sección.', 'generacion', '[]', '[]', now())`);
  }
  const w = await fetch(`${BASE}/api/suplemento/${docW}/word`, { headers: { cookie: cookie() } });
  const xml = w.status === 200 ? await (await JSZip.loadAsync(Buffer.from(await w.arrayBuffer()))).file("word/document.xml").async("string") : "";
  const plano = xml.replace(/<[^>]+>/g, "");
  ok(w.status === 200 && /1\. [^0-9]{5,}2\. /.test(plano) && !/21\. /.test(plano), `el índice numera 1 y 2, no 19 y 21 (${w.status})`);
} finally {
  console.log("\nLimpieza");
  for (const d of docs) psql(`delete from documentos_generados where id=${lit(d)}`);
  const [anio, ...resto] = antes.split("|");
  regimen(anio === "null" ? null : Number(anio), JSON.parse(resto.join("|")));
  const [gA, m] = genAntes.split("|");
  psql(`update tenants set generador_activo = ${gA === "true" || gA === "t"}, generaciones_mes_max = ${m} where id=${lit(TENANT)}`);
  ok(psql(`select coalesce(anio_adopcion::text, 'null') || '|' || alivios::text from reportes where id=${lit(REPORTE)}`) === antes, "régimen del reporte restaurado");
  ok(psql(`select count(*) from respuestas_datapoint where reporte_id=${lit(REPORTE)}`) === "0", "sin respuestas de prueba");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
