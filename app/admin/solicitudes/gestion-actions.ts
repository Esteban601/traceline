"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";
import {
  puedeEditarSolicitud,
  puedeEditarEnunciado,
  puedeEliminarSolicitud,
  puedeAsignarRubroTaxonomia,
} from "@/lib/gestion";
import type { EstadoSolicitud } from "@/lib/estados";
import type { TablesUpdate } from "@/lib/database.types";

export type GestionState = {
  ok: boolean;
  error?: string | null;
  mensaje?: string | null;
  solicitudId?: string | null;
};

// -----------------------------------------------------------------------------
// Lectura y normalización de los campos comunes del formulario de solicitud.
// -----------------------------------------------------------------------------
type CamposSolicitud = {
  titulo: string;
  descripcion: string | null;
  area_asignada: string | null;
  es_cuantitativa: boolean;
  unidad_esperada: string | null;
  fecha_limite: string | null;
  responsable_cliente_id: string | null;
  responsable_irstrat_id: string | null;
  orden: number | null;
  rubro_clave: string | null;
  rubro_taxonomia: string | null;
  datapointIds: string[];
};

function texto(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

function leerCampos(fd: FormData): CamposSolicitud {
  const esCuant = fd.get("es_cuantitativa") === "on" || fd.get("es_cuantitativa") === "true";
  const ordenRaw = texto(fd, "orden");
  const orden = ordenRaw != null && /^\d+$/.test(ordenRaw) ? Number(ordenRaw) : null;
  return {
    titulo: String(fd.get("titulo") ?? "").trim(),
    descripcion: texto(fd, "descripcion"),
    area_asignada: texto(fd, "area_asignada"),
    es_cuantitativa: esCuant,
    // La unidad solo tiene sentido si es cuantitativa.
    unidad_esperada: esCuant ? texto(fd, "unidad_esperada") : null,
    fecha_limite: texto(fd, "fecha_limite"),
    responsable_cliente_id: texto(fd, "responsable_cliente_id"),
    responsable_irstrat_id: texto(fd, "responsable_irstrat_id"),
    orden,
    rubro_clave: texto(fd, "rubro_clave"),
    rubro_taxonomia: texto(fd, "rubro_taxonomia"),
    datapointIds: Array.from(new Set(fd.getAll("datapoint_ids").map((v) => String(v)))).filter(
      Boolean
    ),
  };
}

/**
 * Valida que el responsable cliente (si se indicó) pertenezca al tenant del
 * reporte y que el responsable IRStrat (si se indicó) sea staff. Evita
 * asignaciones cruzadas entre tenants aunque el <select> se manipule.
 */
async function validarResponsables(
  db: Awaited<ReturnType<typeof createClient>>,
  campos: CamposSolicitud,
  tenantId: string
): Promise<string | null> {
  if (campos.responsable_cliente_id) {
    const { data } = await db
      .from("perfiles_usuario")
      .select("id, tenant_id")
      .eq("id", campos.responsable_cliente_id)
      .single();
    if (!data || data.tenant_id !== tenantId) {
      return "El responsable cliente no pertenece al tenant del reporte.";
    }
  }
  if (campos.responsable_irstrat_id) {
    const { data } = await db
      .from("perfiles_usuario")
      .select("id, tenant_id")
      .eq("id", campos.responsable_irstrat_id)
      .single();
    if (!data || data.tenant_id !== null) {
      return "El responsable IRStrat debe ser del equipo interno.";
    }
  }
  return null;
}

/** Reemplaza el conjunto de mapeos a datapoints de una solicitud. */
async function reemplazarMapeo(
  db: Awaited<ReturnType<typeof createClient>>,
  solicitudId: string,
  datapointIds: string[]
): Promise<string | null> {
  const { error: delErr } = await db
    .from("mapeo_solicitud_datapoint")
    .delete()
    .eq("solicitud_id", solicitudId);
  if (delErr) return `No se pudo actualizar el mapeo a datapoints: ${delErr.message}`;

  if (datapointIds.length === 0) return null;
  const { error: insErr } = await db.from("mapeo_solicitud_datapoint").insert(
    datapointIds.map((datapoint_id) => ({ solicitud_id: solicitudId, datapoint_id }))
  );
  if (insErr) return `No se pudo guardar el mapeo a datapoints: ${insErr.message}`;
  return null;
}

// -----------------------------------------------------------------------------
// Crear solicitud
// -----------------------------------------------------------------------------
export async function crearSolicitud(
  _prev: GestionState,
  fd: FormData
): Promise<GestionState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const reporteId = texto(fd, "reporte_id");
  if (!reporteId) return { ok: false, error: "Selecciona el reporte." };

  const campos = leerCampos(fd);
  if (!campos.titulo) return { ok: false, error: "El título es obligatorio." };

  const db = await createClient();

  const { data: reporte, error: repErr } = await db
    .from("reportes")
    .select("id, tenant_id")
    .eq("id", reporteId)
    .single();
  if (repErr || !reporte) return { ok: false, error: "El reporte no existe." };

  const errResp = await validarResponsables(db, campos, reporte.tenant_id);
  if (errResp) return { ok: false, error: errResp };

  // Orden por defecto: al final del reporte (máximo + 10).
  let orden = campos.orden;
  if (orden == null) {
    const { data: maxRow } = await db
      .from("solicitudes")
      .select("orden")
      .eq("reporte_id", reporteId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    orden = (maxRow?.orden ?? 0) + 10;
  }

  const { data: creada, error: insErr } = await db
    .from("solicitudes")
    .insert({
      reporte_id: reporteId,
      titulo: campos.titulo,
      descripcion: campos.descripcion,
      area_asignada: campos.area_asignada,
      es_cuantitativa: campos.es_cuantitativa,
      unidad_esperada: campos.unidad_esperada,
      fecha_limite: campos.fecha_limite,
      responsable_cliente_id: campos.responsable_cliente_id,
      responsable_irstrat_id: campos.responsable_irstrat_id,
      orden,
      rubro_clave: campos.rubro_clave,
      rubro_taxonomia: campos.rubro_taxonomia,
      // estado se queda en el default 'pendiente'.
    })
    .select("id")
    .single();

  if (insErr || !creada) {
    if (insErr?.code === "23505" && insErr.message.includes("rubro_taxonomia")) {
      return {
        ok: false,
        error:
          "Otra solicitud de este reporte ya alimenta ese rubro de taxonomía. Cada rubro lo llena una sola solicitud.",
      };
    }
    return { ok: false, error: "No se pudo crear la solicitud." };
  }

  const errMap = await reemplazarMapeo(db, creada.id, campos.datapointIds);
  if (errMap) return { ok: false, error: errMap };

  await logEvento(db, {
    tenantId: reporte.tenant_id,
    usuarioId: perfil.id,
    accion: "solicitud_creada",
    entidad: "solicitudes",
    entidadId: creada.id,
    detalle: {
      titulo: campos.titulo,
      area: campos.area_asignada,
      reporte_id: reporteId,
      datapoints: campos.datapointIds.length,
    },
  });

  revalidatePath("/admin");
  return { ok: true, error: null, mensaje: "Solicitud creada.", solicitudId: creada.id };
}

// -----------------------------------------------------------------------------
// Editar solicitud
// -----------------------------------------------------------------------------
export async function editarSolicitud(
  _prev: GestionState,
  fd: FormData
): Promise<GestionState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const solicitudId = texto(fd, "solicitud_id");
  if (!solicitudId) return { ok: false, error: "Solicitud no válida." };

  const campos = leerCampos(fd);
  if (!campos.titulo) return { ok: false, error: "El título es obligatorio." };

  const db = await createClient();

  const { data: sol, error: solErr } = await db
    .from("solicitudes")
    .select("id, estado, reporte:reportes!solicitudes_reporte_id_fkey(id, tenant_id)")
    .eq("id", solicitudId)
    .single();
  if (solErr || !sol) return { ok: false, error: "No se encontró la solicitud." };

  const estado = sol.estado as EstadoSolicitud;
  const reporte = sol.reporte as unknown as { id: string; tenant_id: string } | null;
  if (!reporte) return { ok: false, error: "El reporte de la solicitud no existe." };

  // REGLA DURA: una solicitud validada (o congelada) no se edita.
  if (!puedeEditarSolicitud(estado)) {
    return {
      ok: false,
      error:
        estado === "congelado"
          ? "El reporte está congelado; sus solicitudes quedaron en solo-lectura."
          : "La solicitud está validada; no puede editarse.",
    };
  }

  // ¿Tiene evidencia? Bloquea título y descripción.
  const { count } = await db
    .from("evidencias")
    .select("id", { count: "exact", head: true })
    .eq("solicitud_id", solicitudId);
  const tieneEvidencia = (count ?? 0) > 0;

  const errResp = await validarResponsables(db, campos, reporte.tenant_id);
  if (errResp) return { ok: false, error: errResp };

  // Campos siempre editables.
  const update: TablesUpdate<"solicitudes"> = {
    area_asignada: campos.area_asignada,
    es_cuantitativa: campos.es_cuantitativa,
    unidad_esperada: campos.unidad_esperada,
    fecha_limite: campos.fecha_limite,
    responsable_cliente_id: campos.responsable_cliente_id,
    responsable_irstrat_id: campos.responsable_irstrat_id,
    rubro_clave: campos.rubro_clave,
    rubro_taxonomia: campos.rubro_taxonomia,
  };
  if (campos.orden != null) update.orden = campos.orden;

  // Título y descripción: solo si NO hay evidencia (el enunciado que el cliente
  // respondió no puede cambiar de significado).
  if (puedeEditarEnunciado(tieneEvidencia)) {
    update.titulo = campos.titulo;
    update.descripcion = campos.descripcion;
  }

  const { error: upErr } = await db
    .from("solicitudes")
    .update(update)
    .eq("id", solicitudId);
  if (upErr) {
    if (upErr.code === "23505" && upErr.message.includes("rubro_taxonomia")) {
      return {
        ok: false,
        error:
          "Otra solicitud de este reporte ya alimenta ese rubro de taxonomía. Cada rubro lo llena una sola solicitud.",
      };
    }
    return { ok: false, error: "No se pudo guardar la solicitud." };
  }

  const errMap = await reemplazarMapeo(db, solicitudId, campos.datapointIds);
  if (errMap) return { ok: false, error: errMap };

  await logEvento(db, {
    tenantId: reporte.tenant_id,
    usuarioId: perfil.id,
    accion: "solicitud_editada",
    entidad: "solicitudes",
    entidadId: solicitudId,
    detalle: {
      titulo: campos.titulo,
      enunciado_bloqueado: tieneEvidencia,
      datapoints: campos.datapointIds.length,
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  return {
    ok: true,
    error: null,
    solicitudId,
    mensaje: tieneEvidencia
      ? "Solicitud actualizada (título y descripción bloqueados por tener evidencia)."
      : "Solicitud actualizada.",
  };
}

// -----------------------------------------------------------------------------
// Eliminar solicitud (solo 'pendiente' sin evidencia)
// -----------------------------------------------------------------------------
export async function eliminarSolicitud(
  _prev: GestionState,
  fd: FormData
): Promise<GestionState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const solicitudId = texto(fd, "solicitud_id");
  if (!solicitudId) return { ok: false, error: "Solicitud no válida." };

  const db = await createClient();

  const { data: sol, error: solErr } = await db
    .from("solicitudes")
    .select("id, titulo, estado, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)")
    .eq("id", solicitudId)
    .single();
  if (solErr || !sol) return { ok: false, error: "No se encontró la solicitud." };

  const estado = sol.estado as EstadoSolicitud;
  const reporte = sol.reporte as unknown as { tenant_id: string } | null;

  const { count } = await db
    .from("evidencias")
    .select("id", { count: "exact", head: true })
    .eq("solicitud_id", solicitudId);
  const tieneEvidencia = (count ?? 0) > 0;

  if (!puedeEliminarSolicitud(estado, tieneEvidencia)) {
    return {
      ok: false,
      error:
        "Solo se puede eliminar una solicitud pendiente y sin evidencia. La trazabilidad prohíbe borrar el resto.",
    };
  }

  const { error: delErr } = await db.from("solicitudes").delete().eq("id", solicitudId);
  if (delErr) return { ok: false, error: "No se pudo eliminar la solicitud." };

  await logEvento(db, {
    tenantId: reporte?.tenant_id ?? null,
    usuarioId: perfil.id,
    accion: "solicitud_eliminada",
    entidad: "solicitudes",
    entidadId: solicitudId,
    detalle: { titulo: sol.titulo, estado },
  });

  revalidatePath("/admin");
  return { ok: true, error: null, mensaje: "Solicitud eliminada." };
}

/**
 * Asigna (o quita) el RUBRO DE TAXONOMÍA de una solicitud. Va aparte de
 * `editarSolicitud` porque se admite incluso sobre una solicitud validada: el
 * rubro no es contenido de la solicitud, es el mapeo a la celda de la plantilla
 * oficial. Sin esta vía, un reporte cuyas solicitudes se validaron antes de que
 * existieran los rubros no podría llenar su Excel jamás.
 */
export async function asignarRubroTaxonomia(
  solicitudId: string,
  rubro: string | null
): Promise<GestionState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }
  if (!solicitudId) return { ok: false, error: "Solicitud no válida." };

  const db = await createClient();

  const { data: sol } = await db
    .from("solicitudes")
    .select("id, titulo, estado, reporte:reportes!solicitudes_reporte_id_fkey(tenant_id)")
    .eq("id", solicitudId)
    .single();
  if (!sol) return { ok: false, error: "No se encontró la solicitud." };

  const estado = sol.estado as EstadoSolicitud;
  if (!puedeAsignarRubroTaxonomia(estado)) {
    return {
      ok: false,
      error: "El reporte está congelado: sus solicitudes quedaron en solo-lectura.",
    };
  }

  const { error } = await db
    .from("solicitudes")
    .update({ rubro_taxonomia: rubro })
    .eq("id", solicitudId);

  if (error) {
    if (error.code === "23505" && error.message.includes("rubro_taxonomia")) {
      return {
        ok: false,
        error:
          "Otra solicitud de este reporte ya alimenta ese rubro de taxonomía. Cada rubro lo llena una sola solicitud.",
      };
    }
    return { ok: false, error: "No se pudo asignar el rubro de taxonomía." };
  }

  const tenantId =
    (sol.reporte as unknown as { tenant_id: string } | null)?.tenant_id ?? null;
  await logEvento(db, {
    tenantId,
    usuarioId: perfil.id,
    accion: "solicitud_editada",
    entidad: "solicitudes",
    entidadId: solicitudId,
    detalle: { titulo: sol.titulo, rubro_taxonomia: rubro },
  });

  revalidatePath(`/admin/solicitudes/${solicitudId}`);
  revalidatePath("/admin/cobertura");
  return {
    ok: true,
    error: null,
    mensaje: rubro ? "Rubro de taxonomía asignado." : "Rubro de taxonomía retirado.",
  };
}
