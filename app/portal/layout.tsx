import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getPerfilActual } from "@/lib/data";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilActual();

  // El middleware garantiza sesión; si falta el perfil de negocio, no hay portal.
  if (!perfil) redirect("/login");

  return (
    <div className="min-h-dvh">
      <Header perfil={perfil} />
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
