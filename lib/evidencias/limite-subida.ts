// =============================================================================
// LÍMITE DE SUBIDA DE EVIDENCIAS (hotfix v32, 4 de octubre de 2026).
//
// Hasta v31 la subida pasaba por una server action con el límite por defecto de
// Next (1 MB): todo archivo de más de 1 MB fallaba con «Algo salió mal». El
// límite de la server action sube a 26 MB en next.config.mjs (un margen sobre
// el archivo por los demás campos del formulario) y el de la evidencia es 25 MB.
//
// Se comprueba en el cliente al elegir el archivo —para que el usuario vea el
// mensaje sin mandar nada— y otra vez en la acción del servidor, que es la que
// manda. La subida directa a storage con URL firmada (encargo de captura
// sugerida) sustituye este camino; el límite de 25 MB se queda.
// =============================================================================

export const BYTES_MAX_EVIDENCIA = 25 * 1024 * 1024;

export const MENSAJE_ARCHIVO_GRANDE = "El archivo supera 25 MB; comprímalo o divídalo.";

export function excedeLimite(bytes: number): boolean {
  return bytes > BYTES_MAX_EVIDENCIA;
}
