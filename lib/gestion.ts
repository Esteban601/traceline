import type { EstadoSolicitud } from "@/lib/estados";

// =============================================================================
// Reglas de gestión de solicitudes (fuente única, compartida por la UI y las
// server actions). Las acciones del servidor son la autoridad; la UI las refleja
// para no ofrecer lo que el servidor rechazaría.
// =============================================================================

/**
 * ¿La solicitud es editable? REGLA DURA: una solicitud 'validado' no se edita
 * (la evidencia ya quedó aceptada; reabrirla es un cambio de estado, no una
 * edición de campos). Una 'congelado' tampoco: el reporte cerró para
 * aseguramiento y todo queda en solo-lectura (candado a nivel BD).
 */
export function puedeEditarSolicitud(estado: EstadoSolicitud): boolean {
  return estado !== "validado" && estado !== "congelado";
}

/**
 * ¿Se puede asignar el rubro de taxonomía? Sí incluso si la solicitud está
 * VALIDADA, y a propósito: el rubro no es contenido de la solicitud (no cambia
 * su enunciado, su valor ni su estado), es la decisión de qué celda de la
 * plantilla oficial alimenta. Sin esta excepción, un reporte cuyas solicitudes
 * se validaron antes de tener rubro no podría llenar su Excel nunca.
 *
 * Congelado sí queda fuera: ahí el candado es del reporte entero y lo aplica
 * también un trigger en la base.
 */
export function puedeAsignarRubroTaxonomia(estado: EstadoSolicitud): boolean {
  return estado !== "congelado";
}

/**
 * ¿Se puede declarar la NOTA DE ALCANCE? Misma excepción que el rubro de
 * taxonomía, y por la misma razón: no es contenido de la solicitud ni cambia su
 * valor ni su estado, es la salvedad de perímetro con la que se debe leer la
 * cifra en el entregable. El caso que la motiva es justo una solicitud ya
 * VALIDADA, así que negarla ahí la volvería inútil. Congelado sí queda fuera.
 */
export function puedeDeclararAlcance(estado: EstadoSolicitud): boolean {
  return estado !== "congelado";
}

/** Largo máximo de la nota de alcance: entra en una celda de Excel, no es un ensayo. */
export const NOTA_ALCANCE_MAX = 300;

/**
 * ¿Se pueden editar el título y la descripción? No, si la solicitud ya tiene
 * evidencia: el cliente respondió a un enunciado y ese enunciado no puede cambiar
 * de significado bajo sus pies. Los demás campos sí se pueden editar.
 */
export function puedeEditarEnunciado(tieneEvidencia: boolean): boolean {
  return !tieneEvidencia;
}

/**
 * ¿Se puede eliminar? SOLO si está 'pendiente' y sin evidencia. En cualquier otro
 * estado la trazabilidad prohíbe borrar historia (no se ofrece la opción).
 */
export function puedeEliminarSolicitud(
  estado: EstadoSolicitud,
  tieneEvidencia: boolean
): boolean {
  return estado === "pendiente" && !tieneEvidencia;
}

// Los roles asignables (y quién puede asignar cada uno) viven en lib/roles.ts:
// desde el tier de autoservicio no solo dependen del destino, también de QUIÉN
// da de alta (el staff puede nombrar coordinador; el administrador del cliente,
// no). Ver `rolesAsignablesPor` y `puedeAsignarRol`.

/**
 * Genera una contraseña temporal legible y robusta para el alta de usuarios.
 * Server-only (usa Web Crypto). Formato: 4 bloques de 4 (letras sin ambiguas +
 * dígitos) separados por '-' y un símbolo final, p. ej. "k7Ra-9mPq-3xTn-h2Kd!".
 */
/**
 * Contraseña temporal LEGIBLE, en formato `XXXX-xxxx-0000`: un bloque de
 * mayúsculas, uno de minúsculas y uno de dígitos. Es para las cuentas cuya
 * contraseña se entrega por un canal externo —dictada, o impresa en un manual—,
 * donde el costo de un carácter confundible lo paga quien la teclea.
 *
 * Por eso el alfabeto excluye lo ambiguo (I/l/1, O/0) y por eso viene siempre
 * acompañada de `debe_cambiar_password`: se entrega para entrar a cambiarla, no
 * para usarla.
 */
export function generarPasswordLegible(): string {
  const MAY = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // sin I ni O
  const MIN = "abcdefghijkmnpqrstuvwxyz";   // sin l ni o
  const NUM = "23456789";                   // sin 0 ni 1
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const bloque = (abc: string, desde: number) =>
    Array.from({ length: 4 }, (_, i) => abc[bytes[desde + i] % abc.length]).join("");
  return `${bloque(MAY, 0)}-${bloque(MIN, 4)}-${bloque(NUM, 8)}`;
}

export function generarPasswordTemporal(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => abc[b % abc.length]);
  const bloques = [
    chars.slice(0, 4).join(""),
    chars.slice(4, 8).join(""),
    chars.slice(8, 12).join(""),
    chars.slice(12, 16).join(""),
  ];
  return `${bloques.join("-")}!`;
}
