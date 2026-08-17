import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { RestablecerForm } from "./restablecer-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

/**
 * Pantalla de restablecimiento. Se llega por la liga del correo de recuperación,
 * que pasa antes por /auth/confirmar: ahí se verifica el token y se abre la
 * sesión. Sin esa sesión no hay nada que restablecer.
 */
export default async function RestablecerPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  const marca = {
    titulo: "Elige tu contraseña nueva.",
    texto:
      "Con ella entrarás de aquí en adelante. La liga de recuperación queda invalidada en cuanto la guardes.",
  };

  if (!user) {
    return (
      <AuthShell
        encabezado="Acceso"
        titulo="Esta liga ya no sirve"
        descripcion="Las ligas de recuperación son temporales y de un solo uso. Pide una nueva y vuelve a intentarlo."
        marca={marca}
      >
        <Link
          href="/recuperar"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-teal px-5 text-sm font-medium text-crema shadow-soft transition duration-150 hover:bg-teal-dark"
        >
          Pedir una liga nueva
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      encabezado="Acceso"
      titulo="Establece tu contraseña nueva"
      descripcion={
        <>
          Vas a cambiar la contraseña de{" "}
          <span className="font-medium text-ink">{user.email}</span>.
        </>
      }
      marca={marca}
    >
      <RestablecerForm />
    </AuthShell>
  );
}
