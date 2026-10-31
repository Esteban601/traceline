import ExcelJS from "exceljs";
import { pendienteEnTextoPlano } from "@/lib/suplemento/respuestas";
import { industriaDe } from "@/lib/catalogo-marcos";

// =============================================================================
// LIBRO GRI/SASB (encargo 2026-10-31-catalogo-gri-sasb, decisión 4 de Esteban): un libro APARTE de la plantilla
// oficial de taxonomía, con la misma regla que ella (lib/excel/depurar.ts, regla de Esteban del 26/10): solo
// preguntas y respuestas. Sin títulos, notas, pies, leyendas ni columnas auxiliares.
//
//   · una hoja «GRI» con los contenidos GRI del catálogo;
//   · una hoja «SASB <industria>» por cada industria del Perfil de la emisora (p. ej. «SASB FN-CB»);
//   · columnas: Código, Requisito (texto literal del catálogo) y, con el generador encendido para la emisora,
//     Respuesta (la del último documento aprobado, o «En preparación»), como la columna de respuestas del Excel de
//     taxonomía. Los marcadores de pendiente van en texto plano (CLAUDE.md §5).
// La norma y la edición van en las propiedades del archivo, no en celdas.
// =============================================================================

export type FilaGriSasb = { codigo: string; marco: "GRI" | "SASB"; estandar: string | null; edicion: string | null; descripcion: string };

export const EN_PREPARACION = "En preparación";

/** Orden natural de los códigos: «GRI 2-9» antes que «GRI 2-10»; «FN-CB-000.A» al final de su industria. */
function clave(c: string): (string | number)[] {
  const actividad = /-000\.[A-Z]$/.test(c) ? 1 : 0;
  return [actividad, ...c.split(/(\d+)/).map((x) => (/^\d+$/.test(x) ? Number(x) : x))];
}
export function compararCodigos(a: string, b: string): number {
  const ka = clave(a), kb = clave(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const x = ka[i] ?? "", y = kb[i] ?? "";
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x).localeCompare(String(y));
  }
  return 0;
}

/**
 * Arma el libro. `respuestas` nulo = generador apagado para la emisora: sin columna de respuesta. Con un Map, cada
 * código lleva su respuesta o «En preparación».
 */
export function armarLibroGriSasb(params: {
  filas: FilaGriSasb[];
  respuestas: Map<string, string> | null;
  titulo: string;
  esDemo: boolean;
}): { wb: ExcelJS.Workbook; hojas: { nombre: string; filas: number }[] } {
  const wb = new ExcelJS.Workbook();
  const grupos = new Map<string, FilaGriSasb[]>();
  for (const f of [...params.filas].sort((a, b) => compararCodigos(a.codigo, b.codigo))) {
    const hoja = f.marco === "GRI" ? "GRI" : `SASB ${industriaDe(f.estandar) ?? f.estandar ?? ""}`.trim();
    const arr = grupos.get(hoja) ?? [];
    arr.push(f);
    grupos.set(hoja, arr);
  }
  const conRespuesta = params.respuestas !== null;
  const hojas: { nombre: string; filas: number }[] = [];
  for (const nombre of [...grupos.keys()].sort((a, b) => (a === "GRI" ? -1 : b === "GRI" ? 1 : a.localeCompare(b)))) {
    const ws = wb.addWorksheet(nombre);
    ws.columns = [{ width: 16 }, { width: 100 }, ...(conRespuesta ? [{ width: 90 }] : [])];
    const enc = ws.addRow(["Código", "Requisito", ...(conRespuesta ? ["Respuesta"] : [])]);
    enc.font = { bold: true };
    for (const f of grupos.get(nombre)!) {
      const r = params.respuestas?.get(f.codigo);
      const fila = ws.addRow([f.codigo, f.descripcion, ...(conRespuesta ? [r ? pendienteEnTextoPlano(r) : EN_PREPARACION] : [])]);
      fila.alignment = { vertical: "top", wrapText: true };
    }
    ws.views = [{ state: "frozen", ySplit: 1 }];
    hojas.push({ nombre, filas: grupos.get(nombre)!.length });
  }
  const normas = [...new Set(params.filas.map((f) => (f.estandar && f.edicion ? `${f.estandar} (${f.edicion})` : null)).filter(Boolean))];
  wb.title = params.esDemo ? `${params.titulo} · [DEMO]` : params.titulo;
  wb.subject = params.esDemo ? "[DEMO] datos ilustrativos" : "";
  wb.description = normas.join("; ");
  return { wb, hojas };
}
