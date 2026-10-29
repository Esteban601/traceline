#!/usr/bin/env node
// =============================================================================
// E2E · Celdas categóricas del Formato electrónico y del Excel de taxonomía del
// demo (encargo formato-afirmaciones-y-voz, Fase 5). Los casos son las celdas
// de §3 de docs/suplemento-s1s2/revision-externa-v5.md (negaciones y
// booleanos), con su veredicto corregido: lo que «cuadra» se queda así y lo que
// «no cuadra» se comprueba ya corregido. Más las celdas de §2 que se corrigieron.
//
//   node --experimental-strip-types --import ./scripts/captura-sugerida/node/registrar.mjs \
//        scripts/e2e-celdas-categoricas.mjs <formato.xlsx> <taxonomia.xlsx>
//
// Sobre los libros que descarga la plataforma para Empresa Demo 2025 (demo v5 de
// dev, aprobado). Sin base ni modelo. Las filas del Formato son las de la hoja
// exportada (la sección de métricas S1 46–50 ya expandida), como las cita la
// revisión; las del Excel se buscan por su código de la columna A.
// =============================================================================
import ExcelJS from "exceljs";
import { ORACION_E5, noRevelado, remisionE5 } from "../lib/suplemento/alivios.ts";
import { vocabularioEnCeldaExportada } from "../lib/suplemento/vocabulario.ts";
import { FILAS_FIDEICOMISO, RAMAS_BOOLEANO } from "../lib/formato/llenar.ts";
import { filaExportada } from "../lib/formato/objetivos.ts";
import { BOOLEANOS_FORMATO } from "../lib/formato/booleanos.ts";
import { remisionAIncisos, seParecen, textoNoAplicaHeredado } from "../lib/suplemento/respuestas.ts";
import { INCISOS_CREDITOS } from "../lib/suplemento/catalogo-incisos.ts";

const [formato, taxonomia] = process.argv.slice(2);
if (!formato || !taxonomia) { console.error("Uso: e2e-celdas-categoricas.mjs <formato.xlsx> <taxonomia.xlsx>"); process.exit(2); }
const fallas = [];
const ok = (c, m) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); if (!c) fallas.push(m); };
const texto = (v) => (v == null ? "" : typeof v === "object" ? (v.richText ? v.richText.map((t) => t.text).join("") : v.text ?? (v.result != null ? String(v.result) : "")) : String(v)).trim();

const wf = new ExcelJS.Workbook();
await wf.xlsx.readFile(formato);
const est = wf.getWorksheet("Estructura Formato Electronico");
// Los casos citan las celdas como el Formato v5.1 (métricas S1 46–50 expandidas, un desplazamiento de 279). Desde la
// Fase 4 de respuesta por inciso la sección de objetivos lleva un bloque por objetivo: la celda vieja se traduce a su
// fila de la plantilla y de ahí a la hoja exportada (las del bloque, en la copia del primer objetivo).
const nObjetivos = (() => { let c = 0; est.eachRow((r) => { if (/^Objetivo \d+: /.test(texto(r.getCell(4).value))) c++; }); return c / 2; })();
const filaNueva = (n) => (n < 475 ? n : filaExportada(n - 279, { objetivos: nObjetivos, deltaMetricas: 279 }));
const K = (n) => texto(est.getCell(`K${filaNueva(n)}`).value);
const rango = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const todas = (filas, pred, msg) => {
  const malas = filas.filter((f) => !pred(K(f)));
  ok(!malas.length, `${msg}${malas.length ? ` — no: ${malas.map((f) => `K${f}=«${K(f).slice(0, 40)}»`).join(", ")}` : ""}`);
};
const es = (v) => (t) => t === v;
const C4 = noRevelado("C4");

console.log("Formato electrónico · identificación y alivios");
ok(/^Alivios de transición aplicados en este ejercicio: /.test(K(12)), `K12: los alivios del reporte («${K(12)}»)`);
todas(rango(13, 21), es("No aplica"), "K13–K21 «Para: Fideicomisos»: «No aplica» (Empresa Demo no es fideicomiso)");
{
  const deLaColumnaA = [];
  est.eachRow((row, n) => { if (/^Para: Fideicomisos/.test(texto(row.getCell(1).value))) deLaColumnaA.push(n); });
  ok(deLaColumnaA.join() === [...FILAS_FIDEICOMISO].join(), `FILAS_FIDEICOMISO = las filas cuya columna A dice «Para: Fideicomisos» (${deLaColumnaA.join(", ")})`);
}

console.log("\nFormato electrónico · booleanos y su vecina (§3)");
todas([38], es("No"), "K38 ¿métricas de desempeño en la remuneración? «No»");
todas([44, 49], es("Sí"), "K44 y K49 «Sí»");
ok(K(126) && !/^(Sí|No)\./.test(K(126)), "K126 (texto): sin «Sí.» inicial");
todas([134], es("Sí"), "K134 ¿cambió los procesos? «Sí»");
ok(!K(135), "K135 «¿Por qué?»: vacía, el booleano de la fila 134 es «Sí»");
ok(K(137) && !/^(Sí|No)\./.test(K(137)), "K137 «¿Cómo lo ha hecho?»: con texto y sin «Sí.» inicial");
todas([148, 172, 197, 221, 246, 270, 294, 319, 343, 369, 393, 418, 442], es("Verdadero"), "¿métrica requerida por una Norma NIIF? «Verdadero» (13)");
todas([161, 185, 210, 234, 259, 283, 307, 332, 356, 382, 406, 431, 455], es("No"), "¿se deriva de ajuste de otra fuente? «No» (13)");
todas([167, 191, 216, 240, 289, 313, 338, 362, 388, 412, 437, 461], es("No"), "¿validada por tercero? «No» (12)");
ok(/^Sí/.test(K(265)), "K265 GEI validada por tercero: «Sí, … Verificadora Demo»");
todas([465, 516, 532, 535, 552, 696, 704], es("No"), "K465, K516, K532, K535, K552, K696, K704 «No»");
todas([478], es("Verdadero"), "K478 ¿objetivo relacionado con el clima? «Verdadero»");
todas([565, 582, 592, 723], es("Sí"), "K565, K582, K592, K723 «Sí»");
ok(!K(699) && !K(707), "K699 y K707 vacías por el «No» de K696 y K704");
todas([643, 666, 689], es("Sí, parcialmente"), "K643, K666, K689 «Sí, parcialmente»");
todas([574, 576, 578], (t) => /^(No se identificaron|No aplica)/.test(t), "K574, K576, K578 errores de periodos anteriores");
todas([861, 863, 866], (t) => /^No aplica/.test(t), "K861, K863, K866 comparativos revisados «No aplica»");

// Encargo formato-respuesta-por-inciso, Fase 1: contenido falso y 36(e).
console.log("\nFormato electrónico · ramas de los booleanos (regla general)");
{
  const kDe = (f) => (f <= 185 ? f : f + 279);
  const D = (f) => texto(est.getCell(`D${filaNueva(kDe(f))}`).value);
  const ramaDe = (d) => (/^¿Por qué\?|^Explicar el método/.test(d) ? "No" : /^¿\s*(Cómo|De qu[eé])/.test(d) ? "Sí" : null);
  const enPlantilla = {};
  for (const b of BOOLEANOS_FORMATO) for (let f = b.fila + 1; f <= b.fila + 4; f++) { const r = ramaDe(D(f)); if (r) enPlantilla[f] = { booleano: b.fila, rama: r }; }
  ok(JSON.stringify(enPlantilla) === JSON.stringify(Object.fromEntries(Object.entries(RAMAS_BOOLEANO).map(([f, r]) => [f, { booleano: r.booleano, rama: r.rama }]))),
    `RAMAS_BOOLEANO = las ramas de la columna D de la plantilla (${Object.keys(enPlantilla).length}: ${Object.keys(enPlantilla).join(", ")})`);
  const cerradas = Object.entries(RAMAS_BOOLEANO).filter(([, r]) => K(kDe(r.booleano)) !== r.rama).map(([f]) => kDe(Number(f)));
  todas(cerradas, (t) => !t, `ramas cerradas por su booleano, vacías (${cerradas.map((k) => `K${k}`).join(", ")})`);
  ok(!K(41) && !K(50), "K41 (rama «Sí» con K38 «No») y K50 (rama «No» con K49 «Sí»): vacías");
  ok(/remuneración variable/.test(K(39)) && !/aprobó los objetivos/.test(K(39)), "K39 «¿Por qué?» (K38 «No»): la razón, sin el texto de los objetivos");
}

console.log("\nFormato electrónico · Gobernanza, NIIF S2 6 (Fase 3)");
{
  const oraciones = (t) => t.replace(ORACION_E5, "").split(/(?<=\.)\s+/).map((o) => o.trim()).filter((o) => o.length > 20);
  ok(/exención del párrafo E5/.test(K(25)) && !!K(25).replace(ORACION_E5, "").trim() && !K(26), "K25 con la respuesta de 6(a); K26 (detalle sin tipo de la misma fila) vacía");
  ok(!/remuneraci/i.test(K(36)) && /objetivos/.test(K(36)), "K36: la supervisión de los objetivos, sin la remuneración (va en K38/K39)");
  const celdas = [25, 28, 30, 32, 34, 36, 39, 43, 47, 52];
  const choques = [];
  for (const a of celdas) for (const b of celdas) if (a < b) for (const o of oraciones(K(a))) for (const q of oraciones(K(b))) if (o === q || seParecen(o, q)) choques.push(`K${a}/K${b}`);
  ok(!choques.length, `ninguna celda de Gobernanza (K25–K52) repite o parafrasea una oración de otra${choques.length ? ` — no: ${[...new Set(choques)].join(", ")}` : ""}`);
  todas([63, 125, 129], (t) => !t, "K63, K125 y K129 (filas de ejemplo sin tipo): vacías");
}

console.log("\nFormato electrónico · objetivos por inciso y por objetivo (Fase 4)");
{
  const etiquetas = [];
  est.eachRow((r, n) => { const d = texto(r.getCell(4).value); if (/^Objetivo \d+: /.test(d)) etiquetas.push({ n, d }); });
  const s1 = etiquetas.slice(0, nObjetivos), s2 = etiquetas.slice(nObjetivos);
  ok(nObjetivos === 3 && s1.every((e, i) => e.d === s2[i].d && e.d.startsWith(`Objetivo ${i + 1}: `)), `un bloque «Objetivo N» de NIIF S1 51 y uno de NIIF S2 33–36 por objetivo (${s2.map((e) => e.d).join(" · ")})`);
  const enBloque = (b, filaPlantilla, desde) => texto(est.getCell(`K${b.n + filaPlantilla - desde}`).value);
  const incisos = { 221: "33(a)", 225: "33(c)", 227: "33(d)", 229: "33(e)", 231: "33(f)", 233: "33(g)", 235: "33(h)", 237: "34(a)", 239: "34(b)", 241: "34(c)", 243: "34(d)" };
  const vacios = s2.flatMap((b, i) => Object.entries(incisos).filter(([f]) => !enBloque(b, Number(f), 216)).map(([, x]) => `objetivo ${i + 1} ${x}`));
  ok(!vacios.length, `NIIF S2 33(a), (c)–(h) y 34(a)–(d) con respuesta propia en cada objetivo${vacios.length ? ` — vacíos: ${vacios.join(", ")}` : ""}`);
  const repetidos = s2.filter((b) => { const v = Object.keys(incisos).map((f) => enBloque(b, Number(f), 216)).filter((t) => t.length > 12); return new Set(v).size !== v.length; });
  ok(!repetidos.length && !s2.some((b) => Object.keys(incisos).some((f) => /tiene tres objetivos/.test(enBloque(b, Number(f), 216)))), "ningún inciso repite el texto de otro ni el párrafo de NIIF S2 33 (antes los 11 incisos decían lo mismo)");
  ok(s2.every((b) => !!enBloque(b, 223, 216)) && new Set(s2.map((b) => enBloque(b, 223, 216))).size === s2.length, "NIIF S2 33(b) (propósito del objetivo): el campo capturado, propio de cada objetivo");
  const metas = s2.map((b) => enBloque(b, 217, 216));
  ok(metas.every((t) => /\(meta: .*\d+ ?%.*\)$/.test(t)), `«Nombre o descripción del objetivo» (fila 217) con el valor de la meta en cada bloque (${metas.map((t) => t.match(/\(meta: ([^)]*)\)/)?.[1]).join(" · ")})`);
  const gei = s2.map((b) => !!enBloque(b, 247, 216));
  ok(gei.filter(Boolean).length === 1 && s2.every((b, i) => gei[i] || [247, 249, 251, 253, 255, 256, 259].every((f) => !enBloque(b, f, 216))), "NIIF S2 36 solo en el bloque del objetivo de emisiones de GEI; vacío en los demás");
  ok(s1.every((b) => [202, 204, 206, 208, 210, 212, 214].every((f) => /se revela conforme a NIIF S2 3[345]/.test(enBloque(b, f, 196)))), "NIIF S1 51 (a)–(g) bajo E5: cada inciso remite a su inciso de NIIF S2 en cada objetivo");
}

console.log("\nFormato electrónico · NIIF S2 29(a)(iii) por inciso (Fase 5)");
{
  const [enfoque, datos, razon, cambios] = [K(596), K(597), K(599), K(601)];
  ok(/Protocolo GEI/.test(enfoque) && !/488,000/.test(enfoque) && /488,000/.test(datos) && !/Protocolo GEI/.test(datos), "K596 el enfoque (protocolo, consolidación, factores) y K597 los datos de entrada y supuestos, sin repetirse");
  ok(!razon, "K599 (razón de la elección): vacía, ningún hecho la da (§5: en el Formato el pendiente es la celda vacía)");
  ok(!cambios || !/Protocolo GEI, con enfoque de control/.test(cambios), "K601 (cambios en el enfoque): del cuestionario de GEI o vacía, nunca el párrafo");
}

console.log("\nFormato electrónico · cierre (Fase 6, revisión externa v5.2)");
{
  const ors = (t) => t.split(/(?<=\.)\s+/).filter((o) => o.length > 20);
  // (1) K100: la razón de 19(a)/(b) de la declaración de criterio; la transparencia como complemento.
  ok(/identificables por separado/.test(K(100)) && /incertidumbre/.test(K(100)) && /próximos periodos/.test(K(100)) && !/^[^.]*próximos periodos/.test(K(100)), "(1) K100: la razón de NIIF S2 19(a)/(b) primero; la limitación de los próximos periodos, como oración complementaria");
  // (2) K91: sin la oración de K92 ni la razón de no cuantificar.
  ok(!ors(K(91)).some((o) => ors(K(92)).some((q) => q === o || seParecen(o, q))) && !/no (proporciona información cuantitativa|cuantific)|identificables por separado/.test(K(91)), `(2) K91 sin la oración de K92 ni la razón de no cuantificar${K(91) ? "" : " (vacía: ninguna síntesis pasó el validador)"}`);
  // (3) K712 vacía: repetía K710.
  ok(!K(568) && !!K(566), "(3) K712 vacía; K710 conserva los juicios (celdas de v5.1, traducidas por K)");
  // (4) K755: solo instrumentos contractuales y método.
  ok(/instrumentos? contractual|certificad|energ[ií]a renovable/i.test(K(611)) && !/CFE bajo contratos est[aá]ndar/.test(K(611)) && K(611) !== K(609), "(4) K755 solo con instrumentos contractuales y el método, distinto de K753");
  // (5) K836 vacía; K845 y K853 en una línea.
  ok(!K(692) && K(701) === "No existe un precio por tonelada en 2025." && K(709) === "Cero por ciento.", "(5) K836 vacía; K845 «No existe un precio por tonelada en 2025.»; K853 «Cero por ciento.»");
  // (6) K786, K809, K832 con el valor de su fila de opciones.
  ok([[642, 643], [665, 666], [688, 689]].every(([p, o]) => !!K(o) && K(p) === K(o)), "(6) K786, K809 y K832 con el mismo valor que su fila de opciones (como K161/K162)");
  // (7) K847 con el patrón de K839: el texto de su código.
  ok(!!K(703) && !!K(695), "(7) K847 (sección «Remuneración») con texto, como K839 (sección «Precios internos del carbono»)");
}

console.log("\nFormato electrónico · NIIF S2 29(e) despliegue de capital por tipo");
{
  const [tr, fi, op] = [K(629), K(652), K(675)];
  ok(!/31\.4/.test(tr + fi + op), "K629, K652 y K675 sin el total de 31.4 millones (va en K693)");
  ok(/12\.3/.test(fi) && /f[ií]sic/.test(fi) && !/31\.0/.test(fi), "K652 (riesgos físicos): los 12.3 millones de adecuaciones, sin la eficiencia energética");
  ok(!op || (/oportunidad/.test(op) && !/12\.3/.test(op)), "K675 (oportunidades): lo que el libro sustenta, sin los 12.3 de riesgos físicos");
  ok(!tr || (/transici/.test(tr) && !/12\.3/.test(tr)), "K629 (transición): vacía o solo lo suyo (el libro del demo no sustenta ninguno)");
  ok(new Set([tr, fi, op].filter(Boolean)).size === [tr, fi, op].filter(Boolean).length, "ninguna de las tres repite a otra");
  ok(/31\.4/.test(K(693)), "K693: el total de 31.4 millones");
  // Ajustes de Esteban a la Fase 1: capitalizado sí, gasto no; la celda dice solo el despliegue de su tipo.
  const gasto = /prima|gasto de operaci|registrad[oa]s? como gasto|no se incluy/i;
  ok(!gasto.test(fi) && !gasto.test(op), "K652 y K675 sin importes registrados como gasto ni aclaraciones de lo que no se incluye");
  ok(/31\.0/.test(op) && !/0\.4/.test(op), "K675: solo los 31.0 millones de eficiencia energética (sin los 0.4 de medición, que fueron gasto)");
}

console.log("\nFormato electrónico · NIIF S2 16(a) por efecto (Fase 2)");
{
  const oraciones = (t) => t.replace(ORACION_E5, "").split(/(?<=\.)\s+/).map((o) => o.trim()).filter(Boolean);
  ok(!!K(85) && !!K(87) && !!K(89), "K85 (situación), K87 (rendimiento) y K89 (flujos) con respuesta propia");
  todas([86, 88, 90], (t) => !t, "K86, K88 y K90 (instrucción de la pregunta de arriba): vacías");
  ok(/12\.3/.test(K(85)) && /31\.0/.test(K(85)) && !/6\.2/.test(K(85)), "K85: lo capitalizado (12.3 y 31.0), sin las primas");
  ok(/6\.2/.test(K(87)) && !/12\.3/.test(K(87)), "K87: lo registrado como gasto (primas de 6.2), sin lo capitalizado");
  const celdas = [84, 85, 87, 89];
  const choques = [];
  for (const a of celdas) for (const b of celdas) if (a < b) for (const o of oraciones(K(a))) for (const q of oraciones(K(b))) if (o === q || seParecen(o, q)) choques.push(`K${a}/K${b}`);
  ok(!choques.length, `ninguna celda de 16(a) (K84, K85, K87, K89) repite o parafrasea una oración de otra${choques.length ? ` — no: ${[...new Set(choques)].join(", ")}` : ""}`);
  // Ajustes de Esteban a la Fase 2.
  const sinTipo = [86, 88, 90].filter((f) => !texto(est.getCell(`F${f}`).value));
  todas(sinTipo, (t) => !t, `filas de instrucción sin tipo en la plantilla (columna F), vacías (${sinTipo.map((f) => `K${f}`).join(", ")})`);
  ok(/^Los importes del periodo relacionados con /.test(K(89)) && /no identificó otros efectos en sus flujos de efectivo/.test(K(89)), "K89: «Los importes del periodo relacionados con … fueron …; la Compañía no identificó otros efectos en sus flujos de efectivo»");
  ok(!/(?<!\p{L})(salidas?|pagos?|desembols\p{L}*)(?!\p{L})/iu.test(K(89)), "K89 sin «salida», «pago» ni «desembolso» (ningún hecho del demo los dice)");
}

console.log("\nFormato electrónico · NIIF S2 16(d) por efecto y por plazo (Fase 2, ajuste 3)");
{
  const oraciones = (t) => t.split(/(?<=\.)\s+|\n/).map((o) => o.replace(/^(Corto|Mediano|Largo) plazo:\s*/, "").trim()).filter(Boolean);
  // Regla de plazos (antes de la Fase 4): la fila de la pregunta lleva lo no fechado; la tabla, lo fechado por plazo.
  ok(!!K(96) && /no proporciona información cuantitativa/.test(K(96)), "K96: lo no fechado (escenario de altas emisiones) y la razón de no cuantificar (NIIF S2 21)");
  ok(!K(98), "K98 vacía: 16(d) no tiene hechos de flujos sin fecha; los flujos previstos van por plazo en K99");
  ok(/^Mediano plazo: .*9 millones/.test(K(99)) && !/9 millones/.test(K(96)), "el ahorro de 9 millones anuales desde 2027, en el mediano plazo de K99 (2027 cae en «más de 1 y hasta 5 años»)");
  for (const f of [95, 97, 99, 111]) {
    const lineas = K(f).split("\n").filter(Boolean);
    const cuerpos = lineas.map((l) => l.replace(/^\S+ plazo: /, ""));
    const parecidas = cuerpos.some((a, i) => cuerpos.some((b, j) => i < j && (a === b || seParecen(a, b))));
    ok(lineas.every((l) => /^(Corto|Mediano|Largo) plazo: /.test(l)) && !parecidas && !cuerpos.some((x) => /^(en|durante|para) el (corto|mediano|largo) plazo/i.test(x)), `K${f}: una línea por plazo con hechos que caen en él, sin repetir texto entre plazos (${lineas.map((l) => l.split(":")[0]).join(", ") || "vacía"})`);
  }
  ok(/^Corto plazo: .*61 millones/m.test(K(95)) && /^Mediano plazo: /m.test(K(95)) && /^Largo plazo: .*reservas adicionales/m.test(K(95)), "K95: corto (plan 2026-2027), mediano (hasta 2028) y largo plazo (reservas adicionales: el efecto previsto de K662 que nombra la situación financiera, opción A)");
  const celdas = [94, 95, 96, 97, 98, 99, 110, 111];
  const choques = [];
  for (const a of celdas) for (const b of celdas) if (a < b) for (const o of oraciones(K(a))) for (const q of oraciones(K(b))) if (o === q || seParecen(o, q)) choques.push(`K${a}/K${b}`);
  ok(!choques.length, `ninguna celda de 16(c), 16(d) y 22(a)(iii) (K94–K99, K110, K111) repite o parafrasea una oración de otra${choques.length ? ` — no: ${[...new Set(choques)].join(", ")}` : ""}`);
}

console.log("\nFormato electrónico · NIIF S2 36(e) en un solo estado");
{
  const NA = textoNoAplicaHeredado("NIIF S2 36 (e)");
  ok(!!K(538) && K(534) === remisionAIncisos(INCISOS_CREDITOS), "K534 (padre): remite a (i)–(iv), porque (i) responde (K538)");
  ok(K(535) === "No", "K535 ¿uso previsto de créditos? «No»");
  ok(!!K(536) && !/^No aplica/.test(K(536)), "K536 «¿Por qué?»: la razón, sin «No aplica» delante");
  ok(K(536) !== K(538) && !K(536).split(/(?<=\.)\s+/).some((o) => K(538).split(/(?<=\.)\s+/).some((q) => q === o || seParecen(o, q))), "K536 (K576 con bloques) no repite ni parafrasea la respuesta de 36(e)(i)");
  todas([540, 542, 544, 546], es(NA), "K540, K542, K544, K546: una sola redacción de «No aplica»");
}

console.log("\nFormato electrónico · actividad y alivios en celda");
todas([613, 614, 615, 616, 617, 621], es(C4), "Alcance 3 (K613–K617, K621) «No revelado · alivio C4», K615 incluida");
todas([618, 619, 747], es("Banca comercial"), "K618, K619, K747 «Banca comercial»");
todas([725, 726], (t) => /FN-CB/.test(t), "K725, K726 sector FN-CB");
todas(rango(711, 720).filter((f) => K(f)), es(C4), "29A–29C (K711–K720) «No revelado · alivio C4»");
todas(rango(733, 741).filter((f) => K(f)), (t) => t.startsWith("No aplica por actividad"), "gestión de activos (K733–K741) «No aplica por actividad»");
todas(rango(748, 762).filter((f) => K(f)), es(C4), "banca comercial, cifras (K748–K762) «No revelado · alivio C4»");
todas(rango(767, 782).filter((f) => K(f)), (t) => t.startsWith("No aplica por actividad"), "seguros (K767–K782) «No aplica por actividad»");

console.log("\nFormato electrónico · celdas corregidas de §2");
ok(/de transición/.test(K(640)) && !/riesgos climáticos que/.test(K(640)), "K640 nombra «de transición»");
ok(K(631) === K(623) && K(654) === K(646) && K(677) === K(669) && !!K(631), "K631, K654, K677: el texto de concentración (K623, K646, K669)");
ok(/488,000/.test(K(606)) && !/488000/.test(K(606)), "K606 «488,000» con separador");
ok(!K(787) && !K(788), "K787 y K788 vacías (sin nota interna de SASB)");

console.log("\nFormato electrónico · todas las hojas");
{
  const conVoc = [];
  for (const ws of wf.worksheets) ws.eachRow((row) => row.eachCell((c) => {
    if (c.isMerged && c.master !== c) return;
    const t = texto(c.value);
    if (t.length >= 3 && vocabularioEnCeldaExportada(t).length) conVoc.push(`${ws.name}!${c.address}`);
  }));
  ok(!wf.getWorksheet("Leyenda"), "sin hoja «Leyenda»");
  ok(!conVoc.length, `sin vocabulario de plataforma en ninguna hoja${conVoc.length ? ` — ${conVoc.join(", ")}` : ""}`);
}

const wt = new ExcelJS.Workbook();
await wt.xlsx.readFile(taxonomia);
const tax = wt.getWorksheet("Taxonomía NIIF S1 S2");
const porCodigo = new Map();
tax.eachRow((row) => {
  const cod = texto(row.getCell(1).value).replace(/\s+/g, " ");
  if (cod) porCodigo.set(cod, [...(porCodigo.get(cod) ?? []), texto(row.getCell(3).value)]);
});
const C = (codigo) => (porCodigo.get(codigo) ?? [""])[0];

console.log("\nExcel de taxonomía · respuestas categóricas (§3)");
ok(C("NIIF S1 30(a)y(b)") === remisionE5("NIIF S2 10(a), (b)y(c)"), "S1 30(a)y(b) (fila 20): remite a NIIF S2 10(a)–(c), no «No aplica»");
ok(C("NIIF S1 33(c)") === remisionE5("NIIF S2 6 (a)(iv)"), "S1 33(c) (fila 27): remite a NIIF S2 6(a)(iv), no «No aplica» (revisión externa v5.1)");
ok(C("NIIF S1 40(a)") === remisionE5("NIIF S2 21(a)"), "S1 40(a) (fila 38): remite a NIIF S2 21(a)");
ok(C("NIIF S1 46 a 50") === remisionE5("NIIF S2 29"), "S1 46–50 (fila 55): remite a NIIF S2 29, como su hoja llena");
ok(["NIIF S1 35(a)", "NIIF S1 35(b)", "NIIF S1 35(c)", "NIIF S1 35(d)"].filter((c) => porCodigo.has(c)).every((c) => /se revela conforme a NIIF S2 16/.test(C(c)) || !C(c)), "S1 35(a)–(d): remisión a S2 16 (las vacías van al encargo formato-respuesta-por-inciso)");
ok(!!C("NIIF S2 6(b)(ii)"), "S2 6(b)(ii) (fila 77): con respuesta");
for (const c of ["NIIF S2 25 (a)(ii)", "NIIF S2 25 (a)(vi)"]) ok(!!C(c) && !/^No aplica/.test(C(c)), `${c}: con respuesta`);
for (const c of ["NIIF S2 29 (a)(vi)(1)", "NIIF S2 29 (a)(vi)(1) EI12", "NIIF S2 29 (a)(vi)(2)", "NIIF S2 EI19 a EI24"]) ok(C(c) === C4, `${c}: «No revelado · alivio C4», como el Formato`);
ok(/^No aplica/.test(C("NIIF S2 36 (c)")), "S2 36(c): «No aplica» (ningún objetivo neto)");
const hoja36e = wt.getWorksheet("NIIF S2 36(e)(i)-(iv)");
ok(C("NIIF S2 36 (e)(i)") === texto(hoja36e.getCell("B2").value) && !/^No aplica/.test(C("NIIF S2 36 (e)(i)")), "S2 36(e)(i) (fila 276): la respuesta de su hoja del cuestionario");
for (const c of ["NIIF S2 36 (e)(iii)", "NIIF S2 36 (e)(iv)"]) ok(/^No aplica/.test(C(c)), `${c}: «No aplica» (sin créditos de carbono)`);
ok(C("NIIF S2 36 (e)(i)a(iv)") === remisionAIncisos(INCISOS_CREDITOS), "S2 36(e) padre (fila 272): remite a (i)–(iv), como K534");
ok(["NIIF S2 36 (e)(ii)", "NIIF S2 36 (e)(iii)", "NIIF S2 36 (e)(iv)"].every((c) => C(c) === textoNoAplicaHeredado("NIIF S2 36 (e)")), "S2 36(e)(ii)–(iv): una sola redacción de «No aplica», como el Formato");
// Fase 2: filas de continuación de 16 (Excel 31, 32, 37, 98, 99, 104).
{
  const [a30, a31, a32] = porCodigo.get("NIIF S1 35(a)") ?? [];
  const [d36, d37] = porCodigo.get("NIIF S1 35(d)") ?? [];
  ok(!!a30 && a31 === a30 && a32 === a30 && !!d36 && d37 === d36, "Excel 31, 32 y 37 (NIIF S1 35 bajo E5): la remisión de su fila madre");
  const [s97, s98, s99] = porCodigo.get("NIIF S2 16(a)") ?? [];
  ok(!!s97 && s98 === K(87) && s99 === K(89), "Excel 98 y 99 (16(a) rendimiento y flujos): las respuestas propias de K87 y K89");
  const d = porCodigo.get("NIIF S2 16(d)") ?? [];
  ok(d.length === 2 && d[1] === K(99) && d[1] !== d[0], "Excel 104 (16(d) flujos previstos a corto, medio y largo plazo): la tabla por plazo de K99, distinta de la 103, sin fila intermedia");
  ok(s97 === K(85) && d[0] === K(96), "Excel 97 y 103: solo su parte (K85 y K96), sin repetir lo que dan las filas siguientes");
  // Fase 5.
  const g = porCodigo.get("NIIF S2 29 (a)(iii)") ?? [];
  ok(g[0] === K(596) && g[1] === K(597) && (g[2] === K(599) || /^Pendiente: razón/.test(g[2])) && (g[3] === K(601) || /^Pendiente: respuesta de la emisora/.test(g[3])) && g.slice(4).every((t) => !t), "Excel 130–133 (29(a)(iii)): enfoque, datos, razón y cambios (o el marcador de §5); la copia 134–137 de la plantilla, vacía");
  const tipos = ["NIIF S2 29 (b)", "NIIF S2 29 (c)", "NIIF S2 29 (d)"].map((c) => (porCodigo.get(c) ?? [])[1] ?? "");
  ok(tipos[0] === K(629) && tipos[1] === K(652) && tipos[2] === K(675), "Excel 153, 162 y 171 (29(e) por tipo): las mismas celdas que K629, K652 y K675");
  const sectores = [];
  wt.getWorksheet("Taxonomía NIIF S1 S2").eachRow((row) => { if (texto(row.getCell(1).value) === "NIIF S2 32" && /^▫/.test(texto(row.getCell(2).value))) sectores.push([texto(row.getCell(2).value), texto(row.getCell(3).value)]); });
  const si = sectores.filter(([, r]) => r === "Sí");
  ok(sectores.length === 70 && si.length === 1 && /\[815200\]/.test(si[0][0]) && sectores.every(([, r]) => !r || r === "Sí"), `lista de sectores de NIIF S2 32 (70 opciones): «Sí» solo en el sector del Perfil (${si.map(([o]) => o.slice(2, 40)).join(", ")})`);
  // (8) Excel 185 y 190 con la respuesta del Formato.
  const f29 = (c) => porCodigo.get(c) ?? [];
  ok(f29("NIIF S2 29 (f) (i) y (ii)")[3] === K(701) && f29("NIIF S2 29 (g) (i) y (ii)")[3] === K(709), "(8) Excel 185 y 190: lo mismo que K845 y K853");
  // (9) Hoja «NIIF S2 34» con «No», no «Falso».
  const s34 = wt.getWorksheet("NIIF S2 34");
  ok([2, 3, 4].every((f) => texto(s34.getCell(`B${f}`).value) === "No"), "(9) hoja «NIIF S2 34»: validación por tercero «No», como la hoja 36(a)-(d)");
  // (10) Marcador de la fila 132 sin jerga de plataforma.
  ok(!/bloque|hecho del|plataforma/i.test(f29("NIIF S2 29 (a)(iii)")[2] ?? "") , "(10) marcador de la fila 132 sin jerga de plataforma (nombra la solicitud)");
  const s33 = wt.getWorksheet("NIIF S2 33");
  // (11) 33(g) solo con la enumeración de la plantilla; 33(h) dice cómo influyó el Acuerdo de París.
  ok([2, 3, 4].every((f) => ["Cuantitativo", "Absoluto", "De intensidad"].includes(texto(s33.getCell(`I${f}`).value)) || /^Pendiente: tipo de objetivo/.test(texto(s33.getCell(`I${f}`).value))), "(11) 33(g): solo Cuantitativo, Absoluto o De intensidad (o el marcador de §5)");
  ok([2, 3, 4].every((f) => /Acuerdo de Par[ií]s/.test(texto(s33.getCell(`J${f}`).value))), "(11) 33(h): los tres objetivos dicen cómo influyó, o que no influyó, el Acuerdo de París");
  ok([2, 3, 4].every((f) => /\(meta: .*\d+ ?%.*\)$/.test(texto(s33.getCell(`A${f}`).value))), "hoja «NIIF S2 33», columna A: el nombre con el valor de la meta, como la fila 217 del Formato");
  ok([2, 3, 4].every((f) => !!texto(s33.getCell(`D${f}`).value) && !/^\d+% (al|en) \d{4}$/.test(texto(s33.getCell(`D${f}`).value))), "hoja «NIIF S2 33», columna «Objetivo de la meta» (33(b)): el propósito de cada objetivo (o el marcador de §5), no la meta");
}
// Fase 3: NIIF S1 bajo E5 y booleanos de NIIF S2 con sus ramas, como el Formato.
{
  const C_ = (c) => porCodigo.get(c) ?? [];
  const e5 = ["NIIF S1 27(a)", "NIIF S1 27(a)(v)", "NIIF S1 27(b)(i)", "NIIF S1 44 (a)(vi)"];
  ok(e5.every((c) => C_(c).length > 1 && C_(c).every((t) => t === C_(c)[0] && /se revela conforme a NIIF S2/.test(t))), "NIIF S1 27(a), 27(a)(v), 27(b)(i) y 44(a)(vi) bajo E5: todas sus filas con la remisión de la fila madre");
  const como = { "NIIF S2 6 (a)(v)": [K(36), K(38), K(39), K(41)], "NIIF S2 6(b)(i)": [K(44), K(45), K(47)], "NIIF S2 6(b)(ii)": [K(49), K(50), K(52)], "NIIF S2 25 (a)(vi)": [K(134), K(135), K(137)], "NIIF S2 29 (f) (i) y (ii)": [K(696), K(697), K(699)], "NIIF S2 29 (g) (i) y (ii)": [K(704), K(705), K(707)], "NIIF S2 36 (e)(i)a(iv)": [C("NIIF S2 36 (e)(i)a(iv)"), K(535), K(536), ""] };
  const malos = Object.entries(como).filter(([c, esperado]) => esperado.some((t, i) => (C_(c)[i] ?? "") !== t)).map(([c]) => c);
  ok(!malos.length, `booleanos de NIIF S2 y sus ramas en el Excel, iguales al Formato (rama cerrada, vacía)${malos.length ? ` — no: ${malos.join(", ")}` : ""}`);
}

console.log("\nExcel de taxonomía · hojas de datos");
{
  const h = wt.getWorksheet("NIIF S2 36(a)-(d)");
  const filas = [];
  h.eachRow((row, n) => { if (n > 1 && texto(row.getCell(1).value)) filas.push(n); });
  ok(filas.length === 1 && /Reducción de emisiones de Alcances 1 y 2/.test(texto(h.getCell(`A${filas[0]}`).value)), `36(a)–(d): solo el objetivo de emisiones GEI (${filas.map((n) => texto(h.getCell(`A${n}`).value)).join(" | ")})`);
  let crudos = 0;
  h.eachRow((row) => row.eachCell((c) => { if (/^(Verdadero|Falso)$/.test(texto(c.value))) crudos++; }));
  ok(crudos === 0 && filas.length === 1 && texto(h.getCell(`E${filas[0]}`).value) === "No", "36(a)–(d): «No» en el enfoque sectorial, sin «Verdadero»/«Falso» crudos");
  const g = wt.getWorksheet("NIIF S2 29(a)(vi)(1)");
  let c3 = 0, cat = 0;
  g.eachRow((row) => { if (/^Categoría \d/.test(texto(row.getCell(1).value))) { cat++; if (texto(row.getCell(3).value) === noRevelado("C3")) c3++; } });
  ok(cat === 15 && c3 === 15, `29(a)(vi)(1): la columna del año anterior «No revelado · alivio C3» (${c3}/${cat})`);
}
{
  let corchete = 0, voc = 0;
  for (const ws of wt.worksheets) ws.eachRow((row, n) => row.eachCell((c) => {
    const t = texto(c.value);
    if (t.startsWith("[")) corchete++;
    if (n > 1 && t.length >= 3 && vocabularioEnCeldaExportada(t).length) voc++;
  }));
  ok(corchete === 0, "ninguna celda del Excel empieza con «[»");
  ok(voc === 0, `sin vocabulario de plataforma en el Excel (${voc})`);
}

console.log(fallas.length ? `\n✗ ${fallas.length} fallas` : "\n✓ todo en orden");
process.exit(fallas.length ? 1 : 0);
