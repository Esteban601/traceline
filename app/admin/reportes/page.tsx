import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requiereStaff } from "@/lib/data";
import { ReportesView, type ReporteFila } from "./reportes-view";

export const metadata: Metadata = { title: "Reportes" };

export default async function ReportesPage() {
  // Sección de la firma: el administrador del cliente no entra (el middleware ya
  // lo rebota; esta es la barrera de página).
  const perfil = await requiereStaff();

  const db = await createClient();

  const [{ data: reportes }, { data: tenants }, { data: sols }] = await Promise.all([
    db
      .from("reportes")
      .select("id, nombre, ejercicio, estado, fecha_congelamiento, tenant_id")
      .order("ejercicio", { ascending: false }),
    db.from("tenants").select("id, nombre"),
    db.from("solicitudes").select("reporte_id, estado"),
  ]);

  const nombreTenant = new Map(
    ((tenants ?? []) as { id: string; nombre: string }[]).map((t) => [t.id, t.nombre])
  );

  const conteo = new Map<string, number>();
  const congeladas = new Map<string, number>();
  for (const s of (sols ?? []) as { reporte_id: string; estado: string }[]) {
    conteo.set(s.reporte_id, (conteo.get(s.reporte_id) ?? 0) + 1);
    if (s.estado === "congelado")
      congeladas.set(s.reporte_id, (congeladas.get(s.reporte_id) ?? 0) + 1);
  }

  const filas: ReporteFila[] = (
    (reportes ?? []) as {
      id: string;
      nombre: string;
      ejercicio: number;
      estado: "activo" | "congelado";
      fecha_congelamiento: string | null;
      tenant_id: string;
    }[]
  ).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    ejercicio: r.ejercicio,
    estado: r.estado,
    fechaCongelamiento: r.fecha_congelamiento,
    tenantNombre: nombreTenant.get(r.tenant_id) ?? "—",
    solicitudes: conteo.get(r.id) ?? 0,
    solicitudesCongeladas: congeladas.get(r.id) ?? 0,
  }));

  const esAdmin = perfil.rol === "admin";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          Panel interno IRStrat · Gestión
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          Reportes
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Estado de cada reporte. Congelar un reporte cierra su evidencia para
          aseguramiento: queda en solo-lectura de forma permanente.
        </p>
      </header>

      <ReportesView reportes={filas} esAdmin={esAdmin} />
    </div>
  );
}
