"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPerfilActual, esStaff } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";
import { esRolClienteValido, generarPasswordTemporal } from "@/lib/gestion";

export type AltaUsuarioState = {
  ok: boolean;
  error?: string | null;
  // Datos devueltos UNA vez tras un alta exitosa (para mostrar la contraseña).
  creado?: {
    nombre: string;
    email: string;
    passwordTemporal: string;
  } | null;
};

export type ActivoState = { ok: boolean; error?: string | null; mensaje?: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Alta de un usuario del cliente. Crea el usuario en auth (service_role, admin
 * API) con una contraseña temporal, y su perfil de negocio. Devuelve la
 * contraseña UNA vez para que el staff la comparta (en staging sin Resend no hay
 * invitación por correo — documentado como mejora de producción).
 */
export async function crearUsuario(
  _prev: AltaUsuarioState,
  fd: FormData
): Promise<AltaUsuarioState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const nombre = String(fd.get("nombre") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const rol = String(fd.get("rol") ?? "").trim();
  const areaRaw = String(fd.get("area") ?? "").trim();
  const tenantId = String(fd.get("tenant_id") ?? "").trim();

  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "El correo no es válido." };
  if (!esRolClienteValido(rol)) return { ok: false, error: "Rol no válido." };
  if (!tenantId) return { ok: false, error: "Selecciona el cliente (tenant)." };

  // El área solo aplica al rol 'cliente' (acota su visibilidad); el coordinador
  // ve todo su tenant.
  const area = rol === "cliente" ? (areaRaw || null) : null;

  const db = await createClient();

  const { data: tenant } = await db
    .from("tenants")
    .select("id, nombre")
    .eq("id", tenantId)
    .single();
  if (!tenant) return { ok: false, error: "El cliente (tenant) no existe." };

  const admin = createAdminClient();
  const passwordTemporal = generarPasswordTemporal();

  const { data: creado, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: passwordTemporal,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (authErr || !creado.user) {
    const dup = authErr?.message?.toLowerCase().includes("already");
    return {
      ok: false,
      error: dup
        ? "Ya existe un usuario con ese correo."
        : `No se pudo crear el usuario: ${authErr?.message ?? "error desconocido"}.`,
    };
  }

  const userId = creado.user.id;

  // Perfil de negocio (RLS: perfiles_staff_write permite al staff insertar).
  const { error: perfErr } = await db.from("perfiles_usuario").insert({
    id: userId,
    tenant_id: tenantId,
    rol,
    area,
    nombre,
    email,
    activo: true,
  });

  if (perfErr) {
    // Rollback: sin perfil, el usuario auth quedaría huérfano. Se elimina.
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "No se pudo crear el perfil del usuario." };
  }

  await logEvento(db, {
    tenantId,
    usuarioId: perfil.id,
    accion: "usuario_creado",
    entidad: "perfiles_usuario",
    entidadId: userId,
    detalle: { nombre, email, rol, area, tenant: tenant.nombre },
  });

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    error: null,
    creado: { nombre, email, passwordTemporal },
  };
}

/**
 * Desactiva o reactiva un usuario del cliente (nunca lo elimina). Marca el perfil
 * y banea/desbanea el usuario en auth para revocar/restaurar el acceso.
 */
export async function cambiarActivoUsuario(
  usuarioId: string,
  activar: boolean
): Promise<ActivoState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }
  if (!usuarioId) return { ok: false, error: "Usuario no válido." };

  const db = await createClient();

  const { data: objetivo } = await db
    .from("perfiles_usuario")
    .select("id, nombre, tenant_id")
    .eq("id", usuarioId)
    .single();

  if (!objetivo) return { ok: false, error: "No se encontró el usuario." };
  if (objetivo.tenant_id === null) {
    return { ok: false, error: "Solo se gestionan usuarios del cliente aquí." };
  }

  const { error: upErr } = await db
    .from("perfiles_usuario")
    .update({ activo: activar })
    .eq("id", usuarioId);
  if (upErr) return { ok: false, error: "No se pudo actualizar el usuario." };

  // Ban/unban en auth para que el bloqueo sea efectivo a nivel de login.
  const admin = createAdminClient();
  const { error: banErr } = await admin.auth.admin.updateUserById(usuarioId, {
    ban_duration: activar ? "none" : "876000h", // ~100 años = baneado
  });
  if (banErr) {
    // El perfil ya se marcó; se revierte para mantener coherencia.
    await db.from("perfiles_usuario").update({ activo: !activar }).eq("id", usuarioId);
    return { ok: false, error: "No se pudo actualizar el acceso del usuario." };
  }

  await logEvento(db, {
    tenantId: objetivo.tenant_id,
    usuarioId: perfil.id,
    accion: activar ? "usuario_reactivado" : "usuario_desactivado",
    entidad: "perfiles_usuario",
    entidadId: usuarioId,
    detalle: { nombre: objetivo.nombre },
  });

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    error: null,
    mensaje: activar ? "Usuario reactivado." : "Usuario desactivado.",
  };
}
