/**
 * Nombre comercial de la aplicación. PENDIENTE de definir: se toma siempre de
 * la variable de entorno, nunca se hardcodea. Default provisional: TRACELINE.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "TRACELINE";

/**
 * URL base pública para construir enlaces absolutos (p. ej. CTAs de correo).
 * Sin barra final. Default local.
 */
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

/**
 * ¿Estamos en el ambiente de staging/demostración? Se activa con
 * NEXT_PUBLIC_STAGING=true (config var solo en Heroku). En local queda false → sin
 * banner ni noindex, sin cambio de comportamiento. Es NEXT_PUBLIC (se inlinea en
 * build) para poder leerse tanto en servidor como en cliente si hiciera falta.
 */
export const IS_STAGING = process.env.NEXT_PUBLIC_STAGING === "true";
