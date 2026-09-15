import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requiereStaff } from "@/lib/data";
import { leerMatriz, type MatrizRiesgos } from "@/lib/perfil-emisor";
import { limpiarNombreTenant } from "@/lib/tenants";
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
  // Sección de la firma: el administrador del cliente no entra (el middleware ya
  // lo rebota; esta es la barrera de página).
  await requiereStaff();

  const db = await createClient();

  const [{ data: reportes }, { data: regs }, { data: vals }] = await Promise.all([
    db
      .from("reportes")
      .select("id, nombre, ejercicio, estado, tenant_id")
      .order("ejercicio", { ascending: false }),
    db
      .from("registros_clima")
      .select("id, reporte_id, tipo, nombre, descripcion, concentracion, impactos_potenciales, respuesta, horizontes, orden, activo")
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

  // Matriz de priorización POR EMISORA. El nivel de un registro se resuelve
  // registro → reporte → tenant → perfil_emisor.matriz_riesgos: en esta pantalla
  // conviven registros de varias emisoras y cada una tiene su propia escala, así
  // que una matriz global daría el nivel equivocado a todas menos a una.
  const tenantDeReporte = new Map<string, string>(
    (reportes ?? []).map((r) => [r.id, r.tenant_id])
  );
  const tenantIds = [...new Set([...tenantDeReporte.values()])];

  const [{ data: perfiles }, { data: tenantsRows }] = await Promise.all([
    tenantIds.length
      ? db.from("perfil_emisor").select("tenant_id, matriz_riesgos").in("tenant_id", tenantIds)
      : Promise.resolve({ data: [] as { tenant_id: string; matriz_riesgos: unknown }[] }),
    tenantIds.length
      ? db.from("tenants").select("id, nombre").in("id", tenantIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ]);

  const matrizPorTenant = new Map<string, MatrizRiesgos | null>(
    (perfiles ?? []).map((x) => [x.tenant_id, leerMatriz(x.matriz_riesgos)])
  );
  const nombrePorTenant = new Map<string, string>(
    (tenantsRows ?? []).map((t) => [t.id, limpiarNombreTenant(t.nombre)])
  );

  /** Matriz y nombre de emisora que le tocan a un registro, por su reporte. */
  const contextoDe = (reporteId: string) => {
    const tid = tenantDeReporte.get(reporteId);
    return {
      matriz: tid ? matrizPorTenant.get(tid) ?? null : null,
      emisora: tid ? nombrePorTenant.get(tid) ?? null : null,
    };
  };

  const registros: RegistroFila[] = (
    (regs ?? []) as {
      id: string;
      reporte_id: string;
      tipo: string;
      nombre: string;
      descripcion: string | null;
      concentracion: string | null;
      impactos_potenciales: string | null;
      respuesta: string | null;
      horizontes: string[] | null;
      orden: number;
      activo: boolean;
      probabilidad: number | null;
      impacto: number | null;
      severidad: number | null;
    }[]
  ).map((r) => ({
    id: r.id,
    reporteId: r.reporte_id,
    tipo: r.tipo,
    nombre: r.nombre,
    descripcion: r.descripcion,
    concentracion: r.concentracion,
    impactosPotenciales: r.impactos_potenciales,
    respuesta: r.respuesta,
    horizontes: r.horizontes ?? [],
    probabilidad: r.probabilidad,
    impacto: r.impacto,
    severidad: r.severidad,
    ...contextoDe(r.reporte_id),
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
