// =============================================================================
// CIFRAS PUBLICABLES (encargo formato-afirmaciones-y-voz, Fase 3 y decisión (1)
// de Esteban del 26/10). Sin `server-only`: lo usan el libro de hechos, las
// respuestas, las tablas del suplemento y el Excel.
//
//   · conceptoDeCifra: el nombre de una cifra para el informe, no el título de
//     la solicitud («Inventario GEI Alcance 1 con memoria de cálculo» es un
//     nombre de captura; en el informe es «Emisiones de Alcance 1»).
//   · conPerimetro: el perímetro declarado de la cifra (`solicitudes.nota_alcance`)
//     va dentro de su respuesta: «<cifra>; perímetro: <perímetro>». Regla general
//     para toda cifra con perímetro declarado.
// =============================================================================

const limpiar = (s: string): string => s.replace(/\[DEMO\]\s*/i, "").trim();

export function conceptoDeCifra(titulo: string): string {
  const t = limpiar(titulo).replace(/\s*,?\s*(?:con|y)\s+(?:su\s+)?memorias?\s+de\s+c[aá]lculo/gi, "").trim();
  const alcance = t.match(/alcance\s*([123])/i)?.[1];
  if (!alcance) return t;
  const base = `Emisiones de Alcance ${alcance}`;
  if (alcance === "2" && /ubicaci[oó]n/i.test(t) && !/mercado/i.test(t)) return `${base} (ubicación)`;
  if (alcance === "2" && /mercado/i.test(t) && !/ubicaci[oó]n/i.test(t)) return `${base} (mercado)`;
  return base;
}

export function conPerimetro(cifra: string, perimetro: string | null | undefined): string {
  const p = (perimetro ?? "").trim().replace(/\.$/, "");
  return p ? `${cifra}; perímetro: ${p}` : cifra;
}
