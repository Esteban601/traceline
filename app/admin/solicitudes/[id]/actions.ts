"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPerfilActual,
  esStaff,
  getTenantDe,
  puedeEntrarPanel,
  type PerfilActual,
} from "@/lib/data";
import { transicionValida } from "@/lib/transiciones";
import type { EstadoSolicitud } from "@/lib/estados";
import {
  errorOrigen,
  origenDe,
  puedeRevisarOrigen,
  type OrigenSolicitud,
} from "@/lib/origen";
import { enviarSolicitudesCore } from "@/lib/solicitar";
import { enviarCorreo } from "@/lib/email/enviar";
import { plantillaObservacion } from "@/lib/email/plantillas";
import { logCorreo } from "@/lib/bitacora";

export type AccionState = { ok: boolean; error?: string | null; mensaje?: string | null };

const ESTADOS_VALIDOS: EstadoSolicitud[] = [
  "pendiente",
  "solicitado",
  "recibido",
  "en_revision",
  "validado",
  "observaciones",
  "congelado",
];

const NO_AUTORIZADO = "Acción reservada al panel de seguimiento.";

/**
 * Guarda común de las acciones de revisión del panel: sesión con acceso al panel
 * + la REGLA DURA de origen (`lib/origen.ts`). Devuelve el perfil, el cliente de
 * BD y la solicitud, o el error listo para regresar.
 *
 * La base también lo impide (trigger `trg_solicitud_origen_transicion` y RLS):
 * esto existe para dar un mensaje claro en vez de un 0-filas silencioso.
 */
async function autorizarRevision(solicitudId: string): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      perfil: PerfilActual;
      db: Awaited<ReturnType<typeof createClient>>;
      sol: { id: string; estado: EstadoSolicitud; origen: OrigenSolicitud };
    }
> {
  const perfil = await getPerfilActual();
  if (!perfil || !puedeEntrarPanel(perfil)) return { ok: false, error: NO_AUTORIZADO };
  if (!solicitudId) return { ok: false, error: "Solicitud no válida." };

  const db = await createClient();
  const { data, error } = await db
    .from("solicitudes")
    .select("id, estado, origen")
    .eq("id", solicitudId)
    .single();

  if (error || !data) return { ok: false, error: "No se encontró la solicitud." };

  const sol = {
    id: data.id,
    estado: data.estado as EstadoSolicitud,
    origen: data.origen as OrigenSolicitud,
  };
  if (!puedeRevisarOrigen(sol.origen, perfil)) {
    return { ok: false, error: errorOrigen(sol.origen) };
  }
  return { ok: true, perfil, db, sol };
}

/**
 * Cambia el estado de una solicitud validando que la transición sea permitida y
 * que quien la pide sea el lado dueño del origen. La bitácora la registra el
 * trigger de UPDATE de solicitudes.
 */
export async function cambiarEstado(
  _prev: AccionState,
  formData: FormData
): Promise<AccionState> {
  const solicitudId = String(formData.get("solicitud_id") ?? "");
  const nuevoEstado = String(formData.get("estado") ?? "") as EstadoSolicitud;

  if (!ESTADOS_VALIDOS.includes(nuevoEstado) || nuevoEstado === "congelado") {
    return { ok: false, error: "Estado destino no válido." };
  }

  const auth = await autorizarRevision(solicitudId);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { db, sol } = auth;

  if (sol.estado === nuevoEstado) {
    return { ok: true, mensaje: "La solicitud ya estaba en ese estado.", error: null };
  }
  if (!transicionValida(sol.estado, nuevoEstado)) {
    return { ok: false, error: "Esa transición de estado no está permitida." };
  }

  const { error } = await db
    .from("solicitudes")
    .update({ estado: nuevoEstado })
    .eq("id", solicitudId);

  if (error) {
    return { ok: false, error: "No se pudo actualizar el estado." };
  }

  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath("/admin");
  return { ok: true, error: null, mensaje: "Estado actualizado." };
}

/**
 * Registra una observación formal (comentario con es_observacion) y mueve la
 * solicitud a 'observaciones'. La formula el lado dueño del origen: IRStrat en
 * las suyas, el administrador del cliente en las internas.
 */
export async function agregarObservacion(
  _prev: AccionState,
  formData: FormData
): Promise<AccionState> {
  const solicitudId = String(formData.get("solicitud_id") ?? "");
  const contenido = String(formData.get("contenido") ?? "").trim();

  if (!contenido) return { ok: false, error: "Escribe la observación." };

  const auth = await autorizarRevision(solicitudId);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { perfil, db: supabase, sol: base } = auth;

  const { data: sol, error: solErr } = await supabase
    .from("solicitudes")
    .select(
      "id, titulo, estado, fecha_limite, responsable_cliente_id, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id), responsable:perfiles_usuario!solicitudes_responsable_cliente_id_fkey(nombre, email)"
    )
    .eq("id", solicitudId)
    .single();

  if (solErr || !sol) {
    return { ok: false, error: "No se encontró la solicitud." };
  }
  if (base.estado === "congelado") {
    return { ok: false, error: "La solicitud está congelada; no admite cambios." };
  }

  const { error: comErr } = await supabase.from("comentarios").insert({
    solicitud_id: solicitudId,
    autor_id: perfil.id,
    contenido,
    es_observacion: true,
  });

  if (comErr) {
    return { ok: false, error: "No se pudo registrar la observación." };
  }

  // Mover a 'observaciones' (si no lo estaba ya). El trigger registra el cambio.
  if (base.estado !== "observaciones") {
    const { error: estErr } = await supabase
      .from("solicitudes")
      .update({ estado: "observaciones" })
      .eq("id", solicitudId);
    if (estErr) {
      return {
        ok: true,
        error: null,
        mensaje: "Observación registrada, pero el estado no pudo actualizarse.",
      };
    }
  }

  // Aviso por correo al responsable (plantilla c). Sin responsable, no se envía.
  const reporte = sol.reporte as unknown as { tenant_id: string } | null;
  const responsable = sol.responsable as unknown as { nombre: string; email: string } | null;

  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath("/admin");

  if (!responsable || !responsable.email) {
    return {
      ok: true,
      error: null,
      mensaje: "Observación registrada. Sin responsable asignado: no se envió correo.",
    };
  }

  // El correo tiene que decir QUIÉN observó. Es el único canal que sale de la
  // plataforma: si dijera "IRStrat" en una observación interna del cliente, sería
  // la única pieza del flujo que contradice el origen.
  const soyStaff = esStaff(perfil);
  const tenantAutor = soyStaff ? null : await getTenantDe(perfil);
  const plantilla = plantillaObservacion(
    responsable.nombre,
    { id: sol.id, titulo: sol.titulo, fechaLimite: sol.fecha_limite },
    contenido,
    { esIrstrat: soyStaff, organizacion: tenantAutor?.nombre ?? null }
  );
  const envio = await enviarCorreo(responsable.email, plantilla);

  if (!envio.ok) {
    return {
      ok: true,
      error: null,
      mensaje: `Observación registrada, pero el correo no pudo enviarse: ${envio.error ?? ""}`,
    };
  }

  await logCorreo(supabase, {
    tenantId: reporte?.tenant_id ?? null,
    usuarioId: perfil.id,
    accion: "aviso_observacion",
    entidadId: sol.id,
    detalle: {
      responsable_id: sol.responsable_cliente_id,
      email: responsable.email,
      nombre: responsable.nombre,
      solicitud_id: sol.id,
      modo: envio.modo,
    },
  });

  return {
    ok: true,
    error: null,
    mensaje:
      envio.modo === "consola"
        ? "Observación registrada. Aviso impreso en consola (modo sin envío)."
        : "Observación registrada y aviso enviado al responsable.",
  };
}

/**
 * Envío individual de solicitud (botón del detalle). Reutiliza la lógica del
 * envío masivo con un solo id, con el filtro de origen que le corresponde a
 * quien envía.
 */
export async function enviarSolicitud(
  _prev: AccionState,
  formData: FormData
): Promise<AccionState> {
  const solicitudId = String(formData.get("solicitud_id") ?? "");

  const auth = await autorizarRevision(solicitudId);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { perfil, db: supabase } = auth;

  const r = await enviarSolicitudesCore(
    supabase,
    perfil.id,
    [solicitudId],
    origenDe(perfil)
  );

  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath("/admin");

  if (r.fallidos > 0) {
    return { ok: false, error: r.detalles[0]?.motivo ?? "No se pudo enviar la solicitud." };
  }
  if (r.correos === 0) {
    return {
      ok: false,
      error:
        "No se envió: la solicitud debe estar en 'pendiente' y tener responsable asignado.",
    };
  }
  return {
    ok: true,
    error: null,
    mensaje:
      r.modo === "consola"
        ? "Solicitud impresa en consola (modo sin envío) y marcada como solicitada."
        : "Solicitud enviada al responsable y marcada como solicitada.",
  };
}

// =============================================================================
// Carga de evidencia DESDE EL PANEL
//
// Dos usos, una acción:
//   * ADMINISTRADOR DEL CLIENTE — carga como cualquier área de su cliente. Es su
//     panel; no necesita permiso de nadie.
//   * STAFF DE IRSTRAT — solo si el cliente tiene el toggle `staff_puede_cargar`
//     encendido, y SIEMPRE con trazabilidad: `evidencias.cargado_por_staff` la
//     pone el trigger de la base, no esta acción, y no se puede retirar.
//
// El gate del toggle se comprueba aquí para dar un mensaje claro y ADEMÁS en la
// base (fn_evidencia_marca_carga): un POST directo con el switch apagado se
// rechaza igual.
// =============================================================================

const BUCKET = "evidencias";

export type CargaPanelState = {
  ok: boolean;
  version?: number;
  error?: string | null;
  mensaje?: string | null;
};

function nombreSeguro(nombre: string): string {
  const base = nombre.normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim();
  return base.replace(/\s+/g, "_").slice(0, 120) || "archivo";
}

export async function subirEvidenciaPanel(
  _prev: CargaPanelState,
  formData: FormData
): Promise<CargaPanelState> {
  const perfil = await getPerfilActual();
  if (!perfil || !puedeEntrarPanel(perfil)) {
    return { ok: false, error: NO_AUTORIZADO };
  }

  const solicitudId = String(formData.get("solicitud_id") ?? "");
  const periodoCubierto = String(formData.get("periodo_cubierto") ?? "").trim();
  const areaOrigen = String(formData.get("area_origen") ?? "").trim();
  const justificacion = String(formData.get("justificacion") ?? "").trim();
  const file = formData.get("file");

  if (!solicitudId) return { ok: false, error: "Solicitud no válida." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecciona o arrastra un archivo." };
  }
  if (!periodoCubierto) {
    return { ok: false, error: "Indica el periodo cubierto por la evidencia." };
  }
  // El área NO es opcional aquí: la evidencia se carga EN NOMBRE de un área y sin
  // ella el historial no podría decir de parte de quién.
  if (!areaOrigen) {
    return { ok: false, error: "Elige el área en cuyo nombre se carga la evidencia." };
  }

  const db = await createClient();

  const { data: sol, error: solErr } = await db
    .from("solicitudes")
    .select(
      "id, estado, es_cuantitativa, reporte:reportes!solicitudes_reporte_id_fkey(id, tenant_id, estado)"
    )
    .eq("id", solicitudId)
    .single();

  if (solErr || !sol) {
    return { ok: false, error: "No se encontró la solicitud o no tienes acceso." };
  }

  const reporte = sol.reporte as unknown as {
    id: string;
    tenant_id: string;
    estado: string;
  } | null;
  if (!reporte) return { ok: false, error: "La solicitud no tiene un reporte asociado." };

  if (sol.estado === "congelado" || reporte.estado === "congelado") {
    return {
      ok: false,
      error: "El reporte está congelado; la evidencia quedó cerrada para aseguramiento.",
    };
  }

  // Gate del toggle: solo aplica al staff. Lo repite el trigger de la base.
  const cargaDeStaff = esStaff(perfil);
  if (cargaDeStaff) {
    const { data: tenant } = await db
      .from("tenants")
      .select("staff_puede_cargar")
      .eq("id", reporte.tenant_id)
      .single();
    if (!tenant?.staff_puede_cargar) {
      return {
        ok: false,
        error: "La carga de evidencia corresponde al cliente.",
      };
    }
  }

  // Justificación obligatoria (>=20 chars) al reponer evidencia sobre una
  // solicitud ya VALIDADA (reabre la revisión), igual que en el portal.
  if (sol.estado === "validado" && justificacion.length < 20) {
    return {
      ok: false,
      error:
        "Esta solicitud ya fue validada: explica el motivo del ajuste (mínimo 20 caracteres).",
    };
  }

  const path = `${reporte.tenant_id}/${solicitudId}/${Date.now()}-${nombreSeguro(file.name)}`;

  const { error: upErr } = await db.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) {
    return { ok: false, error: `No se pudo subir el archivo: ${upErr.message}` };
  }

  const { data: ev, error: evErr } = await db
    .from("evidencias")
    .insert({
      solicitud_id: solicitudId,
      archivo_path: path,
      nombre_original: file.name,
      periodo_cubierto: periodoCubierto,
      area_origen: areaOrigen,
      subido_por: perfil.id,
      justificacion: justificacion || null,
      // `version` y `cargado_por_staff` los asignan los triggers; el placeholder
      // se sobreescribe. La marca de autoría NO se envía a propósito: si la
      // pusiera la aplicación, sería configurable.
      version: 0,
    })
    .select("id, version, cargado_por_staff")
    .single();

  if (evErr || !ev) {
    // El objeto ya está en storage pero sin fila que lo referencie. Se retira con
    // service_role a propósito: los usuarios de tenant NO tienen DELETE en el
    // bucket (la evidencia es inmutable), así que por su sesión el archivo
    // quedaría huérfano para siempre y sin ninguna vía de la aplicación para
    // limpiarlo. Es una limpieza del servidor sobre algo que el servidor acaba de
    // crear, no una puerta de borrado para nadie.
    await createAdminClient()
      .storage.from(BUCKET)
      .remove([path])
      .catch(() => {});
    return {
      ok: false,
      error: `No se registró la evidencia: ${evErr?.message ?? "error desconocido"}`,
    };
  }

  // Captura de valor si la solicitud es cuantitativa y se dio un valor.
  let avisoCaptura: string | null = null;
  if (sol.es_cuantitativa) {
    const valorRaw = String(formData.get("valor") ?? "").trim();
    if (valorRaw !== "") {
      const valor = Number(valorRaw.replace(/,/g, ""));
      const unidad = String(formData.get("unidad") ?? "").trim();
      const periodoCaptura = String(formData.get("periodo_captura") ?? "").trim();
      if (Number.isFinite(valor) && unidad) {
        const { error: capErr } = await db.from("capturas_valor").insert({
          solicitud_id: solicitudId,
          evidencia_id: ev.id,
          valor,
          unidad,
          periodo: periodoCaptura || periodoCubierto,
          capturado_por: perfil.id,
          confirmado: true,
          justificacion: justificacion || null,
        });
        if (capErr) avisoCaptura = `la captura de valor falló: ${capErr.message}`;
      } else {
        avisoCaptura = "el valor o la unidad no eran válidos y no se capturó la cifra.";
      }
    }
  }

  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath("/admin");
  revalidatePath(`/portal/solicitudes/${solicitudId}`);

  const marca = ev.cargado_por_staff
    ? ` Queda registrada como cargada por IRStrat en nombre de ${areaOrigen}.`
    : "";
  return {
    ok: true,
    version: ev.version,
    error: avisoCaptura ? `Evidencia v${ev.version} registrada, pero ${avisoCaptura}` : null,
    mensaje: `Evidencia v${ev.version} registrada.${marca}`,
  };
}
