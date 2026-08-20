import { esJefeArea, type IdentidadRol } from "@/lib/roles";
import type { EstadoSolicitud } from "@/lib/estados";

// =============================================================================
// VISTO BUENO DEL ÁREA — la regla escrita una vez, para la UI y las acciones.
//
// La autoridad es la BASE (política `solicitudes_jefe_area_vb` + trigger
// `trg_solicitud_vb_area` de la migración 20260824130000). Esto es el mismo
// criterio del lado del servidor de aplicación, para no ofrecer un botón que el
// trigger va a rechazar.
//
// Qué es y qué no: el visto bueno dice que EL ÁREA respalda lo que entregó. No es
// un estado, no reemplaza la validación final y no la condiciona — se puede
// validar sin él, y entonces la UI muestra que no se dio. Son dos verificaciones
// independientes, y el valor está en verlas juntas.
// =============================================================================

/** Estados en los que la marca ya quedó fija: el expediente no se reescribe. */
const ESTADOS_CERRADOS: readonly EstadoSolicitud[] = ["validado", "congelado"] as const;

export type PerfilVB = IdentidadRol & { id: string; area: string | null };

export type SolicitudVB = {
  area_asignada: string | null;
  estado: EstadoSolicitud;
  vb_area_por: string | null;
  vb_area_fecha: string | null;
};

/** ¿Esta persona es el jefe DEL área de esta solicitud? Espejo de `fn_es_jefe_de_area`. */
export function esJefeDeSuArea(perfil: PerfilVB, sol: Pick<SolicitudVB, "area_asignada">): boolean {
  if (!esJefeArea(perfil)) return false;
  if (!perfil.area || !sol.area_asignada) return false;
  return perfil.area === sol.area_asignada;
}

/**
 * ¿Puede DAR el visto bueno ahora? Jefe del área, con evidencia cargada, y la
 * solicitud todavía abierta. Sin evidencia no se firma: el visto bueno respalda un
 * archivo concreto, y firmar el vacío sería una marca sin contenido.
 */
export function puedeDarVB(
  perfil: PerfilVB,
  sol: SolicitudVB,
  tieneEvidencia: boolean
): boolean {
  return (
    esJefeDeSuArea(perfil, sol) &&
    tieneEvidencia &&
    sol.vb_area_por == null &&
    !ESTADOS_CERRADOS.includes(sol.estado)
  );
}

/** ¿Puede RETIRARLO? Mientras no esté validada ni congelada. */
export function puedeRetirarVB(perfil: PerfilVB, sol: SolicitudVB): boolean {
  return (
    esJefeDeSuArea(perfil, sol) &&
    sol.vb_area_por != null &&
    !ESTADOS_CERRADOS.includes(sol.estado)
  );
}

/** Por qué no se puede firmar, en la voz de quien lo lee. */
export function motivoSinVB(
  perfil: PerfilVB,
  sol: SolicitudVB,
  tieneEvidencia: boolean
): string | null {
  if (!esJefeDeSuArea(perfil, sol)) return null; // no es su decisión: no se explica
  if (ESTADOS_CERRADOS.includes(sol.estado)) {
    return sol.estado === "validado"
      ? "La solicitud ya está validada: el visto bueno quedó como estaba."
      : "El reporte está congelado: quedó cerrado para aseguramiento.";
  }
  if (!tieneEvidencia) {
    return "Todavía no hay evidencia cargada. El visto bueno respalda un archivo, así que espera la entrega de tu equipo.";
  }
  return null;
}

/** Etiqueta corta para la matriz y los listados. */
export const VB_LABEL = {
  firmado: "Visto bueno del área",
  sin: "Sin visto bueno del área",
} as const;
