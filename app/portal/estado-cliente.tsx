// =============================================================================
// Traducción de los estados internos al IDIOMA DEL CLIENTE (Sprint UX #10).
//
// Presentación pura del portal cliente: NO cambia estados en BD, ni ESTADO_META,
// ni los badges del staff (components/ui/badge.tsx). Solo dice, en llano, qué se
// espera del usuario. Reusa los tonos de la paleta existente (sin colores nuevos).
// =============================================================================

import type { EstadoSolicitud, Tono } from "@/lib/estados";

export type IconoAccionTipo = "subir" | "corregir" | "revision" | "completada";

export type AccionCliente = {
  /** Microcopy de acción, en el idioma del cliente. */
  titulo: string;
  /** Tono de la paleta existente (reutilizado, sin ampliar). */
  tono: Tono;
  /** El cliente debe actuar (subir o corregir). Rige la jerarquía del detalle. */
  esperaCarga: boolean;
  /** Cuenta como completada para la barra "X de Y". */
  completada: boolean;
  icono: IconoAccionTipo;
};

/** Estado interno → acción esperada del cliente. Fuente única del portal. */
export function accionCliente(estado: EstadoSolicitud): AccionCliente {
  switch (estado) {
    case "pendiente":
    case "solicitado":
      return {
        titulo: "Te toca subir información",
        tono: "ambar",
        esperaCarga: true,
        completada: false,
        icono: "subir",
      };
    case "observaciones":
      return {
        titulo: "Corregir y reenviar",
        tono: "rojo",
        esperaCarga: true,
        completada: false,
        icono: "corregir",
      };
    case "recibido":
    case "en_revision":
      return {
        titulo: "En revisión por IRStrat",
        tono: "azul",
        esperaCarga: false,
        completada: false,
        icono: "revision",
      };
    case "validado":
    case "congelado":
      return {
        titulo: "Completada",
        tono: "verde",
        esperaCarga: false,
        completada: true,
        icono: "completada",
      };
  }
}

/** Ícono de la acción (SVG inline; sin librerías). */
export function IconoAccion({
  tipo,
  className = "size-4",
}: {
  tipo: IconoAccionTipo;
  className?: string;
}) {
  const common = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
  switch (tipo) {
    case "subir":
      return (
        <svg {...common}>
          <path d="M12 16V4M6 10l6-6 6 6" />
          <path d="M4 20h16" />
        </svg>
      );
    case "corregir":
      return (
        <svg {...common}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case "revision":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "completada":
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
  }
}
