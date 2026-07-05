"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EstadoBadge } from "@/components/ui/badge";
import { ESTADO_META, type EstadoSolicitud } from "@/lib/estados";
import { cn } from "@/lib/cn";

export type SolicitudResumen = {
  id: string;
  titulo: string;
  area_asignada: string | null;
  estado: EstadoSolicitud;
  fecha_limite: string | null;
  es_cuantitativa: boolean;
  unidad_esperada: string | null;
  orden: number;
  responsable_cliente_id: string | null;
};

const fmtFecha = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function ordenar(a: SolicitudResumen, b: SolicitudResumen) {
  const ra = ESTADO_META[a.estado].rank;
  const rb = ESTADO_META[b.estado].rank;
  if (ra !== rb) return ra - rb;
  return a.orden - b.orden;
}

export function ListaSolicitudes({
  solicitudes,
  canToggle,
  area,
  userId,
}: {
  solicitudes: SolicitudResumen[];
  canToggle: boolean;
  area: string | null;
  userId: string;
}) {
  const [soloMias, setSoloMias] = useState(false);

  const visibles = useMemo(() => {
    const base = canToggle && soloMias
      ? solicitudes.filter(
          (s) =>
            (area != null && s.area_asignada === area) ||
            s.responsable_cliente_id === userId
        )
      : solicitudes;
    return [...base].sort(ordenar);
  }, [solicitudes, canToggle, soloMias, area, userId]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          Solicitudes
          <span className="ml-2 text-sm font-normal text-muted">
            {visibles.length}
          </span>
        </h2>

        {canToggle && (
          <div
            role="tablist"
            aria-label="Filtrar solicitudes"
            className="inline-flex rounded-pill border border-line bg-surface p-0.5 text-sm"
          >
            <button
              role="tab"
              aria-selected={!soloMias}
              onClick={() => setSoloMias(false)}
              className={cn(
                "whitespace-nowrap rounded-pill px-3.5 py-1.5 font-medium transition duration-150",
                !soloMias ? "bg-teal text-crema shadow-soft" : "text-muted hover:text-ink"
              )}
            >
              Todas
            </button>
            <button
              role="tab"
              aria-selected={soloMias}
              onClick={() => setSoloMias(true)}
              className={cn(
                "whitespace-nowrap rounded-pill px-3.5 py-1.5 font-medium transition duration-150",
                soloMias ? "bg-teal text-crema shadow-soft" : "text-muted hover:text-ink"
              )}
            >
              Mis solicitudes
            </button>
          </div>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface/60 px-6 py-16 text-center">
          <p className="font-display text-lg font-medium text-ink">
            Sin solicitudes por ahora
          </p>
          <p className="mt-1 text-sm text-muted">
            {canToggle && soloMias
              ? "No tienes solicitudes asignadas directamente. Cambia a “Todas”."
              : "Cuando IRStrat te solicite información, aparecerá aquí."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visibles.map((s) => (
            <li key={s.id}>
              <Link
                href={`/portal/solicitudes/${s.id}`}
                className="group flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-soft transition duration-150 ease-out hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-card sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium text-ink transition duration-150 group-hover:text-teal">
                      {s.titulo}
                    </h3>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {s.area_asignada && (
                      <span className="inline-flex items-center gap-1">
                        <span className="size-1 rounded-full bg-muted/50" aria-hidden />
                        {s.area_asignada}
                      </span>
                    )}
                    {s.es_cuantitativa && (
                      <span className="inline-flex items-center gap-1 font-medium text-gold">
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="size-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" />
                        </svg>
                        {s.unidad_esperada ?? "Cuantitativa"}
                      </span>
                    )}
                    {s.fecha_limite && (
                      <span className="inline-flex items-center gap-1">
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="size-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        >
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        Límite {fmtFecha.format(new Date(`${s.fecha_limite}T00:00:00`))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <EstadoBadge estado={s.estado} />
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="size-4 text-muted/50 transition duration-150 group-hover:translate-x-0.5 group-hover:text-teal"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
