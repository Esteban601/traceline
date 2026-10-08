// =============================================================================
// GLOSARIO DEL EMISOR (encargo suplemento-calidad, Paso 5.4).
//
// Nombres canónicos de órganos, comités y direcciones, con las variantes que
// aparecen en las fuentes. Vive en el Perfil (`perfil_emisor.glosario`), lo
// recibe la capa estable del prompt y, después de generar, un validador
// determinista sustituye cada variante por su canónico y deja la discrepancia en
// las notas: un texto publicable no usa dos nombres para un órgano (revisión
// externa del 7 de octubre de 2026, bloque 18).
//
// Formato de captura, una línea por nombre: «Canónico = variante; variante».
// =============================================================================

export type EntradaGlosario = { canonico: string; variantes: string[] };

export function leerGlosario(raw: unknown): EntradaGlosario[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is EntradaGlosario => !!e && typeof e === "object" && typeof (e as EntradaGlosario).canonico === "string")
    .map((e) => ({
      canonico: e.canonico.trim(),
      variantes: (Array.isArray(e.variantes) ? e.variantes : []).map((v) => String(v).trim()).filter((v) => v && v !== e.canonico.trim()),
    }))
    .filter((e) => e.canonico);
}

export function glosarioDeTexto(texto: string): EntradaGlosario[] {
  return leerGlosario(
    texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [canonico, resto = ""] = l.split("=");
        return { canonico, variantes: resto.split(";") };
      })
  );
}

export function glosarioATexto(g: EntradaGlosario[]): string {
  return g.map((e) => (e.variantes.length ? `${e.canonico} = ${e.variantes.join("; ")}` : e.canonico)).join("\n");
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type CambioGlosario = { variante: string; canonico: string; veces: number };

/**
 * Sustituye las variantes por su canónico. Primero se protegen los canónicos que
 * ya están en el texto —«Dirección de Crédito y Banca» contiene la variante
 * «Crédito y Banca»—; después se reemplazan las variantes, de la más larga a la
 * más corta. No toca lo que va dentro de un marcador [Pendiente: …].
 */
export function aplicarGlosario(texto: string, glosario: EntradaGlosario[]): { texto: string; cambios: CambioGlosario[] } {
  if (!glosario.length) return { texto, cambios: [] };
  const guardados: string[] = [];
  const proteger = (s: string) => `\u0000${guardados.push(s) - 1}\u0000`;
  // Marcadores y canónicos quedan fuera del reemplazo.
  let t = texto.replace(/\[Pendiente:[^\]]*\]/g, proteger);
  const canonicos = [...new Set(glosario.map((e) => e.canonico))].sort((a, b) => b.length - a.length);
  for (const c of canonicos) t = t.replace(new RegExp(`(?<![\\p{L}])${escapar(c)}(?![\\p{L}])`, "gu"), proteger);
  const pares = glosario.flatMap((e) => e.variantes.map((v) => ({ v, c: e.canonico }))).sort((a, b) => b.v.length - a.v.length);
  const cambios: CambioGlosario[] = [];
  for (const { v, c } of pares) {
    let veces = 0;
    // Una variante que es la COLA del canónico («Crédito y Banca» de «Dirección de
    // Crédito y Banca») precedida de «de» ya se lee como el nombre de la dirección
    // («las direcciones de Riesgos, de Crédito y Banca»): reemplazarla daba «de
    // Dirección de Crédito y Banca» (tercera revisión externa, C, bloque 7).
    const cola = c.endsWith(v) && c.length > v.length ? "(?<!(?:^|[^\\p{L}])de\\s)" : "";
    t = t.replace(new RegExp(`${cola}(?<![\\p{L}])${escapar(v)}(?![\\p{L}])`, "gu"), () => {
      veces++;
      return proteger(c);
    });
    if (veces) cambios.push({ variante: v, canonico: c, veces });
  }
  t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => guardados[Number(i)]);
  // Un canónico protegido podía contener otro marcador protegido: segunda vuelta.
  t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => guardados[Number(i)]);
  return { texto: t, cambios };
}
