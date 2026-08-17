"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { logEvento } from "@/lib/bitacora";
import {
  LOGO_MAX_BYTES,
  esMimeLogoValido,
  esRaster,
  limpiarNombreTenant,
  normalizarAreas,
  NOMBRE_MAX,
  validarPrefijo,
  validarSlug,
} from "@/lib/tenants";

const BUCKET_LOGOS = "logos";

export type AltaClienteState = {
  ok: boolean;
  error?: string | null;
  /** Datos del cliente recién creado, para encadenar el flujo (reporte, usuarios). */
  creado?: {
    id: string;
    nombre: string;
    slug: string;
    prefijoFolio: string;
    areas: string[];
  } | null;
};

export type AccionTenantState = {
  ok: boolean;
  error?: string | null;
  mensaje?: string | null;
};

export type LogoState = AccionTenantState & { logoUrl?: string | null };

/**
 * Alta de un cliente (tenant) con sus áreas iniciales. Al terminar el tenant
 * queda OPERABLE: existe, está activo y tiene sus áreas creadas, listo para
 * recibir su primer reporte y sus usuarios.
 */
export async function crearCliente(
  _prev: AltaClienteState,
  fd: FormData
): Promise<AltaClienteState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const nombre = String(fd.get("nombre") ?? "").trim().replace(/\s+/g, " ");
  const slug = String(fd.get("slug") ?? "").trim().toLowerCase();
  const prefijoFolio = String(fd.get("prefijo_folio") ?? "").trim().toUpperCase();
  const areas = normalizarAreas(fd.getAll("areas").map((a) => String(a)));

  if (!nombre) return { ok: false, error: "El nombre del cliente es obligatorio." };
  if (nombre.length > NOMBRE_MAX) {
    return { ok: false, error: `El nombre no puede exceder ${NOMBRE_MAX} caracteres.` };
  }

  const errSlug = validarSlug(slug);
  if (errSlug) return { ok: false, error: errSlug };

  const errPrefijo = validarPrefijo(prefijoFolio);
  if (errPrefijo) return { ok: false, error: errPrefijo };

  if (areas.length === 0) {
    return {
      ok: false,
      error: "Elige al menos un área: sin áreas el cliente no puede recibir solicitudes.",
    };
  }

  const db = await createClient();

  // Pre-chequeo de unicidad para dar un mensaje claro. La garantía real son los
  // UNIQUE de la tabla (abajo se traduce el 23505 por si hay carrera).
  const { data: choques } = await db
    .from("tenants")
    .select("slug, prefijo_folio")
    .or(`slug.eq.${slug},prefijo_folio.eq.${prefijoFolio}`);

  if (choques?.some((c) => c.slug === slug)) {
    return { ok: false, error: `Ya existe un cliente con el identificador “${slug}”.` };
  }
  if (choques?.some((c) => c.prefijo_folio === prefijoFolio)) {
    return { ok: false, error: `El prefijo de folios “${prefijoFolio}” ya está en uso.` };
  }

  const { data: tenant, error: tErr } = await db
    .from("tenants")
    .insert({ nombre, slug, prefijo_folio: prefijoFolio, activo: true })
    .select("id, nombre, slug, prefijo_folio")
    .single();

  if (tErr || !tenant) {
    if (tErr?.code === "23505") {
      const dupPrefijo = tErr.message.includes("prefijo_folio");
      return {
        ok: false,
        error: dupPrefijo
          ? `El prefijo de folios “${prefijoFolio}” ya está en uso.`
          : `Ya existe un cliente con el identificador “${slug}”.`,
      };
    }
    return { ok: false, error: "No se pudo crear el cliente." };
  }

  const { error: aErr } = await db.from("areas_tenant").insert(
    areas.map((nombreArea, i) => ({ tenant_id: tenant.id, nombre: nombreArea, orden: i }))
  );
  if (aErr) {
    // Sin áreas el cliente no es operable, que es justo lo que promete el alta:
    // se revierte para no dejar un tenant a medias.
    await db.from("tenants").delete().eq("id", tenant.id);
    return { ok: false, error: "No se pudieron crear las áreas del cliente." };
  }

  await logEvento(db, {
    tenantId: tenant.id,
    usuarioId: perfil.id,
    accion: "tenant_creado",
    entidad: "tenants",
    entidadId: tenant.id,
    detalle: { nombre, slug, prefijo_folio: prefijoFolio, areas },
  });

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/plantillas");
  revalidatePath("/admin");

  return {
    ok: true,
    error: null,
    creado: {
      id: tenant.id,
      nombre: tenant.nombre,
      slug: tenant.slug,
      prefijoFolio: tenant.prefijo_folio,
      areas,
    },
  };
}

/**
 * Desactiva o reactiva un cliente. NUNCA lo elimina: su reporte, su evidencia y
 * su bitácora son historia que la trazabilidad conserva. Con el cliente
 * inactivo, sus usuarios no pueden entrar (lo aplica el middleware y el layout
 * del portal) y deja de ofrecerse para trabajo nuevo.
 */
export async function cambiarActivoTenant(
  tenantId: string,
  activar: boolean
): Promise<AccionTenantState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }
  if (!tenantId) return { ok: false, error: "Cliente no válido." };

  const db = await createClient();

  const { data: tenant } = await db
    .from("tenants")
    .select("id, nombre, activo")
    .eq("id", tenantId)
    .single();
  if (!tenant) return { ok: false, error: "No se encontró el cliente." };
  if (tenant.activo === activar) {
    return { ok: false, error: activar ? "El cliente ya está activo." : "El cliente ya está inactivo." };
  }

  const { error } = await db.from("tenants").update({ activo: activar }).eq("id", tenantId);
  if (error) return { ok: false, error: "No se pudo actualizar el cliente." };

  await logEvento(db, {
    tenantId,
    usuarioId: perfil.id,
    accion: activar ? "tenant_reactivado" : "tenant_desactivado",
    entidad: "tenants",
    entidadId: tenantId,
    detalle: { nombre: tenant.nombre },
  });

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin");
  return {
    ok: true,
    error: null,
    mensaje: activar
      ? `${limpiarNombreTenant(tenant.nombre)} quedó activo.`
      : `${limpiarNombreTenant(tenant.nombre)} quedó inactivo. Sus usuarios ya no pueden ingresar.`,
  };
}

/** Ruta del objeto dentro del bucket 'logos' a partir de su URL pública. */
function rutaDesdeUrlPublica(url: string | null): string | null {
  if (!url) return null;
  const marca = `/storage/v1/object/public/${BUCKET_LOGOS}/`;
  const i = url.indexOf(marca);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marca.length).split("?")[0]) || null;
}

const EXT_POR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

/**
 * Un SVG es código, no solo una imagen: se sirve desde un bucket público, así
 * que se rechaza el que traiga script, manejadores de evento o URIs ejecutables.
 */
function svgSospechoso(texto: string): boolean {
  return (
    /<\s*script/i.test(texto) ||
    /\son\w+\s*=/i.test(texto) ||
    /javascript\s*:/i.test(texto) ||
    /<\s*foreignObject/i.test(texto)
  );
}

/**
 * Sube o reemplaza el logo del cliente. La versión rasterizada ya llega
 * reducida a `LOGO_MAX_ANCHO` desde el navegador (ver logo-uploader); aquí se
 * revalida tipo y peso, que es lo que no se le puede confiar al cliente.
 */
export async function subirLogo(_prev: LogoState, fd: FormData): Promise<LogoState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }

  const tenantId = String(fd.get("tenant_id") ?? "").trim();
  const archivo = fd.get("logo");

  if (!tenantId) return { ok: false, error: "Cliente no válido." };
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "Selecciona un archivo de imagen." };
  }
  if (!esMimeLogoValido(archivo.type)) {
    return { ok: false, error: "Formato no admitido. Usa PNG, JPG, SVG o WebP." };
  }
  if (archivo.size > LOGO_MAX_BYTES) {
    return { ok: false, error: "El logo no puede pesar más de 2 MB." };
  }
  if (!esRaster(archivo.type) && svgSospechoso(await archivo.text())) {
    return {
      ok: false,
      error: "El SVG contiene código ejecutable (script o manejadores de evento). Súbelo sin scripts.",
    };
  }

  const db = await createClient();

  const { data: tenant } = await db
    .from("tenants")
    .select("id, nombre, logo_url")
    .eq("id", tenantId)
    .single();
  if (!tenant) return { ok: false, error: "No se encontró el cliente." };

  const ext = EXT_POR_MIME[archivo.type];
  const ruta = `${tenantId}/logo-${Date.now()}.${ext}`;

  const { error: upErr } = await db.storage
    .from(BUCKET_LOGOS)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (upErr) {
    return { ok: false, error: `No se pudo subir el logo: ${upErr.message}` };
  }

  const {
    data: { publicUrl },
  } = db.storage.from(BUCKET_LOGOS).getPublicUrl(ruta);

  const { error: updErr } = await db
    .from("tenants")
    .update({ logo_url: publicUrl })
    .eq("id", tenantId);
  if (updErr) {
    await db.storage.from(BUCKET_LOGOS).remove([ruta]); // no dejar el objeto huérfano
    return { ok: false, error: "No se pudo guardar el logo del cliente." };
  }

  // El anterior ya no se referencia: se retira para no acumular basura.
  const rutaAnterior = rutaDesdeUrlPublica(tenant.logo_url);
  if (rutaAnterior && rutaAnterior !== ruta) {
    await db.storage.from(BUCKET_LOGOS).remove([rutaAnterior]);
  }

  await logEvento(db, {
    tenantId,
    usuarioId: perfil.id,
    accion: "tenant_logo_actualizado",
    entidad: "tenants",
    entidadId: tenantId,
    detalle: { nombre: tenant.nombre, archivo: archivo.name, tipo: archivo.type },
  });

  revalidatePath("/admin/clientes");
  revalidatePath("/admin");
  revalidatePath("/portal");
  return { ok: true, error: null, mensaje: "Logo actualizado.", logoUrl: publicUrl };
}

/** Quita el logo del cliente: la UI vuelve a las iniciales del design system. */
export async function quitarLogo(tenantId: string): Promise<LogoState> {
  const perfil = await getPerfilActual();
  if (!perfil || !esStaff(perfil)) {
    return { ok: false, error: "Acción reservada al equipo de IRStrat." };
  }
  if (!tenantId) return { ok: false, error: "Cliente no válido." };

  const db = await createClient();

  const { data: tenant } = await db
    .from("tenants")
    .select("id, nombre, logo_url")
    .eq("id", tenantId)
    .single();
  if (!tenant) return { ok: false, error: "No se encontró el cliente." };
  if (!tenant.logo_url) return { ok: false, error: "Este cliente no tiene logo." };

  const { error } = await db.from("tenants").update({ logo_url: null }).eq("id", tenantId);
  if (error) return { ok: false, error: "No se pudo quitar el logo." };

  const ruta = rutaDesdeUrlPublica(tenant.logo_url);
  if (ruta) await db.storage.from(BUCKET_LOGOS).remove([ruta]);

  await logEvento(db, {
    tenantId,
    usuarioId: perfil.id,
    accion: "tenant_logo_eliminado",
    entidad: "tenants",
    entidadId: tenantId,
    detalle: { nombre: tenant.nombre },
  });

  revalidatePath("/admin/clientes");
  revalidatePath("/admin");
  revalidatePath("/portal");
  return { ok: true, error: null, mensaje: "Logo eliminado.", logoUrl: null };
}
