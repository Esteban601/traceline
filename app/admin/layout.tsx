import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { BannerDemo } from "@/components/banner-demo";
import { getPerfilActual, getTenantDe, esStaff, puedeEntrarPanel } from "@/lib/data";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilActual();

  // El middleware ya rutea por rol; esta es la defensa en profundidad a nivel de
  // layout (nunca renderiza el panel para quien no entra: solo el staff de
  // IRStrat y el administrador del cliente).
  if (!perfil) redirect("/login");
  if (perfil.debe_cambiar_password) redirect("/restablecer");
  if (!puedeEntrarPanel(perfil)) redirect("/portal");

  // El administrador del cliente ve SU marca en el panel, no la de IRStrat.
  const tenant = esStaff(perfil) ? null : await getTenantDe(perfil);
  if (tenant && !tenant.activo) redirect("/login?error=cliente_inactivo");

  // La franja de demostración es del TENANT DE LA SESIÓN. El administrador del
  // cliente tiene uno, así que aquí se resuelve igual que en el portal. El staff
  // de IRStrat no tiene tenant: sirve a todos y cambia de emisora con `?tenant=`
  // dentro de cada pantalla, un dato que un layout no recibe. En su panel la
  // demo se distingue por el prefijo [DEMO] del nombre —selector, matriz y
  // nombre del archivo exportado—, no por esta franja.
  // La franja va en la COLUMNA DE CONTENIDO, no sobre todo el ancho: el menú es
  // `sticky top-0 h-dvh`, así que empujarlo hacia abajo dejaría el panel con 28 px
  // de scroll permanente. Aquí la geometría del menú no cambia y la franja queda
  // igual de arriba, donde va la mirada.
  return (
    <div className="flex min-h-dvh">
      <AdminSidebar perfil={perfil} tenant={tenant} />
      <div className="flex min-w-0 flex-1 flex-col">
        {tenant?.es_demo ? <BannerDemo /> : null}
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
