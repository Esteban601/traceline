#!/usr/bin/env node
// =============================================================================
// PRUEBA DEL CIERRE VERIFICADO (Paso 5c): los cinco cierres que el código hizo
// en la corrida 2 (documento 98d57a6a), con el veredicto que debían tener. Lee
// del historial el marcador original y del documento el texto del bloque dueño;
// llama a verificarCierre (Sonnet 5.5, centavos). Falla si no acierta los cinco.
//
//   node --env-file=.env.local --experimental-strip-types \
//        --import ./scripts/captura-sugerida/node/registrar.mjs scripts/suplemento/probar-cierre.mjs
// =============================================================================
import { createClient } from "@supabase/supabase-js";
import { verificarCierre } from "../../lib/suplemento/hechos/cierre.ts";
import { BLOQUES } from "../../lib/suplemento/bloques.ts";

if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ Solo contra el proyecto dev."); process.exit(2); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const D = "98d57a6a-0ff0-4725-bab2-dae21b8f7bc5";
const CASOS = [
  { bloque: 21, dueno: 8, empieza: "definición de corto, mediano y largo plazo", espera: "responde" },
  { bloque: 20, dueno: 8, empieza: "vínculo entre los horizontes temporales", espera: "responde" },
  { bloque: 27, dueno: 9, empieza: "rango de severidad de la matriz", espera: "responde" },
  { bloque: 20, dueno: 13, empieza: "descripción del entorno de negocio", espera: "no" },
  { bloque: 20, dueno: 8, empieza: "prioridades estratégicas del plan vigente", espera: "no" },
];
const titulo = (n) => BLOQUES.find((b) => b.numero === n).titulo;
let fallas = 0, costo = 0;
for (const c of CASOS) {
  const { data: vs } = await db.from("documentos_bloques_versiones").select("origen, texto").eq("documento_id", D).eq("numero", c.bloque).order("version", { ascending: false }).limit(4);
  const previa = vs.find((v) => v.origen !== "automatica" && v.texto.includes(`[Pendiente: ${c.empieza}`));
  const marcador = previa?.texto.match(new RegExp(`\\[Pendiente: ${c.empieza}[^\\]]*\\]`))?.[0];
  const { data: d } = await db.from("documentos_bloques").select("texto").eq("documento_id", D).eq("numero", c.dueno).single();
  if (!marcador) { console.log(`  ✗ ${c.bloque}→${c.dueno}: no se encontró el marcador en el historial`); fallas++; continue; }
  const v = await verificarCierre(marcador, titulo(c.dueno), d.texto, process.env.ANTHROPIC_API_KEY);
  costo += (v.uso.entrada * 3 + v.uso.salida * 15) / 1e6;
  const ok = c.espera === "responde" ? v.veredicto === "responde" : v.veredicto !== "responde";
  if (!ok) fallas++;
  console.log(`${ok ? "  ✓" : "  ✗"} ${c.bloque}→${c.dueno} «${c.empieza}…»: ${v.veredicto} (esperado: ${c.espera === "responde" ? "responde" : "no cerrar"}) — ${v.razon.slice(0, 200)}`);
}
console.log(`\n${fallas ? `✗ ${fallas} fallas` : "✓ Acierta los 5"} · ~$${costo.toFixed(3)}`);
process.exit(fallas ? 1 : 0);
