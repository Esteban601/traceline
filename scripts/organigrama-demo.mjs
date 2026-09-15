#!/usr/bin/env node
// =============================================================================
// ORGANIGRAMA DEL TENANT DEMO
//
// Dibuja el organigrama que describe docs/suplemento-s1s2/demo/contenido.md
// (Consejo → tres comités → Dirección General → seis direcciones), lo rasteriza
// y lo deja en el Perfil del emisor.
//
// El SVG se escribe a mano y se rasteriza con el navegador que ya trae el
// proyecto para las pruebas: añadir una librería de gráficos para una imagen que
// se genera una vez sería pagar su mantenimiento para siempre. Se sube PNG y no
// el SVG porque el destino final es un documento de Word, y Word no incrusta SVG
// de forma fiable.
//
// Solo dev, igual que poblar-demo.mjs.
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const DEV_REF = "kmjkoxecxcujxixlxwlb";
const TENANT = "10000000-0000-0000-0000-000000000001";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

if (!(env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes(DEV_REF)) {
  console.error(`\n✗ ABORTA: la URL de Supabase no es la de traceline-dev (${DEV_REF}).\n`);
  process.exit(1);
}
console.log(`barrera: proyecto ${DEV_REF} = traceline-dev ✓`);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// -----------------------------------------------------------------------------
// El dibujo
// -----------------------------------------------------------------------------
const W = 1280;
const H = 720;

const TINTA = "#14302a";
const LINEA = "#c9c2b4";
const CREMA = "#faf7f0";
const TEAL = "#14302a";
const ORO = "#8a6d1b";

const COMITES = [
  "Comité de Auditoría y\nPrácticas Societarias",
  "Comité de Riesgos",
  "Comité de Sostenibilidad y\nRiesgos Climáticos",
];

const DIRECCIONES = [
  "Riesgos",
  "Sostenibilidad",
  "Crédito y Banca",
  "Finanzas",
  "Recursos Humanos",
  "Administración\ny Operaciones",
];

/** Caja con texto centrado; `lineas` admite salto con \n. */
function caja(x, y, w, h, texto, { relleno = CREMA, borde = LINEA, color = TINTA, peso = 500, tam = 15 } = {}) {
  const lineas = texto.split("\n");
  const alto = lineas.length * (tam + 4);
  let t = "";
  lineas.forEach((l, i) => {
    const cy = y + h / 2 - alto / 2 + (tam + 4) * i + tam;
    t += `<text x="${x + w / 2}" y="${cy}" text-anchor="middle" font-size="${tam}" font-weight="${peso}" fill="${color}" font-family="Helvetica, Arial, sans-serif">${l}</text>`;
  });
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${relleno}" stroke="${borde}" stroke-width="1.5"/>${t}`;
}

const linea = (x1, y1, x2, y2) =>
  `<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="${LINEA}" stroke-width="1.5" fill="none"/>`;

function svg() {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  s += `<rect width="${W}" height="${H}" fill="#fffdf8"/>`;
  s += `<text x="${W / 2}" y="46" text-anchor="middle" font-size="13" letter-spacing="3" fill="${ORO}" font-family="Helvetica, Arial, sans-serif">EMPRESA DEMO, S.A.B. DE C.V.</text>`;
  s += `<text x="${W / 2}" y="74" text-anchor="middle" font-size="20" font-weight="600" fill="${TINTA}" font-family="Helvetica, Arial, sans-serif">Estructura de gobierno</text>`;

  // Consejo
  const consejoY = 110;
  const consejoW = 320;
  const consejoX = (W - consejoW) / 2;
  s += caja(consejoX, consejoY, consejoW, 56, "Consejo de Administración", {
    relleno: TEAL,
    borde: TEAL,
    color: "#faf7f0",
    peso: 600,
    tam: 17,
  });

  // Comités: tres cajas colgando del Consejo
  const comY = 226;
  const comW = 300;
  const comH = 66;
  const hueco = (W - comW * 3 - 80) / 2;
  const comX = [hueco, hueco + comW + 40, hueco + (comW + 40) * 2];
  s += linea(W / 2, consejoY + 56, W / 2, comY - 26);
  s += linea(comX[0] + comW / 2, comY - 26, comX[2] + comW / 2, comY - 26);
  for (let i = 0; i < 3; i++) {
    s += linea(comX[i] + comW / 2, comY - 26, comX[i] + comW / 2, comY);
    s += caja(comX[i], comY, comW, comH, COMITES[i], { tam: 14 });
  }

  // Dirección General
  const dgY = 372;
  const dgW = 300;
  const dgX = (W - dgW) / 2;
  // La Dirección General cuelga del CONSEJO, no del Comité de Riesgos. Una línea
  // recta desde el centro atravesaría la caja del comité del medio y diría lo
  // contrario, así que baja por el hueco entre el primer y el segundo comité y
  // vuelve al centro con un codo.
  const hueco1 = comX[0] + comW + 20;
  const codoY = dgY - 34;
  s += linea(hueco1, comY - 26, hueco1, codoY);
  s += linea(hueco1, codoY, W / 2, codoY);
  s += linea(W / 2, codoY, W / 2, dgY);
  s += caja(dgX, dgY, dgW, 56, "Dirección General", {
    relleno: TEAL,
    borde: TEAL,
    color: "#faf7f0",
    peso: 600,
    tam: 17,
  });

  // Seis direcciones
  const dirY = 512;
  const dirW = 178;
  const dirH = 78;
  const sep = 20;
  const total = dirW * 6 + sep * 5;
  const x0 = (W - total) / 2;
  const barra = dirY - 40;
  s += linea(W / 2, dgY + 56, W / 2, barra);
  s += linea(x0 + dirW / 2, barra, x0 + total - dirW / 2, barra);
  for (let i = 0; i < 6; i++) {
    const x = x0 + (dirW + sep) * i;
    s += linea(x + dirW / 2, barra, x + dirW / 2, dirY);
    s += caja(x, dirY, dirW, dirH, DIRECCIONES[i], { tam: 14 });
  }

  s += `<text x="${W / 2}" y="${H - 28}" text-anchor="middle" font-size="12" fill="#6f6a60" font-family="Helvetica, Arial, sans-serif">El Comité de Sostenibilidad y Riesgos Climáticos se reúne trimestralmente e informa al Consejo dos veces al año.</text>`;
  s += `</svg>`;
  return s;
}

// -----------------------------------------------------------------------------
const marca = svg();
mkdirSync("assets/demo", { recursive: true });
writeFileSync("assets/demo/organigrama-demo.svg", marca);
console.log("SVG escrito · assets/demo/organigrama-demo.svg");

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await pagina.setContent(
  `<body style="margin:0">${marca}</body>`,
  { waitUntil: "load" }
);
const png = await pagina.screenshot({ type: "png" });
await navegador.close();
writeFileSync("assets/demo/organigrama-demo.png", png);
console.log(`PNG rasterizado · ${png.length.toLocaleString("es-MX")} bytes · ${W * 2}×${H * 2}`);

// `--solo-imagen` dibuja y se detiene. Sirve para revisar el resultado antes de
// escribir nada, que es lo que uno quiere de un generador de imágenes.
if (process.argv.includes("--solo-imagen")) {
  console.log("solo imagen: no se subió nada.");
  process.exit(0);
}

// Ruta con marca de tiempo, como la acción del Perfil: el organigrama de un
// documento ya generado tiene que seguir existiendo.
const ruta = `${TENANT}/perfil/organigrama-${Date.now()}.png`;
const { error: errSub } = await db.storage
  .from("documentos")
  .upload(ruta, png, { contentType: "image/png", upsert: false });
if (errSub) throw new Error(`storage: ${errSub.message}`);

const { error } = await db
  .from("perfil_emisor")
  .update({ organigrama_path: ruta, actualizado_en: new Date().toISOString() })
  .eq("tenant_id", TENANT);
if (error) throw new Error(`perfil_emisor: ${error.message}`);

console.log(`subido y ligado al Perfil · ${ruta}`);
