import { cn } from "@/lib/cn";

// =============================================================================
// Estado vacío editorial: una marca tipográfica sobria (glifo o inicial) sobre
// un fondo punteado, con título y descripción. No una tabla vacía silenciosa.
// =============================================================================

export function EmptyState({
  glifo = "—",
  titulo,
  descripcion,
  children,
  className,
  compacto = false,
}: {
  /** Marca tipográfica (un carácter sobrio: —, ·, ✓, ↑…). */
  glifo?: string;
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
  className?: string;
  compacto?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-dashed border-line bg-surface/50 text-center",
        compacto ? "px-6 py-10" : "px-6 py-16",
        className
      )}
    >
      <div
        aria-hidden
        className="mx-auto grid size-12 place-items-center rounded-full bg-line/40 font-display text-2xl font-semibold text-muted/70"
      >
        {glifo}
      </div>
      <p className="mt-4 font-display text-lg font-medium text-ink">{titulo}</p>
      {descripcion && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{descripcion}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
