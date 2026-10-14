#!/usr/bin/env node
// =============================================================================
// E2E · instancias de métricas NIIF S1 46–50 (tercera lectura del Formato
// electrónico, puntos 1, 2 y 3; decisiones de Esteban del 14 de octubre de 2026).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-metricas-instancias.mjs
//
// Sin base ni modelo: costo 0. El punto 6 (misma fuente en el Excel de
// taxonomía y el Formato) lo prueba scripts/e2e-formato-electronico.mjs.
// =============================================================================
import { clausulaDeVerificacion, instanciasDeMetricas, metricasDe, METRICAS_S2_29 } from "../lib/formato/instancias.ts";
import { bloquesIterados } from "../lib/formato/llenar.ts";

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

const REG = [
  { id: "h", tipo: "riesgo_fisico", nombre: "Huracanes en la red del sureste", descripcion: "31 sucursales en zonas de ciclones.", metricas_asociadas: null },
  { id: "s", tipo: "riesgo_fisico", nombre: "Estrés hídrico en la cartera agropecuaria", descripcion: "12% de la cartera es agropecuaria.", metricas_asociadas: null },
  { id: "p", tipo: "riesgo_transicion", nombre: "Precio al carbono en sectores intensivos", descripcion: "18% de la cartera empresarial.", metricas_asociadas: ["a", "b", "e"] },
  { id: "x", tipo: "riesgo_transicion", nombre: "Expectativas de inversionistas y taxonomía sostenible", descripcion: "Exigen alineación con la taxonomía sostenible.", metricas_asociadas: ["d", "e"] },
  { id: "f", tipo: "oportunidad", nombre: "Financiamiento sostenible a pymes", descripcion: "Cartera con etiqueta verde y fondeo sostenible.", metricas_asociadas: null },
  { id: "o", tipo: "oportunidad", nombre: "Eficiencia operativa de la red", descripcion: "Iluminación LED en sucursales.", metricas_asociadas: null },
];
const VAL = {
  h: { cantidad_activos: 32, porcentaje: 26, capital_gasto: 12.3, capital_financiacion: null, capital_inversion: null, notas: "32 de 121 instalaciones." },
  s: { cantidad_activos: 10370, porcentaje: 12, capital_gasto: null, capital_financiacion: 640, capital_inversion: null, notas: "Cartera agropecuaria 10,370 MDP." },
  p: { cantidad_activos: 8090, porcentaje: 9.4, capital_gasto: null, capital_financiacion: null, capital_inversion: null, notas: "Cartera expuesta 8,090 MDP." },
  x: { cantidad_activos: 14200, porcentaje: 16.4, capital_gasto: null, capital_financiacion: null, capital_inversion: null, notas: "Deuda de mercado 14,200 MDP." },
  f: { cantidad_activos: 6910, porcentaje: 8, capital_gasto: null, capital_financiacion: 2000, capital_inversion: null, notas: "Cartera sostenible 6,910 MDP." },
  o: { cantidad_activos: 40, porcentaje: 34, capital_gasto: null, capital_financiacion: null, capital_inversion: 31, notas: "40 de 118 sucursales." },
};
const ENUNCIADO = "El método, los factores de emisión y los datos de entrada no cambiaron respecto del periodo anterior: la Compañía mide conforme al Protocolo GEI desde 2022, con inventario verificado por Verificadora Demo, S.C., con aseguramiento limitado.";
const insumos = (extra = {}) => ({
  registros: REG,
  valorDe: (id) => VAL[id] ?? null,
  ejercicio: 2025,
  gei: ["Alcance 1: 1,240 tCO2e", "Alcance 2: 3,860 tCO2e"],
  metodoGei: "Las emisiones se calculan conforme al Protocolo GEI.",
  verificacionGei: clausulaDeVerificacion(ENUNCIADO),
  hayDocumentoAprobado: true,
  descripciones: {},
  ...extra,
});
const inst = instanciasDeMetricas(insumos());
const de = (riesgo) => inst.riesgos.concat(inst.oportunidades).filter((m) => m.riesgo === riesgo);

console.log("\n1. Cada instancia lleva solo los datos de su riesgo");
const hur = de(REG[0].nombre).find((m) => m.clave === "c");
ok(hur.metodo.includes("Huracanes") && hur.metodo.includes("32") && !hur.metodo.includes("Estrés hídrico") && !hur.metodo.includes("10,370"), "29(c) de Huracanes: sus cifras y notas, ninguna de Estrés hídrico");
const est = de(REG[1].nombre).find((m) => m.clave === "c");
ok(est.metodo.includes("10,370") && !est.metodo.includes("Huracanes"), "29(c) de Estrés hídrico: las suyas, ninguna de Huracanes");
const capH = de(REG[0].nombre).find((m) => m.clave === "e");
ok(capH.metodo.includes("gasto de capital 12.3") && !capH.metodo.includes("640"), "29(e) de Huracanes: su gasto de capital, no la financiación de otro riesgo");
ok(de(REG[2].nombre).find((m) => m.clave === "e").metodo.endsWith("Sin despliegue de capital asignado en 2025."), "29(e) de un riesgo con captura del ejercicio sin capital: «Sin despliegue de capital asignado en 2025» (declaración negativa)");
const sinCaptura = instanciasDeMetricas(insumos({ valorDe: (id) => (id === "p" ? null : VAL[id] ?? null) }));
ok(sinCaptura.riesgos.find((m) => m.riesgo === REG[2].nombre && m.clave === "e").metodo === "", "sin captura del ejercicio: vacía (pendiente de datos), nunca «sin despliegue»");
const geiP = de(REG[2].nombre).find((m) => m.clave === "a");
ok(geiP.metodo.includes("Protocolo GEI") && geiP.metodo.includes("1,240"), "29(a) GEI: método de medición y emisiones capturadas");

console.log("\n2. Métricas por riesgo: las elegidas o la regla por defecto");
ok(metricasDe(REG[0]).join() === "c,e" && metricasDe(REG[4]).join() === "d,e", "sin elegir: físico → 29(c)/(e); oportunidad → 29(d)/(e)");
ok(metricasDe({ tipo: "riesgo_transicion", metricas_asociadas: null }).join() === "b,e", "sin elegir: transición → 29(b)/(e) (sin GEI)");
ok(de(REG[2].nombre).map((m) => m.clave).join() === "a,b,e", "«Precio al carbono»: 29(a)/(b)/(e), como lo eligió el consultor");
const exp = de(REG[3].nombre);
ok(exp.map((m) => m.clave).join() === "d,e" && !exp.some((m) => m.clave === "a"), "«Expectativas de inversionistas»: 29(d)/(e), sin GEI");
ok(exp[0].metodo.includes("Financiamiento sostenible") && !exp[0].metodo.includes("Eficiencia operativa"), "su 29(d) toma la oportunidad que comparte tema (cartera sostenible), no la de eficiencia de la red");
ok(!inst.riesgos.some((m) => m.clave === "a" && m.riesgo !== REG[2].nombre), "GEI solo donde el riesgo lo pide");
ok(METRICAS_S2_29.e.nombre === "Despliegue de capital (CAPEX, financiación, inversión) hacia riesgos y oportunidades climáticos", "nombre de 29(e) con CAPEX, financiación e inversión");

console.log("\n3. Verificación externa");
ok(clausulaDeVerificacion(ENUNCIADO) === "inventario verificado por Verificadora Demo, S.C., con aseguramiento limitado.", "la cláusula de verificación, sin «no cambiaron respecto del periodo anterior»");
ok(geiP.verificacion === "Sí, inventario verificado por Verificadora Demo, S.C., con aseguramiento limitado.", "29(a) GEI: «Sí», con verificador y nivel");
ok(inst.riesgos.concat(inst.oportunidades).filter((m) => m.clave !== "a").every((m) => m.verificacion === "No"), "toda otra métrica: «No»");
const sinDoc = instanciasDeMetricas(insumos({ hayDocumentoAprobado: false, verificacionGei: null }));
ok(sinDoc.riesgos.concat(sinDoc.oportunidades).every((m) => m.verificacion === ""), "sin documento aprobado: vacía (no se sabe), nunca «No»");
const bloques = bloquesIterados(new Map([[148, { texto: "Verdadero", origen: "regla" }]]), inst);
const b1 = bloques.riesgos.find((r) => r.nombre === REG[2].nombre).metricas[0].valores;
ok(b1.get(167)?.startsWith("Sí, inventario verificado") && !b1.get(167).includes("no cambiaron") && b1.get(148) === "Verdadero", "el bloque iterado de la GEI lleva la verificación en la 167, no el método");

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
