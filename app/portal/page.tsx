import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { KpiCard } from "@/components/ui/kpi-card";
import { KPIS, contarPorBucket } from "@/lib/estados";
import { ListaSolicitudes, type SolicitudResumen } from "./lista-solicitudes";

export const metadata: Metadata = { title: "Tablero" };

export default async function TableroPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya redirige

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitudes")
    .select(
      "id, titulo, area_asignada, estado, fecha_limite, es_cuantitativa, unidad_esperada, orden, responsable_cliente_id"
    );

  if (error) {
    throw new Error("No se pudieron cargar las solicitudes.");
  }

  const solicitudes = (data ?? []) as SolicitudResumen[];
  const conteos = contarPorBucket(solicitudes.map((s) => s.estado));
  // Nombre completo del perfil (sin el prefijo [DEMO]); el CSS se encarga de que
  // un nombre largo envuelva por palabras y, si no cabe, se acorte con elipsis
  // en dos líneas — nunca cortando una palabra a la mitad.
  const nombre = perfil.nombre.replace(/\[DEMO\]\s*/i, "").trim();
  const esCoordinador = perfil.rol === "coordinador" || perfil.tenant_id === null;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
          Portal de evidencia · Informe Anual Sustentable
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          Hola,{" "}
          <span className="line-clamp-2 inline-block max-w-full break-words align-top [overflow-wrap:break-word]">
            {nombre}
          </span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Este es el avance de las solicitudes de información
          {perfil.area ? ` de ${perfil.area}` : ""}. Abre cualquiera para cargar
          evidencia o revisar observaciones.
        </p>
      </header>

      <section aria-label="Resumen por estado">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KPIS.map((k) => (
            <KpiCard
              key={k.bucket}
              label={k.label}
              value={conteos[k.bucket]}
              tono={k.tono}
            />
          ))}
        </div>
      </section>

      <ListaSolicitudes
        solicitudes={solicitudes}
        canToggle={esCoordinador}
        area={perfil.area}
        userId={perfil.id}
      />
    </div>
  );
}
