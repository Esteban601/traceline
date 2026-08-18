import type { Metadata } from "next";
import Link from "next/link";
import { getPerfilActual, esStaff } from "@/lib/data";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { SolicitudForm } from "../solicitud-form";
import { cargarOpcionesFormulario } from "../opciones";
import { crearSolicitud } from "../gestion-actions";

export const metadata: Metadata = { title: "Nueva solicitud" };

export default async function NuevaSolicitudPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  const soyStaff = esStaff(perfil);
  const opciones = await cargarOpcionesFormulario(perfil);
  // Un reporte CONGELADO quedó cerrado para aseguramiento: no admite solicitudes
  // nuevas y por eso no se ofrece. Ofrecerlo y rechazarlo después sería pedirle a
  // quien lo elige que adivine por qué falló.
  const reportesAbiertos = opciones.reportes.filter((r) => r.estado !== "congelado");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3">
        <Breadcrumb
          items={[
            { label: "Panel", href: "/admin" },
            { label: "Matriz", href: "/admin" },
            { label: "Nueva solicitud" },
          ]}
        />
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
            Gestión · Solicitudes
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
            {soyStaff ? "Nueva solicitud" : "Nueva solicitud interna"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {soyStaff ? (
              <>
                Redacta la solicitud en lenguaje cliente, asígnala y liga los
                datapoints de la taxonomía que alimenta. Nace en estado{" "}
                <span className="font-medium">Pendiente</span>.
              </>
            ) : (
              <>
                Pídele información a un área de tu organización. Nace como{" "}
                <span className="font-medium">Solicitud interna</span> en estado{" "}
                <span className="font-medium">Pendiente</span>, y su revisión y
                validación son tuyas.
              </>
            )}
          </p>
        </div>
      </div>

      {reportesAbiertos.length === 0 ? (
        <EmptyState
          glifo="—"
          titulo="No hay reportes"
          descripcion={
            soyStaff
              ? "Crea un reporte abierto (o genera uno desde una plantilla) antes de agregar solicitudes. Los reportes congelados no admiten solicitudes nuevas."
              : "Tu organización no tiene un reporte abierto. IRStrat lo crea; escríbeles para abrirlo."
          }
        >
          {soyStaff && (
            <Link
              href="/admin/plantillas"
              className="text-sm font-medium text-teal transition duration-150 hover:text-teal-dark"
            >
              Ir a plantillas →
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="rounded-card border border-line bg-surface p-6 shadow-soft sm:p-8">
          <SolicitudForm
            modo="crear"
            action={crearSolicitud}
            reportes={reportesAbiertos}
            usuariosCliente={opciones.usuariosCliente}
            staff={opciones.staff}
            areas={opciones.areas}
            datapoints={opciones.datapoints}
            rubros={opciones.rubros}
            soloCliente={!soyStaff}
          />
        </div>
      )}
    </div>
  );
}
