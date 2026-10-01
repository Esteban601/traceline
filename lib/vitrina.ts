import "server-only";

import path from "node:path";
import fs from "node:fs/promises";
import { createAdminClient } from "@/lib/supabase/admin";

// =============================================================================
// DÓNDE VIVEN LOS ARCHIVOS DE VITRINA
//
// Primero el bucket privado `vitrina` de Supabase; si ahí no están, la carpeta
// `assets/vitrina/` del repositorio.
//
// El orden no es caprichoso. Sustituir el documento de muestra por uno nuevo es
// una tarea de quien prepara la demostración, no de quien despliega: con el
// bucket delante, se sube por el dashboard y el cambio es inmediato, sin
// commit, sin build y sin reinicio. La carpeta del repositorio queda como
// respaldo, para que un ambiente recién levantado —o uno sin bucket— siga
// teniendo algo que enseñar.
//
// El bucket es PRIVADO y no tiene políticas: solo `service_role` lo lee. La
// sesión del usuario nunca toca el objeto; lo sirve la ruta, que ya comprobó
// quién pide y si esa emisora es de demostración. Comprobado: con una sesión de
// staff autenticada, la descarga directa responde «Object not found».
//
// Un módulo y no dos comprobaciones sueltas porque la regla de precedencia tiene
// que ser la misma en los dos sitios que la usan: la ruta que sirve el archivo y
// la pantalla que decide si ofrecer la opción. Si se separan, un día la pantalla
// ofrecerá una descarga que la ruta no encuentra.
// =============================================================================

export type ArchivoVitrina = "suplemento-demo.docx" | "suplemento-demo.pdf";

const BUCKET = "vitrina";

const rutaLocal = (nombre: ArchivoVitrina): string =>
  path.join(process.cwd(), "assets", "vitrina", nombre);

/**
 * El contenido del archivo, o `null` si no está en ninguno de los dos sitios.
 * Devuelve además de dónde salió, que es lo que se anota en la bitácora: sin
 * eso, un documento desactualizado en el repositorio y uno recién subido al
 * bucket producen la misma línea de registro.
 */
export async function leerArchivoVitrina(
  nombre: ArchivoVitrina
): Promise<{ contenido: Buffer; origen: "bucket" | "repositorio" } | null> {
  try {
    const db = createAdminClient();
    // SE PREGUNTA POR EL LISTADO ANTES DE DESCARGAR, y no es una precaución
    // ociosa: durante unos segundos tras borrar un objeto, `download` lo sigue
    // devolviendo desde la caché de Storage mientras `list` ya lo da por
    // ausente. Con las dos funciones consultando fuentes distintas, la pantalla
    // podía decir «En preparación» mientras la ruta seguía sirviendo el archivo
    // recién retirado. El listado es la única fuente de verdad para las dos.
    if (await enElBucket(db, nombre)) {
      const { data } = await db.storage.from(BUCKET).download(nombre);
      if (data) {
        return { contenido: Buffer.from(await data.arrayBuffer()), origen: "bucket" };
      }
    }
  } catch (e) {
    // Que el bucket no exista todavía, o que falte la clave de servicio, no
    // debe dejar sin documento a quien lo pide: se cae al repositorio y queda
    // dicho en el log, porque es una diferencia que importa al diagnosticar.
    console.error("[vitrina] no se pudo leer del bucket, se usa el repositorio:", e);
  }

  try {
    return { contenido: await fs.readFile(rutaLocal(nombre)), origen: "repositorio" };
  } catch {
    return null;
  }
}

/**
 * ¿Está el objeto en el bucket? Con `list` y no descargando: la pantalla se
 * pinta en cada petición y traerse un documento de 40 KB para saber si existe
 * es pagar el archivo entero por un booleano.
 */
async function enElBucket(
  db: ReturnType<typeof createAdminClient>,
  nombre: ArchivoVitrina
): Promise<boolean> {
  const { data } = await db.storage.from(BUCKET).list("", { search: nombre });
  return !!data?.some((o) => o.name === nombre);
}

/**
 * ¿Hay archivo, en cualquiera de los dos sitios? Es lo que decide si la opción
 * se ofrece o sale «En preparación».
 */
export async function existeArchivoVitrina(nombre: ArchivoVitrina): Promise<boolean> {
  try {
    if (await enElBucket(createAdminClient(), nombre)) return true;
  } catch (e) {
    console.error("[vitrina] no se pudo listar el bucket:", e);
  }

  return fs
    .access(rutaLocal(nombre))
    .then(() => true)
    .catch(() => false);
}
