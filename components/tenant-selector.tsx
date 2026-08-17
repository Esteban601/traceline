"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { TenantLogo } from "@/components/ui/tenant-logo";
import { cn } from "@/lib/cn";
import { limpiarNombreTenant } from "@/lib/tenants";

// =============================================================================
// Selector de cliente del panel interno. El staff ve a TODOS los clientes; este
// control acota la vista a uno. Vive en la URL (?tenant=<id>) para que la
// selección se pueda compartir, marcar y sobrevivir a un refresco.
// =============================================================================

export type TenantOpcionSelector = {
  id: string;
  nombre: string;
  logoUrl: string | null;
  prefijoFolio: string;
};

export function TenantSelector({
  tenants,
  seleccionado,
  etiqueta = "Cliente",
  className,
}: {
  tenants: TenantOpcionSelector[];
  /** Id del cliente activo, o null para "todos". */
  seleccionado: string | null;
  etiqueta?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Con un solo cliente el control no aporta: no se muestra.
  if (tenants.length <= 1) return null;

  const ir = (valor: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set("tenant", valor);
    else params.delete("tenant");
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  const activo = tenants.find((t) => t.id === seleccionado) ?? null;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {activo ? (
        <TenantLogo nombre={activo.nombre} logoUrl={activo.logoUrl} tamano="sm" />
      ) : (
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-line/50 text-[11px] font-semibold text-muted"
        >
          ⁘
        </span>
      )}

      <label htmlFor="selector-cliente" className="sr-only">
        {etiqueta}
      </label>
      <select
        id="selector-cliente"
        value={seleccionado ?? ""}
        onChange={(e) => ir(e.target.value)}
        disabled={pending}
        className="h-9 max-w-56 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink outline-none transition duration-150 focus:border-teal/50 disabled:opacity-60"
      >
        <option value="">Todos los clientes</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {limpiarNombreTenant(t.nombre)} · {t.prefijoFolio}
          </option>
        ))}
      </select>
    </div>
  );
}
