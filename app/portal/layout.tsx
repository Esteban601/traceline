import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { BannerDemo } from "@/components/banner-demo";
import { getPerfilActual, getTenantDe } from "@/lib/data";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilActual();

  // El middleware garantiza sesión; si falta el perfil de negocio, no hay portal.
  if (!perfil) redirect("/login");

  // Contraseña temporal: nada se renderiza antes del cambio. El middleware ya lo
  // rutea; esto es la defensa en profundidad a nivel de layout.
  if (perfil.debe_cambiar_password) redirect("/restablecer");

  const tenant = await getTenantDe(perfil);

  // Cliente desactivado: no se renderiza el portal. El middleware ya corta el
  // acceso en cada request; esto es la defensa en profundidad a nivel de layout,
  // igual que el /admin comprueba que quien entra sea staff.
  if (tenant && !tenant.activo) redirect("/login?error=cliente_inactivo");

  return (
    <div className="min-h-dvh">
      {/* Solo la emisora de demostración se anuncia como tal. */}
      {tenant?.es_demo ? <BannerDemo /> : null}
      <Header perfil={perfil} tenant={tenant} />
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
