import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-ink/5 text-muted">
        <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-ink">
        Solicitud no encontrada
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        No existe o no tienes acceso a esta solicitud.
      </p>
      <div className="mt-6">
        <Link href="/portal">
          <Button variant="secondary">Volver al tablero</Button>
        </Link>
      </div>
    </div>
  );
}
