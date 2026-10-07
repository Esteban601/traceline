#!/usr/bin/env node
// =============================================================================
// PRUEBA DEL VALIDADOR DE CIFRAS DEL GENERADOR (captura sugerida, Paso 5;
// autosuficiente desde el encargo suplemento-calidad, Paso 3).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/captura-sugerida/probar-validador.mjs
//
// SOLO contra el stack local. Ya no depende de lo que haya dejado
// probar-generador.mjs: arma su propia utilería con cifras de prueba, corre los
// casos y la quita. Llama a generarBloque con `salidaDePrueba`: el texto
// sustituye la respuesta del modelo y pasa por los MISMOS validadores con los
// datos reales del bloque. No llama a la API ni guarda nada en los bloques.
//
// Utilería (con psql y los triggers desactivados en esa sesión, para que no
// vuelva obsoletas las sugerencias vigentes ni cambie otras filas):
//   · Bloque 29: una versión nueva de evidencia en «Inventario GEI Alcance 1» y
//     en «Alcance 2», con su contenido leído (2024 = 13,105.2 y Alcance 3 =
//     251,400, sin confirmar) y capturas CONFIRMADAS 2025 = 12,480.5 y 8,930.2;
//     las dos solicitudes, en `validado` mientras dura la prueba.
//   · Bloque 15 (gobernanza): una evidencia de una solicitud del bloque con dos párrafos
//     leídos y un extracto de texto CONFIRMADO del primero («4 sesiones»); el
//     segundo (un presupuesto de 3,750,000) queda sin confirmar.
// Al terminar se borran esas filas y se restauran los estados de las solicitudes.
// =============================================================================
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { generarBloque } from "../../lib/suplemento/generar-bloque.ts";
import { evaluarCompletitud } from "../../lib/suplemento/completitud.ts";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const TENANT = "10000000-0000-0000-0000-000000000001";
const REPORTE = "20000000-0000-0000-0000-000000000001";
const SOL_A1 = "c0000000-0000-0000-0000-000000000007";
const SOL_A2 = "c0000000-0000-0000-0000-000000000008";
if (!/127\.0\.0\.1|localhost/.test(URL_SB)) { console.error("✗ Solo contra el stack local."); process.exit(2); }
// generarBloque exige que exista una llave antes de empezar; con salidaDePrueba no la usa.
process.env.ANTHROPIC_API_KEY ||= "sin-llamada-en-esta-prueba";

// psql con los triggers desactivados en ESA sesión: la utilería no toca nada más.
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-Atq", "-c", `set session_replication_role = replica; ${sql}`], {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
  }).trim();
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
const { data: sesion, error: eLogin } = await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: "Demo2025!" });
if (eLogin) throw new Error(`login: ${eLogin.message}`);
const STAFF = sesion.user.id;
const { data: doc } = await db.from("documentos_generados").select("id").eq("reporte_id", REPORTE).order("created_at", { ascending: false }).limit(1).single();
if (!doc) throw new Error("Empresa Demo no tiene documento en local: genera uno primero (POST …/generar).");

const comp = await evaluarCompletitud(db, REPORTE);
if (!comp.ok) throw new Error(`completitud: ${comp.causa}`);
const SOL_15 = [...comp.bloques.find((b) => b.clave === "roles_organo").solicitudes][0];
if (!SOL_15) throw new Error("el bloque 15 no tiene solicitudes en local");

const creadas = { evidencias: [], capturas: [], sugerencias: [] };
const estados = Object.fromEntries([SOL_A1, SOL_A2, SOL_15].map((s) => [s, psql(`select estado from solicitudes where id=${lit(s)}`)]));

/** Una versión nueva de evidencia con su contenido ya leído. Devuelve [evidencia, contenido, versión]. */
function evidencia(sol, nombre, contenido) {
  const version = Number(psql(`select coalesce(max(version), 0) + 1 from evidencias where solicitud_id=${lit(sol)}`));
  const ev = psql(`insert into evidencias (solicitud_id, version, archivo_path, nombre_original, subido_por) values (${lit(sol)}, ${version}, ${lit(`prueba-validador/${sol}/${version}-${nombre}`)}, ${lit(nombre)}, ${lit(STAFF)}) returning id`);
  creadas.evidencias.push(ev);
  const cont = psql(`insert into evidencias_contenido (evidencia_id, solicitud_id, tenant_id, version, archivo_path, nombre_original, tipo, estado, contenido, procesado_en)
    values (${lit(ev)}, ${lit(sol)}, ${lit(TENANT)}, ${version}, ${lit(`prueba-validador/${sol}/${version}-${nombre}`)}, ${lit(nombre)}, ${lit(contenido.tipo)}, 'extraido', ${lit(JSON.stringify(contenido))}::jsonb, now()) returning id`);
  return [ev, cont, version];
}
function captura(sol, ev, valor) {
  creadas.capturas.push(psql(`insert into capturas_valor (solicitud_id, evidencia_id, valor, unidad, periodo, capturado_por, confirmado, origen) values (${lit(sol)}, ${lit(ev)}, ${valor}, 'tCO2e', '2025', ${lit(STAFF)}, true, 'manual') returning id`));
}

let fallas = 0;
try {
  // --- Utilería -------------------------------------------------------------
  const [evA1] = evidencia(SOL_A1, "prueba-alcance1.pdf", {
    tipo: "pdf", paginas_total: 1,
    paginas: [{ pagina: 1, origen: "texto", texto: "Inventario de emisiones. Alcance 1 2025: 12,480.5 tCO2e. Alcance 1 2024: 13,105.2 tCO2e. Alcance 3 estimado: 251,400 tCO2e." }],
  });
  const [evA2] = evidencia(SOL_A2, "prueba-alcance2.pdf", {
    tipo: "pdf", paginas_total: 1,
    paginas: [{ pagina: 1, origen: "texto", texto: "Alcance 2 basado en la ubicación 2025: 8,930.2 tCO2e." }],
  });
  captura(SOL_A1, evA1, 12480.5);
  captura(SOL_A2, evA2, 8930.2);
  const [ev15, cont15, ver15] = evidencia(SOL_15, "prueba-comite.docx", {
    tipo: "word",
    bloques: [
      { tipo: "parrafo", n: 1, texto: "El Comité de Sostenibilidad celebró 4 sesiones durante el ejercicio e informó al Consejo en cada una." },
      { tipo: "parrafo", n: 2, texto: "Para el programa climático se asignó un presupuesto de 3,750,000 pesos." },
    ],
  });
  creadas.sugerencias.push(psql(`insert into sugerencias_captura (solicitud_id, tenant_id, evidencia_id, contenido_id, evidencia_version, tipo, estado, extracto, fuente, decidido_por, decidido_en)
    values (${lit(SOL_15)}, ${lit(TENANT)}, ${lit(ev15)}, ${lit(cont15)}, ${ver15}, 'texto', 'confirmada',
      'El Comité de Sostenibilidad celebró 4 sesiones durante el ejercicio e informó al Consejo en cada una.',
      ${lit(JSON.stringify({ fragmentos: [{ fuente: { tipo: "parrafo", parrafo: 1 } }] }))}::jsonb, ${lit(STAFF)}, now()) returning id`));
  for (const s of [SOL_A1, SOL_A2, SOL_15]) psql(`update solicitudes set estado = 'validado' where id=${lit(s)}`);

  // --- Casos ----------------------------------------------------------------
  const A1 = `sol:${SOL_A1}`;
  const CASOS = [
    { bloque: 29, espera: true, nombre: "las cifras confirmadas de 2025",
      texto: "Las emisiones de Alcance 1 fueron de 12,480.5 y las de Alcance 2 de 8,930.2 toneladas métricas equivalentes de CO2 en 2025.", fuentes: [A1] },
    { bloque: 29, espera: true, nombre: "la misma cifra confirmada sin separador de miles",
      texto: "Las emisiones de Alcance 1 fueron de 12480.5 toneladas métricas equivalentes de CO2.", fuentes: [A1] },
    { bloque: 29, espera: false, nombre: "la cifra 2024 de Alcance 1, que solo está en el contenido leído (sin confirmar)",
      texto: "En 2024 las emisiones de Alcance 1 fueron de 13,105.2 toneladas métricas equivalentes de CO2.", fuentes: [A1] },
    { bloque: 29, espera: false, nombre: "el Alcance 3 del contenido leído (sin confirmar)",
      texto: "Las emisiones de Alcance 3 ascendieron a 251,400 toneladas métricas equivalentes de CO2.", fuentes: [A1] },
    { bloque: 29, espera: false, nombre: "una variación calculada por el modelo",
      texto: "Las emisiones de Alcance 1 disminuyeron 4.8 % respecto del ejercicio anterior.", fuentes: [A1] },
    { bloque: 15, espera: true, nombre: "la cifra del extracto confirmado (4 sesiones)",
      texto: "El Comité de Sostenibilidad celebró 4 sesiones durante el ejercicio e informó al Consejo en cada una.", fuentes: [] },
    { bloque: 15, espera: false, nombre: "la cifra del párrafo leído pero no confirmado (presupuesto)",
      texto: "Para el programa climático se asignó un presupuesto de 3,750,000 pesos.", fuentes: [] },
    { bloque: 15, espera: false, nombre: "una cifra inventada en un bloque de gobernanza",
      texto: "El Consejo sesionó 7 veces durante el ejercicio para revisar los riesgos climáticos.", fuentes: [] },
  ];

  for (const c of CASOS) {
    const r = await generarBloque(db, doc.id, c.bloque, { sinPersistir: true, salidaDePrueba: { texto: c.texto, fuentes_usadas: c.fuentes } });
    const bien = r.ok === c.espera;
    if (!bien) fallas++;
    console.log(`${bien ? "  ✓" : "  ✗"} bloque ${c.bloque} · ${c.nombre}: ${r.ok ? "aceptado" : `rechazado (${r.motivo}: ${r.detalle})`}`);
  }
} finally {
  // --- Limpieza -------------------------------------------------------------
  const lista = (ids) => ids.map(lit).join(",") || "null";
  psql(`delete from sugerencias_captura where id in (${lista(creadas.sugerencias)})`);
  psql(`delete from capturas_valor where id in (${lista(creadas.capturas)})`);
  psql(`delete from evidencias_contenido where evidencia_id in (${lista(creadas.evidencias)})`);
  psql(`delete from evidencias where id in (${lista(creadas.evidencias)})`);
  for (const [s, e] of Object.entries(estados)) psql(`update solicitudes set estado = ${lit(e)} where id=${lit(s)}`);
  const quedan = psql(`select count(*) from evidencias where id in (${lista(creadas.evidencias)})`);
  console.log(`\nLimpieza: ${creadas.evidencias.length} evidencias, ${creadas.capturas.length} capturas y ${creadas.sugerencias.length} extracto quitados (quedan ${quedan}); estados de las solicitudes restaurados.`);
}

console.log(fallas ? `\n✗ ${fallas} fallas` : "\n✓ Validador de cifras OK");
process.exit(fallas ? 1 : 0);
