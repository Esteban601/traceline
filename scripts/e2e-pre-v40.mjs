#!/usr/bin/env node
// =============================================================================
// E2E · fix/pre-v40: las tres observaciones de Codex sobre el PR #17 y el tope
// del libro y de la coherencia (decisiones de Esteban del 11 de octubre de 2026).
//
//   node scripts/e2e-pre-v40.mjs [baseUrl]     (default http://localhost:3016)
//
// SOLO contra el stack local, con la app de la rama corriendo contra él y SIN
// ANTHROPIC_API_KEY (costo 0): el cierre no verifica nada y la coherencia
// encadenada termina en «error» por falta de llave, que basta para probar el
// orden. Trabaja sobre un documento de prueba de Empresa Demo y un libro vacío;
// lo borra todo al terminar.
//
//   1. P1: un editorial quitado («no_seleccionado») con texto viejo que remite a
//      una plantilla no aparece en el validador cruzado; el mismo bloque
//      seleccionado sí (control).
//   2. Restaurar una versión repone su cobertura, sus anclas y su libro, y la
//      revisión muestra ese respaldo; una versión sin respaldo (anterior a la
//      migración) restaura con cobertura y anclas vacías.
//   3. Cierre fuera de la petición: POST → 202 en menos de 30 s; estado
//      en_cola → … → listo; la coherencia encadenada se abre DESPUÉS del cierre;
//      409 con un cierre en curso (cierre y coherencia), y un cierre abandonado
//      se puede volver a reservar; la pantalla muestra el estado.
//   4. Tope: sin corridas disponibles, el libro y la coherencia manuales → 429;
//      el cierre no cuenta → 202.
// =============================================================================
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3016";
const URL_SB = "http://127.0.0.1:54321";
// Llave PÚBLICA de demostración del stack local de Supabase (la misma de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const CLAVE = "Demo2025!";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const T3 = "Bases de preparación: marco y alivios transitorios";
const T16 = "Supervisión de la estrategia, objetivos y remuneración";

const psql = (sql, replica = false) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atq", "-c", `${replica ? "set session_replication_role = replica; " : ""}${sql}`], {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const jsonb = (v) => `${lit(JSON.stringify(v))}::jsonb`;

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
const { error: eLogin } = await sb.auth.signInWithPassword({ email: "admin@irstrat.example", password: CLAVE });
if (eLogin) throw new Error("login staff");
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
const ruta = (metodo, camino, cuerpo) => fetch(`${BASE}${camino}`, { method: metodo, headers: { cookie: cookie(), "content-type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });

// --- Preparación ---------------------------------------------------------------
const tenantAntes = psql(`select generador_activo || '|' || generaciones_mes_max from tenants where id=${lit(TENANT)}`);
psql(`update tenants set generador_activo = true, generaciones_mes_max = 100 where id=${lit(TENANT)}`);
const LIBRO = psql(`insert into libros_hechos (tenant_id, reporte_id, estado) values (${lit(TENANT)}, ${lit(REPORTE)}, 'listo') returning id`).split("\n")[0];
const VERSION_DOC = Number(psql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id=${lit(REPORTE)}`));
const DOC = psql(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos) values (${lit(TENANT)}, ${lit(REPORTE)}, ${VERSION_DOC}, 'borrador', '{}') returning id`).split("\n")[0];
const bloque = (n, clave, titulo, seccion, estado, texto, extra = "") =>
  psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado, texto, origen_texto, fuentes, pendientes, generado_en, libro_id${extra ? ", " + extra.split("=")[0] : ""}) values (${lit(DOC)}, ${n}, ${lit(clave)}, ${lit(titulo)}, ${lit(seccion)}, 'es', ${lit(estado)}, ${lit(texto)}, 'generacion', '[]', '[]', now(), ${lit(LIBRO)}${extra ? ", " + extra.slice(extra.indexOf("=") + 1) : ""})`);
// El 18 es editorial; quitado conserva el texto viejo, que remite a una plantilla.
bloque(18, "estructura_gobierno", "Estructura de gobierno corporativo y organigrama", "II · Gobernanza", "no_seleccionado",
  `La estructura del gobierno corporativo se describe en la sección «${T3}».`);
bloque(15, "roles_organo", "Roles y responsabilidades del órgano de gobierno", "II · Gobernanza", "borrador",
  "El Consejo de Administración supervisa los riesgos y oportunidades relacionados con el clima.");
const C1 = [{ codigo: "NIIF S2 6 (a)(iii)", estado: "cubierto", bloque: null, hechos: ["h1"], comentario: "respaldo de la versión 1" }];
const A1 = [{ oracion: "Primera versión del bloque dieciséis.", hechos: [{ id: "h1", hecho: null, fuente: "fuente-v1-e2e" }] }];
const C2 = [{ codigo: "NIIF S2 6 (a)(iv)", estado: "cubierto", bloque: null, hechos: ["h2"], comentario: "respaldo de la versión 2" }];
const A2 = [{ oracion: "Segunda versión del bloque dieciséis.", hechos: [{ id: "h2", hecho: null, fuente: "fuente-v2-e2e" }] }];
bloque(16, "supervision_estrategia", T16, "II · Gobernanza", "borrador", "Primera versión del bloque dieciséis.", `cobertura, anclas=${jsonb(C1)}, ${jsonb(A1)}`);
psql(`update documentos_bloques set texto = 'Segunda versión del bloque dieciséis.', cobertura = ${jsonb(C2)}, anclas = ${jsonb(A2)}, origen_texto = 'generacion', generado_en = now() + interval '1 second' where documento_id=${lit(DOC)} and numero=16`);
const inicioPrueba = psql(`select now()`);

const nav = await chromium.launch();
try {
  // --- 1. P1 -------------------------------------------------------------------
  console.log("\n1. Un editorial quitado no entra al validador cruzado");
  const cruzado = async () => (await (await ruta("GET", `/api/suplemento/${DOC}/cruzado`)).json()).discrepancias ?? [];
  const d1 = await cruzado();
  ok(!d1.some((d) => d.bloque === 18), `quitado: 0 discrepancias del 18 (${d1.length} en total)`);
  psql(`update documentos_bloques set estado = 'borrador' where documento_id=${lit(DOC)} and numero=18`);
  const d2 = await cruzado();
  ok(d2.some((d) => d.bloque === 18 && d.tipo === "remision_a_plantilla"), "control: seleccionado, el 18 sí aparece (remite a la plantilla 3)");
  psql(`update documentos_bloques set estado = 'no_seleccionado' where documento_id=${lit(DOC)} and numero=18`);

  // --- 2. Restauración con su respaldo ---------------------------------------------
  console.log("\n2. Restaurar repone cobertura, anclas y libro");
  const vs = () => JSON.parse(psql(`select coalesce(json_agg(json_build_object('id', id, 'version', version, 'respaldo', respaldo, 'libro_id', libro_id) order by version), '[]') from documentos_bloques_versiones where documento_id=${lit(DOC)} and numero=16`));
  const [v1, v2] = vs();
  ok(v1?.respaldo?.cobertura?.[0]?.codigo === C1[0].codigo && v1?.libro_id === LIBRO, "la v1 guardó su cobertura y su libro");
  ok(v2?.respaldo?.anclas?.[0]?.oracion === A2[0].oracion, "la v2 guardó sus anclas");
  const ctx = await nav.newContext();
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, url: BASE })));
  const p = await ctx.newPage();
  const abrir16 = async () => {
    await p.goto(`${BASE}/admin/cobertura/suplemento/${DOC}`, { timeout: 90000 });
    await p.getByRole("button", { name: new RegExp(T16.slice(0, 20)) }).first().click();
  };
  const restaurar = async (version) => {
    await abrir16();
    await p.locator('[data-historial="16"] summary').click();
    await p.locator(`[data-historial="16"] [data-version="${version}"]`).getByRole("button", { name: "Restaurar" }).click();
    await p.getByRole("dialog").getByRole("button", { name: "Restaurar" }).click();
  };
  const fila16 = () => JSON.parse(psql(`select json_build_object('texto', texto, 'cobertura', cobertura, 'anclas', anclas, 'libro_id', libro_id)::text from documentos_bloques where documento_id=${lit(DOC)} and numero=16`));
  await restaurar(1);
  ok(await hasta(() => fila16().texto.startsWith("Primera")), "restaurada la v1");
  const r1 = fila16();
  ok(r1.cobertura?.[0]?.codigo === C1[0].codigo && r1.anclas?.[0]?.oracion === A1[0].oracion && r1.libro_id === LIBRO, "el bloque lleva la cobertura, las anclas y el libro de la v1");
  await abrir16();
  ok((await p.locator(`[data-cobertura="${C1[0].codigo}"]`).count()) > 0 && (await p.locator(`[data-cobertura="${C2[0].codigo}"]`).count()) === 0, "la revisión muestra la cobertura de la v1 y no la de la v2");
  await p.locator('[data-anclas="16"] summary').click();
  ok((await p.locator('[data-anclas="16"]').innerText()).includes("fuente-v1-e2e"), "la revisión muestra las anclas de la v1");

  // Una versión sin respaldo (anterior a la migración): se simula vaciándolo.
  psql(`update documentos_bloques_versiones set respaldo = null, libro_id = null where id=${lit(v2.id)}`, true);
  await restaurar(2);
  ok(await hasta(() => fila16().texto.startsWith("Segunda")), "restaurada la v2, sin respaldo");
  const r2 = fila16();
  ok(r2.cobertura === null && r2.anclas === null && r2.libro_id === null, "sin respaldo guardado, la cobertura, las anclas y el libro quedan vacíos");

  // --- 3. Cierre fuera de la petición ------------------------------------------------
  console.log("\n3. Cierre y coherencia fuera de la petición");
  const t0 = Date.now();
  const c = await ruta("POST", `/api/suplemento/${DOC}/cierre`, { coherencia: true });
  const ms = Date.now() - t0;
  ok(c.status === 202 && ms < 30000, `POST cierre → ${c.status} en ${ms} ms`);
  const estadoCierre = async () => (await (await ruta("GET", `/api/suplemento/${DOC}/cierre`)).json());
  ok(await hasta(async () => (await estadoCierre()).estado === "listo"), "GET cierre → listo");
  const finCierre = psql(`select cierre_actualizado_en from documentos_generados where id=${lit(DOC)}`);
  ok(await hasta(() => psql(`select count(*) from observaciones_coherencia where documento_id=${lit(DOC)} and estado <> 'generando'`) === "1"), "la coherencia encadenada se abrió y terminó");
  const pasada = psql(`select origen || '|' || (created_at >= ${lit(finCierre)}::timestamptz) from observaciones_coherencia where documento_id=${lit(DOC)}`);
  ok(pasada === "fin_de_generacion|true", `la coherencia se abrió después del cierre, con origen «fin_de_generacion» (${pasada})`);

  psql(`update documentos_generados set cierre_estado = 'ejecutando', cierre_actualizado_en = now() where id=${lit(DOC)}`);
  ok((await ruta("POST", `/api/suplemento/${DOC}/cierre`)).status === 409, "con un cierre en curso, otro cierre → 409");
  ok((await ruta("POST", `/api/suplemento/${DOC}/coherencia`, { origen: "manual" })).status === 409, "con un cierre en curso, la coherencia → 409");
  await p.goto(`${BASE}/admin/cobertura/suplemento/${DOC}`, { timeout: 90000 });
  ok((await p.locator('[data-cierre-estado="ejecutando"]').innerText()).includes("Cerrando pendientes"), "la pantalla muestra el cierre en curso");
  psql(`update documentos_generados set cierre_actualizado_en = now() - interval '20 minutes' where id=${lit(DOC)}`);
  ok((await ruta("POST", `/api/suplemento/${DOC}/cierre`)).status === 202, "un cierre abandonado (20 min) se vuelve a reservar → 202");
  ok(await hasta(async () => (await estadoCierre()).estado === "listo"), "y termina en listo");
  await p.goto(`${BASE}/admin/cobertura/suplemento/${DOC}`, { timeout: 90000 });
  ok((await p.locator('[data-cierre-estado="listo"]').innerText()).includes("Cierre de pendientes:"), "la pantalla muestra el cierre terminado");

  // --- 4. Tope ----------------------------------------------------------------------
  console.log("\n4. El libro y la coherencia son parte de una generación");
  const usadas = Number(psql(`select count(*) from bitacora where tenant_id=${lit(TENANT)} and accion='suplemento_documento_abierto' and created_at >= date_trunc('month', now() at time zone 'UTC')`));
  if (usadas === 0) psql(`insert into bitacora (tenant_id, accion, entidad, entidad_id, detalle) values (${lit(TENANT)}, 'suplemento_documento_abierto', 'documentos_generados', ${lit(DOC)}, '{"e2e":"pre-v40"}')`);
  psql(`update tenants set generaciones_mes_max = ${Math.max(usadas, 1)} where id=${lit(TENANT)}`);
  const h = await ruta("POST", `/api/suplemento/${REPORTE}/hechos`, {});
  ok(h.status === 429, `libro sin corridas disponibles → ${h.status}`);
  const co = await ruta("POST", `/api/suplemento/${DOC}/coherencia`, { origen: "manual" });
  ok(co.status === 429, `coherencia manual sin corridas disponibles → ${co.status}`);
  const ci = await ruta("POST", `/api/suplemento/${DOC}/cierre`);
  ok(ci.status === 202, `el cierre no cuenta → ${ci.status}`);
  await hasta(async () => (await estadoCierre()).estado === "listo");
} finally {
  await nav.close();
  console.log("\nLimpieza");
  psql(`delete from documentos_generados where id=${lit(DOC)}`);
  psql(`delete from libros_hechos where id=${lit(LIBRO)}`);
  // Solo lo que escribió esta prueba (bitácora de solo altas: con réplica).
  psql(`delete from bitacora where created_at >= ${lit(inicioPrueba)}::timestamptz and (entidad_id = ${lit(DOC)} or detalle->>'e2e' = 'pre-v40')`, true);
  const [g, m] = tenantAntes.split("|");
  psql(`update tenants set generador_activo = ${g === "true" || g === "t"}, generaciones_mes_max = ${m} where id=${lit(TENANT)}`);
  ok(psql(`select count(*) from documentos_bloques_versiones where documento_id=${lit(DOC)}`) === "0", "sin restos del documento de prueba");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
