import type { Cobertura } from "@/lib/cobertura";
import type { EstadoSolicitud } from "@/lib/estados";
import type { OrigenSolicitud } from "@/lib/origen";
import type { Marco } from "@/lib/catalogo-marcos";

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
  /** NIIF = la taxonomía oficial S1/S2 · GRI y SASB = otras normas, que cuentan aparte (lib/catalogo-marcos.ts). */
  marco: Marco;
  /** Norma y edición de las filas GRI y SASB («GRI 2», «2021»; «SASB FN-CB», «2025-12»). Nulas en NIIF. */
  estandar: string | null;
  edicion: string | null;
  pilar: string;
  seccionIndice: string | null;
  descripcion: string;
  ods: string | null;
  cobertura: Cobertura;
  /**
   * Código PADRE que agrupa incisos (lib/suplemento/catalogo-incisos.ts). Se lista como fila de agrupación y no
   * entra a conteos ni porcentajes: sus incisos ya cuentan (encargo 2026-10-24-deuda-s2-formato, decisión (a)).
   */
  esPadre: boolean;
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
  extension: "Fuera de NIIF S1/S2",
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

/** Los datapoints que cuentan en conteos y porcentajes: todos menos los padres que agrupan incisos. */
export const contables = (items: DatapointCobertura[]): DatapointCobertura[] => items.filter((d) => !d.esPadre);

/** Cuenta por estado de cobertura (sin los padres que agrupan incisos). */
export function distribucion(items: DatapointCobertura[]): Record<Cobertura, number> {
  const base: Record<Cobertura, number> = {
    cubierto: 0,
    parcial: 0,
    sin_evidencia: 0,
    sin_solicitud: 0,
  };
  for (const d of contables(items)) base[d.cobertura] += 1;
  return base;
}

export function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}
