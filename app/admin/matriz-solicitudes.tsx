"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EstadoBadge } from "@/components/ui/badge";
import { ESTADO_META, type EstadoSolicitud } from "@/lib/estados";
import { cn } from "@/lib/cn";

export type FilaMatriz = {
  id: string;
  titulo: string;
  area: string | null;
  estado: EstadoSolicitud;
  orden: number;
  responsable: string | null;
  numVersiones: number;
  ultimaActividad: string;
};

const fmt = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Prioridad de orden por defecto: observaciones y recibidas primero, luego
 * pendientes, luego validadas. Dentro del grupo, actividad más reciente arriba.
 */
function grupoPrioridad(estado: EstadoSolicitud): number {
  switch (estado) {
    case "observaciones":
      return 0;
    case "recibido":
    case "en_revision":
      return 1;
    case "pendiente":
    case "solicitado":
      return 2;
    default:
      return 3; // validado, congelado
  }
}

const ESTADOS_ORDEN: EstadoSolicitud[] = [
  "observaciones",
  "recibido",
  "en_revision",
  "pendiente",
  "solicitado",
  "validado",
  "congelado",
];

export function MatrizSolicitudes({ filas }: { filas: FilaMatriz[] }) {
  const [fEstado, setFEstado] = useState<EstadoSolicitud | "todos">("todos");
  const [fArea, setFArea] = useState<string>("todos");

  const areas = useMemo(
    () =>
      Array.from(new Set(filas.map((f) => f.area).filter((a): a is string => !!a))).sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [filas]
  );

  const estadosPresentes = useMemo(
    () => ESTADOS_ORDEN.filter((e) => filas.some((f) => f.estado === e)),
    [filas]
  );

  const visibles = useMemo(() => {
    const base = filas.filter(
      (f) =>
        (fEstado === "todos" || f.estado === fEstado) &&
        (fArea === "todos" || f.area === fArea)
    );
    return [...base].sort((a, b) => {
      const ga = grupoPrioridad(a.estado);
      const gb = grupoPrioridad(b.estado);
      if (ga !== gb) return ga - gb;
      if (a.ultimaActividad !== b.ultimaActividad)
        return a.ultimaActividad > b.ultimaActividad ? -1 : 1;
      return a.orden - b.orden;
    });
  }, [filas, fEstado, fArea]);

  const selectCls =
    "h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition duration-150 focus:border-teal/50";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          Solicitudes
          <span className="ml-2 text-sm font-normal text-muted">{visibles.length}</span>
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="f-estado">
            Filtrar por estado
          </label>
          <select
            id="f-estado"
            value={fEstado}
            onChange={(e) => setFEstado(e.target.value as EstadoSolicitud | "todos")}
            className={selectCls}
          >
            <option value="todos">Todos los estados</option>
            {estadosPresentes.map((e) => (
              <option key={e} value={e}>
                {ESTADO_META[e].label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="f-area">
            Filtrar por área
          </label>
          <select
            id="f-area"
            value={fArea}
            onChange={(e) => setFArea(e.target.value)}
            className={selectCls}
          >
            <option value="todos">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          {(fEstado !== "todos" || fArea !== "todos") && (
            <button
              onClick={() => {
                setFEstado("todos");
                setFArea("todos");
              }}
              className="h-9 rounded-lg px-3 text-sm font-medium text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface/60 px-6 py-16 text-center">
          <p className="font-display text-lg font-medium text-ink">Sin coincidencias</p>
          <p className="mt-1 text-sm text-muted">
            Ninguna solicitud cumple los filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
          {/* Tabla en pantallas medianas+ */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Solicitud</th>
                  <th className="px-4 py-3 font-medium">Área</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Responsable</th>
                  <th className="px-4 py-3 text-center font-medium">Versiones</th>
                  <th className="px-4 py-3 font-medium">Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr
                    key={f.id}
                    className="group border-b border-line/70 transition duration-150 last:border-0 hover:bg-teal/[0.03]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/solicitudes/${f.id}`}
                        className="font-medium text-ink transition duration-150 group-hover:text-teal"
                      >
                        {f.titulo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{f.area ?? "—"}</td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={f.estado} />
                    </td>
                    <td className="px-4 py-3 text-muted">{f.responsable ?? "—"}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-ink">
                      {f.numVersiones > 0 ? (
                        f.numVersiones
                      ) : (
                        <span className="text-muted/60">0</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {fmt.format(new Date(f.ultimaActividad))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas apiladas en móvil */}
          <ul className="divide-y divide-line/70 sm:hidden">
            {visibles.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/admin/solicitudes/${f.id}`}
                  className="block px-4 py-3.5 transition duration-150 hover:bg-teal/[0.03]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-ink">{f.titulo}</span>
                    <EstadoBadge estado={f.estado} className="shrink-0" />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                    {f.area && <span>{f.area}</span>}
                    <span>{f.responsable ?? "Sin responsable"}</span>
                    <span
                      className={cn(f.numVersiones === 0 && "text-muted/60")}
                    >
                      {f.numVersiones} {f.numVersiones === 1 ? "versión" : "versiones"}
                    </span>
                    <span>{fmt.format(new Date(f.ultimaActividad))}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
