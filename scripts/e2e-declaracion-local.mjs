#!/usr/bin/env node
// =============================================================================
// E2E · declaración de cumplimiento contra el stack local (encargo
// s1-72-reserva-y-emisora, Fase 1).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-declaracion-local.mjs [baseUrl]          (default http://localhost:3016)
//
// SOLO contra el stack local, con la app de la rama corriendo contra él. NO llama
// al modelo: el bloque 2 es de plantilla (la app necesita una llave cualquiera en
// ANTHROPIC_API_KEY para aceptar la generación). Sobre Empresa Demo, con un
// Perfil temporal «la Emisora» si no hay Perfil; restaura todo al terminar.
//
//   1. Pantalla del régimen: el texto sin modo se rechaza; «Con reserva» con su
//      texto se guarda tal cual y queda en la bitácora (modo y caracteres).
//   2. Bloque 2 generado por la API: la declaración de la emisora, tal cual, con
//      la forma de referencia del Perfil y sin pendientes.
//   3. Sin declaración: el bloque 2 lleva el marcador y su pendiente.
// =============================================================================
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";
import { PENDIENTE_DECLARACION } from "../lib/suplemento/declaracion.ts";

const BASE = process.argv[2] || "http://localhost:3016";
const URL_SB = "http://127.0.0.1:54321";
// Llave PÚBLICA de demostración del stack local de Supabase (la misma de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const CLAVE = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const DEN = "Empresa Demo, S.A.B. de C.V.";
const RESERVA = "El presente informe se preparó procurando el cumplimiento de las Normas NIIF S1 y NIIF S2; la Emisora no declara en este ejercicio el cumplimiento de todos sus requerimientos.";

const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atq", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "postgres" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const lit = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };
async function hasta(cond, ms = 60000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 1000)); }
  return false;
}

if (!/127\.0\.0\.1|localhost/.test(BASE)) { console.error("✗ Solo contra una app local."); process.exit(2); }
const jar = new Map();
const sb = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
if ((await sb.auth.signInWithPassword({ email: "admin@irstrat.example", password: CLAVE })).error) throw new Error("login staff");
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
const post = (camino, cuerpo) => fetch(`${BASE}${camino}`, { method: "POST", headers: { cookie: cookie(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) });

// --- Preparación (se restaura en finally) ---------------------------------------
const original = JSON.parse(psql(`select json_build_object('m', declaracion_cumplimiento, 't', declaracion_cumplimiento_texto) from reportes where id=${lit(REPORTE)}`));
const banderaOriginal = psql(`select generador_activo from tenants where id=${lit(TENANT)}`);
const habiaPerfil = psql(`select count(*) from perfil_emisor where tenant_id=${lit(TENANT)}`) !== "0";
const formaOriginal = habiaPerfil ? psql(`select coalesce(forma_de_referencia, '∅') from perfil_emisor where tenant_id=${lit(TENANT)}`) : null;
const inicioBitacora = psql("select now()");
psql(`update tenants set generador_activo = true where id=${lit(TENANT)}`);
if (!habiaPerfil) psql(`insert into perfil_emisor (tenant_id, denominacion_formal, nombre_corto, forma_de_referencia) values (${lit(TENANT)}, ${lit(DEN)}, 'Empresa Demo', 'la Emisora')`);
else psql(`update perfil_emisor set forma_de_referencia = 'la Emisora' where tenant_id=${lit(TENANT)}`);
const DEN_PERFIL = psql(`select denominacion_formal from perfil_emisor where tenant_id=${lit(TENANT)}`);
psql(`update reportes set declaracion_cumplimiento = null, declaracion_cumplimiento_texto = null where id=${lit(REPORTE)}`);
const version = Number(psql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id=${lit(REPORTE)}`));
const DOC = psql(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos) values (${lit(TENANT)}, ${lit(REPORTE)}, ${version}, 'borrador', '{}') returning id`).split("\n")[0];
psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado) values (${lit(DOC)}, 2, 'presentacion', 'Presentación del informe (adopción, CNBV)', 'I · Introducción', 'es', 'en_cola')`);
const bloque2 = () => JSON.parse(psql(`select json_build_object('texto', texto, 'pendientes', pendientes, 'generado_en', generado_en) from documentos_bloques where documento_id=${lit(DOC)} and numero=2`));
async function generar() {
  const antes = bloque2().generado_en;
  const r = await post(`/api/suplemento/${DOC}/bloque/2`, {});
  ok(r.status === 202, `POST bloque/2 → ${r.status}`);
  return (await hasta(() => { const b = bloque2(); return !!b.texto && b.generado_en !== antes; })) ? bloque2() : null;
}

const nav = await chromium.launch();
try {
  console.log("\n1. Pantalla del régimen");
  const ctx = await nav.newContext();
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, url: BASE })));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/reportes`, { timeout: 90000 });
  // La fila del reporte es la que abre su formulario (dos reportes locales comparten el nombre): se abren en orden.
  const filas = p.locator("li").filter({ has: p.getByRole("button", { name: /Régimen S1 \/ S2|Cerrar régimen/ }) });
  let fila = null;
  for (let i = 0; i < (await filas.count()) && !fila; i++) {
    await filas.nth(i).getByRole("button", { name: "Régimen S1 / S2" }).click();
    if (await p.locator(`#declaracion-${REPORTE}`).count()) fila = filas.nth(i);
  }
  if (!fila) throw new Error("no se encontró el formulario del reporte de prueba");
  const area = p.locator(`#declaracion-${REPORTE}`);
  await area.fill(RESERVA);
  await fila.getByRole("button", { name: "Guardar régimen" }).click();
  ok(await fila.getByText("Indica si la declaración de cumplimiento es con o sin reserva.").waitFor({ timeout: 30000 }).then(() => true, () => false), "texto sin modo → rechazo en pantalla");
  ok(psql(`select coalesce(declaracion_cumplimiento, '∅') from reportes where id=${lit(REPORTE)}`) === "∅", "…y no se guarda nada");
  await fila.getByLabel(/Con reserva/).check();
  await area.fill(`  ${RESERVA}  `);
  await fila.getByRole("button", { name: "Guardar régimen" }).click();
  ok(await fila.getByText("Régimen actualizado.").waitFor({ timeout: 30000 }).then(() => true, () => false), "«Con reserva» con su texto → «Régimen actualizado.»");
  const guardado = JSON.parse(psql(`select json_build_object('m', declaracion_cumplimiento, 't', declaracion_cumplimiento_texto) from reportes where id=${lit(REPORTE)}`));
  ok(guardado.m === "con_reserva" && guardado.t === RESERVA, "en la base: con_reserva y el texto tal cual (sin espacios en los extremos)");
  const bit = psql(`select detalle::text from bitacora where entidad_id=${lit(REPORTE)} and accion='reporte_regimen_actualizado' and created_at >= ${lit(inicioBitacora)} order by created_at desc limit 1`);
  ok(/"declaracion_cumplimiento": ?"con_reserva"/.test(bit) && new RegExp(`"declaracion_caracteres": ?${RESERVA.length}`).test(bit), "bitácora: el modo y los caracteres de la declaración");

  console.log("\n2. Bloque 2 con la declaración de la emisora");
  const b = await generar();
  ok(!!b && b.texto.split("\n").includes(RESERVA), "el bloque 2 lleva la declaración tal cual, en su párrafo");
  ok(!!b && b.texto.startsWith(`${DEN_PERFIL} (en adelante, la Emisora) presenta`) && !/de conformidad con/.test(b.texto.replace(RESERVA, "")), "quién presenta, con la forma del Perfil, y sin «de conformidad con» de la plantilla");
  ok(!!b && Array.isArray(b.pendientes) && b.pendientes.length === 0, "sin pendientes");

  console.log("\n3. Sin declaración: marcador");
  psql(`update reportes set declaracion_cumplimiento = null, declaracion_cumplimiento_texto = null where id=${lit(REPORTE)}`);
  const m = await generar();
  ok(!!m && m.texto.includes(PENDIENTE_DECLARACION), "el bloque 2 lleva el marcador de la declaración");
  ok(!!m && m.pendientes.some((x) => x.motivo === PENDIENTE_DECLARACION), "y el pendiente que impide aprobarlo");
} catch (e) {
  ok(false, `error: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
} finally {
  await nav.close();
  psql(`delete from documentos_generados where id=${lit(DOC)}`);
  psql(`update reportes set declaracion_cumplimiento = ${lit(original.m)}, declaracion_cumplimiento_texto = ${lit(original.t)} where id=${lit(REPORTE)}`);
  psql(`update tenants set generador_activo = ${lit(banderaOriginal)}::boolean where id=${lit(TENANT)}`);
  if (!habiaPerfil) psql(`delete from perfil_emisor where tenant_id=${lit(TENANT)}`);
  else psql(`update perfil_emisor set forma_de_referencia = ${formaOriginal === "∅" ? "null" : lit(formaOriginal)} where tenant_id=${lit(TENANT)}`);
  const resto = JSON.parse(psql(`select json_build_object('m', declaracion_cumplimiento, 't', declaracion_cumplimiento_texto) from reportes where id=${lit(REPORTE)}`));
  ok(JSON.stringify(resto) === JSON.stringify(original) && psql(`select count(*) from documentos_generados where id=${lit(DOC)}`) === "0", "limpieza: reporte, Perfil y bandera restaurados; documento de prueba borrado");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
