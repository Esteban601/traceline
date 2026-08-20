import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/cn";
import { Anillo } from "@/components/ui/anillo";
import { COBERTURA_META, COBERTURA_ORDEN } from "@/lib/cobertura";
import { TONO_CLASSES } from "@/lib/estados";
import { fmtFechaHora, fmtFechaLarga } from "@/lib/fechas";
import { limpiarNombreTenant } from "@/lib/tenants";
import { cargarCobertura } from "@/lib/cobertura-datos";
import {
  distribucion,
  pct,
  PILAR_CORTO,
  PILAR_LABEL,
  PILAR_ORDEN,
  type DatapointCobertura,
} from "@/lib/cobertura-vista";
import { ImprimirAlCargar, BotonImprimir } from "./imprimir-al-cargar";

export const metadata: Metadata = { title: "Informe de cobertura" };

// =============================================================================
// INFORME DE COBERTURA para imprimir (o guardar como PDF con el diálogo del
// navegador). Es el mismo tablero, maquetado como documento:
//
//   · sin un solo control interactivo — lo que se imprime es lo que se ve;
//   · encabezado con cliente, reporte y FECHA DE CORTE, porque una cobertura sin
//     fecha no se puede archivar: mañana dice otra cosa;
//   · los mismos números que el tablero (mismo cargador: lib/cobertura-datos).
//
// Los permisos son los del panel: el layout ya deja fuera a quien no entra, y RLS
// acota los datos. El administrador del cliente imprime SU cobertura con esta
// misma vista, sin ruta aparte — el alcance lo pone su sesión, no la URL.
// =============================================================================

/**
 * Reglas de impresión. Van en la vista y no en globals.css a propósito: solo
 * aplican a este documento, y tenerlas al lado del maquetado es lo que evita que
 * alguien "limpie" un salto de página sin saber qué rompía.
 */
const ESTILOS_IMPRESION = `
  @page { size: letter portrait; margin: 14mm 12mm 16mm; }
  @media print {
    html, body { background: #fff !important; }
    /* Los cromos del panel no son parte del documento. */
    aside, nav, .no-imprimir { display: none !important; }
    main { padding: 0 !important; max-width: none !important; }
    /* Nada de bloques cortados a la mitad: un grupo entero o la página siguiente. */
    .bloque { break-inside: avoid; page-break-inside: avoid; }
    .salto-antes { break-before: page; page-break-before: always; }
    .pie-doc { position: fixed; bottom: 0; left: 0; right: 0; }
    /* Fondos suaves: en papel, un tinte al 4% se pierde y deja el borde flotando. */
    .tinte { background: #fff !important; }
  }
`;

function Barra({ items }: { items: DatapointCobertura[] }) {
  const dist = distribucion(items);
  const total = items.length || 1;
  return (
    <span className="flex h-2 w-32 overflow-hidden rounded-full bg-line/60" aria-hidden>
      {COBERTURA_ORDEN.filter((c) => dist[c] > 0).map((c) => (
        <span
          key={c}
          className={TONO_CLASSES[COBERTURA_META[c].tono].dot}
          style={{ width: `${(dist[c] / total) * 100}%` }}
        />
      ))}
    </span>
  );
}

function Conteos({ items }: { items: DatapointCobertura[] }) {
  const dist = distribucion(items);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
      {COBERTURA_ORDEN.filter((c) => dist[c] > 0).map((c) => (
        <span key={c} className="inline-flex items-center gap-1 text-[11px] text-muted">
          <span
            className={cn("size-1.5 rounded-full", TONO_CLASSES[COBERTURA_META[c].tono].dot)}
            aria-hidden
          />
          <span className="tabular-nums text-ink/80">{dist[c]}</span>
          {COBERTURA_META[c].label.toLowerCase()}
        </span>
      ))}
    </span>
  );
}

/** Fila de un datapoint: código, descripción y su estado de cobertura. */
function FilaDatapoint({ d }: { d: DatapointCobertura }) {
  const meta = COBERTURA_META[d.cobertura];
  const c = TONO_CLASSES[meta.tono];
  return (
    <li className="flex items-start gap-3 border-b border-line/60 py-1.5 last:border-0">
      <code className="w-40 shrink-0 font-mono text-[11px] font-semibold text-teal">
        {d.codigo}
      </code>
      <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink">{d.descripcion}</span>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-medium",
          c.text
        )}
      >
        <span className={cn("size-1.5 rounded-full", c.dot)} aria-hidden />
        {meta.label}
      </span>
    </li>
  );
}

function Grupo({
  titulo,
  items,
  saltoAntes = false,
}: {
  titulo: string;
  items: DatapointCobertura[];
  saltoAntes?: boolean;
}) {
  return (
    <section className={cn("bloque mt-5", saltoAntes && "salto-antes")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-1.5">
        <h3 className="font-display text-[15px] font-semibold text-ink">
          {titulo}
          <span className="ml-2 text-xs font-normal text-muted">
            {items.length} {items.length === 1 ? "datapoint" : "datapoints"}
          </span>
        </h3>
        <span className="flex items-center gap-3">
          <Barra items={items} />
          <Conteos items={items} />
        </span>
      </div>
      <ul className="mt-1">
        {items.map((d) => (
          <FilaDatapoint key={d.id} d={d} />
        ))}
      </ul>
    </section>
  );
}

export default async function InformeCoberturaPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; reporte?: string; imprimir?: string }>;
}) {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege
  const soyStaff = esStaff(perfil);

  const { tenant: tenantParam, reporte: reporteParam, imprimir } = await searchParams;
  const supabase = await createClient();
  const datos = await cargarCobertura(supabase, {
    tenant: tenantParam,
    reporte: reporteParam,
  });

  // Mismo criterio que el tablero: el avance es de la norma NIIF; la extensión GRI
  // va aparte y no entra a los conteos.
  const niif = datos.filas.filter((d) => d.marco === "NIIF");
  const gri = datos.filas.filter((d) => d.marco === "GRI");
  const universo = niif.length;
  const dist = distribucion(niif);

  const anillos = [...PILAR_ORDEN].map((p) => {
    const items = niif.filter((d) => d.pilar === p);
    return {
      key: p,
      label: PILAR_CORTO[p],
      cubierto: items.filter((d) => d.cobertura === "cubierto").length,
      total: items.length,
    };
  });
  const totalCubierto = anillos.reduce((s, a) => s + a.cubierto, 0);

  const grupos: { key: string; titulo: string; items: DatapointCobertura[] }[] = [];
  for (const n of ["S1", "S2"] as const) {
    for (const p of [...PILAR_ORDEN]) {
      const items = niif.filter((d) => d.norma === n && d.pilar === p);
      if (items.length > 0) {
        grupos.push({
          key: `${n}:${p}`,
          titulo: `NIIF ${n} · ${PILAR_LABEL[p] ?? p}`,
          items,
        });
      }
    }
  }

  const reporte = datos.reportesVisibles.find((r) => r.id === datos.reporteSel) ?? null;
  // La emisora del ENCABEZADO. El administrador del cliente llega sin `?tenant=`
  // —no tiene selector, no le hace falta—, así que se resuelve desde su alcance:
  // RLS solo le muestra su emisora. Sin esto, el documento que archiva su auditor
  // saldría encabezado con un guion.
  const tenantDelDocumento =
    datos.tenantActivo ?? (!soyStaff && datos.tenants.length === 1 ? datos.tenants[0] : null);
  const cliente = tenantDelDocumento
    ? limpiarNombreTenant(tenantDelDocumento.nombre)
    : soyStaff
      ? "Todas las emisoras"
      : null;
  const corte = new Date();

  return (
    <div className="mx-auto max-w-4xl">
      <style>{ESTILOS_IMPRESION}</style>
      {imprimir === "1" && <ImprimirAlCargar />}

      {/* Barra de la aplicación: no es parte del documento. */}
      <div className="no-imprimir mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={{
            pathname: "/admin/cobertura",
            query: {
              ...(datos.tenantSel ? { tenant: datos.tenantSel } : {}),
              ...(datos.reporteSel ? { reporte: datos.reporteSel } : {}),
            },
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition duration-150 hover:text-teal"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Volver a la cobertura
        </Link>
        <BotonImprimir />
      </div>

      {/* ------------------------------- El documento ------------------------ */}
      <article className="text-ink">
        <header className="bloque border-b-2 border-teal pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            {APP_NAME} · Informe de cobertura
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-semibold text-ink">
            Cobertura de la taxonomía NIIF S1/S2
          </h1>
          <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-[12px] sm:grid-cols-3">
            <div>
              <dt className="text-muted">Emisora</dt>
              <dd className="font-medium text-ink">{cliente ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Reporte</dt>
              <dd className="font-medium text-ink">
                {reporte ? `${limpiarNombreTenant(reporte.nombre)} · ${reporte.ejercicio}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Fecha de corte</dt>
              <dd className="font-medium text-ink">{fmtFechaLarga(corte)}</dd>
            </div>
          </dl>
        </header>

        {/* Anillos por pilar */}
        <section className="bloque mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Avance por pilar
          </h2>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-x-8 gap-y-5 rounded-card border border-line px-5 py-4">
            <div className="flex flex-wrap items-start gap-8">
              {anillos.map((a) => (
                // Sin animación: en papel no existe, y en pantalla el informe se
                // lee como documento, no como tablero.
                <Anillo
                  key={a.key}
                  cubierto={a.cubierto}
                  total={a.total}
                  label={a.label}
                  animado={false}
                  tamano={72}
                />
              ))}
            </div>
            <div className="min-w-[8rem]">
              <div className="font-display text-3xl font-semibold tabular-nums text-teal">
                {totalCubierto}
                <span className="text-lg text-muted"> / {universo}</span>
              </div>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                Datapoints cubiertos
              </p>
            </div>
          </div>
        </section>

        {/* Totales */}
        <section className="bloque mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Totales
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-card border border-line px-4 py-3">
              <div className="font-display text-2xl font-semibold tabular-nums text-teal">
                {universo}
              </div>
              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                Datapoints NIIF
              </div>
            </div>
            {COBERTURA_ORDEN.map((c) => {
              const meta = COBERTURA_META[c];
              const cc = TONO_CLASSES[meta.tono];
              return (
                <div key={c} className="rounded-card border border-line px-4 py-3">
                  <div
                    className={cn(
                      "font-display text-2xl font-semibold tabular-nums",
                      cc.text
                    )}
                  >
                    {pct(dist[c], universo)}
                    <span className="text-base">%</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                    <span className={cn("size-1.5 rounded-full", cc.dot)} aria-hidden />
                    {meta.label}
                    <span className="text-muted/70">· {dist[c]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Desglose por grupo */}
        <section className="mt-8">
          <h2 className="bloque text-[11px] font-semibold uppercase tracking-wide text-muted">
            Desglose por norma y pilar
          </h2>
          {grupos.map((g) => (
            <Grupo key={g.key} titulo={g.titulo} items={g.items} />
          ))}
        </section>

        {/* Extensión GRI — separada, como en el tablero y por la misma razón */}
        {gri.length > 0 && (
          <section className="mt-8">
            <h2 className="bloque text-[11px] font-semibold uppercase tracking-wide text-muted">
              Extensión GRI
            </h2>
            <p className="bloque mt-1 max-w-2xl text-[11px] leading-relaxed text-muted">
              Fuera de la taxonomía NIIF S1/S2: conceptos normados por GRI que la
              firma recaba además. No cuentan en el avance de arriba ni entran a la
              plantilla oficial.
            </p>
            <Grupo titulo="Métricas con código GRI" items={gri} />
          </section>
        )}

        <footer className="pie-doc mt-10 border-t border-line pt-2 text-[10px] text-muted">
          Generado por {APP_NAME} — {fmtFechaHora(corte)}
          {cliente ? ` · ${cliente}` : ""}. Documento de trabajo: la cobertura
          refleja la evidencia registrada a la fecha de corte.
        </footer>
      </article>
    </div>
  );
}
