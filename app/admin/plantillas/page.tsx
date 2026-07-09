import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import {
  PlantillasView,
  type PlantillaFila,
  type ReporteOpc,
  type TenantOpc,
} from "./plantillas-view";

export const metadata: Metadata = { title: "Plantillas de checklist" };

export default async function PlantillasPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  const db = await createClient();

  const [{ data: plantillas }, { data: items }, { data: reportes }, { data: tenants }] =
    await Promise.all([
      db
        .from("plantillas")
        .select("id, nombre, descripcion, created_at")
        .order("created_at", { ascending: false }),
      db.from("plantilla_solicitudes").select("plantilla_id"),
      db.from("reportes").select("id, nombre, ejercicio").order("ejercicio", { ascending: false }),
      db.from("tenants").select("id, nombre, activo").order("nombre", { ascending: true }),
    ]);

  const conteo = new Map<string, number>();
  for (const it of (items ?? []) as { plantilla_id: string }[]) {
    conteo.set(it.plantilla_id, (conteo.get(it.plantilla_id) ?? 0) + 1);
  }

  const filas: PlantillaFila[] = (
    (plantillas ?? []) as {
      id: string;
      nombre: string;
      descripcion: string | null;
      created_at: string;
    }[]
  ).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    createdAt: p.created_at,
    solicitudes: conteo.get(p.id) ?? 0,
  }));

  const reportesOpc: ReporteOpc[] = (
    (reportes ?? []) as { id: string; nombre: string; ejercicio: number }[]
  ).map((r) => ({ id: r.id, nombre: r.nombre, ejercicio: r.ejercicio }));

  const tenantsOpc: TenantOpc[] = (
    (tenants ?? []) as { id: string; nombre: string; activo: boolean }[]
  )
    .filter((t) => t.activo)
    .map((t) => ({ id: t.id, nombre: t.nombre }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          Panel interno IRStrat · Gestión
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          Plantillas de checklist
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Guarda el set de solicitudes de un reporte como plantilla reutilizable, y
          crea reportes nuevos clonándola. Las plantillas son globales de la firma.
        </p>
      </header>

      <PlantillasView plantillas={filas} reportes={reportesOpc} tenants={tenantsOpc} />
    </div>
  );
}
