import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import {
  CuestionariosView,
  type RespuestaFila,
  type ReporteOpcion,
} from "./cuestionarios-view";

export const metadata: Metadata = { title: "Cuestionarios narrativos" };

function limpiar(nombre?: string | null): string | null {
  if (!nombre) return null;
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

type RespRow = {
  reporte_id: string;
  hoja: string;
  pregunta_orden: number;
  respuesta: string | null;
  tipo_dato: string | null;
  notas: string | null;
};

export default async function CuestionariosPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  const db = await createClient();

  const [{ data: reportes }, { data: resp }] = await Promise.all([
    db
      .from("reportes")
      .select("id, nombre, ejercicio, estado")
      .order("ejercicio", { ascending: false }),
    db
      .from("cuestionarios_respuestas")
      .select("reporte_id, hoja, pregunta_orden, respuesta, tipo_dato, notas"),
  ]);

  const respuestas: RespuestaFila[] = ((resp ?? []) as RespRow[]).map((r) => ({
    reporteId: r.reporte_id,
    hoja: r.hoja,
    orden: r.pregunta_orden,
    respuesta: r.respuesta,
    tipoDato: r.tipo_dato,
    notas: r.notas,
  }));

  const reportesOpc: ReporteOpcion[] = (
    (reportes ?? []) as { id: string; nombre: string; ejercicio: number; estado: string }[]
  )
    .filter((r) => r.estado === "activo")
    .map((r) => ({ id: r.id, nombre: limpiar(r.nombre) ?? r.nombre, ejercicio: r.ejercicio }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          Panel interno IRStrat · Cuestionarios
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          Cuestionarios narrativos
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Respuestas narrativas de las hojas de análisis de escenarios climáticos
          (NIIF S2 22(b)(i) / (ii)) y de créditos de carbono (NIIF S2 36(e)). Las
          preguntas son fijas de la plantilla oficial; cada respuesta va al Excel de
          taxonomía. Las preguntas sin responder se marcan como brecha en el export.
        </p>
      </header>

      <CuestionariosView respuestas={respuestas} reportes={reportesOpc} />
    </div>
  );
}
