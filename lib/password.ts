// =============================================================================
// Regla de la contraseña que la persona establece (canje de invitación y
// restablecimiento). Vive aparte de lib/invitaciones.ts —que es server-only por
// usar node:crypto— para que la UI y el servidor compartan el mismo mínimo.
// La autoridad sigue siendo la server action; la UI solo la refleja.
// =============================================================================

/** Longitud mínima exigida. */
export const PASSWORD_MIN = 8;

/** Mensaje de error de la contraseña elegida, o null si es válida. */
export function validarPassword(password: string, confirmacion: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  }
  if (password !== confirmacion) return "Las contraseñas no coinciden.";
  return null;
}
