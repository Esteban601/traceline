#!/usr/bin/env node
// =============================================================================
// E2E · el cierre automático no deja pendientes fantasma (13 de octubre de 2026,
// autorizado por Esteban). Cuando la remisión por duplicación sustituye una
// oración que llevaba un `[Pendiente: …]`, la entrada sale también de la lista;
// antes se quedaba y bloqueaba la aprobación sin marcador visible (bloque 16 del
// demo).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-cierre-pendientes.mjs
//
// Sin base ni modelo: costo 0. Ejerce remitirDuplicada + pendientesVigentes, que
// son lo que cerrarPendientes encadena antes de escribir el bloque.
// =============================================================================
import { pendientesVigentes, remitirDuplicada } from "../lib/suplemento/hechos/cierre.ts";

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

const M1 = "[Pendiente: órgano que aprueba los límites de concentración en sectores intensivos (Consejo o Comité de Riesgos) — Consideración del clima en la estrategia]";
const M2 = "[Pendiente: órgano que aprueba la estrategia climática, si el Consejo con opinión previa del Comité o el propio Comité — Órgano responsable del clima]";
const DUP = `La aprobación de los límites de concentración sectorial de la cartera corresponde al órgano facultado ${M1}.`;
const ANTES = `El Consejo supervisa el clima. ${DUP} La estrategia la aprueba ${M2}.`;
const PEND = [
  { campo: "bloque", motivo: M1 },
  { campo: "bloque", motivo: M2 },
  { campo: "nota_revision", motivo: "Una nota al revisor." },
];

console.log("\n1. Duplicación que se lleva un marcador");
const despues = remitirDuplicada(ANTES, DUP, "Riesgos climáticos prioritarios");
ok(!despues.includes(M1) && despues.includes("«Riesgos climáticos prioritarios»"), "la oración con el marcador quedó sustituida por la remisión");
const v = pendientesVigentes(PEND, ANTES, despues);
ok(!v.some((p) => p.motivo === M1), "la entrada del marcador que se fue sale de la lista");
ok(v.some((p) => p.motivo === M2), "la del marcador que sigue en el texto se queda");
ok(v.some((p) => p.campo === "nota_revision"), "las notas al revisor no se tocan");
const reales = v.filter((p) => p.campo !== "nota_revision").length;
const enTexto = (despues.match(/\[Pendiente:/g) ?? []).length;
ok(reales === enTexto, `entradas que bloquean = marcadores en el texto (${reales} = ${enTexto})`);

console.log("\n2. Lo que no debe cambiar");
ok(pendientesVigentes(PEND, ANTES, ANTES).length === 3, "sin cambio en el texto → la lista queda igual");
const sinCorchetes = [{ campo: "bloque", motivo: "Pendiente: descripción de cómo el análisis de escenarios fundamenta la identificación de riesgos" }];
ok(pendientesVigentes(sinCorchetes, "Texto sin marcadores.", "Texto sin marcadores.").length === 1, "entrada cuyo marcador nunca estuvo en el texto → se conserva");
ok(pendientesVigentes(PEND, ANTES, ANTES.replace(M2, "el Consejo"), [M2]).every((p) => p.motivo !== M2), "pendiente cerrado por remisión → sale (comportamiento anterior)");
const conAcento = [{ campo: "bloque", motivo: M1.normalize("NFD") }];
ok(pendientesVigentes(conAcento, ANTES, despues).length === 0, "la comparación ignora acentos y espacios (forma NFD)");

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
