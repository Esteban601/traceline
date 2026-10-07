#!/usr/bin/env node
// =============================================================================
// PRUEBA DE LA PASADA DE COHERENCIA con tres incoherencias deliberadas
// (encargo 2026-10-06-suplemento-calidad, Paso 3 (d)).
//
//   node --env-file=.env.local --experimental-strip-types \
//        --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/suplemento/probar-coherencia.mjs <documento> [carpeta]
//
// CUESTA DINERO: una llamada con el documento completo (~$0.5–1). Solo contra el
// proyecto dev. Lee los bloques del documento, les introduce EN MEMORIA tres
// incoherencias —no guarda nada en la base— y corre la misma función que la
// pasada real (revisarCoherencia):
//   1. terminología: en el bloque 32, un «Alcance 2» de la prosa pasa a «Scope 2»;
//   2. repetición: el segundo párrafo del bloque 15 se copia al final del 16;
//   3. referencia cruzada: el bloque 27 remite a «la sección de Métricas y
//      objetivos» para los escenarios, que están en el bloque 26 (Estrategia).
// Comprueba que cada una tenga su observación (tipo y bloque) y escribe todo en
// <carpeta>/prueba-incoherencias.json. No imprime credenciales.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { revisarCoherencia } from "../../lib/suplemento/coherencia.ts";
import { BLOQUES } from "../../lib/suplemento/bloques.ts";

const [documento, carpeta = "referencia/suplemento-calidad/paso3"] = process.argv.slice(2);
const REF_DEV = "kmjkoxecxcujxixlxwlb";
if (!documento) { console.error("Uso: probar-coherencia.mjs <documento> [carpeta]"); process.exit(2); }
if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes(REF_DEV)) { console.error("✗ Solo contra el proyecto dev."); process.exit(2); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: doc } = await db.from("documentos_generados").select("tenant_id").eq("id", documento).single();
const { data: perfil } = await db.from("perfil_emisor").select("denominacion_formal, forma_de_referencia").eq("tenant_id", doc.tenant_id).maybeSingle();
const { data: filas } = await db.from("documentos_bloques").select("numero, titulo, seccion, estado, texto, texto_del_emisor").eq("documento_id", documento);
const orden = new Map(BLOQUES.map((b, i) => [b.numero, i]));
const bloques = filas
  .filter((b) => b.texto && !["no_aplica", "no_seleccionado", "error"].includes(b.estado))
  .sort((a, b) => orden.get(a.numero) - orden.get(b.numero))
  .map((b) => ({ numero: b.numero, titulo: b.titulo, seccion: b.seccion ?? "", texto: b.texto, textoDelEmisor: b.texto_del_emisor }));
const de = (n) => bloques.find((b) => b.numero === n);

// --- Las tres incoherencias --------------------------------------------------
const b32 = de(32);
const parrafos32 = b32.texto.split("\n\n");
const iProsa = parrafos32.findIndex((p) => !p.trim().startsWith("|") && p.includes("Alcance 2"));
if (iProsa < 0) throw new Error("el bloque 32 no tiene «Alcance 2» en prosa");
parrafos32[iProsa] = parrafos32[iProsa].replace("Alcance 2", "Scope 2");
b32.texto = parrafos32.join("\n\n");

const repetido = de(15).texto.split("\n\n").filter((p) => !p.trim().startsWith("|"))[1];
de(16).texto = `${de(16).texto}\n\n${repetido}`;

const remision = "Los escenarios climáticos que sustentan la identificación de riesgos y oportunidades se describen en la sección de Métricas y objetivos de este informe.";
de(27).texto = `${de(27).texto}\n\n${remision}`;

const esperadas = [
  { nombre: "terminología: «Scope 2» en el bloque 32", tipos: ["terminologia"], bloque: 32 },
  { nombre: "repetición: párrafo del 15 copiado en el 16", tipos: ["repeticion"], bloque: 16, tambien: 15 },
  { nombre: "referencia cruzada: el 27 remite a Métricas por los escenarios", tipos: ["referencia_cruzada", "contradiccion"], bloque: 27 },
];

console.log(`documento ${documento.slice(0, 8)}… · ${bloques.length} bloques · tres incoherencias introducidas en memoria`);
const r = await revisarCoherencia(
  bloques,
  { denominacionFormal: perfil?.denominacion_formal ?? null, formaDeReferencia: perfil?.forma_de_referencia ?? null },
  process.env.ANTHROPIC_API_KEY
);
if (!r.ok) { console.error(`✗ la pasada falló: ${r.error}`); process.exit(1); }

let fallas = 0;
const deteccion = esperadas.map((e) => {
  const o = r.observaciones.find((x) => e.tipos.includes(x.tipo) && x.bloques.includes(e.bloque) && (!e.tambien || x.bloques.includes(e.tambien)));
  if (!o) fallas++;
  console.log(`${o ? "  ✓" : "  ✗"} ${e.nombre}${o ? ` → ${o.tipo}, bloques ${o.bloques.join(", ")}: «${o.cita.slice(0, 70)}…»` : ""}`);
  return { ...e, detectada: !!o, observacion: o ?? null };
});
console.log(`\n${r.observaciones.length} observaciones (${r.descartadas} descartadas por cita) · $${r.costo.toFixed(4)} · ${(r.duracionMs / 1000).toFixed(0)} s · entrada ${r.uso.entrada} + caché ${r.uso.cacheEscritura}/${r.uso.cacheLectura} · salida ${r.uso.salida}`);

fs.mkdirSync(carpeta, { recursive: true });
fs.writeFileSync(path.join(carpeta, "prueba-incoherencias.json"), JSON.stringify({ documento, deteccion, observaciones: r.observaciones, descartadas: r.descartadas, costo: r.costo, uso: r.uso, duracionMs: r.duracionMs, modelo: r.modelo }, null, 1));
console.log(fallas ? `\n✗ ${fallas} incoherencia(s) sin detectar` : "\n✓ las tres incoherencias detectadas");
process.exit(fallas ? 1 : 0);
