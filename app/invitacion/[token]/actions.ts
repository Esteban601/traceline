"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvento } from "@/lib/bitacora";
import { hashTokenInvitacion } from "@/lib/invitaciones";
import { validarPassword } from "@/lib/password";

export type EstablecerState = { error: string | null };

/**
 * Canjea una invitación: establece la contraseña que la persona eligió, marca la
 * liga como usada y la deja dentro de su portal.
 *
 * Corre con service_role a propósito: quien canjea AÚN NO tiene sesión (esa es
 * justo la razón de la invitación), así que no hay identidad contra la cual
 * evaluar RLS. La autorización la da el token: 256 bits aleatorios, de un solo
 * uso y con vencimiento, verificados aquí contra su SHA-256.
 */
export async function establecerContrasena(
  _prev: EstablecerState,
  fd: FormData
): Promise<EstablecerState> {
  const token = String(fd.get("token") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const confirmacion = String(fd.get("confirmacion") ?? "");

  if (!token) return { error: "La liga de invitación no es válida." };

  const errPassword = validarPassword(password, confirmacion);
  if (errPassword) return { error: errPassword };

  const admin = createAdminClient();

  const { data: invitacion } = await admin
    .from("invitaciones")
    .select("id, perfil_id, tenant_id, expira_en, usada_en")
    .eq("token_hash", hashTokenInvitacion(token))
    .maybeSingle();

  if (!invitacion) return { error: "Esta liga de invitación no existe." };
  // "Quien te dio el acceso" y no "IRStrat": desde el tier de autoservicio, la
  // liga la pudo emitir el administrador del propio cliente, y mandar a la gente
  // con la firma sería mandarla a quien no puede ayudarla.
  if (invitacion.usada_en) {
    return { error: "Esta liga ya se usó. Pide una nueva a quien te dio el acceso." };
  }
  if (new Date(invitacion.expira_en) < new Date()) {
    return { error: "Esta liga venció. Pide una nueva a quien te dio el acceso." };
  }

  const { data: perfilInvitado } = await admin
    .from("perfiles_usuario")
    .select("id, nombre, email, activo, tenant_id")
    .eq("id", invitacion.perfil_id)
    .single();

  if (!perfilInvitado) return { error: "El usuario de esta invitación ya no existe." };
  if (!perfilInvitado.activo) {
    return { error: "Este usuario está desactivado. Contacta a quien te dio el acceso." };
  }
  // Una invitación es un cambio de contraseña diferido, así que el perfil al que
  // apunta TIENE que ser del tenant que la emitió. Si no coinciden, la liga no se
  // canjea: aceptarla sería entregar una cuenta ajena a quien pudiera insertar la
  // fila. RLS ya lo impide (política restrictiva `invitaciones_perfil_del_tenant`);
  // esto es la segunda cerradura, porque esta acción corre con service_role y por
  // definición no pasa por RLS.
  if (perfilInvitado.tenant_id !== invitacion.tenant_id) {
    console.error(
      `[invitaciones] liga inconsistente ${invitacion.id}: perfil ${perfilInvitado.id} ` +
        `(tenant ${perfilInvitado.tenant_id}) vs invitación (tenant ${invitacion.tenant_id})`
    );
    return { error: "Esta liga de invitación no es válida." };
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("activo")
    .eq("id", invitacion.tenant_id)
    .single();
  if (!tenant?.activo) {
    // Si el cliente está desactivado, establecer la contraseña solo llevaría a
    // un rebote del middleware: se corta aquí y se dice por qué.
    return { error: "El acceso de tu organización está desactivado. Contacta al equipo de IRStrat." };
  }

  // "Un solo uso" se decide AQUÍ, no después: la UPDATE condicionada a
  // `usada_en is null` es atómica, y las filas que devuelve son la autorización.
  // Si dos envíos simultáneos llegan con la misma liga, solo uno la gana. Se
  // quema ANTES de tocar la contraseña para que nunca exista el caso de una
  // contraseña ya cambiada con la liga todavía viva.
  const { data: quemada, error: usoErr } = await admin
    .from("invitaciones")
    .update({ usada_en: new Date().toISOString() })
    .eq("id", invitacion.id)
    .is("usada_en", null)
    .select("id");

  if (usoErr) return { error: "No se pudo cerrar la invitación. Inténtalo de nuevo." };
  if (!quemada || quemada.length === 0) {
    return { error: "Esta liga ya se usó. Pide una nueva a quien te dio el acceso." };
  }

  const { error: authErr } = await admin.auth.admin.updateUserById(invitacion.perfil_id, {
    password,
  });
  if (authErr) {
    // La liga ya quedó quemada: es lo correcto (no puede reintentarse a ciegas),
    // y el staff puede generar otra desde el panel.
    return {
      error: `No se pudo establecer la contraseña: ${authErr.message}. Pide una liga nueva a quien te dio el acceso.`,
    };
  }

  // Canjear la invitación TAMBIÉN cierra un cambio forzado pendiente: la
  // contraseña que acaba de establecer es suya, no la temporal que alguien más
  // conocía. Sin esto, una cuenta con el flag encendido que entrara por la liga
  // quedaría rebotando a /restablecer para siempre.
  const { error: flagErr } = await admin
    .from("perfiles_usuario")
    .update({ debe_cambiar_password: false })
    .eq("id", invitacion.perfil_id);
  if (flagErr) {
    console.error("[invitacion] no se pudo apagar debe_cambiar_password:", flagErr.message);
  }

  await logEvento(admin, {
    tenantId: invitacion.tenant_id,
    usuarioId: perfilInvitado.id,
    accion: "invitacion_usada",
    entidad: "invitaciones",
    entidadId: invitacion.id,
    detalle: { email: perfilInvitado.email, nombre: perfilInvitado.nombre },
  });

  // Cortesía: si la sesión se puede abrir aquí, la persona entra directo. Si no,
  // el login normal con su contraseña recién establecida funciona igual.
  const db = await createClient();
  const { error: loginErr } = await db.auth.signInWithPassword({
    email: perfilInvitado.email,
    password,
  });

  redirect(loginErr ? "/login?listo=password" : "/portal");
}
