import type { EstadoSolicitud } from "@/lib/estados";

/**
 * Transiciones de estado permitidas al staff IRStrat desde el panel interno.
 *
 * El flujo principal de revisión es recibido → en_revisión → validado, con la
 * bifurcación a "observaciones" cuando algo debe corregirse. 'congelado' NO se
 * ofrece nunca aquí: el congelamiento del reporte es una fase posterior.
 */
export const TRANSICIONES: Record<EstadoSolicitud, EstadoSolicitud[]> = {
  pendiente: ["solicitado"],
  solicitado: ["pendiente"],
  recibido: ["en_revision", "observaciones"],
  en_revision: ["validado", "observaciones"],
  observaciones: ["en_revision"],
  validado: ["en_revision"],
  congelado: [],
};

/** ¿Es válida la transición de `desde` a `hacia` para el staff? */
export function transicionValida(
  desde: EstadoSolicitud,
  hacia: EstadoSolicitud
): boolean {
  return TRANSICIONES[desde]?.includes(hacia) ?? false;
}
