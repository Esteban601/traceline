import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifica el token de un correo de Supabase auth (recuperación de contraseña) y
 * abre la sesión en cookies antes de continuar a `next`.
 *
 * Existe porque la liga por defecto de Supabase devuelve los tokens en el
 * fragmento (#) de la URL, que el servidor no puede leer: la plantilla de correo
 * apunta aquí con `token_hash` en la query y este handler hace el `verifyOtp`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/portal";

  // Solo rutas internas: un `next` externo sería un open redirect.
  const destino = next.startsWith("/") && !next.startsWith("//") ? next : "/portal";

  if (tokenHash && tipo) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(destino, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=liga", origin));
}
