#!/usr/bin/env node
// =============================================================================
// Regenera UNA respuesta por datapoint de un documento aprobado, en dev, y guarda
// solo esa fila (guardarRespuestas borra las filas que no recibe, por eso aquí se
// actualiza la fila directamente). Cierre del encargo
// 2026-10-26-formato-afirmaciones-y-voz (antes scratchpad v5/solo-k662.mjs).
//
//   node --env-file=<.env.local de dev> --experimental-strip-types \
//        --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/formato/regenerar-una-respuesta.mjs <documento_id> <destino> <clave> [--sin-modelo] [--probar]
//
//   destino: «formato» o «taxonomia»; clave: la de respuestas_datapoint (p. ej. «fila:383», «NIIF S1 33(c)»).
//   --sin-modelo: corre sin llave del modelo (costo 0); sirve para las respuestas de regla. Si la pedida
//                 necesita el modelo, se detiene sin guardar.
//   --probar:     imprime el texto guardado y el nuevo, sin guardar.
//
// Ojo con el costo: con modelo, la corrida llama también a las respuestas que nunca se reutilizan
// (B65(e) y 21(a)); ese costo se gasta aunque solo se guarde la fila pedida, y se imprime.
// =============================================================================
import { generarRespuestas } from "../../lib/suplemento/respuestas.ts";
import { sesionStaffDev } from "./sesion-dev.mjs";

const args = process.argv.slice(2);
const [documentoId, destino, clave] = args.filter((a) => !a.startsWith("--"));
if (!documentoId || !["formato", "taxonomia"].includes(destino) || !clave) {
  console.error("Uso: regenerar-una-respuesta.mjs <documento_id> <formato|taxonomia> <clave> [--sin-modelo] [--probar]");
  process.exit(2);
}
const sinModelo = args.includes("--sin-modelo");
const { db, admin } = await sesionStaffDev();

const r = await generarRespuestas(db, documentoId, sinModelo ? { apiKey: "" } : {});
const f = r.filas.find((x) => x.destino === destino && x.clave === clave);
if (!f) { console.error(`✗ La corrida no produce ${destino}|${clave}.`); process.exit(1); }
if (sinModelo && f.notas.some((n) => /sin llave del modelo/.test(n))) { console.error(`✗ ${destino}|${clave} necesita el modelo; quita --sin-modelo.`); process.exit(1); }
if (f.estado === "error") { console.error(`✗ ${destino}|${clave} en error: ${JSON.stringify(f.notas)}`); process.exit(1); }

const { data: previa } = await admin.from("respuestas_datapoint").select("texto").eq("documento_id", documentoId).eq("destino", destino).eq("clave", clave).maybeSingle();
if (!previa) { console.error(`✗ El documento no tiene guardada ${destino}|${clave}; esta herramienta solo actualiza.`); process.exit(1); }
console.log(`antes:   ${previa.texto}\ndespués: ${f.texto}`);
console.log(`costo de la corrida ${r.costo.toFixed(4)} USD · origen ${f.origen} · estado ${f.estado}`);
if (args.includes("--probar")) process.exit(0);

const { data: d } = await admin.from("documentos_generados").select("version").eq("id", documentoId).single();
const { data: hechas, error } = await admin.from("respuestas_datapoint").update({
  version_documento: d.version, tipo_campo: f.tipo_campo, estado: f.estado, origen: f.origen, texto: f.texto, valor: f.valor,
  bloque: f.bloque, bloque_version: f.bloque_version, hechos: f.hechos, notas: f.notas, modelo: f.modelo, prompt_version: f.prompt_version,
  tokens_entrada: f.uso.entrada, tokens_cache_escritura: f.uso.cacheEscritura, tokens_cache_lectura: f.uso.cacheLectura, tokens_salida: f.uso.salida, costo_usd: f.costo_usd,
}).eq("documento_id", documentoId).eq("destino", destino).eq("clave", clave).select("id");
if (error || hechas?.length !== 1) { console.error(`✗ guardar: ${error?.message ?? `${hechas?.length ?? 0} filas`}`); process.exit(1); }
console.log(`✓ ${destino}|${clave} guardada`);
