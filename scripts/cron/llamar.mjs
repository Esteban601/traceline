#!/usr/bin/env node
// =============================================================================
// Llamada de un job del Heroku Scheduler a una ruta cron de la propia app.
//
//   node scripts/cron/llamar.mjs evidencias/procesar
//   node scripts/cron/llamar.mjs recordatorios
//
// POR QUÉ EXISTE. El dyno manager de Heroku escribe en el log la línea
// «heroku[scheduler.N] Starting process with command `…`» con las variables de
// entorno YA SUSTITUIDAS, con o sin comillas y con o sin `bash -c`. Un comando
// de job con `$CRON_SECRET` deja el secreto en texto plano en los logs (encargo
// 2026-10-05-generador-a-produccion, cierre de v33). Por eso el comando del job
// no lleva variables: este script lee CRON_SECRET y NEXT_PUBLIC_APP_URL de
// process.env dentro del dyno. CLAUDE.md §6: ningún job del Scheduler lleva
// variables en su comando.
//
// Hace POST <NEXT_PUBLIC_APP_URL>/api/<ruta> con el header x-cron-secret.
// Imprime solo la ruta, el código HTTP y la duración; nunca el secreto ni el
// cuerpo de la respuesta. Sale con 0 si la respuesta es 2xx y con 1 si no (un
// código de salida no puede ser el HTTP: el máximo es 255).
// =============================================================================

const ruta = process.argv[2];
const secreto = process.env.CRON_SECRET;
const app = process.env.NEXT_PUBLIC_APP_URL;

if (!ruta || !/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(ruta)) {
  console.error("Uso: node scripts/cron/llamar.mjs <ruta>   (p. ej. evidencias/procesar)");
  process.exit(2);
}
if (!secreto || !app) {
  console.error(`✗ Falta ${!secreto ? "CRON_SECRET" : "NEXT_PUBLIC_APP_URL"} en el entorno.`);
  process.exit(2);
}

const url = `${app.replace(/\/+$/, "")}/api/${ruta}`;
const inicio = Date.now();
try {
  const r = await fetch(url, {
    method: "POST",
    headers: { "x-cron-secret": secreto },
    // Holgura para la cola de lectura, que procesa un lote por llamada.
    signal: AbortSignal.timeout(280_000),
  });
  await r.arrayBuffer(); // se consume sin imprimirlo
  console.log(`POST /api/${ruta} → ${r.status} (${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
  process.exit(r.ok ? 0 : 1);
} catch (e) {
  console.error(`✗ POST /api/${ruta}: ${e?.name ?? "error"}`);
  process.exit(1);
}
