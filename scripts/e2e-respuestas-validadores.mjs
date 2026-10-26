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
  primeraPersonaPlural,
  ORACION_E5,
  respuestaDeCaptura,
  textoNoAplicaHeredado,
  validarRespuesta,
} from "../lib/suplemento/respuestas.ts";
import { vocabularioProhibidoEn } from "../lib/suplemento/prompt.ts";
import { numeracionConsecutiva } from "../lib/suplemento/numeracion.ts";
import { HECHO_RAZON, hechosPrestados } from "../lib/suplemento/hechos/razones.ts";
import { validarCobertura } from "../lib/suplemento/hechos/bloque.ts";

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
ok(["La cuantificación es una tarea que iremos completando.", "Nos comprometemos a reportar.", "Nuestra cartera creció.", "Hemos reducido emisiones.", "Reportaremos los avances."].every((t) => primeraPersonaPlural(t).length > 0), "voz: detecta la primera persona del plural (iremos, nos comprometemos, nuestra, hemos, reportaremos)");
ok(["La Compañía reconoce que completará la medición.", "Los eventos extremos y los mínimos regulatorios.", "Los últimos años y los próximos periodos.", "La Compañía se compromete a reportar."].every((t) => primeraPersonaPlural(t).length === 0), "voz: no confunde tercera persona ni palabras como «extremos», «mínimos» o «próximos»");
ok(textoNoAplicaE5("NIIF S2 6 (a)").endsWith("en lo relativo al clima, se revela conforme a NIIF S2 6 (a).") && textoNoAplicaE5(null) === ORACION_E5 && !/suplemento|solicitud|evidencia|IRStrat/i.test(textoNoAplicaE5("NIIF S2 6 (a)")), "«No aplica · E5»: la oración E5 y el par de NIIF S2, sin vocabulario de plataforma");
const num = numeracionConsecutiva([21, 19, 15, 33, 19]);
ok(num.get(15) === 1 && num.get(19) === 2 && num.get(21) === 3 && num.get(33) === 4, "numeración consecutiva: 15, 19, 21, 33 → 1, 2, 3, 4");
ok(remision(21, num) === "Ver sección 3 · Riesgos climáticos prioritarios", "la remisión usa la numeración del documento");
ok(sinRemision("La Compañía revela X. Ver sección 22 · Riesgos climáticos prioritarios.") === "La Compañía revela X.", "la remisión se quita para reutilizar el texto con la numeración vigente");

console.log("\n4. Hecho prestado: la razón de NIIF S2 21(a) en el bloque 10 (hechos/razones.ts)");
{
  const VIGENTE = "libro-vigente", VIEJO = "libro-viejo";
  const REQ = ["NIIF S2 16(a)", "NIIF S2 21(a)"];
  const propio = { id: "p1", clave: "efectos_financieros.ajustes_reconocidos_2025", libro_id: VIGENTE, estado: "vigente", dueno: 10, rango: "validado" };
  const carta = (id, clave, libro, estado = "vigente") => ({ id, clave, libro_id: libro, estado, dueno: 1, rango: "narrativo" });
  const esPropio = (h) => h.libro_id === VIGENTE && h.dueno === 10;
  ok(HECHO_RAZON["NIIF S2 21(a)"].clave.test("emisora.carta_compromiso_transparencia") && HECHO_RAZON["NIIF S2 21(a)"].clave.test("emisora.compromiso_transparencia_limitaciones") && !HECHO_RAZON["NIIF S2 21(a)"].clave.test("emisora.carta_avances_2025"), "la clave cubre las dos variantes de los libros (14/10 y 8–11/10) y nada más");
  const ambos = hechosPrestados(REQ, [propio, carta("v1", "emisora.carta_compromiso_transparencia", VIGENTE), carta("o1", "emisora.carta_compromiso_transparencia", VIEJO)], VIGENTE, esPropio);
  ok(ambos.length === 1 && ambos[0].id === "v1", "con el hecho en dos libros: uno solo, del libro vigente primero");
  const variantes = hechosPrestados(REQ, [propio, carta("v1", "emisora.carta_compromiso_transparencia", VIGENTE), carta("o1", "emisora.compromiso_transparencia_limitaciones", VIEJO)], VIGENTE, esPropio);
  ok(variantes.length === 1 && variantes[0].id === "v1", "con las dos variantes de clave en dos libros: un solo hecho por requisito, el del libro vigente");
  const soloViejo = hechosPrestados(REQ, [propio, carta("o1", "emisora.compromiso_transparencia_limitaciones", VIEJO)], VIGENTE, esPropio);
  ok(soloViejo.length === 1 && soloViejo[0].libro_id === VIEJO, "si el libro vigente no lo tiene, se toma de otro libro del documento, con su libro de origen");
  ok(hechosPrestados(["NIIF S2 16(a)"], [carta("v1", "emisora.carta_compromiso_transparencia", VIGENTE)], VIGENTE, esPropio).length === 0, "un bloque sin requisitos con razón no toma nada prestado");
  ok(hechosPrestados(REQ, [carta("v1", "emisora.carta_compromiso_transparencia", VIGENTE, "descartado")], VIGENTE, esPropio).length === 0, "un hecho descartado no se presta");
  ok(hechosPrestados(REQ, [{ ...carta("v1", "emisora.carta_compromiso_transparencia", VIGENTE), dueno: 10 }], VIGENTE, esPropio).length === 0, "si el bloque ya es dueño del hecho, no se duplica");

  // Cobertura del bloque 10 (validador del generador): los ids que entrega el insumo son los propios y los prestados.
  const TEXTO = "La Compañía no identificó efectos que requirieran reconocer ajustes; la cuantificación de los efectos financieros previstos se completará en los próximos periodos.";
  const cob = (estado, hechos) => [{ codigo: "NIIF S2 16(a)", estado: "cubierto", bloque: 10, hechos: ["h1"], comentario: "" }, { codigo: "NIIF S2 21(a)", estado, bloque: 10, hechos, comentario: "" }];
  const conHecho = ["h1", ...ambos.map((_, i) => `h${i + 2}`)];
  const rango = new Map([["h1", "validado"], ["h2", "narrativo"]]);
  ok(validarCobertura(cob("cubierto", ["h1", "h2"]), REQ, 10, new Set(conHecho), null, TEXTO, rango).length === 0, "CON hecho: 21(a) «cubierto» con el hecho propio y el prestado, sin marcador de pendiente");
  const sinHecho = hechosPrestados(REQ, [propio], VIGENTE, esPropio);
  const idsSin = new Set(["h1", ...sinHecho.map((_, i) => `h${i + 2}`)]);
  ok(sinHecho.length === 0 && validarCobertura(cob("cubierto", ["h1", "h2"]), REQ, 10, idsSin, null, TEXTO, rango).some((e) => /h2/.test(e)), "SIN hecho: no se presta nada y «cubierto» citando la razón falla");
  ok(validarCobertura(cob("pendiente", []), REQ, 10, idsSin, null, TEXTO, rango).some((e) => /marcador/.test(e)), "SIN hecho: «pendiente» exige el marcador en el texto");
  ok(validarCobertura(cob("pendiente", []), REQ, 10, idsSin, null, `${TEXTO} [Pendiente: explicación de por qué no se cuantifican los efectos previstos — Efectos financieros, campo explicación]`, rango).length === 0, "SIN hecho: 21(a) «pendiente» con su marcador es válido");
  ok(validarCobertura(cob("cubierto", ["h2"]), REQ, 10, new Set(conHecho), null, TEXTO, rango).some((e) => /narrativos/.test(e)), "el hecho prestado (narrativo) no sostiene 21(a) solo: va con uno propio de otro rango");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
