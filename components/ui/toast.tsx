"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";

// =============================================================================
// Toasts — feedback ligero de acciones. Componente propio (sin librería):
// contexto + provider + hook useToast() + stack accesible (aria-live).
// =============================================================================

type ToastTipo = "success" | "error";
type Toast = { id: number; tipo: ToastTipo; mensaje: string };

type ToastCtx = {
  success: (mensaje: string) => void;
  error: (mensaje: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

const DURACION_MS = 5000;

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const quitar = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((tipo: ToastTipo, mensaje: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, tipo, mensaje }]);
  }, []);

  const api = useRef<ToastCtx>({
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
  });

  return (
    <Ctx.Provider value={api.current}>
      {children}
      <Toaster toasts={toasts} onClose={quitar} />
    </Ctx.Provider>
  );
}

function Toaster({
  toasts,
  onClose,
}: {
  toasts: Toast[];
  onClose: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, DURACION_MS);
    return () => clearTimeout(id);
  }, [onClose]);

  const exito = toast.tipo === "success";

  return (
    <div
      role={exito ? "status" : "alert"}
      className={cn(
        "toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-lift",
        exito ? "border-verde/30" : "border-rojo/30"
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
          exito ? "bg-verde/12 text-verde" : "bg-rojo/12 text-rojo"
        )}
        aria-hidden
      >
        {exito ? (
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        )}
      </span>
      <p className="min-w-0 flex-1 text-sm leading-snug text-ink">{toast.mensaje}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar notificación"
        className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-muted transition duration-150 hover:bg-ink/5 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
