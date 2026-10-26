import "server-only";
import sharp from "sharp";
import heicConvert from "heic-convert";
import { extractImages, getDocumentProxy } from "unpdf";
import type { Contenido } from "./extraer";
import type { FormatoImagen } from "./tipos";

// =============================================================================
// RELECTURA A MÁS RESOLUCIÓN DE UNA LÍNEA [ilegible] (sug-num-3, OK de Esteban
// del 26/10).
//
// Cuando la cifra que pide la solicitud está en una línea que la transcripción
// dejó como [ilegible], el modelo de la sugerencia la señala; aquí se comprueba
// que esa línea existe en el contenido, se arma la página en franjas a la
// resolución del archivo (la imagen incrustada del PDF escaneado, o la foto sin
// reducir) y, si la relectura la lee, se sustituye en el contenido. La relectura
// cuenta como una lectura contra el tope mensual (tope.ts).
// =============================================================================

const ILEGIBLE = "[ilegible]";
/** Alto de cada franja respecto del ancho, y traslape entre franjas. */
const ALTO_FRANJA = 0.45;
const TRASLAPE = 0.2;
const FRANJAS_MAX = 8;

type PaginasVision = Extract<Contenido, { tipo: "pdf" | "imagen" }>;

function paginasDe(c: Contenido): PaginasVision["paginas"] | null {
  return c.tipo === "pdf" || c.tipo === "imagen" ? c.paginas : null;
}

const normal = (t: string) => t.replace(/\s+/g, " ").trim();

/**
 * La línea [ilegible] que señaló el modelo, tal como está en el contenido. Si no
 * coincide literal pero la página tiene una sola línea con [ilegible], es esa.
 */
export function lineaSenalada(c: Contenido, senal: { pagina: number; linea: string } | null): { pagina: number; linea: string } | null {
  if (!senal) return null;
  const pagina = paginasDe(c)?.find((p) => p.pagina === senal.pagina && p.origen === "vision");
  if (!pagina) return null;
  const conIlegible = pagina.texto.split("\n").filter((l) => l.includes(ILEGIBLE));
  const exacta = conIlegible.find((l) => normal(l) === normal(senal.linea));
  const linea = exacta ?? (conIlegible.length === 1 ? conIlegible[0] : null);
  return linea ? { pagina: senal.pagina, linea } : null;
}

/** El contenido con la línea releída en lugar de la [ilegible]. */
export function sustituirLinea(c: Contenido, pagina: number, antes: string, despues: string): Contenido {
  if (c.tipo !== "pdf" && c.tipo !== "imagen") return c;
  return {
    ...c,
    paginas: c.paginas.map((p) =>
      p.pagina === pagina ? { ...p, texto: p.texto.split("\n").map((l) => (l === antes ? despues : l)).join("\n") } : p
    ),
  } as Contenido;
}

/** La página como imagen a la resolución del archivo, o null si no hay imagen que releer. */
async function imagenDePagina(
  archivo: Buffer,
  clase: { tipo: "pdf" } | { tipo: "imagen"; formato: FormatoImagen },
  pagina: number
): Promise<ReturnType<typeof sharp> | null> {
  if (clase.tipo === "imagen") {
    let entrada = archivo;
    if (clase.formato === "heic") {
      const convertida = await heicConvert({ buffer: archivo, format: "JPEG", quality: 0.95 });
      entrada = Buffer.from(convertida instanceof Uint8Array ? convertida : new Uint8Array(convertida));
    }
    return sharp(await sharp(entrada).rotate().png().toBuffer());
  }
  // PDF escaneado: la imagen incrustada más grande de la página. Un PDF sin
  // imagen (vectorial) no tiene nada que releer a más resolución.
  const doc = await getDocumentProxy(new Uint8Array(archivo));
  if (pagina < 1 || pagina > doc.numPages) return null;
  const imagenes = await extractImages(doc, pagina);
  const mayor = imagenes.sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!mayor) return null;
  return sharp(Buffer.from(mayor.data), { raw: { width: mayor.width, height: mayor.height, channels: mayor.channels } });
}

/** La página en franjas horizontales con traslape, en PNG. */
export async function franjasDePagina(
  archivo: Buffer,
  clase: { tipo: "pdf" } | { tipo: "imagen"; formato: FormatoImagen },
  pagina: number
): Promise<Buffer[] | null> {
  const img = await imagenDePagina(archivo, clase, pagina);
  if (!img) return null;
  const png = await img.png().toBuffer();
  const { width = 0, height = 0 } = await sharp(png).metadata();
  if (!width || !height) return null;
  const alto = Math.min(height, Math.max(200, Math.round(width * ALTO_FRANJA)));
  const paso = Math.max(1, Math.round(alto * (1 - TRASLAPE)));
  const franjas: Buffer[] = [];
  for (let y = 0; y < height && franjas.length < FRANJAS_MAX; y += paso) {
    const h = Math.min(alto, height - y);
    franjas.push(await sharp(png).extract({ left: 0, top: y, width, height: h }).png().toBuffer());
    if (y + h >= height) break;
  }
  return franjas;
}
