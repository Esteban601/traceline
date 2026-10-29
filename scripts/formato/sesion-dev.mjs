// =============================================================================
// Sesión del staff del seed en el proyecto DEV, sin contraseña en el código
// (cierre del encargo 2026-10-26-formato-afirmaciones-y-voz). La usan las
// herramientas de scripts/formato/ que leen o descargan como el staff:
// bajar-entregables, respuestas-en-seco y regenerar-una-respuesta.
//
// Con la llave de servicio de dev se emite un enlace de acceso para el correo del
// staff (no se envía ningún correo) y se canjea por una sesión. La sesión queda en
// un frasco de cookies: sirve al cliente de datos (RLS como el staff) y a las
// peticiones HTTP a la aplicación (cookie). Solo dev: la URL tiene que contener
// el ref de dev y ningún otro. No imprime llaves ni tokens.
// =============================================================================
import { createRequire } from "node:module";
import { createServerClient } from "@supabase/ssr";

const REF_DEV = "kmjkoxecxcujxixlxwlb";
const OTROS_REFS = ["ewgnvjtjhvdltvkopptn"];
export const STAFF_SEED = "admin@irstrat.example";

/** Corta si el entorno no es el proyecto dev. */
export function exigirDev() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes(REF_DEV) || OTROS_REFS.some((r) => url.includes(r))) {
    console.error("✗ Solo contra el proyecto dev (NEXT_PUBLIC_SUPABASE_URL).");
    process.exit(2);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("✗ Faltan las llaves de Supabase en el entorno (--env-file=<.env.local de dev>).");
    process.exit(2);
  }
  return url;
}

/** { db: cliente con la sesión del staff, admin: cliente de servicio, cookie: encabezado Cookie para la aplicación }. */
export async function sesionStaffDev(email = STAFF_SEED) {
  const url = exigirDev();
  const { createClient } = createRequire(import.meta.url)("@supabase/supabase-js");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: enlace, error: eEnlace } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (eEnlace || !enlace?.properties?.hashed_token) { console.error(`✗ No se pudo emitir el acceso de ${email}.`); process.exit(2); }
  const jar = new Map();
  const db = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (a) => a.forEach(({ name, value }) => jar.set(name, value)) },
  });
  const { error } = await db.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: "magiclink" });
  if (error) { console.error(`✗ No se pudo abrir la sesión de ${email}.`); process.exit(2); }
  const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
  return { db, admin, cookie };
}
