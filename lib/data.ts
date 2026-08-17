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

export type TenantActual = {
  id: string;
  nombre: string;
  logo_url: string | null;
  prefijo_folio: string;
  activo: boolean;
};

/**
 * Tenant del perfil dado (null para el staff de IRStrat, que no tiene uno). Es
 * lo que el portal necesita para mostrar la marca DEL CLIENTE en su header.
 */
export async function getTenantDe(
  perfil: Pick<PerfilActual, "tenant_id">
): Promise<TenantActual | null> {
  if (perfil.tenant_id === null) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("id, nombre, logo_url, prefijo_folio, activo")
    .eq("id", perfil.tenant_id)
    .single();

  return data;
}
