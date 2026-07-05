import type { Tono } from "@/lib/estados";
import type { EstadoSolicitud } from "@/lib/estados";

/**
 * Cobertura de un datapoint de la taxonomía a partir del estado de sus
 * solicitudes mapeadas (relación N:N).
 *
 * Cuatro estados, en orden de menor a mayor "salud":
 *   - sin_solicitud  → ningún mapeo todavía (alcance aún no solicitado; NO es un
 *                      hueco de evidencia, es una distinción importante).
 *   - sin_evidencia  → tiene solicitudes mapeadas pero ninguna con evidencia.
 *   - parcial        → al menos una con evidencia, pero no todas validadas.
 *   - cubierto       → todas sus solicitudes mapeadas están validadas.
 */
export type Cobertura = "cubierto" | "parcial" | "sin_evidencia" | "sin_solicitud";

/** Estados que implican que ya existe evidencia cargada para la solicitud. */
const CON_EVIDENCIA: ReadonlySet<EstadoSolicitud> = new Set<EstadoSolicitud>([
  "recibido",
  "en_revision",
  "validado",
  "congelado",
]);

/** Estados que cuentan como "validado" para efectos de cobertura completa. */
const VALIDADO: ReadonlySet<EstadoSolicitud> = new Set<EstadoSolicitud>([
  "validado",
  "congelado",
]);

/** Calcula la cobertura de un datapoint dados los estados de sus solicitudes. */
export function coberturaDe(estados: EstadoSolicitud[]): Cobertura {
  if (estados.length === 0) return "sin_solicitud";
  if (estados.every((e) => VALIDADO.has(e))) return "cubierto";
  if (estados.some((e) => CON_EVIDENCIA.has(e))) return "parcial";
  return "sin_evidencia";
}

export const COBERTURA_META: Record<
  Cobertura,
  { label: string; corto: string; tono: Tono; rank: number }
> = {
  cubierto: { label: "Cubierto", corto: "Cubierto", tono: "verde", rank: 0 },
  parcial: { label: "Parcial", corto: "Parcial", tono: "ambar", rank: 1 },
  sin_evidencia: { label: "Sin evidencia", corto: "Sin evidencia", tono: "rojo", rank: 2 },
  sin_solicitud: { label: "Sin solicitud", corto: "Sin solicitud", tono: "gris", rank: 3 },
};

export const COBERTURA_ORDEN: Cobertura[] = [
  "cubierto",
  "parcial",
  "sin_evidencia",
  "sin_solicitud",
];
