import Link from "next/link";
import { cn } from "@/lib/cn";

// =============================================================================
// Entrada al semáforo del Suplemento S1/S2, junto al Excel de taxonomía.
//
// Es un enlace y no un botón con `fetch`: aquí no se descarga nada, se navega a
// una pantalla. Sin reporte elegido no lleva a ningún lado —el semáforo es
// SIEMPRE de un reporte concreto— así que se pinta apagado y sin `href`, igual
// que el botón del Excel se deshabilita.
// =============================================================================

const BASE =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-sm font-medium transition duration-150 ease-out";

function Icono() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="6" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M18 6h3M18 12h3M18 18h3" />
    </svg>
  );
}

export function SuplementoButton({ reporteId }: { reporteId: string | null }) {
  if (!reporteId) {
    return (
      <span
        className={cn(BASE, "cursor-not-allowed border border-line bg-surface text-ink opacity-55")}
        title="Elige un reporte para revisar su suplemento"
        aria-disabled
      >
        <Icono />
        Suplemento S1 y S2
      </span>
    );
  }

  return (
    <Link
      href={`/admin/cobertura/suplemento?reporte=${encodeURIComponent(reporteId)}`}
      className={cn(BASE, "border border-line bg-surface text-ink hover:border-teal/40 hover:text-teal")}
      title="Revisa qué puede escribirse hoy de cada bloque del suplemento"
    >
      <Icono />
      Suplemento S1 y S2
    </Link>
  );
}
