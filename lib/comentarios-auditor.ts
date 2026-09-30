import "server-only";
import { createClient } from "@/lib/supabase/server";
import { esAuditor, esStaff, type PerfilActual } from "@/lib/data";
import { esAdminCliente } from "@/lib/roles";
import type { Database } from "@/lib/database.types";

export type ObjetoAuditado =
  Database["public"]["Enums"]["objeto_comentario_auditor"];

export type ComentarioAuditor = {
  id: string;
  objetoTipo: ObjetoAuditado;
  objetoId: string;
  texto: string;
  createdAt: string;
  autor: string;
  respuesta: string | null;
  respondidoEn: string | null;
  respondidoPor: string | null;
};

const CAMPOS =
  "id, objeto_tipo, objeto_id, texto, created_at, respuesta, respondido_en, " +
  "autor:perfiles_usuario!comentarios_auditor_autor_id_fkey(nombre), " +
  "responde:perfiles_usuario!comentarios_auditor_respondido_por_fkey(nombre)";

type Fila = {
  id: string;
  objeto_tipo: ObjetoAuditado;
  objeto_id: string;
  texto: string;
  created_at: string;
  respuesta: string | null;
  respondido_en: string | null;
  autor: { nombre: string } | null;
  responde: { nombre: string } | null;
};

function aComentario(f: Fila): ComentarioAuditor {
  return {
    id: f.id,
    objetoTipo: f.objeto_tipo,
    objetoId: f.objeto_id,
    texto: f.texto,
    createdAt: f.created_at,
    autor: f.autor?.nombre ?? "Auditor externo",
    respuesta: f.respuesta,
    respondidoEn: f.respondido_en,
    respondidoPor: f.responde?.nombre ?? null,
  };
}

/**
 * Comentarios del auditor sobre un conjunto de objetos del MISMO tipo,
 * agrupados por objeto.
 *
 * Se piden en una sola consulta para todos los ids de la pantalla y no uno por
 * fila: las listas de clima y objetivos rondan la decena, y una consulta por
 * tarjeta convertiría una pantalla de lectura en una tormenta de consultas.
 *
 * RLS decide quién ve qué; aquí no se filtra por rol. El usuario de área recibe
 * cero filas sin que esta función tenga que saberlo.
 */
export async function comentariosPorObjeto(
  tipo: ObjetoAuditado,
  ids: string[]
): Promise<Map<string, ComentarioAuditor[]>> {
  const mapa = new Map<string, ComentarioAuditor[]>();
  if (ids.length === 0) return mapa;

  const db = await createClient();
  const { data } = await db
    .from("comentarios_auditor")
    .select(CAMPOS)
    .eq("objeto_tipo", tipo)
    .in("objeto_id", ids)
    .order("created_at", { ascending: true });

  for (const f of (data ?? []) as unknown as Fila[]) {
    const lista = mapa.get(f.objeto_id) ?? [];
    lista.push(aComentario(f));
    mapa.set(f.objeto_id, lista);
  }
  return mapa;
}

/** Comentarios de UN objeto (detalle de solicitud). */
export async function comentariosDe(
  tipo: ObjetoAuditado,
  id: string
): Promise<ComentarioAuditor[]> {
  return (await comentariosPorObjeto(tipo, [id])).get(id) ?? [];
}

/**
 * Cuántos comentarios del auditor están SIN RESPONDER, y de qué emisora.
 *
 * Es el número que evita que algo quede sin atender, así que se cuenta en la
 * base con `head: true` —sin traer filas— y se muestra en la matriz y en el
 * detalle. El AUDITOR no lo ve: para él, lo pendiente de respuesta es asunto de
 * quien responde, y un contador suyo se leería como una presión.
 *
 * `tenantId` acota cuando el staff está mirando una emisora concreta; sin él
 * cuenta lo que RLS le deje ver, que para el admin del cliente es su tenant.
 */
export async function pendientesSinResponder(
  perfil: Pick<PerfilActual, "rol" | "tenant_id">,
  tenantId?: string | null
): Promise<number> {
  if (esAuditor(perfil)) return 0;
  if (!esStaff(perfil) && !esAdminCliente(perfil)) return 0;

  const db = await createClient();
  let q = db
    .from("comentarios_auditor")
    .select("*", { count: "exact", head: true })
    .is("respondido_en", null);
  if (tenantId) q = q.eq("tenant_id", tenantId);

  const { count } = await q;
  return count ?? 0;
}

/** ¿Este perfil puede RESPONDER comentarios del auditor? Espejo de la política. */
export function puedeResponderAuditor(
  perfil: Pick<PerfilActual, "rol" | "tenant_id">
): boolean {
  return esStaff(perfil) || esAdminCliente(perfil);
}
