import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin-header";
import { getPerfilActual, esStaff } from "@/lib/data";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilActual();

  // El middleware ya rutea por rol; esta es la defensa en profundidad a nivel de
  // layout (nunca renderiza el panel interno para un no-staff).
  if (!perfil) redirect("/login");
  if (!esStaff(perfil)) redirect("/portal");

  return (
    <div className="min-h-dvh">
      <AdminHeader perfil={perfil} />
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
