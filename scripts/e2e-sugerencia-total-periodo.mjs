#!/usr/bin/env node
// =============================================================================
// E2E · SUG-NUM-3: el total que cubre el periodo es la principal (encargo
// 2026-10-26-carga-lectura-primero, OK de Esteban a la regla de (5)).
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-sugerencia-total-periodo.mjs            # sin modelo, costo 0
//   … scripts/e2e-sugerencia-total-periodo.mjs --modelo      # con ANTHROPIC_API_KEY, ~0.15 USD
//
// Los dos casos, sobre los PDF de la prueba de Esteban en traceline-dev:
//   · p09_total_anual_texto.pdf: PDF con texto, meses y «Consumo total del
//     periodo 49,350 kWh». La principal es 49,350 (2025); los meses van como
//     alternativas, nunca como principal.
//   · p10_escaneado_total_encimado.pdf: escaneado; la línea del total viene
//     encimada y la transcripción la deja [ilegible]. Sin un total legible, la
//     sugerencia es «sin hallazgo» con los meses de referencia; la línea se
//     señala y se relee a más resolución (relectura.ts). Una nota del
//     transcriptor con una lectura a medias («se alcanza a leer 46,350») no
//     puede salir como principal.
//
// Sin modelo se prueba la regla del código (depurar + elegir) con respuestas del
// modelo escritas aquí, y la señal y la sustitución de la línea ilegible. Con
// --modelo, el camino completo sin base: extracción, sugerencia, relectura y
// sugerencia sobre el contenido releído.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extraerContenido } from "../lib/evidencias/extraer.ts";
import { depurar, elegir, sinTotalLegible, sugerirNumerica } from "../lib/evidencias/sugerir.ts";
import { franjasDePagina, lineaSenalada, sustituirLinea } from "../lib/evidencias/relectura.ts";
import { releerLinea } from "../lib/evidencias/vision.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CONJUNTO = path.join(AQUI, "captura-sugerida", "conjunto");
const CON_MODELO = process.argv.includes("--modelo");

const fallas = [];
const ok = (c, m) => { if (!c) fallas.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

const MESES = [["Enero", 3910], ["Febrero", 3760], ["Marzo", 4020], ["Abril", 4180], ["Mayo", 4350], ["Junio", 4290],
  ["Julio", 4410], ["Agosto", 4380], ["Septiembre", 4120], ["Octubre", 3980], ["Noviembre", 3870], ["Diciembre", 4080]];
const fmt = (n) => n.toLocaleString("en-US");
const SOLICITUD = { titulo: "Consumo de electricidad 2025", descripcion: null, unidad_esperada: "kWh", codigos: [], ejercicio: 2025 };

// La transcripción de visión del escaneado, como quedó en dev el 26/10.
const LINEA_ILEGIBLE = "Consumo total del período [ilegible] kWh";
const ESCANEADO = {
  tipo: "pdf", paginas_total: 1,
  paginas: [{ pagina: 1, origen: "vision", texto: [
    "Comercializadora de Energía del Norte, S.A. de C.V.",
    "Periodo facturado: 1 de enero de 2025 al 31 de diciembre de 2025",
    "Resumen de consumo del ejercicio 2025", "", "Mes | kWh",
    ...MESES.map(([m, v]) => `${m} | ${fmt(v)}`), "", LINEA_ILEGIBLE, "",
    "Demanda máxima registrada: 38 kW · Factor de potencia promedio: 0.94",
  ].join("\n") }],
};

const lectura = (valor, periodo, cita, cubre) => ({
  valor, unidad: "kWh", periodo, cita, nota: "", cubre_periodo: cubre, conversion_propuesta: null,
  fuente: { tipo: "pagina", hoja: "", celda: "", pagina: 1, parrafo: 0, tabla: 0, fila: 0, columna: 0 },
});
const mes = ([m, v]) => lectura(v, `${m.toLowerCase()} 2025`, `${m} | ${fmt(v)}`, false);
const respuesta = (campos) => ({ encontrado: true, principal: null, candidatos: [], confianza: "media", motivo: "", linea_ilegible: { pagina: 0, linea: "" }, ...campos });

// -----------------------------------------------------------------------------
console.log("A. Regla del código, sin modelo");
const legible = (await extraerContenido(fs.readFileSync(path.join(CONJUNTO, "p09_total_anual_texto.pdf")), "p09_total_anual_texto.pdf", { tipo: "pdf" })).contenido;
const textoLegible = legible.paginas[0].texto;
const citaTotal = textoLegible.split("\n").find((l) => /Consumo total/.test(l));
ok(legible.tipo === "pdf" && legible.paginas[0].origen === "texto" && /49,350/.test(citaTotal ?? ""), `el PDF con texto se lee sin modelo y trae el total («${citaTotal}»)`);

// A1. El modelo pone la fila de diciembre como principal y el total como candidato.
{
  const r = respuesta({
    principal: lectura(4080, "diciembre 2025", "Diciembre | 4,080", false),
    candidatos: [lectura(49350, "2025", citaTotal, true), ...MESES.slice(0, 3).map(mes)],
    confianza: "alta",
  });
  const d = depurar(legible, r, "kWh");
  const e = elegir(d.verificadas, d.confianza);
  ok(e.principal?.valor === 49350 && e.principal.periodo === "2025", "una fila parcial puesta como principal no lo es: la principal es el total 49,350 (2025)");
  ok(e.alternativas.some((a) => a.valor === 4080 && a.cubre_periodo === false) && e.alternativas.length === 4, "la fila de diciembre y los meses quedan como alternativas, marcadas como parciales");
  ok(e.confianza === "baja", "la principal no la propuso el modelo como tal: confianza baja");
}
// A2. El modelo propone el total como principal y los meses como alternativas (lo esperado de sug-num-3).
{
  const r = respuesta({ principal: lectura(49350, "2025", citaTotal, true), candidatos: MESES.map(mes), confianza: "alta" });
  const d = depurar(legible, r, "kWh");
  const e = elegir(d.verificadas, d.confianza);
  ok(e.principal?.valor === 49350 && e.confianza === "alta" && e.alternativas.length === 12, "total legible: principal 49,350, confianza alta, los 12 meses como alternativas");
}
// A3. Escaneado: sin total legible, solo meses.
{
  const r = respuesta({ encontrado: false, candidatos: MESES.map(mes), confianza: "baja", linea_ilegible: { pagina: 1, linea: LINEA_ILEGIBLE } });
  const d = depurar(ESCANEADO, r, "kWh");
  const e = elegir(d.verificadas, d.confianza);
  ok(e.principal === null && e.alternativas.length === 12, "total ilegible: no hay principal (sin hallazgo) y los 12 meses quedan de referencia");
  const s = lineaSenalada(ESCANEADO, r.linea_ilegible);
  ok(s?.pagina === 1 && s.linea === LINEA_ILEGIBLE, "la línea [ilegible] señalada se encuentra en la transcripción");
  ok(lineaSenalada(ESCANEADO, { pagina: 1, linea: "Consumo total [ilegible]" })?.linea === LINEA_ILEGIBLE, "si la señal no es literal y la página tiene una sola línea [ilegible], es esa");
  ok(lineaSenalada(legible, { pagina: 1, linea: LINEA_ILEGIBLE }) === null, "en una página con texto (no visión) no hay nada que releer");
  const releido = sustituirLinea(ESCANEADO, 1, LINEA_ILEGIBLE, "Consumo total del período 49,350 kWh");
  const d2 = depurar(releido, respuesta({ principal: lectura(49350, "2025", "Consumo total del período 49,350 kWh", true), candidatos: MESES.map(mes) }), "kWh");
  ok(elegir(d2.verificadas, d2.confianza).principal?.valor === 49350, "con la línea releída sustituida, el total se verifica contra el contenido y es la principal");
}

// A4. Una nota del transcriptor bajo la línea ilegible («se alcanza a leer 46,350») no es la principal.
{
  const NOTA = '(el texto se superpone; se alcanza a leer "46,350 kWh" parcialmente)';
  const conNota = { ...ESCANEADO, paginas: [{ ...ESCANEADO.paginas[0], texto: ESCANEADO.paginas[0].texto.replace(LINEA_ILEGIBLE, `${LINEA_ILEGIBLE}\n${NOTA}`) }] };
  const r = respuesta({ principal: lectura(46350, "2025", NOTA, true), candidatos: MESES.map(mes), confianza: "baja", linea_ilegible: { pagina: 1, linea: LINEA_ILEGIBLE } });
  const d = depurar(conNota, r, "kWh");
  const e = elegir(d.verificadas, d.confianza);
  ok(e.principal?.valor === 46350, "(control) la nota pasa la verificación de fuente: el texto está en el contenido");
  const l = sinTotalLegible(e.principal, e.alternativas, lineaSenalada(conNota, r.linea_ilegible));
  ok(l.principal === null && l.alternativas.length === 12 && l.descartadas.some((x) => /46,350/.test(x.cita)), "con la línea de la cifra [ilegible], no hay principal: la lectura a medias se descarta y los meses quedan de referencia");
}

// -----------------------------------------------------------------------------
if (CON_MODELO) {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("✗ --modelo necesita ANTHROPIC_API_KEY."); process.exit(2); }
  let costo = 0;
  const suma = (ll) => { for (const l of ll) costo += l.costoUsd; };

  console.log("B. Con modelo · total legible (p09)");
  const rL = await sugerirNumerica(SOLICITUD, legible, "p09_total_anual_texto.pdf");
  suma(rL.llamadas);
  ok(rL.estado === "sugerida" && rL.principal?.valor === 49350 && /2025/.test(rL.principal.periodo) && rL.principal.cubre_periodo, `la principal es el total 49,350 de 2025 (${rL.estado}, ${rL.principal?.valor}, ${rL.principal?.periodo})`);
  ok(rL.candidatos.length > 0 && rL.candidatos.every((c) => c.valor !== 49350 && !c.cubre_periodo), `los meses van como alternativas parciales (${rL.candidatos.length})`);

  console.log("C. Con modelo · escaneado con el total encimado (p10)");
  const archivo = fs.readFileSync(path.join(CONJUNTO, "p10_escaneado_total_encimado.pdf"));
  const ex = await extraerContenido(archivo, "p10_escaneado_total_encimado.pdf", { tipo: "pdf" });
  costo += ex.costoUsd;
  const rE = await sugerirNumerica(SOLICITUD, ex.contenido, "p10_escaneado_total_encimado.pdf");
  suma(rE.llamadas);
  const transcrito = ex.contenido.paginas[0]?.texto ?? "";
  const totalEnTranscripcion = /Consumo total[^\n]*49,350/.test(transcrito);
  if (totalEnTranscripcion) {
    // La transcripción de esta corrida sí leyó el total: entonces es la principal.
    ok(rE.principal?.valor === 49350, "la transcripción leyó el total: es la principal (no hizo falta releer)");
  } else {
    ok(rE.estado === "sin_hallazgo" && rE.principal === null, `sin total legible no hay principal: sin hallazgo (${rE.estado})`);
    ok(rE.candidatos.length > 0 && rE.candidatos.every((c) => !c.cubre_periodo), `los meses quedan de referencia (${rE.candidatos.length})`);
    const s = lineaSenalada(ex.contenido, rE.ilegible);
    ok(Boolean(s), `la línea del total se señala para releer («${rE.ilegible?.linea ?? ""}»)`);
    if (s) {
      const franjas = await franjasDePagina(archivo, { tipo: "pdf" }, s.pagina);
      ok((franjas?.length ?? 0) >= 2, `la página se arma en franjas a la resolución del archivo (${franjas?.length ?? 0})`);
      const rel = await releerLinea(franjas, s.linea);
      costo += rel.costoUsd;
      console.log(`    relectura: ${rel.linea ? `«${rel.linea}»` : `sigue ilegible (${rel.nota})`}`);
      if (rel.linea) {
        const rR = await sugerirNumerica(SOLICITUD, sustituirLinea(ex.contenido, s.pagina, s.linea, rel.linea), "p10_escaneado_total_encimado.pdf");
        suma(rR.llamadas);
        const leyoTotal = /49,350|49350/.test(rel.linea);
        ok(leyoTotal ? rR.principal?.valor === 49350 : rR.estado === "sin_hallazgo", leyoTotal
          ? "releída la línea, el total 49,350 es la principal"
          : `la relectura no dio 49,350 y la sugerencia sigue sin principal (${rR.estado})`);
      } else {
        ok(true, "la relectura dice que sigue ilegible y no reconstruye la cifra");
      }
    }
  }
  console.log(`  costo de la corrida: ${costo.toFixed(4)} USD`);
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en verde");
process.exit(fallas.length ? 1 : 0);
