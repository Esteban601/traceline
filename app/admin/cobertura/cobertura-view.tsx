"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { TONO_CLASSES, type EstadoSolicitud } from "@/lib/estados";
import { COBERTURA_META, COBERTURA_ORDEN, type Cobertura } from "@/lib/cobertura";
import { ExportButton } from "./export-button";

export type DatapointCobertura = {
  id: string;
  codigo: string;
  norma: "S1" | "S2";
  pilar: string;
  seccionIndice: string | null;
  descripcion: string;
  ods: string | null;
  cobertura: Cobertura;
  solicitudes: { id: string; titulo: string; estado: EstadoSolicitud }[];
};

const NORMAS: { key: "S1" | "S2"; label: string }[] = [
  { key: "S1", label: "NIIF S1 · Requisitos generales" },
  { key: "S2", label: "NIIF S2 · Clima" },
];

const PILAR_ORDEN = ["gobernanza", "estrategia", "riesgos", "metricas"];
const PILAR_LABEL: Record<string, string> = {
  gobernanza: "Gobernanza",
  estrategia: "Estrategia",
  riesgos: "Gestión de riesgos",
  metricas: "Métricas y objetivos",
};

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

export function CoberturaView({ datapoints }: { datapoints: DatapointCobertura[] }) {
  const [soloConSolicitudes, setSoloConSolicitudes] = useState(false);

  const total = datapoints.length;
  const conteo = useMemo(() => {
    const base: Record<Cobertura, number> = {
      cubierto: 0,
      parcial: 0,
      sin_evidencia: 0,
      sin_solicitud: 0,
    };
    for (const d of datapoints) base[d.cobertura] += 1;
    return base;
  }, [datapoints]);

  const visibles = useMemo(
    () =>
      soloConSolicitudes
        ? datapoints.filter((d) => d.solicitudes.length > 0)
        : datapoints,
    [datapoints, soloConSolicitudes]
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
            Panel interno IRStrat · Trazabilidad
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
            Cobertura de la taxonomía
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Estado de cada uno de los {total} datapoints NIIF S1/S2 según la
            evidencia de sus solicitudes ligadas.
          </p>
        </div>
        <ExportButton />
      </header>

      {/* KPIs editoriales */}
      <section
        aria-label="Resumen de cobertura"
        className="grid grid-cols-2 gap-4 lg:grid-cols-5"
      >
        <KpiTotal total={total} />
        {COBERTURA_ORDEN.map((c) => (
          <KpiCobertura
            key={c}
            cobertura={c}
            valor={conteo[c]}
            porcentaje={pct(conteo[c], total)}
          />
        ))}
      </section>

      {/* Filtro rápido */}
      <div className="flex items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filtrar datapoints"
          className="inline-flex rounded-pill border border-line bg-surface p-0.5 text-sm"
        >
          <button
            role="tab"
            aria-selected={!soloConSolicitudes}
            onClick={() => setSoloConSolicitudes(false)}
            className={cn(
              "rounded-pill px-3.5 py-1.5 font-medium transition duration-150",
              !soloConSolicitudes ? "bg-teal text-crema shadow-soft" : "text-muted hover:text-ink"
            )}
          >
            Todos
          </button>
          <button
            role="tab"
            aria-selected={soloConSolicitudes}
            onClick={() => setSoloConSolicitudes(true)}
            className={cn(
              "rounded-pill px-3.5 py-1.5 font-medium transition duration-150",
              soloConSolicitudes ? "bg-teal text-crema shadow-soft" : "text-muted hover:text-ink"
            )}
          >
            Solo con solicitudes
          </button>
        </div>
        <span className="text-sm text-muted">
          {visibles.length} de {total}
        </span>
      </div>

      {/* Agrupación por norma / pilar */}
      <div className="space-y-12">
        {NORMAS.map(({ key, label }) => {
          const deNorma = visibles.filter((d) => d.norma === key);
          if (deNorma.length === 0) return null;
          return (
            <section key={key} className="space-y-6">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-xl font-semibold text-ink">{label}</h2>
                <span className="text-sm text-muted">{deNorma.length}</span>
              </div>

              {PILAR_ORDEN.map((pilar) => {
                const dePilar = deNorma.filter((d) => d.pilar === pilar);
                if (dePilar.length === 0) return null;
                return (
                  <div key={pilar} className="space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      {PILAR_LABEL[pilar] ?? pilar}
                      <span className="ml-2 font-normal normal-case tracking-normal text-muted/70">
                        {dePilar.length}
                      </span>
                    </h3>
                    <ul className="space-y-2">
                      {dePilar.map((d) => (
                        <DatapointCard key={d.id} d={d} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function KpiTotal({ total }: { total: number }) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface p-5 shadow-soft">
      <span className="absolute inset-x-0 top-0 h-1 bg-teal" aria-hidden />
      <div className="font-display text-4xl font-semibold tabular-nums text-teal">
        {total}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
        Datapoints
      </div>
    </div>
  );
}

function KpiCobertura({
  cobertura,
  valor,
  porcentaje,
}: {
  cobertura: Cobertura;
  valor: number;
  porcentaje: number;
}) {
  const meta = COBERTURA_META[cobertura];
  const c = TONO_CLASSES[meta.tono];
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface p-5 shadow-soft transition duration-150 ease-out hover:shadow-card">
      <span className={cn("absolute inset-x-0 top-0 h-1", c.dot)} aria-hidden />
      <div className={cn("font-display text-4xl font-semibold tabular-nums", c.text)}>
        {porcentaje}
        <span className="text-2xl">%</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        <span className={cn("size-1.5 rounded-full", c.dot)} aria-hidden />
        {meta.label}
        <span className="text-muted/60">· {valor}</span>
      </div>
    </div>
  );
}

function DatapointCard({ d }: { d: DatapointCobertura }) {
  const [abierto, setAbierto] = useState(false);
  const meta = COBERTURA_META[d.cobertura];
  const c = TONO_CLASSES[meta.tono];

  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-soft transition duration-150 hover:shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-teal/5 px-1.5 py-0.5 font-mono text-xs font-medium text-teal">
              {d.codigo}
            </code>
            {d.ods && (
              <span
                title={`ODS: ${d.ods}`}
                className="inline-flex items-center gap-1 rounded-pill border border-gold/25 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold"
              >
                <span className="size-1.5 rounded-full bg-gold" aria-hidden />
                ODS
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="mt-1.5 block w-full text-left"
            aria-expanded={abierto}
          >
            <p
              className={cn(
                "text-sm leading-relaxed text-ink/90 transition",
                !abierto && "line-clamp-2"
              )}
              title={d.descripcion}
            >
              {d.descripcion}
            </p>
            {d.seccionIndice && (
              <span className="mt-1 block text-xs text-muted">{d.seccionIndice}</span>
            )}
          </button>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs font-medium",
            c.text,
            c.bg,
            c.border
          )}
        >
          <span className={cn("size-1.5 rounded-full", c.dot)} aria-hidden />
          {meta.label}
        </span>
      </div>

      {d.solicitudes.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/70 pt-3">
          <span className="text-xs text-muted">
            {d.solicitudes.length}{" "}
            {d.solicitudes.length === 1 ? "solicitud ligada" : "solicitudes ligadas"}:
          </span>
          {d.solicitudes.map((s) => {
            const sc = TONO_CLASSES[
              (
                {
                  observaciones: "rojo",
                  pendiente: "ambar",
                  solicitado: "ambar",
                  recibido: "azul",
                  en_revision: "azul",
                  validado: "verde",
                  congelado: "gris",
                } as const
              )[s.estado]
            ];
            return (
              <Link
                key={s.id}
                href={`/admin/solicitudes/${s.id}`}
                className="inline-flex max-w-[240px] items-center gap-1.5 rounded-pill border border-line bg-crema/40 px-2.5 py-0.5 text-xs text-ink transition duration-150 hover:border-teal/40 hover:text-teal"
                title={s.titulo}
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", sc.dot)} aria-hidden />
                <span className="truncate">{s.titulo}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 border-t border-line/70 pt-3 text-xs text-muted">
          Sin solicitudes ligadas — alcance aún no solicitado.
        </p>
      )}
    </li>
  );
}
