"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/empty-state";
import { TONO_CLASSES, ESTADO_META, type EstadoSolicitud } from "@/lib/estados";
import { COBERTURA_META, COBERTURA_ORDEN, type Cobertura } from "@/lib/cobertura";
import { ExportButton } from "./export-button";
import { TaxonomiaExportButton } from "./taxonomia-export-button";

export type DatapointCobertura = {
  id: string;
  codigo: string;
  norma: "S1" | "S2";
  pilar: string;
  seccionIndice: string | null;
  descripcion: string;
  ods: string | null;
  cobertura: Cobertura;
  discrepancia: boolean;
  solicitudes: { id: string; titulo: string; estado: EstadoSolicitud }[];
};

function AlertaDiscrepancia({ className }: { className?: string }) {
  return (
    <span
      title="Discrepancia entre áreas: valores distintos para el mismo datapoint"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border border-rojo/25 bg-rojo/10 px-2 py-0.5 text-[11px] font-medium text-rojo",
        className
      )}
    >
      <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
      Discrepancia
    </span>
  );
}

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

  // Anillos por pilar sobre el UNIVERSO completo (overview estable, no filtrado).
  const anillos = useMemo(
    () =>
      PILAR_ORDEN.map((p) => {
        const items = datapoints.filter((d) => d.pilar === p);
        return {
          key: p,
          label: PILAR_CHIP_LABEL[p],
          cubierto: items.filter((d) => d.cobertura === "cubierto").length,
          total: items.length,
        };
      }),
    [datapoints]
  );
  const totalCubierto = anillos.reduce((s, a) => s + a.cubierto, 0);

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
        <div className="flex flex-wrap items-center gap-2.5">
          <TaxonomiaExportButton />
          <ExportButton />
        </div>
      </header>

      {/* Anillos de avance por pilar (overview del universo completo) */}
      <AnillosCobertura anillos={anillos} totalCubierto={totalCubierto} universo={universo} />

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
        <EmptyState
          glifo="⁝"
          titulo="Sin datapoints"
          descripcion="Ningún datapoint cumple los filtros seleccionados."
        />
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

/** ¿El usuario pidió reducir movimiento? Gobierna la animación de trazo. */
function usePrefiereMenosMovimiento(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

/** Anillo de progreso SVG (trazo fino, editorial). Anima el trazo al montar. */
function Anillo({ cubierto, total, label }: { cubierto: number; total: number; label: string }) {
  const porcentaje = total === 0 ? 0 : Math.round((cubierto / total) * 100);
  const r = 26;
  const C = 2 * Math.PI * r;
  const objetivo = C * (1 - porcentaje / 100);
  const reduce = usePrefiereMenosMovimiento();
  const [offset, setOffset] = useState(C); // arranca vacío
  useEffect(() => {
    if (reduce) {
      setOffset(objetivo);
      return;
    }
    const id = requestAnimationFrame(() => setOffset(objetivo));
    return () => cancelAnimationFrame(id);
  }, [objetivo, reduce]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative size-16">
        <svg viewBox="0 0 64 64" className="size-16" role="img" aria-label={`${label}: ${porcentaje}% cubierto`}>
          <g transform="rotate(-90 32 32)">
            <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" style={{ stroke: "var(--color-line)" }} />
            <circle
              cx="32"
              cy="32"
              r={r}
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
              style={{
                stroke: "var(--color-teal)",
                transition: reduce ? undefined : "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </g>
        </svg>
        <span className="absolute inset-0 grid place-items-center font-display text-sm font-semibold tabular-nums text-ink">
          {porcentaje}%
        </span>
      </div>
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="text-[11px] tabular-nums text-muted/70">
        {cubierto}/{total}
      </span>
    </div>
  );
}

function AnillosCobertura({
  anillos,
  totalCubierto,
  universo,
}: {
  anillos: { key: string; label: string; cubierto: number; total: number }[];
  totalCubierto: number;
  universo: number;
}) {
  return (
    <section
      aria-label="Avance de cobertura por pilar"
      className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 rounded-card border border-line bg-surface px-5 py-5 shadow-soft sm:px-6"
    >
      <div className="flex flex-wrap items-center gap-6 sm:gap-8">
        {anillos.map((a) => (
          <Anillo key={a.key} cubierto={a.cubierto} total={a.total} label={a.label} />
        ))}
      </div>
      <div className="min-w-[9rem]">
        <div className="font-display text-3xl font-semibold tabular-nums text-teal">
          {totalCubierto}
          <span className="text-lg text-muted"> / {universo}</span>
        </div>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted">
          Datapoints cubiertos
        </p>
      </div>
    </section>
  );
}

/** Mini-barra apilada de la proporción de cobertura del grupo (escaneo sin abrir). */
function MiniBarra({ items }: { items: DatapointCobertura[] }) {
  const dist = distribucion(items);
  const total = items.length || 1;
  return (
    <span
      className="flex h-1.5 w-24 overflow-hidden rounded-full bg-line/50 sm:w-36"
      aria-hidden
    >
      {COBERTURA_ORDEN.filter((c) => dist[c] > 0).map((c) => (
        <span
          key={c}
          className={TONO_CLASSES[COBERTURA_META[c].tono].dot}
          style={{ width: `${(dist[c] / total) * 100}%` }}
        />
      ))}
    </span>
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
  const nDisc = items.filter((d) => d.discrepancia).length;
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
            {nDisc > 0 && (
              <AlertaDiscrepancia className="ml-0.5" />
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <MiniBarra items={items} />
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
            <code className="rounded-md bg-teal/10 px-2 py-0.5 font-mono text-sm font-semibold text-teal">
              {d.codigo}
            </code>
            {d.discrepancia && <AlertaDiscrepancia />}
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
                "text-sm leading-relaxed text-muted transition",
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
