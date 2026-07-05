import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-card border border-line bg-surface px-6 py-16 text-center shadow-soft">
      <p className="font-display text-lg font-semibold text-ink">
        Solicitud no encontrada
      </p>
      <p className="mt-1.5 text-sm text-muted">
        La solicitud no existe o fue removida del reporte.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-teal transition duration-150 hover:text-teal-dark"
      >
        Volver a la matriz
      </Link>
    </div>
  );
}
