"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

export function LogoutButton({
  tone = "default",
}: {
  /** "invert" para barras oscuras (panel interno teal). */
  tone?: "default" | "invert";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium",
        "transition duration-150 ease-out disabled:opacity-55",
        tone === "invert"
          ? "text-crema/80 hover:bg-crema/10 hover:text-crema"
          : "text-muted hover:bg-ink/5 hover:text-ink"
      )}
    >
      {pending ? (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          className="size-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
        </svg>
      )}
      Salir
    </button>
  );
}
