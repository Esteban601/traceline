#!/usr/bin/env node
// =============================================================================
// E2E · fix/pre-v40-b (autorizado por Esteban el 13 de octubre de 2026).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-pre-v40-b.mjs [baseUrl]          (default http://localhost:3016)
//
// SOLO contra el stack local, con la app de la rama corriendo contra él. Sin
// modelo, costo 0. Trabaja sobre un documento de prueba de Empresa Demo; lo
// borra todo al terminar.
//
//   1. El validador de remisiones degrada en el reintento: la regla
//      (aceptaConRemisionesSinAncla) acepta en el segundo intento cuando lo único
//      rechazado son remisiones sin ancla, y en ningún otro caso. La nota del
//      validador llega al validador cruzado como «remision_sin_ancla» y a la
//      revisión en «observaciones del validador»; el bloque sigue en borrador.
//   2. La reapertura toma la reserva del cierre (P1 de Codex sobre el PR #20):
//      con una reserva viva, generar → 409 y la reserva queda intacta; sin ella,
//      generar → 200 y al terminar suelta la reserva, así que el cierre del final
//      de la corrida puede tomarla (202).
//   3. Pasados 20 min con el cierre en curso, la pantalla dice «El cierre sigue en
//      curso», no da la corrida por terminada ni ofrece «Generar» (P2 de Codex
//      sobre el PR #20). La red y el reloj se simulan en el navegador.
// =============================================================================
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";
import { aceptaConRemisionesSinAncla } from "../lib/suplemento/hechos/remisiones.ts";
import { validarCruzado } from "../lib/suplemento/hechos/cruzado.ts";

const BASE = process.argv[2] || "http://localhost:3016";
const URL_SB = "http://127.0.0.1:54321";
// Llave PÚBLICA de demostración del stack local de Supabase (la misma de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const CLAVE = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
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

// --- 1a. La regla, sin base ------------------------------------------------------
console.log("\n1. El validador de remisiones degrada en el reintento");
const base = { remisiones: 0, deterministas: 0, inventadas: 0, prohibidas: 0, marcadores: 0, sinRespaldo: 0, cobertura: 0 };
ok(aceptaConRemisionesSinAncla(2, { ...base, remisiones: 2, deterministas: 2 }), "segundo intento, solo remisiones sin ancla → se acepta");
ok(!aceptaConRemisionesSinAncla(1, { ...base, remisiones: 2, deterministas: 2 }), "primer intento → no (hay reintento)");
ok(!aceptaConRemisionesSinAncla(2, { ...base, remisiones: 1, deterministas: 2 }), "segundo intento con otro validador además → no");
ok(!aceptaConRemisionesSinAncla(2, { ...base, remisiones: 1, deterministas: 1, sinRespaldo: 1 }), "segundo intento con una cifra sin respaldo → no");
ok(!aceptaConRemisionesSinAncla(2, { ...base, remisiones: 1, deterministas: 1, inventadas: 1 }), "segundo intento con una fuente inventada → no");
ok(!aceptaConRemisionesSinAncla(2, base), "sin remisiones → no hay nada que degradar");

// --- Preparación ------------------------------------------------------------------
const jar = new Map();
const db = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: CLAVE });
if (eLogin) throw new Error("login staff");
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
const ruta = (metodo, camino, cuerpo) => fetch(`${BASE}${camino}`, { method: metodo, headers: { cookie: cookie(), "content-type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });

const tenantAntes = psql(`select generador_activo || '|' || generaciones_mes_max from tenants where id=${lit(TENANT)}`);
psql(`update tenants set generador_activo = true, generaciones_mes_max = 100 where id=${lit(TENANT)}`);
const inicioPrueba = psql(`select now()`);
const LIBRO = psql(`insert into libros_hechos (tenant_id, reporte_id, estado) values (${lit(TENANT)}, ${lit(REPORTE)}, 'listo') returning id`).split("\n")[0];
const VERSION_DOC = Number(psql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id=${lit(REPORTE)}`));
const DOC = psql(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos) values (${lit(TENANT)}, ${lit(REPORTE)}, ${VERSION_DOC}, 'borrador', '{}') returning id`).split("\n")[0];
const NOTA = "«los esfuerzos indirectos se describen en la sección «Esfuerzos indirectos de reducción y adaptación»» remite al bloque 23 sin el ancla [B23.k] del hecho del mapa al que remite: ánclalo, o si ninguno de sus hechos es lo que remites, no remitas ahí.";
const PEND = JSON.stringify([{ campo: "nota_revision", motivo: NOTA, cubeta: "validador", etiqueta: "remision_sin_ancla" }]);
psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado, texto, origen_texto, fuentes, pendientes, generado_en, libro_id) values (${lit(DOC)}, 25, 'recursos_progreso', 'Recursos asignados y progreso de planes', 'III · Nuestra estrategia', 'es', 'borrador', 'Texto del bloque veinticinco aceptado en el reintento. Los esfuerzos indirectos se describen en la sección «Esfuerzos indirectos de reducción y adaptación».', 'generacion', '[]', ${lit(PEND)}::jsonb, now(), ${lit(LIBRO)})`);

const nav = await chromium.launch();
try {
  // --- 1b. La observación llega al cruzado y a la revisión ---------------------------
  const ds = await validarCruzado(db, DOC);
  const d = ds.find((x) => x.bloque === 25 && x.tipo === "remision_sin_ancla");
  ok(!!d && d.otroBloque === 23, `validador cruzado: «remision_sin_ancla» del 25 al 23 (${ds.map((x) => `${x.bloque}:${x.tipo}`).join(", ") || "nada"})`);
  ok(psql(`select estado from documentos_bloques where documento_id=${lit(DOC)} and numero=25`) === "borrador", "el bloque sigue en borrador");
  const ctx = await nav.newContext();
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, url: BASE })));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/cobertura/suplemento/${DOC}`, { timeout: 90000 });
  await p.getByRole("button", { name: /Recursos asignados/ }).first().click();
  const obs = p.locator('[data-cubeta="validador"]');
  ok((await obs.count()) === 1 && (await obs.innerText()).includes("remite al bloque 23"), "la revisión la muestra en «observaciones del validador»");
  ok((await p.getByText("observaciones del validador").count()) > 0, "con el título de la cubeta");

  // --- 2. La reapertura toma la reserva del cierre ------------------------------------
  console.log("\n2. La reapertura toma la reserva del cierre");
  const reservaAjena = "00000000-0000-4000-8000-000000000001";
  psql(`update documentos_generados set cierre_estado = 'en_cola', cierre_resultado = '{"reserva":"${reservaAjena}"}', cierre_actualizado_en = now() where id=${lit(DOC)}`);
  const g1 = await ruta("POST", `/api/suplemento/${REPORTE}/generar`, {});
  ok(g1.status === 409, `con un cierre reservado, generar → ${g1.status}`);
  ok(psql(`select cierre_estado || '|' || (cierre_resultado->>'reserva') from documentos_generados where id=${lit(DOC)}`) === `en_cola|${reservaAjena}`, "y la reserva ajena queda intacta");
  psql(`update documentos_generados set cierre_estado = 'listo', cierre_resultado = null where id=${lit(DOC)}`);
  const g2 = await ruta("POST", `/api/suplemento/${REPORTE}/generar`, { confirmarEdiciones: true });
  const cuerpo2 = await g2.json().catch(() => ({}));
  ok(g2.status === 200 && cuerpo2.documentoId === DOC, `sin cierre en curso, generar reabre el documento → ${g2.status}`);
  ok(psql(`select coalesce(cierre_estado, 'null') || '|' || coalesce(cierre_resultado::text, 'null') from documentos_generados where id=${lit(DOC)}`) === "null|null", "al terminar, generar suelta la reserva");
  const c = await ruta("POST", `/api/suplemento/${DOC}/cierre`);
  ok(c.status === 202, `el cierre del final de la corrida la toma → ${c.status}`);

  // --- 3. «Sigue en curso» pasados 20 min ----------------------------------------------
  console.log("\n3. La pantalla no da por terminado un cierre que sigue en curso");
  const p2 = await ctx.newPage();
  await p2.clock.install({ time: new Date() });
  await p2.route("**/api/suplemento/*/generar", (rt) => rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documentoId: DOC, porGenerar: [] }) }));
  await p2.route("**/api/suplemento/*/cierre", (rt) =>
    rt.fulfill({ status: rt.request().method() === "POST" ? 202 : 200, contentType: "application/json", body: '{"estado":"ejecutando","resultado":null}' })
  );
  await p2.goto(`${BASE}/admin/cobertura/suplemento?reporte=${REPORTE}`, { timeout: 90000 });
  await p2.getByRole("button", { name: "Generar suplemento" }).click();
  await p2.getByRole("button", { name: /Cerrando pendientes/ }).waitFor({ timeout: 15000 });
  await p2.clock.fastForward("21:00");
  const sigue = p2.getByRole("button", { name: "El cierre sigue en curso" });
  await sigue.waitFor({ timeout: 15000 });
  ok(await sigue.isDisabled(), "a los 21 min: «El cierre sigue en curso», desactivado");
  ok((await p2.getByRole("button", { name: "Generar suplemento" }).count()) === 0, "no vuelve a ofrecer «Generar suplemento»");
  ok((await p2.getByText("Documento generado.").count()) === 0, "no muestra «Documento generado.»");
} finally {
  await nav.close();
  console.log("\nLimpieza");
  psql(`delete from documentos_generados where id=${lit(DOC)}`);
  psql(`delete from libros_hechos where id=${lit(LIBRO)}`);
  psql(`delete from bitacora where created_at >= ${lit(inicioPrueba)}::timestamptz and entidad_id = ${lit(DOC)}`, true);
  const [g, m] = tenantAntes.split("|");
  psql(`update tenants set generador_activo = ${g === "true" || g === "t"}, generaciones_mes_max = ${m} where id=${lit(TENANT)}`);
  ok(psql(`select count(*) from documentos_generados where id=${lit(DOC)}`) === "0", "sin restos del documento de prueba");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
