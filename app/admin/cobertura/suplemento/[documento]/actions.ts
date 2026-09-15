"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";

// =============================================================================
// Acciones de la vista de revisión: editar un bloque y mover el estado del
// documento.
//
// QUIÉN PUEDE. Staff y administrador del cliente, igual que el resto del panel.
// La RLS de `documentos_generados` ya acota al tenant; estas comprobaciones
// evitan ofrecer lo que el servidor rechazaría.
//
// EDITAR UN BLOQUE LO MARCA COMO EDITADO. Si alguien toca el texto, el bloque
// deja de ser lo que el modelo escribió y eso tiene que constar: `editado_por` y
// `editado_en` son lo que distingue una revelación redactada por una máquina de
// una revisada por una persona.
// =============================================================================

export type EstadoAccion = { ok: boolean; error: string | null; mensaje: string | null };

const ERR = (e: string): EstadoAccion => ({ ok: false, error: e, mensaje: null });
const OK = (m: string): EstadoAccion => ({ ok: true, error: null, mensaje: m });

async function autorizar(documentoId: string) {
  const perfil = await getPerfilActual();
  if (!perfil) return { ok: false as const, error: "No autenticado." };
  if (!esStaff(perfil) && !esAdminCliente(perfil)) return { ok: false as const, error: "Sin permiso." };
  const db = await createClient();
  const { data: doc } = await db
    .from("documentos_generados")
    .select("id, tenant_id, estado, version")
    .eq("id", documentoId)
    .maybeSingle();
  if (!doc) return { ok: false as const, error: "El documento no existe o no es visible." };
  return { ok: true as const, perfil, db, doc };
}

export async function guardarTexto(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const documentoId = String(fd.get("documento_id") ?? "");
  const numero = Number(fd.get("numero"));
  const texto = String(fd.get("texto") ?? "");

  const a = await autorizar(documentoId);
  if (!a.ok) return ERR(a.error);
  if (a.doc.estado === "aprobado") {
    return ERR("El documento está aprobado; para cambiarlo hay que abrir una versión nueva.");
  }

  const { error } = await a.db
    .from("documentos_bloques")
    .update({
      texto,
      editado_por: a.perfil.id,
      editado_en: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("documento_id", documentoId)
    .eq("numero", numero);

  if (error) return ERR("No se pudo guardar el texto.");

  after(async () => {
    await logEvento(a.db, {
      tenantId: a.doc.tenant_id,
      usuarioId: a.perfil.id,
      accion: "suplemento_bloque_generado",
      entidad: "documentos_generados",
      entidadId: documentoId,
      detalle: { bloque: numero, accion: "texto_editado", caracteres: texto.length },
    });
  });

  revalidatePath(`/admin/cobertura/suplemento/${documentoId}`);
  return OK("Bloque guardado.");
}

export async function cambiarEstado(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const documentoId = String(fd.get("documento_id") ?? "");
  const destino = String(fd.get("estado") ?? "");

  if (!["borrador", "en_revision", "aprobado"].includes(destino)) {
    return ERR("Estado desconocido.");
  }

  const a = await autorizar(documentoId);
  if (!a.ok) return ERR(a.error);

  // APROBAR ESTÁ BLOQUEADO MIENTRAS QUEDE UN PENDIENTE. Es la regla de §7.5: un
  // documento aprobado con un [Pendiente: …] dentro sale a la calle diciendo que
  // le falta un dato. Se comprueba en el servidor, no solo escondiendo el botón.
  if (destino === "aprobado") {
    const { data: bloques } = await a.db
      .from("documentos_bloques")
      .select("numero, titulo, estado, pendientes")
      .eq("documento_id", documentoId);

    const conPendiente = (bloques ?? []).filter(
      (b) =>
        b.estado !== "no_aplica" &&
        Array.isArray(b.pendientes) &&
        (b.pendientes as { campo: string }[]).some((p) => p.campo !== "nota_revision")
    );
    const sinGenerar = (bloques ?? []).filter((b) =>
      ["generando", "error", "pendiente_adjunto"].includes(b.estado)
    );

    if (conPendiente.length || sinGenerar.length) {
      const partes: string[] = [];
      if (conPendiente.length) {
        partes.push(`${conPendiente.length} bloque(s) con pendientes: ${conPendiente.map((b) => b.numero).join(", ")}`);
      }
      if (sinGenerar.length) {
        partes.push(`${sinGenerar.length} sin generar o en error: ${sinGenerar.map((b) => b.numero).join(", ")}`);
      }
      return ERR(`No se puede aprobar. ${partes.join(". ")}.`);
    }
  }

  const ahora = new Date().toISOString();
  const { error } = await a.db
    .from("documentos_generados")
    .update(
      destino === "aprobado"
        ? { estado: destino, updated_at: ahora, aprobado_por: a.perfil.id, aprobado_en: ahora }
        : { estado: destino, updated_at: ahora }
    )
    .eq("id", documentoId);
  if (error) return ERR("No se pudo cambiar el estado.");

  after(async () => {
    await logEvento(a.db, {
      tenantId: a.doc.tenant_id,
      usuarioId: a.perfil.id,
      accion: "suplemento_documento_estado",
      entidad: "documentos_generados",
      entidadId: documentoId,
      detalle: { de: a.doc.estado, a: destino, version: a.doc.version },
    });
  });

  revalidatePath(`/admin/cobertura/suplemento/${documentoId}`);
  const etiqueta = destino === "en_revision" ? "en revisión" : destino;
  return OK(`Documento ${etiqueta}.`);
}
