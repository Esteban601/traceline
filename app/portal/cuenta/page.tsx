import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { esAuditor, ROL_LABEL } from "@/lib/roles";
import { CuentaView } from "@/components/cuenta/cuenta-view";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function CuentaPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login");
  const db = await createClient();
  const { data } = await db
    .from("perfiles_usuario")
    .select("recibe_resumen_diario")
    .eq("id", perfil.id)
    .maybeSingle();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Portal de evidencia · Cuenta</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">Mi cuenta</h1>
      </header>
      <CuentaView
        nombre={perfil.nombre}
        email={perfil.email}
        rolLabel={perfil.tenant_id === null ? `IRStrat · ${ROL_LABEL[perfil.rol]}` : ROL_LABEL[perfil.rol]}
        recibe={data?.recibe_resumen_diario ?? true}
        esAuditor={esAuditor(perfil)}
      />
    </div>
  );
}
