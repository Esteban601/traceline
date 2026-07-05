import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { EstadoBadge, Chip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ESTADO_META, type EstadoSolicitud } from "@/lib/estados";
import { fmtFechaHora, fmtFechaLarga, deFechaLocal } from "@/lib/fechas";
import { UploadEvidencia } from "./upload-evidencia";
import { ComentarioForm } from "./comentario-form";

export const metadata: Metadata = { title: "Solicitud" };

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
  evidencia_id: string;
};
type ComentarioRow = {
  id: string;
  contenido: string;
  es_observacion: boolean;
  created_at: string;
  autor: { nombre: string } | null;
};

export default async function SolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await getPerfilActual();
  if (!perfil) return null;

  const supabase = await createClient();

  const { data: sol } = await supabase
    .from("solicitudes")
    .select(
      "id, titulo, descripcion, area_asignada, estado, es_cuantitativa, unidad_esperada, fecha_limite, reporte:reportes!solicitudes_reporte_id_fkey(nombre, ejercicio)"
    )
    .eq("id", id)
    .single();

  if (!sol) notFound();

  const [{ data: evidencias }, { data: capturas }, { data: comentarios }] =
    await Promise.all([
      supabase
        .from("evidencias")
        .select(
          "id, version, nombre_original, periodo_cubierto, area_origen, created_at, subio:perfiles_usuario!evidencias_subido_por_fkey(nombre)"
        )
        .eq("solicitud_id", id)
        .order("version", { ascending: false }),
      supabase
        .from("capturas_valor")
        .select("id, valor, unidad, periodo, confirmado, evidencia_id")
        .eq("solicitud_id", id),
      supabase
        .from("comentarios")
        .select(
          "id, contenido, es_observacion, created_at, autor:perfiles_usuario!comentarios_autor_id_fkey(nombre)"
        )
        .eq("solicitud_id", id)
        .order("created_at", { ascending: true }),
    ]);

  const evs = (evidencias ?? []) as unknown as EvidenciaRow[];
  const caps = (capturas ?? []) as unknown as CapturaRow[];
  const coms = (comentarios ?? []) as unknown as ComentarioRow[];
  const estado = sol.estado as EstadoSolicitud;
  const reporte = sol.reporte as unknown as { nombre: string; ejercicio: number } | null;

  const capsPorEvidencia = new Map<string, CapturaRow[]>();
  for (const c of caps) {
    const arr = capsPorEvidencia.get(c.evidencia_id) ?? [];
    arr.push(c);
    capsPorEvidencia.set(c.evidencia_id, arr);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Breadcrumb
          items={[
            { label: "Portal", href: "/portal" },
            { label: "Solicitudes", href: "/portal" },
            { label: sol.titulo },
          ]}
        />
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition duration-150 hover:text-teal"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Volver al tablero
        </Link>
      </div>

      {/* Encabezado de la solicitud */}
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
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            {sol.descripcion}
          </p>
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
          {sol.fecha_limite && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Fecha límite</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {fmtFechaLarga(deFechaLocal(sol.fecha_limite))}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Estado</dt>
            <dd className="mt-0.5 font-medium text-ink">{ESTADO_META[estado].label}</dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Columna principal */}
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
                descripcion="Cuando cargues un archivo aparecerá aquí, versionado."
              />
            ) : (
              <ul className="space-y-3">
                {evs.map((ev, i) => {
                  const capturasEv = capsPorEvidencia.get(ev.id) ?? [];
                  return (
                    <li
                      key={ev.id}
                      className="rounded-card border border-line bg-surface p-4 shadow-soft sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span
                            className={
                              "grid size-10 shrink-0 place-items-center rounded-lg font-display text-sm font-semibold " +
                              (i === 0
                                ? "bg-teal text-crema"
                                : "bg-teal/10 text-teal")
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

                      {capturasEv.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                          {capturasEv.map((c) => (
                            <span
                              key={c.id}
                              className={
                                "inline-flex items-baseline gap-1 rounded-lg px-2.5 py-1 text-sm " +
                                (c.confirmado
                                  ? "bg-verde/10 text-verde"
                                  : "bg-gris/10 text-gris line-through")
                              }
                            >
                              <span className="font-semibold tabular-nums">
                                {fmtNum.format(c.valor)}
                              </span>
                              <span className="text-xs">{c.unidad}</span>
                              {c.periodo && <span className="text-xs opacity-70">· {c.periodo}</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Conversación / observaciones */}
          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold text-ink">
              Conversación
            </h2>
            {coms.length === 0 ? (
              <EmptyState
                compacto
                glifo="“"
                titulo="Sin comentarios todavía"
                descripcion="Si tienes dudas sobre esta solicitud, escríbelas abajo."
              />
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
                          {/* El perfil del staff IRStrat no es visible al cliente (RLS);
                              lo atribuimos al equipo de IRStrat. */}
                          {c.autor?.nombre ? limpiar(c.autor.nombre) : "Equipo IRStrat"}
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

            <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
              <ComentarioForm solicitudId={sol.id} />
            </div>
          </section>
        </div>

        {/* Aside: carga de evidencia */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="font-display text-lg font-semibold text-ink">
              Cargar evidencia
            </h2>
            <p className="mt-1 text-sm text-muted">
              Cada carga crea una versión nueva; la anterior se conserva.
            </p>
            <div className="mt-5">
              <UploadEvidencia
                solicitudId={sol.id}
                esCuantitativa={sol.es_cuantitativa}
                unidadEsperada={sol.unidad_esperada}
                areaUsuario={perfil.area ?? sol.area_asignada}
                estado={estado}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
