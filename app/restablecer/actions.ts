"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validarPassword } from "@/lib/password";

export type RestablecerState = { error: string | null };

/**
 * Establece la contraseña nueva del usuario que llegó por la liga de
 * recuperación. La sesión ya existe (la abrió /auth/confirmar al verificar el
 * token), así que basta con `updateUser` sobre el cliente de sesión: RLS y la
 * identidad son las del propio usuario, no hay service_role de por medio.
 */
export async function actualizarContrasena(
  _prev: RestablecerState,
  fd: FormData
): Promise<RestablecerState> {
  const password = String(fd.get("password") ?? "");
  const confirmacion = String(fd.get("confirmacion") ?? "");

  const errPassword = validarPassword(password, confirmacion);
  if (errPassword) return { error: errPassword };

  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { error: "Tu liga de recuperación venció. Pide una nueva desde “Olvidé mi contraseña”." };
  }

  const { error } = await db.auth.updateUser({ password });
  if (error) {
    return { error: `No se pudo actualizar la contraseña: ${error.message}` };
  }

  // Se cierra la sesión de recuperación a propósito: que entre con la
  // contraseña nueva confirma que quedó como la persona cree.
  await db.auth.signOut();
  redirect("/login?listo=password");
}
