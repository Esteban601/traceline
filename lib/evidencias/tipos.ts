// =============================================================================
// TIPOS DE EVIDENCIA que la plataforma lee (encargo captura sugerida §2).
//
// Se decide por la EXTENSIÓN del nombre original, no por el contenido: es lo que
// el usuario ve y lo que el mensaje de «no soportado» le puede pedir que cambie.
// El .xls binario (Excel 97-2003) se reconoce para poder decirle qué hacer: no
// se agrega una librería solo para él (decisión del Paso 0).
// =============================================================================

export type TipoLectura = "excel" | "csv" | "pdf" | "word" | "imagen" | "otro";

/** Formato de imagen que se manda a visión (HEIC/HEIF se convierte antes). */
export type FormatoImagen = "png" | "jpeg" | "webp" | "heic";

export type Clasificacion =
  | { tipo: "excel" | "csv" | "pdf" | "word"; soportado: true }
  | { tipo: "imagen"; soportado: true; formato: FormatoImagen }
  | { tipo: TipoLectura; soportado: false; mensaje: string };

/** Límite del encargo §2: más allá, no se lee. Se valida también al firmar la subida. */
export const BYTES_MAX = 25 * 1024 * 1024;
/** Límite del encargo §2: se leen las primeras 60 páginas y se avisa. */
export const PAGINAS_MAX = 60;
/** Tope de celdas con valor que se guardan de un libro de Excel. */
export const CELDAS_MAX = 20_000;

export function clasificarArchivo(nombre: string): Clasificacion {
  const ext = nombre.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "xlsx":
    case "xlsm":
      return { tipo: "excel", soportado: true };
    case "csv":
      return { tipo: "csv", soportado: true };
    case "xls":
      return { tipo: "excel", soportado: false, mensaje: "Formato Excel 97-2003 (.xls): guarde el archivo como .xlsx y vuelva a cargarlo." };
    case "pdf":
      return { tipo: "pdf", soportado: true };
    case "docx":
      return { tipo: "word", soportado: true };
    case "doc":
      return { tipo: "word", soportado: false, mensaje: "Formato Word 97-2003 (.doc): guarde el archivo como .docx y vuelva a cargarlo." };
    case "png":
      return { tipo: "imagen", soportado: true, formato: "png" };
    case "jpg":
    case "jpeg":
      return { tipo: "imagen", soportado: true, formato: "jpeg" };
    case "webp":
      return { tipo: "imagen", soportado: true, formato: "webp" };
    case "heic":
    case "heif":
      return { tipo: "imagen", soportado: true, formato: "heic" };
    default:
      return { tipo: "otro", soportado: false, mensaje: `La plataforma no lee archivos .${ext || "sin extensión"}; se conservan como evidencia sin lectura.` };
  }
}
