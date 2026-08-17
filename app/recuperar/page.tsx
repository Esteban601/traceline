import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { RecuperarForm } from "./recuperar-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage() {
  return (
    <AuthShell
      encabezado="Acceso"
      titulo="¿Olvidaste tu contraseña?"
      descripcion="Escribe tu correo y te enviamos una liga para establecer una nueva."
      marca={{
        titulo: "Recupera tu acceso en un paso.",
        texto:
          "Te enviamos una liga temporal a tu correo. Desde ahí eliges una contraseña nueva y vuelves a tu portal de evidencia.",
      }}
    >
      <RecuperarForm />
    </AuthShell>
  );
}
