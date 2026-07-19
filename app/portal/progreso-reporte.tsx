// =============================================================================
// Barra de avance del reporte (Sprint UX #10) — "Has completado X de Y".
// SVG propio, estilo editorial, sin librerías. Presentación pura (server).
// Colores por variables de la paleta existente (sin ampliarla).
// =============================================================================

export function ProgresoReporte({
  completadas,
  total,
}: {
  completadas: number;
  total: number;
}) {
  if (total === 0) return null;

  const pct = Math.round((completadas / total) * 100);
  // Geometría de la línea (viewBox 0..100). Cap redondeado a 1.5 de margen.
  const x0 = 1.5;
  const x1 = 98.5;
  const fin = x0 + ((x1 - x0) * completadas) / total;

  return (
    <section
      aria-label="Avance del reporte"
      className="rounded-card border border-line bg-surface px-5 py-4 shadow-soft sm:px-6 sm:py-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink">
          Has completado{" "}
          <span className="font-display font-semibold text-teal">{completadas}</span> de{" "}
          <span className="font-display font-semibold text-ink">{total}</span> solicitudes
        </p>
        <span className="font-display text-sm font-semibold tabular-nums text-muted">
          {pct}%
        </span>
      </div>

      <svg
        viewBox="0 0 100 3"
        preserveAspectRatio="none"
        className="mt-3 h-2 w-full"
        role="img"
        aria-label={`${completadas} de ${total} solicitudes completadas (${pct}%)`}
      >
        <line
          x1={x0}
          y1="1.5"
          x2={x1}
          y2="1.5"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ stroke: "var(--color-line)" }}
        />
        {completadas > 0 && (
          <line
            x1={x0}
            y1="1.5"
            x2={fin}
            y2="1.5"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ stroke: "var(--color-teal)" }}
          />
        )}
      </svg>
    </section>
  );
}
