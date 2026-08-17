import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; listo?: string; error?: string }>;
}) {
  const { next, listo, error } = await searchParams;

  return (
    <AuthShell
      titulo="Te damos la bienvenida"
      descripcion="Ingresa con tu correo para continuar a tu portal de evidencia."
      marca={{
        titulo: "Evidencia trazable para NIIF S1/S2.",
        texto:
          "Recibe tus solicitudes de información, carga evidencia versionada y sigue su validación de principio a fin, lista para el aseguramiento del Informe Anual Sustentable.",
      }}
    >
      {listo === "password" && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-verde/25 bg-verde/10 px-3.5 py-2.5 text-sm text-verde"
        >
          Tu contraseña quedó lista. Ingresa con ella para continuar.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-rojo/25 bg-rojo/10 px-3.5 py-2.5 text-sm leading-relaxed text-rojo"
        >
          {error === "cliente_inactivo"
            ? "El acceso de tu organización está desactivado. Contacta al equipo de IRStrat."
            : "Esa liga venció o ya se usó. Pide una nueva desde “¿Olvidaste tu contraseña?”."}
        </p>
      )}
      <LoginForm next={next ?? "/portal"} />
    </AuthShell>
  );
}
