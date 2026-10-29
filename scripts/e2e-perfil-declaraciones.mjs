#!/usr/bin/env node
// =============================================================================
// E2E · las dos declaraciones del bloque 10 desde el Perfil del emisor (encargo
// 2026-10-29-perfil-declaraciones-alta, Fase 2). Sin modelo, costo 0.
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-perfil-declaraciones.mjs
//
// SOLO contra el stack local, con la sesión del staff del seed. Empresa Demo del
// seed local no tiene las dos solicitudes viejas ni fila de perfil: es la emisora
// recién dada de alta.
//
//   A. Sin las declaraciones: en la completitud del bloque 10, NIIF S2 21(a) y
//      B65(e) son UN faltante cada uno, «perfil_vacio», con el código como
//      etiqueta, el detalle que nombra la sección «Efectos financieros» y el
//      enlace a ella; ninguno como «sin_solicitud». El libro no recibe hechos de
//      esas claves. Nada se bloquea: la completitud responde.
//   B. Con las dos escritas: los dos requisitos cuentan como cumplidos y no
//      remiten a ningún bloque. El libro recibe dos hechos directos con clave fija
//      (emisora.criterio_cuantificacion, emisora.congruencia_estados_financieros),
//      dueño el bloque 10, rango «perfil», el texto tal cual.
// Si el catálogo no tiene el código (el stack local no trae NIIF S2 21(a): su
// migración copia de 16(d), que el seed carga después), el faltante sigue siendo
// el del Perfil, porque es ahí donde se resuelve.
//   C. Solo una escrita: la otra sigue como faltante del Perfil.
// La fila de perfil se restaura (o se borra si no existía) al terminar.
// =============================================================================
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { evaluarCompletitud } from "../lib/suplemento/completitud.ts";
import { recolectar } from "../lib/suplemento/hechos/fuentes.ts";
import { DECLARACIONES_PERFIL } from "../lib/suplemento/hechos/razones.ts";

const URL_SB = "http://127.0.0.1:54321";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const CODIGOS = ["NIIF S2 21(a)", "NIIF S2 B65 inciso (e)"];
const TEXTO = {
  criterio_cuantificacion: "La Compañía no proporciona información cuantitativa sobre los efectos financieros previstos porque no son identificables por separado (prueba e2e).",
  congruencia_estados_financieros: "Los datos y supuestos son congruentes con los de los estados financieros (prueba e2e).",
};

const status = Object.fromEntries(
  execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" })
    .split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
);
if (!/127\.0\.0\.1|localhost/.test(status.API_URL ?? "")) { console.error("✗ Solo contra el stack local."); process.exit(2); }
process.env.NEXT_PUBLIC_SUPABASE_URL = URL_SB;
process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atc", sql], { env: { ...process.env, PGPASSWORD: "postgres" }, encoding: "utf8" }).trim();

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`  ${c ? "✓" : "✗"} ${m}`); };
const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: "Demo2025!" });
if (eLogin) { console.error(`✗ login staff: ${eLogin.message}`); process.exit(2); }

const campos = Object.keys(TEXTO);
const filaAntes = psql(`select json_build_object(${campos.map((c) => `'${c}', ${c}`).join(", ")}) from perfil_emisor where tenant_id = '${TENANT}'`);
const antes = filaAntes ? JSON.parse(filaAntes) : null;
const lit = (v) => (v == null ? "null" : `$e2e$${v}$e2e$`);
const escribir = (valores) => {
  const sets = campos.map((c) => `${c} = ${lit(valores[c])}`).join(", ");
  if (psql(`select count(*) from perfil_emisor where tenant_id = '${TENANT}'`) === "0") psql(`insert into perfil_emisor (tenant_id) values ('${TENANT}')`);
  psql(`update perfil_emisor set ${sets} where tenant_id = '${TENANT}'`);
};

async function bloque10() {
  const r = await evaluarCompletitud(db, REPORTE);
  if (!r.ok) throw new Error(`completitud: ${r.causa}`);
  return r.bloques.find((b) => b.numero === 10);
}
async function directos() {
  const rec = await recolectar(db, REPORTE, TENANT);
  return rec.directos.filter((h) => Object.values(DECLARACIONES_PERFIL).some((d) => d.clave === h.clave));
}

try {
  console.log("A. Sin las declaraciones (emisora recién dada de alta)");
  escribir({});
  let b = await bloque10();
  for (const codigo of CODIGOS) {
    const f = b.faltantes.filter((x) => x.etiqueta === codigo);
    ok(f.length === 1 && f[0].causa === "perfil_vacio", `${codigo}: un faltante «perfil_vacio» (${f.map((x) => x.causa).join(", ") || "ninguno"})`);
    ok(/sección Efectos financieros/.test(f[0]?.detalle ?? ""), `${codigo}: el detalle nombra la sección «Efectos financieros»`);
    ok(/seccion=efectos/.test(f[0]?.enlace ?? ""), `${codigo}: enlace a la sección del Perfil`);
  }
  ok(!b.remisiones.some((r) => CODIGOS.includes(r.codigo)), "ninguna remisión de 21(a) ni B65(e)");
  ok((await directos()).length === 0, "el libro no recibe hechos de esas claves");
  const exigidosA = b.exigidos, cumplidosA = b.cumplidos;

  console.log("\nB. Con las dos escritas");
  escribir(TEXTO);
  b = await bloque10();
  ok(!b.faltantes.some((x) => CODIGOS.includes(x.etiqueta)), "21(a) y B65(e) ya no son faltantes");
  ok(b.exigidos === exigidosA && b.cumplidos === cumplidosA + 2, `exigidos ${b.exigidos} (igual), cumplidos ${cumplidosA} → ${b.cumplidos} (+2): sin contar dos veces`);
  ok(!b.remisiones.some((r) => CODIGOS.includes(r.codigo)), "cumplidos sin remitir a otro bloque");
  const hs = await directos();
  ok(hs.length === 2, `dos hechos directos con clave fija (${hs.map((h) => h.clave).join(", ")})`);
  for (const [campo, d] of Object.entries(DECLARACIONES_PERFIL)) {
    const h = hs.find((x) => x.clave === d.clave);
    ok(h?.bloque_dueno === 10 && h?.rango_fuente === "perfil" && h?.fuente_id === `perfil:${campo}`, `${d.clave}: dueño 10, rango «perfil», fuente perfil:${campo}`);
    ok(h?.enunciado === TEXTO[campo] && h?.extracto === TEXTO[campo], `${d.clave}: el texto tal cual`);
  }

  console.log("\nC. Solo el criterio escrito");
  escribir({ criterio_cuantificacion: TEXTO.criterio_cuantificacion });
  b = await bloque10();
  ok(!b.faltantes.some((x) => x.etiqueta === CODIGOS[0]), "21(a) cumplido");
  ok(b.faltantes.some((x) => x.etiqueta === CODIGOS[1] && x.causa === "perfil_vacio"), "B65(e) sigue como faltante del Perfil");
} catch (e) {
  fallas.push(`excepción: ${e.message}`);
  console.log(`  ✗ excepción: ${e.message}`);
} finally {
  console.log("\nRestauración");
  if (!antes) psql(`delete from perfil_emisor where tenant_id = '${TENANT}'`);
  else escribir(antes);
  const ahora = psql(`select json_build_object(${campos.map((c) => `'${c}', ${c}`).join(", ")}) from perfil_emisor where tenant_id = '${TENANT}'`);
  ok(antes ? JSON.stringify(JSON.parse(ahora)) === JSON.stringify(antes) : ahora === "", antes ? "los dos campos, como antes" : "sin fila de perfil, como antes");
}

console.log(fallas.length ? `\n✗ ${fallas.length} falla(s).` : "\n✓ Declaraciones del Perfil en orden.");
process.exit(fallas.length ? 1 : 0);
