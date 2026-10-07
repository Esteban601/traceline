#!/usr/bin/env node
// =============================================================================
// PRUEBA DEL VERIFICADOR DEL LIBRO DE HECHOS (encargo suplemento-calidad, Paso 5).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/suplemento/probar-verificacion-hechos.mjs
//
// Sin base de datos ni modelo: casos fijos contra verificarPropuesto. Un hecho
// entra solo si su extracto está tal cual en su fuente; lo que no cambia el
// contenido (mayúsculas, espacios, saltos de línea, comillas y guiones
// tipográficos, guion de corte de línea) se tolera; lo demás, no.
// =============================================================================
import { verificarPropuesto, sinRepetidos } from "../../lib/suplemento/hechos/verificar.ts";
import { validarCobertura } from "../../lib/suplemento/hechos/bloque.ts";

const fuente = {
  id: "adj:acta:p1",
  rango: "adjunto",
  fuenteTipo: "adjunto",
  detalle: "acta.pdf, página 1",
  texto: "El Comité sesionará de manera ordinaria cada trimestre e informará al Consejo de Administración «dos veces al año».\nSe propuso una capacitación de 16 horas para el Consejo y el Co-\nmité de Dirección.",
  sugeridos: [15],
};
const otra = { ...fuente, id: "perfil:gobierno_texto", rango: "perfil", fuenteTipo: "perfil", detalle: "Perfil", texto: "La Dirección de Riesgos coordina la identificación de riesgos climáticos." };
const fuentes = new Map([[fuente.id, fuente], [otra.id, otra]]);
const base = { fuente: fuente.id, enunciado: "El Comité sesiona cada trimestre.", clave: "comite.frecuencia", tipo: "frecuencia", valor: null, unidad: null, periodo: null, bloque_dueno: 16, bloques_referencia: [15] };

const CASOS = [
  { nombre: "extracto literal", h: { ...base, extracto: "sesionará de manera ordinaria cada trimestre" }, espera: true },
  { nombre: "mayúsculas, espacios y comillas rectas toleradas", h: { ...base, extracto: "INFORMARÁ  AL CONSEJO de Administración \"dos veces al año\"" }, espera: true },
  { nombre: "guion de corte de línea tolerado", h: { ...base, extracto: "el Comité de Dirección", tipo: "otro" }, espera: true },
  { nombre: "una palabra cambiada", h: { ...base, extracto: "sesionará de manera ordinaria cada mes" }, espera: false, motivo: /no está en la fuente/ },
  { nombre: "paráfrasis", h: { ...base, extracto: "se reúne trimestralmente" }, espera: false, motivo: /no está en la fuente/ },
  { nombre: "extracto de otra fuente", h: { ...base, extracto: "La Dirección de Riesgos coordina la identificación" }, espera: false, motivo: /no está en la fuente/ },
  { nombre: "fuente que no se entregó", h: { ...base, fuente: "adj:inventado:p9", extracto: "sesionará de manera ordinaria" }, espera: false, motivo: /no es una de las entregadas/ },
  { nombre: "cifra que está en el extracto", h: { ...base, tipo: "cifra", valor: 16, unidad: "horas", extracto: "una capacitación de 16 horas" }, espera: true },
  { nombre: "cifra calculada que no está en el extracto", h: { ...base, tipo: "cifra", valor: 4, unidad: "sesiones", extracto: "sesionará de manera ordinaria cada trimestre" }, espera: false, motivo: /cifra 4 no está/ },
  { nombre: "bloque dueño fuera de rango", h: { ...base, extracto: "sesionará de manera ordinaria", bloque_dueno: 41 }, espera: false, motivo: /sin bloque dueño/ },
  { nombre: "extracto demasiado corto", h: { ...base, extracto: "Comité" }, espera: false, motivo: /demasiado corto/ },
];

let fallas = 0;
for (const c of CASOS) {
  const r = verificarPropuesto(c.h, fuentes);
  const paso = (r.estado === "vigente") === c.espera && (!c.motivo || c.motivo.test(r.verificacion));
  if (!paso) fallas++;
  console.log(`${paso ? "  ✓" : "  ✗"} ${c.nombre}: ${r.estado} (${r.verificacion})`);
}
const rango = verificarPropuesto({ ...base, fuente: otra.id, extracto: "coordina la identificación de riesgos climáticos" }, fuentes);
const okRango = rango.rango_fuente === "perfil" && rango.fuente_tipo === "perfil";
if (!okRango) fallas++;
console.log(`${okRango ? "  ✓" : "  ✗"} el rango y el tipo salen de la fuente, no del modelo (${rango.rango_fuente})`);
const a = verificarPropuesto({ ...base, extracto: "sesionará de manera ordinaria cada trimestre" }, fuentes);
const okRep = sinRepetidos([a, { ...a }, { ...a, clave: "otra.clave" }]).length === 2;
if (!okRep) fallas++;
console.log(`${okRep ? "  ✓" : "  ✗"} los repetidos (misma fuente, clave y extracto) se quitan`);

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

console.log(fallas ? `\n✗ ${fallas} fallas` : "\n✓ Verificador del libro OK");
process.exit(fallas ? 1 : 0);
