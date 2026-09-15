import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAdminCliente } from "@/lib/data";
import { EmptyState } from "@/components/ui/empty-state";
import { limpiarNombreTenant } from "@/lib/tenants";
import { evaluarCompletitud } from "@/lib/suplemento/completitud";
import { REGIMEN_LABEL, ALIVIOS } from "@/lib/perfil-emisor";
import { SuplementoView } from "./suplemento-view";
import { GenerarPrueba } from "./generar-prueba";

export const metadata: Metadata = { title: "Suplemento S1 y S2" };

// =============================================================================
// Semáforo de completitud del Suplemento S1/S2 (A3b).
//
// Pantalla PREVIA a la generación: dice qué puede escribirse hoy de cada uno de
// los 40 bloques y qué saldría con [Pendiente]. Toda la evaluación vive en
// `lib/suplemento/completitud.ts`, que es lo que en A5 usará el generador; aquí
// solo se pinta. Si el criterio de "completo" cambia, cambia allá y esta
// pantalla y el documento siguen diciendo lo mismo.
//
// Quién entra: staff y administrador del cliente. El layout de /admin ya rebota
// a los usuarios de área y a los jefes de área antes de llegar aquí.
// =============================================================================

export default async function SuplementoPage({
  searchParams,
}: {
  searchParams: Promise<{ reporte?: string }>;
}) {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login");
  if (!esStaff(perfil) && !esAdminCliente(perfil)) redirect("/admin");

  const { reporte: reporteId } = await searchParams;

  if (!reporteId) {
    return (
      <Marco>
        <EmptyState
          titulo="Elige un reporte"
          descripcion="El semáforo es siempre de un reporte concreto: el régimen, el ejercicio y las solicitudes salen de él."
        >
          <Link href="/admin/cobertura" className="text-sm font-medium text-teal hover:underline">
            Ir a Cobertura
          </Link>
        </EmptyState>
      </Marco>
    );
  }

  const db = await createClient();
  const res = await evaluarCompletitud(db, reporteId);

  if (!res.ok) {
    return (
      <Marco>
        <EmptyState
          titulo="No se pudo evaluar el reporte"
          descripcion={DESCRIPCION_FALLO[res.causa]}
        >
          <Link href="/admin/cobertura" className="text-sm font-medium text-teal hover:underline">
            Volver a Cobertura
          </Link>
        </EmptyState>
      </Marco>
    );
  }

  const aliviosActivos = ALIVIOS.filter((a) => res.alivios[a.clave]).map((a) => a.titulo);

  // El botón de prueba gasta dinero real en cada clic. Dos condiciones, y la
  // segunda es explícita a propósito: que NEXT_PUBLIC_STAGING no valga "true"
  // dice "no me indexes", no "aquí se puede gastar en llamadas al modelo".
  const conBotonDePrueba = esStaff(perfil) && process.env.SUPLEMENTO_PRUEBA === "1";

  return (
    <Marco>
      {conBotonDePrueba && (
        <div className="mb-6">
          <GenerarPrueba reporteId={reporteId} />
        </div>
      )}
      <SuplementoView
        nombreReporte={res.reporte.nombre}
        ejercicio={res.reporte.ejercicio}
        emisora={
          res.reporte.tenant ? limpiarNombreTenant(res.reporte.tenant.nombre) : "—"
        }
        regimenLabel={REGIMEN_LABEL[res.regimen]}
        sinRegimen={res.regimen === "indeterminado"}
        anioAdopcion={res.anioAdopcion}
        aliviosActivos={aliviosActivos}
        bloques={res.bloques}
        resumen={res.resumen}
        reporteId={reporteId}
        puedeGenerar={esStaff(perfil)}
      />
    </Marco>
  );
}

const DESCRIPCION_FALLO: Record<string, string> = {
  reporte_no_existe: "Ese reporte no existe o no es visible para tu cuenta.",
  reporte_ilegible: "No se pudo leer el reporte.",
  mapeo_ilegible: "No se pudo leer el mapeo de la taxonomía.",
  mapeo_vacio: "El mapeo de la taxonomía está vacío: no hay contra qué evaluar.",
  reporte_sin_tenant: "El reporte no tiene emisora asociada.",
};

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          Taxonomía S1 / S2 · Suplemento
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          Qué puede escribirse hoy
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Los 40 bloques del Suplemento NIIF S1/S2 con la evidencia que hoy los sostiene.
          Verde: el bloque sale completo. Ámbar: sale con pendientes, y aquí dice cuáles.
          Gris: no aplica en este régimen.
        </p>
      </header>
      {children}
    </div>
  );
}
