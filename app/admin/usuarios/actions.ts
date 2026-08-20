"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPerfilActual,
  esStaff,
  esAdminCliente,
  puedeEntrarPanel,
  type PerfilActual,
} from "@/lib/data";
import { logEvento } from "@/lib/bitacora";
import { generarPasswordTemporal } from "@/lib/gestion";
import { AREA_MAX } from "@/lib/tenants";
import { puedeAsignarRol, rolRequiereArea, ROL_LABEL } from "@/lib/roles";
import { enviarCorreo, modoConsola, plantillaInvitacion } from "@/lib/email";
import {
  INVITACION_HORAS,
  expiracionInvitacion,
  generarTokenInvitacion,
  hashTokenInvitacion,
  urlInvitacion,
} from "@/lib/invitaciones";

export type Invitacion = {
  url: string;
  /** ISO del vencimiento de la liga. */
  expiraEn: string;
  horas: number;
};

export type AltaUsuarioState = {
  ok: boolean;
  error?: string | null;
  // Datos devueltos UNA vez tras un alta exitosa (para mostrar la contraseña).
  creado?: {
    nombre: string;
    email: string;
    passwordTemporal: string;
    /** Liga de invitación de un solo uso. Null si no se pudo generar. */
    invitacion: Invitacion | null;
  } | null;
};

export type InvitacionState = {
  ok: boolean;
  error?: string | null;
  mensaje?: string | null;
  invitacion?: (Invitacion & { nombre: string; email: string }) | null;
};

export type ActivoState = { ok: boolean; error?: string | null; mensaje?: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Alta de un usuario del cliente. Crea el usuario en auth (service_role, admin
 * API) con una contraseña temporal, y su perfil de negocio. Devuelve la
 * contraseña UNA vez para que quien da el alta la comparta (en staging sin Resend
 * no hay invitación por correo — documentado como mejora de producción).
 *
 * Dan de alta el STAFF (cualquier cliente, cualquier rol de cliente) y el
 * ADMINISTRADOR DEL CLIENTE (solo SU cliente, y solo con rol de área u otro
 * administrador como él). El `tenant_id` del formulario se IGNORA para el
 * administrador del cliente: se toma del perfil, así que un id manipulado no
 * puede sembrar un usuario en otra emisora. La misma regla está en RLS
 * (`perfiles_admin_cliente_insert`), que es la barrera real.
 */
export async function crearUsuario(
  _prev: AltaUsuarioState,
  fd: FormData
): Promise<AltaUsuarioState> {
  const perfil = await getPerfilActual();
  if (!perfil || !puedeEntrarPanel(perfil)) {
    return { ok: false, error: "Acción reservada al panel de seguimiento." };
  }

  const nombre = String(fd.get("nombre") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const rol = String(fd.get("rol") ?? "").trim();
  const areaRaw = String(fd.get("area") ?? "").trim();
  // El tenant del formulario solo cuenta si quien da de alta es staff.
  const tenantId = esStaff(perfil)
    ? String(fd.get("tenant_id") ?? "").trim()
    : (perfil.tenant_id ?? "");

  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "El correo no es válido." };
  if (!puedeAsignarRol(perfil, rol)) {
    return {
      ok: false,
      error: esStaff(perfil)
        ? "Rol no válido."
        : "Solo puedes dar de alta responsables de área u otro administrador de tu organización.",
    };
  }
  if (!tenantId) return { ok: false, error: "Selecciona el cliente (tenant)." };

  // El área solo aplica al rol de área (acota su visibilidad); el coordinador y
  // el administrador del cliente ven todo su tenant.
  const area = rolRequiereArea(rol) ? (areaRaw || null) : null;

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
    detalle: { nombre, email, rol, area, tenant: tenant.nombre, rol_label: ROL_LABEL[rol] },
  });

  // La contraseña temporal sigue existiendo como red de seguridad; la vía
  // preferente es la liga: la persona establece SU contraseña, no una prestada.
  const invitacion = await crearInvitacion(db, {
    perfilId: userId,
    tenantId,
    tenantNombre: tenant.nombre,
    nombre,
    email,
    creadaPor: perfil.id,
  });

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    error: null,
    creado: { nombre, email, passwordTemporal, invitacion },
  };
}

/**
 * Crea la invitación de un solo uso, la registra en bitácora y dispara el correo
 * (en modo consola queda en el log). Devuelve la liga para que el panel se la
 * muestre al staff: en staging, sin Resend, ESA es la vía de entrega.
 *
 * No revienta el alta si algo falla: el usuario ya existe y tiene contraseña
 * temporal; la invitación se puede regenerar después.
 */
async function crearInvitacion(
  db: Awaited<ReturnType<typeof createClient>>,
  params: {
    perfilId: string;
    tenantId: string;
    tenantNombre: string;
    nombre: string;
    email: string;
    creadaPor: string;
  }
): Promise<Invitacion | null> {
  const token = generarTokenInvitacion();
  const expira = expiracionInvitacion();

  const { data: fila, error } = await db
    .from("invitaciones")
    .insert({
      perfil_id: params.perfilId,
      tenant_id: params.tenantId,
      token_hash: hashTokenInvitacion(token),
      expira_en: expira.toISOString(),
      creada_por: params.creadaPor,
    })
    .select("id")
    .single();

  if (error || !fila) {
    console.error("[invitaciones] no se pudo crear la invitación:", error?.message);
    return null;
  }

  const url = urlInvitacion(token);

  const envio = await enviarCorreo(
    params.email,
    plantillaInvitacion(params.nombre, {
      url,
      expiraEn: expira.toISOString(),
      cliente: params.tenantNombre,
      horas: INVITACION_HORAS,
    })
  );
  if (!envio.ok) {
    console.error("[invitaciones] no se pudo enviar el correo:", envio.error);
  }
  if (modoConsola()) {
    console.log(
      [
        "",
        "──────────────── 🔑 LIGA DE INVITACIÓN (modo consola) ────────────────",
        `  Para:  ${params.email}`,
        `  Liga:  ${url}`,
        `  Vence: ${expira.toISOString()} (${INVITACION_HORAS} h, un solo uso)`,
        "──────────────────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
  }

  await logEvento(db, {
    tenantId: params.tenantId,
    usuarioId: params.creadaPor,
    accion: "invitacion_creada",
    entidad: "invitaciones",
    entidadId: fila.id,
    detalle: {
      email: params.email,
      nombre: params.nombre,
      expira_en: expira.toISOString(),
      modo: envio.modo,
    },
  });

  return { url, expiraEn: expira.toISOString(), horas: INVITACION_HORAS };
}

/**
 * ¿Este perfil puede administrar a ESE usuario del cliente? El staff, a
 * cualquiera; el administrador del cliente, solo a los de su tenant y solo con
 * los roles que él mismo puede asignar (el `coordinador` sigue siendo designación
 * de IRStrat). Espejo de `perfiles_admin_cliente_update` en RLS.
 *
 * La lista NO se repite aquí: se pregunta a `puedeAsignarRol`, que es la misma
 * fuente que alimenta el selector del alta. Cuando entró el rol `jefe_area`, una
 * lista escrita a mano en este archivo lo habría dejado creable pero no
 * administrable — dado de alta y sin poder desactivarlo.
 */
function puedeAdministrarUsuario(
  perfil: PerfilActual,
  objetivo: { tenant_id: string | null; rol: string }
): boolean {
  if (esStaff(perfil)) return true;
  if (!esAdminCliente(perfil)) return false;
  if (objetivo.tenant_id === null || objetivo.tenant_id !== perfil.tenant_id) return false;
  return puedeAsignarRol(perfil, objetivo.rol);
}

/**
 * Regenera la invitación de un usuario existente (la anterior venció o se
 * perdió). Cada liga es independiente: la nueva no invalida a las anteriores,
 * pero todas caducan solas y son de un solo uso.
 */
export async function regenerarInvitacion(usuarioId: string): Promise<InvitacionState> {
  const perfil = await getPerfilActual();
  if (!perfil || !puedeEntrarPanel(perfil)) {
    return { ok: false, error: "Acción reservada al panel de seguimiento." };
  }
  if (!usuarioId) return { ok: false, error: "Usuario no válido." };

  const db = await createClient();

  const { data: objetivo } = await db
    .from("perfiles_usuario")
    .select("id, nombre, email, activo, tenant_id, rol")
    .eq("id", usuarioId)
    .single();

  if (!objetivo) return { ok: false, error: "No se encontró el usuario." };
  if (!objetivo.tenant_id) {
    return { ok: false, error: "Solo se invitan usuarios del cliente." };
  }
  if (!puedeAdministrarUsuario(perfil, objetivo)) {
    return { ok: false, error: "No puedes administrar a este usuario." };
  }
  if (!objetivo.activo) {
    return { ok: false, error: "El usuario está desactivado: reactívalo antes de invitarlo." };
  }

  const { data: tenant } = await db
    .from("tenants")
    .select("nombre, activo")
    .eq("id", objetivo.tenant_id)
    .single();

  if (!tenant?.activo) {
    return {
      ok: false,
      error: "El cliente está desactivado: reactívalo antes de invitar a sus usuarios.",
    };
  }

  const invitacion = await crearInvitacion(db, {
    perfilId: objetivo.id,
    tenantId: objetivo.tenant_id,
    tenantNombre: tenant?.nombre ?? "",
    nombre: objetivo.nombre,
    email: objetivo.email,
    creadaPor: perfil.id,
  });

  if (!invitacion) return { ok: false, error: "No se pudo generar la invitación." };

  return {
    ok: true,
    error: null,
    mensaje: "Invitación generada. Compártela por el canal que uses.",
    invitacion: { ...invitacion, nombre: objetivo.nombre, email: objetivo.email },
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
  if (!perfil || !puedeEntrarPanel(perfil)) {
    return { ok: false, error: "Acción reservada al panel de seguimiento." };
  }
  if (!usuarioId) return { ok: false, error: "Usuario no válido." };
  // Quedarse fuera de su propio panel no es una acción útil, es un pie en falso.
  if (usuarioId === perfil.id && !activar) {
    return { ok: false, error: "No puedes desactivar tu propio acceso." };
  }

  const db = await createClient();

  const { data: objetivo } = await db
    .from("perfiles_usuario")
    .select("id, nombre, tenant_id, rol")
    .eq("id", usuarioId)
    .single();

  if (!objetivo) return { ok: false, error: "No se encontró el usuario." };
  if (objetivo.tenant_id === null) {
    return { ok: false, error: "Solo se gestionan usuarios del cliente aquí." };
  }
  if (!puedeAdministrarUsuario(perfil, objetivo)) {
    return { ok: false, error: "No puedes administrar a este usuario." };
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

// =============================================================================
// Áreas del cliente (catálogo `areas_tenant`)
//
// Las gestionan el staff y el ADMINISTRADOR DEL CLIENTE de ese tenant (RLS:
// `areas_tenant_admin_cliente_insert/update`). No se borran: se desactivan — el
// nombre del área vive como texto en las solicitudes y en la evidencia ya
// entregada, y borrar el catálogo no borraría esa historia, solo la dejaría sin
// referencia.
// =============================================================================

export type AreaState = { ok: boolean; error?: string | null; mensaje?: string | null };

/** Tenant sobre el que este perfil puede gestionar áreas, o null si no puede. */
async function tenantParaAreas(
  perfil: PerfilActual,
  tenantIdSolicitado: string
): Promise<string | null> {
  if (esStaff(perfil)) return tenantIdSolicitado || null;
  if (!esAdminCliente(perfil)) return null;
  // Se ignora el id del formulario: el administrador del cliente solo opera el suyo.
  return perfil.tenant_id;
}

function normalizarNombreArea(bruto: string): string {
  return bruto.trim().replace(/\s+/g, " ").slice(0, AREA_MAX);
}

export async function crearArea(tenantId: string, nombre: string): Promise<AreaState> {
  const perfil = await getPerfilActual();
  if (!perfil || !puedeEntrarPanel(perfil)) {
    return { ok: false, error: "Acción reservada al panel de seguimiento." };
  }
  const tenant = await tenantParaAreas(perfil, tenantId);
  if (!tenant) return { ok: false, error: "Cliente no válido." };

  const limpio = normalizarNombreArea(nombre);
  if (!limpio) return { ok: false, error: "Escribe el nombre del área." };

  const db = await createClient();

  const { data: existentes } = await db
    .from("areas_tenant")
    .select("id, nombre, orden, activo")
    .eq("tenant_id", tenant);

  const yaEsta = (existentes ?? []).find(
    (a) => a.nombre.toLocaleLowerCase("es") === limpio.toLocaleLowerCase("es")
  );
  if (yaEsta) {
    return {
      ok: false,
      error: yaEsta.activo
        ? `El área “${yaEsta.nombre}” ya existe en este cliente.`
        : `El área “${yaEsta.nombre}” existe pero está desactivada: reactívala en vez de crearla otra vez.`,
    };
  }

  const orden = Math.max(0, ...(existentes ?? []).map((a) => a.orden)) + 1;

  const { data: creada, error } = await db
    .from("areas_tenant")
    .insert({ tenant_id: tenant, nombre: limpio, orden })
    .select("id")
    .single();
  if (error || !creada) {
    return { ok: false, error: "No se pudo crear el área." };
  }

  await logEvento(db, {
    tenantId: tenant,
    usuarioId: perfil.id,
    accion: "area_creada",
    entidad: "areas_tenant",
    entidadId: creada.id,
    detalle: { nombre: limpio },
  });

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin");
  return { ok: true, error: null, mensaje: `Área “${limpio}” creada.` };
}

/**
 * Renombra un área. Lo resuelve `fn_renombrar_area` en la base, que cambia a la
 * vez el catálogo, las solicitudes y los perfiles: de esa coincidencia exacta
 * depende qué ve cada usuario de área, así que un rename parcial rompería la
 * visibilidad en silencio. La función también comprueba su propia autorización.
 */
export async function renombrarArea(areaId: string, nombre: string): Promise<AreaState> {
  const perfil = await getPerfilActual();
  if (!perfil || !puedeEntrarPanel(perfil)) {
    return { ok: false, error: "Acción reservada al panel de seguimiento." };
  }
  if (!areaId) return { ok: false, error: "Área no válida." };

  const limpio = normalizarNombreArea(nombre);
  if (!limpio) return { ok: false, error: "Escribe el nombre del área." };

  const db = await createClient();
  const { data, error } = await db.rpc("fn_renombrar_area", {
    p_area_id: areaId,
    p_nombre: limpio,
  });

  if (error) return { ok: false, error: error.message };

  const r = (data ?? {}) as { cambiado?: boolean; solicitudes?: number; usuarios?: number };
  if (!r.cambiado) {
    return { ok: true, error: null, mensaje: "El nombre no cambió." };
  }

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin");
  revalidatePath("/portal");
  const partes = [`Área renombrada a “${limpio}”`];
  if (r.solicitudes) partes.push(`${r.solicitudes} solicitud(es) actualizadas`);
  if (r.usuarios) partes.push(`${r.usuarios} usuario(s) actualizados`);
  return { ok: true, error: null, mensaje: `${partes.join(" · ")}.` };
}

/** Desactiva o reactiva un área. No borra: solo deja de ofrecerse en los selectores. */
export async function cambiarActivoArea(
  areaId: string,
  activar: boolean
): Promise<AreaState> {
  const perfil = await getPerfilActual();
  if (!perfil || !puedeEntrarPanel(perfil)) {
    return { ok: false, error: "Acción reservada al panel de seguimiento." };
  }
  if (!areaId) return { ok: false, error: "Área no válida." };

  const db = await createClient();

  const { data: area } = await db
    .from("areas_tenant")
    .select("id, tenant_id, nombre, activo")
    .eq("id", areaId)
    .single();
  if (!area) return { ok: false, error: "No se encontró el área." };

  const tenant = await tenantParaAreas(perfil, area.tenant_id);
  if (!tenant || tenant !== area.tenant_id) {
    return { ok: false, error: "No puedes gestionar las áreas de este cliente." };
  }
  if (area.activo === activar) {
    return {
      ok: false,
      error: activar ? "El área ya está activa." : "El área ya está desactivada.",
    };
  }

  const { error } = await db
    .from("areas_tenant")
    .update({ activo: activar })
    .eq("id", areaId);
  if (error) return { ok: false, error: "No se pudo actualizar el área." };

  await logEvento(db, {
    tenantId: area.tenant_id,
    usuarioId: perfil.id,
    accion: activar ? "area_reactivada" : "area_desactivada",
    entidad: "areas_tenant",
    entidadId: areaId,
    detalle: { nombre: area.nombre },
  });

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin");
  return {
    ok: true,
    error: null,
    mensaje: activar
      ? `Área “${area.nombre}” reactivada.`
      : `Área “${area.nombre}” desactivada. Deja de ofrecerse para trabajo nuevo; lo ya registrado con ella no cambia.`,
  };
}
