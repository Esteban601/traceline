import type { EstadoSolicitud } from "@/lib/estados";

// =============================================================================
// Reglas de gestión de solicitudes (fuente única, compartida por la UI y las
// server actions). Las acciones del servidor son la autoridad; la UI las refleja
// para no ofrecer lo que el servidor rechazaría.
// =============================================================================

/**
 * ¿La solicitud es editable? REGLA DURA: una solicitud 'validado' no se edita
 * (la evidencia ya quedó aceptada; reabrirla es un cambio de estado, no una
 * edición de campos).
 */
export function puedeEditarSolicitud(estado: EstadoSolicitud): boolean {
  return estado !== "validado";
}

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

/** Roles asignables a un usuario del cliente desde el alta (no staff). */
export const ROLES_CLIENTE = [
  { value: "cliente", label: "Cliente (responsable de área)" },
  { value: "coordinador", label: "Coordinador (ve todo su tenant)" },
] as const;

export type RolCliente = (typeof ROLES_CLIENTE)[number]["value"];

export function esRolClienteValido(rol: string): rol is RolCliente {
  return ROLES_CLIENTE.some((r) => r.value === rol);
}

/**
 * Genera una contraseña temporal legible y robusta para el alta de usuarios.
 * Server-only (usa Web Crypto). Formato: 4 bloques de 4 (letras sin ambiguas +
 * dígitos) separados por '-' y un símbolo final, p. ej. "k7Ra-9mPq-3xTn-h2Kd!".
 */
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
