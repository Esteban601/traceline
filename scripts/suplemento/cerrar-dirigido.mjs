#!/usr/bin/env node
// =============================================================================
// CIERRES DIRIGIDOS SIN REGENERAR (lector externo del 11 de octubre de 2026,
// documento 98d57a6a). Ejecuta cerrarPendienteDirigido y remitirPendienteDuplicado
// (lib/suplemento/hechos/cierre.ts) sobre los casos que decidió Esteban:
//   · 21: la respuesta al riesgo de precio al carbono se remite a 25 y 17, si la
//     verificación (Sonnet 5.5, centavos) dice «responde»; si no, queda con nota;
//   · 16: el pendiente «órgano que aprueba la estrategia» queda solo en 15 y el 16 remite.
//
//   node --env-file=.env.local --experimental-strip-types \
//        --import ./scripts/captura-sugerida/node/registrar.mjs scripts/suplemento/cerrar-dirigido.mjs
//
// Solo dev. Idempotente: un marcador ya cerrado no está y el caso se salta. No
// imprime credenciales.
// =============================================================================
import { createClient } from "@supabase/supabase-js";
import { cerrarPendienteDirigido, remitirPendienteDuplicado } from "../../lib/suplemento/hechos/cierre.ts";

if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ Solo contra el proyecto dev."); process.exit(2); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const D = "98d57a6a-0ff0-4725-bab2-dae21b8f7bc5";
const MOTIVO = "decisión de Esteban tras la lectura externa del 11 de octubre de 2026";

const r21 = await cerrarPendienteDirigido(db, D, { bloque: 21, empieza: "respuesta de la Compañía al riesgo de precio al carbono", destinos: [25, 17], motivo: MOTIVO });
console.log(`21 → 25 y 17: ${r21.veredicto} ($${r21.costo.toFixed(4)}) — ${r21.razon}`);
if (r21.texto) console.log(`   ${r21.texto.match(/[^.]*las secciones[^.]*\./)?.[0]?.trim() ?? ""}`);

const r16 = await remitirPendienteDuplicado(db, D, {
  bloque: 16,
  empieza: "órgano que aprueba la estrategia",
  destino: 15,
  empiezaEnDestino: "órgano que aprueba la estrategia",
  sujeto: "El órgano que aprueba la estrategia frente al cambio climático",
  motivo: MOTIVO,
});
console.log(`16 → 15 (pendiente duplicado): ${r16.veredicto} — ${r16.razon}`);
if (r16.texto) console.log(`   ${r16.texto.match(/El órgano que aprueba la estrategia[^.]*\./)?.[0] ?? ""}`);
