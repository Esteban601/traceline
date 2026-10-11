#!/usr/bin/env node
// =============================================================================
// A/B DE ESFUERZO (cierre del Paso 5b): Word con los bloques generados con
// esfuerzo «medium» y «high», lado a lado, con su costo.
//
//   node scripts/suplemento/ab-esfuerzo-word.mjs <carpeta> [a b "título"]
//
// Lee <carpeta>/<a>/despues-<n>.json y <carpeta>/<b>/despues-<n>.json (por
// defecto a=medium y b=high, los que escribe regenerar-bloques.mjs --esfuerzo=…)
// y escribe <carpeta>/ab-<a>-<b>.docx y .json. Sin modelo ni costo. Sirve también
// para comparar antes y después de un paso (Paso 5c).
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

const [carpeta, A = "medium", B = "high", TITULO = "A/B de esfuerzo · bloques 15, 18 y 27"] = process.argv.slice(2);
if (!carpeta) { console.error("Uso: ab-esfuerzo-word.mjs <carpeta>"); process.exit(2); }
const leer = (e, n) => JSON.parse(fs.readFileSync(path.join(carpeta, e, `despues-${n}.json`), "utf8"));
const numeros = fs.readdirSync(path.join(carpeta, B)).map((f) => f.match(/^despues-(\d+)\.json$/)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);

const metricas = (b) => ({
  costo: Number(b.costo_usd),
  entrada: b.tokens_entrada,
  cache: b.tokens_entrada_cache_lectura,
  salida: b.tokens_salida,
  segundos: Math.round((b.duracion_ms ?? 0) / 1000),
  palabras: (b.texto ?? "").split(/\s+/).filter(Boolean).length,
  marcadores: ((b.texto ?? "").match(/\[Pendiente:/g) ?? []).length,
  notas: (b.pendientes ?? []).filter((p) => p.campo === "nota_revision").length,
  cubiertos: (b.cobertura ?? []).filter((c) => c.estado === "cubierto").length,
  requisitos: (b.cobertura ?? []).length,
});
const celda = (t, negrita = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(t), bold: negrita, size: 18 })] })] });
const parrafos = (t) => (t ?? "").split(/\n+/).filter(Boolean).map((p) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: p, size: 18 })] }));
const notas = (b) => (b.pendientes ?? []).filter((p) => p.campo === "nota_revision").map((p) => new Paragraph({ children: [new TextRun({ text: `· [${p.cubeta ?? "—"}] ${p.motivo}`, size: 16, italics: true })] }));

const resumen = [];
const hijos = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(TITULO)] }),
  new Paragraph({ children: [new TextRun({ text: A === "medium" ? "Mismo documento, mismo libro de hechos y mismo prompt; solo cambia el esfuerzo del modelo (Fable 5.1). El default sigue en «high» hasta esta comparación." : `Izquierda: ${A}. Derecha: ${B}.`, size: 18 })] }),
];
for (const n of numeros) {
  const m = leer(A, n), h = leer(B, n);
  const mm = metricas(m), mh = metricas(h);
  resumen.push({ bloque: n, medium: mm, high: mh });
  hijos.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Bloque ${n}`)] }));
  const filas = [["", A, B], ["Costo (USD)", mm.costo.toFixed(4), mh.costo.toFixed(4)], ["Tokens de salida", mm.salida, mh.salida], ["Tokens de entrada (sin caché / caché leído)", `${mm.entrada} / ${mm.cache}`, `${mh.entrada} / ${mh.cache}`], ["Segundos", mm.segundos, mh.segundos], ["Palabras", mm.palabras, mh.palabras], ["Marcadores de pendiente", mm.marcadores, mh.marcadores], ["Notas al revisor", mm.notas, mh.notas], ["Requisitos cubiertos", `${mm.cubiertos} de ${mm.requisitos}`, `${mh.cubiertos} de ${mh.requisitos}`]];
  hijos.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas.map((f, i) => new TableRow({ children: f.map((x) => celda(x, i === 0)) })) }));
  hijos.push(new Paragraph({ text: "" }));
  hijos.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [celda(A, true), celda(B, true)] }),
      new TableRow({ children: [new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: parrafos(m.texto) }), new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: parrafos(h.texto) })] }),
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Notas al revisor", bold: true, size: 16 })] }), ...notas(m)] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Notas al revisor", bold: true, size: 16 })] }), ...notas(h)] })] }),
    ],
  }));
}
const tot = (e) => resumen.reduce((s, r) => s + r[e].costo, 0);
hijos.splice(2, 0, new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: `Costo de los bloques: ${A} $${tot("medium").toFixed(4)} · ${B} $${tot("high").toFixed(4)}.`, bold: true, size: 20 })] }));
const doc = new Document({ sections: [{ properties: { page: { size: { orientation: "landscape" } } }, children: hijos }] });
fs.writeFileSync(path.join(carpeta, `ab-${A}-${B}.docx`), await Packer.toBuffer(doc));
fs.writeFileSync(path.join(carpeta, `ab-${A}-${B}.json`), JSON.stringify(resumen, null, 1));
console.log(JSON.stringify({ medium: Number(tot("medium").toFixed(4)), high: Number(tot("high").toFixed(4)), bloques: resumen.map((r) => [r.bloque, r.medium.costo, r.high.costo]) }));
