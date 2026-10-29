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
  PLAN_DISPOSICION_RE,
  disposicionesSinTipo,
  tipoDeDisposicion,
  erroresDeForma,
  conSeparadoresDeMiles,
  respuestaDeCuestionario36e,
  remisionAIncisos,
  CONCEPTOS_29E,
  seParecen,
} from "../lib/suplemento/respuestas.ts";
import { declaracionDeAlivios, noRevelado, remisionE5, textoAlivio } from "../lib/suplemento/alivios.ts";
import fs from "node:fs";
import { vocabularioProhibidoEn } from "../lib/suplemento/prompt.ts";
import { TERMINOS_PLATAFORMA, glosarioDeClaudeMd, vocabularioEnCeldaExportada } from "../lib/suplemento/vocabulario.ts";
import { conceptoDeCifra } from "../lib/reporte/cifra.ts";
import { avisosDeCoherencia, booleanosVaciosPorContradiccion, llenarFormato } from "../lib/formato/llenar.ts";
import { BOOLEANOS_FORMATO, validarBooleano, valorBooleano } from "../lib/formato/booleanos.ts";
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

console.log("\n1b. Glosario único (CLAUDE.md §5)");
{
  const deClaude = glosarioDeClaudeMd(fs.readFileSync(new URL("../CLAUDE.md", import.meta.url), "utf8"));
  ok(deClaude.length > 0 && JSON.stringify(deClaude) === JSON.stringify(TERMINOS_PLATAFORMA), `el validador y CLAUDE.md §5 dicen lo mismo (${deClaude.join(", ")})`);
  const casos = {
    "Cifras de los registros de clima, capturas validadas.": ["validado", "registros de clima"],
    "Inventario GEI Alcance 1 con memoria de cálculo.": ["memoria de cálculo"],
    "Se describe en los bloques 3 y 4.": ["bloque"],
    "Según la plataforma, el expediente fue entregado.": ["expediente", "entregado", "plataforma"],
    "id 3487cb77-1111-2222-3333-444455556666": ["ids"],
  };
  for (const [t, esperados] of Object.entries(casos)) ok(esperados.every((e) => vocabularioProhibidoEn(t).includes(e)), `detecta ${esperados.join(", ")} en «${t.slice(0, 50)}»`);
  ok(["La validación del informe anual corre a cargo del Comité.", "Proyectos de captura de carbono.", "Intereses recibidos por 3 MDP.", "La Compañía mide sus emisiones."].every((t) => vocabularioProhibidoEn(t).length === 0), "voz legítima de la emisora: «validación», «captura», «recibidos»");
  ok(["El objetivo ha sido validado por un tercero.", "¿Validada por tercero?", "No está validado por SBTi.", "Bloque de texto"].every((t) => vocabularioProhibidoEn(t).length === 0) && vocabularioProhibidoEn("Dato validado en la sección.").includes("validado") && vocabularioProhibidoEn("Cifra validada por IRStrat.").includes("IRStrat"), "excepciones por expresión: «validado por …» y «bloque de texto»; «validado» suelto y «por IRStrat» siguen prohibidos");
  ok(vocabularioEnCeldaExportada("Pendiente: información de B65(e) — sin solicitud en el reporte").length === 0 && vocabularioProhibidoEn("Pendiente: información de B65(e) — sin solicitud en el reporte").length > 0, "celda exportada: el marcador en texto plano puede nombrar la solicitud (CLAUDE.md §5); en el texto del modelo, no");
}

console.log("\n1d. Booleanos del Formato (D1): «Sí.»/«No.» contra el hecho que contesta");
{
  const pregunta = (fila) => BOOLEANOS_FORMATO.find((b) => b.fila === fila);
  ok(BOOLEANOS_FORMATO.length === 10 && [38, 44, 49, 134, 237, 253, 256, 313, 417, 425].every((f) => pregunta(f)), "los 10 booleanos con datapoint tienen pregunta");
  // K38: remuneración. El hecho de tipo `politica` dice que NO forman parte: la respuesta es «No».
  const rem = [{ local: "h1", enunciado: "Las métricas climáticas no forman parte de la remuneración variable en 2025." }];
  ok(validarBooleano("No. Las métricas climáticas no forman parte de la remuneración variable en 2025.", { pregunta: pregunta(38), hechos: rem, citados: ["h1"], vecina: null }).length === 0, "K38: «No.» citando el hecho de la remuneración → aceptada");
  ok(validarBooleano("Sí. Las métricas climáticas forman parte de la remuneración.", { pregunta: pregunta(38), hechos: rem, citados: ["h1"], vecina: null }).some((e) => /lo niega/.test(e)), "K38: «Sí.» con el hecho que lo niega → rechazo");
  // K592: Protocolo GEI. El único negativo es de C5 (otra pregunta): la respuesta es «Sí».
  const gei = [{ local: "h1", enunciado: "La Compañía no hace uso de la medida transitoria del párrafo C5: mide sus emisiones conforme al Protocolo GEI desde 2022." }];
  ok(validarBooleano("Sí. La Compañía mide sus emisiones conforme al Protocolo GEI desde 2022.", { pregunta: pregunta(313), hechos: gei, citados: ["h1"], vecina: null }).length === 0, "K592: «Sí.» aunque el hecho niegue C5 (la negación es de otra pregunta) → aceptada");
  ok(validarBooleano("No. No mide conforme al Protocolo GEI.", { pregunta: pregunta(313), hechos: gei, citados: ["h1"], vecina: null }).length > 0, "K592: «No.» contra el hecho que lo afirma → rechazo");
  ok(validarBooleano("La Compañía mide conforme al Protocolo GEI.", { pregunta: pregunta(313), hechos: gei, citados: ["h1"], vecina: null }).some((e) => /abrir con/.test(e)), "sin «Sí.»/«No.» al inicio → rechazo");
  ok(validarBooleano("Sí. Mide conforme al Protocolo GEI.", { pregunta: pregunta(313), hechos: gei, citados: [], vecina: null }).some((e) => /no cita/.test(e)), "sin citar el hecho que contesta → rechazo");
  ok(validarBooleano("Sí. Mide conforme al Protocolo GEI.", { pregunta: pregunta(313), hechos: gei, citados: ["h1"], vecina: "La Compañía no mide sus emisiones conforme al Protocolo GEI." }).some((e) => /vecina/.test(e)), "la celda narrativa vecina dice lo contrario → rechazo");
  ok(valorBooleano("Sí. Texto.") === "Sí" && valorBooleano("No. Texto.") === "No" && valorBooleano("Texto.") === null, "valorBooleano lee el «Sí.»/«No.» inicial");
}

console.log("\n1e. Booleano vacío por contradicción: el informe lo lista con fila, valor y oración");
{
  const base = { ejercicio: 2025, primerAnio: true, alivios: {}, perfil: { denominacion_formal: null, clave_cotizacion: null, tipo_instrumento: null, fiduciario: null, numero_fideicomiso: null, hechos_posteriores: null, actividades_financieras: [], sector_sasb: [], metricas_industria: null }, hayLogo: false, gei: [], registros: [], objetivos: [], cuestionarios: {}, declaraCumplimiento: false, declaracion: null, cumplimiento: { parciales: [], pendientes: 0 } };
  const conceptos = [{ fila: 313, seccion: "x", tipo: "booleano", clasificacion: "concepto", capa: "1 · fuente", datapoint: "NIIF S2 29 (a)(ii)", bloque: 27, regla: null, alivioE5: false, respondidaEnReferencia: true }];
  const respuestas = [
    { destino: "taxonomia", clave: "NIIF S2 29 (a)(ii)", estado: "respuesta", texto: "La Compañía no mide sus emisiones conforme al Protocolo GEI." },
    { destino: "formato", clave: "fila:313", estado: "respuesta", texto: "Sí. La Compañía mide conforme al Protocolo GEI." },
  ];
  const valores = llenarFormato({ ...base, respuestas }, conceptos);
  const lista = booleanosVaciosPorContradiccion(valores);
  ok(valores.get(313).texto === null && lista.length === 1 && lista[0].celda === "K592" && lista[0].valor === "Sí" && /no mide sus emisiones conforme al Protocolo GEI/.test(lista[0].oracion), `K592 vacío y listado: ${JSON.stringify(lista[0] ?? {})}`);
}

console.log("\n1c. Aviso de coherencia de métricas por industria (D2)");
{
  const perfil = (m, s) => ({ perfil: { metricas_industria: m, sector_sasb: s } });
  ok(avisosDeCoherencia(perfil("No", ["[815200] Finanzas - Bancos comerciales (FN-CB)"])).length === 1, "Perfil en «No» con sector SASB capturado → aviso en la hoja de revisión");
  ok(avisosDeCoherencia(perfil("Sí, parcialmente", ["[815200] Finanzas - Bancos comerciales (FN-CB)"])).length === 0 && avisosDeCoherencia(perfil("No", [])).length === 0, "sin choque (otro juicio, o sin sector SASB) → sin aviso");
}

console.log("\n2. Reglas sin modelo");
ok(respuestaDeCaptura(1240, "tCO2e", 2025) === "1,240 tCO2e (ejercicio 2025).", "respuesta de captura: valor, unidad y periodo, sin «captura validada»");
ok(respuestaDeCaptura(2643446.803, "tCO2e", 2025, "La cifra corresponde a la división Materiales.") === "2,643,446.803 tCO2e (ejercicio 2025); perímetro: La cifra corresponde a la división Materiales.", "con perímetro declarado: «<cifra>; perímetro: <perímetro>» dentro de la respuesta");
ok(conceptoDeCifra("[DEMO] Inventario GEI Alcance 1 con memoria de cálculo") === "Emisiones de Alcance 1" && conceptoDeCifra("Cartera de crédito total 2025") === "Cartera de crédito total 2025" && vocabularioProhibidoEn(conceptoDeCifra("Consumo de diésel con su memoria de cálculo")).length === 0, "concepto publicable de una cifra: sin el título de captura ni «memoria de cálculo»");
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

// Planes de disposición de activos (regla de Esteban): al tipo de riesgo que el hecho nombra como motivo, nunca por
// el bloque al que remite; sin riesgo nombrado (o con los dos), sin tipo para clasificación de IRStrat.
{
  const fisico = "No hay planes de disposición de activos distintos de la reubicación de seis sucursales ubicadas en zonas de inundación, prevista hasta 2028.";
  const transicion = "La Compañía prevé la desinversión de activos varados en generación con carbón por el riesgo de transición.";
  const sinRiesgo = "La Compañía prevé la venta de inmuebles administrativos en 2027.";
  const ambos = "La reubicación de sucursales responde a zonas de inundación y al riesgo de transición de la región.";
  ok(PLAN_DISPOSICION_RE.test(fisico) && tipoDeDisposicion(fisico) === 35, "disposición por zonas de inundación → riesgos físicos (35)");
  ok(tipoDeDisposicion(transicion) === 34, "disposición por activos varados → riesgos de transición (34)");
  ok(tipoDeDisposicion(sinRiesgo) === null && tipoDeDisposicion(ambos) === null, "sin riesgo nombrado, o con los dos, no tiene tipo");
  const sin = disposicionesSinTipo([fisico, transicion, sinRiesgo, ambos, "Las emisiones de Alcance 1 fueron de 1,240 tCO2e."].map((enunciado) => ({ estado: "vigente", enunciado })));
  ok(sin.length === 2 && sin.every((h) => [sinRiesgo, ambos].includes(h.enunciado)), "disposicionesSinTipo lista solo los planes sin tipo");
}

// Fase 5 (revisión externa v5): textos de alivio de una sola fuente, reglas de forma, separadores, 36(e) y glosario.
{
  ok(textoAlivio("C4", "requisito") === "No revelado · alivio C4" && textoAlivio("C4", "cifra") === noRevelado("C4") && textoAlivio("C3", "cifra") === "No revelado · alivio C3", "alivios: C3/C4 con la redacción del Formato («No revelado · alivio …»), también en un requisito");
  ok(textoAlivio("E5", "requisito", "NIIF S2 21(a)") === remisionE5("NIIF S2 21(a)") && textoAlivio("E5", "requisito") === ORACION_E5 && textoAlivio("E5", "encabezado") === ORACION_E5, "alivios: E5 requisito = remisión a su par, o la oración sin par");
  ok(textoNoAplicaE5("NIIF S2 21(a)") === `${ORACION_E5} ${remisionE5("NIIF S2 21(a)")}`, "textoNoAplicaE5 se arma con el módulo de alivios");
  ok(PAR_S2_DE_S1.get("niifs130(a)y(b)") === "NIIF S2 10(a), (b)y(c)" && PAR_S2_DE_S1.get("niifs140(a)") === "NIIF S2 21(a)" && PAR_S2_DE_S1.get("niifs146a50") === "NIIF S2 29", "pares S1→S2: 30(a)y(b), 40(a) y 46–50 completos");
  ok(declaracionDeAlivios({ E4: true, E5: true, C3: true, C4: true }) === "Alivios de transición aplicados en este ejercicio: NIIF S1 E4 y E5; NIIF S2 C3 y C4." && declaracionDeAlivios({}) === "Sin alivios de transición en este ejercicio.", "K12: la declaración de los alivios");
  ok(erroresDeForma("Sí. La Compañía utiliza escenarios.", "NIIF S2 25 (a)(ii)").length === 1 && erroresDeForma("Sí. Respecto del periodo anterior…", "fila:134").length === 0, "una respuesta que no es booleano no abre con «Sí.»; el booleano sí");
  const transicion = "fila:361"; // riesgo de ajuste material, transición (K640)
  ok(erroresDeForma("No se identificó un riesgo significativo de ajuste material por los riesgos climáticos.", transicion).some((e) => /de transición/.test(e)) && !erroresDeForma("No se identificó un riesgo significativo de ajuste material por los riesgos de transición.", transicion).length, "B65(c): la celda nombra su tipo de riesgo (K640)");
  ok(conSeparadoresDeMiles("fue de 488000 litros en 2025", [{ valor: "488000" }, { valor: 2025 }]) === "fue de 488,000 litros en 2025", "separador de miles en las cifras de los hechos; un año no lo lleva");
  ok(conSeparadoresDeMiles("ISO 14064 y 488,000 litros", [{ valor: 488000 }]) === "ISO 14064 y 488,000 litros", "un número ya formateado o ajeno a los hechos no se toca");
  const cuest = [{ hoja: "S2 36(e)", pregunta_orden: 1, respuesta: "No se basa en créditos de carbono." }, { hoja: "S2 36(e)", pregunta_orden: 3, respuesta: "Bajo" }];
  ok(respuestaDeCuestionario36e("NIIF S2 36 (e)(i)", cuest) === "No se basa en créditos de carbono." && respuestaDeCuestionario36e("NIIF S2 36 (e)(iii)", cuest) === null && respuestaDeCuestionario36e("NIIF S2 36 (c)", cuest) === null, "36(e): la respuesta de texto del cuestionario por inciso (fila 276); las de lista no");
  // Encargo formato-respuesta-por-inciso, Fase 1.
  ok(respuestaDeCuestionario36e("NIIF S2 36 (e)(ii)", [{ hoja: "S2 36(e)", pregunta_orden: 2, respuesta: "No aplica: la Compañía no prevé el uso de créditos." }]) === null, "36(e): una respuesta del cuestionario que solo dice «No aplica…» no responde el inciso (toma la redacción de regla)");
  ok(remisionAIncisos(["NIIF S2 36 (e)(i)", "NIIF S2 36 (e)(ii)", "NIIF S2 36 (e)(iii)", "NIIF S2 36 (e)(iv)"]) === "La información correspondiente a este requisito se revela en sus incisos, conforme a NIIF S2 36 (e)(i) a (iv).", "36(e): el padre remite a (i)–(iv)");
  ok(!vocabularioEnCeldaExportada(remisionAIncisos(["NIIF S2 36 (e)(i)", "NIIF S2 36 (e)(iv)"])).length, "la remisión a los incisos no usa vocabulario de plataforma");
  ok(CONCEPTOS_29E.map((c) => `${c.fila}:${c.bloque}`).join(" ") === "350:34 373:35 396:36", "29(e) por tipo: filas 350, 373 y 396 con los bloques de transición, físicos y oportunidades");
  // Fase 2.
  ok(erroresDeForma("Los hechos no describen entradas o salidas de efectivo.", "fila:89").length === 1 && !erroresDeForma("La Compañía no revela hechos posteriores relevantes.", "NIIF S1 74").length, "voz de la emisora: no habla de «los hechos»; «hechos posteriores» sí se permite");
  ok(seParecen("Con la información disponible al cierre de 2025, la Compañía no identificó efectos climáticos que requirieran reconocer ajustes en los estados financieros.", "Con la información disponible al cierre de 2025, la Compañía no identificó efectos de los riesgos climáticos que requirieran reconocer ajustes en los importes de los estados financieros del ejercicio.") && !seParecen("Las primas de seguros se registraron en gastos de administración.", "Las adecuaciones de inmuebles se capitalizaron en propiedades, mobiliario y equipo."), "16(a) por efecto: la misma oración parafraseada se detecta; dos oraciones distintas no");
  ok(vocabularioEnCeldaExportada("Métricas por industria: pendiente de catálogo SASB (Fase C).").length >= 2 && vocabularioEnCeldaExportada("Escenarios NGFS fase IV e IPCC AR6.").length === 0, "glosario: «Fase C» y «pendiente de catálogo» se detectan; «fase IV» de NGFS no");
  ok(["sprint", "encargo", "ampliación del catálogo", "por decidir", "sin mapeo"].every((x) => vocabularioEnCeldaExportada(`Texto con ${x} interno.`).length), "glosario: sprint, encargo, ampliación del catálogo, por decidir, sin mapeo");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
