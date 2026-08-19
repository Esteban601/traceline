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
 * ¿Es un despliegue SIN dominio propio, que no debe indexarse? Se activa con
 * NEXT_PUBLIC_STAGING=true (config var solo en Heroku). En local queda false, sin
 * cambio de comportamiento.
 *
 * Solo gobierna el noindex/nofollow del layout, que es una propiedad de la URL.
 * La franja "Entorno de demostración" YA NO depende de esto: es del tenant
 * (`tenants.es_demo`), porque en el mismo despliegue conviven la emisora demo y
 * clientes con datos reales, y una franja global le mentiría a estos últimos.
 */
export const IS_STAGING = process.env.NEXT_PUBLIC_STAGING === "true";
