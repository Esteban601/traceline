import { createClient } from "@/lib/supabase/server";

export type PerfilActual = {
  id: string;
  nombre: string;
  area: string | null;
  rol: "cliente" | "coordinador" | "analista" | "admin";
  tenant_id: string | null;
  email: string;
};

/** Perfil del usuario autenticado (o null si no hay sesión / perfil). */
export async function getPerfilActual(): Promise<PerfilActual | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfiles_usuario")
    .select("id, nombre, area, rol, tenant_id, email")
    .eq("id", user.id)
    .single();

  return data;
}

/** ¿Es staff interno de IRStrat? (tenant_id NULL). */
export function esStaff(perfil: Pick<PerfilActual, "tenant_id">): boolean {
  return perfil.tenant_id === null;
}
