import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { origenDe, type OrigenSolicitud } from "@/lib/origen";
import { KpiCard } from "@/components/ui/kpi-card";
import { KPIS, contarPorBucket, type EstadoSolicitud } from "@/lib/estados";
import { TenantSelector, type TenantOpcionSelector } from "@/components/tenant-selector";
import { limpiarNombreTenant } from "@/lib/tenants";
import { MatrizSolicitudes, type FilaMatriz } from "./matriz-solicitudes";
import { BarraRecordatorios } from "./barra-recordatorios";

export const metadata: Metadata = { title: "Matriz de seguimiento" };

type SolicitudRow = {
  id: string;
  titulo: string;
  area_asignada: string | null;
  estado: EstadoSolicitud;
  origen: OrigenSolicitud;
  vb_area_por: string | null;
  orden: number;
  created_at: string;
  responsable: { nombre: string } | null;
  reporte: { tenant_id: string } | null;
};

function limpiar(nombre?: string | null): string | null {
  if (!nombre) return null;
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}

export default async function AdminMatrizPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  // El administrador del cliente ve SU matriz completa (todas sus áreas): RLS ya
  // la acota a su tenant, así que aquí solo cambia lo que se le ofrece hacer.
  const soyStaff = esStaff(perfil);
  const origenPropio = origenDe(perfil);

  const { tenant: tenantParam } = await searchParams;

  const supabase = await createClient();

  const [{ data: sols, error }, { data: evs }, { data: coms }, { data: bit }, { data: tenants }] =
    await Promise.all([
      supabase
        .from("solicitudes")
        .select(
          "id, titulo, area_asignada, estado, origen, orden, created_at, vb_area_por, responsable:perfiles_usuario!solicitudes_responsable_cliente_id_fkey(nombre), reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)"
        ),
      supabase.from("evidencias").select("solicitud_id, created_at"),
      supabase.from("comentarios").select("solicitud_id, created_at"),
      supabase
        .from("bitacora")
        .select("accion, entidad, entidad_id, detalle, created_at"),
      supabase
        .from("tenants")
        .select("id, nombre, logo_url, prefijo_folio, activo")
        .order("nombre", { ascending: true }),
    ]);

  if (error) {
    throw new Error("No se pudieron cargar las solicitudes del reporte.");
  }

  const tenantsLista = (tenants ?? []) as {
    id: string;
    nombre: string;
    logo_url: string | null;
    prefijo_folio: string;
    activo: boolean;
  }[];
  const tenantsOpc: TenantOpcionSelector[] = tenantsLista.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    logoUrl: t.logo_url,
    prefijoFolio: t.prefijo_folio,
  }));
  const tenantPorId = new Map(tenantsLista.map((t) => [t.id, t]));

  // Cliente activo: solo si el ?tenant= existe. Un id inventado no filtra a
  // ciegas — cae a "todos", que es lo que el staff espera ver.
  const tenantSel = tenantParam && tenantPorId.has(tenantParam) ? tenantParam : null;

  const todas = (sols ?? []) as unknown as SolicitudRow[];
  const solicitudes = tenantSel
    ? todas.filter((s) => s.reporte?.tenant_id === tenantSel)
    : todas;
  const tenantActivo = tenantSel ? tenantPorId.get(tenantSel)! : null;

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

  const filas: FilaMatriz[] = solicitudes.map((s) => {
    const t = s.reporte?.tenant_id ? tenantPorId.get(s.reporte.tenant_id) : undefined;
    return {
      id: s.id,
      titulo: s.titulo,
      area: s.area_asignada,
      estado: s.estado,
      origen: s.origen,
      orden: s.orden,
      responsable: limpiar(s.responsable?.nombre),
      numVersiones: numVersiones.get(s.id) ?? 0,
      ultimaActividad: ultima.get(s.id) ?? s.created_at,
      tenantNombre: t ? limpiarNombreTenant(t.nombre) : null,
      tenantLogo: t?.logo_url ?? null,
      vbFirmado: s.vb_area_por != null,
    };
  });

  const conteos = contarPorBucket(filas.map((f) => f.estado));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
            {soyStaff ? "Panel interno IRStrat · Seguimiento" : "Tu panel · Seguimiento"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
            Matriz de seguimiento
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {!soyStaff
              ? "Todas las solicitudes de tu organización, su estado y su actividad reciente. Las de IRStrat las revisa IRStrat; las internas las revisas y validas tú."
              : tenantActivo
                ? `Solicitudes de ${limpiarNombreTenant(
                    tenantActivo.nombre
                  )}, su estado y su actividad reciente. Abre cualquiera para revisar evidencia, capturar valores o registrar observaciones.`
                : "Todas las solicitudes del reporte, su estado y su actividad reciente. Abre cualquiera para revisar evidencia, capturar valores o registrar observaciones."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <TenantSelector tenants={tenantsOpc} seleccionado={tenantSel} />
          {/* Los recordatorios se disparan con service_role sobre TODOS los
              clientes: es una rutina de la firma, no una acción del cliente. */}
          {soyStaff && <BarraRecordatorios />}
          <Link
            href="/admin/solicitudes/nueva"
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-teal px-3.5 text-sm font-medium text-crema shadow-soft transition duration-150 hover:bg-teal-dark"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {soyStaff ? "Nueva solicitud" : "Nueva solicitud interna"}
          </Link>
        </div>
      </header>

      <section aria-label="Resumen por estado">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KPIS.map((k) => (
            <KpiCard key={k.bucket} label={k.label} value={conteos[k.bucket]} tono={k.tono} />
          ))}
        </div>
      </section>

      <MatrizSolicitudes filas={filas} origenPropio={origenPropio} />
    </div>
  );
}
