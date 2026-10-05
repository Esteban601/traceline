// =============================================================================
// UNIDADES Y CONVERSIÓN — captura sugerida, Paso 2 (encargo §3, «Unidades»).
//
// La sugerencia conserva la unidad del documento. Si la solicitud espera otra,
// se PROPONE la conversión con el factor usado, y también se confirma. El
// factor no lo pone el modelo cuando las dos unidades están en esta tabla: lo
// calcula el código, que no se equivoca de orden de magnitud. Solo para un par
// que la tabla no conoce se acepta el factor que propuso el modelo, marcado
// como tal (`origen: "modelo"`), y la sugerencia no puede quedar en confianza
// alta.
// =============================================================================

type Dimension = "energia" | "masa" | "volumen" | "emisiones" | "tiempo" | "porcentaje" | "personas" | "moneda_mxn";

/** Unidad canónica → [dimensión, factor a la base de su dimensión]. */
const UNIDADES: Record<string, [Dimension, number]> = {
  // energía (base: kWh)
  kwh: ["energia", 1],
  mwh: ["energia", 1e3],
  gwh: ["energia", 1e6],
  gj: ["energia", 1 / 0.0036],
  tj: ["energia", 1e3 / 0.0036],
  // masa (base: t)
  t: ["masa", 1],
  kg: ["masa", 1e-3],
  // volumen (base: m3)
  m3: ["volumen", 1],
  l: ["volumen", 1e-3],
  megalitros: ["volumen", 1e3], // «ml» no se acepta: en minúsculas no se distingue de mililitro
  // emisiones (base: tCO2e)
  tco2e: ["emisiones", 1],
  ktco2e: ["emisiones", 1e3],
  mtco2e: ["emisiones", 1e6],
  kgco2e: ["emisiones", 1e-3],
  // otras sin conversión entre sí
  horas: ["tiempo", 1],
  "%": ["porcentaje", 1],
  personas: ["personas", 1],
  mxn: ["moneda_mxn", 1],
  "miles de mxn": ["moneda_mxn", 1e3],
  "millones de mxn": ["moneda_mxn", 1e6],
};

const SINONIMOS: Record<string, string> = {
  "m³": "m3", "metros cubicos": "m3", "metros cúbicos": "m3", "cubic meters": "m3", "cubic metres": "m3",
  litros: "l", litro: "l", liters: "l", litres: "l", lts: "l",
  megalitro: "megalitros", megaliters: "megalitros",
  toneladas: "t", tonelada: "t", ton: "t", tons: "t", tonnes: "t", tonne: "t",
  kilogramos: "kg", kilos: "kg",
  "tco₂e": "tco2e", "t co2e": "tco2e", "t co2 eq": "tco2e", "tco2eq": "tco2e", "toneladas co2e": "tco2e", "tco2-eq": "tco2e",
  "ktco₂e": "ktco2e", "kgco₂e": "kgco2e",
  hrs: "horas", hr: "horas", h: "horas", hours: "horas", hora: "horas",
  porcentaje: "%", percent: "%", pct: "%",
  pesos: "mxn", "$": "mxn", "mx$": "mxn",
  "miles de pesos": "miles de mxn", "millones de pesos": "millones de mxn",
};

/** Forma canónica de una unidad escrita a mano o copiada de un documento. */
export function normalizarUnidad(u: string | null | undefined): string {
  const s = String(u ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.]$/, "");
  const sinEspacios = s.replace(/\s/g, "");
  return SINONIMOS[s] ?? (UNIDADES[sinEspacios] ? sinEspacios : SINONIMOS[sinEspacios] ?? s);
}

export function mismaUnidad(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizarUnidad(a) === normalizarUnidad(b);
}

export type Conversion = {
  valor: number;
  unidad: string;
  factor: number;
  origen: "tabla" | "modelo";
  explicacion: string;
};

/** Redondeo para no arrastrar 376.29999999 de la aritmética binaria. */
function limpio(n: number): number {
  return Number(n.toPrecision(12));
}

/**
 * Conversión de `valor` en `desde` a `hacia`. `null` si son la misma unidad o si
 * no hay forma confiable de convertir. `propuestaModelo` solo se usa cuando la
 * tabla no conoce el par, y solo si su aritmética cuadra.
 */
export function convertir(
  valor: number,
  desde: string,
  hacia: string,
  propuestaModelo?: { factor: number; explicacion: string } | null
): Conversion | null {
  const a = normalizarUnidad(desde);
  const b = normalizarUnidad(hacia);
  if (!b || a === b) return null;
  const ua = UNIDADES[a];
  const ub = UNIDADES[b];
  if (ua && ub) {
    if (ua[0] !== ub[0]) return null; // dimensiones distintas: no se convierte
    const factor = limpio(ua[1] / ub[1]);
    return {
      valor: limpio(valor * factor),
      unidad: hacia,
      factor,
      origen: "tabla",
      explicacion: `1 ${desde} = ${factor} ${hacia}`,
    };
  }
  if (propuestaModelo && Number.isFinite(propuestaModelo.factor) && propuestaModelo.factor > 0) {
    return {
      valor: limpio(valor * propuestaModelo.factor),
      unidad: hacia,
      factor: propuestaModelo.factor,
      origen: "modelo",
      explicacion: propuestaModelo.explicacion,
    };
  }
  return null;
}
