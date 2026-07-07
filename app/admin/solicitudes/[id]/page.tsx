import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { EstadoBadge, Chip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { type EstadoSolicitud } from "@/lib/estados";
import { fmtFechaHora, fmtFechaLarga, deFechaLocal } from "@/lib/fechas";
import { AccionesStaff } from "./acciones-staff";

export const metadata: Metadata = { title: "Solicitud (interno)" };

const fmtNum = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

function limpiar(nombre?: string | null): string {
  return (nombre ?? "—").replace(/\[DEMO\]\s*/i, "");
}

type EvidenciaRow = {
  id: string;
  version: number;
  nombre_original: string;
  periodo_cubierto: string | null;
  area_origen: string | null;
  created_at: string;
  subio: { nombre: string } | null;
};
type CapturaRow = {
  id: string;
  valor: number;
  unidad: string;
  periodo: string | null;
  confirmado: boolean;
  created_at: string;
  evidencia: { version: number } | null;
  capturado: { nombre: string } | null;
};
type ComentarioRow = {
  id: string;
  contenido: string;
  es_observacion: boolean;
  created_at: string;
  autor: { nombre: string } | null;
};
type DatapointRow = {
  datapoint: { codigo: string; norma: string; descripcion: string } | null;
};

export default async function SolicitudStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  const supabase = await createClient();

  const { data: sol } = await supabase
    .from("solicitudes")
    .select(
      "id, titulo, descripcion, area_asignada, estado, es_cuantitativa, unidad_esperada, fecha_limite, reporte:reportes!solicitudes_reporte_id_fkey(nombre, ejercicio), responsable:perfiles_usuario!solicitudes_responsable_cliente_id_fkey(nombre, email)"
    )
    .eq("id", id)
    .single();

  if (!sol) notFound();

  const [
    { data: evidencias },
    { data: capturas },
    { data: comentarios },
    { data: mapeo },
  ] = await Promise.all([
    supabase
      .from("evidencias")
      .select(
        "id, version, nombre_original, periodo_cubierto, area_origen, created_at, subio:perfiles_usuario!evidencias_subido_por_fkey(nombre)"
      )
      .eq("solicitud_id", id)
      .order("version", { ascending: false }),
    supabase
      .from("capturas_valor")
      .select(
        "id, valor, unidad, periodo, confirmado, created_at, evidencia:evidencias!capturas_valor_evidencia_id_fkey(version), capturado:perfiles_usuario!capturas_valor_capturado_por_fkey(nombre)"
      )
      .eq("solicitud_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("comentarios")
      .select(
        "id, contenido, es_observacion, created_at, autor:perfiles_usuario!comentarios_autor_id_fkey(nombre)"
      )
      .eq("solicitud_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("mapeo_solicitud_datapoint")
      .select(
        "datapoint:datapoints_taxonomia!mapeo_solicitud_datapoint_datapoint_id_fkey(codigo, norma, descripcion)"
      )
      .eq("solicitud_id", id),
  ]);

  const evs = (evidencias ?? []) as unknown as EvidenciaRow[];
  const caps = (capturas ?? []) as unknown as CapturaRow[];
  const coms = (comentarios ?? []) as unknown as ComentarioRow[];
  const datapoints = ((mapeo ?? []) as unknown as DatapointRow[])
    .map((m) => m.datapoint)
    .filter((d): d is NonNullable<DatapointRow["datapoint"]> => d != null);
  const estado = sol.estado as EstadoSolicitud;
  const reporte = sol.reporte as unknown as { nombre: string; ejercicio: number } | null;
  const responsable = sol.responsable as unknown as {
    nombre: string;
    email: string;
  } | null;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Breadcrumb
          items={[
            { label: "Panel", href: "/admin" },
            { label: "Matriz", href: "/admin" },
            { label: sol.titulo },
          ]}
        />
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition duration-150 hover:text-teal"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Volver a la matriz
        </Link>
      </div>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <EstadoBadge estado={estado} />
          {sol.area_asignada && <Chip>{sol.area_asignada}</Chip>}
          {sol.es_cuantitativa && (
            <Chip tono="verde">
              Cuantitativa{sol.unidad_esperada ? ` · ${sol.unidad_esperada}` : ""}
            </Chip>
          )}
        </div>
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          {sol.titulo}
        </h1>
        {sol.descripcion && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted">{sol.descripcion}</p>
        )}
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {reporte && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Reporte</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {limpiar(reporte.nombre)} · {reporte.ejercicio}
              </dd>
            </div>
          )}
          {responsable && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Responsable cliente</dt>
              <dd className="mt-0.5 font-medium text-ink">{limpiar(responsable.nombre)}</dd>
            </div>
          )}
          {sol.fecha_limite && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Fecha límite</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {fmtFechaLarga(deFechaLocal(sol.fecha_limite))}
              </dd>
            </div>
          )}
        </dl>

        {datapoints.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs uppercase tracking-wide text-muted">
              Datapoints ligados
            </span>
            {datapoints.map((d) => (
              <span
                key={d.codigo}
                title={d.descripcion}
                className="inline-flex items-center gap-1 rounded-pill border border-teal/20 bg-teal/5 px-2.5 py-0.5 text-xs font-medium text-teal"
              >
                {d.codigo}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          {/* Historial de evidencias */}
          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold text-ink">
              Historial de evidencias
            </h2>
            {evs.length === 0 ? (
              <EmptyState
                compacto
                glifo="↑"
                titulo="Aún sin evidencia"
                descripcion="El cliente todavía no ha cargado archivos para esta solicitud."
              />
            ) : (
              <ul className="space-y-3">
                {evs.map((ev, i) => (
                  <li
                    key={ev.id}
                    className="rounded-card border border-line bg-surface p-4 shadow-soft sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={
                            "grid size-10 shrink-0 place-items-center rounded-lg font-display text-sm font-semibold " +
                            (i === 0 ? "bg-teal text-crema" : "bg-teal/10 text-teal")
                          }
                        >
                          v{ev.version}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-ink">
                              {ev.nombre_original}
                            </span>
                            {i === 0 && (
                              <span className="rounded-pill bg-verde/10 px-2 py-0.5 text-[11px] font-medium text-verde">
                                Actual
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                            {ev.periodo_cubierto && <span>Periodo: {ev.periodo_cubierto}</span>}
                            {ev.area_origen && <span>Origen: {ev.area_origen}</span>}
                            <span>Por {limpiar(ev.subio?.nombre)}</span>
                            <span>{fmtFechaHora(ev.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <a
                        href={`/portal/descargar/${ev.id}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink transition duration-150 hover:border-teal/40 hover:text-teal"
                      >
                        <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 4v12M6 10l6 6 6-6" />
                          <path d="M4 20h16" />
                        </svg>
                        Descargar
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Valores capturados */}
          {sol.es_cuantitativa && (
            <section className="space-y-4">
              <h2 className="font-display text-xl font-semibold text-ink">
                Valores capturados
              </h2>
              {caps.length === 0 ? (
                <EmptyState compacto glifo="#" titulo="Sin capturas de valor todavía." />
              ) : (
                <div className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                          <th className="px-4 py-2.5 font-medium">Valor</th>
                          <th className="px-4 py-2.5 font-medium">Unidad</th>
                          <th className="px-4 py-2.5 font-medium">Periodo</th>
                          <th className="px-4 py-2.5 font-medium">Soporte</th>
                          <th className="px-4 py-2.5 font-medium">Capturado por</th>
                          <th className="px-4 py-2.5 font-medium">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {caps.map((c) => (
                          <tr
                            key={c.id}
                            className="border-b border-line/70 last:border-0"
                          >
                            <td className="px-4 py-2.5">
                              <span
                                className={
                                  "font-semibold tabular-nums " +
                                  (c.confirmado ? "text-ink" : "text-gris line-through")
                                }
                              >
                                {fmtNum.format(c.valor)}
                              </span>
                              {!c.confirmado && (
                                <span className="ml-2 text-xs text-muted">(superada)</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-muted">{c.unidad}</td>
                            <td className="px-4 py-2.5 text-muted">{c.periodo ?? "—"}</td>
                            <td className="px-4 py-2.5 text-muted">
                              {c.evidencia ? `v${c.evidencia.version}` : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-muted">
                              {limpiar(c.capturado?.nombre)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                              {fmtFechaHora(c.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Conversación / observaciones */}
          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold text-ink">Conversación</h2>
            {coms.length === 0 ? (
              <EmptyState compacto glifo="“" titulo="Sin comentarios todavía." />

            ) : (
              <ul className="space-y-3">
                {coms.map((c) => (
                  <li
                    key={c.id}
                    className={
                      "rounded-card border p-4 " +
                      (c.es_observacion
                        ? "border-rojo/30 bg-rojo/5"
                        : "border-line bg-surface shadow-soft")
                    }
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink">
                          {limpiar(c.autor?.nombre)}
                        </span>
                        {c.es_observacion && (
                          <span className="rounded-pill bg-rojo/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rojo">
                            Observación
                          </span>
                        )}
                      </div>
                      <time className="text-xs text-muted">
                        {fmtFechaHora(c.created_at)}
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                      {c.contenido}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Aside: acciones de staff */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="font-display text-lg font-semibold text-ink">Acciones</h2>
            <p className="mt-1 text-sm text-muted">
              Revisión interna de IRStrat. Cada cambio queda en la bitácora.
            </p>
            <div className="mt-5">
              <AccionesStaff
                solicitudId={sol.id}
                estadoActual={estado}
                responsable={responsable ? limpiar(responsable.nombre) : null}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
