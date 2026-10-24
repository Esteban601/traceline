#!/usr/bin/env node
// =============================================================================
// Regenera SOLO las respuestas por datapoint de un documento ya aprobado, en dev,
// con el código local (encargo 2026-10-24-deuda-s2-formato, Fases 2 y 3). Mismo
// camino que POST /api/suplemento/{documento}/respuestas: reserva, generarRespuestas
// (reutiliza sin llamada las respuestas del modelo cuyo bloque no cambió) y
// guardado con service role. No regenera el documento.
//
//   node --env-file=../vert-evidencia/.env.local --experimental-strip-types \
//        --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/formato/regenerar-respuestas-dev.mjs <documento_id>
//
// Solo dev. No imprime credenciales.
// =============================================================================
import { createRequire } from "node:module";
import { createServerClient } from "@supabase/ssr";
import { reclamarRespuestas, completarRespuestas } from "../../lib/suplemento/respuestas.ts";

const documentoId = process.argv[2];
if (!documentoId) { console.error("Uso: regenerar-respuestas-dev.mjs <documento_id>"); process.exit(2); }
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!URL_SB.includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ Solo contra el proyecto dev."); process.exit(2); }
const { createClient } = createRequire(import.meta.url)("@supabase/supabase-js");
const admin = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const jar = new Map();
const db = createServerClient(URL_SB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) } });
const { error } = await db.auth.signInWithPassword({ email: "admin@irstrat.example", password: process.env.STAFF_PASSWORD || "Demo2025!" });
if (error) { console.error("✗ login del staff del seed falló"); process.exit(2); }

const reserva = await reclamarRespuestas(db, documentoId);
if (!reserva) { console.error("✗ No se pudo reservar: el documento no está aprobado o ya hay una generación en curso."); process.exit(1); }
const t0 = Date.now();
const r = await completarRespuestas(db, admin, documentoId, reserva);
if (!r) {
  const { data } = await db.from("documentos_generados").select("respuestas_estado, respuestas_resultado").eq("id", documentoId).maybeSingle();
  console.error(`✗ La generación terminó en «${data?.respuestas_estado}»: ${JSON.stringify(data?.respuestas_resultado?.error ?? "")}`);
  process.exit(1);
}
const llamadas = r.filas.filter((f) => f.origen === "modelo" && f.costo_usd > 0).length;
console.log(`✓ ${r.filas.length} respuestas en ${((Date.now() - t0) / 1000).toFixed(1)} s · costo ${r.costo.toFixed(4)} USD · filas con costo nuevo: ${llamadas}`);
console.log(`  por origen: ${JSON.stringify(r.porOrigen)}`);
console.log(`  por estado: ${JSON.stringify(r.porEstado)}`);
