import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import {
  ObjetivosView,
  type ObjetivoFila,
  type ReporteOpcion,
} from "./objetivos-view";

export const metadata: Metadata = { title: "Objetivos climáticos y de sostenibilidad" };

function limpiar(nombre?: string | null): string | null {
  if (!nombre) return null;
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

type ObjRow = {
  id: string;
  reporte_id: string;
  ambito: string;
  naturaleza: string;
  nombre: string;
  descripcion: string | null;
  tipo: string | null;
  metrica: string | null;
  meta: string | null;
  parte_entidad: string | null;
  periodo_aplicacion: string | null;
  periodo_base: string | null;
  hito_intermedio: string | null;
  tipo_objetivo: string | null;
  alineacion_acuerdo_internacional: string | null;
  orden: number;
  activo: boolean;
};
type DetRow = {
  objetivo_id: string;
  validacion_tercero: string | null;
  procesos_revision: string | null;
  metricas_supervision: string | null;
  revisiones: string | null;
  resultados: string | null;
  analisis_tendencias: string | null;
  gases_cubiertos: string | null;
  alcances_cubiertos: string | null;
  bruto_neto: string | null;
  enfoque_descarbonizacion: string | null;
  notas: string | null;
};

export default async function ObjetivosPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  const db = await createClient();

  const [{ data: reportes }, { data: objs }, { data: dets }] = await Promise.all([
    db
      .from("reportes")
      .select("id, nombre, ejercicio, estado")
      .order("ejercicio", { ascending: false }),
    db
      .from("objetivos")
      .select(
        "id, reporte_id, ambito, naturaleza, nombre, descripcion, tipo, metrica, meta, parte_entidad, periodo_aplicacion, periodo_base, hito_intermedio, tipo_objetivo, alineacion_acuerdo_internacional, orden, activo"
      )
      .order("orden", { ascending: true }),
    db
      .from("objetivos_detalle")
      .select(
        "objetivo_id, validacion_tercero, procesos_revision, metricas_supervision, revisiones, resultados, analisis_tendencias, gases_cubiertos, alcances_cubiertos, bruto_neto, enfoque_descarbonizacion, notas"
      ),
  ]);

  const detPorObj = new Map<string, DetRow>();
  for (const d of (dets ?? []) as DetRow[]) detPorObj.set(d.objetivo_id, d);

  const objetivos: ObjetivoFila[] = ((objs ?? []) as ObjRow[]).map((o) => {
    const d = detPorObj.get(o.id) ?? null;
    return {
      id: o.id,
      reporteId: o.reporte_id,
      ambito: o.ambito,
      naturaleza: o.naturaleza,
      nombre: o.nombre,
      descripcion: o.descripcion,
      tipo: o.tipo,
      metrica: o.metrica,
      meta: o.meta,
      parteEntidad: o.parte_entidad,
      periodoAplicacion: o.periodo_aplicacion,
      periodoBase: o.periodo_base,
      hitoIntermedio: o.hito_intermedio,
      tipoObjetivo: o.tipo_objetivo,
      alineacion: o.alineacion_acuerdo_internacional,
      orden: o.orden,
      activo: o.activo,
      ficha: {
        validacionTercero: d?.validacion_tercero ?? null,
        procesosRevision: d?.procesos_revision ?? null,
        metricasSupervision: d?.metricas_supervision ?? null,
        revisiones: d?.revisiones ?? null,
        resultados: d?.resultados ?? null,
        analisisTendencias: d?.analisis_tendencias ?? null,
        gasesCubiertos: d?.gases_cubiertos ?? null,
        alcancesCubiertos: d?.alcances_cubiertos ?? null,
        brutoNeto: d?.bruto_neto ?? null,
        enfoqueDescarbonizacion: d?.enfoque_descarbonizacion ?? null,
        notas: d?.notas ?? null,
      },
    };
  });

  const reportesOpc: ReporteOpcion[] = (
    (reportes ?? []) as { id: string; nombre: string; ejercicio: number; estado: string }[]
  )
    .filter((r) => r.estado === "activo")
    .map((r) => ({ id: r.id, nombre: limpiar(r.nombre) ?? r.nombre, ejercicio: r.ejercicio }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          Panel interno IRStrat · Objetivos
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          Objetivos climáticos y de sostenibilidad
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Objetivos para gestionar riesgos y oportunidades (NIIF S1 51) y objetivos
          climáticos con su validación, resultados y cobertura (NIIF S2 33 / 34 / 35
          / 36(a)-(d)). Los objetivos no se borran: se desactivan.
        </p>
      </header>

      <ObjetivosView objetivos={objetivos} reportes={reportesOpc} />
    </div>
  );
}
