"use client";

import { useEffect, useId } from "react";
import { Button } from "@/components/ui/button";

// =============================================================================
// Diálogo de confirmación propio (sin window.confirm). Para acciones con efecto
// externo o percibidas como irreversibles. Accesible: role=dialog, aria-modal,
// foco inicial en el botón principal, Escape para cancelar, backdrop clicable.
// =============================================================================

export function ConfirmDialog({
  open,
  titulo,
  descripcion,
  confirmar = "Confirmar",
  cancelar = "Cancelar",
  tono = "primary",
  cargando = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  titulo: string;
  descripcion?: string;
  confirmar?: string;
  cancelar?: string;
  tono?: "primary" | "danger";
  cargando?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !cargando) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, cargando, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descripcion ? descId : undefined}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={() => !cargando && onCancel()}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[1px]"
      />
      {/* Tarjeta */}
      <div className="toast-enter relative w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-lift">
        <h2 id={titleId} className="font-display text-lg font-semibold text-ink">
          {titulo}
        </h2>
        {descripcion && (
          <p id={descId} className="mt-2 text-sm leading-relaxed text-muted">
            {descripcion}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={cargando}>
            {cancelar}
          </Button>
          <Button
            autoFocus
            variant={tono === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            loading={cargando}
          >
            {confirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}
