import { cn } from "@/lib/cn";
import { ORIGEN_META, type OrigenSolicitud } from "@/lib/origen";
import {
  ESTADO_META,
  TONO_CLASSES,
  type EstadoSolicitud,
  type EstadoIcono,
  type Tono,
} from "@/lib/estados";

/**
 * Íconos por estado. El color lo comunica el tono del badge (quién tiene la
 * pelota); el ícono distingue el estado exacto incluso en proyectores de baja
 * calidad, donde el matiz por sí solo no basta.
 */
function IconoEstado({ icono, className }: { icono: EstadoIcono; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: cn("size-3.5 shrink-0", className),
    "aria-hidden": true,
  };
  switch (icono) {
    case "circulo": // pendiente — círculo vacío
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      );
    case "envio": // solicitado — flecha de envío (paper plane)
      return (
        <svg {...common}>
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4 20-7z" />
        </svg>
      );
    case "bandeja": // recibido — bandeja de entrada
      return (
        <svg {...common}>
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case "lupa": // en_revision — lupa
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case "alerta": // observaciones — alerta
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4.5" />
          <path d="M12 16h.01" />
        </svg>
      );
    case "check": // validado — check
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "candado": // congelado — candado
      return (
        <svg {...common}>
          <rect x="4" y="10.5" width="16" height="10" rx="2" />
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
        </svg>
      );
  }
}

export function EstadoBadge({
  estado,
  className,
}: {
  estado: EstadoSolicitud;
  className?: string;
}) {
  const meta = ESTADO_META[estado];
  const c = TONO_CLASSES[meta.tono];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 py-0.5 text-xs font-medium",
        c.text,
        c.bg,
        c.border,
        className
      )}
    >
      <IconoEstado icono={meta.icono} className="size-3" />
      {meta.label}
    </span>
  );
}

export function Chip({
  children,
  tono = "gris",
  className,
}: {
  children: React.ReactNode;
  tono?: Tono;
  className?: string;
}) {
  const c = TONO_CLASSES[tono];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 py-0.5 text-xs font-medium",
        c.text,
        c.bg,
        c.border,
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * Badge de ORIGEN de la solicitud. Visible para TODOS los roles (staff, área,
 * coordinador y administrador del cliente): saber quién pidió el dato es parte
 * de la trazabilidad, no un detalle interno. El teal es IRStrat; el dorado, el
 * propio cliente.
 */
export function OrigenBadge({
  origen,
  className,
}: {
  origen: OrigenSolicitud;
  className?: string;
}) {
  const meta = ORIGEN_META[origen];
  const c = TONO_CLASSES[meta.tono];
  return (
    <span
      title={meta.ayuda}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 py-0.5 text-xs font-medium",
        c.text,
        c.bg,
        c.border,
        className
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", c.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}
