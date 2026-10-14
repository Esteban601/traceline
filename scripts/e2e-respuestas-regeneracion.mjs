#!/usr/bin/env node
// =============================================================================
// E2E · regeneración de respuestas por cambio de bloque (encargo 2026-10-13-
// excel-respuestas-narrativas, Paso 5): al reaprobar un documento con un bloque
// cambiado, solo cambian las respuestas de sus datapoints; las de los bloques
// con el mismo texto aprobado se reutilizan sin llamada.
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-respuestas-regeneracion.mjs [baseUrl]          (default http://localhost:3016)
//
// SOLO contra el stack local, con la app de la rama SIN llave del modelo
// (ANTHROPIC_API_KEY=). Costo 0: las respuestas «del modelo» del documento A se
// simulan en la base; las que se regeneran salen del respaldo sin modelo.
//
//   1. Documento A (bloques 15 y 16) aprobado por la pantalla; sus respuestas se
//      marcan como del modelo.
//   2. Documento B: el 15 con el MISMO texto, el 16 cambiado; aprobado por la
//      pantalla.
//   3. Las respuestas del 15 son las de A (reutilizadas, origen modelo, con la
//      remisión recalculada); las del 16 se regeneraron; las de A ya no están.
// =============================================================================
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";
import { PROMPT_RESPUESTAS } from "../lib/suplemento/respuestas.ts";

const BASE = process.argv[2] || "http://localhost:3016";
const URL_SB = "http://127.0.0.1:54321";
// Llave PÚBLICA de demostración del stack local de Supabase (la misma de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const B15 = ["NIIF S2 6 (a)", "NIIF S2 6 (a)(i)", "NIIF S2 6 (a)(ii)"];
const B16 = ["NIIF S2 6 (a)(iii)", "NIIF S2 6 (a)(iv)", "NIIF S2 6 (a)(v)"];
if (!/127\.0\.0\.1|localhost/.test(BASE)) { console.error("✗ Solo contra una app local."); process.exit(2); }

const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atq", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const lista = (xs) => xs.map(lit).join(",");
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

const jar = new Map();
const db = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
if ((await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: "Demo2025!" })).error) throw new Error("login staff");
if (psql(`select count(*) from respuestas_datapoint where reporte_id=${lit(REPORTE)}`) !== "0") { console.error("✗ El reporte ya tiene respuestas en local."); process.exit(2); }
const genAntes = psql(`select generador_activo || '|' || generaciones_mes_max from tenants where id=${lit(TENANT)}`);
psql(`update tenants set generador_activo = true, generaciones_mes_max = 100 where id=${lit(TENANT)}`);
const LIBRO = psql(`insert into libros_hechos (tenant_id, reporte_id, estado) values (${lit(TENANT)}, ${lit(REPORTE)}, 'listo') returning id`).split("\n")[0];
const HECHO = psql(`insert into hechos (tenant_id, libro_id, clave, enunciado, extracto, tipo, rango_fuente, fuente_tipo, fuente_id, fuente_detalle, verificado, estado, bloque_dueno) values (${lit(TENANT)}, ${lit(LIBRO)}, 'consejo.supervision', 'El Consejo supervisa los riesgos climáticos.', 'El Consejo supervisa los riesgos climáticos.', 'responsable', 'validado', 'extracto', 'e2e', 'Extracto de prueba', true, 'vigente', 15) returning id`).split("\n")[0];
const docs = [];

function documento(texto16) {
  const v = Number(psql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id=${lit(REPORTE)}`));
  const doc = psql(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos) values (${lit(TENANT)}, ${lit(REPORTE)}, ${v}, 'borrador', '{}') returning id`).split("\n")[0];
  docs.push(doc);
  const bloque = (n, clave, titulo, seccion, codigos, texto) => {
    const cob = codigos.map((c) => ({ codigo: c, estado: "cubierto", bloque: null, hechos: [HECHO], comentario: "" }));
    const anclas = [{ oracion: texto, hechos: [{ id: "h1", hecho: HECHO, fuente: "e2e" }] }];
    psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado, texto, origen_texto, fuentes, pendientes, generado_en, libro_id, cobertura, anclas) values (${lit(doc)}, ${n}, ${lit(clave)}, ${lit(titulo)}, ${lit(seccion)}, 'es', 'borrador', ${lit(texto)}, 'generacion', '[]', '[]', now(), ${lit(LIBRO)}, ${lit(JSON.stringify(cob))}::jsonb, ${lit(JSON.stringify(anclas))}::jsonb)`);
  };
  bloque(15, "roles_organo", "Roles y responsabilidades del órgano de gobierno", "II · Gobernanza", B15, "El Consejo de Administración supervisa los riesgos climáticos con el apoyo de su comité.");
  bloque(16, "supervision_estrategia", "Supervisión de la estrategia, objetivos y remuneración", "II · Gobernanza", B16, texto16);
  return doc;
}

async function aprobar(nav, doc) {
  const ctx = await nav.newContext();
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, url: BASE })));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/cobertura/suplemento/${doc}`, { timeout: 180000 });
  await p.getByRole("button", { name: "Aprobar", exact: true }).click();
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    if (["listo", "error"].includes(psql(`select coalesce(respuestas_estado, '') from documentos_generados where id=${lit(doc)}`))) break;
  }
  await ctx.close();
  return psql(`select respuestas_estado from documentos_generados where id=${lit(doc)}`);
}

const nav = await chromium.launch();
try {
  console.log("\n1. Documento A aprobado; sus respuestas, «del modelo»");
  const A = documento("El Consejo revisa la estrategia climática cada año.");
  ok((await aprobar(nav, A)) === "listo", "A aprobado y con respuestas");
  psql(`update respuestas_datapoint set origen = 'modelo', prompt_version = ${lit(PROMPT_RESPUESTAS)}, texto = 'MODELO-A ' || clave || ' Ver sección 9 · Título viejo.' where documento_id=${lit(A)} and clave in (${lista([...B15, ...B16])})`);

  console.log("\n2. Documento B: el 15 igual, el 16 cambiado; aprobado");
  const B = documento("El Consejo revisa la estrategia climática cada semestre y aprueba los objetivos.");
  ok((await aprobar(nav, B)) === "listo", "B aprobado y con respuestas");

  console.log("\n3. Solo cambian las respuestas del bloque que cambió");
  const filas = (codigos) => psql(`select clave || '|' || origen || '|' || texto from respuestas_datapoint where documento_id=${lit(B)} and destino='taxonomia' and clave in (${lista(codigos)}) order by clave`).split("\n").filter(Boolean).map((l) => l.split("|"));
  const r15 = filas(B15);
  ok(r15.length === 3 && r15.every(([c, o, t]) => o === "modelo" && t.startsWith(`MODELO-A ${c}`)), "bloque 15 (mismo texto aprobado): las 3 respuestas se reutilizan de A, sin llamada");
  ok(r15.every(([, , t]) => /Ver sección 1 · Roles y responsabilidades del órgano de gobierno\.$/.test(t) && !t.includes("Título viejo")), "con la remisión recalculada para la numeración de B");
  const r16 = filas(B16);
  ok(r16.length === 3 && r16.every(([, o, t]) => o === "bloque" && !t.startsWith("MODELO-A")), "bloque 16 (cambiado): las 3 se regeneraron");
  ok(psql(`select count(*) from respuestas_datapoint where documento_id=${lit(A)}`) === "0", "las respuestas de A se reemplazaron por las de B");
} finally {
  await nav.close();
  console.log("\nLimpieza");
  for (const d of docs) psql(`delete from documentos_generados where id=${lit(d)}`);
  psql(`delete from libros_hechos where id=${lit(LIBRO)}`);
  const [gA, m] = genAntes.split("|");
  psql(`update tenants set generador_activo = ${gA === "true" || gA === "t"}, generaciones_mes_max = ${m} where id=${lit(TENANT)}`);
  ok(psql(`select count(*) from respuestas_datapoint where reporte_id=${lit(REPORTE)}`) === "0", "sin restos");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
