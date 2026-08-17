// =============================================================================
// Reglas de alta y branding de clientes (tenants). Fuente única compartida por
// la UI y las server actions: la acción del servidor es la autoridad, la UI la
// refleja para no ofrecer lo que el servidor rechazaría.
//
// Los formatos de `slug` y `prefijo_folio` están además declarados como CHECK en
// la base (migración 20260817120000_multicliente): esto es la primera barrera,
// no la única.
// =============================================================================

/** Áreas estándar que se ofrecen al dar de alta un cliente. */
export const AREAS_ESTANDAR = ["RH", "Operaciones", "Finanzas"] as const;

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const PREFIJO_RE = /^[A-Z]{3,4}$/;

export const SLUG_MAX = 60;
export const NOMBRE_MAX = 120;
export const AREA_MAX = 60;

/**
 * Slug sugerido a partir del nombre: sin diacríticos, kebab-case, sin la
 * etiqueta [DEMO]. Es una SUGERENCIA: el formulario deja editarlo.
 */
export function slugSugerido(nombre: string): string {
  return nombre
    .replace(/\[DEMO\]/gi, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/**
 * Prefijo de folios sugerido: las primeras 4 letras del nombre. Si el nombre no
 * alcanza 3 letras, no se sugiere nada (que lo escriba quien da de alta).
 */
export function prefijoSugerido(nombre: string): string {
  const letras = nombre
    .replace(/\[DEMO\]/gi, "")
    .normalize("NFD")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return letras.length >= 3 ? letras.slice(0, 4) : "";
}

/** Mensaje de error del slug, o null si es válido. */
export function validarSlug(slug: string): string | null {
  if (!slug) return "El identificador (slug) es obligatorio.";
  if (slug.length > SLUG_MAX) return `El identificador no puede exceder ${SLUG_MAX} caracteres.`;
  if (!SLUG_RE.test(slug)) {
    return "El identificador solo admite minúsculas, números y guiones (por ejemplo: grupo-alfa).";
  }
  return null;
}

/** Mensaje de error del prefijo de folios, o null si es válido. */
export function validarPrefijo(prefijo: string): string | null {
  if (!prefijo) return "El prefijo de folios es obligatorio.";
  if (!PREFIJO_RE.test(prefijo)) {
    return "El prefijo debe ser de 3 o 4 letras mayúsculas (por ejemplo: ALFA).";
  }
  return null;
}

/** Normaliza y deduplica la lista de áreas iniciales, conservando el orden. */
export function normalizarAreas(areas: string[]): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const bruta of areas) {
    const area = bruta.trim().replace(/\s+/g, " ").slice(0, AREA_MAX);
    if (!area) continue;
    const clave = area.toLocaleLowerCase("es");
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    salida.push(area);
  }
  return salida;
}

// -----------------------------------------------------------------------------
// Logo
// -----------------------------------------------------------------------------

/** Tipos aceptados para el logo (coinciden con allowed_mime_types del bucket). */
export const LOGO_MIMES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
] as const;

export const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
/** Ancho máximo de la versión optimizada de un logo rasterizado. */
export const LOGO_MAX_ANCHO = 400;

export const LOGO_ACCEPT = LOGO_MIMES.join(",");

export function esMimeLogoValido(mime: string): mime is (typeof LOGO_MIMES)[number] {
  return (LOGO_MIMES as readonly string[]).includes(mime);
}

/** ¿Es un formato rasterizado (redimensionable) y no vectorial? */
export function esRaster(mime: string): boolean {
  return mime !== "image/svg+xml";
}

/**
 * Iniciales del tenant para el círculo de respaldo cuando no hay logo. Mismo
 * criterio que el avatar de usuario: hasta dos iniciales, sin la etiqueta [DEMO].
 */
export function inicialesTenant(nombre: string): string {
  const limpio = nombre.replace(/\[DEMO\]\s*/i, "").trim();
  return (
    limpio
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toLocaleUpperCase("es"))
      .join("") || "·"
  );
}

/** Nombre del tenant sin la etiqueta [DEMO] del seed. */
export function limpiarNombreTenant(nombre: string): string {
  return nombre.replace(/\[DEMO\]\s*/i, "").trim();
}
