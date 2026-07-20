import { IS_STAGING } from "@/lib/app";

/**
 * Franja discreta y permanente para el entorno de demostración. Solo se renderiza
 * con NEXT_PUBLIC_STAGING=true (Heroku); en local es null y no altera el layout.
 * Crema sobre teal (tokens de DESIGN.md), no invasiva.
 */
export function StagingBanner() {
  if (!IS_STAGING) return null;
  return (
    <div
      role="note"
      className="flex items-center justify-center gap-2 border-b border-teal-dark/40 bg-teal px-4 py-1.5 text-center text-xs font-medium text-crema"
    >
      <span
        aria-hidden
        className="inline-block size-1.5 shrink-0 rounded-full bg-crema/70"
      />
      <span>
        <span className="font-semibold uppercase tracking-wide text-crema">
          Entorno de demostración
        </span>{" "}
        <span className="text-crema/80">— datos ilustrativos</span>
      </span>
    </div>
  );
}
