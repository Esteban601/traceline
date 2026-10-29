#!/usr/bin/env node
// =============================================================================
// E2E · Formato electrónico NIIF S1/S2 (encargo 2026-10-13-excel-respuestas-
// narrativas, Paso 4, con la revisión externa del formato).
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
//   3. Con respuestas: staff y admin del cliente lo descargan. Las 23 imágenes en
//      celda siguen enlazadas (vm=, xl/richData, xl/metadata.xml idénticos a la
//      plantilla) y ningún «#VALUE!» queda suelto; la respuesta va en K por su
//      fila con la oración del E5; un pendiente deja la celda vacía; ninguna
//      respuesta empieza con «[» salvo un código de lista («[815200] …»); la
//      selección de actividad y el sector salen del Perfil; las secciones de una
//      actividad en la que no participa dicen «No aplica por actividad»; la tabla
//      de riesgos físicos (370) trae los físicos; sin hoja «Leyenda» y con los alivios en K12;
//      la sección «Para: Fideicomisos» dice «No aplica» si la emisora no es fideicomiso.
//   4. Con el generador apagado no se ofrece (409).
// =============================================================================
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { celdasConCorchete, opcionesDeListas, validarImagenesEnCelda } from "../lib/formato/xlsx-xml.ts";
import { ORACION_E5, primeraPersonaPlural } from "../lib/suplemento/respuestas.ts";
import { vocabularioEnCeldaExportada } from "../lib/suplemento/vocabulario.ts";
import { ENCABEZADOS_E5 } from "../lib/formato/llenar.ts";

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
const desescapar = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

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
const plantilla = await JSZip.loadAsync(fs.readFileSync(PLANTILLA));

const staff = await sesion("admin@irstrat.example");
const cliente = await sesion("admin.cliente@empresademo.example");
const auditor = await sesion("auditor.externo@despacho.example");
const genAntes = psql(`select generador_activo || '|' || generaciones_mes_max from tenants where id=${lit(TENANT)}`);
const regAntes = psql(`select coalesce(anio_adopcion::text, 'null') || '|' || alivios::text from reportes where id=${lit(REPORTE)}`);
const perfilAntes = psql(`select coalesce(array_to_json(actividades_financieras)::text, 'null') || '|' || coalesce(array_to_json(sector_sasb)::text, 'null') from perfil_emisor where tenant_id=${lit(TENANT)}`);
if (psql(`select count(*) from respuestas_datapoint where reporte_id=${lit(REPORTE)}`) !== "0") { console.error("✗ El reporte ya tiene respuestas en local."); process.exit(2); }
psql(`update tenants set generador_activo = true, generaciones_mes_max = 100 where id=${lit(TENANT)}`);
const ejercicio = Number(psql(`select ejercicio from reportes where id=${lit(REPORTE)}`));
psql(`update reportes set anio_adopcion = ${ejercicio}, alivios = '{"E5": true, "C4": true, "C3": true}'::jsonb where id=${lit(REPORTE)}`);
// El seed local no siempre trae Perfil para el demo: se crea para la prueba y se borra al terminar.
const perfilCreado = !perfilAntes;
if (perfilCreado) psql(`insert into perfil_emisor (tenant_id) values (${lit(TENANT)})`);
psql(`update perfil_emisor set actividades_financieras = array['Banca comercial'], sector_sasb = array['[815200] Finanzas - Bancos comerciales (FN-CB)'], metricas_industria = 'No'  where tenant_id=${lit(TENANT)}`);
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
    const z = await JSZip.loadAsync(Buffer.from(await r.arrayBuffer()));
    const est = await z.file("xl/worksheets/sheet2.xml").async("string");
    const celda = (col, n) => desescapar(est.match(new RegExp(`<c r="${col}${n}"[^>]*>(?:<is><t[^>]*>([\\s\\S]*?)</t></is>)?`))?.[1] ?? "");
    const k = (n) => celda("K", n > 185 ? n + delta : n);

    // La iteración de métricas (145–185) recorre lo que sigue: delta = última fila − 588 de la plantilla.
    const delta = Number(est.match(/<dimension ref="[A-Z]+\d+:[A-Z]+(\d+)"/)[1]) - 588;
    // Imágenes en celda (punto 1 de la revisión).
    const vm = (s) => [...s.matchAll(/<c r="([A-Z]+\d+)"[^>]*vm="(\d+)"/g)].map((m) => `${m[1]}:${m[2]}`).join(",");
    const vmPlantilla = vm(await plantilla.file("xl/worksheets/sheet2.xml").async("string")).split(",").map((x) => x.replace(/^([A-Z]+)(\d+):/, (_m, c, r) => `${c}${Number(r) > 185 ? Number(r) + delta : r}:`)).join(",");
    ok(vm(est) === vmPlantilla && vm(est).split(",").length === 23, "las 23 celdas con imagen conservan su vm= (las mismas celdas, recorridas por la iteración, con el mismo rich value)");
    let iguales = true;
    for (const n of Object.keys(plantilla.files).filter((x) => /^xl\/(richData\/|metadata\.xml|media\/)/.test(x) && !plantilla.files[x].dir)) {
      const [a, b] = await Promise.all([plantilla.file(n).async("nodebuffer"), z.file(n)?.async("nodebuffer")]);
      if (!b || Buffer.compare(a, b) !== 0) iguales = false;
    }
    ok(iguales, "xl/richData, xl/metadata.xml y las imágenes, idénticos a la plantilla");
    const hojas = {};
    for (const n of Object.keys(z.files).filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x))) hojas[n] = await z.file(n).async("string");
    const problemas = validarImagenesEnCelda(hojas, Object.keys(z.files), 23);
    ok(problemas.length === 0, `validador de entrega: ningún «#VALUE!» suelto, 23 imágenes enlazadas (${problemas.join("; ") || "ok"})`);

    ok(k(25).includes("(prueba-formato)") && k(25).includes("párrafo E5"), "fila 25 (NIIF S2 6 (a)): la respuesta, con la oración fija del E5");
    ok(k(28) === "", "fila 28 (NIIF S2 6 (a)(i)): pendiente → celda vacía");
    ok(k(5) === `Informe de Sostenibilidad y Clima ${ejercicio}`, "fila 5: regla fija con el ejercicio");
    ok(k(339) === "Banca comercial" && k(446) === "[815200] Finanzas - Bancos comerciales (FN-CB)", "actividad y sector SASB desde el Perfil (opción literal de la lista)");
    const registros = Number(psql(`select count(*) from registros_clima where reporte_id=${lit(REPORTE)} and activo`));
    ok(delta > 0 && /^Riesgo 1: /.test(celda("D", 146)) && /^Métrica 1: /.test(celda("D", 147)) && celda("K", 148) === "Verdadero", `métricas S1 46–50 iteradas: «Riesgo 1» / «Métrica 1» y su bloque (${registros} registros, ${delta} filas más)`);
    ok(["K364", "K387", "K410"].every((r) => k(Number(r.slice(1))) === "No"), "métricas por industria: el juicio del Perfil en 364, 387 y 410");
    ok(/^No aplica por actividad/.test(k(454)) && /^No aplica por actividad/.test(k(488)), "gestión de activos y seguros: «No aplica por actividad»");
    ok(k(469) === "No revelado · alivio C4" && k(337) === "No revelado · alivio C4", "cifras de Alcance 3 (banca, categorías): «No revelado · alivio C4»");
    const fisicos = psql(`select string_agg(nombre, '|') from registros_clima where reporte_id=${lit(REPORTE)} and activo and tipo='riesgo_fisico'`).split("|").filter(Boolean);
    const transicion = psql(`select string_agg(nombre, '|') from registros_clima where reporte_id=${lit(REPORTE)} and activo and tipo='riesgo_transicion'`).split("|").filter(Boolean);
    const limpio = (n) => n.replace(/\[DEMO\]\s*/i, "").trim();
    ok(fisicos.every((n) => k(370).includes(limpio(n))) && !transicion.some((n) => k(370).includes(limpio(n))), "fila 370 (NIIF S2 29 (c)): los riesgos físicos, ninguno de transición");
    const ks = [...est.matchAll(/<c r="K(\d+)"[^>]*><is><t[^>]*>([\s\S]*?)<\/t><\/is>/g)].map((m) => desescapar(m[2]));
    const opciones = opcionesDeListas(await z.file("xl/sharedStrings.xml").async("string"));
    ok(celdasConCorchete(est, "K", opciones).length === 0 && !ks.some((t) => /\[Pendiente/.test(t)), "ninguna celda K con «[Pendiente» ni con «[» fuera de una opción de lista del formato");
    // El glosario oficial (CLAUDE.md §5, lib/suplemento/vocabulario.ts); esta prueba no tiene lista propia.
    const conVocabulario = ks.filter((t) => vocabularioEnCeldaExportada(t).length);
    ok(conVocabulario.length === 0, `ninguna celda K con vocabulario de plataforma del glosario de CLAUDE.md §5${conVocabulario.length ? ` (${conVocabulario.length}: ${conVocabulario.slice(0, 2).map((t) => t.slice(0, 60)).join(" | ")})` : ""}`);
    // D4: la oración del E5 una vez por encabezado de la plantilla (más las celdas «no aplica · E5», que la conservan).
    const filasK = [...est.matchAll(/<c r="K(\d+)"[^>]*><is><t[^>]*>([\s\S]*?)<\/t><\/is>/g)].map((m) => ({ fila: Number(m[1]), t: desescapar(m[2]) }));
    const conPrefijo = filasK.filter((x) => x.t.startsWith(`${ORACION_E5} `) && !/se revela conforme a/.test(x.t));
    const encDe = (kFila) => { const f = kFila > 185 ? kFila - 279 : kFila; return ENCABEZADOS_E5.filter((e) => e <= f).at(-1); };
    const porEncabezado = conPrefijo.reduce((a, x) => ((a[encDe(x.fila)] = (a[encDe(x.fila)] ?? 0) + 1), a), {});
    ok(conPrefijo.length > 0 && Object.values(porEncabezado).every((n) => n === 1), `oración del E5 una vez por encabezado (${conPrefijo.map((x) => `K${x.fila}`).join(", ")})`);
    ok(!ks.some((t) => primeraPersonaPlural(t).length), "ninguna celda K en primera persona del plural (tercera persona, «la Compañía»)");
    const libro = await z.file("xl/workbook.xml").async("string");
    // Fase 5 del encargo formato-afirmaciones-y-voz: sin hoja «Leyenda»; los alivios del reporte, en K12.
    ok(!/<sheet name="Leyenda"/.test(libro) && /<sheet name="Métricas SASB"/.test(libro), "sin hoja «Leyenda»; con «Métricas SASB»");
    ok(/^(Alivios de transición aplicados en este ejercicio: .+\.|Sin alivios de transición en este ejercicio\.)$/.test(k(12)), `K12 declara los alivios del reporte («${k(12)}»)`);
    // Sección «Para: Fideicomisos» (filas 13–21) entera «No aplica» si la emisora no es fideicomiso.
    const instrumento = psql(`select coalesce(tipo_instrumento, '') from perfil_emisor where tenant_id=(select tenant_id from reportes where id=${lit(REPORTE)})`);
    if (!/fideicomiso/i.test(instrumento)) ok([13, 14, 15, 16, 17, 18, 19, 20, 21].every((f) => k(f) === "No aplica"), "sección «Para: Fideicomisos» (K13–K21) «No aplica»: la emisora no es fideicomiso");
    let menciones = 0;
    for (const n of Object.keys(z.files).filter((x) => /\.(xml|rels|vml)$/.test(x))) menciones += ((await z.file(n).async("string")).match(/autl[aá]n/gi) ?? []).length;
    ok(menciones === 0, "ninguna parte del archivo nombra a la emisora de referencia");
  }

  console.log("\n3b. Misma fuente: «NIIF S1 46-50» del Excel de taxonomía = instancias del Formato (punto 6)");
  {
    const rf = await bajar(staff);
    const zf = await JSZip.loadAsync(Buffer.from(await rf.arrayBuffer()));
    const est = await zf.file("xl/worksheets/sheet2.xml").async("string");
    const txt = (c, n) => desescapar(est.match(new RegExp(`<c r="${c}${n}"[^>]*>(?:<is><t[^>]*>([\\s\\S]*?)</t></is>)?`))?.[1] ?? "");
    const delta = Number(est.match(/<dimension ref="[A-Z]+\d+:[A-Z]+(\d+)"/)[1]) - 588;
    const delFormato = [];
    let riesgo = "";
    for (let n = 145; n <= 185 + delta; n++) {
      const d = txt("D", n);
      const mr = d.match(/^(?:Riesgo|Oportunidad) \d+: (.*)$/);
      if (mr) riesgo = mr[1];
      const mm = d.match(/^Métrica \d+: (.*)$/);
      if (mm) delFormato.push([riesgo, mm[1], txt("K", n + 20), txt("K", n + 22)].join(" | "));
    }
    const rt = await fetch(`${BASE}/admin/cobertura/export-taxonomia?reporte=${REPORTE}`, { headers: { cookie: staff() } });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await rt.arrayBuffer()));
    const hoja = wb.getWorksheet("NIIF S1 46-50");
    const v = (c) => (c.value == null ? "" : typeof c.value === "object" && c.value.richText ? c.value.richText.map((x) => x.text).join("") : String(c.value));
    const delExcel = [];
    hoja.eachRow((row, n) => {
      // Sin fila de título ni separadoras (26/10): el encabezado ocupa las filas 1 y 2.
      if (n < 3 || !v(row.getCell(3))) return;
      // Columna B «Tipo» (26/10): la métrica en C, verificación en K y método en L.
      delExcel.push([v(row.getCell(1)), v(row.getCell(3)), v(row.getCell(11)), v(row.getCell(12))].join(" | "));
    });
    ok(delFormato.length > 0 && JSON.stringify(delFormato) === JSON.stringify(delExcel), `las mismas ${delFormato.length} instancias (riesgo, métrica, verificación, método) en el Formato y en la taxonomía (${delExcel.length})`);
    // La oración del E5 ya no va suelta en la hoja (es una nota): va en los encabezados de pilar de la taxonomía.
    ok(!/párrafo E5/.test(v(hoja.getCell("A1"))) && !delExcel.some((x) => /No revelado/.test(x)), "la hoja sin la oración del E5 suelta y sin ningún «No revelado · alivio E5»");
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
  if (perfilCreado) psql(`delete from perfil_emisor where tenant_id=${lit(TENANT)}`);
  else {
    const [act, sec] = perfilAntes.split("|");
    const arr = (j) => (j === "null" ? "null" : `array[${JSON.parse(j).map(lit).join(",")}]::text[]`);
    psql(`update perfil_emisor set actividades_financieras = ${arr(act)}, sector_sasb = ${arr(sec)} where tenant_id=${lit(TENANT)}`);
  }
  ok(psql(`select count(*) from respuestas_datapoint where reporte_id=${lit(REPORTE)}`) === "0", "sin respuestas de prueba");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
