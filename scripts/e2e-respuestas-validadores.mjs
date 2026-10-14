#!/usr/bin/env node
// =============================================================================
// E2E · validadores y reglas sin modelo de las respuestas por datapoint (encargo
// 2026-10-13-excel-respuestas-narrativas, Paso 2).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-respuestas-validadores.mjs
//
// Sin base ni modelo: costo 0.
// =============================================================================
import {
  DATAPOINTS_FORMATO_TEXTO,
  LIMITES,
  PAR_S2_DE_S1,
  oracionesAncladas,
  paraFormatoElectronico,
  pendienteEnTextoPlano,
  remision,
  sinRemision,
  textoNoAplicaE5,
  respuestaDeCaptura,
  textoNoAplicaHeredado,
  validarRespuesta,
} from "../lib/suplemento/respuestas.ts";
import { vocabularioProhibidoEn } from "../lib/suplemento/prompt.ts";
import { numeracionConsecutiva } from "../lib/suplemento/numeracion.ts";

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

const BLOQUE = "La Compañía no identificó efectos que requirieran ajustes en 2025. Las primas de seguros sumaron 6.2 millones de pesos.";
const H = [
  { id: "u1", local: "h1", tipo: "declaracion_negativa", enunciado: "No se identificaron efectos que requirieran ajustes.", extracto: "no identificó efectos", valor: null, unidad: null },
  { id: "u2", local: "h2", tipo: "cifra", enunciado: "Primas de seguros de 6.2 millones de pesos.", extracto: "6.2 millones", valor: 6.2, unidad: "MDP" },
];
const ctx = (citados = ["h1", "h2"]) => ({ codigo: "NIIF S2 16(a)", textoBloque: BLOQUE, hechos: H, citados });

console.log("\n1. validarRespuesta");
ok(validarRespuesta("La Compañía no identificó efectos que requirieran ajustes en 2025. Las primas sumaron 6.2 millones de pesos.", "taxonomia", ctx()).length === 0, "respuesta fiel → sin errores");
ok(validarRespuesta("Las primas sumaron 6.3 millones de pesos en 2025.", "taxonomia", ctx()).some((e) => /cifras/.test(e)), "cifra fuera de la sección y los hechos → rechazo");
ok(validarRespuesta("Las primas de seguros sumaron 6.2 millones de pesos en 2025.", "taxonomia", ctx()).some((e) => /negativa/.test(e)), "omite la declaración negativa → rechazo");
ok(validarRespuesta("Sin efectos que requirieran ajustes en 2025; primas de 6.2 millones de pesos.", "taxonomia", ctx()).length === 0, "negación parafraseada («sin efectos») → aceptada");
ok(validarRespuesta("La Compañía no identificó efectos en 2025.", "taxonomia", ctx(["h9"])).some((e) => /no se entregaron/.test(e)), "cita un hecho ajeno → rechazo");
ok(validarRespuesta("La Compañía no identificó efectos en 2025.", "taxonomia", ctx([])).some((e) => /ningún hecho/.test(e)), "no cita hechos → rechazo");
const cinco = "La Compañía no identificó efectos. Las primas sumaron 6.2 millones. Se revisa cada año. Se informa al Consejo. Se documenta en actas.";
ok(validarRespuesta(cinco, "taxonomia", ctx()).some((e) => /oraciones/.test(e)), "cinco oraciones en taxonomía → rechazo (máximo 4)");
ok(!validarRespuesta(cinco, "formato", ctx()).some((e) => /oraciones/.test(e)), "las mismas cinco en formato → sin rechazo por oraciones (máximo 6)");
ok(validarRespuesta(`La Compañía no identificó efectos. ${"x".repeat(900)}`, "formato", ctx()).some((e) => /caracteres/.test(e)), "más de 900 caracteres en formato → rechazo");
ok(validarRespuesta("La Compañía no identificó efectos según la evidencia validada.", "taxonomia", ctx()).some((e) => /vocabulario/.test(e)), "vocabulario de plataforma → rechazo");
ok(validarRespuesta("La Compañía no identificó efectos [Pendiente: algo — campo].", "taxonomia", ctx()).some((e) => /marcador/.test(e)), "marcador [Pendiente] en un documento aprobado → rechazo");
ok(LIMITES.taxonomia.oraciones === 4 && LIMITES.formato.oraciones === 6 && LIMITES.formato.caracteres === 900, "límites: taxonomía 4 oraciones; formato 6 oraciones y 900 caracteres");

console.log("\n2. Reglas sin modelo");
ok(respuestaDeCaptura(1240, "tCO2e", 2025) === "1,240 tCO2e (ejercicio 2025), según captura validada.", "respuesta de captura: valor, unidad, periodo");
const anclas = [
  { oracion: "Primera oración anclada a u2.", hechos: [{ id: "h2", hecho: "u2" }] },
  { oracion: "Oración de otro hecho.", hechos: [{ id: "h3", hecho: "u3" }] },
  { oracion: "Segunda oración anclada a u1.", hechos: [{ id: "h1", hecho: "u1" }] },
];
ok(oracionesAncladas(anclas, ["u1", "u2"], 4) === "Primera oración anclada a u2. Segunda oración anclada a u1.", "respaldo: solo las oraciones ancladas a los hechos del requisito, en orden");
ok(remision(15) === "Ver sección 15 · Roles y responsabilidades del órgano de gobierno", "remisión «Ver sección N · título» desde BLOQUES");
for (const c of ["NIIF S2 36 (c)", "NIIF S2 36 (e)(ii)"]) {
  ok(vocabularioProhibidoEn(textoNoAplicaHeredado(c)).length === 0 && !/emisora|cuestionario/i.test(textoNoAplicaHeredado(c)), `«no aplica» heredado de ${c} en voz de la emisora`);
}
ok(DATAPOINTS_FORMATO_TEXTO.has("NIIF S2 6 (a)") && DATAPOINTS_FORMATO_TEXTO.size > 50, `datapoints del formato con conceptos text/text block: ${DATAPOINTS_FORMATO_TEXTO.size}`);
ok(PAR_S2_DE_S1.get("niifs127(a)") === "NIIF S2 6 (a)", "par S1→S2 del mapeo: NIIF S1 27(a) → NIIF S2 6 (a)");

console.log("\n3. Revisión externa del Excel (especificación 0.41)");
ok(pendienteEnTextoPlano("[Pendiente: dato X — solicitud Y]") === "Pendiente: dato X — solicitud Y", "el pendiente sale en texto plano para el Excel");
ok(paraFormatoElectronico("pendiente", "[Pendiente: dato X — solicitud Y]") === null && paraFormatoElectronico("respuesta", "Texto.") === "Texto.", "en el Formato electrónico, un pendiente deja la celda vacía");
ok(textoNoAplicaE5("NIIF S2 6 (a)").endsWith("Sin sección en el suplemento; ver NIIF S2 6 (a).") && textoNoAplicaE5(null).endsWith("Sin sección en el suplemento."), "«No aplica · E5»: sin sección en el suplemento; ver NIIF S2 N");
const num = numeracionConsecutiva([21, 19, 15, 33, 19]);
ok(num.get(15) === 1 && num.get(19) === 2 && num.get(21) === 3 && num.get(33) === 4, "numeración consecutiva: 15, 19, 21, 33 → 1, 2, 3, 4");
ok(remision(21, num) === "Ver sección 3 · Riesgos climáticos prioritarios", "la remisión usa la numeración del documento");
ok(sinRemision("La Compañía revela X. Ver sección 22 · Riesgos climáticos prioritarios.") === "La Compañía revela X.", "la remisión se quita para reutilizar el texto con la numeración vigente");

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
