import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
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
  if (!puedeEntrarPanel(perfil)) redirect("/portal");

  // El administrador del cliente ve SU marca en el panel, no la de IRStrat.
  const tenant = esStaff(perfil) ? null : await getTenantDe(perfil);
  if (tenant && !tenant.activo) redirect("/login?error=cliente_inactivo");

  return (
    <div className="flex min-h-dvh">
      <AdminSidebar perfil={perfil} tenant={tenant} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
