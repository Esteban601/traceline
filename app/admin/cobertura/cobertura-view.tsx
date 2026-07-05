"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { TONO_CLASSES, ESTADO_META, type EstadoSolicitud } from "@/lib/estados";
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

type Norma = "S1" | "S2";

const NORMAS: { key: Norma; label: string }[] = [
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
const PILAR_CHIP_LABEL: Record<string, string> = {
  gobernanza: "Gobernanza",
  estrategia: "Estrategia",
  riesgos: "Riesgos",
  metricas: "Métricas",
};

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

function distribucion(items: DatapointCobertura[]): Record<Cobertura, number> {
  const base: Record<Cobertura, number> = {
    cubierto: 0,
    parcial: 0,
    sin_evidencia: 0,
    sin_solicitud: 0,
  };
  for (const d of items) base[d.cobertura] += 1;
  return base;
}

export function CoberturaView({ datapoints }: { datapoints: DatapointCobertura[] }) {
  const [norma, setNorma] = useState<Norma | "todos">("todos");
  const [pilares, setPilares] = useState<Set<string>>(new Set());
  const [soloConSolicitudes, setSoloConSolicitudes] = useState(false);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const universo = datapoints.length;

  // Universo filtrado (chips + toggle). Alimenta KPIs, resúmenes y listados.
  const visibles = useMemo(
    () =>
      datapoints.filter(
        (d) =>
          (norma === "todos" || d.norma === norma) &&
          (pilares.size === 0 || pilares.has(d.pilar)) &&
          (!soloConSolicitudes || d.solicitudes.length > 0)
      ),
    [datapoints, norma, pilares, soloConSolicitudes]
  );

  const conteo = useMemo(() => distribucion(visibles), [visibles]);

  // Grupos norma → pilar presentes en el universo filtrado.
  const grupos = useMemo(() => {
    const out: { key: string; norma: Norma; pilar: string; items: DatapointCobertura[] }[] = [];
    for (const { key: n } of NORMAS) {
      if (norma !== "todos" && norma !== n) continue;
      for (const p of PILAR_ORDEN) {
        if (pilares.size > 0 && !pilares.has(p)) continue;
        const items = visibles.filter((d) => d.norma === n && d.pilar === p);
        if (items.length > 0) out.push({ key: `${n}:${p}`, norma: n, pilar: p, items });
      }
    }
    return out;
  }, [visibles, norma, pilares]);

  const togglePilar = (p: string) =>
    setPilares((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const toggleGrupo = (key: string) =>
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const todosAbiertos = grupos.length > 0 && grupos.every((g) => abiertos.has(g.key));

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
            Estado de cada uno de los {universo} datapoints NIIF S1/S2 según la
            evidencia de sus solicitudes ligadas.
          </p>
        </div>
        <ExportButton />
      </header>

      {/* KPIs editoriales — reflejan el universo filtrado */}
      <section
        aria-label="Resumen de cobertura"
        className="grid grid-cols-2 gap-4 lg:grid-cols-5"
      >
        <KpiTotal total={visibles.length} universo={universo} />
        {COBERTURA_ORDEN.map((c) => (
          <KpiCobertura
            key={c}
            cobertura={c}
            valor={conteo[c]}
            porcentaje={pct(conteo[c], visibles.length)}
          />
        ))}
      </section>

      {/* Barra de filtros */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {/* Norma */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Norma
            </span>
            <div className="inline-flex rounded-pill border border-line bg-surface p-0.5 text-sm">
              {(["todos", "S1", "S2"] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setNorma(n)}
                  aria-pressed={norma === n}
                  className={cn(
                    "whitespace-nowrap rounded-pill px-3.5 py-1.5 font-medium transition duration-150",
                    norma === n ? "bg-teal text-crema shadow-soft" : "text-muted hover:text-ink"
                  )}
                >
                  {n === "todos" ? "Todas" : n}
                </button>
              ))}
            </div>
          </div>

          {/* Pilar (multi-selección; vacío = todos) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Pilar
            </span>
            {PILAR_ORDEN.map((p) => {
              const activo = pilares.has(p);
              return (
                <button
                  key={p}
                  onClick={() => togglePilar(p)}
                  aria-pressed={activo}
                  className={cn(
                    "whitespace-nowrap rounded-pill border px-3 py-1 text-sm font-medium transition duration-150",
                    activo
                      ? "border-teal bg-teal/10 text-teal"
                      : "border-line bg-surface text-muted hover:border-teal/30 hover:text-ink"
                  )}
                >
                  {PILAR_CHIP_LABEL[p]}
                </button>
              );
            })}
            {pilares.size > 0 && (
              <button
                onClick={() => setPilares(new Set())}
                className="whitespace-nowrap rounded-pill px-2.5 py-1 text-sm font-medium text-muted transition duration-150 hover:text-ink"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filtrar por solicitudes"
            className="inline-flex rounded-pill border border-line bg-surface p-0.5 text-sm"
          >
            <button
              role="tab"
              aria-selected={!soloConSolicitudes}
              onClick={() => setSoloConSolicitudes(false)}
              className={cn(
                "whitespace-nowrap rounded-pill px-3.5 py-1.5 font-medium transition duration-150",
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
                "whitespace-nowrap rounded-pill px-3.5 py-1.5 font-medium transition duration-150",
                soloConSolicitudes ? "bg-teal text-crema shadow-soft" : "text-muted hover:text-ink"
              )}
            >
              Solo con solicitudes
            </button>
          </div>

          <div className="flex items-center gap-3">
            {grupos.length > 0 && (
              <button
                onClick={() =>
                  setAbiertos(todosAbiertos ? new Set() : new Set(grupos.map((g) => g.key)))
                }
                className="whitespace-nowrap text-sm font-medium text-teal transition duration-150 hover:text-teal-dark"
              >
                {todosAbiertos ? "Colapsar todo" : "Expandir todo"}
              </button>
            )}
            <span className="whitespace-nowrap text-sm text-muted">
              {visibles.length} de {universo}
            </span>
          </div>
        </div>
      </div>

      {/* Grupos colapsables */}
      {grupos.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface/60 px-6 py-16 text-center">
          <p className="font-display text-lg font-medium text-ink">Sin datapoints</p>
          <p className="mt-1 text-sm text-muted">
            Ningún datapoint cumple los filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => (
            <GrupoCobertura
              key={g.key}
              norma={g.norma}
              pilar={g.pilar}
              items={g.items}
              abierto={abiertos.has(g.key)}
              onToggle={() => toggleGrupo(g.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiTotal({ total, universo }: { total: number; universo: number }) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface p-5 shadow-soft">
      <span className="absolute inset-x-0 top-0 h-1 bg-teal" aria-hidden />
      <div className="font-display text-4xl font-semibold tabular-nums text-teal">{total}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
        Datapoints{total !== universo ? ` · de ${universo}` : ""}
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

/** Mini-conteo por color de cobertura (solo los presentes), para el encabezado. */
function MiniConteo({ items }: { items: DatapointCobertura[] }) {
  const dist = distribucion(items);
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {COBERTURA_ORDEN.filter((c) => dist[c] > 0).map((c) => {
        const meta = COBERTURA_META[c];
        const cc = TONO_CLASSES[meta.tono];
        return (
          <span key={c} className="inline-flex items-center gap-1 text-xs text-muted">
            <span className={cn("size-2 rounded-full", cc.dot)} aria-hidden />
            <span className="tabular-nums text-ink/80">{dist[c]}</span>
            <span className="hidden sm:inline">{meta.label.toLowerCase()}</span>
          </span>
        );
      })}
    </span>
  );
}

function GrupoCobertura({
  norma,
  pilar,
  items,
  abierto,
  onToggle,
}: {
  norma: Norma;
  pilar: string;
  items: DatapointCobertura[];
  abierto: boolean;
  onToggle: () => void;
}) {
  const grupoId = `grupo-${norma}-${pilar}`;
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-controls={grupoId}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition duration-150 hover:bg-teal/[0.03] sm:px-5"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={cn(
            "size-4 shrink-0 text-muted transition-transform duration-150",
            abierto && "rotate-90"
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-display text-base font-semibold text-ink">
              {norma} · {PILAR_LABEL[pilar] ?? pilar}
            </span>
            <span className="text-sm text-muted">
              {items.length} {items.length === 1 ? "datapoint" : "datapoints"}
            </span>
          </div>
          <div className="mt-1">
            <MiniConteo items={items} />
          </div>
        </div>
      </button>

      {abierto && (
        <ul id={grupoId} className="space-y-2 border-t border-line/70 p-4 sm:p-5">
          {items.map((d) => (
            <DatapointCard key={d.id} d={d} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DatapointCard({ d }: { d: DatapointCobertura }) {
  const [abierto, setAbierto] = useState(false);
  const meta = COBERTURA_META[d.cobertura];
  const c = TONO_CLASSES[meta.tono];

  return (
    <li className="rounded-xl border border-line bg-crema/30 p-4 transition duration-150 hover:bg-crema/50">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-teal/5 px-1.5 py-0.5 font-mono text-xs font-medium text-teal">
              {d.codigo}
            </code>
            {d.ods && (
              <span
                title={`ODS: ${d.ods}`}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill border border-gold/25 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold"
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
            "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 py-0.5 text-xs font-medium",
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
            const sc = TONO_CLASSES[ESTADO_META[s.estado].tono];
            return (
              <Link
                key={s.id}
                href={`/admin/solicitudes/${s.id}`}
                className="inline-flex max-w-[240px] items-center gap-1.5 rounded-pill border border-line bg-surface px-2.5 py-0.5 text-xs text-ink transition duration-150 hover:border-teal/40 hover:text-teal"
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
