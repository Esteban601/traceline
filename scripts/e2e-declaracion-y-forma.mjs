#!/usr/bin/env node
// =============================================================================
// E2E · declaración de cumplimiento, fideicomisos y forma de referencia (encargo
// s1-72-reserva-y-emisora, Fase 1).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-declaracion-y-forma.mjs
//
// Sin base ni modelo: costo 0. Cubre:
//   1. el bloque 2 y el 3 con las cuatro combinaciones de la declaración (sin texto, la oración del demo, sin reserva
//      con texto propio, con reserva), y que el demo no cambia de texto;
//   2. las filas 285 y 286 del Formato y el aviso de la decisión 3;
//   3. la sección «Para: Fideicomisos» con las nueve opciones de la plantilla (cinco fiduciarias);
//   4. la forma de referencia: textos fijos con el default y con «la Emisora», el prompt y el validador de voz.
// =============================================================================
import fs from "node:fs";
import { PLANTILLAS } from "../lib/suplemento/plantillas.ts";
import { PENDIENTE_DECLARACION, declaracionVigente, leerDeclaracion } from "../lib/suplemento/declaracion.ts";
import { FORMA_POR_DEFECTO, enForma, formaDeReferencia, formasAjenas } from "../lib/suplemento/forma.ts";
import { ORACION_E4, ORACION_E5, ALCANCE_E5 } from "../lib/suplemento/alivios.ts";
import { textoNoAplicaHeredado, validarRespuesta } from "../lib/suplemento/respuestas.ts";
import { avisosDeCoherencia, llenarFormato, FILAS_FIDEICOMISO } from "../lib/formato/llenar.ts";
import { INSTRUMENTOS_FIDUCIARIOS, INSTRUMENTOS_FORMATO, esInstrumentoFiduciario } from "../lib/perfil-emisor.ts";
import { capaEstable, PROMPT_VERSION, PROMPT_VERSION_HECHOS } from "../lib/suplemento/prompt.ts";
import { BLOQUES } from "../lib/suplemento/bloques.ts";

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

const DEN = "Empresa Demo, S.A.B. de C.V.";
// La oración que la plantilla del bloque 2 escribía antes del encargo (y la que prellena la migración en los demo).
const ORACION_DEMO = (den, forma, ej) => `${den} (en adelante, ${forma}) presenta la información a revelar relacionada con la sostenibilidad y con el clima correspondiente al ejercicio ${ej}, preparada de conformidad con las Normas NIIF S1 y NIIF S2 emitidas por el Consejo de Normas Internacionales de Sostenibilidad.`;
const PARRAFO_E4 = "Conforme a la medida transitoria del párrafo E4 de la NIIF S1, en este primer periodo anual esta información se publica con posterioridad a los estados financieros del mismo periodo, a los que se refiere.";
const ctx = (declaracion, extra = {}) => ({
  denominacionFormal: DEN, formaDeReferencia: "la Compañía", ejercicio: 2025, regimen: "primer_anio", anioAdopcion: 2025,
  alivios: { E4: true, E5: true, C3: true, C4: true }, nombreReporte: "Reporte 2025", declaracion, ...extra,
});
const RESERVA = "El presente informe se ha preparado procurando el cumplimiento de las Normas NIIF S1 y NIIF S2; la Compañía no declara el cumplimiento de todos sus requerimientos en este ejercicio.";

console.log("\n1. Bloque 2 y bloque 3 con las cuatro combinaciones");
{
  // Lo que el bloque 2 del demo decía antes del encargo: debe salir idéntico con la oración prellenada.
  const antes = [ORACION_DEMO(DEN, "la Compañía", 2025), "", PARRAFO_E4].join("\n");
  const demo = PLANTILLAS[2](ctx({ modo: "sin_reserva", texto: ORACION_DEMO(DEN, "la Compañía", 2025) }));
  ok(demo.texto === antes && demo.pendientes.length === 0, "demo «sin reserva» con la oración actual → el bloque 2 no cambia ni un carácter");

  const sinTexto = PLANTILLAS[2](ctx({ modo: null, texto: null }));
  ok(sinTexto.texto.includes(PENDIENTE_DECLARACION) && sinTexto.pendientes.includes(PENDIENTE_DECLARACION), "sin declaración → marcador de pendiente en el bloque 2 y en sus pendientes (no se aprueba)");
  ok(!/de conformidad con/.test(sinTexto.texto) && sinTexto.texto.startsWith(`${DEN} (en adelante, la Compañía) presenta`), "sin declaración → la plantilla dice quién presenta, sin «de conformidad con»");

  const conReserva = PLANTILLAS[2](ctx({ modo: "con_reserva", texto: RESERVA }));
  ok(conReserva.texto.split("\n").includes(RESERVA) && conReserva.pendientes.length === 0, "con reserva → el texto de la emisora, tal cual, en su propio párrafo");
  ok(!/de conformidad con/.test(conReserva.texto.replace(RESERVA, "")), "con reserva → la plantilla no afirma conformidad");

  const propio = "La Compañía declara que esta información cumple con todos los requerimientos de las Normas NIIF S1 y NIIF S2.";
  const sinReserva = PLANTILLAS[2](ctx({ modo: "sin_reserva", texto: propio }));
  ok(sinReserva.texto.split("\n")[0].startsWith(DEN) && sinReserva.texto.includes(`\n\n${propio}\n\n`), "sin reserva con texto que no abre con la denominación → quién presenta + la declaración");

  const b3con = PLANTILLAS[3](ctx({ modo: "con_reserva", texto: RESERVA }));
  const b3sin = PLANTILLAS[3](ctx({ modo: "sin_reserva", texto: ORACION_DEMO(DEN, "la Compañía", 2025) }));
  ok(!/de conformidad con/.test(b3con.texto) && /aplica las Normas NIIF S1 y NIIF S2/.test(b3con.texto), "bloque 3 con reserva → «con base en» y «aplica», sin «de conformidad con»");
  ok(/se prepara de conformidad con la NIIF S1/.test(b3sin.texto) && /informa de conformidad con las Normas/.test(b3sin.texto), "bloque 3 sin reserva → el texto de siempre");
  const b3sub = PLANTILLAS[3](ctx({ modo: "con_reserva", texto: RESERVA }, { regimen: "subsecuentes", ejercicio: 2026 }));
  ok(/La Compañía aplica las Normas NIIF S1 y NIIF S2 desde el ejercicio 2025/.test(b3sub.texto), "bloque 3 con reserva, ejercicio subsecuente → «aplica … desde»");

  ok(declaracionVigente({ modo: "con_reserva", texto: RESERVA }, conReserva.texto) === RESERVA, "NIIF S1 72 / fila 285: la declaración vigente es la del bloque 2 aprobado");
  ok(declaracionVigente({ modo: "con_reserva", texto: `${RESERVA} Cambio posterior.` }, conReserva.texto) === null, "declaración cambiada después de aprobar el bloque 2 → pendiente hasta reaprobar");
  ok(JSON.stringify(leerDeclaracion({ declaracion_cumplimiento: "otro", declaracion_cumplimiento_texto: "  " })) === JSON.stringify({ modo: null, texto: null }), "leerDeclaracion: modo desconocido y texto vacío → null");
}

console.log("\n2. Filas 285 y 286 del Formato y el aviso (decisión 3)");
{
  const base = { ejercicio: 2025, primerAnio: true, alivios: { E5: true }, perfil: { denominacion_formal: DEN, clave_cotizacion: null, tipo_instrumento: "Acciones", fiduciario: null, numero_fideicomiso: null, fideicomitente: null, administrador_patrimonio: null, hechos_posteriores: null, actividades_financieras: [], sector_sasb: [], metricas_industria: null }, hayLogo: false, respuestas: [], gei: [], registros: [], objetivos: [], cuestionarios: {} };
  const limpio = { parciales: [], pendientes: 0 };
  const sucio = { parciales: ["NIIF S2 29 (a)(vi)"], pendientes: 2 };
  const v = (modo, declaracion, cumplimiento) => llenarFormato({ ...base, modoDeclaracion: modo, declaracion, cumplimiento });
  const sinCaptura = v(null, null, limpio);
  ok(sinCaptura.get(286).texto === null && sinCaptura.get(286).origen === "pendiente" && sinCaptura.get(285).texto === null, "sin declaración → 285 y 286 vacías (pendientes)");
  const reserva = v("con_reserva", RESERVA, limpio);
  ok(reserva.get(286).texto === "No", "con reserva y documento limpio → 286 «No», siempre");
  ok(reserva.get(285).texto === `${ORACION_E5} ${RESERVA}`, "con reserva → 285 con el texto de la emisora (y la oración del E5 delante)");
  ok(v("sin_reserva", "Declaración.", limpio).get(286).texto === "Sí", "sin reserva, cero pendientes y cero parciales → 286 «Sí»");
  const conPend = v("sin_reserva", "Declaración.", sucio);
  ok(/^No\. Falta completar requisitos con información parcial: NIIF S2 29 \(a\)\(vi\); 2 pendiente\(s\)/.test(conPend.get(286).texto), "sin reserva con pendientes → 286 «No. Falta completar…»");
  const avisos = (modo, c) => avisosDeCoherencia({ ...base, modoDeclaracion: modo, declaracion: "Declaración.", cumplimiento: c });
  ok(avisos("sin_reserva", sucio).some((a) => /Declaración de cumplimiento sin reserva/.test(a)), "sin reserva con pendientes → aviso para la hoja «Avisos» y el log de la descarga");
  ok(!avisos("sin_reserva", limpio).length && !avisos("con_reserva", sucio).length && !avisos(null, sucio).length, "sin aviso: documento limpio, con reserva o sin declaración");
}

console.log("\n3. Fideicomisos: las nueve opciones de la plantilla");
{
  const base = { ejercicio: 2025, primerAnio: true, alivios: {}, hayLogo: false, respuestas: [], gei: [], registros: [], objetivos: [], cuestionarios: {}, modoDeclaracion: null, declaracion: null, cumplimiento: { parciales: [], pendientes: 0 } };
  const perfil = (tipo) => ({ denominacion_formal: "Fideicomiso Demo", clave_cotizacion: "FDEMO", tipo_instrumento: tipo, fiduciario: "Banco Fiduciario Demo", numero_fideicomiso: "F/0000", fideicomitente: "Fideicomitente Demo", administrador_patrimonio: "Administrador Demo", hechos_posteriores: null, actividades_financieras: [], sector_sasb: [], metricas_industria: null });
  ok(INSTRUMENTOS_FORMATO.length === 9 && INSTRUMENTOS_FIDUCIARIOS.length === 5 && INSTRUMENTOS_FIDUCIARIOS.every((x) => /^(Fideicomisos|Certificados Bursátiles Fiduciarios)/.test(x)), "nueve opciones; las cinco fiduciarias son el fideicomiso y los cuatro certificados");
  for (const tipo of INSTRUMENTOS_FORMATO) {
    const fid = INSTRUMENTOS_FIDUCIARIOS.includes(tipo);
    const vals = llenarFormato({ ...base, perfil: perfil(tipo) });
    const noAplica = [...FILAS_FIDEICOMISO].filter((f) => vals.get(f)?.texto === "No aplica");
    const fiduciario = vals.get(14)?.texto;
    ok(fid ? noAplica.length === 0 && fiduciario === "Banco Fiduciario Demo" && vals.get(20)?.texto === "F/0000" : noAplica.length === FILAS_FIDEICOMISO.size, `${tipo.replace(/\s+/g, " ")} → ${fid ? "sección «Para: Fideicomisos» llena (K14 fiduciario, K20 número)" : "sección «Para: Fideicomisos» «No aplica»"}`);
  }
  ok(esInstrumentoFiduciario("Certificados Bursátiles Fiduciarios de Inversión en Energia e Infraestructura (FIBRAE)") && esInstrumentoFiduciario("certificados bursátiles fiduciarios de desarrollo (ckd)"), "sin distinguir espacios ni mayúsculas (FIBRAE con un espacio, CKD en minúsculas)");
  ok(esInstrumentoFiduciario("Fideicomiso") && !esInstrumentoFiduciario("") && !esInstrumentoFiduciario(null), "texto libre anterior «Fideicomiso» → sigue siendo fideicomiso; vacío → no");
  // El guion del alta corre sin TypeScript y lleva su copia de la lista: debe ser la misma.
  const alta = fs.readFileSync(new URL("./alta/alta-cliente-real.mjs", import.meta.url), "utf8").match(/const INSTRUMENTOS = (\[[^\]]*\]);/);
  ok(!!alta && JSON.stringify(JSON.parse(alta[1])) === JSON.stringify([...INSTRUMENTOS_FORMATO]), "el guion del alta lleva la misma lista que INSTRUMENTOS_FORMATO");
  ok(!/no reconoce un CKD/.test(fs.readFileSync(new URL("./alta/alta-cliente-real.mjs", import.meta.url), "utf8")), "el guion del alta ya no avisa del CKD");
}

console.log("\n4. Forma de referencia");
{
  ok(formaDeReferencia(null) === "la Compañía" && formaDeReferencia("  ") === "la Compañía" && formaDeReferencia("la Emisora") === "la Emisora", "sin forma en el Perfil → «la Compañía»");
  const fijos = [ORACION_E5, ORACION_E4, ALCANCE_E5, textoNoAplicaHeredado("NIIF S2 36 (c)"), textoNoAplicaHeredado("NIIF S2 36 (e)"), textoNoAplicaHeredado("NIIF S2 99")];
  ok(fijos.every((t) => enForma(t, FORMA_POR_DEFECTO) === t), "con el default, los textos fijos no cambian ni un carácter");
  ok(enForma(ORACION_E5, "la Emisora") === ORACION_E5.replace("la Compañía", "la Emisora") && enForma(textoNoAplicaHeredado("NIIF S2 36 (e)"), "la Emisora") === "No aplica. La Emisora no prevé usar créditos de carbono para alcanzar sus objetivos de emisiones.", "con «la Emisora»: «la Compañía» → «la Emisora», y «La Compañía» al abrir oración → «La Emisora»");
  ok(fijos.every((t) => !formasAjenas(enForma(t, "la Emisora"), { forma: "la Emisora" }).length), "los textos fijos en «la Emisora» pasan el validador de voz");

  // El Formato: «No aplica por actividad» y la oración del E5 en la forma de la emisora.
  const base = { ejercicio: 2025, primerAnio: true, alivios: { E5: true }, hayLogo: false, respuestas: [], gei: [], registros: [], objetivos: [], cuestionarios: {}, modoDeclaracion: "con_reserva", declaracion: RESERVA, cumplimiento: { parciales: [], pendientes: 0 } };
  const perfil = (forma) => ({ denominacion_formal: DEN, forma_de_referencia: forma, clave_cotizacion: null, tipo_instrumento: "Acciones", fiduciario: null, numero_fideicomiso: null, hechos_posteriores: null, actividades_financieras: ["Banca comercial"], sector_sasb: [], metricas_industria: null });
  const emisora = llenarFormato({ ...base, perfil: perfil("la Emisora") });
  const defecto = llenarFormato({ ...base, perfil: perfil(null) });
  ok(/^No aplica por actividad: la Emisora no participa en gestión de activos/.test(emisora.get(454)?.texto ?? "") && /^No aplica por actividad: la Compañía no participa/.test(defecto.get(454)?.texto ?? ""), "fila 454, «No aplica por actividad», con la forma del Perfil (y «la Compañía» sin ella)");
  ok((emisora.get(285)?.texto ?? "").startsWith(enForma(ORACION_E5, "la Emisora")) && (defecto.get(285)?.texto ?? "").startsWith(ORACION_E5), "fila 285: la oración del E5 en la forma del Perfil");
  const todas = [...emisora.values()].map((x) => x.texto ?? "").join("\n");
  ok(!/la Compañía|La Compañía/.test(todas.replace(RESERVA, "")), "Formato con «la Emisora»: ninguna celda de regla dice «la Compañía»");

  // El prompt: con el default, la capa estable no cambia; con «la Emisora», el ejemplo de estilo tampoco dice «la Compañía».
  const b27 = BLOQUES.find((b) => b.numero === 27) ?? BLOQUES[0];
  const capa = (forma, modo) => capaEstable(b27, { denominacionFormal: DEN, nombreCorto: "Empresa Demo", formaDeReferencia: forma }, [], null, modo).map((x) => x.texto).join("\n");
  ok(capa(null, "datos") === capa("la Compañía", "datos") && capa(null, "hechos") === capa("la Compañía", "hechos"), "prompt: sin forma en el Perfil = «la Compañía» (antes «la Emisora» en el prompt y «la Entidad» en las plantillas)");
  ok(!/la Compañía|La Compañía/.test(capa("la Emisora", "datos")) && /Forma de referencia, exacta: «la Emisora»/.test(capa("la Emisora", "datos")), "prompt con «la Emisora»: reglas y ejemplo de estilo sin «la Compañía»");
  ok(PROMPT_VERSION === "calidad-v4-2026-11-10" && PROMPT_VERSION_HECHOS === "hechos-v12-2026-11-10", `versión de prompt anotada (${PROMPT_VERSION}, ${PROMPT_VERSION_HECHOS})`);

  // Validador de voz (decisión 4): la forma del Perfil, la denominación y el nombre corto; ninguna otra genérica.
  const voz = { forma: "la Emisora", denominacionFormal: "O'Donnell Capital, S.A.P.I. de C.V.", nombreCorto: "O'Donnell" };
  ok(!formasAjenas("La Emisora mide sus emisiones de Alcance 2. O'Donnell no mide aún su Alcance 1.", voz).length, "admite la forma del Perfil y la denominación corta");
  ok(JSON.stringify(formasAjenas("La Compañía mide sus emisiones. La Sociedad y la Entidad también; del Emisor nada.", voz)) === JSON.stringify(["la Compañía", "la Sociedad", "la Entidad", "el Emisor"]), "rechaza «la Compañía», «la Sociedad», «la Entidad» y «el Emisor» si el Perfil dice «la Emisora»");
  ok(!formasAjenas("La información se refiere a la misma entidad que informa; las actividades declaradas por la emisora.", { forma: "la Compañía" }).length, "sustantivos comunes en minúscula («la entidad que informa», «la emisora») no cuentan");
  ok(!formasAjenas("Compañía Minera Demo, S.A.B. de C.V. presenta su informe; la Compañía Minera Demo …", { forma: "la Emisora", denominacionFormal: "Compañía Minera Demo, S.A.B. de C.V.", nombreCorto: "la Compañía Minera Demo" }).length, "la denominación y el nombre corto que contienen «Compañía» no son formas ajenas");
  ok(JSON.stringify(formasAjenas("La Emisora revela.", { forma: "la Compañía" })) === JSON.stringify(["la Emisora"]), "con el default «la Compañía», «la Emisora» es ajena");
  const H = [{ id: "u1", local: "h1", tipo: "otro", enunciado: "Alcance 2 medido.", extracto: "Alcance 2", valor: null, unidad: null }];
  const c = (vz) => ({ codigo: "NIIF S2 29 (a)(i)", textoBloque: "La Emisora mide su Alcance 2.", hechos: H, citados: ["h1"], voz: vz });
  ok(validarRespuesta("La Compañía mide su Alcance 2.", "taxonomia", c(voz)).some((e) => /forma de referencia es «la Emisora»/.test(e)), "respuestas: «la Compañía» con Perfil «la Emisora» → rechazo con reintento");
  ok(!validarRespuesta("La Emisora mide su Alcance 2.", "taxonomia", c(voz)).length && !validarRespuesta("O'Donnell mide su Alcance 2.", "taxonomia", c(voz)).length, "respuestas: la forma del Perfil o el nombre corto → sin errores");
  ok(!validarRespuesta("La Compañía mide su Alcance 2.", "taxonomia", c(undefined)).length, "respuestas sin voz (default) → «la Compañía» válida, como antes");
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
