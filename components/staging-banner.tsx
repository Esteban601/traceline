import { IS_STAGING } from "@/lib/app";

/**
 * Banner discreto y permanente para el ambiente de demostración. Solo se renderiza
 * con STAGING=true (Heroku); en local es null y no altera el layout. Sobrio, con
 * los tokens de DESIGN.md (acento dorado sobre tinte cálido).
 */
export function StagingBanner() {
  if (!IS_STAGING) return null;
  return (
    <div
      role="note"
      className="flex items-center justify-center gap-2 border-b border-gold/30 bg-gold/10 px-4 py-1.5 text-center text-xs font-medium text-ink"
    >
      <span
        aria-hidden
        className="inline-block size-1.5 shrink-0 rounded-full bg-gold"
      />
      <span>
        <span className="font-semibold uppercase tracking-wide text-gold">
          Ambiente de demostración
        </span>{" "}
        — datos ficticios
      </span>
    </div>
  );
}
