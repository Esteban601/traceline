#!/usr/bin/env node
// =============================================================================
// E2E · fix/pre-v40-c (autorizado por Esteban el 13 de octubre de 2026).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-pre-v40-c.mjs [baseUrl]          (default http://localhost:3016)
//
// SOLO contra el stack local, con la app de la rama corriendo contra él. Sin
// modelo, costo 0. Documento de prueba de Empresa Demo; se borra al terminar.
//
//   1. Solo la remisión SIN ANCLA es colocación: remitir a un bloque ausente, a
//      uno sin dueño o con un ancla inventada sigue siendo fallo (P1 de Codex
//      sobre el PR #22). La regla acepta en el reintento solo colocación.
//   2. «Texto reescrito de otro bloque» degrada: la nota llega al validador
//      cruzado como «repite_contenido» («repite contenido del bloque N») y a la
//      revisión en «observaciones del validador»; el bloque sigue en borrador.
//   3. generar revisa las ediciones a mano ANTES de tomar la reserva: el 428 no
//      toca el estado ni el resumen del cierre anterior (P2 de Codex sobre el #22).
// =============================================================================
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";
import { aceptaConObservacionesDeColocacion, remisionesSinAnclaTipadas } from "../lib/suplemento/hechos/remisiones.ts";
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

// --- 1. Tipos de rechazo y regla, sin base -----------------------------------------
console.log("\n1. Solo la remisión sin ancla es colocación");
const TIT = [
  { numero: 23, titulo: "Esfuerzos indirectos de reducción y adaptación" },
  { numero: 30, titulo: "Método de medición y datos de entrada" },
  { numero: 31, titulo: "Razones del enfoque de medición" },
  { numero: 25, titulo: "Recursos asignados y progreso de planes" },
];
const MAPA = new Map([[23, [{ id: "B23.1" }]]]);
const PRESENTES = new Set([23, 25, 30]);
const tipos = (texto, anclas = []) => remisionesSinAnclaTipadas(anclas, texto, 25, TIT, PRESENTES, MAPA).map((e) => e.tipo);
ok(tipos("Los esfuerzos de la cartera se describen en la sección «Esfuerzos indirectos de reducción y adaptación».").join() === "sin_ancla", "remite a un bloque del documento con hechos, sin ancla → «sin_ancla»");
ok(tipos("Las razones se describen en la sección «Razones del enfoque de medición».").join() === "ausente", "remite a un bloque que no va en el documento → «ausente»");
ok(tipos("Los datos de entrada se describen en la sección «Método de medición y datos de entrada».").join() === "sin_dueno", "remite a un bloque sin hechos en el mapa → «sin_dueno»");
const conAnclaFalsa = "Los esfuerzos de la cartera se describen en la sección «Esfuerzos indirectos de reducción y adaptación».";
ok(tipos(conAnclaFalsa, [{ oracion: conAnclaFalsa, ids: ["B23.9"] }]).join() === "inventada", "ancla un hecho que no está en el mapa → «inventada»");
ok(tipos(conAnclaFalsa, [{ oracion: conAnclaFalsa, ids: ["B23.1"] }]).length === 0, "con el ancla correcta → sin rechazo");
const base = { colocacion: 0, deterministas: 0, inventadas: 0, prohibidas: 0, marcadores: 0, sinRespaldo: 0, cobertura: 0 };
ok(aceptaConObservacionesDeColocacion(2, { ...base, colocacion: 2, deterministas: 2 }), "reintento con solo colocación (sin ancla + texto reescrito) → se acepta");
ok(!aceptaConObservacionesDeColocacion(2, { ...base, colocacion: 1, deterministas: 2 }), "reintento con colocación y una remisión ausente (dato) → fallo");
ok(!aceptaConObservacionesDeColocacion(1, { ...base, colocacion: 1, deterministas: 1 }), "primer intento → hay reintento");
ok(!aceptaConObservacionesDeColocacion(2, { ...base, colocacion: 1, deterministas: 1, sinRespaldo: 1 }), "reintento con una cifra sin respaldo → fallo");

// --- Preparación ------------------------------------------------------------------
const jar = new Map();
const db = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: CLAVE });
if (eLogin) throw new Error("login staff");
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
const tenantAntes = psql(`select generador_activo || '|' || generaciones_mes_max from tenants where id=${lit(TENANT)}`);
psql(`update tenants set generador_activo = true, generaciones_mes_max = 100 where id=${lit(TENANT)}`);
const inicioPrueba = psql(`select now()`);
const LIBRO = psql(`insert into libros_hechos (tenant_id, reporte_id, estado) values (${lit(TENANT)}, ${lit(REPORTE)}, 'listo') returning id`).split("\n")[0];
const VERSION_DOC = Number(psql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id=${lit(REPORTE)}`));
const RESUMEN = { cierres: [{ bloque: 16, dueno: 21, veredicto: "responde" }], costo_usd: 0.0084, reserva: "00000000-0000-4000-8000-0000000000aa" };
const DOC = psql(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos, cierre_estado, cierre_resultado, cierre_actualizado_en) values (${lit(TENANT)}, ${lit(REPORTE)}, ${VERSION_DOC}, 'borrador', '{}', 'listo', ${lit(JSON.stringify(RESUMEN))}::jsonb, now() - interval '1 hour') returning id`).split("\n")[0];
const NOTA = "Repite contenido del bloque 40 («el objetivo de reduccion de alcances 1 y…»): remitir a él en una línea, sin repetir su contenido.";
const PEND = JSON.stringify([{ campo: "nota_revision", motivo: NOTA, cubeta: "validador", etiqueta: "texto_reescrito" }]);
psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado, texto, origen_texto, fuentes, pendientes, generado_en, libro_id, editado_por, editado_en) values (${lit(DOC)}, 25, 'recursos_progreso', 'Recursos asignados y progreso de planes', 'III · Nuestra estrategia', 'es', 'borrador', 'Texto del bloque veinticinco aceptado en el reintento. El objetivo de reducción de Alcances 1 y 2 es del 30% respecto de 2025.', 'edicion', '[]', ${lit(PEND)}::jsonb, now(), ${lit(LIBRO)}, (select id from auth.users where email = 'admin@irstrat.example'), now())`);

const nav = await chromium.launch();
try {
  // --- 2. Texto reescrito de otro bloque ------------------------------------------------
  console.log("\n2. «Texto reescrito de otro bloque» degrada a observación");
  const ds = await validarCruzado(db, DOC);
  const d = ds.find((x) => x.bloque === 25 && x.tipo === "repite_contenido");
  ok(!!d && d.otroBloque === 40 && /^Repite contenido del bloque 40/.test(d.detalle), `validador cruzado: «repite_contenido» del 25 al 40 (${ds.map((x) => `${x.bloque}:${x.tipo}`).join(", ") || "nada"})`);
  ok(psql(`select estado from documentos_bloques where documento_id=${lit(DOC)} and numero=25`) === "borrador", "el bloque sigue en borrador");
  const ctx = await nav.newContext();
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, url: BASE })));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/cobertura/suplemento/${DOC}`, { timeout: 90000 });
  await p.getByRole("button", { name: /Recursos asignados/ }).first().click();
  const obs = p.locator('[data-cubeta="validador"]');
  ok((await obs.count()) === 1 && (await obs.innerText()).includes("Repite contenido del bloque 40"), "la revisión la muestra en «observaciones del validador»");

  // --- 3. Ediciones a mano antes de la reserva ---------------------------------------------
  console.log("\n3. generar revisa las ediciones a mano antes de tomar la reserva");
  const antes = psql(`select cierre_estado || '|' || cierre_resultado::text from documentos_generados where id=${lit(DOC)}`);
  const g = await fetch(`${BASE}/api/suplemento/${REPORTE}/generar`, { method: "POST", headers: { cookie: cookie(), "content-type": "application/json" }, body: "{}" });
  const cuerpo = await g.json().catch(() => ({}));
  ok(g.status === 428 && (cuerpo.ediciones ?? []).some((e) => e.numero === 25), `con una edición a mano, generar → ${g.status} con la lista`);
  ok(psql(`select cierre_estado || '|' || cierre_resultado::text from documentos_generados where id=${lit(DOC)}`) === antes, "el estado y el resumen del cierre anterior quedan intactos");
  ok(psql(`select count(*) from documentos_bloques where documento_id=${lit(DOC)} and estado = 'en_cola'`) === "0", "y no reabrió nada");
} finally {
  await nav.close();
  console.log("\nLimpieza");
  psql(`delete from documentos_generados where id=${lit(DOC)}`);
  psql(`delete from libros_hechos where id=${lit(LIBRO)}`);
  psql(`delete from bitacora where created_at >= ${lit(inicioPrueba)}::timestamptz and entidad_id = ${lit(DOC)}`, true);
  const [gA, m] = tenantAntes.split("|");
  psql(`update tenants set generador_activo = ${gA === "true" || gA === "t"}, generaciones_mes_max = ${m} where id=${lit(TENANT)}`);
  ok(psql(`select count(*) from documentos_generados where id=${lit(DOC)}`) === "0", "sin restos del documento de prueba");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
