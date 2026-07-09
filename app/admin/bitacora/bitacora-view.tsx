"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/empty-state";
import { TONO_CLASSES } from "@/lib/estados";
import { fmtFechaHora } from "@/lib/fechas";
import { accionMeta, resumenBitacora, ENTIDADES } from "@/lib/bitacora-vista";

export type BitacoraFila = {
  id: string;
  createdAt: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  detalle: Record<string, unknown> | null;
  tenantId: string | null;
  tenantNombre: string | null;
  usuario: string | null;
};
export type TenantOpc = { id: string; nombre: string };

function limpiar(v: string | null): string {
  return (v ?? "").replace(/\[DEMO\]\s*/i, "").trim();
}

const ENTIDAD_LABEL = new Map(ENTIDADES.map((e) => [e.value, e.label]));

const selectCls =
  "h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition duration-150 focus:border-teal/50";

export function BitacoraView({
  filas,
  tenants,
}: {
  filas: BitacoraFila[];
  tenants: TenantOpc[];
}) {
  const [tenant, setTenant] = useState<string>("todos");
  const [entidad, setEntidad] = useState<string>("todos");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  const visibles = useMemo(() => {
    // 'hasta' es inclusivo (hasta el final del día).
    const hastaTs = hasta ? new Date(`${hasta}T23:59:59`).getTime() : null;
    const desdeTs = desde ? new Date(`${desde}T00:00:00`).getTime() : null;
    return filas.filter((f) => {
      if (tenant === "todos") {
        /* todos */
      } else if (tenant === "firma") {
        if (f.tenantId !== null) return false;
      } else if (f.tenantId !== tenant) return false;

      if (entidad !== "todos" && f.entidad !== entidad) return false;

      const ts = new Date(f.createdAt).getTime();
      if (desdeTs != null && ts < desdeTs) return false;
      if (hastaTs != null && ts > hastaTs) return false;
      return true;
    });
  }, [filas, tenant, entidad, desde, hasta]);

  const limpiarFiltros = () => {
    setTenant("todos");
    setEntidad("todos");
    setDesde("");
    setHasta("");
  };
  const hayFiltro =
    tenant !== "todos" || entidad !== "todos" || desde !== "" || hasta !== "";

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-card border border-line bg-surface p-4 shadow-soft">
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
          Cliente
          <select value={tenant} onChange={(e) => setTenant(e.target.value)} className={selectCls}>
            <option value="todos">Todos</option>
            <option value="firma">IRStrat (firma)</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {limpiar(t.nombre)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
          Entidad
          <select value={entidad} onChange={(e) => setEntidad(e.target.value)} className={selectCls}>
            <option value="todos">Todas</option>
            {ENTIDADES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={selectCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted">
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={selectCls} />
        </label>
        {hayFiltro && (
          <button
            onClick={limpiarFiltros}
            className="h-9 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
          >
            Limpiar
          </button>
        )}
        <span className="ml-auto self-center text-sm text-muted">
          {visibles.length} {visibles.length === 1 ? "evento" : "eventos"}
        </span>
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          glifo="⁝"
          titulo="Sin eventos"
          descripcion="Ningún registro cumple los filtros seleccionados."
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
          <ul className="divide-y divide-line/70">
            {visibles.map((f) => {
              const meta = accionMeta(f.accion);
              const c = TONO_CLASSES[meta.tono];
              const resumen = resumenBitacora(f.accion, f.detalle);
              return (
                <li key={f.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", c.dot)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-ink">{meta.label}</span>
                      {resumen && <span className="text-sm text-muted">· {resumen}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                      <span className="rounded bg-ink/5 px-1.5 py-0.5">
                        {ENTIDAD_LABEL.get(f.entidad) ?? f.entidad}
                      </span>
                      <span>{f.usuario ? limpiar(f.usuario) : "Sistema"}</span>
                      <span>{f.tenantNombre ? limpiar(f.tenantNombre) : "IRStrat"}</span>
                    </div>
                  </div>
                  <time
                    className="shrink-0 whitespace-nowrap text-xs text-muted"
                    dateTime={f.createdAt}
                  >
                    {fmtFechaHora(f.createdAt)}
                  </time>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
