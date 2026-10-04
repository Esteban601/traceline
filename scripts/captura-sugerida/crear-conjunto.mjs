#!/usr/bin/env node
// =============================================================================
// CONJUNTO DE PRUEBA de la captura sugerida (encargo 2026-10-04, Paso 1).
//
//   node scripts/captura-sugerida/crear-conjunto.mjs
//
// Genera 24 evidencias con valor conocido y su fuente exacta —8 Excel/CSV,
// 8 PDF (3 escaneados), 4 Word, 4 imágenes— más un control fuera de cuenta (un
// .xls binario, que por decisión se marca «no soportado»). Escribe los archivos
// en scripts/captura-sugerida/conjunto/ y el manifiesto con lo esperado en
// manifiesto.json, que es contra lo que se mide la sugerencia en el Paso 2.
//
// Incluye a propósito los archivos «feos» que pide el encargo §6: hoja sin
// encabezado, números guardados como texto, celdas combinadas, PDF con la tabla
// rota (el orden del texto no es el de lectura), PDF largo que pasa del límite
// de 60 páginas, foto torcida y con ruido, escaneado de dos páginas.
//
// Las emisoras son FICTICIAS (CLAUDE.md §3: los datos de demostración no llevan
// razones sociales reales). Determinista salvo el ruido de la foto, que usa una
// semilla fija. Requiere macOS para el HEIC (sips) y LibreOffice para el .xls
// (soffice); sin ellos, esos dos archivos se omiten y se avisa.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType } from "docx";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(AQUI, "conjunto");
fs.mkdirSync(DIR, { recursive: true });
const ruta = (n) => path.join(DIR, n);
const manifiesto = [];
const avisos = [];

/** Registra el caso esperado. `fuente` es exactamente lo que la sugerencia debe citar. */
function caso(c) { manifiesto.push(c); }

// -----------------------------------------------------------------------------
// Utilidades de imagen: texto → PNG por SVG (sharp/librsvg), sin dependencias.
// -----------------------------------------------------------------------------
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function svgDeLineas(lineas, { ancho = 1240, alto = 1754, tam = 30, x = 90, y0 = 140, salto = 52, fondo = "#ffffff" } = {}) {
  const t = lineas.map((l, i) => {
    const s = typeof l === "string" ? { texto: l } : l;
    return `<text x="${s.x ?? x}" y="${y0 + i * salto}" font-family="Arial" font-size="${s.tam ?? tam}" font-weight="${s.negrita ? "bold" : "normal"}" fill="#111">${esc(s.texto)}</text>`;
  }).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><rect width="100%" height="100%" fill="${fondo}"/>${t}</svg>`);
}
async function png(lineas, opciones) { return sharp(svgDeLineas(lineas, opciones)).png().toBuffer(); }

/** Ruido determinista para la foto «fea». */
function ruido(ancho, alto, semilla = 7) {
  let s = semilla;
  const buf = Buffer.alloc(ancho * alto * 4);
  for (let i = 0; i < ancho * alto; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const v = 110 + (s % 90);
    buf[i * 4] = v; buf[i * 4 + 1] = v; buf[i * 4 + 2] = v; buf[i * 4 + 3] = 38;
  }
  return sharp(buf, { raw: { width: ancho, height: alto, channels: 4 } }).png().toBuffer();
}

// -----------------------------------------------------------------------------
// PDF de texto con pdf-lib (Helvetica WinAnsi: acentos, ñ y ³ caben).
// -----------------------------------------------------------------------------
async function pdfTexto(paginas) {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const lineas of paginas) {
    const p = doc.addPage([595, 842]);
    let y = 780;
    for (const l of lineas) {
      const s = typeof l === "string" ? { texto: l } : l;
      p.drawText(s.texto, { x: s.x ?? 60, y: s.y ?? y, size: s.tam ?? 11, font: s.negrita ? fb : f, color: rgb(0.1, 0.1, 0.1) });
      if (s.y === undefined) y -= s.salto ?? 18;
    }
  }
  return Buffer.from(await doc.save());
}
async function pdfEscaneado(imagenes) {
  const doc = await PDFDocument.create();
  for (const img of imagenes) {
    const e = await doc.embedPng(img);
    const p = doc.addPage([595, 842]);
    p.drawImage(e, { x: 0, y: 0, width: 595, height: 842 });
  }
  return Buffer.from(await doc.save());
}
async function docx(hijos) {
  return Packer.toBuffer(new Document({ sections: [{ children: hijos }] }));
}
const P = (t, o = {}) => new Paragraph({ children: [new TextRun({ text: t, bold: o.negrita })], heading: o.titulo ? HeadingLevel.HEADING_1 : undefined });
function tabla(filas) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: filas.map((f) => new TableRow({ children: f.map((c) => new TableCell({ children: [P(String(c))] })) })),
  });
}

const EMISORA = "Hidroeléctrica Demo del Norte, S.A. de C.V.";

// =============================================================================
// EXCEL / CSV (8)
// =============================================================================
{
  // X1 · Electricidad mensual con total; en otra hoja, energía total en MWh: la
  // ambigüedad del encargo §3 (376,300 kWh de electricidad vs 549.8 MWh de energía).
  const w = new ExcelJS.Workbook();
  const h = w.addWorksheet("Energía");
  h.addRow(["Mes", "Electricidad (kWh)"]);
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const mensual = [30100, 29800, 31500, 32200, 33100, 32900, 31800, 31200, 30900, 31000, 30800, 31000];
  meses.forEach((m, i) => h.addRow([m, mensual[i]]));
  h.addRow(["Total", 376300]);
  const r = w.addWorksheet("Resumen");
  r.addRow(["Indicador", "Valor", "Unidad"]);
  r.addRow(["Energía total consumida", 549.8, "MWh"]);
  r.addRow(["Combustibles", 173.5, "MWh"]);
  await w.xlsx.writeFile(ruta("x01_electricidad_2025.xlsx"));
  caso({ id: "x01", archivo: "x01_electricidad_2025.xlsx", tipo: "excel", naturaleza: "numerica",
    solicitud: { titulo: "Consumo de electricidad 2025", unidad: "kWh", periodo: "2025" },
    esperado: { valor: 376300, unidad: "kWh", fuente: { tipo: "celda", hoja: "Energía", celda: "B14" } },
    notas: "Ambigüedad deliberada: Resumen!B2 trae 549.8 MWh de energía total." });
}
{
  // X2 · GEI con años en columnas: el periodo correcto es 2025 (col C).
  const w = new ExcelJS.Workbook();
  const h = w.addWorksheet("GEI");
  h.addRow(["Alcance", "2024", "2025", "Unidad"]);
  h.addRow(["Alcance 1", 13105.2, 12480.5, "tCO2e"]);
  h.addRow(["Alcance 2 (ubicación)", 9210.4, 8930.2, "tCO2e"]);
  h.addRow(["Alcance 3", 240100, 251400, "tCO2e"]);
  await w.xlsx.writeFile(ruta("x02_emisiones_gei.xlsx"));
  caso({ id: "x02", archivo: "x02_emisiones_gei.xlsx", tipo: "excel", naturaleza: "numerica",
    solicitud: { titulo: "Inventario GEI Alcance 1", unidad: "tCO2e", periodo: "2025" },
    esperado: { valor: 12480.5, unidad: "tCO2e", fuente: { tipo: "celda", hoja: "GEI", celda: "C2" } },
    notas: "Varios años: 2024 en B2 es el candidato que NO va." });
}
{
  // X3 · FEO: hoja sin encabezado; etiquetas sueltas en A, valores en B.
  const w = new ExcelJS.Workbook();
  const h = w.addWorksheet("Hoja1");
  h.addRow(["Pozos activos", 6]);
  h.addRow(["Agua superficial m3", 12450]);
  h.addRow(["Agua extraída total m3", 48210]);
  h.addRow(["Agua descargada m3", 31020]);
  await w.xlsx.writeFile(ruta("x03_agua_sin_encabezado.xlsx"));
  caso({ id: "x03", archivo: "x03_agua_sin_encabezado.xlsx", tipo: "excel", naturaleza: "numerica", feo: "hoja sin encabezado",
    solicitud: { titulo: "Extracción total de agua 2025", unidad: "m3", periodo: "2025" },
    esperado: { valor: 48210, unidad: "m3", fuente: { tipo: "celda", hoja: "Hoja1", celda: "B3" } } });
}
{
  // X4 · FEO: título combinado, unidades en una fila aparte.
  const w = new ExcelJS.Workbook();
  const h = w.addWorksheet("Residuos");
  h.mergeCells("A1:D1");
  h.getCell("A1").value = `Generación de residuos — ${EMISORA}`;
  h.addRow([]);
  h.getRow(2).values = ["Tipo", "2023", "2024", "2025"];
  h.getRow(3).values = ["", "t", "t", "t"];
  h.getRow(4).values = ["No peligrosos", 410.3, 398.1, 402.6];
  h.getRow(5).values = ["Peligrosos", 41.0, 39.4, 37.2];
  await w.xlsx.writeFile(ruta("x04_residuos_combinadas.xlsx"));
  caso({ id: "x04", archivo: "x04_residuos_combinadas.xlsx", tipo: "excel", naturaleza: "numerica", feo: "celdas combinadas y unidad en fila aparte",
    solicitud: { titulo: "Residuos peligrosos generados 2025", unidad: "t", periodo: "2025" },
    esperado: { valor: 37.2, unidad: "t", fuente: { tipo: "celda", hoja: "Residuos", celda: "D5" } } });
}
{
  // X5 · CSV de RH.
  const filas = ["Área,Colaboradores,Horas de capacitación", "Operación,210,8120", "Mantenimiento,95,4310", "Administración,64,3410", "Total,369,15840"];
  fs.writeFileSync(ruta("x05_capacitacion.csv"), filas.join("\n") + "\n");
  caso({ id: "x05", archivo: "x05_capacitacion.csv", tipo: "excel", naturaleza: "numerica",
    solicitud: { titulo: "Horas de capacitación 2025", unidad: "horas", periodo: "2025" },
    esperado: { valor: 15840, unidad: "horas", fuente: { tipo: "celda", hoja: "x05_capacitacion", celda: "C5" } } });
}
{
  // X6 · Tres hojas; el CAPEX sostenible vive en la tercera.
  const w = new ExcelJS.Workbook();
  w.addWorksheet("Portada").addRow([`Inversiones 2025 — ${EMISORA}`]);
  const o = w.addWorksheet("Opex"); o.addRow(["Concepto", "MXN"]); o.addRow(["Mantenimiento", 830000]);
  const i = w.addWorksheet("Inversiones");
  i.addRow(["Proyecto", "Categoría", "Año", "Monto (MXN)"]);
  i.addRow(["Turbina 3", "Eficiencia", 2025, 420000]);
  i.addRow(["Paneles subestación", "Renovable", 2025, 610000]);
  i.addRow(["Planta tratamiento", "Agua", 2025, 220000]);
  i.addRow(["Oficinas", "Otro", 2025, 95000]);
  i.addRow([]);
  i.addRow(["", "", "CAPEX sostenible", 1250000]);
  i.getCell("D7").numFmt = "#,##0";
  await w.xlsx.writeFile(ruta("x06_capex_multihoja.xlsx"));
  caso({ id: "x06", archivo: "x06_capex_multihoja.xlsx", tipo: "excel", naturaleza: "numerica",
    solicitud: { titulo: "CAPEX alineado a objetivos climáticos 2025", unidad: "MXN", periodo: "2025" },
    esperado: { valor: 1250000, unidad: "MXN", fuente: { tipo: "celda", hoja: "Inversiones", celda: "D7" } } });
}
{
  // X7 · FEO: números guardados como TEXTO con separador de miles y unidad pegada.
  const w = new ExcelJS.Workbook();
  const h = w.addWorksheet("Combustibles");
  h.addRow(["Combustible", "Consumo 2025"]);
  h.addRow(["Diésel", "18,900 L"]);
  h.addRow(["Gasolina", "2,340 L"]);
  h.addRow(["Gas LP", "1,105.5 kg"]);
  await w.xlsx.writeFile(ruta("x07_combustibles_texto.xlsx"));
  caso({ id: "x07", archivo: "x07_combustibles_texto.xlsx", tipo: "excel", naturaleza: "numerica", feo: "números como texto",
    solicitud: { titulo: "Consumo de diésel 2025", unidad: "L", periodo: "2025" },
    esperado: { valor: 18900, unidad: "L", fuente: { tipo: "celda", hoja: "Combustibles", celda: "B2" } } });
}
{
  // X8 · Diversidad: porcentaje como fracción con formato de %.
  const w = new ExcelJS.Workbook();
  const h = w.addWorksheet("Plantilla");
  h.addRow(["Indicador", "2025"]);
  h.addRow(["Plantilla total", 369]);
  h.addRow(["Mujeres en plantilla", 0.318]);
  h.addRow(["Mujeres en puestos directivos", 0.27]);
  h.getCell("B3").numFmt = "0.0%"; h.getCell("B4").numFmt = "0.0%";
  await w.xlsx.writeFile(ruta("x08_diversidad_porcentaje.xlsx"));
  caso({ id: "x08", archivo: "x08_diversidad_porcentaje.xlsx", tipo: "excel", naturaleza: "numerica",
    solicitud: { titulo: "Mujeres en plantilla 2025", unidad: "%", periodo: "2025" },
    esperado: { valor: 31.8, unidad: "%", fuente: { tipo: "celda", hoja: "Plantilla", celda: "B3" } },
    notas: "La celda guarda 0.318 con formato 0.0%: la cifra que se reporta es 31.8 %." });
}

// =============================================================================
// PDF (8: 5 de texto, 3 escaneados)
// =============================================================================
{
  const p1 = [{ texto: "Informe de energía 2025", negrita: true, tam: 16, salto: 30 }, EMISORA, "",
    "1. Alcance", "El informe cubre las tres centrales y las oficinas corporativas.", "La energía se mide con medidores de facturación de la CFE."];
  const p2 = [{ texto: "2. Resultados", negrita: true, tam: 13, salto: 24 },
    "Durante 2025 el consumo total de electricidad fue de 376,300 kWh, un 2.1 % menos",
    "que en 2024 (384,400 kWh). La energía total, incluidos combustibles, sumó 549.8 MWh."];
  fs.writeFileSync(ruta("p01_informe_energia.pdf"), await pdfTexto([p1, p2]));
  caso({ id: "p01", archivo: "p01_informe_energia.pdf", tipo: "pdf", naturaleza: "numerica",
    solicitud: { titulo: "Consumo de electricidad 2025", unidad: "kWh", periodo: "2025" },
    esperado: { valor: 376300, unidad: "kWh", fuente: { tipo: "pagina", pagina: 2 } },
    notas: "La misma página trae 2024 y la energía total en MWh." });
}
{
  // P2 · FEO: tabla dibujada fuera de orden y con cifras partidas en dos trazos:
  // el texto extraído no sigue el orden de lectura.
  const cel = [
    { texto: "Mercado", x: 60, y: 640 },
    { texto: "Alcance 2 (tCO2e)", x: 60, y: 700, negrita: true }, { texto: "2025", x: 280, y: 700, negrita: true },
    { texto: "8,93", x: 280, y: 670 }, { texto: "0.2", x: 304, y: 670 }, { texto: "Ubicación", x: 60, y: 670 },
    // La columna Método lleva texto, no la cifra: así la cifra partida «8,93»+«0.2»
    // es la ÚNICA fuente del valor (pdf.js la devuelve como «8,93 0.2»).
    { texto: "7,410.0", x: 280, y: 640 }, { texto: "Método", x: 400, y: 700, negrita: true }, { texto: "GHG Protocol", x: 400, y: 670 },
    { texto: "GHG Protocol", x: 400, y: 640 },
    { texto: "Emisiones indirectas por electricidad", x: 60, y: 760, negrita: true, tam: 14 },
  ];
  fs.writeFileSync(ruta("p02_tabla_rota.pdf"), await pdfTexto([cel]));
  caso({ id: "p02", archivo: "p02_tabla_rota.pdf", tipo: "pdf", naturaleza: "numerica", feo: "tabla rota: orden de trazo distinto al de lectura y cifra partida",
    solicitud: { titulo: "Inventario GEI Alcance 2 (método basado en ubicación)", unidad: "tCO2e", periodo: "2025" },
    esperado: { valor: 8930.2, unidad: "tCO2e", fuente: { tipo: "pagina", pagina: 1 } },
    notas: "La cifra se dibuja en dos trazos y pdf.js la entrega como «8,93 0.2». En el Paso 1 queda así en el texto; reconstruirla es tarea de la sugerencia (Paso 2)." });
}
{
  const p1 = [{ texto: "Política de Derechos Humanos", negrita: true, tam: 16, salto: 30 }, EMISORA, "",
    "La empresa respeta los derechos humanos reconocidos internacionalmente y se compromete",
    "a identificar, prevenir y mitigar los impactos adversos en sus operaciones y en su cadena",
    "de suministro, conforme a los Principios Rectores de la ONU sobre Empresas y Derechos Humanos.",
    "", "Debida diligencia", "Cada dos años se evalúan los riesgos de las tres centrales y de los proveedores",
    "críticos. Los hallazgos se presentan al Comité de Sostenibilidad del Consejo."];
  const p2 = ["Mecanismo de queja", "Existe una línea de denuncia anónima operada por un tercero, disponible para",
    "colaboradores, comunidades y proveedores. La política la aprobó el Consejo el 14 de marzo de 2025."];
  fs.writeFileSync(ruta("p03_politica_ddhh.pdf"), await pdfTexto([p1, p2]));
  caso({ id: "p03", archivo: "p03_politica_ddhh.pdf", tipo: "pdf", naturaleza: "texto",
    solicitud: { titulo: "Política de derechos humanos y debida diligencia", periodo: "2025" },
    // Las frases clave son las de la página que se cita (la 1); la línea de
    // denuncia está en la 2 y la tendría que citar un segundo extracto.
    esperado: { extracto_contiene: ["Principios Rectores", "Debida diligencia", "Comité de Sostenibilidad del Consejo"], fuente: { tipo: "pagina", pagina: 1 } } });
}
{
  const p1 = [{ texto: "Water Management Report 2025", negrita: true, tam: 16, salto: 30 }, "Demo Hydro North (fictional company)", "",
    "Total water withdrawal in 2025: 48,210 m³ (2024: 50,005 m³).", "Surface water accounted for 12,450 m³; the rest came from six wells."];
  fs.writeFileSync(ruta("p04_water_english.pdf"), await pdfTexto([p1]));
  caso({ id: "p04", archivo: "p04_water_english.pdf", tipo: "pdf", naturaleza: "numerica", idioma: "en",
    solicitud: { titulo: "Extracción total de agua 2025", unidad: "m3", periodo: "2025" },
    esperado: { valor: 48210, unidad: "m3", fuente: { tipo: "pagina", pagina: 1 } } });
}
{
  // P5 · FEO: 70 páginas. La cifra está en la 45 (dentro del límite); en la 65
  // hay otra mención que se pierde al cortar en 60, y el corte se avisa.
  const paginas = [];
  for (let n = 1; n <= 70; n++) {
    const base = [{ texto: `Anexo técnico — página ${n}`, negrita: true }, `Registro de mantenimiento de la central ${1 + (n % 3)}.`, "Sin observaciones relevantes para el informe."];
    if (n === 45) base.push("Residuos peligrosos generados en 2025: 37.2 toneladas (manifiestos SEMARNAT).");
    if (n === 65) base.push("Fe de erratas: la cifra de residuos peligrosos se confirma sin cambios.");
    paginas.push(base);
  }
  fs.writeFileSync(ruta("p05_anexo_70_paginas.pdf"), await pdfTexto(paginas));
  caso({ id: "p05", archivo: "p05_anexo_70_paginas.pdf", tipo: "pdf", naturaleza: "numerica", feo: "70 páginas: pasa el límite de 60",
    solicitud: { titulo: "Residuos peligrosos generados 2025", unidad: "t", periodo: "2025" },
    esperado: { valor: 37.2, unidad: "t", fuente: { tipo: "pagina", pagina: 45 }, truncado: true } });
}
{
  const img = await png([{ texto: "FACTURA DE COMBUSTIBLE", negrita: true, tam: 40 }, "Proveedor: Combustibles Demo del Bajío (ficticio)", "Periodo: enero a diciembre de 2025", "",
    "Producto           Litros", "Diésel             18,900", "Gasolina            2,340", "", "Total facturado: $ 512,304.00 MXN"]);
  fs.writeFileSync(ruta("p06_escaneado_factura.pdf"), await pdfEscaneado([img]));
  caso({ id: "p06", archivo: "p06_escaneado_factura.pdf", tipo: "pdf", naturaleza: "numerica", escaneado: true,
    solicitud: { titulo: "Consumo de diésel 2025", unidad: "L", periodo: "2025" },
    esperado: { valor: 18900, unidad: "L", fuente: { tipo: "pagina", pagina: 1 } } });
}
{
  // P7 · FEO: escaneado torcido con ruido.
  const base = await png([{ texto: "Constancia de capacitación 2025", negrita: true, tam: 38 }, EMISORA, "",
    "Horas de capacitación impartidas: 15,840", "Colaboradores capacitados: 369", "Promedio por persona: 42.9 h"]);
  const torcida = await sharp(base).rotate(-3.5, { background: "#f4f4ef" }).resize(1240, 1754, { fit: "fill" }).composite([{ input: await ruido(1240, 1754) }]).blur(0.7).png().toBuffer();
  fs.writeFileSync(ruta("p07_escaneado_torcido.pdf"), await pdfEscaneado([torcida]));
  caso({ id: "p07", archivo: "p07_escaneado_torcido.pdf", tipo: "pdf", naturaleza: "numerica", escaneado: true, feo: "escaneado torcido con ruido",
    solicitud: { titulo: "Horas de capacitación 2025", unidad: "horas", periodo: "2025" },
    esperado: { valor: 15840, unidad: "horas", fuente: { tipo: "pagina", pagina: 1 } } });
}
{
  const a = await png([{ texto: "Manifiestos de residuos — resumen", negrita: true, tam: 36 }, "Hoja 1 de 2", "", "Residuos no peligrosos 2025: 402.6 t"]);
  const b = await png(["Hoja 2 de 2", "", "Residuos peligrosos 2025: 37.2 t", "Transportista autorizado: Residuos Demo (ficticio)"]);
  fs.writeFileSync(ruta("p08_escaneado_dos_paginas.pdf"), await pdfEscaneado([a, b]));
  caso({ id: "p08", archivo: "p08_escaneado_dos_paginas.pdf", tipo: "pdf", naturaleza: "numerica", escaneado: true,
    solicitud: { titulo: "Residuos peligrosos generados 2025", unidad: "t", periodo: "2025" },
    esperado: { valor: 37.2, unidad: "t", fuente: { tipo: "pagina", pagina: 2 } } });
}

// =============================================================================
// WORD (4)
// =============================================================================
fs.writeFileSync(ruta("w01_politica_ambiental.docx"), await docx([
  P("Política Ambiental", { titulo: true }), P(EMISORA),
  P("La empresa se compromete a reducir sus emisiones de gases de efecto invernadero un 30 % al 2030 respecto de 2022, a gestionar el agua con criterios de cuenca y a prevenir la contaminación en sus tres centrales."),
  P("La política se revisa cada año y la aprueba la Dirección General. Su cumplimiento lo supervisa el Comité de Sostenibilidad."),
]));
caso({ id: "w01", archivo: "w01_politica_ambiental.docx", tipo: "word", naturaleza: "texto",
  solicitud: { titulo: "Política ambiental", periodo: "2025" },
  // Las frases clave son las del párrafo que se cita (el 3); el Comité está en el 4.
  esperado: { extracto_contiene: ["30 %", "2030", "criterios de cuenca"], fuente: { tipo: "parrafo", parrafo: 3 } } });

fs.writeFileSync(ruta("w02_tabla_emisiones.docx"), await docx([
  P("Inventario de emisiones 2025", { titulo: true }),
  tabla([["Alcance", "2024 (tCO2e)", "2025 (tCO2e)"], ["Alcance 1", "13,105.2", "12,480.5"], ["Alcance 2", "9,210.4", "8,930.2"], ["Alcance 3", "240,100", "251,400"]]),
]));
caso({ id: "w02", archivo: "w02_tabla_emisiones.docx", tipo: "word", naturaleza: "numerica",
  solicitud: { titulo: "Emisiones GEI Alcance 3 — total", unidad: "tCO2e", periodo: "2025" },
  esperado: { valor: 251400, unidad: "tCO2e", fuente: { tipo: "tabla", tabla: 1, fila: 4, columna: 3 } } });

fs.writeFileSync(ruta("w03_consejo.docx"), await docx([
  P("Composición del Consejo de Administración", { titulo: true }),
  P("Al 31 de diciembre de 2025 el Consejo se integra por 11 consejeros propietarios, de los cuales 4 son independientes y 3 son mujeres."),
  P("El Consejo sesionó en cinco ocasiones durante el ejercicio, con una asistencia promedio del 96 %."),
]));
caso({ id: "w03", archivo: "w03_consejo.docx", tipo: "word", naturaleza: "texto",
  solicitud: { titulo: "Composición y responsabilidades del Consejo", periodo: "2025" },
  esperado: { extracto_contiene: ["11 consejeros", "4 son independientes"], fuente: { tipo: "parrafo", parrafo: 2 } } });

fs.writeFileSync(ruta("w04_sustainable_revenue_en.docx"), await docx([
  P("Sustainable Revenue 2025", { titulo: true }),
  P("Revenue from certified renewable energy contracts represented 22% of total revenue in 2025 (2024: 18%)."),
]));
caso({ id: "w04", archivo: "w04_sustainable_revenue_en.docx", tipo: "word", naturaleza: "numerica", idioma: "en",
  solicitud: { titulo: "Ingresos asociados a productos/servicios sostenibles", unidad: "%", periodo: "2025" },
  esperado: { valor: 22, unidad: "%", fuente: { tipo: "parrafo", parrafo: 2 } } });

// =============================================================================
// IMÁGENES (4)
// =============================================================================
const tablaEnergia = await png([{ texto: "Consumo energético 2025", negrita: true, tam: 34 }, "",
  "Concepto            Valor        Unidad", "Electricidad        376,300      kWh", "Energía total       549.8        MWh"], { alto: 700 });
fs.writeFileSync(ruta("i01_tabla_energia.png"), tablaEnergia);
caso({ id: "i01", archivo: "i01_tabla_energia.png", tipo: "imagen", naturaleza: "numerica",
  solicitud: { titulo: "Consumo de electricidad 2025", unidad: "kWh", periodo: "2025" },
  esperado: { valor: 376300, unidad: "kWh", fuente: { tipo: "imagen" } } });

const fotoBase = await png([{ texto: "Bitácora de pozos 2025", negrita: true, tam: 40 }, "", "Pozo 1   8,010 m3", "Pozo 2   7,220 m3", "Superficial 12,450 m3", "",
  { texto: "TOTAL EXTRAÍDO: 48,210 m3", negrita: true, tam: 36 }], { ancho: 1400, alto: 1000, fondo: "#efe9dc" });
const foto = await sharp(fotoBase).rotate(6, { background: "#7a6f60" }).composite([{ input: await ruido(1400, 1000, 11), gravity: "center" }]).blur(1.1).modulate({ brightness: 0.92 }).jpeg({ quality: 55 }).toBuffer();
fs.writeFileSync(ruta("i02_foto_torcida.jpg"), foto);
caso({ id: "i02", archivo: "i02_foto_torcida.jpg", tipo: "imagen", naturaleza: "numerica", feo: "foto torcida, borrosa y con ruido",
  solicitud: { titulo: "Extracción total de agua 2025", unidad: "m3", periodo: "2025" },
  esperado: { valor: 48210, unidad: "m3", fuente: { tipo: "imagen" } } });

const recibo = await sharp(await png([{ texto: "Recibo de servicio eléctrico", negrita: true, tam: 34 }, "Periodo facturado: anual 2025", "Consumo: 376,300 kWh", "Importe: $ 1,091,270 MXN"], { alto: 600 })).webp({ quality: 80 }).toBuffer();
fs.writeFileSync(ruta("i03_recibo.webp"), recibo);
caso({ id: "i03", archivo: "i03_recibo.webp", tipo: "imagen", naturaleza: "numerica",
  solicitud: { titulo: "Consumo de electricidad 2025", unidad: "kWh", periodo: "2025" },
  esperado: { valor: 376300, unidad: "kWh", fuente: { tipo: "imagen" } } });

{
  const pngHeic = path.join(DIR, ".tmp_heic.png");
  fs.writeFileSync(pngHeic, await png([{ texto: "Captura de pantalla — sistema GEI", negrita: true, tam: 34 }, "", "Alcance 1 2025: 12,480.5 tCO2e", "Alcance 1 2024: 13,105.2 tCO2e"], { alto: 600 }));
  try {
    execFileSync("sips", ["-s", "format", "heic", pngHeic, "--out", ruta("i04_pantalla.heic")], { stdio: "ignore" });
    caso({ id: "i04", archivo: "i04_pantalla.heic", tipo: "imagen", naturaleza: "numerica", heic: true,
      solicitud: { titulo: "Inventario GEI Alcance 1", unidad: "tCO2e", periodo: "2025" },
      esperado: { valor: 12480.5, unidad: "tCO2e", fuente: { tipo: "imagen" } } });
  } catch { avisos.push("sin sips: no se generó i04_pantalla.heic"); }
  fs.rmSync(pngHeic, { force: true });
}

// =============================================================================
// CONTROL fuera de cuenta: .xls binario → «no soportado» por decisión.
// =============================================================================
try {
  execFileSync("soffice", ["--headless", "--convert-to", "xls", "--outdir", DIR, ruta("x02_emisiones_gei.xlsx")], { stdio: "ignore" });
  fs.renameSync(ruta("x02_emisiones_gei.xls"), ruta("c01_control_binario.xls"));
  caso({ id: "c01", archivo: "c01_control_binario.xls", tipo: "excel", control: true, naturaleza: "numerica",
    solicitud: { titulo: "Inventario GEI Alcance 1", unidad: "tCO2e", periodo: "2025" },
    esperado: { estado: "no_soportado", mensaje: "guarde el archivo como .xlsx" } });
} catch { avisos.push("sin soffice: no se generó el control .xls"); }

fs.writeFileSync(path.join(AQUI, "manifiesto.json"), JSON.stringify({ generado_por: "scripts/captura-sugerida/crear-conjunto.mjs", casos: manifiesto }, null, 2) + "\n");
const cuenta = (t) => manifiesto.filter((c) => !c.control && c.tipo === t).length;
console.log(`conjunto: ${manifiesto.filter((c) => !c.control).length} casos (excel ${cuenta("excel")}, pdf ${cuenta("pdf")}, word ${cuenta("word")}, imagen ${cuenta("imagen")}) + ${manifiesto.filter((c) => c.control).length} control`);
for (const a of avisos) console.log(`⚠ ${a}`);
