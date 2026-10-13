#!/usr/bin/env node
// =============================================================================
// E2E · fix/pre-v40-d: el validador cruzado descarta una observación guardada
// del validador si su cita ya no está en el texto actual del bloque (observación
// P2 de Codex sobre el PR #23, decisión de Esteban del 13 de octubre de 2026).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-pre-v40-d.mjs
//
// SOLO contra el stack local (no necesita la app: llama al validador con la
// sesión del staff). Sin modelo, costo 0. Documento de prueba de Empresa Demo;
// se borra al terminar.
//
//   1. citaVigente, sin base: frase reescrita y cláusula de remisión, presentes,
//      con un nombre de la emisora en medio, recortadas, ausentes y sin cita.
//   2. Control: con el texto intacto, las dos notas son observación.
//   3. Edición a mano: se quita el pasaje repetido → la observación desaparece.
//   4. Cierre por remisión: la oración con la remisión sin ancla se sustituye
//      por una remisión (remitirDuplicada, la del cierre) → desaparece.
// =============================================================================
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { citaVigente, validarCruzado } from "../lib/suplemento/hechos/cruzado.ts";
import { remitirDuplicada } from "../lib/suplemento/hechos/cierre.ts";

const URL_SB = "http://127.0.0.1:54321";
// Llave PÚBLICA de demostración del stack local de Supabase (la misma de `dev:local`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atq", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

// Textos del caso: la frase reescrita (normalizada, como la deja el generador) y
// la cláusula de la remisión sin ancla (texto original, como la deja el validador).
const ORACION_REESCRITA = "El objetivo de reducción de Alcances 1 y 2 de Empresa Demo es del 30% respecto de 2025 y se cumplirá con eficiencia energética.";
const FRASE = "el objetivo de reduccion de alcances 1 y";
const ORACION_REMISION = "Los esfuerzos indirectos a través de la cartera se describen en la sección «Esfuerzos indirectos de reducción y adaptación».";
const CLAUSULA = "Los esfuerzos indirectos a través de la cartera se describen en la sección «Esfuerzos indirectos de reducción y adaptación».";
const NOTA_R = `Repite contenido del bloque 40 («${FRASE}…»): remitir a él en una línea, sin repetir su contenido.`;
const NOTA_A = `«${CLAUSULA.slice(0, 120)}» remite al bloque 23 sin el ancla [B23.k] del hecho del mapa al que remite: ánclalo, o si ninguno de sus hechos es lo que remites, no remitas ahí.`;

// --- 1. Sin base ---------------------------------------------------------------
console.log("\n1. citaVigente");
ok(citaVigente(NOTA_R, "texto_reescrito", `Primero. ${ORACION_REESCRITA} Después.`), "frase reescrita presente (con «de Empresa Demo» en medio) → vigente");
ok(!citaVigente(NOTA_R, "texto_reescrito", "El bloque ya no repite el objetivo; remite a la sección de objetivos."), "frase reescrita quitada → no vigente");
ok(citaVigente(NOTA_A, "remision_sin_ancla", `Inicio. ${ORACION_REMISION}`), "cláusula de remisión presente (recortada a 120 caracteres) → vigente");
ok(!citaVigente(NOTA_A, "remision_sin_ancla", "Esta información se presenta en la sección «Esfuerzos indirectos de reducción y adaptación»."), "cláusula sustituida por la remisión neutra → no vigente");
ok(citaVigente("Una nota sin cita entre comillas.", "remision_sin_ancla", "Cualquier texto."), "sin cita reconocible → se conserva");

// --- Preparación -----------------------------------------------------------------
const jar = new Map();
const db = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
const { error: eLogin } = await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: "Demo2025!" });
if (eLogin) throw new Error("login staff");
const LIBRO = psql(`insert into libros_hechos (tenant_id, reporte_id, estado) values (${lit(TENANT)}, ${lit(REPORTE)}, 'listo') returning id`).split("\n")[0];
const VERSION_DOC = Number(psql(`select coalesce(max(version), 0) + 1 from documentos_generados where reporte_id=${lit(REPORTE)}`));
const DOC = psql(`insert into documentos_generados (tenant_id, reporte_id, version, estado, editoriales_incluidos) values (${lit(TENANT)}, ${lit(REPORTE)}, ${VERSION_DOC}, 'borrador', '{}') returning id`).split("\n")[0];
const PEND = JSON.stringify([
  { campo: "nota_revision", motivo: NOTA_R, cubeta: "validador", etiqueta: "texto_reescrito" },
  { campo: "nota_revision", motivo: NOTA_A, cubeta: "validador", etiqueta: "remision_sin_ancla" },
]);
const TEXTO = `La Compañía destinó recursos a su plan. ${ORACION_REESCRITA} ${ORACION_REMISION}`;
psql(`insert into documentos_bloques (documento_id, numero, clave, titulo, seccion, idioma, estado, texto, origen_texto, fuentes, pendientes, generado_en, libro_id) values (${lit(DOC)}, 25, 'recursos_progreso', 'Recursos asignados y progreso de planes', 'III · Nuestra estrategia', 'es', 'borrador', ${lit(TEXTO)}, 'generacion', '[]', ${lit(PEND)}::jsonb, now(), ${lit(LIBRO)})`);
// Solo los tipos que salen de las notas del validador: el caso remite al bloque 23,
// que este documento no tiene, y el detector de remisiones lo señala aparte (con razón).
const DE_NOTAS = new Set(["remision_sin_ancla", "repite_contenido"]);
const del25 = async () => (await validarCruzado(db, DOC)).filter((d) => d.bloque === 25 && DE_NOTAS.has(d.tipo)).map((d) => d.tipo).sort().join(",");
const texto25 = () => psql(`select texto from documentos_bloques where documento_id=${lit(DOC)} and numero=25`);
const ponerTexto = (t) => psql(`update documentos_bloques set texto = ${lit(t)} where documento_id=${lit(DOC)} and numero=25`);

try {
  console.log("\n2. Control: texto intacto");
  ok((await del25()) === "remision_sin_ancla,repite_contenido", `las dos notas son observación (${await del25()})`);

  console.log("\n3. Edición a mano");
  ponerTexto(texto25().replace(ORACION_REESCRITA, "El objetivo de reducción se describe junto con los demás objetivos climáticos."));
  ok((await del25()) === "remision_sin_ancla", `quitado el pasaje repetido, solo queda la remisión (${await del25()})`);

  console.log("\n4. Cierre por remisión");
  ponerTexto(remitirDuplicada(texto25(), ORACION_REMISION, "Esfuerzos indirectos de reducción y adaptación"));
  ok(texto25().includes("Esta información se presenta en la sección «Esfuerzos indirectos de reducción y adaptación»."), "el cierre sustituyó la oración por la remisión");
  ok((await del25()) === "", `sin observaciones de notas del 25 (${(await del25()) || "ninguna"})`);
  ok(psql(`select jsonb_array_length(pendientes) from documentos_bloques where documento_id=${lit(DOC)} and numero=25`) === "2", "las notas siguen guardadas (el historial no se toca); solo dejan de reportarse");
} finally {
  console.log("\nLimpieza");
  psql(`delete from documentos_generados where id=${lit(DOC)}`);
  psql(`delete from libros_hechos where id=${lit(LIBRO)}`);
  ok(psql(`select count(*) from documentos_generados where id=${lit(DOC)}`) === "0", "sin restos del documento de prueba");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
