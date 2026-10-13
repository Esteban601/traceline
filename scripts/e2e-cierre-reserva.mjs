#!/usr/bin/env node
// =============================================================================
// E2E · fix/cierre-reserva: las dos observaciones de Codex sobre el PR #18
// (autorizadas por Esteban el 13 de octubre de 2026).
//
//   ANTHROPIC_API_KEY=e2e-sin-llave ANTHROPIC_BASE_URL=http://127.0.0.1:9 \
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-cierre-reserva.mjs [baseUrl]          (default http://localhost:3016)
//
// SOLO contra el stack local, con la app de la rama corriendo contra él. Costo 0:
// la verificación del cierre apunta a un puerto cerrado y falla al instante (sin
// verificación no se cierra nada). Trabaja sobre un documento de prueba de
// Empresa Demo con un libro de un hecho; lo borra todo al terminar.
//
//   1. La reserva lleva identificador: reclamar devuelve uno y un segundo
//      reclamo no; el estado final conserva el identificador.
//   2. Latido: cerrarPendientes lo llama antes de cada verificación; si dice que
//      la reserva se perdió, se detiene con ReservaPerdida sin escribir.
//   3. Un identificador viejo no cambia el estado de la reserva vigente.
//   4. POST generar → 409 con el cierre de la corrida anterior en curso.
//   5. Pantalla: tras el 202 del cierre, el botón dice «Cerrando pendientes…» y
//      está desactivado hasta que el cierre termina; después vuelve «Generar
//      suplemento». La red se simula en el navegador (sin corrida ni modelo).
// =============================================================================
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";
import { cerrarPendientes, completarCierre, reclamarCierre, ReservaPerdida } from "../lib/suplemento/hechos/cierre.ts";
import { validarCruzado } from "../lib/suplemento/hechos/cruzado.ts";

const BASE = process.argv[2] || "http://localhost:3016";
const URL_SB = "http://127.0.0.1:54321";
// Llaves PÚBLICAS de demostración del stack local de Supabase (las mismas de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICIO = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const CLAVE = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";

if (!/127\.0\.0\.1|localhost/.test(BASE)) { console.error("✗ Solo contra una app local."); process.exit(2); }
if (!/^http:\/\/127\.0\.0\.1:9\b/.test(process.env.ANTHROPIC_BASE_URL ?? "")) { console.error("✗ Falta ANTHROPIC_BASE_URL=http://127.0.0.1:9 (la verificación no debe salir a la red)."); process.exit(2); }

const psql = (sql, replica = false) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atq", "-c", `${replica ? "set session_replication_role = replica; " : ""}${sql}`], {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };
const db = createClient(URL_SB, SERVICIO, { auth: { persistSession: false } });
const estado = () => JSON.parse(psql(`select json_build_object('estado', cierre_estado, 'reserva', cierre_resultado->>'reserva')::text from documentos_generados where id=${lit(DOC)}`));

// --- Preparación: el 15 deja pendiente lo que el 17 afirma con un hecho suyo ---
const banderaAntes = psql(`select generador_activo from tenants where id=${lit(TENANT)}`);
psql(`update tenants set generador_activo = true where id=${lit(TENANT)}`);
const LIBRO = psql(`insert into libros_hechos (tenant_id, reporte_id, estado) values (${lit(TENANT)}, ${lit(REPORTE)}, 'listo') returning id`).split("\n")[0];
const ENUNCIADO = "La Dirección de Riesgos identifica y mide los riesgos climáticos con la metodología corporativa de riesgos.";
const HECHO = psql(`insert into hechos (libro_id, tenant_id, clave, enunciado, tipo, rango_fuente, fuente_tipo, fuente_id, fuente_detalle, extracto, bloque_dueno, estado) values (${lit(LIBRO)}, ${lit(TENANT)}, 'e2e.metodologia', ${lit(ENUNCIADO)}, 'responsable', 'perfil', 'perfil', 'perfil:gobierno', 'Perfil (e2e)', ${lit(ENUNCIADO)}, 17, 'vigente') returning id`).split("\n")[0];
const VERSION_DOC = Number(psql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id=${lit(REPORTE)}`));
const DOC = psql(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos) values (${lit(TENANT)}, ${lit(REPORTE)}, ${VERSION_DOC}, 'borrador', '{}') returning id`).split("\n")[0];
const ANCLAS17 = JSON.stringify([{ oracion: ENUNCIADO, hechos: [{ id: "h1", hecho: HECHO, fuente: "perfil:gobierno" }] }]);
psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado, texto, origen_texto, fuentes, pendientes, generado_en, libro_id, anclas) values (${lit(DOC)}, 17, 'gerencia_controles', 'Papel de la gerencia y controles', 'II · Gobernanza', 'es', 'borrador', ${lit(ENUNCIADO)}, 'generacion', '[]', '[]', now(), ${lit(LIBRO)}, ${lit(ANCLAS17)}::jsonb)`);
psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado, texto, origen_texto, fuentes, pendientes, generado_en, libro_id, anclas) values (${lit(DOC)}, 15, 'roles_organo', 'Roles y responsabilidades del órgano de gobierno', 'II · Gobernanza', 'es', 'borrador', ${lit("El Consejo supervisa el clima. [Pendiente: metodología corporativa con la que la Dirección de Riesgos identifica y mide los riesgos climáticos — solicitud e2e].")}, 'generacion', '[]', '[]', now(), ${lit(LIBRO)}, '[]'::jsonb)`);
const inicioPrueba = psql(`select now()`);

const nav = await chromium.launch();
try {
  console.log("\n0. El caso de prueba tiene un candidato de cierre");
  const ds = await validarCruzado(db, DOC);
  ok(ds.some((d) => d.tipo === "pendiente_de_afirmado" && d.bloque === 15 && d.otroBloque === 17 && d.duenoAfirma), `el validador propone cerrar el pendiente del 15 con el 17 (${ds.map((d) => `${d.bloque}:${d.tipo}`).join(", ") || "nada"})`);

  console.log("\n1. Reserva con identificador");
  const reserva = await reclamarCierre(db, DOC);
  ok(typeof reserva === "string" && reserva.length === 36 && estado().reserva === reserva && estado().estado === "en_cola", "reclamar devuelve el identificador y lo deja en el documento (en_cola)");
  ok((await reclamarCierre(db, DOC)) === null, "un segundo reclamo con la reserva viva → null");

  console.log("\n2. Latido");
  let latidos = 0;
  const r = await cerrarPendientes(db, DOC, async () => { latidos++; return true; });
  ok(latidos >= 1 && r.cierres.length === 0, `el latido se llamó antes de verificar (${latidos}); la verificación falló sin red y no cerró nada`);
  const textoAntes = psql(`select md5(texto) from documentos_bloques where documento_id=${lit(DOC)} and numero=15`);
  let perdida = false;
  try { await cerrarPendientes(db, DOC, async () => false); } catch (e) { perdida = e instanceof ReservaPerdida; }
  ok(perdida && psql(`select md5(texto) from documentos_bloques where documento_id=${lit(DOC)} and numero=15`) === textoAntes, "con la reserva perdida se detiene con ReservaPerdida y no escribe");

  console.log("\n3. Los cambios de estado exigen la reserva");
  const fin = await completarCierre(db, DOC, reserva);
  ok(fin !== null && estado().estado === "listo" && estado().reserva === reserva, "con su identificador: termina en «listo» y conserva la reserva");
  const otra = await reclamarCierre(db, DOC);
  const viejo = await completarCierre(db, DOC, reserva);
  ok(viejo === null && estado().estado === "en_cola" && estado().reserva === otra, "con el identificador viejo: no toca el estado de la reserva vigente");
  await completarCierre(db, DOC, otra);

  console.log("\n4. Generar con un cierre en curso");
  const jar = new Map();
  const sb = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error: eLogin } = await sb.auth.signInWithPassword({ email: "admin@irstrat.example", password: CLAVE });
  if (eLogin) throw new Error("login staff");
  const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
  psql(`update documentos_generados set cierre_estado = 'ejecutando', cierre_actualizado_en = now() where id=${lit(DOC)}`);
  const g = await fetch(`${BASE}/api/suplemento/${REPORTE}/generar`, { method: "POST", headers: { cookie: cookie(), "content-type": "application/json" }, body: "{}" });
  const cuerpo = await g.json().catch(() => ({}));
  ok(g.status === 409 && /cierre/i.test(cuerpo.error ?? ""), `POST generar → ${g.status} «${cuerpo.error ?? ""}»`);
  ok(psql(`select count(*) from documentos_bloques where documento_id=${lit(DOC)} and estado = 'en_cola'`) === "0", "el 409 no reabrió el documento");
  psql(`update documentos_generados set cierre_estado = 'listo' where id=${lit(DOC)}`);

  console.log("\n5. La pantalla espera al cierre antes de ofrecer «Generar»");
  const ctx = await nav.newContext();
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, url: BASE })));
  const p = await ctx.newPage();
  let consultas = 0;
  await p.route("**/api/suplemento/*/generar", (rt) => rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documentoId: DOC, porGenerar: [], primero: undefined }) }));
  await p.route("**/api/suplemento/*/cierre", (rt) => {
    if (rt.request().method() === "POST") return rt.fulfill({ status: 202, contentType: "application/json", body: '{"estado":"en_cola"}' });
    consultas++;
    return rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ estado: consultas < 3 ? "ejecutando" : "listo", resultado: null }) });
  });
  await p.goto(`${BASE}/admin/cobertura/suplemento?reporte=${REPORTE}`, { timeout: 90000 });
  await p.getByRole("button", { name: "Generar suplemento" }).click();
  const cerrando = p.getByRole("button", { name: /Cerrando pendientes/ });
  await cerrando.waitFor({ timeout: 15000 });
  ok(await cerrando.isDisabled(), "tras el 202: «Cerrando pendientes…» y desactivado");
  await p.getByRole("button", { name: "Generar suplemento" }).waitFor({ timeout: 30000 });
  ok(consultas >= 3 && (await p.getByRole("button", { name: "Generar suplemento" }).isEnabled()), `con el cierre en «listo» vuelve «Generar suplemento» (${consultas} consultas del estado)`);
} finally {
  await nav.close();
  console.log("\nLimpieza");
  psql(`delete from documentos_generados where id=${lit(DOC)}`);
  psql(`delete from hechos where libro_id=${lit(LIBRO)}`);
  psql(`delete from libros_hechos where id=${lit(LIBRO)}`);
  psql(`delete from bitacora where created_at >= ${lit(inicioPrueba)}::timestamptz and entidad_id = ${lit(DOC)}`, true);
  psql(`update tenants set generador_activo = ${banderaAntes === "t"} where id=${lit(TENANT)}`);
  ok(psql(`select count(*) from documentos_generados where id=${lit(DOC)}`) === "0", "sin restos del documento de prueba");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
