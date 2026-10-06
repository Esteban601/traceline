// Enganche de resolución para correr módulos de lib/ desde Node en las pruebas:
// resuelve el alias `@/`, las rutas relativas sin extensión dentro de .ts, y
// neutraliza `server-only` (que en Node puro siempre lanza).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const candidatos = (base) => [`${base}.ts`, `${base}.tsx`, base, path.join(base, "index.ts")];
const primero = (base) => candidatos(base).find((c) => fs.existsSync(c) && fs.statSync(c).isFile());

export async function resolve(spec, ctx, next) {
  if (spec === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (spec.startsWith("@/")) {
    const f = primero(path.join(RAIZ, spec.slice(2)));
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true };
  }
  if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.match(/\.tsx?$/) && !path.extname(spec)) {
    const f = primero(path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec));
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true };
  }
  return next(spec, ctx);
}
