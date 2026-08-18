import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  esAdminCliente as esAdminClienteRol,
  esAdminIrstrat as esAdminIrstratRol,
  puedeEntrarPanel as puedeEntrarPanelRol,
  type Rol,
} from "@/lib/roles";

export type PerfilActual = {
  id: string;
  nombre: string;
  area: string | null;
  rol: Rol;
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

/**
 * ¿Es administrador DEL CLIENTE (tier de autoservicio)? Entra al panel como el
 * staff, pero acotado a su propio tenant. Espejo de `fn_is_admin_cliente()`.
 */
export function esAdminCliente(
  perfil: Pick<PerfilActual, "rol" | "tenant_id">
): boolean {
  return esAdminClienteRol(perfil);
}

/** ¿Este perfil entra al PANEL (`/admin`) en vez del portal simple? */
export function puedeEntrarPanel(
  perfil: Pick<PerfilActual, "rol" | "tenant_id">
): boolean {
  return puedeEntrarPanelRol(perfil);
}

/** ¿Es el rol `admin` de IRStrat? (congelar reportes, toggle de carga staff). */
export function esAdminIrstrat(
  perfil: Pick<PerfilActual, "rol" | "tenant_id">
): boolean {
  return esAdminIrstratRol(perfil);
}

export type TenantActual = {
  id: string;
  nombre: string;
  logo_url: string | null;
  prefijo_folio: string;
  activo: boolean;
  /** ¿IRStrat tiene habilitada la carga de evidencia para este cliente? */
  staff_puede_cargar: boolean;
};

/**
 * Tenant del perfil dado (null para el staff de IRStrat, que no tiene uno). Es
 * lo que el portal necesita para mostrar la marca DEL CLIENTE en su header, y lo
 * que el panel del administrador del cliente usa para su propio branding.
 */
export async function getTenantDe(
  perfil: Pick<PerfilActual, "tenant_id">
): Promise<TenantActual | null> {
  if (perfil.tenant_id === null) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("id, nombre, logo_url, prefijo_folio, activo, staff_puede_cargar")
    .eq("id", perfil.tenant_id)
    .single();

  return data;
}

/**
 * Guarda de página para las secciones del panel reservadas a IRStrat
 * (`/admin/clientes`, `/admin/reportes`, `/admin/plantillas` y la captura de
 * taxonomía). El middleware ya rebota esas rutas para el administrador del
 * cliente; esto es la defensa en profundidad a nivel de página: una URL pegada a
 * mano —o un cambio futuro en el matcher del middleware— no debe alcanzar a
 * renderizar la sección. Devuelve el perfil para no repetir la consulta.
 */
export async function requiereStaff(): Promise<PerfilActual> {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login");
  if (!esStaff(perfil)) redirect("/admin");
  return perfil;
}
