import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { EstadoBadge, Chip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { type EstadoSolicitud } from "@/lib/estados";
import { fmtFechaHora, fmtDiaLargo } from "@/lib/fechas";
import { puedeEditarSolicitud, puedeEliminarSolicitud } from "@/lib/gestion";
import { cargarDiscrepancias } from "@/lib/discrepancias";
import { AccionesStaff } from "./acciones-staff";
import { EliminarSolicitud } from "./eliminar-solicitud";
import { Timeline, type EventoBitacora } from "./timeline";

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
  justificacion: string | null;
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
    { data: bitacora },
    discrepancias,
  ] = await Promise.all([
    supabase
      .from("evidencias")
      .select(
        "id, version, nombre_original, periodo_cubierto, area_origen, justificacion, created_at, subio:perfiles_usuario!evidencias_subido_por_fkey(nombre)"
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
    supabase
      .from("bitacora")
      .select(
        "id, created_at, accion, detalle, usuario:perfiles_usuario!bitacora_usuario_id_fkey(nombre)"
      )
      .or(`entidad_id.eq.${id},detalle->>solicitud_id.eq.${id}`)
      .order("created_at", { ascending: false }),
    cargarDiscrepancias(supabase),
  ]);

  const evs = (evidencias ?? []) as unknown as EvidenciaRow[];
  const caps = (capturas ?? []) as unknown as CapturaRow[];
  const coms = (comentarios ?? []) as unknown as ComentarioRow[];
  const datapoints = ((mapeo ?? []) as unknown as DatapointRow[])
    .map((m) => m.datapoint)
    .filter((d): d is NonNullable<DatapointRow["datapoint"]> => d != null);
  const eventos = ((bitacora ?? []) as unknown as {
    id: string;
    created_at: string;
    accion: string;
    detalle: Record<string, unknown> | null;
    usuario: { nombre: string } | null;
  }[]).map(
    (b): EventoBitacora => ({
      id: b.id,
      createdAt: b.created_at,
      accion: b.accion,
      detalle: b.detalle,
      usuario: b.usuario?.nombre ?? null,
    })
  );
  const discrepanciasSol = discrepancias.porSolicitud.get(id) ?? [];
  const estado = sol.estado as EstadoSolicitud;
  const reporte = sol.reporte as unknown as { nombre: string; ejercicio: number } | null;
  const responsable = sol.responsable as unknown as {
    nombre: string;
    email: string;
  } | null;

  const puedeEditar = puedeEditarSolicitud(estado);
  const puedeEliminar = puedeEliminarSolicitud(estado, evs.length > 0);
  const ultimaEv = evs[0] ?? null;
  // Cifra vigente: la confirmada más reciente; si ninguna, la última capturada.
  const capVigente = caps.find((c) => c.confirmado) ?? caps[0] ?? null;
  const ultimaObs = [...coms].reverse().find((c) => c.es_observacion) ?? null;
  const fraseVigente = capVigente
    ? `${fmtNum.format(capVigente.valor)} ${capVigente.unidad}` +
      (capVigente.periodo ? ` en ${capVigente.periodo}` : "") +
      ` — capturado por ${limpiar(capVigente.capturado?.nombre)}` +
      (capVigente.evidencia ? `, respaldado por la versión ${capVigente.evidencia.version}` : "")
    : null;

  const linkEditar = (
    <Link
      href={`/admin/solicitudes/${sol.id}/editar`}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink transition duration-150 hover:border-teal/40 hover:text-teal"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
      Editar solicitud
    </Link>
  );

  const descargar = (evId: string) => (
    <a
      href={`/portal/descargar/${evId}`}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink transition duration-150 hover:border-teal/40 hover:text-teal"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4v12M6 10l6 6 6-6" />
        <path d="M4 20h16" />
      </svg>
      Descargar
    </a>
  );

  // Contexto de "acción ahora" según estado (lo que el revisor necesita a la vista).
  const contexto =
    estado === "observaciones" && ultimaObs ? (
      <div className="space-y-3">
        <div className="rounded-xl border border-rojo/30 bg-rojo/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-rojo">
            Última observación
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
            {ultimaObs.contenido}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {limpiar(ultimaObs.autor?.nombre)} · {fmtFechaHora(ultimaObs.created_at)}
          </p>
        </div>
        {ultimaEv && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-crema/30 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Respuesta del cliente — última evidencia
              </p>
              <p className="mt-1 truncate text-sm font-medium text-ink">
                v{ultimaEv.version} · {ultimaEv.nombre_original}
              </p>
            </div>
            {descargar(ultimaEv.id)}
          </div>
        )}
      </div>
    ) : ultimaEv ? (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-crema/30 p-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Última evidencia
            </p>
            <p className="mt-1 truncate text-sm font-medium text-ink">
              v{ultimaEv.version} · {ultimaEv.nombre_original}
            </p>
            <p className="text-xs text-muted">
              {limpiar(ultimaEv.subio?.nombre)} · {fmtFechaHora(ultimaEv.created_at)}
            </p>
          </div>
          {descargar(ultimaEv.id)}
        </div>
        {fraseVigente && (
          <p className="text-sm text-ink">
            <span className="text-muted">Cifra vigente: </span>
            <span className="font-medium">{fraseVigente}</span>
          </p>
        )}
      </div>
    ) : (
      <p className="rounded-xl border border-dashed border-line bg-crema/30 px-4 py-4 text-sm text-muted">
        Aún sin evidencia del cliente.
      </p>
    );

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Panel", href: "/admin" },
          { label: "Matriz", href: "/admin" },
          { label: sol.titulo },
        ]}
      />

      {/* ===================== PRINCIPAL ===================== */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
            {sol.titulo}
          </h1>
          {puedeEditar && linkEditar}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <EstadoBadge estado={estado} />
          {sol.area_asignada && <Chip>{sol.area_asignada}</Chip>}
          {sol.es_cuantitativa && (
            <Chip tono="verde">
              Cuantitativa{sol.unidad_esperada ? ` · ${sol.unidad_esperada}` : ""}
            </Chip>
          )}
        </div>
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
                {fmtDiaLargo(sol.fecha_limite)}
              </dd>
            </div>
          )}
        </dl>

        {datapoints.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs uppercase tracking-wide text-muted">Datapoints ligados</span>
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

      {discrepanciasSol.length > 0 && (
        <div className="space-y-3">
          {discrepanciasSol.map((d, i) => (
            <div key={i} className="rounded-card border border-rojo/30 bg-rojo/5 p-4 sm:p-5">
              <div className="flex items-start gap-2.5">
                <span aria-hidden className="mt-0.5 text-rojo">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-rojo">Discrepancia entre áreas</p>
                  <p className="mt-0.5 text-sm text-ink/90">
                    Dos solicitudes reportan valores distintos para el mismo datapoint, con
                    la misma unidad{d.periodo ? ` y periodo (${d.periodo})` : ""}. Revisa cuál
                    es el correcto antes de validar.
                  </p>
                </div>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {d.capturas.map((c) => (
                  <li
                    key={c.solicitudId}
                    className={
                      "rounded-xl border bg-surface px-3.5 py-2.5 " +
                      (c.solicitudId === id ? "border-rojo/40" : "border-line")
                    }
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-lg font-semibold tabular-nums text-ink">
                        {fmtNum.format(c.valor)}{" "}
                        <span className="text-xs font-normal text-muted">{c.unidad}</span>
                      </span>
                      {c.solicitudId === id && (
                        <span className="rounded-pill bg-rojo/10 px-2 py-0.5 text-[11px] font-medium text-rojo">
                          Esta
                        </span>
                      )}
                    </div>
                    {c.solicitudId === id ? (
                      <p className="mt-0.5 truncate text-xs text-muted" title={c.titulo}>
                        {c.titulo}
                      </p>
                    ) : (
                      <Link
                        href={`/admin/solicitudes/${c.solicitudId}`}
                        className="mt-0.5 block truncate text-xs text-teal transition duration-150 hover:text-teal-dark"
                        title={c.titulo}
                      >
                        {c.titulo}
                      </Link>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      {c.capturadoPor ?? "—"} · {fmtFechaHora(c.capturadoEn)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Acción ahora: lo que requiere el revisor, con su contexto */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Acción ahora</h2>
        <p className="mt-1 text-sm text-muted">
          Revisión interna de IRStrat. Cada cambio queda en la bitácora.
        </p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">{contexto}</div>
          <div className="lg:border-l lg:border-line lg:pl-6">
            <AccionesStaff
              solicitudId={sol.id}
              estadoActual={estado}
              responsable={responsable ? limpiar(responsable.nombre) : null}
            />
          </div>
        </div>
      </section>

      {/* ===================== SECUNDARIO ===================== */}
      <div className="space-y-8 border-t border-line pt-8">
        {/* Historial completo de evidencias */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink">
            Historial completo de evidencias
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
                <li key={ev.id} className="rounded-card border border-line bg-surface p-4 shadow-soft sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className={"grid size-10 shrink-0 place-items-center rounded-lg font-display text-sm font-semibold " + (i === 0 ? "bg-teal text-crema" : "bg-teal/10 text-teal")}>
                        v{ev.version}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">{ev.nombre_original}</span>
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
                    {descargar(ev.id)}
                  </div>
                  {ev.justificacion && (
                    <div className="mt-3 border-t border-line pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gold">
                        Justificación del ajuste
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                        {ev.justificacion}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Valores capturados — cifra vigente como frase + historial colapsable */}
        {sol.es_cuantitativa && (
          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold text-ink">Valores capturados</h2>
            {caps.length === 0 ? (
              <EmptyState compacto glifo="#" titulo="Sin capturas de valor todavía." />
            ) : (
              <div className="rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6">
                <p className="text-lg text-ink">
                  <span className="font-display text-2xl font-semibold tabular-nums text-teal">
                    {fmtNum.format(capVigente.valor)} {capVigente.unidad}
                  </span>
                  {capVigente.periodo ? (
                    <span className="text-ink"> en {capVigente.periodo}</span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Capturado por {limpiar(capVigente.capturado?.nombre)}
                  {capVigente.evidencia
                    ? `, respaldado por la versión ${capVigente.evidencia.version}`
                    : ""}
                  .
                </p>
                {caps.length > 1 && (
                  <details className="group mt-4 border-t border-line pt-3">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-teal">
                      <svg aria-hidden viewBox="0 0 24 24" className="size-4 transition-transform duration-150 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                      Ver historial de capturas ({caps.length})
                    </summary>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[560px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                            <th className="px-3 py-2.5 font-medium">Valor</th>
                            <th className="px-3 py-2.5 font-medium">Unidad</th>
                            <th className="px-3 py-2.5 font-medium">Periodo</th>
                            <th className="px-3 py-2.5 font-medium">Soporte</th>
                            <th className="px-3 py-2.5 font-medium">Capturado por</th>
                            <th className="px-3 py-2.5 font-medium">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {caps.map((c) => (
                            <tr key={c.id} className="border-b border-line/70 last:border-0">
                              <td className="px-3 py-2.5">
                                <span className={"font-semibold tabular-nums " + (c.confirmado ? "text-ink" : "text-gris line-through")}>
                                  {fmtNum.format(c.valor)}
                                </span>
                                {!c.confirmado && <span className="ml-2 text-xs text-muted">(superada)</span>}
                              </td>
                              <td className="px-3 py-2.5 text-muted">{c.unidad}</td>
                              <td className="px-3 py-2.5 text-muted">{c.periodo ?? "—"}</td>
                              <td className="px-3 py-2.5 text-muted">{c.evidencia ? `v${c.evidencia.version}` : "—"}</td>
                              <td className="px-3 py-2.5 text-muted">{limpiar(c.capturado?.nombre)}</td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-muted">{fmtFechaHora(c.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            )}
          </section>
        )}

        {/* Conversación completa */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink">Conversación completa</h2>
          {coms.length === 0 ? (
            <EmptyState compacto glifo="“" titulo="Sin comentarios todavía." />
          ) : (
            <ul className="space-y-3">
              {coms.map((c) => (
                <li
                  key={c.id}
                  className={"rounded-card border p-4 " + (c.es_observacion ? "border-rojo/30 bg-rojo/5" : "border-line bg-surface shadow-soft")}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{limpiar(c.autor?.nombre)}</span>
                      {c.es_observacion && (
                        <span className="rounded-pill bg-rojo/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rojo">
                          Observación
                        </span>
                      )}
                    </div>
                    <time className="text-xs text-muted">{fmtFechaHora(c.created_at)}</time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{c.contenido}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Bitácora — colapsable (la sección más densa) */}
        <details className="group rounded-card border border-line bg-surface shadow-soft">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <span className="font-display text-lg font-semibold text-ink">Bitácora de la solicitud</span>
            <svg aria-hidden viewBox="0 0 24 24" className="size-4 text-muted transition-transform duration-150 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </summary>
          <div className="border-t border-line px-5 py-5 sm:px-6">
            <Timeline eventos={eventos} />
          </div>
        </details>

        {/* Gestión discreta (eliminar) */}
        {puedeEliminar && (
          <div className="flex justify-end">
            <EliminarSolicitud solicitudId={sol.id} titulo={sol.titulo} />
          </div>
        )}
      </div>
    </div>
  );
}
