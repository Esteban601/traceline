import type { Database } from "@/lib/database.types";
import type { Tono } from "@/lib/estados";
import { esAdminCliente, esStaffRol, type IdentidadRol } from "@/lib/roles";

// =============================================================================
// ORIGEN de una solicitud y REGLA DURA de validación por origen.
//
// El origen dice quién PIDIÓ la información:
//   * 'irstrat'  — la pidió la firma (panel interno). Es lo que existía siempre.
//   * 'cliente'  — la creó el administrador del cliente para su propio equipo.
//
// De ahí sale la regla dura: **cada lado revisa, observa y valida lo suyo**. El
// otro lado la VE (la trazabilidad es compartida) pero no la transiciona: sus
// botones no aparecen y la server action lo rechaza. El candado definitivo está
// en la base (trigger `trg_solicitud_origen_transicion`).
//
// Excepciones deliberadas, ambas de IRStrat sobre el reporte entero: el
// congelamiento y la edición de campos de una solicitud interna (p. ej. asignar
// el rubro de taxonomía que hace que su valor llene una celda de la plantilla).
// =============================================================================

export type OrigenSolicitud = Database["public"]["Enums"]["origen_solicitud"];

type OrigenMeta = {
  /** Badge visible para TODOS los roles: nadie opera a ciegas sobre el origen. */
  label: string;
  tono: Tono;
  /** Quién revisa/observa/valida, en una línea. */
  ayuda: string;
  /** Cómo se nombra la validación en la cobertura y en el Excel. */
  validacion: string;
};

export const ORIGEN_META: Record<OrigenSolicitud, OrigenMeta> = {
  irstrat: {
    label: "Solicitud IRStrat",
    tono: "teal",
    ayuda: "La pidió IRStrat; su revisión y validación son de IRStrat.",
    validacion: "Validación IRStrat",
  },
  cliente: {
    label: "Solicitud interna",
    tono: "gold",
    ayuda:
      "La creó el administrador del cliente; su revisión y validación son internas del cliente.",
    validacion: "Validación interna del cliente",
  },
};

/** Origen de las solicitudes que crea este perfil. */
export function origenDe(p: IdentidadRol): OrigenSolicitud {
  return esStaffRol(p) ? "irstrat" : "cliente";
}

/**
 * ¿Este perfil puede revisar / observar / validar una solicitud de ese origen?
 * Es la regla dura, en una función: la usan la UI (para no pintar botones) y
 * cada server action de transición (para rechazar).
 */
export function puedeRevisarOrigen(origen: OrigenSolicitud, p: IdentidadRol): boolean {
  if (origen === "irstrat") return esStaffRol(p);
  return esAdminCliente(p);
}

/**
 * ¿Puede editar los CAMPOS de una solicitud de ese origen? El staff sí en ambas
 * (opera la plataforma: asigna rubros, corrige áreas, ata datapoints); el
 * administrador del cliente, solo en las suyas.
 */
export function puedeEditarOrigen(origen: OrigenSolicitud, p: IdentidadRol): boolean {
  if (esStaffRol(p)) return true;
  return origen === "cliente" && esAdminCliente(p);
}

/** Mensaje de rechazo cuando el lado equivocado intenta transicionar. */
export function errorOrigen(origen: OrigenSolicitud): string {
  return origen === "irstrat"
    ? "Esta es una solicitud de IRStrat: su revisión y validación corresponden al equipo de IRStrat."
    : "Esta es una solicitud interna del cliente: su revisión y validación corresponden a su administrador.";
}

/**
 * Nota de trazabilidad para el Excel de taxonomía. Solo se anota cuando la
 * validación fue INTERNA del cliente: el documento oficial se lee asumiendo la
 * validación de la firma, así que lo que hay que declarar es la excepción.
 */
export const NOTA_VALIDACION_INTERNA = "(validación interna del cliente)";
