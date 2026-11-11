#!/usr/bin/env node
// =============================================================================
// Deudas conocidas del demo, generadas desde el informe de e2e-celdas-categoricas (decisión de Esteban, v6.2: «una
// deuda solo se marca corregida si su caso pasa»; antes la lista se escribía a mano).
//
//   INFORME_E2E=<informe.json> node … scripts/e2e-celdas-categoricas.mjs <formato.xlsx> <taxonomia.xlsx> [libro-gri.xlsx]
//   node scripts/formato/deudas-desde-e2e.mjs <informe.json> <plantilla.md> <salida.md>
//
// La plantilla (docs/suplemento-s1s2/deudas-conocidas-demo.md) marca cada deuda con `{{e2e:<prefijo>}}`, el
// comienzo del mensaje de su caso. El generador lo sustituye por:
//   · «✓ corregida» si TODOS los casos con ese prefijo pasan;
//   · «✗ abierta» si alguno falla (con el caso que falla);
//   · «✗ abierta · sin caso en el informe» si ningún caso tiene ese prefijo (una deuda sin caso nunca sale corregida).
// Las deudas sin token son abiertas por definición (no tienen caso). Al final agrega el resumen del informe.
// =============================================================================
import fs from "node:fs";

const [informe, plantilla, salida] = process.argv.slice(2);
if (!informe || !plantilla || !salida) { console.error("Uso: deudas-desde-e2e.mjs <informe.json> <plantilla.md> <salida.md>"); process.exit(2); }
const inf = JSON.parse(fs.readFileSync(informe, "utf8"));
const casos = inf.casos ?? [];

let corregidas = 0, abiertas = 0;
// Los comentarios HTML de la plantilla (instrucciones) no van en la salida ni cuentan como deudas.
const texto = fs.readFileSync(plantilla, "utf8").replace(/<!--[\s\S]*?-->\n?/g, "").replace(/\{\{e2e:([^}]+)\}\}/g, (_m, prefijo) => {
  const p = prefijo.trim();
  const suyos = casos.filter((c) => c.caso.startsWith(p));
  if (!suyos.length) { abiertas++; return `✗ abierta · sin caso «${p}» en el informe`; }
  const malos = suyos.filter((c) => !c.ok);
  if (malos.length) { abiertas++; return `✗ abierta · falla «${malos[0].caso.slice(0, 120)}»`; }
  corregidas++;
  return `✓ corregida (${suyos.length === 1 ? "su caso pasa" : `sus ${suyos.length} casos pasan`})`;
});

const fallan = casos.filter((c) => !c.ok);
const resumen = [
  "",
  "## Informe de `e2e-celdas-categoricas` del que sale esta lista",
  "",
  `- Generado el ${inf.fecha?.slice(0, 10) ?? "—"} sobre \`${(inf.formato ?? "").split("/").pop()}\`, \`${(inf.taxonomia ?? "").split("/").pop()}\`${inf.libroGri ? ` y \`${inf.libroGri.split("/").pop()}\`` : ""}.`,
  `- Casos: ${casos.length}; en verde: ${casos.length - fallan.length}; en rojo: ${fallan.length}.`,
  `- Deudas con caso: ${corregidas} corregidas y ${abiertas} abiertas.`,
  ...(fallan.length ? ["", "Casos en rojo:", ...fallan.map((c) => `- ${c.caso}`)] : []),
  "",
].join("\n");
fs.writeFileSync(salida, texto.trimEnd() + "\n" + resumen);
console.log(`deudas: ${corregidas} corregidas y ${abiertas} abiertas con caso · ${casos.length} casos (${fallan.length} en rojo) → ${salida}`);
