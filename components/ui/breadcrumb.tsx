import Link from "next/link";

// =============================================================================
// Breadcrumb de orientación para vistas de detalle. El último elemento es la
// página actual (sin enlace). Sobrio, tipográfico.
// =============================================================================

export type Miga = { label: string; href?: string };

export function Breadcrumb({ items }: { items: Miga[] }) {
  return (
    <nav aria-label="Ruta de navegación">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        {items.map((m, i) => {
          const ultimo = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {m.href && !ultimo ? (
                <Link
                  href={m.href}
                  className="rounded transition duration-150 hover:text-teal"
                >
                  {m.label}
                </Link>
              ) : (
                <span
                  className={ultimo ? "max-w-[60vw] truncate font-medium text-ink" : undefined}
                  aria-current={ultimo ? "page" : undefined}
                >
                  {m.label}
                </span>
              )}
              {!ultimo && (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="size-3.5 shrink-0 text-muted/50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
