"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="grid mx-auto size-12 place-items-center rounded-full bg-rojo/10 text-rojo">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M12 8v5M12 16h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-ink">
        Algo salió mal
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        {error.message || "No se pudo cargar la información. Intenta de nuevo."}
      </p>
      <div className="mt-6">
        <Button onClick={reset} variant="secondary">
          Reintentar
        </Button>
      </div>
    </div>
  );
}
