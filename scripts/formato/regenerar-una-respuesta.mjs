#!/usr/bin/env node
// =============================================================================
// Regenera UNA o VARIAS respuestas por datapoint de un documento aprobado, en dev,
// en una sola corrida, y guarda solo esas filas (guardarRespuestas borra las filas
// que no recibe, por eso aquí se escribe fila por fila). Cierre del encargo
// 2026-10-26-formato-afirmaciones-y-voz (antes scratchpad v5/solo-k662.mjs); varias
// claves y alta de filas nuevas desde el encargo formato-respuesta-por-inciso.
//
//   node --env-file=<.env.local de dev> --experimental-strip-types \
//        --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/formato/regenerar-una-respuesta.mjs <documento_id> <destino> <clave> [<destino> <clave> …] \
//        [--sin-modelo] [--probar] [--crear]
//
//   destino: «formato» o «taxonomia»; clave: la de respuestas_datapoint (p. ej. «fila:383», «NIIF S1 33(c)»).
//   --sin-modelo: corre sin llave del modelo (costo 0); sirve para las respuestas de regla. Si alguna pedida
//                 necesita el modelo, se detiene sin guardar.
//   --probar:     imprime el texto guardado y el nuevo, sin guardar.
//   --crear:      una clave que el documento aún no tiene se da de alta (sin él, se detiene).
//
// Ojo con el costo: con modelo, la corrida llama también a las respuestas que nunca se reutilizan
// (B65(e) y 21(a)); ese costo se gasta aunque solo se guarden las filas pedidas, y se imprime.
// =============================================================================
import { generarRespuestas } from "../../lib/suplemento/respuestas.ts";
import { sesionStaffDev } from "./sesion-dev.mjs";

const args = process.argv.slice(2);
const [documentoId, ...resto] = args.filter((a) => !a.startsWith("--"));
const pedidas = [];
for (let i = 0; i + 1 < resto.length; i += 2) pedidas.push({ destino: resto[i], clave: resto[i + 1] });
if (!documentoId || !pedidas.length || resto.length % 2 || pedidas.some((p) => !["formato", "taxonomia"].includes(p.destino))) {
  console.error("Uso: regenerar-una-respuesta.mjs <documento_id> <formato|taxonomia> <clave> [<destino> <clave> …] [--sin-modelo] [--probar] [--crear]");
  process.exit(2);
}
const sinModelo = args.includes("--sin-modelo");
const crear = args.includes("--crear");
const { db, admin } = await sesionStaffDev();

const r = await generarRespuestas(db, documentoId, sinModelo ? { apiKey: "" } : {});
const { data: doc } = await admin.from("documentos_generados").select("tenant_id, reporte_id, version").eq("id", documentoId).single();
const nuevas = [];
for (const { destino, clave } of pedidas) {
  const f = r.filas.find((x) => x.destino === destino && x.clave === clave);
  if (!f) { console.error(`✗ La corrida no produce ${destino}|${clave}.`); process.exit(1); }
  if (sinModelo && f.notas.some((n) => /sin llave del modelo/.test(n))) { console.error(`✗ ${destino}|${clave} necesita el modelo; quita --sin-modelo.`); process.exit(1); }
  if (f.estado === "error") { console.error(`✗ ${destino}|${clave} en error: ${JSON.stringify(f.notas)}`); process.exit(1); }
  const { data: previa } = await admin.from("respuestas_datapoint").select("texto").eq("documento_id", documentoId).eq("destino", destino).eq("clave", clave).maybeSingle();
  if (!previa && !crear) { console.error(`✗ El documento no tiene ${destino}|${clave}; para darla de alta, --crear.`); process.exit(1); }
  console.log(`\n${destino}|${clave} · origen ${f.origen} · estado ${f.estado}${previa ? "" : " · NUEVA"}\n  antes:   ${previa ? previa.texto ?? "(sin texto)" : "(no existía)"}\n  después: ${f.texto ?? "(sin texto)"}`);
  nuevas.push(f);
}
console.log(`\ncosto de la corrida ${r.costo.toFixed(4)} USD`);
if (args.includes("--probar")) process.exit(0);

for (const f of nuevas) {
  const registro = {
    tenant_id: doc.tenant_id, reporte_id: doc.reporte_id, documento_id: documentoId, version_documento: doc.version,
    destino: f.destino, clave: f.clave, tipo_campo: f.tipo_campo, estado: f.estado, origen: f.origen, texto: f.texto, valor: f.valor,
    bloque: f.bloque, bloque_version: f.bloque_version, hechos: f.hechos, notas: f.notas, modelo: f.modelo, prompt_version: f.prompt_version,
    tokens_entrada: f.uso.entrada, tokens_cache_escritura: f.uso.cacheEscritura, tokens_cache_lectura: f.uso.cacheLectura, tokens_salida: f.uso.salida, costo_usd: f.costo_usd,
  };
  const { data: hechas, error } = await admin.from("respuestas_datapoint").upsert(registro, { onConflict: "documento_id,destino,clave" }).select("id");
  if (error || hechas?.length !== 1) { console.error(`✗ guardar ${f.destino}|${f.clave}: ${error?.message ?? `${hechas?.length ?? 0} filas`}`); process.exit(1); }
  console.log(`✓ ${f.destino}|${f.clave} guardada`);
}
