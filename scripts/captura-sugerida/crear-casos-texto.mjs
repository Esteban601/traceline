#!/usr/bin/env node
// =============================================================================
// CASOS DE TEXTO del Paso 3 de la captura sugerida (se suman al conjunto).
//
//   node scripts/captura-sugerida/crear-casos-texto.mjs
//
// Aparte de crear-conjunto.mjs para no rehacer los 24 archivos ya probados
// (sus bytes cambiarían con cada corrida). Hace dos cosas, idempotentes:
//   1. Genera t01–t03 en conjunto/ y los agrega (o reemplaza) en manifiesto.json:
//      · t01 · política en PDF ESCANEADO;
//      · t02 · Word con el requisito DISPERSO en tres párrafos no contiguos;
//      · t03 · documento que NO cubre el requisito y la sugerencia debe decirlo.
//   2. Pone `solicitud.codigos` a los casos de texto (p03, w01, w03, t01–t03):
//      códigos de `datapoints_taxonomia` copiados verbatim del catálogo (el
//      espaciado es irregular; CLAUDE.md §4). La prueba los liga a la solicitud
//      y aborta si alguno no existe en el catálogo.
// Empresa ficticia, la misma del conjunto. Sin datos reales.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(AQUI, "conjunto");
const ruta = (n) => path.join(DIR, n);
const EMISORA = "Hidroeléctrica Demo del Norte, S.A. de C.V.";

// Mismas utilidades que crear-conjunto.mjs (texto → PNG por SVG; PDF de imágenes; docx).
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function svgDeLineas(lineas, { ancho = 1240, alto = 1754, tam = 30, x = 90, y0 = 140, salto = 52 } = {}) {
  const t = lineas.map((l, i) => {
    const s = typeof l === "string" ? { texto: l } : l;
    return `<text x="${x}" y="${y0 + i * salto}" font-family="Arial" font-size="${s.tam ?? tam}" font-weight="${s.negrita ? "bold" : "normal"}" fill="#111">${esc(s.texto)}</text>`;
  }).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><rect width="100%" height="100%" fill="#ffffff"/>${t}</svg>`);
}
function ruido(ancho, alto, semilla = 19) {
  let s = semilla;
  const buf = Buffer.alloc(ancho * alto * 4);
  for (let i = 0; i < ancho * alto; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const v = 110 + (s % 90);
    buf[i * 4] = v; buf[i * 4 + 1] = v; buf[i * 4 + 2] = v; buf[i * 4 + 3] = 30;
  }
  return sharp(buf, { raw: { width: ancho, height: alto, channels: 4 } }).png().toBuffer();
}
async function pdfEscaneado(imagenes) {
  const doc = await PDFDocument.create();
  for (const img of imagenes) {
    const e = await doc.embedPng(img);
    doc.addPage([595, 842]).drawImage(e, { x: 0, y: 0, width: 595, height: 842 });
  }
  return Buffer.from(await doc.save());
}
const docx = (hijos) => Packer.toBuffer(new Document({ sections: [{ children: hijos }] }));
const P = (t, o = {}) => new Paragraph({ children: [new TextRun({ text: t, bold: o.negrita })], heading: o.titulo ? HeadingLevel.HEADING_1 : undefined });

const nuevos = [];

// t01 · política en PDF escaneado, ligeramente girado y con ruido.
{
  const lineas = [
    { texto: "Política de Gestión de Riesgos Climáticos", negrita: true, tam: 36 }, EMISORA, "",
    "Identificación. Cada año la Dirección de Sostenibilidad identifica los riesgos",
    "físicos y de transición de las tres centrales mediante talleres con las áreas",
    "operativas y un análisis de escenarios de 1.5 °C y 3 °C.",
    "",
    "Evaluación y priorización. Los riesgos se califican por probabilidad e impacto",
    "financiero en una matriz de cinco niveles; los de nivel 4 y 5 se consideran",
    "prioritarios y se integran al mapa de riesgos corporativo.",
    "",
    "Supervisión. El Comité de Riesgos revisa cada semestre los riesgos prioritarios",
    "y el avance de sus planes de mitigación.",
  ];
  const base = await sharp(svgDeLineas(lineas)).png().toBuffer();
  const img = await sharp(base).rotate(-1.5, { background: "#f6f6f1" }).resize(1240, 1754, { fit: "fill" })
    .composite([{ input: await ruido(1240, 1754) }]).blur(0.5).png().toBuffer();
  fs.writeFileSync(ruta("t01_politica_riesgos_escaneada.pdf"), await pdfEscaneado([img]));
  nuevos.push({ id: "t01", archivo: "t01_politica_riesgos_escaneada.pdf", tipo: "pdf", naturaleza: "texto", escaneado: true,
    solicitud: { titulo: "Procesos para identificar, evaluar y priorizar los riesgos climáticos", periodo: "2025",
      codigos: ["NIIF S2 25 (a)(i)a(v)"] },
    esperado: { cubre: true, extracto_contiene: ["análisis de escenarios", "probabilidad e impacto"], fuentes: [{ tipo: "pagina", pagina: 1 }] },
    notas: "Política escaneada: el texto sale de la transcripción por visión, y el extracto tiene que ser literal de esa transcripción." });
}

// t02 · Word con el requisito disperso: párrafos 3, 6 y 8, con distractores entre ellos.
// Numeración de la extracción: el título cuenta como párrafo 1.
fs.writeFileSync(ruta("t02_gobierno_disperso.docx"), await docx([
  P("Informe de Gobierno Corporativo 2025", { titulo: true }),                                                         // 1
  P(`${EMISORA} opera tres centrales hidroeléctricas en el norte del país y cotiza en la Bolsa Mexicana de Valores.`), // 2
  P("El Comité de Sostenibilidad del Consejo recibe un informe trimestral de la Dirección de Sostenibilidad sobre los riesgos y oportunidades relacionados con el clima."), // 3
  P("En materia de seguridad industrial, la tasa de incidentes con tiempo perdido bajó por tercer año consecutivo."),   // 4
  P("La Asamblea de Accionistas aprobó el pago de un dividendo ordinario en mayo de 2025."),                          // 5
  P("Al aprobar el plan de inversiones anual, el Consejo revisa los escenarios climáticos y su efecto en la disponibilidad de agua para generación."), // 6
  P("El Comité de Auditoría se reunió seis veces y revisó los estados financieros trimestrales."),                     // 7
  P("La Dirección General informa además al Consejo en pleno dos veces al año sobre el avance de los objetivos de reducción de emisiones."), // 8
]));
nuevos.push({ id: "t02", archivo: "t02_gobierno_disperso.docx", tipo: "word", naturaleza: "texto", feo: "requisito disperso en tres párrafos no contiguos",
  solicitud: { titulo: "Cómo y con qué frecuencia se informa al Consejo sobre los riesgos climáticos y cómo los considera en la estrategia", periodo: "2025",
    codigos: ["NIIF S2 6 (a)(iii)", "NIIF S2 6 (a)(iv)"] },
  esperado: { cubre: true, extracto_contiene: ["informe trimestral", "escenarios climáticos", "dos veces al año"],
    fuentes: [{ tipo: "parrafo", parrafo: 3 }, { tipo: "parrafo", parrafo: 6 }, { tipo: "parrafo", parrafo: 8 }], minimo_fuentes: 2 },
  notas: "Los párrafos 2, 4, 5 y 7 son distractores. Un extracto de un solo párrafo se queda corto." });

// t03 · documento que no cubre el requisito (código de ética; habla de «riesgos» de corrupción, no climáticos).
fs.writeFileSync(ruta("t03_codigo_etica.docx"), await docx([
  P("Código de Ética y Conducta", { titulo: true }),
  P("Este código aplica a consejeros, directivos y colaboradores de la empresa y de sus subsidiarias."),
  P("Está prohibido ofrecer o aceptar sobornos, regalos o atenciones que puedan influir en una decisión de negocio."),
  P("Los conflictos de interés se declaran por escrito al Comité de Ética, que evalúa el riesgo de corrupción de cada caso."),
  P("Las denuncias se reciben en una línea anónima y se investigan con confidencialidad."),
]));
nuevos.push({ id: "t03", archivo: "t03_codigo_etica.docx", tipo: "word", naturaleza: "texto", feo: "no cubre el requisito; trampa: «riesgo de corrupción»",
  solicitud: { titulo: "Procesos para identificar, evaluar y priorizar los riesgos climáticos", periodo: "2025",
    codigos: ["NIIF S2 25 (a)(i)a(v)"] },
  esperado: { cubre: false },
  notas: "La sugerencia correcta es «no cubre», sin extracto." });

// Códigos de los casos de texto que ya existían.
const CODIGOS = {
  p03: ["NIIF S1 44 (a)(i)a(v)"],
  w01: ["NIIF S2 33"],
  w03: ["NIIF S2 6 (a)", "NIIF S2 6 (a)(i)"],
};

// Expectativas reespecificadas según el requisito de su código (decisión al
// aprobar el Paso 3). Las del Paso 1 comprobaban que el dato estuviera en la
// fuente; las de la sugerencia, que el extracto responda al requisito. Las
// anteriores se conservan en `esperado_paso1`, que es lo que sigue usando la
// prueba de extracción.
const REESPECIFICADOS = {
  p03: {
    esperado: { extracto_contiene: ["Cada dos años se evalúan los riesgos", "Comité de Sostenibilidad del Consejo"], fuente: { tipo: "pagina", pagina: 1 } },
    nota_cambio: "NIIF S1 44 pide los procesos para identificar, evaluar y supervisar riesgos: lo pertinente es la evaluación bienal y el reporte al Comité. «Principios Rectores» y «Debida diligencia» (el marco y un encabezado) eran frases del Paso 1, no respuesta al requisito.",
  },
  w01: {
    esperado: { extracto_contiene: ["30 %", "2030"], fuente: { tipo: "parrafo", parrafo: 3 } },
    nota_cambio: "NIIF S2 33 pide objetivos climáticos: la meta de reducción del 30 % al 2030. «criterios de cuenca» es gestión del agua, fuera del requisito.",
  },
  w03: {
    esperado: { cubre: false },
    nota_cambio: "NIIF S2 6 (a) y (a)(i) piden quién supervisa los riesgos climáticos y cómo se refleja en sus mandatos. El documento solo describe la composición del Consejo y sus sesiones: la respuesta correcta es «no cubre». El catálogo no tiene un código de composición del Consejo.",
  },
};

const archivoManifiesto = path.join(AQUI, "manifiesto.json");
const m = JSON.parse(fs.readFileSync(archivoManifiesto, "utf8"));
for (const c of m.casos) if (CODIGOS[c.id]) c.solicitud.codigos = CODIGOS[c.id];
for (const c of m.casos) {
  const r = REESPECIFICADOS[c.id];
  if (!r) continue;
  c.esperado_paso1 ??= c.esperado; // idempotente: la primera vez guarda la original
  c.esperado = r.esperado;
  c.nota_cambio = r.nota_cambio;
}
for (const n of nuevos) {
  const i = m.casos.findIndex((c) => c.id === n.id);
  if (i >= 0) m.casos[i] = n; else m.casos.push(n);
}
m.generado_por = "scripts/captura-sugerida/crear-conjunto.mjs + crear-casos-texto.mjs";
fs.writeFileSync(archivoManifiesto, JSON.stringify(m, null, 2) + "\n");
console.log(`casos de texto: ${nuevos.map((n) => n.id).join(", ")} generados; códigos en ${Object.keys(CODIGOS).join(", ")} y en los nuevos`);
