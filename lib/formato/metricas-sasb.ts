import { ponerTexto } from "@/lib/formato/xlsx-xml";
import { compararCodigos } from "@/lib/excel/gri-sasb";
import { paraFormatoElectronico, type EstadoRespuesta } from "@/lib/suplemento/respuestas";

// =============================================================================
// Hoja «Métricas SASB» del Formato electrónico (encargo 2026-10-31-catalogo-gri-sasb, decisiones 3 de Esteban): las
// métricas SASB de la industria del Perfil de la emisora, con Código / Métrica / Respuesta, sin tocar la plantilla de
// la BMV (la hoja ya existe; `scripts/formato/preparar-plantilla.mjs` la deja con su título en A1).
//
//   · fila 2: encabezado; filas 3 en adelante: una por métrica, en el orden de la norma (contables y después las de
//     actividad);
//   · la métrica, con el texto literal del catálogo (en inglés hasta que haya traducción oficial);
//   · la respuesta, la de `respuestas_datapoint` (destino «taxonomia», del último documento aprobado) con la regla del
//     Formato: pendiente o sin respuesta = celda vacía (CLAUDE.md §5).
// Sin sector SASB en el Perfil, o sin métricas de esa industria en el catálogo: la hoja queda como la plantilla.
// =============================================================================

export type MetricaSasb = { codigo: string; descripcion: string };
export type RespuestaSasb = { estado: EstadoRespuesta; texto: string | null };

export function filasMetricasSasb(metricas: MetricaSasb[], respuestas: Map<string, RespuestaSasb>): [string, string, string][] {
  return [...metricas]
    .sort((a, b) => compararCodigos(a.codigo, b.codigo))
    .map((m) => {
      const r = respuestas.get(m.codigo);
      return [m.codigo, m.descripcion, r ? paraFormatoElectronico(r.estado, r.texto) ?? "" : ""];
    });
}

/** Escribe encabezado y filas en el XML de la hoja. Devuelve el XML y cuántas métricas llevan respuesta. */
export function escribirMetricasSasb(xml: string, filas: [string, string, string][]): { xml: string; conRespuesta: number } {
  if (!filas.length) return { xml, conRespuesta: 0 };
  let hoja = xml;
  ["Código", "Métrica", "Respuesta"].forEach((t, i) => (hoja = ponerTexto(hoja, `${"ABC"[i]}2`, t)));
  let conRespuesta = 0;
  filas.forEach(([codigo, metrica, respuesta], i) => {
    const n = i + 3;
    hoja = ponerTexto(hoja, `A${n}`, codigo);
    hoja = ponerTexto(hoja, `B${n}`, metrica);
    if (respuesta) {
      hoja = ponerTexto(hoja, `C${n}`, respuesta);
      conRespuesta++;
    }
  });
  return { xml: hoja, conRespuesta };
}
