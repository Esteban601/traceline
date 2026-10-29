#!/usr/bin/env node
// =============================================================================
// Corrida en seco de las respuestas por datapoint de un documento aprobado, en dev:
// dice qué respuestas se regenerarían con el modelo, sin llamarlo y sin escribir.
// Cierre del encargo 2026-10-26-formato-afirmaciones-y-voz (antes scratchpad
// v5/seco.mjs).
//
//   node --env-file=<.env.local de dev> --experimental-strip-types \
//        --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/formato/respuestas-en-seco.mjs <documento_id>
// =============================================================================
import { generarRespuestas } from "../../lib/suplemento/respuestas.ts";
import { sesionStaffDev } from "./sesion-dev.mjs";

const documentoId = process.argv[2];
if (!documentoId) { console.error("Uso: respuestas-en-seco.mjs <documento_id>"); process.exit(2); }
const { db } = await sesionStaffDev();
const r = await generarRespuestas(db, documentoId, { apiKey: "" });
const nuevas = r.filas.filter((f) => f.notas.some((n) => /sin llave del modelo/.test(n)));
console.log(`filas ${r.filas.length} · se regenerarían con el modelo ${nuevas.length}: ${nuevas.map((f) => `${f.destino}|${f.clave}`).join(", ")}`);
