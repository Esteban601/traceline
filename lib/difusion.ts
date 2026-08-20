import { esJefeArea, type IdentidadRol } from "@/lib/roles";
import type { EstadoSolicitud } from "@/lib/estados";

// =============================================================================
// DIFUSIÓN MULTI-ÁREA — la regla escrita una vez, para la UI y las acciones.
//
// La autoridad es la BASE (política `solicitudes_area_declina` + triggers
// `trg_solicitud_difusion` y `trg_evidencia_no_si_fuera_difusion` de la migración
// 20260826120000). Esto es el mismo criterio del lado del servidor de aplicación,
// para no ofrecer un botón que el trigger va a rechazar.
//
// Qué es: preguntar a VARIAS áreas cuando no se sabe cuál tiene la información.
// Se crea una copia por área; las que no aplican lo DECLARAN. Ni "declinada" ni
// "desactivada" son estados: son marcas paralelas, como el visto bueno del área.
// =============================================================================

/** Atajo del formulario: difundir a todas las áreas del catálogo. */
export const TODAS_LAS_AREAS = "__todas__";

/** Estados en los que el expediente ya quedó fijo. */
const CERRADOS: readonly EstadoSolicitud[] = ["validado", "congelado"] as const;

export type PerfilDifusion = IdentidadRol & { id: string; area: string | null };

export type SolicitudDifusion = {
  area_asignada: string | null;
  estado: EstadoSolicitud;
  grupo_difusion_id: string | null;
  declinada: boolean;
  desactivada: boolean;
};

/** ¿Esta solicitud es una copia de una difusión? */
export function esDifundida(s: Pick<SolicitudDifusion, "grupo_difusion_id">): boolean {
  return s.grupo_difusion_id != null;
}

/** ¿La sesión pertenece al ÁREA de la solicitud? Espejo de `fn_es_de_su_area`. */
export function esDeSuArea(
  perfil: PerfilDifusion,
  s: Pick<SolicitudDifusion, "area_asignada">
): boolean {
  const rolDeArea = perfil.rol === "cliente" || esJefeArea(perfil);
  if (!rolDeArea || perfil.tenant_id === null) return false;
  if (!perfil.area || !s.area_asignada) return false;
  return perfil.area === s.area_asignada;
}

/**
 * ¿Puede DECLINAR ahora? Es del área, la solicitud es de una difusión, no está
 * cerrada y **no tiene evidencia**: si ya entregó, la información sí le
 * correspondía, y dejar las dos cosas juntas volvería el expediente contradictorio.
 */
export function puedeDeclinar(
  perfil: PerfilDifusion,
  s: SolicitudDifusion,
  tieneEvidencia: boolean
): boolean {
  return (
    esDifundida(s) &&
    esDeSuArea(perfil, s) &&
    !s.declinada &&
    !s.desactivada &&
    !tieneEvidencia &&
    !CERRADOS.includes(s.estado)
  );
}

/** ¿Puede RETOMARLA? Mientras el grupo siga abierto para ella. */
export function puedeRetomar(perfil: PerfilDifusion, s: SolicitudDifusion): boolean {
  return (
    esDifundida(s) &&
    esDeSuArea(perfil, s) &&
    s.declinada &&
    !s.desactivada &&
    !CERRADOS.includes(s.estado)
  );
}

/** Por qué no se ofrece declinar, en la voz de quien lo lee. */
export function motivoSinDeclinar(
  perfil: PerfilDifusion,
  s: SolicitudDifusion,
  tieneEvidencia: boolean
): string | null {
  if (!esDifundida(s) || !esDeSuArea(perfil, s)) return null; // no es su decisión
  if (s.desactivada) {
    return "Esta copia se retiró: la información se recabó por otra área.";
  }
  if (CERRADOS.includes(s.estado)) {
    return "La solicitud ya está validada: su expediente quedó fijo.";
  }
  if (tieneEvidencia && !s.declinada) {
    return "Ya entregaste un archivo en esta solicitud, así que la información sí le correspondía a tu área. Si fue un error, reemplaza la versión o escríbelo en la conversación.";
  }
  return null;
}

/** ¿Cuenta para los pendientes y el avance del área? */
export function cuentaEnAvance(s: Pick<SolicitudDifusion, "declinada" | "desactivada">): boolean {
  return !s.declinada && !s.desactivada;
}

/** Texto del comentario estándar que se publica al declinar. */
export function comentarioDeclinar(area: string | null, nota: string | null): string {
  const base = area
    ? `Esta área (${area}) declaró que la información no le corresponde.`
    : "Esta área declaró que la información no le corresponde.";
  const limpia = (nota ?? "").trim();
  return limpia ? `${base}\n\n${limpia}` : base;
}

export const NOTA_DECLINAR_MAX = 400;

// -----------------------------------------------------------------------------
// Vista de grupo (quien difundió)
// -----------------------------------------------------------------------------

/** Cómo va cada área de la difusión. El orden es el de la lectura del grupo. */
export type EstadoEnGrupo = "entrego" | "en_proceso" | "declino" | "retirada" | "sin_respuesta";

export const ESTADO_GRUPO_META: Record<
  EstadoEnGrupo,
  { label: string; tono: "verde" | "azul" | "gris" | "ambar" }
> = {
  entrego: { label: "Entregó", tono: "verde" },
  en_proceso: { label: "En proceso", tono: "azul" },
  declino: { label: "Declinó", tono: "gris" },
  retirada: { label: "Copia retirada", tono: "gris" },
  sin_respuesta: { label: "Sin respuesta", tono: "ambar" },
};

/**
 * Estado de una copia DENTRO del grupo. No es el estado de la solicitud: es la
 * respuesta del área a la pregunta que se difundió, que es lo que quien difundió
 * necesita leer de un vistazo.
 */
export function estadoEnGrupo(s: {
  estado: EstadoSolicitud;
  declinada: boolean;
  desactivada: boolean;
  evidencias: number;
}): EstadoEnGrupo {
  if (s.desactivada) return "retirada";
  if (s.declinada) return "declino";
  if (s.estado === "validado" || s.estado === "congelado") return "entrego";
  if (s.evidencias > 0) return "entrego";
  if (s.estado === "observaciones" || s.estado === "en_revision") return "en_proceso";
  return "sin_respuesta";
}
