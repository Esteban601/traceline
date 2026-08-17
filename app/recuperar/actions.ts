"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { modoConsola } from "@/lib/email";
import { APP_URL } from "@/lib/app";

export type RecuperarState = { ok: boolean; error: string | null; mensaje: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A dónde lleva la liga de recuperación: verifica el token y sigue a la pantalla. */
const RUTA_CONFIRMAR = "/auth/confirmar";
const RUTA_DESTINO = "/restablecer";

/**
 * "Olvidé mi contraseña" — flujo estándar de Supabase auth.
 *
 * Con Resend configurado se usa `resetPasswordForEmail` y el correo sale por el
 * proveedor de Supabase. SIN Resend (modo consola, que es el de staging) no hay
 * bandeja que revisar, así que se genera la misma liga con la Admin API y se
 * imprime en el log del servidor — misma filosofía que el resto de los correos
 * de la app.
 *
 * La respuesta es SIEMPRE la misma, exista o no la cuenta: si dijera "ese correo
 * no está registrado" cualquiera podría averiguar quién tiene acceso.
 */
export async function solicitarRecuperacion(
  _prev: RecuperarState,
  fd: FormData
): Promise<RecuperarState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Escribe un correo válido.", mensaje: null };
  }

  const neutro =
    "Si ese correo tiene una cuenta, le enviamos las instrucciones para restablecer la contraseña. Revisa tu bandeja.";

  if (modoConsola()) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${APP_URL}${RUTA_CONFIRMAR}?next=${RUTA_DESTINO}` },
    });

    const hashed = data?.properties?.hashed_token;
    if (error || !hashed) {
      // Cuenta inexistente u otro fallo: no se delata: mismo mensaje.
      console.log(
        `\n──────── 🔑 RECUPERACIÓN (modo consola) ────────\n  Para: ${email}\n  Sin liga: ${
          error?.message ?? "la cuenta no existe"
        }\n────────────────────────────────────────────────\n`
      );
      return { ok: true, error: null, mensaje: neutro };
    }

    const url = `${APP_URL}${RUTA_CONFIRMAR}?token_hash=${hashed}&type=recovery&next=${RUTA_DESTINO}`;
    console.log(
      [
        "",
        "──────────── 🔑 LIGA DE RECUPERACIÓN (modo consola) ────────────",
        `  Para: ${email}`,
        `  Liga: ${url}`,
        "  (RESEND_API_KEY ausente → no se envía correo; usa esta liga)",
        "────────────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
    return { ok: true, error: null, mensaje: neutro };
  }

  const db = await createClient();
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}${RUTA_CONFIRMAR}?next=${RUTA_DESTINO}`,
  });
  if (error) {
    console.error("[recuperar] resetPasswordForEmail falló:", error.message);
  }
  return { ok: true, error: null, mensaje: neutro };
}
