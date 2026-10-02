import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff, esAuditor } from "@/lib/data";
import { registrarActividadAuditor } from "@/lib/auditoria";
import { cargarCobertura } from "@/lib/cobertura-datos";
import { TenantSelector, type TenantOpcionSelector } from "@/components/tenant-selector";
import { ParamSelect } from "@/components/ui/param-select";
import { limpiarNombreTenant } from "@/lib/tenants";
import { CoberturaView } from "./cobertura-view";
import { InformeButton } from "./informe-button";
import { existeArchivoVitrina } from "@/lib/vitrina";
import { SuplementoButton } from "./suplemento-button";

export const metadata: Metadata = { title: "Cobertura de taxonomía" };

export default async function CoberturaPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; reporte?: string }>;
}) {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya protege

  // El administrador del cliente ve SU cobertura: RLS acota datapoints ligados,
  // solicitudes y reportes a su tenant, y el selector de cliente no aparece
  // porque solo hay uno visible.
  const soyStaff = esStaff(perfil);
  const soyAuditor = esAuditor(perfil);
  await registrarActividadAuditor(perfil, { tipo: "vista_cobertura" });

  const { tenant: tenantParam, reporte: reporteParam } = await searchParams;
  const supabase = await createClient();
  const datos = await cargarCobertura(supabase, {
    tenant: tenantParam,
    reporte: reporteParam,
  });

  const tenantsOpc: TenantOpcionSelector[] = datos.tenants.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    logoUrl: t.logo_url,
    prefijoFolio: t.prefijo_folio,
    esDemo: t.es_demo,
  }));

  const nombreTenant = new Map(
    datos.tenants.map((t) => [t.id, limpiarNombreTenant(t.nombre)])
  );
  // El nombre del cliente en la etiqueta del reporte solo sirve para desempatar
  // entre emisoras. Con una sola visible —el caso del administrador del cliente—
  // repetirlo en cada opción es ruido.
  const variosClientes =
    new Set(datos.reportesVisibles.map((r) => r.tenant_id)).size > 1;

  // El reporte elegido, entero: el botón del Suplemento necesita su ejercicio y
  // `datos.reporteSel` es solo el id.
  const reporteSel =
    datos.reportesVisibles.find((r) => r.id === datos.reporteSel) ?? null;

  // El informe con diseño todavía no existe como archivo. La opción se ofrece o
  // se deshabilita según ESTÉ EL ARCHIVO —en el bucket `vitrina` o, si no, en
  // assets/vitrina/—, comprobado en cada petición. El día que diseño suba el
  // PDF por el dashboard, la opción se enciende sola: sin commit, sin build y
  // sin reinicio.
  const pdfDisponible = await existeArchivoVitrina("suplemento-demo.pdf");

  // La emisora sale DEL REPORTE, no del selector de cliente. El staff puede
  // tener elegido un reporte sin haber elegido emisora —ahí `tenantActivo` es
  // nulo y el botón no aparecía—, y de todos modos es el reporte el que manda:
  // es lo mismo que resuelve la ruta de descarga antes de servir el archivo.
  const tenantDelReporte = reporteSel
    ? (datos.tenants.find((t) => t.id === reporteSel.tenant_id) ?? null)
    : null;

  return (
    <CoberturaView
      datapoints={datos.filas}
      tenantId={datos.tenantSel}
      tenantNombre={
        datos.tenantActivo ? limpiarNombreTenant(datos.tenantActivo.nombre) : null
      }
      reporteId={datos.reporteSel}
      soyStaff={soyStaff}
      selector={
        <>
          <TenantSelector
            tenants={tenantsOpc}
            seleccionado={datos.tenantSel}
            limpiar={["reporte"]}
          />
          <ParamSelect
            param="reporte"
            etiqueta="Reporte"
            valor={datos.reporteSel}
            placeholder="Elige un reporte"
            opciones={datos.reportesVisibles.map((r) => ({
              value: r.id,
              // Siempre con el nombre del reporte: este selector decide de QUÉ
              // cliente sale el Excel, así que dos opciones indistinguibles
              // producirían un entregable equivocado sin aviso.
              label: variosClientes
                ? `${nombreTenant.get(r.tenant_id) ?? "—"} · ${r.nombre} · ${r.ejercicio}`
                : `${r.nombre} · ${r.ejercicio}`,
            }))}
          />
        </>
      }
      // LAS `key` DE LOS SLOTS no son decorativas. Estos elementos los crea este
      // componente de SERVIDOR y los renderiza CoberturaView, que es de cliente:
      // cruzan la frontera en la carga RSC y llegan al array de hijos del cliente
      // sin la marca de "hijos estáticos" que el compilador de JSX pone cuando el
      // array se escribe a mano. React los trata entonces como una lista dinámica
      // y pide key.
      //
      // Medido, no supuesto: un <span>x</span> creado AQUÍ y pasado por el slot
      // dispara el aviso; el mismo <span> escrito dentro de CoberturaView, en la
      // misma posición, no. Y el aviso existe igual en `main` —no lo trajo esta
      // rama—: en staging no se ve porque el botón del Suplemento solo se pinta
      // para emisoras `es_demo`, y ahí casi nunca es la que se está mirando.
      informe={
        <InformeButton
          key="informe"
          tenantId={datos.tenantSel}
          reporteId={datos.reporteSel}
        />
      }
      // Solo para emisoras de demostración, y solo con un reporte elegido: el
      // Suplemento es de un ejercicio concreto y sin reporte no hay año que
      // poner en el título del diálogo.
      //
      // El AUDITOR EXTERNO no lo ve nunca, ni en una emisora de demostración: el
      // suplemento y la vitrina quedan fuera de su alcance por encargo. Que el
      // botón no se inyecte es además lo único que hay que hacer, porque el slot
      // se resuelve aquí, en el servidor.
      suplemento={
        // Y solo si la vitrina de esa emisora está encendida: un mockup puede
        // apagarla (`tenants.vitrina_habilitada`), y la ruta la niega igual.
        !soyAuditor &&
        tenantDelReporte?.es_demo &&
        tenantDelReporte.vitrina_habilitada &&
        reporteSel ? (
          <SuplementoButton
            key="suplemento"
            reporteId={reporteSel.id}
            ejercicio={reporteSel.ejercicio}
            pdfDisponible={pdfDisponible}
          />
        ) : null
      }
    />
  );
}
