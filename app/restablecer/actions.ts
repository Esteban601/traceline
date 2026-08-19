"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Si venía con contraseña temporal, aquí se apaga el flag que la forzaba: la
  // que acaba de establecer la eligió ella y nadie más la conoce. Va con
  // service_role porque nadie puede escribir su propio perfil por RLS, y va
  // DESPUÉS del updateUser para que el flag no se apague sin cambio real. Si
  // falla, se reporta y el flag SIGUE encendido: volverá a /restablecer, que es
  // molesto pero correcto — lo contrario dejaría la puerta abierta en silencio.
  const { error: flagErr } = await createAdminClient()
    .from("perfiles_usuario")
    .update({ debe_cambiar_password: false })
    .eq("id", user.id);
  if (flagErr) {
    console.error("[restablecer] no se pudo apagar debe_cambiar_password:", flagErr.message);
    return {
      error:
        "Tu contraseña quedó actualizada, pero no pudimos cerrar el cambio obligatorio. " +
        "Vuelve a entrar con la nueva y avisa al equipo de IRStrat.",
    };
  }

  // Se cierra la sesión de recuperación a propósito: que entre con la
  // contraseña nueva confirma que quedó como la persona cree.
  await db.auth.signOut();
  redirect("/login?listo=password");
}
