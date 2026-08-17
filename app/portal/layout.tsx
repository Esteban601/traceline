import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getPerfilActual, getTenantDe } from "@/lib/data";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilActual();

  // El middleware garantiza sesión; si falta el perfil de negocio, no hay portal.
  if (!perfil) redirect("/login");

  const tenant = await getTenantDe(perfil);

  // Cliente desactivado: no se renderiza el portal. El middleware ya corta el
  // acceso en cada request; esto es la defensa en profundidad a nivel de layout,
  // igual que el /admin comprueba que quien entra sea staff.
  if (tenant && !tenant.activo) redirect("/login?error=cliente_inactivo");

  return (
    <div className="min-h-dvh">
      <Header perfil={perfil} tenant={tenant} />
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
