"use client";

import { TenantLogo } from "@/components/ui/tenant-logo";
import { ParamSelect } from "@/components/ui/param-select";
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
  /** Parámetros que dejan de tener sentido al cambiar de cliente. */
  limpiar = [],
  className,
}: {
  tenants: TenantOpcionSelector[];
  /** Id del cliente activo, o null para "todos". */
  seleccionado: string | null;
  etiqueta?: string;
  limpiar?: string[];
  className?: string;
}) {
  // Con un solo cliente el control no aporta: no se muestra.
  if (tenants.length <= 1) return null;

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

      <ParamSelect
        param="tenant"
        etiqueta={etiqueta}
        valor={seleccionado}
        placeholder="Todos los clientes"
        limpiar={limpiar}
        opciones={tenants.map((t) => ({
          value: t.id,
          label: `${limpiarNombreTenant(t.nombre)} · ${t.prefijoFolio}`,
        }))}
      />
    </div>
  );
}
