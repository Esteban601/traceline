import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BLOQUES, codigosDelMapeo } from "@/lib/suplemento/bloques";

// =============================================================================
// VALIDADOR DEL MAPEO — comprueba que lo que el suplemento va a pedir existe.
//
// POR QUÉ EXISTE. `bloques.ts` cita códigos de `datapoints_taxonomia` como
// cadenas literales. El catálogo es una tabla, y las tablas cambian: un código
// corregido, una versión de taxonomía nueva, un renombre. Cuando eso pasa, el
// bloque que lo citaba se queda sin su requisito NIIF y el generador redacta con
// menos contexto del que cree tener — sin error, sin aviso, y con un documento
// que parece correcto.
//
// El catálogo tiene además espaciado irregular ("NIIF S2 6 (a)(i)" con espacio,
// "NIIF S2 6(b)" sin él), así que un código tecleado a mano falla por igualdad de
// cadena aunque a la vista sea idéntico. Esta función es lo que convierte ese
// fallo silencioso en un mensaje.
//
// SE LLAMA EN ARRANQUE, no por petición: es una comprobación de coherencia entre
// código y datos, no una validación de entrada del usuario.
// =============================================================================

export type ResultadoValidacion = {
  ok: boolean;
  /** Códigos citados por el mapeo que NO están en el catálogo. Es el fallo. */
  faltantes: { codigo: string; bloques: number[] }[];
  /** Códigos del catálogo que ningún bloque cita. No es un fallo: se informa. */
  sinBloque: string[];
  /** Cuántos códigos distintos cita el mapeo y cuántos tiene el catálogo. */
  citados: number;
  enCatalogo: number;
};

/**
 * Cruza los códigos del mapeo contra el catálogo vivo.
 *
 * `faltantes` es lo que importa: un código citado que no existe. `sinBloque` se
 * devuelve para tenerlo a la vista —hoy son los datapoints de S1 general, que
 * solo entran cuando el alivio E5 deja de aplicar (§3.1)— pero no invalida nada:
 * el catálogo puede tener más de lo que este documento usa.
 */
export async function validarMapeo(
  supabase: SupabaseClient<Database>
): Promise<ResultadoValidacion> {
  const { data, error } = await supabase
    .from("datapoints_taxonomia")
    .select("codigo")
    .eq("marco", "NIIF");

  if (error || !data) {
    // No poder leer el catálogo no es "el mapeo está mal": es que no se pudo
    // comprobar. Se reporta como fallo para que no pase inadvertido.
    return {
      ok: false,
      faltantes: [{ codigo: "(no se pudo leer datapoints_taxonomia)", bloques: [] }],
      sinBloque: [],
      citados: codigosDelMapeo().length,
      enCatalogo: 0,
    };
  }

  const enCatalogo = new Set(data.map((d) => d.codigo));
  const citados = codigosDelMapeo();

  const faltantes: { codigo: string; bloques: number[] }[] = [];
  for (const codigo of citados) {
    if (enCatalogo.has(codigo)) continue;
    faltantes.push({
      codigo,
      bloques: BLOQUES.filter((b) => b.datapoints.includes(codigo)).map((b) => b.numero),
    });
  }

  const citadosSet = new Set(citados);
  const sinBloque = [...enCatalogo].filter((c) => !citadosSet.has(c)).sort();

  return {
    ok: faltantes.length === 0,
    faltantes,
    sinBloque,
    citados: citados.length,
    enCatalogo: enCatalogo.size,
  };
}

/**
 * Formato de una línea para el log de arranque. Se separa de `validarMapeo` para
 * que el resultado se pueda pintar también en una pantalla de diagnóstico sin
 * duplicar el texto.
 */
export function resumenValidacion(r: ResultadoValidacion): string {
  if (r.ok) {
    return (
      `[suplemento] mapeo OK — ${r.citados} códigos citados por ${BLOQUES.length} bloques, ` +
      `todos en el catálogo (${r.enCatalogo}); ${r.sinBloque.length} del catálogo sin bloque.`
    );
  }
  const detalle = r.faltantes
    .map((f) => `${f.codigo} (bloques ${f.bloques.join(", ") || "—"})`)
    .join(" · ");
  return `[suplemento] MAPEO ROTO — ${r.faltantes.length} código(s) citados que no existen: ${detalle}`;
}
