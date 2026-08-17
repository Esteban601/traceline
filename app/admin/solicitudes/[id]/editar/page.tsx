import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EstadoBadge } from "@/components/ui/badge";
import { type EstadoSolicitud } from "@/lib/estados";
import {
  puedeEditarSolicitud,
  puedeEditarEnunciado,
  puedeAsignarRubroTaxonomia,
} from "@/lib/gestion";
import { SolicitudForm, type ValoresIniciales } from "../../solicitud-form";
import { cargarOpcionesFormulario } from "../../opciones";
import { AsignarRubro } from "../../asignar-rubro";
import { editarSolicitud } from "../../gestion-actions";

export const metadata: Metadata = { title: "Editar solicitud" };

export default async function EditarSolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  const db = await createClient();

  const { data: sol } = await db
    .from("solicitudes")
    .select(
      "id, reporte_id, titulo, descripcion, area_asignada, es_cuantitativa, unidad_esperada, fecha_limite, estado, responsable_cliente_id, responsable_irstrat_id, orden, rubro_clave, rubro_taxonomia"
    )
    .eq("id", id)
    .single();

  if (!sol) notFound();

  const estado = sol.estado as EstadoSolicitud;

  const [{ data: mapeo }, { count }, opciones] = await Promise.all([
    db.from("mapeo_solicitud_datapoint").select("datapoint_id").eq("solicitud_id", id),
    db
      .from("evidencias")
      .select("id", { count: "exact", head: true })
      .eq("solicitud_id", id),
    cargarOpcionesFormulario(),
  ]);

  const tieneEvidencia = (count ?? 0) > 0;
  const enunciadoBloqueado = !puedeEditarEnunciado(tieneEvidencia);

  const backHref = `/admin/solicitudes/${id}`;

  const cabecera = (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: "Panel", href: "/admin" },
          { label: "Matriz", href: "/admin" },
          { label: sol.titulo, href: backHref },
          { label: "Editar" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          Gestión · Solicitudes
        </p>
        <EstadoBadge estado={estado} />
      </div>
      <h1 className="font-display text-3xl font-semibold text-ink">Editar solicitud</h1>
    </div>
  );

  // REGLA DURA: una solicitud validada no se edita.
  if (!puedeEditarSolicitud(estado)) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        {cabecera}
        <div className="rounded-card border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
          <p className="font-display text-lg font-medium text-ink">
            {estado === "congelado"
              ? "Esta solicitud está congelada"
              : "Esta solicitud está validada"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            {estado === "congelado"
              ? "El reporte fue cerrado para aseguramiento; sus solicitudes quedaron en solo-lectura."
              : "Una solicitud validada no puede editarse: su evidencia ya fue aceptada. Si necesitas reabrirla, cambia su estado desde el detalle."}
          </p>
          <Link
            href={backHref}
            className="mt-5 inline-flex h-11 items-center rounded-xl border border-line px-5 text-sm font-medium text-ink transition duration-150 hover:border-teal/40 hover:text-teal"
          >
            Volver al detalle
          </Link>

          {/* Excepción deliberada al candado: el rubro de taxonomía no es
              contenido de la solicitud, es el mapeo a la celda de la plantilla
              oficial. Sin esta vía, un reporte validado antes de que existieran
              los rubros nunca podría llenar su Excel. Congelado sí queda fuera. */}
          {puedeAsignarRubroTaxonomia(estado) && (
            <AsignarRubro
              solicitudId={sol.id}
              rubros={opciones.rubros}
              inicial={sol.rubro_taxonomia ?? ""}
            />
          )}
        </div>
      </div>
    );
  }

  const inicial: ValoresIniciales = {
    solicitudId: sol.id,
    reporteId: sol.reporte_id,
    titulo: sol.titulo,
    descripcion: sol.descripcion ?? "",
    area_asignada: sol.area_asignada ?? "",
    es_cuantitativa: sol.es_cuantitativa,
    unidad_esperada: sol.unidad_esperada ?? "",
    fecha_limite: sol.fecha_limite ?? "",
    responsable_cliente_id: sol.responsable_cliente_id ?? "",
    responsable_irstrat_id: sol.responsable_irstrat_id ?? "",
    orden: String(sol.orden ?? ""),
    rubro_clave: sol.rubro_clave ?? "",
    rubro_taxonomia: sol.rubro_taxonomia ?? "",
    datapointIds: (mapeo ?? []).map((m) => m.datapoint_id),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {cabecera}
      <div className="rounded-card border border-line bg-surface p-6 shadow-soft sm:p-8">
        <SolicitudForm
          modo="editar"
          action={editarSolicitud}
          reportes={opciones.reportes}
          usuariosCliente={opciones.usuariosCliente}
          staff={opciones.staff}
          areas={opciones.areas}
          datapoints={opciones.datapoints}
          rubros={opciones.rubros}
          inicial={inicial}
          enunciadoBloqueado={enunciadoBloqueado}
        />
      </div>
    </div>
  );
}
