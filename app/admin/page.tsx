import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { KpiCard } from "@/components/ui/kpi-card";
import { KPIS, contarPorBucket, type EstadoSolicitud } from "@/lib/estados";
import { MatrizSolicitudes, type FilaMatriz } from "./matriz-solicitudes";
import { BarraRecordatorios } from "./barra-recordatorios";

export const metadata: Metadata = { title: "Matriz de seguimiento" };

type SolicitudRow = {
  id: string;
  titulo: string;
  area_asignada: string | null;
  estado: EstadoSolicitud;
  orden: number;
  created_at: string;
  responsable: { nombre: string } | null;
};

function limpiar(nombre?: string | null): string | null {
  if (!nombre) return null;
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

export default async function AdminMatrizPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  const supabase = await createClient();

  const [{ data: sols, error }, { data: evs }, { data: coms }, { data: bit }] =
    await Promise.all([
      supabase
        .from("solicitudes")
        .select(
          "id, titulo, area_asignada, estado, orden, created_at, responsable:perfiles_usuario!solicitudes_responsable_cliente_id_fkey(nombre)"
        ),
      supabase.from("evidencias").select("solicitud_id, created_at"),
      supabase.from("comentarios").select("solicitud_id, created_at"),
      supabase
        .from("bitacora")
        .select("accion, entidad, entidad_id, detalle, created_at"),
    ]);

  if (error) {
    throw new Error("No se pudieron cargar las solicitudes del reporte.");
  }

  const solicitudes = (sols ?? []) as unknown as SolicitudRow[];

  // Conteo de versiones de evidencia por solicitud.
  const numVersiones = new Map<string, number>();
  for (const e of evs ?? []) {
    numVersiones.set(e.solicitud_id, (numVersiones.get(e.solicitud_id) ?? 0) + 1);
  }

  // Última actividad: máximo timestamp entre la bitácora (incluye cambios de
  // estado), las evidencias y los comentarios; piso = creación de la solicitud.
  const ultima = new Map<string, string>();
  const registrar = (solicitudId: string | null | undefined, ts: string) => {
    if (!solicitudId) return;
    const actual = ultima.get(solicitudId);
    if (!actual || ts > actual) ultima.set(solicitudId, ts);
  };
  for (const s of solicitudes) registrar(s.id, s.created_at);
  for (const e of evs ?? []) registrar(e.solicitud_id, e.created_at);
  for (const c of coms ?? []) registrar(c.solicitud_id, c.created_at);
  for (const b of bit ?? []) {
    const sid =
      b.entidad === "solicitudes"
        ? (b.entidad_id as string | null)
        : ((b.detalle as { solicitud_id?: string } | null)?.solicitud_id ?? null);
    registrar(sid, b.created_at);
  }

  const filas: FilaMatriz[] = solicitudes.map((s) => ({
    id: s.id,
    titulo: s.titulo,
    area: s.area_asignada,
    estado: s.estado,
    orden: s.orden,
    responsable: limpiar(s.responsable?.nombre),
    numVersiones: numVersiones.get(s.id) ?? 0,
    ultimaActividad: ultima.get(s.id) ?? s.created_at,
  }));

  const conteos = contarPorBucket(filas.map((f) => f.estado));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
            Panel interno IRStrat · Seguimiento
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
            Matriz de seguimiento
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Todas las solicitudes del reporte, su estado y su actividad reciente.
            Abre cualquiera para revisar evidencia, capturar valores o registrar
            observaciones.
          </p>
        </div>
        <BarraRecordatorios />
      </header>

      <section aria-label="Resumen por estado">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KPIS.map((k) => (
            <KpiCard key={k.bucket} label={k.label} value={conteos[k.bucket]} tono={k.tono} />
          ))}
        </div>
      </section>

      <MatrizSolicitudes filas={filas} />
    </div>
  );
}
