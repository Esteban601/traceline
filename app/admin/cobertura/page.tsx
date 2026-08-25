import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual, esStaff } from "@/lib/data";
import { cargarCobertura } from "@/lib/cobertura-datos";
import { TenantSelector, type TenantOpcionSelector } from "@/components/tenant-selector";
import { ParamSelect } from "@/components/ui/param-select";
import { limpiarNombreTenant } from "@/lib/tenants";
import { CoberturaView } from "./cobertura-view";
import { InformeButton } from "./informe-button";

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
      informe={
        <InformeButton tenantId={datos.tenantSel} reporteId={datos.reporteSel} />
      }
    />
  );
}
