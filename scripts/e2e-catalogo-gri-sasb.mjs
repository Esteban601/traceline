#!/usr/bin/env node
// =============================================================================
// E2E · catálogo GRI/SASB, nivel mínimo (encargo 2026-10-31-catalogo-gri-sasb, Fase 1). Sin modelo, costo 0.
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-catalogo-gri-sasb.mjs [baseUrl]          (por omisión http://localhost:3016)
//
// SOLO contra el stack local, con `next dev` en el puerto dado y la sesión del staff del seed.
//   A. Catálogo: GRI 2 = 30 y GRI 3 = 3 con texto literal en español (empieza como requisito, sin inglés ni
//      marcadores), SASB FN-CB 2025-12 = 17 en inglés; cada fila con estándar, edición y página; las cuatro de la
//      Extensión GRI con su estándar y edición; el CHECK rechaza una fila SASB sin edición; NIIF sin cambio.
//   B. Cobertura: sin sector SASB en el Perfil, la emisora no ve SASB; con «[815200] … (FN-CB)», ve las 17. GRI
//      siempre. El avance NIIF no cambia (el universo es solo NIIF). Se prueba con el Excel de cobertura y con la
//      pantalla.
//   C. Libro GRI/SASB: hojas «GRI» y «SASB FN-CB», solo preguntas y respuestas (encabezado Código / Requisito
//      [/ Respuesta]), una fila por código, ninguna celda empieza con «[», sin vocabulario de plataforma.
//   D. El Excel de taxonomía sigue siendo solo NIIF: ningún código GRI ni SASB.
// El Perfil de Empresa Demo se restaura (o se borra la fila si no existía) al terminar.
// =============================================================================
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import ExcelJS from "exceljs";
import { createServerClient } from "@supabase/ssr";
import { vocabularioEnCeldaExportada } from "../lib/suplemento/vocabulario.ts";

const BASE = process.argv[2] || "http://localhost:3016";
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.error("✗ Solo contra el servidor local."); process.exit(2); }
const URL_SB = "http://127.0.0.1:54321";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const SECTOR = "[815200] Finanzas - Bancos comerciales (FN-CB)";
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atc", sql], { env: { ...process.env, PGPASSWORD: "postgres" }, encoding: "utf8" }).trim();
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };
const t = (v) => (v == null ? "" : typeof v === "object" ? (v.richText ? v.richText.map((x) => x.text).join("") : v.text ?? String(v.result ?? "")) : String(v));

// Sesión del staff del seed, como cookie para la aplicación.
const jar = new Map();
const sb = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
const pw = fs.readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8").match(/crypt\('([^']+)'/)[1];
const { error: eLogin } = await sb.auth.signInWithPassword({ email: "admin@irstrat.example", password: pw });
if (eLogin) { console.error(`✗ login staff: ${eLogin.message}`); process.exit(2); }
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
const bajar = async (ruta) => { const r = await fetch(`${BASE}${ruta}`, { headers: { cookie: cookie() } }); return { status: r.status, buf: r.ok ? Buffer.from(await r.arrayBuffer()) : null, texto: r.ok ? null : await r.text() }; };
const libro = async (buf) => { const w = new ExcelJS.Workbook(); await w.xlsx.load(buf); return w; };

const filaPerfil = psql(`select coalesce(json_build_object('sector_sasb', sector_sasb)::text, '') from perfil_emisor where tenant_id = '${TENANT}'`);
const antes = filaPerfil ? JSON.parse(filaPerfil) : null;
const ponerSector = (arr) => {
  if (psql(`select count(*) from perfil_emisor where tenant_id = '${TENANT}'`) === "0") psql(`insert into perfil_emisor (tenant_id) values ('${TENANT}')`);
  psql(`update perfil_emisor set sector_sasb = ${arr ? `array[$s$${arr.join("$s$,$s$")}$s$]::text[]` : "null"} where tenant_id = '${TENANT}'`);
};

try {
  console.log("A. Catálogo");
  const conteo = Object.fromEntries(psql(`select coalesce(estandar,'NIIF')||'|'||count(*) from datapoints_taxonomia where activo and version_taxonomia='2025' group by coalesce(estandar,'NIIF')`).split("\n").map((l) => l.split("|")).map(([k, v]) => [k, +v]));
  ok(conteo["GRI 2"] === 30 && conteo["GRI 3"] === 3 && conteo["SASB FN-CB"] === 17, `GRI 2: ${conteo["GRI 2"]}, GRI 3: ${conteo["GRI 3"]}, SASB FN-CB: ${conteo["SASB FN-CB"]} (30, 3, 17)`);
  ok(psql(`select count(*) from datapoints_taxonomia where marco in ('GRI','SASB') and (estandar is null or edicion is null)`) === "0", "toda fila GRI y SASB con estándar y edición");
  ok(psql(`select count(*) from datapoints_taxonomia where estandar in ('GRI 2','GRI 3','SASB FN-CB') and pagina_origen is null`) === "0", "las 50 con página de origen");
  ok(psql(`select count(*) from datapoints_taxonomia where estandar in ('GRI 2','GRI 3') and descripcion !~ '^(La organización debe|Para cada tema material)'`) === "0", "GRI 2 y 3: texto literal del requisito en español");
  ok(psql(`select count(*) from datapoints_taxonomia where estandar in ('GRI 2','GRI 3') and (descripcion ~* 'organization shall|pendiente de carga|orientaciones para' or descripcion like '[%')`) === "0", "GRI 2 y 3: sin inglés, sin marcador de pendiente y sin orientaciones");
  ok(psql(`select edicion from datapoints_taxonomia where codigo = 'FN-CB-410b.1'`) === "2025-12" && psql(`select descripcion from datapoints_taxonomia where codigo = 'FN-CB-410b.1'`).endsWith("(3) Scope 3"), "FN-CB-410b.1 de 2025-12, literal hasta «(3) Scope 3»");
  ok(psql(`select string_agg(codigo||'='||estandar||'/'||edicion, ', ' order by codigo) from datapoints_taxonomia where codigo in ('GRI 303-5','GRI 306-3','GRI 404-1','GRI 2-7 / 401-1')`) === "GRI 2-7 / 401-1=GRI 2 / GRI 401/2021 / 2016, GRI 303-5=GRI 303/2018, GRI 306-3=GRI 306/2020, GRI 404-1=GRI 404/2016", "Extensión GRI: estándar y edición de las cuatro");
  let rechaza = false;
  try { psql(`insert into datapoints_taxonomia (codigo, marco, norma, pilar, descripcion) values ('E2E-SIN-EDICION','SASB','S2','metricas','x')`); } catch { rechaza = true; }
  ok(rechaza, "el CHECK rechaza una fila SASB sin estándar ni edición");
  const niif = +psql(`select count(*) from datapoints_taxonomia where marco = 'NIIF' and activo`);
  ok(niif > 100 && psql(`select count(*) from datapoints_taxonomia where marco = 'NIIF' and (estandar is not null or edicion is not null or pagina_origen is not null)`) === "0", `NIIF (${niif}) sin las columnas nuevas`);

  const coberturaExcel = async () => {
    const r = await bajar(`/admin/cobertura/export?tenant=${TENANT}`);
    if (r.status !== 200) throw new Error(`export de cobertura ${r.status}`);
    const w = await libro(r.buf);
    const cods = { NIIF: new Set(), GRI: new Set(), SASB: new Set() };
    w.eachSheet((s) => s.eachRow((row, i) => { if (i > 1) { const m = t(row.getCell(2).value); if (cods[m]) cods[m].add(t(row.getCell(1).value)); } }));
    return cods;
  };
  const pantalla = async () => (await (await fetch(`${BASE}/admin/cobertura?tenant=${TENANT}&reporte=${REPORTE}`, { headers: { cookie: cookie() } })).text());

  console.log("\nB. Cobertura");
  ponerSector(null);
  let c = await coberturaExcel();
  ok(c.SASB.size === 0 && c.GRI.size === 37, `sin sector SASB: 0 SASB y ${c.GRI.size} GRI (37) en el Excel de cobertura`);
  const niifSin = c.NIIF.size;
  let html = await pantalla();
  ok(/GRI/.test(html) && !/métricas de la norma SASB/.test(html), "pantalla: sección GRI y ninguna SASB");
  ponerSector([SECTOR]);
  c = await coberturaExcel();
  ok(c.SASB.size === 17 && [...c.SASB].every((x) => x.startsWith("FN-CB-")), `con «${SECTOR}»: las 17 de FN-CB`);
  ok(c.NIIF.size === niifSin, `NIIF igual con y sin sector SASB (${c.NIIF.size})`);
  html = await pantalla();
  const visible = html.replace(/<!-- -->/g, "");
  ok(/métricas de la norma SASB/.test(visible) && /17 métricas/.test(visible), "pantalla: sección SASB con 17 métricas");
  ok(/37 contenidos/.test(visible), "pantalla: sección GRI con 37 contenidos");

  console.log("\nC. Libro GRI/SASB");
  const r = await bajar(`/admin/cobertura/export-gri-sasb?reporte=${REPORTE}`);
  ok(r.status === 200, `export-gri-sasb: ${r.status}${r.texto ? ` ${r.texto}` : ""}`);
  if (r.buf) {
    const w = await libro(r.buf);
    ok(w.worksheets.map((s) => s.name).join("|") === "GRI|SASB FN-CB", `hojas: ${w.worksheets.map((s) => s.name).join(", ")}`);
    const generador = psql(`select generador_activo from tenants where id = '${TENANT}'`) === "t";
    for (const s of w.worksheets) {
      const enc = s.getRow(1).values.slice(1).map(t);
      ok(enc.join("|") === (generador ? "Código|Requisito|Respuesta" : "Código|Requisito"), `${s.name}: encabezado ${enc.join(" / ")}`);
      const cods = []; const celdas = []; const requisitos = [];
      s.eachRow((row, i) => { if (i > 1) { cods.push(t(row.getCell(1).value)); requisitos.push([t(row.getCell(1).value), t(row.getCell(2).value)]); row.eachCell((x, col) => { if (col !== 2) celdas.push(t(x.value)); }); } });
      ok(cods.length === (s.name === "GRI" ? 37 : 17) && new Set(cods).size === cods.length && cods.every(Boolean), `${s.name}: ${cods.length} filas, una por código`);
      ok(!celdas.some((x) => x.startsWith("[")), `${s.name}: ninguna celda empieza con «[»`);
      const voc = celdas.flatMap((x) => vocabularioEnCeldaExportada(x));
      ok(voc.length === 0, `${s.name}: sin vocabulario de plataforma en código y respuesta${voc.length ? ` (${[...new Set(voc)].join(", ")})` : ""}`);
      // La columna «Requisito» es texto LITERAL de la norma (decisión de Esteban): si trae un término del glosario de
      // CLAUDE.md §5, es la norma la que lo dice. Se reporta como aviso para la decisión de §5, no se reescribe.
      const literal = requisitos.map(([cod, txt]) => [cod, vocabularioEnCeldaExportada(txt)]).filter(([, v]) => v.length);
      if (literal.length) console.log(`  ⚠ ${s.name}: texto literal de la norma con términos del glosario de §5 (decisión pendiente): ${literal.map(([c, v]) => `${c} (${v.join(", ")})`).join("; ")}`);
    }
    ok(/GRI 2 \(2021\)/.test(w.description ?? "") && /SASB FN-CB \(2025-12\)/.test(w.description ?? ""), `edición en las propiedades: ${w.description}`);
  }

  console.log("\nD. Excel de taxonomía");
  const x = await bajar(`/admin/cobertura/export-taxonomia?reporte=${REPORTE}`);
  ok(x.status === 200, `export-taxonomia: ${x.status}`);
  if (x.buf) {
    const w = await libro(x.buf);
    let ajenos = 0;
    w.eachSheet((s) => s.eachRow((row) => row.eachCell((cell) => { if (/^(GRI \d|FN-CB-)/.test(t(cell.value))) ajenos++; })));
    ok(ajenos === 0, `ninguna celda con código GRI o SASB (${ajenos})`);
  }
} catch (e) {
  fallas.push(`excepción: ${e.message}`);
  console.log(`  ✗ excepción: ${e.message}`);
} finally {
  console.log("\nRestauración");
  if (!antes) psql(`delete from perfil_emisor where tenant_id = '${TENANT}'`);
  else ponerSector(antes.sector_sasb);
  const ahora = psql(`select coalesce(json_build_object('sector_sasb', sector_sasb)::text, '') from perfil_emisor where tenant_id = '${TENANT}'`);
  ok(antes ? JSON.stringify(JSON.parse(ahora)) === JSON.stringify(antes) : ahora === "", antes ? "sector SASB como antes" : "sin fila de perfil, como antes");
  psql(`delete from datapoints_taxonomia where codigo = 'E2E-SIN-EDICION'`);
}
console.log(fallas.length ? `\n✗ ${fallas.length} falla(s).` : "\n✓ Catálogo GRI/SASB en orden.");
process.exit(fallas.length ? 1 : 0);
