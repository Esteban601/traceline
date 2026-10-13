#!/usr/bin/env node
// =============================================================================
// MEDICIÓN DEL DEMO antes y después del repoblado (encargo suplemento-calidad,
// Paso 5). Sin modelo y sin escribir nada.
//
//   node --env-file=.env.local --experimental-strip-types \
//        --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/suplemento/medir-demo.mjs <etiqueta> [carpeta]
//
// Pendientes = los faltantes del semáforo (evaluarCompletitud, la misma función
// que pinta la pantalla y alimenta al generador), por causa y por bloque; no se
// genera el documento para contarlos. Del libro vigente: bloques sin hechos
// propios, hechos por rango, solicitudes validadas sin fuente y capturas sin
// dueño. Solo contra el proyecto dev.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { evaluarCompletitud } from "../../lib/suplemento/completitud.ts";

const [etiqueta, carpeta = "referencia/suplemento-calidad/paso5"] = process.argv.slice(2);
const REPORTE = "20000000-0000-0000-0000-000000000001";
if (!etiqueta) { console.error("Uso: medir-demo.mjs <etiqueta> [carpeta]"); process.exit(2); }
if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("kmjkoxecxcujxixlxwlb")) { console.error("✗ Solo contra el proyecto dev."); process.exit(2); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const comp = await evaluarCompletitud(db, REPORTE);
if (!comp.ok) throw new Error(comp.causa);
const porEstado = {};
const porCausa = {};
const faltantesPorBloque = {};
for (const b of comp.bloques) {
  porEstado[b.estado] = (porEstado[b.estado] ?? 0) + 1;
  if (b.faltantes.length) faltantesPorBloque[b.numero] = b.faltantes.length;
  for (const f of b.faltantes) porCausa[f.causa] = (porCausa[f.causa] ?? 0) + 1;
}

const { data: corrida } = await db.from("libros_hechos").select("id, estado, reutiliza_libro").eq("reporte_id", REPORTE).in("estado", ["listo", "reutilizado"]).order("created_at", { ascending: false }).limit(1).single();
const libroId = corrida.estado === "reutilizado" ? corrida.reutiliza_libro : corrida.id;
const { data: libro } = await db.from("libros_hechos").select("id, resumen, costo_usd, created_at").eq("id", libroId).single();
const { data: hechos } = await db.from("hechos").select("rango_fuente, fuente_tipo, bloque_dueno, estado").eq("libro_id", libroId);
const sinDueno = (hechos ?? []).filter((h) => h.bloque_dueno == null && h.estado !== "descartado").length;

const medida = {
  etiqueta,
  libro: libro.id,
  semaforo: { bloques_por_estado: porEstado, faltantes_total: Object.values(porCausa).reduce((a, n) => a + n, 0), faltantes_por_causa: porCausa, faltantes_por_bloque: faltantesPorBloque },
  libro_hechos: {
    total: libro.resumen.total,
    por_rango: Object.fromEntries(Object.entries(libro.resumen.por_rango).map(([k, v]) => [k, v.total])),
    en_conflicto: libro.resumen.en_conflicto,
    descartados: libro.resumen.descartados,
    bloques_sin_hechos: libro.resumen.bloques_sin_hechos,
    sin_dueno: sinDueno,
    solicitudes_validadas_sin_fuente: libro.resumen.insumos?.solicitudesValidadasSinFuente,
    exentas_por_alivio: (libro.resumen.insumos?.exentasPorAlivio ?? []).length,
  },
};
fs.mkdirSync(carpeta, { recursive: true });
fs.writeFileSync(path.join(carpeta, `medida-${etiqueta}.json`), JSON.stringify(medida, null, 1));
console.log(JSON.stringify(medida, null, 1));
