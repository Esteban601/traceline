import type { Database } from "@/lib/database.types";

// =============================================================================
// Matriz de permisos por ROL — fuente única compartida por el middleware, los
// layouts, la UI y las server actions.
//
// La autoridad real es la BASE (RLS + triggers de la migración
// 20260820130000_admin_cliente). Este archivo NO es la seguridad: es la misma
// regla escrita una vez para que la UI no ofrezca lo que el servidor rechazaría
// y para que cada server action tenga un solo lugar donde consultarla.
//
// Tres actores:
//   * staff IRStrat        — perfil sin tenant (`analista` | `admin`). Ve todo.
//   * admin_cliente        — usuario DEL CLIENTE que administra su propio tenant
//                            (tier de autoservicio). Entra al PANEL, acotado.
//   * jefe_area            — JEFE de un área del cliente, en el PORTAL. Ve y carga
//                            lo de SU área (como el responsable) y además da o
//                            retira el VISTO BUENO DEL ÁREA. No valida.
//   * cliente / coordinador — usuarios del cliente en el PORTAL. Sin cambios.
// =============================================================================

export type Rol = Database["public"]["Enums"]["rol_usuario"];

/** Identidad mínima que basta para resolver permisos. */
export type IdentidadRol = { rol: Rol; tenant_id: string | null };

/** ¿Es staff interno de IRStrat? (tenant_id NULL, igual que `fn_is_staff()`). */
export function esStaffRol(p: IdentidadRol): boolean {
  return p.tenant_id === null;
}

/**
 * ¿Es administrador DEL CLIENTE? Espejo de `fn_is_admin_cliente()`: rol
 * `admin_cliente` **con** tenant. Un perfil sin tenant nunca lo es (sería staff).
 */
export function esAdminCliente(p: IdentidadRol): boolean {
  return p.rol === "admin_cliente" && p.tenant_id !== null;
}

/**
 * ¿Es JEFE de un área del cliente? El rol tiene los permisos del responsable de
 * área más el visto bueno del área. Vive en el PORTAL, no en el panel: su trabajo
 * es revisar lo que su gente entrega, no administrar la emisora.
 */
export function esJefeArea(p: IdentidadRol): boolean {
  return p.rol === "jefe_area" && p.tenant_id !== null;
}

/**
 * Roles del cliente ACOTADOS A SU ÁREA. Es la misma lista que la base usa en
 * `fn_puede_ver_solicitud` y en `solicitudes_select`: si aquí y allá dejan de
 * coincidir, la UI ofrecería lo que RLS filtra (o peor, al revés).
 */
export const ROLES_DE_AREA: readonly Rol[] = ["cliente", "jefe_area"] as const;

export function esRolDeArea(p: IdentidadRol): boolean {
  return ROLES_DE_AREA.includes(p.rol) && p.tenant_id !== null;
}

/** ¿Este perfil entra al PANEL (`/admin`) y no al portal simple? */
export function puedeEntrarPanel(p: IdentidadRol): boolean {
  return esStaffRol(p) || esAdminCliente(p);
}

/** ¿Es el rol `admin` de IRStrat (congelar reportes, toggle de carga staff)? */
export function esAdminIrstrat(p: IdentidadRol): boolean {
  return esStaffRol(p) && p.rol === "admin";
}

// -----------------------------------------------------------------------------
// Secciones del panel
// -----------------------------------------------------------------------------

export type SeccionPanel =
  | "matriz"
  | "bitacora"
  | "cobertura"
  | "registros"
  | "objetivos"
  | "cuestionarios"
  | "perfil"
  | "reportes"
  | "plantillas"
  | "clientes"
  | "usuarios";

/**
 * Lo que ve el administrador del cliente: SU matriz, SU cobertura (con el export
 * de su Excel), SU bitácora y la gestión de usuarios y áreas de su tenant.
 *
 * Fuera quedan, por diseño: `/admin/clientes` (es multi-emisora), `/admin/reportes`
 * (crear y **congelar** siguen siendo actos de IRStrat), `/admin/plantillas` (los
 * checklists son de la firma) y la captura de taxonomía (clima, objetivos,
 * cuestionarios), que es trabajo de analista.
 */
export const SECCIONES_ADMIN_CLIENTE: readonly SeccionPanel[] = [
  "matriz",
  "cobertura",
  "bitacora",
  // El perfil del emisor es de la emisora, no de la firma: quien mejor puede
  // redactar su carta de la Dirección y su modelo de negocio es ella. IRStrat
  // entra al mismo formulario con selector de emisora.
  "perfil",
  "usuarios",
] as const;

export function puedeVerSeccion(seccion: SeccionPanel, p: IdentidadRol): boolean {
  if (esStaffRol(p)) return true;
  if (esAdminCliente(p)) return SECCIONES_ADMIN_CLIENTE.includes(seccion);
  return false;
}

/**
 * Rutas del panel reservadas al staff. Se comprueban por prefijo en el
 * middleware **y** en cada página (defensa en profundidad): una URL pegada a
 * mano rebota igual que un enlace escondido.
 */
export const RUTAS_SOLO_STAFF: readonly string[] = [
  "/admin/clientes",
  "/admin/reportes",
  "/admin/plantillas",
  "/admin/registros",
  "/admin/objetivos",
  "/admin/cuestionarios",
] as const;

export function rutaSoloStaff(pathname: string): boolean {
  return RUTAS_SOLO_STAFF.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

// -----------------------------------------------------------------------------
// Roles asignables al dar de alta un usuario
// -----------------------------------------------------------------------------

export type OpcionRol = { value: Rol; label: string; ayuda: string };

const ROL_AREA: OpcionRol = {
  value: "cliente",
  label: "Responsable de área",
  ayuda: "Ve y responde solo las solicitudes de su área.",
};
const ROL_JEFE_AREA: OpcionRol = {
  value: "jefe_area",
  label: "Jefe de área",
  ayuda:
    "Ve y carga lo de su área, y da el visto bueno del área a lo que su equipo entrega.",
};
const ROL_COORDINADOR: OpcionRol = {
  value: "coordinador",
  label: "Coordinador",
  ayuda: "Ve todas las solicitudes de su cliente, sin poder administrarlo.",
};
const ROL_ADMIN_CLIENTE: OpcionRol = {
  value: "admin_cliente",
  label: "Administrador del cliente",
  ayuda:
    "Administra su propio cliente: crea solicitudes internas, las valida y gestiona usuarios y áreas.",
};

/** Roles que puede asignar el STAFF de IRStrat a un usuario del cliente. */
export const ROLES_ASIGNABLES_STAFF: readonly OpcionRol[] = [
  ROL_AREA,
  ROL_JEFE_AREA,
  ROL_COORDINADOR,
  ROL_ADMIN_CLIENTE,
] as const;

/**
 * Roles que puede asignar el ADMINISTRADOR DEL CLIENTE: los de área —responsable
 * y jefe— y otro administrador como él. Nunca staff (no aparece y la server action
 * lo rechaza) y tampoco `coordinador`, que sigue siendo designación de IRStrat.
 */
export const ROLES_ASIGNABLES_ADMIN_CLIENTE: readonly OpcionRol[] = [
  ROL_AREA,
  ROL_JEFE_AREA,
  ROL_ADMIN_CLIENTE,
] as const;

export function rolesAsignablesPor(p: IdentidadRol): readonly OpcionRol[] {
  if (esStaffRol(p)) return ROLES_ASIGNABLES_STAFF;
  if (esAdminCliente(p)) return ROLES_ASIGNABLES_ADMIN_CLIENTE;
  return [];
}

/** ¿Quien administra puede asignar ESE rol? Espejo del WITH CHECK de RLS. */
export function puedeAsignarRol(p: IdentidadRol, rol: string): rol is Rol {
  return rolesAsignablesPor(p).some((r) => r.value === rol);
}

/**
 * ¿El rol necesita área asignada? Los dos roles acotados por área: el responsable
 * y su jefe. Sin área, un jefe de área no es jefe de nada — y `fn_es_jefe_de_area`
 * devolvería false para todo.
 */
export function rolRequiereArea(rol: Rol): boolean {
  return ROLES_DE_AREA.includes(rol);
}

/**
 * Etiqueta corta del rol, para la bitácora, el pie del menú y las listas de
 * usuarios. Los roles de la firma NO repiten "IRStrat" en su etiqueta: quien los
 * muestra ya antepone la organización (ver `actorBitacora`), y "IRStrat · Admin
 * IRStrat" se leía como un tartamudeo.
 */
export const ROL_LABEL: Record<Rol, string> = {
  cliente: "Responsable de área",
  jefe_area: "Jefe de área",
  coordinador: "Coordinador",
  admin_cliente: "Administrador del cliente",
  analista: "Analista",
  admin: "Administrador",
};

/** Etiqueta de la organización a la que pertenece el rol. */
export function organizacionDeRol(p: IdentidadRol): string {
  return esStaffRol(p) ? "IRStrat" : "Cliente";
}

/**
 * Cómo se nombra a un actor en la bitácora y en los timelines: nombre + rol, con
 * la organización cuando es de IRStrat. La bitácora registra los actos del
 * administrador del cliente igual que los del staff, así que el ROL tiene que ser
 * visible — si no, dos actos idénticos se leerían como del mismo lado.
 */
export function actorBitacora(
  nombre: string | null,
  rol: Rol | null,
  tenantId: string | null | undefined
): string {
  if (!nombre) return "Sistema";
  const limpio = nombre.replace(/\[DEMO\]\s*/i, "").trim();
  if (!rol) return limpio;
  const etiqueta = tenantId === null ? `IRStrat · ${ROL_LABEL[rol]}` : ROL_LABEL[rol];
  return `${limpio} · ${etiqueta}`;
}
