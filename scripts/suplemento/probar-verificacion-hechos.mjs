#!/usr/bin/env node
// =============================================================================
// PRUEBA DEL VERIFICADOR DEL LIBRO DE HECHOS (encargo suplemento-calidad, Paso 5).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/suplemento/probar-verificacion-hechos.mjs
//
// Sin base de datos ni modelo: casos fijos contra la división en oraciones y
// verificarClasificado (libro estable, Paso 5b). El extracto de un hecho es la
// oración que partió el código: un hecho entra solo si su oración es una de las
// entregadas, su cifra está en ella y su dueño existe.
// =============================================================================
import { verificarClasificado, sinRepetidos } from "../../lib/suplemento/hechos/verificar.ts";
import { dividir } from "../../lib/suplemento/hechos/oraciones.ts";
import { validarCobertura } from "../../lib/suplemento/hechos/bloque.ts";
import { separarAnclas } from "../../lib/suplemento/hechos/anclas.ts";
import { cambiosNegados, incisosInexactos } from "../../lib/suplemento/hechos/validadores.ts";
import { remisionesSinDueno } from "../../lib/suplemento/hechos/remisiones.ts";
import { noAplicaHeredado } from "../../lib/suplemento/catalogo-incisos.ts";

let fallas = 0;
const check = (ok, nombre, detalle = "") => {
  if (!ok) fallas++;
  console.log(`${ok ? "  ✓" : "  ✗"} ${nombre}${detalle ? `: ${detalle}` : ""}`);
};

// --- División determinista --------------------------------------------------
const pdf = [
  "El Comité sesionará de manera ordinaria cada trimestre e informará al Consejo de Administración dos",
  "veces al año. Se propuso una capacitación de 16 horas para el Consejo y el Comité de",
  "Dirección.",
  "El Comité tendrá las funciones siguientes: (a) evaluar los riesgos climáticos; (b) proponer metas",
  "al Consejo; y (c) supervisar su avance.",
].join("\n");
const ors = dividir("adj:acta:p1", pdf, { pdf: true });
check(ors.length === 5, "un PDF se parte en oraciones e incisos", `${ors.length} (${ors.map((o) => o.texto.slice(0, 25)).join(" | ")})`);
check(ors[0].texto.includes("dos veces al año"), "las líneas cortadas por el ancho de página se unen");
check(JSON.stringify(dividir("adj:acta:p1", pdf, { pdf: true })) === JSON.stringify(ors), "dos divisiones del mismo texto son idénticas");
check(ors.every((o, i) => o.id === `adj:acta:p1#${i + 1}`), "los ids son <fuente>#n");

// --- verificarClasificado ---------------------------------------------------
const unidad = { id: "adj:acta:p1", rango: "adjunto", fuenteTipo: "adjunto", detalle: "acta.pdf, página 1", texto: pdf, sugeridos: [15] };
const perfil = { id: "perfil:carta_texto", rango: "narrativo", fuenteTipo: "perfil", detalle: "Perfil, Carta de la Dirección", texto: "", sugeridos: [] };
const oraciones = new Map(ors.map((o) => [o.id, { texto: o.texto, unidad }]));
oraciones.set("perfil:carta_texto#1", { texto: "Durante 2025 integramos criterios climáticos en el crédito.", unidad: perfil });
const base = { oracion: "adj:acta:p1#1", enunciado: "El Comité sesiona cada trimestre.", clave: "comite.frecuencia", tipo: "frecuencia", valor: null, unidad: null, periodo: null, bloque_dueno: 16, bloques_referencia: [15], alcance: "clima" };
const CASOS = [
  { nombre: "oración entregada", h: base, espera: true },
  { nombre: "oración que no se entregó", h: { ...base, oracion: "adj:inventado:p9#1" }, espera: false, motivo: /no es una de las entregadas/ },
  { nombre: "cifra que está en la oración", h: { ...base, oracion: "adj:acta:p1#2", tipo: "cifra", valor: 16, unidad: "horas" }, espera: true },
  { nombre: "cifra calculada que no está en la oración", h: { ...base, tipo: "cifra", valor: 4, unidad: "sesiones" }, espera: false, motivo: /cifra 4 no está/ },
  { nombre: "bloque dueño fuera de rango", h: { ...base, bloque_dueno: 41 }, espera: false, motivo: /sin bloque dueño/ },
  { nombre: "sin enunciado", h: { ...base, enunciado: " " }, espera: false, motivo: /sin enunciado/ },
];
for (const c of CASOS) {
  const r = verificarClasificado(c.h, oraciones);
  check((r.estado === "vigente") === c.espera && (!c.motivo || c.motivo.test(r.verificacion)), c.nombre, `${r.estado} (${r.verificacion})`);
}
const v = verificarClasificado(base, oraciones);
check(v.extracto === ors[0].texto, "el extracto es la oración, no lo que copie el modelo");
const n = verificarClasificado({ ...base, oracion: "perfil:carta_texto#1" }, oraciones);
check(n.rango_fuente === "narrativo", "el rango sale de la fuente: la carta es «narrativo»", n.rango_fuente);
check(sinRepetidos([v, { ...v }, { ...v, clave: "otra.clave" }]).length === 2, "los repetidos (misma fuente, clave y extracto) se quitan");

// --- Cobertura por subrequisito (Paso 5.3) -----------------------------------
// Bloque 15: requisitos 6(a), 6(a)(i), 6(a)(ii); el 16 tiene 6(a)(iii)–(v).
const REQ = ["NIIF S2 6 (a)", "NIIF S2 6 (a)(i)", "NIIF S2 6 (a)(ii)"];
const ids = new Set(["h1", "h2", "h3"]);
const fila = (codigo, estado, extra = {}) => ({ codigo, estado, bloque: null, hechos: [], comentario: "", ...extra });
const buena = [fila(REQ[0], "cubierto", { hechos: ["h1"] }), fila(REQ[1], "parcial", { hechos: ["h2"] }), fila(REQ[2], "pendiente")];
const conMarcador = "Texto con [Pendiente: competencias — solicitud X].";
const COB = [
  { nombre: "cobertura completa y válida", c: buena, texto: conMarcador, espera: 0 },
  { nombre: "falta un requisito", c: buena.slice(0, 2), texto: conMarcador, re: /falta el requisito NIIF S2 6 \(a\)\(ii\)/ },
  { nombre: "requisito repetido", c: [...buena, buena[0]], texto: conMarcador, re: /aparece 2 veces/ },
  { nombre: "requisito ajeno al bloque", c: [...buena, fila("NIIF S2 6 (a)(iii)", "cubierto", { hechos: ["h1"] })], texto: conMarcador, re: /no es un requisito de este bloque/ },
  { nombre: "«cubierto» sin hechos", c: [fila(REQ[0], "cubierto"), buena[1], buena[2]], texto: conMarcador, re: /sin hechos que lo sostengan/ },
  { nombre: "hecho que no se entregó", c: [fila(REQ[0], "cubierto", { hechos: ["h9"] }), buena[1], buena[2]], texto: conMarcador, re: /no se entregaron: h9/ },
  { nombre: "«asignado» a un bloque que no responde el requisito", c: [buena[0], buena[1], fila(REQ[2], "asignado", { bloque: 27 })], texto: conMarcador, re: /que no responde ese requisito/ },
  { nombre: "«pendiente» sin marcador en el texto", c: buena, texto: "Texto sin marcadores.", re: /no lleva ningún marcador/ },
];
for (const c of COB) {
  const errs = validarCobertura(c.c, REQ, 15, ids, null, c.texto);
  const paso = c.espera === 0 ? errs.length === 0 : errs.some((e) => c.re.test(e));
  if (!paso) fallas++;
  console.log(`${paso ? "  ✓" : "  ✗"} cobertura · ${c.nombre}: ${errs.length ? errs.join("; ") : "válida"}`);
}

// --- Paso 5b: anclas, cambios negados, incisos, narrativos ------------------
const an = separarAnclas("El Comité se creó en 2025 [h1][h3]. Sesiona cada trimestre [h2].\n\n[Pendiente: competencias — solicitud X]");
check(an.texto === "El Comité se creó en 2025. Sesiona cada trimestre.\n\n[Pendiente: competencias — solicitud X]", "las anclas salen del texto publicable", JSON.stringify(an.texto));
check(an.anclas.length === 2 && an.anclas[0].ids.join() === "h1,h3" && an.anclas[1].oracion === "Sesiona cada trimestre.", "cada oración queda con sus hechos");
const hs27 = [{ id: "h1", enunciado: "Durante 2025 la Compañía integró criterios climáticos en la evaluación de crédito.", extracto: "" }, { id: "h2", enunciado: "La Dirección de Riesgos coordina.", extracto: "" }];
check(cambiosNegados("Los procesos no registraron cambios respecto del periodo anterior.", hs27, 2025).length === 1, "«no registraron cambios» frente a «integró … 2025» se rechaza (caso del bloque 27)");
check(cambiosNegados("El proceso se describe así.", hs27, 2025).length === 0, "sin «sin cambios» en el texto no hay rechazo");
const req27 = ["NIIF S2 25 (a)(i)a(v)", "NIIF S2 25 (a)(vi)", "NIIF S2 25 (b)"];
check(incisosInexactos(["Falta el análisis de escenarios (25(a)(iii))."], req27).join() === "25(a)(iii)", "«25(a)(iii)» no es un código del bloque: se rechaza");
check(incisosInexactos(["Ver 25 (a)(vi), 29(d) y 6(a)(ii)."], req27).length === 0, "los códigos exactos y los de otros párrafos pasan");
check(incisosInexactos(["Las fuentes de financiación (16(c)(i)) quedan pendientes."], ["NIIF S2 16 (c)", "NIIF S2 16 (d)"]).length === 0, "un inciso de un párrafo que el catálogo no agrupa pasa (bloque 10)");
const rangos = new Map([["h1", "narrativo"], ["h2", "perfil"]]);
const narr = validarCobertura([fila(REQ[0], "cubierto", { hechos: ["h1"] }), fila(REQ[1], "cubierto", { hechos: ["h1", "h2"] }), buena[2]], REQ, 15, new Set(["h1", "h2"]), null, conMarcador, rangos);
check(narr.length === 1 && /solo con hechos narrativos/.test(narr[0]), "un requisito cubierto solo con la Carta se rechaza; acompañada, pasa", narr.join("; "));

// --- Remisiones: solo al dueño del hecho, y si lo afirma ----------------------
const TIT = [{ numero: 4, titulo: "Entidad que informa, periodo y conectividad" }, { numero: 12, titulo: "Modelo de negocio y cadena de valor" }, { numero: 16, titulo: "Supervisión de la estrategia, objetivos y remuneración" }, { numero: 33, titulo: "Emisiones financiadas" }, { numero: 36, titulo: "Oportunidades: alineación y capital" }];
const HL = [
  { id: "a", dueno: 12, enunciado: "La cartera de crédito total ascendió a 86,400 millones con su composición por sector económico." },
  { id: "b", dueno: 16, enunciado: "El Consejo aprobó los límites de concentración en sectores intensivos en carbono considerando el riesgo de transición." },
];
const rem = (textos, anclados = new Map([[12, new Set(["a"])]])) => remisionesSinDueno(textos, TIT, new Set(textos.map((t) => t.numero)), HL, anclados, ["Empresa Demo"]);
const t12 = { numero: 12, texto: "La cartera de crédito total asciende a 86,400 millones, con su composición por sector económico." };
check(rem([{ numero: 36, texto: "La cartera de crédito total y su composición se describen en la sección de modelo de negocio y cadena de valor." }, t12]).length === 0, "remitir al dueño que lo afirma vale");
check(rem([{ numero: 36, texto: "La cartera de crédito total y su composición se describen en la sección de entidad que informa, periodo y conectividad." }, t12, { numero: 4, texto: "La entidad que informa es Empresa Demo." }])[0]?.motivo === "otro_dueno", "remitir a quien no es dueño se rechaza y se nombra al dueño");
check(rem([{ numero: 4, texto: "El tratamiento de las emisiones financiadas se describe en la sección de emisiones financiadas." }])[0]?.motivo === "destino_ausente", "remitir a un bloque que no está en el documento se rechaza");
const pend = rem([{ numero: 22, texto: "Las consideraciones del Consejo al aprobar los límites de concentración se describen en la sección de supervisión de la estrategia, objetivos y remuneración." }, { numero: 16, texto: "El Consejo informa. [Pendiente: órgano que aprobó los límites de concentración y sus consideraciones — solicitud X]" }], new Map());
check(pend[0]?.motivo === "remite_a_pendiente", "remitir a un pendiente se rechaza", pend.map((r) => r.motivo).join());
check(rem([{ numero: 1, texto: "El detalle se describe en las secciones correspondientes de este informe." }]).length === 0, "una remisión genérica no se juzga");

// --- «No aplica» heredado (36(c), 36(e)) --------------------------------------
const demo = noAplicaHeredado({ brutoNeto: ["Emisiones brutas de gases de efecto invernadero"], respuestasCreditos: ["No se basa en créditos de carbono."] });
check(demo.get("NIIF S2 36 (c)")?.estado === "no_aplica" && demo.get("NIIF S2 36 (e)(iv)")?.estado === "no_aplica", "sin objetivo neto ni créditos: 36(c) y 36(e) no aplican");
const sinDato = noAplicaHeredado({ brutoNeto: [""], respuestasCreditos: [] });
check(sinDato.get("NIIF S2 36 (c)")?.estado === "pendiente" && sinDato.get("NIIF S2 36 (e)(i)")?.estado === "pendiente", "sin dato: pendiente con la pregunta, nunca «no aplica»");
check(noAplicaHeredado({ brutoNeto: ["Neto"], respuestasCreditos: ["Se basa en créditos en un 20%"] }).size === 0, "con objetivo neto y créditos: se responden");
const REQ40 = ["NIIF S2 36 (a)", "NIIF S2 36 (c)"];
const H40 = new Map([["NIIF S2 36 (c)", "no_aplica"]]);
check(validarCobertura([fila("NIIF S2 36 (a)", "cubierto", { hechos: ["h1"] }), fila("NIIF S2 36 (c)", "no_aplica")], REQ40, 40, new Set(["h1"]), null, "Texto.", undefined, H40).length === 0, "cobertura: «no_aplica» decidido por el código pasa");
check(validarCobertura([fila("NIIF S2 36 (a)", "no_aplica"), fila("NIIF S2 36 (c)", "no_aplica")], REQ40, 40, new Set(["h1"]), null, "Texto.", undefined, H40).some((e) => /solo se usa/.test(e)), "cobertura: «no_aplica» en un inciso que el código no decidió se rechaza");
check(validarCobertura([fila("NIIF S2 36 (a)", "cubierto", { hechos: ["h1"] }), fila("NIIF S2 36 (c)", "cubierto", { hechos: ["h1"] })], REQ40, 40, new Set(["h1"]), null, "Texto.", undefined, H40).some((e) => /lo decidió el código/.test(e)), "cobertura: un inciso decidido «no aplica» no se puede dar por cubierto");

console.log(fallas ? `\n✗ ${fallas} fallas` : "\n✓ Verificador del libro OK");
process.exit(fallas ? 1 : 0);
