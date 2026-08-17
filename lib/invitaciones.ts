import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { APP_URL } from "@/lib/app";

// =============================================================================
// Invitaciones de un solo uso para que la persona establezca SU contraseña.
//
// El token viaja en la liga y solo existe en claro una vez: al mostrárselo al
// staff que da de alta. En la base se guarda su SHA-256, de modo que una fuga de
// la tabla no entrega accesos. Sin sal ni KDF a propósito: el token es de 256
// bits aleatorios, no una contraseña adivinable, y el hash solo evita que el
// valor almacenado sea usable tal cual.
// =============================================================================

/** Horas de vigencia de una invitación. */
export const INVITACION_HORAS = 72;

/** Token opaco de 256 bits, seguro para viajar en una URL. */
export function generarTokenInvitacion(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 (hex) del token: lo único que se guarda en la base. */
export function hashTokenInvitacion(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Instante de expiración a partir de ahora. */
export function expiracionInvitacion(desde = new Date()): Date {
  return new Date(desde.getTime() + INVITACION_HORAS * 60 * 60 * 1000);
}

/** Liga que se comparte con la persona invitada. */
export function urlInvitacion(token: string): string {
  return `${APP_URL}/invitacion/${token}`;
}
