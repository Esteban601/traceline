import type { Cobertura } from "@/lib/cobertura";
import type { EstadoSolicitud } from "@/lib/estados";
import type { OrigenSolicitud } from "@/lib/origen";

// =============================================================================
// Cobertura: el TIPO y los agregados de presentación. Sin "server-only" a
// propósito — los usan el tablero (componente de cliente) y el informe para
// imprimir (componente de servidor), y de que sean los MISMOS depende que el PDF
// no dibuje un avance distinto del de la pantalla.
//
// La carga de datos vive aparte, en lib/cobertura-datos.ts, que sí es de servidor.
// =============================================================================

export type DatapointCobertura = {
  id: string;
  codigo: string;
  norma: "S1" | "S2";
  /** NIIF = los 91 de la taxonomía oficial · GRI = la extensión, con su código GRI. */
  marco: "NIIF" | "GRI";
  pilar: string;
  seccionIndice: string | null;
  descripcion: string;
  ods: string | null;
  cobertura: Cobertura;
  discrepancia: boolean;
  solicitudes: {
    id: string;
    titulo: string;
    estado: EstadoSolicitud;
    /** De él sale la FUENTE de la validación (IRStrat o interna del cliente). */
    origen: OrigenSolicitud;
  }[];
};

// -----------------------------------------------------------------------------
// Agregados de presentación, compartidos por el tablero y el informe
// -----------------------------------------------------------------------------

export const PILAR_ORDEN = ["gobernanza", "estrategia", "riesgos", "metricas"] as const;

export const PILAR_LABEL: Record<string, string> = {
  extension: "Métricas fuera de NIIF",
  gobernanza: "Gobernanza",
  estrategia: "Estrategia",
  riesgos: "Gestión de riesgos",
  metricas: "Métricas y objetivos",
};

export const PILAR_CORTO: Record<string, string> = {
  gobernanza: "Gobernanza",
  estrategia: "Estrategia",
  riesgos: "Riesgos",
  metricas: "Métricas",
};

/** Cuenta por estado de cobertura. */
export function distribucion(items: DatapointCobertura[]): Record<Cobertura, number> {
  const base: Record<Cobertura, number> = {
    cubierto: 0,
    parcial: 0,
    sin_evidencia: 0,
    sin_solicitud: 0,
  };
  for (const d of items) base[d.cobertura] += 1;
  return base;
}

export function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}
