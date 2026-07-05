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
    <div className="rounded-card border border-line bg-surface px-6 py-16 text-center shadow-soft">
      <p className="font-display text-lg font-semibold text-ink">
        No se pudo cargar el panel
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
        {error.message || "Ocurrió un error al obtener la información. Intenta de nuevo."}
      </p>
      <div className="mt-6">
        <Button onClick={reset} variant="secondary" size="sm">
          Reintentar
        </Button>
      </div>
    </div>
  );
}
