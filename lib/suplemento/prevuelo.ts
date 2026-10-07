import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { BLOQUES, bloqueSeleccionado } from "@/lib/suplemento/bloques";
import { leerGlosario } from "@/lib/suplemento/glosario";
import { recolectar } from "@/lib/suplemento/hechos/fuentes";
import { huellaDe, libroVigente } from "@/lib/suplemento/hechos/libro";
import { defectosDeMatriz, type Matriz } from "@/lib/suplemento/hechos/validadores";

// =============================================================================
// PRE-VUELO DEL DOCUMENTO (encargo suplemento-calidad, Paso 5.4).
//
// Antes de gastar un centavo en generar, lo que está mal o falta en los insumos
// se dice UNA vez, a nivel documento —no en cuarenta notas repetidas (revisión
// externa del 7 de octubre de 2026)—:
//   · el libro de hechos: si existe y si sigue al día con los insumos;
//   · archivos ilegibles, recortados o en lectura;
//   · contradicciones entre fuentes, bloques sin hechos, solicitudes validadas
//     sin fuente, capturas fuera del suplemento o exentas por alivio;
//   · la matriz de riesgos del Perfil (rangos) y el glosario.
// Nivel: «bloquea» (no conviene generar), «aviso» y «info». No impide generar:
// lo decide quien genera.
// Los DEFECTOS DE INSUMO van además a cada bloque como «ya reportados», para que
// no los repita en sus notas (defectosDeInsumo, que usa también el generador).
// =============================================================================

type Db = SupabaseClient<Database>;

export type AvisoPrevuelo = { nivel: "bloquea" | "aviso" | "info"; texto: string };

type ResumenLibro = {
  insumos?: { adjuntos?: { archivo: string; estado: string; unidades: number; truncado: boolean; mensaje: string | null }[] };
};

/** Defectos de insumo de nivel documento: archivos y matriz. Los usan el pre-vuelo y cada bloque. */
export function defectosDeInsumo(resumen: ResumenLibro | null, matriz: Matriz): string[] {
  const out: string[] = [];
  for (const a of resumen?.insumos?.adjuntos ?? []) {
    if (["error", "no_soportado"].includes(a.estado)) out.push(`El documento «${a.archivo}» no se pudo leer${a.mensaje ? ` (${a.mensaje})` : ""}.`);
    else if (a.estado === "omitido") out.push(`El documento «${a.archivo}» no se leyó${a.mensaje ? `: ${a.mensaje}` : ""}.`);
    else if (["pendiente", "procesando"].includes(a.estado)) out.push(`El documento «${a.archivo}» sigue en lectura: no entró al libro.`);
    else if (a.truncado) out.push(`El documento «${a.archivo}» se leyó recortado${a.mensaje ? `: ${a.mensaje}` : ""}; lo que sigue no entró al libro.`);
  }
  return [...out, ...defectosDeMatriz(matriz)];
}

export async function prevuelo(db: Db, reporteId: string, incluidos: string[] | null): Promise<AvisoPrevuelo[]> {
  const avisos: AvisoPrevuelo[] = [];
  const { data: rep } = await db.from("reportes").select("tenant_id").eq("id", reporteId).maybeSingle();
  if (!rep) return [{ nivel: "bloquea", texto: "El reporte no existe o no es visible." }];
  const { data: perfil } = await db.from("perfil_emisor").select("matriz_riesgos, glosario").eq("tenant_id", rep.tenant_id).maybeSingle();

  const vigente = await libroVigente(db, reporteId);
  let resumen: (ResumenLibro & Record<string, unknown>) | null = null;
  if (!vigente) {
    avisos.push({ nivel: "bloquea", texto: "Sin libro de hechos: arma el libro antes de generar; sin él, los bloques se redactan con el contexto crudo." });
  } else {
    const { data: libro } = await db.from("libros_hechos").select("huella, resumen, created_at").eq("id", vigente.id).single();
    resumen = (libro?.resumen ?? null) as typeof resumen;
    try {
      const rec = await recolectar(db, reporteId, rep.tenant_id);
      if (huellaDe(rec.material) !== libro?.huella) avisos.push({ nivel: "aviso", texto: "Los insumos cambiaron desde que se armó el libro de hechos: rehazlo para que el documento los use." });
    } catch {
      avisos.push({ nivel: "aviso", texto: "No se pudo comprobar si el libro de hechos sigue al día." });
    }
    const r = (resumen ?? {}) as unknown as Record<string, unknown> & {
      grupos_en_conflicto?: number;
      bloques_sin_hechos?: number[];
      insumos?: { solicitudesValidadasSinFuente?: number; fueraDelSuplemento?: string[]; exentasPorAlivio?: unknown[] };
    };
    if (r.grupos_en_conflicto) avisos.push({ nivel: "info", texto: `${r.grupos_en_conflicto} contradicción(es) entre fuentes: irán como marcadores y notas para que la emisora decida.` });
    const sinHechos = (r.bloques_sin_hechos ?? []).filter((n) => {
      const b = BLOQUES.find((x) => x.numero === n);
      return b && bloqueSeleccionado(b, incluidos);
    });
    if (sinHechos.length) avisos.push({ nivel: "aviso", texto: `Bloques del documento sin hechos propios: ${sinHechos.join(", ")} (los de plantilla no los necesitan; los demás saldrán con pendientes).` });
    if (r.insumos?.solicitudesValidadasSinFuente) avisos.push({ nivel: "aviso", texto: `${r.insumos.solicitudesValidadasSinFuente} solicitud(es) validada(s) sin captura ni extracto confirmado: su contenido no entra al libro.` });
    if (r.insumos?.fueraDelSuplemento?.length) avisos.push({ nivel: "info", texto: `${r.insumos.fueraDelSuplemento.length} captura(s) de solicitudes que ningún bloque usa, fuera del suplemento.` });
    if (r.insumos?.exentasPorAlivio?.length) avisos.push({ nivel: "info", texto: `${r.insumos.exentasPorAlivio.length} captura(s) exentas por un alivio vigente, fuera del suplemento.` });
  }
  for (const d of defectosDeInsumo(resumen, (perfil?.matriz_riesgos ?? null) as Matriz)) avisos.push({ nivel: "aviso", texto: d });
  if (!leerGlosario(perfil?.glosario).length) avisos.push({ nivel: "aviso", texto: "El Perfil no tiene glosario de nombres: el validador no podrá unificar los nombres de órganos y direcciones." });
  const orden = { bloquea: 0, aviso: 1, info: 2 } as const;
  return avisos.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}
