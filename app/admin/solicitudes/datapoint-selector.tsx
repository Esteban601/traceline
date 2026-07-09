"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

export type DatapointOpcion = {
  id: string;
  codigo: string;
  descripcion: string;
  norma: string;
};

/**
 * Selector múltiple buscable de datapoints de la taxonomía (por código y
 * descripción). Controlado: el padre mantiene el arreglo de ids seleccionados.
 * Muestra los seleccionados como chips removibles y una lista filtrable con
 * checkboxes.
 */
export function DatapointSelector({
  todos,
  seleccionados,
  onChange,
}: {
  todos: DatapointOpcion[];
  seleccionados: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");

  const porId = useMemo(() => new Map(todos.map((d) => [d.id, d])), [todos]);
  const sel = useMemo(() => new Set(seleccionados), [seleccionados]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t
      ? todos.filter(
          (d) =>
            d.codigo.toLowerCase().includes(t) ||
            d.descripcion.toLowerCase().includes(t)
        )
      : todos;
    // Los seleccionados primero, luego por código.
    return [...base].sort((a, b) => {
      const sa = sel.has(a.id) ? 0 : 1;
      const sb = sel.has(b.id) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.codigo.localeCompare(b.codigo, "es");
    });
  }, [todos, q, sel]);

  const toggle = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div className="space-y-3">
      {/* Chips de seleccionados */}
      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {seleccionados.map((id) => {
            const d = porId.get(id);
            if (!d) return null;
            return (
              <span
                key={id}
                title={d.descripcion}
                className="inline-flex items-center gap-1.5 rounded-pill border border-teal/20 bg-teal/5 py-0.5 pl-2.5 pr-1 text-xs font-medium text-teal"
              >
                {d.codigo}
                <button
                  type="button"
                  aria-label={`Quitar ${d.codigo}`}
                  onClick={() => toggle(id)}
                  className="grid size-4 place-items-center rounded-full text-teal/70 transition duration-150 hover:bg-teal/15 hover:text-teal"
                >
                  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      )}

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por código o descripción…"
        className="h-11 w-full rounded-xl border border-line bg-crema/40 px-3.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted/70 focus:border-teal/50 focus:bg-surface"
      />

      <div className="max-h-64 overflow-y-auto rounded-xl border border-line bg-surface">
        {filtrados.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-sm text-muted">
            Sin datapoints que coincidan con “{q}”.
          </p>
        ) : (
          <ul className="divide-y divide-line/60">
            {filtrados.map((d) => {
              const activo = sel.has(d.id);
              return (
                <li key={d.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 px-3.5 py-2.5 transition duration-150 hover:bg-teal/[0.03]",
                      activo && "bg-teal/[0.04]"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={activo}
                      onChange={() => toggle(d.id)}
                      className="mt-0.5 size-4 shrink-0 accent-teal"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-ink">{d.codigo}</span>
                        <span className="rounded-pill bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                          {d.norma}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted">
                        {d.descripcion}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted">
        {seleccionados.length}{" "}
        {seleccionados.length === 1 ? "datapoint ligado" : "datapoints ligados"} ·{" "}
        {todos.length} en el catálogo
      </p>
    </div>
  );
}
