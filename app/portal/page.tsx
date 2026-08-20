import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/data";
import { KpiCard } from "@/components/ui/kpi-card";
import { KPIS, contarPorBucket } from "@/lib/estados";
import { ListaSolicitudes, type SolicitudResumen } from "./lista-solicitudes";
import { ProgresoReporte } from "./progreso-reporte";
import { accionCliente } from "./estado-cliente";
import { cuentaEnAvance } from "@/lib/difusion";

export const metadata: Metadata = { title: "Tablero" };

export default async function TableroPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null; // el layout ya redirige

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitudes")
    .select(
      "id, titulo, area_asignada, estado, fecha_limite, es_cuantitativa, unidad_esperada, orden, responsable_cliente_id, grupo_difusion_id, declinada, desactivada"
    );

  if (error) {
    throw new Error("No se pudieron cargar las solicitudes.");
  }

  const solicitudes = (data ?? []) as SolicitudResumen[];
  // Las copias de difusión que el área declaró ajenas —o que quien difundió
  // retiró— NO cuentan: ni en los indicadores, ni en la barra de avance, ni en el
  // denominador. Dejarlas dentro haría que un área terminara su trabajo con la
  // barra a medias por preguntas que no eran suyas.
  const enJuego = solicitudes.filter(cuentaEnAvance);
  const conteos = contarPorBucket(enJuego.map((s) => s.estado));
  const completadas = enJuego.filter((s) => accionCliente(s.estado).completada).length;
  // Nombre completo del perfil (sin el prefijo [DEMO]); el CSS se encarga de que
  // un nombre largo envuelva por palabras y, si no cabe, se acorte con elipsis
  // en dos líneas — nunca cortando una palabra a la mitad.
  const nombre = perfil.nombre.replace(/\[DEMO\]\s*/i, "").trim();
  // Quién ve TODO su tenant (y por tanto necesita el toggle "Mis/Todas"): el
  // coordinador, el staff y el administrador del cliente. Sin incluirlo, la
  // pestaña "Mis" mentiría: RLS ya le devuelve las de todas sus áreas.
  const esCoordinador =
    perfil.rol === "coordinador" ||
    perfil.rol === "admin_cliente" ||
    perfil.tenant_id === null;

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

      {/* El denominador también excluye lo declinado: si no cuenta arriba, no puede
          contar abajo. */}
      <ProgresoReporte completadas={completadas} total={enJuego.length} />

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
