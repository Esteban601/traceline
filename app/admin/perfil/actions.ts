"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente, type PerfilActual } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";
import { PLAZOS } from "@/lib/perfil-emisor";

// =============================================================================
// Perfil del emisor — guardado POR SECCIÓN.
//
// Por qué por sección y no un botón "Guardar todo": el perfil son diez bloques
// que se llenan en momentos distintos y por personas distintas —la carta la
// redacta la Dirección, la matriz la trae Riesgos, la cadena de valor sale de
// Operaciones—. Un guardado único obligaría a tenerlo todo listo para guardar
// algo, y `actualizado_en` diría cuándo se tocó el formulario, no cuándo se
// actualizó lo que a uno le interesa.
//
// QUIÉN PUEDE: staff de IRStrat sobre cualquier emisora, y el administrador del
// cliente sobre la suya. Es la misma regla que aplica RLS en la base; aquí se
// comprueba antes para dar un mensaje en vez de un fallo silencioso.
// =============================================================================

export type PerfilState = {
  ok: boolean;
  error?: string | null;
  mensaje?: string | null;
  /** Qué sección respondió: la vista solo pinta el aviso en esa. */
  seccion?: string | null;
  /**
   * Quién guardó y cuándo, devueltos por la propia acción. Se mandan en la
   * respuesta en vez de releerlos de la base: el dato lo acabamos de escribir,
   * así que volver a pedirlo sería una vuelta más a un servidor que está en otra
   * región (ver la nota de rendimiento en guardar()).
   */
  actualizadoEn?: string | null;
  actualizadoPor?: string | null;
};

const OK = (
  seccion: string,
  mensaje: string,
  extra: Pick<PerfilState, "actualizadoEn" | "actualizadoPor"> = {}
): PerfilState => ({ ok: true, error: null, mensaje, seccion, ...extra });
const ERR = (seccion: string, error: string): PerfilState => ({ ok: false, error, seccion });

function texto(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}
function numero(fd: FormData, k: string): number | null {
  const raw = String(fd.get(k) ?? "").trim().replace(/,/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Filas paralelas de un formulario: `campo[]` repetido. Devuelve las filas con
 * al menos un valor no vacío — así "agregar fila y no llenarla" no ensucia el
 * jsonb, que es el error más fácil de cometer en una lista editable.
 */
function filas(fd: FormData, campos: string[]): Record<string, string>[] {
  const columnas = campos.map((c) => fd.getAll(c).map((v) => String(v).trim()));
  const n = Math.max(0, ...columnas.map((c) => c.length));
  const out: Record<string, string>[] = [];
  for (let i = 0; i < n; i++) {
    const fila: Record<string, string> = {};
    let algo = false;
    campos.forEach((c, j) => {
      const v = columnas[j][i] ?? "";
      fila[c] = v;
      if (v !== "") algo = true;
    });
    if (algo) out.push(fila);
  }
  return out;
}

/**
 * Quién es y sobre qué tenant puede escribir. El tipo de retorno se declara
 * explícito: con la unión inferida, `"error" in auth` no estrecha y `auth.error`
 * sale como `string | undefined`.
 */
type Autorizacion =
  | { ok: false; error: string }
  | { ok: true; perfil: PerfilActual; tenantId: string };

async function autorizar(tenantIdPedido: string | null): Promise<Autorizacion> {
  const perfil = await getPerfilActual();
  if (!perfil) return { ok: false, error: "Sesión no válida." };
  if (esStaff(perfil)) {
    if (!tenantIdPedido) return { ok: false, error: "Selecciona la emisora." };
    return { ok: true, perfil, tenantId: tenantIdPedido };
  }
  if (esAdminCliente(perfil) && perfil.tenant_id) {
    // El administrador del cliente escribe SU perfil, venga lo que venga en el
    // formulario: el tenant se toma de la sesión, no del campo oculto.
    return { ok: true, perfil, tenantId: perfil.tenant_id };
  }
  return { ok: false, error: "Acción reservada a IRStrat y al administrador del cliente." };
}

/**
 * Inserta o actualiza el perfil de una emisora con los campos de UNA sección.
 * `perfil_emisor` es 1:1 con `tenants` (UNIQUE en tenant_id), así que el upsert
 * por esa columna es lo que hace que la primera sección guardada cree la fila y
 * las demás la completen.
 */
async function guardar(
  seccion: string,
  tenantIdPedido: string | null,
  campos: Record<string, unknown>,
  detalle: Record<string, unknown> = {}
): Promise<PerfilState> {
  const auth = await autorizar(tenantIdPedido);
  if (!auth.ok) return ERR(seccion, auth.error);
  const { perfil, tenantId } = auth;

  const db = await createClient();
  const ahora = new Date().toISOString();
  const { error } = await db
    .from("perfil_emisor")
    .upsert(
      {
        tenant_id: tenantId,
        ...campos,
        actualizado_por: perfil.id,
        actualizado_en: ahora,
      },
      { onConflict: "tenant_id" }
    )
    .select("id")
    .single();

  if (error) {
    return ERR(seccion, "No se pudo guardar. Revisa los datos e intenta de nuevo.");
  }

  // La bitácora se escribe siempre, pero después de responder: es una vuelta
  // más a la base y el usuario no espera por ella. `after()` corre una vez que
  // la respuesta ya salió, dentro de la misma petición.
  after(async () => {
    await logEvento(db, {
      tenantId,
      usuarioId: perfil.id,
      accion: "perfil_emisor_actualizado",
      entidad: "perfil_emisor",
      entidadId: null,
      detalle: { seccion, ...detalle },
    });
  });

  // Sin revalidatePath a propósito. Forzaba a re-renderizar la página entera
  // —lista de emisoras, perfil, adjuntos y sus URLs firmadas— dentro de la
  // misma respuesta, para volver a leer un dato que el usuario acaba de
  // escribir y que el formulario ya tiene en pantalla. Lo único que cambia
  // fuera del formulario es el sello de "actualizada", y va en este estado.
  // Las acciones que sí mueven algo que el cliente no puede saber (subir o
  // quitar un adjunto, subir el organigrama) conservan su revalidación.
  return OK(seccion, "Sección guardada.", {
    actualizadoEn: ahora,
    actualizadoPor: perfil.nombre ?? null,
  });
}

// -----------------------------------------------------------------------------
// Una acción por sección
// -----------------------------------------------------------------------------

export async function guardarIdentidad(_p: PerfilState, fd: FormData): Promise<PerfilState> {
  return guardar("identidad", texto(fd, "tenant_id"), {
    denominacion_formal: texto(fd, "denominacion_formal"),
    nombre_corto: texto(fd, "nombre_corto"),
    forma_de_referencia: texto(fd, "forma_de_referencia"),
    entidad_que_informa: texto(fd, "entidad_que_informa"),
    perimetro: texto(fd, "perimetro"),
  });
}

export async function guardarMatriz(_p: PerfilState, fd: FormData): Promise<PerfilState> {
  const escala = numero(fd, "escala_max") ?? 25;
  const niveles = filas(fd, ["nivel_nombre", "nivel_min", "nivel_max"])
    .filter((f) => f.nivel_nombre !== "")
    .map((f) => ({
      nombre: f.nivel_nombre,
      min: Number(f.nivel_min) || 0,
      max: Number(f.nivel_max) || 0,
    }));

  // Un nivel con max < min nunca casaría con ningún puntaje: el registro se
  // quedaría sin nivel y nadie sabría por qué. Se rechaza al guardar.
  const invertido = niveles.find((n) => n.max < n.min);
  if (invertido) {
    return ERR("matriz", `El nivel "${invertido.nombre}" tiene el máximo por debajo del mínimo.`);
  }

  return guardar(
    "matriz",
    texto(fd, "tenant_id"),
    { matriz_riesgos: { escala_max: escala, niveles } },
    { niveles: niveles.length, escala_max: escala }
  );
}

export async function guardarHorizontes(_p: PerfilState, fd: FormData): Promise<PerfilState> {
  // Los tres plazos son fijos (NIIF S2 10): se reconstruyen por posición, no
  // desde lo que mande el formulario.
  const defs = fd.getAll("definicion").map((v) => String(v).trim());
  const jus = fd.getAll("justificacion").map((v) => String(v).trim());
  const horizontes = PLAZOS.map((plazo, i) => ({
    plazo,
    definicion: defs[i] ?? "",
    justificacion: jus[i] ?? "",
  }));
  return guardar("horizontes", texto(fd, "tenant_id"), { horizontes });
}

export async function guardarCarta(_p: PerfilState, fd: FormData): Promise<PerfilState> {
  return guardar("carta", texto(fd, "tenant_id"), {
    carta_texto: texto(fd, "carta_texto"),
    carta_firmante: texto(fd, "carta_firmante"),
    carta_cargo: texto(fd, "carta_cargo"),
  });
}

export async function guardarHistoria(_p: PerfilState, fd: FormData): Promise<PerfilState> {
  const hitos = filas(fd, ["anio", "texto"]);
  return guardar(
    "historia",
    texto(fd, "tenant_id"),
    { hitos_corporativos: hitos },
    { hitos: hitos.length }
  );
}

export async function guardarTrayectoria(_p: PerfilState, fd: FormData): Promise<PerfilState> {
  const hitos = filas(fd, ["anio", "texto"]);
  return guardar(
    "trayectoria",
    texto(fd, "tenant_id"),
    { hitos_sostenibilidad: hitos },
    { hitos: hitos.length }
  );
}

export async function guardarModeloNegocio(_p: PerfilState, fd: FormData): Promise<PerfilState> {
  const cadena = filas(fd, ["etapa", "descripcion"]);
  return guardar(
    "modelo",
    texto(fd, "tenant_id"),
    { modelo_negocio: texto(fd, "modelo_negocio"), cadena_valor: cadena },
    { etapas: cadena.length }
  );
}

export async function guardarGobierno(_p: PerfilState, fd: FormData): Promise<PerfilState> {
  return guardar("gobierno", texto(fd, "tenant_id"), {
    gobierno_texto: texto(fd, "gobierno_texto"),
  });
}

export async function guardarMaterialidad(_p: PerfilState, fd: FormData): Promise<PerfilState> {
  return guardar("materialidad", texto(fd, "tenant_id"), {
    proceso_materialidad: texto(fd, "proceso_materialidad"),
  });
}

// -----------------------------------------------------------------------------
// Organigrama: sube al bucket privado `documentos` bajo {tenant_id}/perfil/.
// -----------------------------------------------------------------------------
const IMAGENES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function subirOrganigrama(_p: PerfilState, fd: FormData): Promise<PerfilState> {
  const auth = await autorizar(texto(fd, "tenant_id"));
  if (!auth.ok) return ERR("gobierno", auth.error);
  const { perfil, tenantId } = auth;

  const archivo = fd.get("organigrama");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return ERR("gobierno", "Elige una imagen.");
  }
  if (!IMAGENES.includes(archivo.type)) {
    return ERR("gobierno", "El organigrama debe ser PNG, JPG, WebP o SVG.");
  }
  if (archivo.size > MAX_BYTES) {
    return ERR("gobierno", "La imagen supera 5 MB.");
  }

  const db = await createClient();

  // Nombre con marca de tiempo: no se sobreescribe la imagen anterior, porque el
  // organigrama de un documento ya generado tiene que seguir existiendo.
  const ext = (archivo.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ruta = `${tenantId}/perfil/organigrama-${Date.now()}.${ext}`;

  const { error: upErr } = await db.storage
    .from("documentos")
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (upErr) return ERR("gobierno", "No se pudo subir la imagen.");

  const { error } = await db
    .from("perfil_emisor")
    .upsert(
      {
        tenant_id: tenantId,
        organigrama_path: ruta,
        actualizado_por: perfil.id,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    )
    .select("id")
    .single();
  if (error) return ERR("gobierno", "La imagen se subió pero no se pudo registrar.");

  after(async () => {
    await logEvento(db, {
      tenantId,
      usuarioId: perfil.id,
      accion: "perfil_organigrama_subido",
      entidad: "perfil_emisor",
      entidadId: null,
      detalle: { ruta, bytes: archivo.size },
    });
  });

  revalidatePath("/admin/perfil");
  return OK("gobierno", "Organigrama actualizado.");
}

/**
 * URL firmada para la vista previa. El bucket es privado, así que no hay URL
 * pública: se pide una temporal cada vez que se pinta la pantalla.
 */
export async function urlOrganigrama(ruta: string): Promise<string | null> {
  const db = await createClient();
  const { data } = await db.storage.from("documentos").createSignedUrl(ruta, 60 * 10);
  return data?.signedUrl ?? null;
}

// =============================================================================
// Adjuntos por sección.
//
// Se guardan, se listan, se descargan y se quitan. El generador NO los lee en
// esta fase: subir el estudio de materialidad no hace que el bloque 7 se escriba
// solo. Ver §3.2 de la especificación para cuándo empiezan a serlo.
// =============================================================================

export type AdjuntoState = {
  ok: boolean;
  error?: string | null;
  mensaje?: string | null;
  seccion?: string | null;
};

const TIPOS_ADJUNTO: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "image/png": "png",
  "image/jpeg": "jpg",
};
const MAX_ADJUNTO = 20 * 1024 * 1024;

/** Nombre de objeto seguro: sin rutas, sin acentos raros, con marca de tiempo. */
function nombreObjeto(original: string): string {
  const base = original
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  const ext = (original.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${Date.now()}-${base || "archivo"}.${ext}`;
}

export async function subirAdjunto(_p: AdjuntoState, fd: FormData): Promise<AdjuntoState> {
  const seccion = String(fd.get("seccion") ?? "").trim();
  const auth = await autorizar(texto(fd, "tenant_id"));
  if (!auth.ok) return { ok: false, error: auth.error, seccion };
  const { perfil, tenantId } = auth;

  const archivo = fd.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "Elige un archivo.", seccion };
  }
  if (!TIPOS_ADJUNTO[archivo.type]) {
    return { ok: false, error: "Formatos admitidos: PDF, DOCX, XLSX, PNG y JPG.", seccion };
  }
  if (archivo.size > MAX_ADJUNTO) {
    return { ok: false, error: "El archivo supera 20 MB.", seccion };
  }

  const db = await createClient();
  const ruta = `${tenantId}/perfil/${seccion}/${nombreObjeto(archivo.name)}`;

  const { error: upErr } = await db.storage
    .from("documentos")
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (upErr) return { ok: false, error: "No se pudo subir el archivo.", seccion };

  const { error } = await db.from("perfil_emisor_adjuntos").insert({
    tenant_id: tenantId,
    seccion,
    archivo_path: ruta,
    nombre_original: archivo.name,
    mime: archivo.type,
    tamano: archivo.size,
    subido_por: perfil.id,
  });
  if (error) {
    // El objeto ya está en el bucket; sin fila quedaría huérfano y nadie podría
    // verlo ni quitarlo desde la interfaz.
    await db.storage.from("documentos").remove([ruta]);
    return { ok: false, error: "El archivo se subió pero no se pudo registrar.", seccion };
  }

  after(async () => {
    await logEvento(db, {
      tenantId,
      usuarioId: perfil.id,
      accion: "perfil_adjunto_subido",
      entidad: "perfil_emisor",
      entidadId: null,
      detalle: { seccion, nombre: archivo.name, bytes: archivo.size },
    });
  });

  revalidatePath("/admin/perfil");
  return { ok: true, error: null, mensaje: "Archivo adjuntado.", seccion };
}

export async function quitarAdjunto(_p: AdjuntoState, fd: FormData): Promise<AdjuntoState> {
  const seccion = String(fd.get("seccion") ?? "").trim();
  const id = String(fd.get("adjunto_id") ?? "").trim();
  const auth = await autorizar(texto(fd, "tenant_id"));
  if (!auth.ok) return { ok: false, error: auth.error, seccion };
  const { perfil, tenantId } = auth;

  const db = await createClient();
  // Se relee la fila para no fiarse del `archivo_path` que venga del formulario:
  // con él se borra un objeto del bucket, y RLS acota esta lectura al tenant.
  const { data: fila } = await db
    .from("perfil_emisor_adjuntos")
    .select("id, archivo_path, nombre_original, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!fila || fila.tenant_id !== tenantId) {
    return { ok: false, error: "No se encontró el archivo.", seccion };
  }

  const { error } = await db.from("perfil_emisor_adjuntos").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo quitar el archivo.", seccion };
  await db.storage.from("documentos").remove([fila.archivo_path]);

  after(async () => {
    await logEvento(db, {
      tenantId,
      usuarioId: perfil.id,
      accion: "perfil_adjunto_eliminado",
      entidad: "perfil_emisor",
      entidadId: null,
      detalle: { seccion, nombre: fila.nombre_original },
    });
  });

  revalidatePath("/admin/perfil");
  return { ok: true, error: null, mensaje: "Archivo quitado.", seccion };
}

/** URL firmada de descarga. El bucket es privado: no hay URL pública. */
export async function urlAdjunto(ruta: string): Promise<string | null> {
  const db = await createClient();
  const { data } = await db.storage.from("documentos").createSignedUrl(ruta, 60 * 10);
  return data?.signedUrl ?? null;
}
