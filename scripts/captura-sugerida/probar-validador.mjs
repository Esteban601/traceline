#!/usr/bin/env node
// =============================================================================
// PRUEBA DEL VALIDADOR DE CIFRAS DEL GENERADOR (captura sugerida, Paso 5).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/captura-sugerida/probar-validador.mjs
//
// SOLO contra el stack local, después de probar-generador.mjs (que deja
// confirmadas las cifras 2025 de Alcance 1 y 2 y el extracto de R4). Llama a
// generarBloque con `salidaDePrueba`: el texto sustituye la respuesta del modelo
// y pasa por los MISMOS validadores con los datos reales del bloque. No llama a
// la API ni guarda nada.
// =============================================================================
import { createClient } from "@supabase/supabase-js";
import { generarBloque } from "../../lib/suplemento/generar-bloque.ts";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const REPORTE = "20000000-0000-0000-0000-000000000001";
if (!/127\.0\.0\.1|localhost/.test(URL_SB)) { console.error("✗ Solo contra el stack local."); process.exit(2); }
// generarBloque exige que exista una llave antes de empezar; con salidaDePrueba no la usa.
process.env.ANTHROPIC_API_KEY ||= "sin-llamada-en-esta-prueba";

const db = createClient(URL_SB, ANON, { auth: { persistSession: false } });
await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: "Demo2025!" });
const { data: doc } = await db.from("documentos_generados").select("id").eq("reporte_id", REPORTE).order("created_at", { ascending: false }).limit(1).single();

const A1 = "sol:c0000000-0000-0000-0000-000000000007";
const CASOS = [
  { bloque: 29, espera: true, nombre: "las cifras confirmadas de 2025",
    texto: "Las emisiones de Alcance 1 fueron de 12,480.5 y las de Alcance 2 de 8,930.2 toneladas métricas equivalentes de CO2 en 2025.", fuentes: [A1] },
  { bloque: 29, espera: false, nombre: "la cifra 2024 de Alcance 1, que solo está en el Excel (sin confirmar)",
    texto: "En 2024 las emisiones de Alcance 1 fueron de 13,105.2 toneladas métricas equivalentes de CO2.", fuentes: [A1] },
  { bloque: 29, espera: false, nombre: "el Alcance 3 de la tabla del Word (sin confirmar)",
    texto: "Las emisiones de Alcance 3 ascendieron a 251,400 toneladas métricas equivalentes de CO2.", fuentes: [A1] },
  { bloque: 29, espera: false, nombre: "una variación calculada por el modelo",
    texto: "Las emisiones de Alcance 1 disminuyeron 4.8 % respecto del ejercicio anterior.", fuentes: [A1] },
  { bloque: 16, espera: true, nombre: "el extracto confirmado (trimestral, dos veces al año)",
    texto: "El Comité de Sostenibilidad del Consejo recibe un informe trimestral y la Dirección General informa al Consejo en pleno dos veces al año.", fuentes: [] },
  { bloque: 16, espera: false, nombre: "una cifra inventada en un bloque de gobernanza",
    texto: "El Consejo sesionó 7 veces durante el ejercicio para revisar los riesgos climáticos.", fuentes: [] },
];

// Regresión: el texto que el modelo ya generó para cada bloque (sin la tabla,
// que arma el código) tiene que seguir pasando con el validador.
for (const n of [29, 16]) {
  const { data: b } = await db.from("documentos_bloques").select("texto, fuentes").eq("documento_id", doc.id).eq("numero", n).maybeSingle();
  if (!b?.texto) continue;
  const prosa = b.texto.split("\n\n").filter((p) => !p.trim().startsWith("|") && !p.trim().startsWith("**")).join("\n\n");
  CASOS.push({ bloque: n, espera: true, nombre: "el texto que ya generó el modelo", texto: prosa,
    fuentes: (b.fuentes ?? []).map((f) => f.id).filter((id) => id.startsWith("sol:") || id.startsWith("reporte:")) });
}

let fallas = 0;
for (const c of CASOS) {
  const r = await generarBloque(db, doc.id, c.bloque, { sinPersistir: true, salidaDePrueba: { texto: c.texto, fuentes_usadas: c.fuentes } });
  const acepto = r.ok;
  const bien = acepto === c.espera;
  if (!bien) fallas++;
  console.log(`${bien ? "  ✓" : "  ✗"} bloque ${c.bloque} · ${c.nombre}: ${acepto ? "aceptado" : `rechazado (${r.motivo}: ${r.detalle})`}`);
}
console.log(fallas ? `\n✗ ${fallas} fallas` : "\n✓ Validador de cifras OK");
process.exit(fallas ? 1 : 0);
