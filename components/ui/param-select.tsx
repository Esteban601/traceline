"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";

// =============================================================================
// Select que vive en la URL. La selección se guarda como parámetro de búsqueda
// para que se pueda compartir, marcar y sobrevivir a un refresco; los demás
// parámetros se conservan (elegir cliente no borra el reporte y viceversa).
// =============================================================================

export type OpcionParam = { value: string; label: string };

export function ParamSelect({
  param,
  etiqueta,
  opciones,
  valor,
  placeholder,
  /** Parámetros que se limpian al cambiar este (dependencias aguas abajo). */
  limpiar = [],
  className,
}: {
  param: string;
  etiqueta: string;
  opciones: OpcionParam[];
  valor: string | null;
  placeholder: string;
  limpiar?: string[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const ir = (siguiente: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (siguiente) params.set(param, siguiente);
    else params.delete(param);
    for (const p of limpiar) params.delete(p);
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  const id = `selector-${param}`;

  return (
    <>
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor ?? ""}
        onChange={(e) => ir(e.target.value)}
        disabled={pending || opciones.length === 0}
        className={cn(
          "h-9 max-w-56 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink outline-none transition duration-150 focus:border-teal/50 disabled:opacity-60",
          className
        )}
      >
        <option value="">{placeholder}</option>
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );
}
