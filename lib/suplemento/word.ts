import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { BLOQUES } from "@/lib/suplemento/bloques";

// =============================================================================
// EXPORTACIÓN DEL SUPLEMENTO A WORD (A6 mínimo).
//
// Lo que sale es el DOCUMENTO, no el expediente: portada, índice, los cuarenta
// bloques con su encabezado y su referencia NIIF, las tablas del generador como
// tablas de Word, y nada más. Las notas al revisor, las fuentes con sus ids y el
// anexo de trazabilidad NO van: son de la plataforma, y un Word que los lleva
// termina en manos de un inversionista con nuestra cocina dentro. El anexo de
// trazabilidad es A6 completo y va aparte, por decisión y no por olvido.
//
// La marca de agua va mientras el documento no esté aprobado. No es decorativa:
// este archivo se va a mandar por correo, y sin ella un borrador con marcadores
// `[Pendiente: …]` es indistinguible de la versión final.
// =============================================================================

export type BloqueWord = {
  numero: number;
  titulo: string;
  /** Nullable en el esquema; un bloque sin sección va al final, sin cabecera. */
  seccion: string | null;
  estado: string;
  texto: string | null;
};

export type DocumentoWord = {
  version: number;
  estado: string;
  bloques: BloqueWord[];
};

export type EmisorWord = {
  denominacion: string;
  ejercicio: number;
};

const TINTA = "14302A";
const ORO = "8A6D1B";
const GRIS = "6F6A60";
const LINEA = "C9C2B4";

const TITULO_INFORME = "Informe de Sostenibilidad NIIF S1 y S2";
const MARCA_AGUA = "BORRADOR GENERADO · PENDIENTE DE REVISIÓN";

/** Referencias NIIF por bloque, del mismo mapeo que usa el generador. */
const REFERENCIAS = new Map(BLOQUES.map((b) => [b.numero, b.datapoints]));

// -----------------------------------------------------------------------------
// El texto del bloque llega con la tabla pegada delante
//
// `generar-bloque.ts` persiste `${tabla}\n\n${texto}` para que el bloque
// guardado sea exactamente lo que se publica. Aquí hay que volver a separarlos
// porque una tabla de Word no es un párrafo con tuberías: se reconoce el bloque
// markdown al principio del texto y se reconstruye, en vez de guardar la tabla
// en una columna aparte y arriesgar que las dos mitades se desincronicen.
// -----------------------------------------------------------------------------
type Trozo =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "titulo"; texto: string }
  | { tipo: "tabla"; encabezados: string[]; filas: string[][] };

const esSeparadorMd = (l: string): boolean => /^\|[\s:|-]+\|$/.test(l.trim());
const esFilaMd = (l: string): boolean => l.trim().startsWith("|") && l.trim().endsWith("|");

const celdasDe = (l: string): string[] =>
  l
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());

export function trocear(texto: string): Trozo[] {
  const lineas = texto.split("\n");
  const trozos: Trozo[] = [];
  let i = 0;

  while (i < lineas.length) {
    const l = lineas[i];

    if (!l.trim()) {
      i++;
      continue;
    }

    // Título de tabla: **Texto** en su propia línea.
    const negritaSola = /^\*\*(.+)\*\*$/.exec(l.trim());
    if (negritaSola) {
      trozos.push({ tipo: "titulo", texto: negritaSola[1] });
      i++;
      continue;
    }

    // Tabla: fila de encabezados + separador + filas.
    if (esFilaMd(l) && i + 1 < lineas.length && esSeparadorMd(lineas[i + 1])) {
      const encabezados = celdasDe(l);
      const filas: string[][] = [];
      i += 2;
      while (i < lineas.length && esFilaMd(lineas[i])) {
        filas.push(celdasDe(lineas[i]));
        i++;
      }
      trozos.push({ tipo: "tabla", encabezados, filas });
      continue;
    }

    trozos.push({ tipo: "parrafo", texto: l.trim() });
    i++;
  }

  return trozos;
}

/**
 * Negritas dentro de un párrafo. Es lo único de markdown que el generador
 * produce en prosa; el resto llega en texto plano.
 */
function runs(texto: string): TextRun[] {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return partes.map((p) => {
    const m = /^\*\*(.+)\*\*$/.exec(p);
    return new TextRun({ text: m ? m[1] : p, bold: !!m, size: 22, color: "1A1A1A" });
  });
}

// -----------------------------------------------------------------------------
// Marca de agua
//
// SIN VML. La primera versión dibujaba la marca como una forma VML rotada dentro
// del encabezado, que es como Word las hace nativamente. El archivo resultante
// abría en Vista Previa y en Quick Look, pero **Microsoft Word se negaba a
// abrirlo**: el VML que escribimos a mano no pasaba su validación, y un
// entregable que no abre en Word no es un entregable.
//
// Ahora es un párrafo de texto corriente en el encabezado: grande, gris claro,
// centrado y espaciado. OOXML puro, sin una sola etiqueta que Word tenga que
// interpretar de más.
//
// Lo que se pierde: no va rotada ni por detrás del texto, sino en la banda
// superior de cada página. Lo que se gana: el archivo abre. Para una marca
// diagonal detrás del cuerpo haría falta una imagen anclada con
// `behindDocument`, que es el camino si algún día la banda no basta.
// -----------------------------------------------------------------------------
function marcaDeAgua(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [
      new TextRun({
        text: MARCA_AGUA,
        bold: true,
        size: 36,
        color: "D8D2C4",
        characterSpacing: 40,
      }),
    ],
  });
}

// -----------------------------------------------------------------------------
// Piezas del documento
// -----------------------------------------------------------------------------
function portada(emisor: EmisorWord, doc: DocumentoWord): Paragraph[] {
  const salida: Paragraph[] = [
    new Paragraph({ spacing: { before: 2600 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: emisor.denominacion.toUpperCase(),
          bold: true,
          size: 24,
          color: ORO,
          characterSpacing: 60,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: TITULO_INFORME, bold: true, size: 44, color: TINTA })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [
        new TextRun({ text: `Ejercicio ${emisor.ejercicio}`, size: 28, color: GRIS }),
      ],
    }),
  ];

  // El sello de borrador va también en la portada, en texto: la marca de agua es
  // una imagen de fondo y hay lectores que no la pintan.
  if (doc.estado !== "aprobado") {
    salida.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({ text: MARCA_AGUA, bold: true, size: 20, color: "B4342A" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Versión ${doc.version} · documento en estado «${doc.estado}»`,
            size: 18,
            color: GRIS,
          }),
        ],
      })
    );
  }

  salida.push(new Paragraph({ children: [new PageBreak()] }));
  return salida;
}

function indice(bloques: BloqueWord[]): Paragraph[] {
  const salida: Paragraph[] = [
    new Paragraph({
      spacing: { after: 320 },
      children: [new TextRun({ text: "Contenido", bold: true, size: 32, color: TINTA })],
    }),
  ];

  let seccionActual: string | null = "";
  for (const b of bloques) {
    if (b.seccion && b.seccion !== seccionActual) {
      seccionActual = b.seccion;
      salida.push(
        new Paragraph({
          spacing: { before: 240, after: 100 },
          children: [new TextRun({ text: seccionActual, bold: true, size: 22, color: ORO })],
        })
      );
    }
    salida.push(
      new Paragraph({
        indent: { left: 340 },
        spacing: { after: 40 },
        children: [
          new TextRun({ text: `${b.numero}. `, size: 20, color: GRIS }),
          new TextRun({ text: b.titulo, size: 20, color: "1A1A1A" }),
        ],
      })
    );
  }

  salida.push(new Paragraph({ children: [new PageBreak()] }));
  return salida;
}

function tablaWord(encabezados: string[], filas: string[][]): Table {
  const borde = { style: BorderStyle.SINGLE, size: 4, color: LINEA };
  const bordes = { top: borde, bottom: borde, left: borde, right: borde };

  const celda = (texto: string, cabecera: boolean) =>
    new TableCell({
      borders: bordes,
      verticalAlign: VerticalAlign.TOP,
      shading: cabecera
        ? { type: ShadingType.CLEAR, fill: "F3EFE6", color: "auto" }
        : undefined,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: texto,
              bold: cabecera,
              size: 18,
              color: cabecera ? TINTA : "1A1A1A",
            }),
          ],
        }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: encabezados.map((h) => celda(h, true)),
      }),
      ...filas.map(
        (f) =>
          new TableRow({
            children: encabezados.map((_, i) => celda(f[i] ?? "", false)),
          })
      ),
    ],
  });
}

function bloqueWord(b: BloqueWord): (Paragraph | Table)[] {
  const salida: (Paragraph | Table)[] = [];

  salida.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360, after: 60 },
      children: [new TextRun({ text: b.titulo, bold: true, size: 26, color: TINTA })],
    })
  );

  const refs = REFERENCIAS.get(b.numero) ?? [];
  if (refs.length > 0) {
    salida.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [new TextRun({ text: refs.join(" · "), size: 16, color: ORO })],
      })
    );
  }

  for (const t of trocear(b.texto ?? "")) {
    if (t.tipo === "tabla") {
      salida.push(tablaWord(t.encabezados, t.filas));
      salida.push(new Paragraph({ spacing: { after: 200 } }));
    } else if (t.tipo === "titulo") {
      salida.push(
        new Paragraph({
          spacing: { before: 160, after: 100 },
          children: [new TextRun({ text: t.texto, bold: true, size: 22, color: TINTA })],
        })
      );
    } else {
      salida.push(
        new Paragraph({
          spacing: { after: 140, line: 300 },
          alignment: AlignmentType.JUSTIFIED,
          children: runs(t.texto),
        })
      );
    }
  }

  return salida;
}

// -----------------------------------------------------------------------------
export function nombreArchivo(denominacion: string, ejercicio: number, version: number): string {
  const slug =
    denominacion
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "emisora";
  return `Suplemento_S1S2_${slug}_${ejercicio}_v${version}.docx`;
}

/**
 * Arma el .docx completo. Los bloques `no_aplica` se OMITEN —el régimen los
 * excluye, así que no existen para el lector— y los de plantilla entran como
 * cualquier otro: su texto es fijo, no vacío.
 */
export async function construirWord(
  emisor: EmisorWord,
  doc: DocumentoWord
): Promise<Buffer> {
  const visibles = doc.bloques
    .filter((b) => b.estado !== "no_aplica")
    .filter((b) => (b.texto ?? "").trim().length > 0)
    .sort((a, b) => a.numero - b.numero);

  const cuerpo: (Paragraph | Table)[] = [];
  let seccionActual: string | null = "";
  for (const b of visibles) {
    if (b.seccion && b.seccion !== seccionActual) {
      seccionActual = b.seccion;
      cuerpo.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: cuerpo.length > 0,
          spacing: { before: 240, after: 240 },
          children: [new TextRun({ text: seccionActual, bold: true, size: 34, color: TINTA })],
        })
      );
    }
    cuerpo.push(...bloqueWord(b));
  }

  const borrador = doc.estado !== "aprobado";

  const documento = new Document({
    creator: emisor.denominacion,
    title: `${TITULO_INFORME} · ${emisor.ejercicio}`,
    description: borrador ? MARCA_AGUA : TITULO_INFORME,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        headers: borrador ? { default: new Header({ children: [marcaDeAgua()] }) } : undefined,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: borrador ? `${MARCA_AGUA}  ·  ` : "",
                    size: 14,
                    color: GRIS,
                  }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: GRIS }),
                ],
              }),
            ],
          }),
        },
        children: [...portada(emisor, doc), ...indice(visibles), ...cuerpo],
      },
    ],
  });

  return Packer.toBuffer(documento);
}
