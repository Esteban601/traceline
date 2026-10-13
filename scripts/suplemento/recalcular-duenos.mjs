#!/usr/bin/env node
// =============================================================================
// RECALCULA EL DUEÑO DE LOS HECHOS DE GERENCIA EN UN LIBRO EXISTENTE, SIN
// VOLVER A EXTRAER (rúbrica del 5c, remisión 18→16). Aplica
// duenoRecalculadoPorGerencia (lib/suplemento/hechos/remisiones.ts), la misma
// regla que usa el libro al armarse, sobre los hechos vigentes ya guardados.
//
//   node --env-file=.env.local scripts/suplemento/recalcular-duenos.mjs <libro> [--aplicar]
//
// Sin --aplicar solo lista los cambios. No llama al modelo (costo 0). Solo dev.
// No imprime credenciales.
// =============================================================================
import { createClient } from "@supabase/supabase-js";
import { duenoRecalculadoPorGerencia } from "../../lib/suplemento/hechos/remisiones.ts";

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const [libro] = args.filter((a) => !a.startsWith("--"));
if (!libro) { console.error("Uso: recalcular-duenos.mjs <libro> [--aplicar]"); process.exit(2); }
if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ Solo contra el proyecto dev."); process.exit(2); }
// Bloque «Papel de la gerencia y controles» (clave gerencia_controles en lib/suplemento/bloques.ts).
const GERENCIA = 17;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: hechos, error } = await db
  .from("hechos")
  .select("id, enunciado, bloque_dueno, bloques_referencia, verificacion")
  .eq("libro_id", libro)
  .eq("estado", "vigente");
if (error) { console.error(`✗ ${error.message}`); process.exit(1); }

const cambios = hechos.map((h) => ({ h, nuevo: duenoRecalculadoPorGerencia(h, GERENCIA) })).filter((x) => x.nuevo);
for (const { h, nuevo } of cambios) console.log(`${h.bloque_dueno} → ${nuevo.bloque_dueno} ${JSON.stringify(nuevo.bloques_referencia)} | ${h.enunciado.slice(0, 100)}`);
console.log(`${cambios.length} de ${hechos.length} hechos vigentes cambian de dueño${aplicar ? "" : " (sin --aplicar: nada escrito)"}`);
if (!aplicar) process.exit(0);
for (const { h, nuevo } of cambios) {
  const { error: e } = await db
    .from("hechos")
    .update({ ...nuevo, verificacion: `${h.verificacion}; dueño recalculado sin reextraer: sujeto de gerencia` })
    .eq("id", h.id);
  if (e) { console.error(`✗ ${h.id.slice(0, 8)}: ${e.message}`); process.exit(1); }
}
console.log("✓ aplicado");
