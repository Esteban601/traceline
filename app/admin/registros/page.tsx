import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import {
  RegistrosView,
  type RegistroFila,
  type ReporteOpcion,
} from "./registros-view";

export const metadata: Metadata = { title: "Riesgos y oportunidades climáticos" };

function limpiar(nombre?: string | null): string | null {
  if (!nombre) return null;
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

export default async function RegistrosPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  const db = await createClient();

  const [{ data: reportes }, { data: regs }, { data: vals }] = await Promise.all([
    db
      .from("reportes")
      .select("id, nombre, ejercicio, estado")
      .order("ejercicio", { ascending: false }),
    db
      .from("registros_clima")
      .select("id, reporte_id, tipo, nombre, descripcion, horizontes, orden, activo")
      .order("orden", { ascending: true }),
    db
      .from("registros_clima_valores")
      .select(
        "id, registro_id, ejercicio, cantidad_activos, porcentaje, capital_gasto, capital_financiacion, capital_inversion, notas, created_at, capturado:perfiles_usuario!registros_clima_valores_capturado_por_fkey(nombre)"
      )
      .order("created_at", { ascending: false }),
  ]);

  type ValRow = {
    id: string;
    registro_id: string;
    ejercicio: number;
    cantidad_activos: number | null;
    porcentaje: number | null;
    capital_gasto: number | null;
    capital_financiacion: number | null;
    capital_inversion: number | null;
    notas: string | null;
    created_at: string;
    capturado: { nombre: string } | null;
  };
  const valoresPorReg = new Map<string, RegistroFila["valores"]>();
  for (const v of (vals ?? []) as unknown as ValRow[]) {
    const arr = valoresPorReg.get(v.registro_id) ?? [];
    arr.push({
      ejercicio: v.ejercicio,
      cantidad: v.cantidad_activos,
      pct: v.porcentaje,
      gasto: v.capital_gasto,
      financiacion: v.capital_financiacion,
      inversion: v.capital_inversion,
      notas: v.notas,
      fecha: v.created_at,
      capturadoPor: limpiar(v.capturado?.nombre),
    });
    valoresPorReg.set(v.registro_id, arr);
  }

  const registros: RegistroFila[] = (
    (regs ?? []) as {
      id: string;
      reporte_id: string;
      tipo: string;
      nombre: string;
      descripcion: string | null;
      horizontes: string[] | null;
      orden: number;
      activo: boolean;
    }[]
  ).map((r) => ({
    id: r.id,
    reporteId: r.reporte_id,
    tipo: r.tipo,
    nombre: r.nombre,
    descripcion: r.descripcion,
    horizontes: r.horizontes ?? [],
    orden: r.orden,
    activo: r.activo,
    valores: valoresPorReg.get(r.id) ?? [],
  }));

  const reportesOpc: ReporteOpcion[] = (
    (reportes ?? []) as { id: string; nombre: string; ejercicio: number; estado: string }[]
  )
    .filter((r) => r.estado === "activo")
    .map((r) => ({ id: r.id, nombre: r.nombre, ejercicio: r.ejercicio }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          Panel interno IRStrat · Clima
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          Riesgos y oportunidades climáticos
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Registro de riesgos físicos, de transición y oportunidades (NIIF S2
          10 / 29(b) / 30 / 29(d)). Captura valores por ejercicio con historial de
          correcciones. Los registros no se borran: se desactivan.
        </p>
      </header>

      <RegistrosView registros={registros} reportes={reportesOpc} />
    </div>
  );
}
