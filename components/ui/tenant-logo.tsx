import { cn } from "@/lib/cn";
import { inicialesTenant, limpiarNombreTenant } from "@/lib/tenants";

// =============================================================================
// Marca del cliente. Con logo, lo pinta contenido dentro del círculo (sin
// recortarlo: un logo deformado es peor que ninguno). Sin logo, cae a las
// iniciales sobre el círculo del design system — el comportamiento que ya tenía
// la app antes del branding por cliente.
// =============================================================================

type Tamano = "xs" | "sm" | "md" | "lg";

// El tamaño va SIEMPRE por esta tabla, nunca por `className`: `cn` es un join
// simple (sin tailwind-merge), así que un `size-*` de fuera no gana, solo se
// suma y el resultado lo decide el orden de la hoja de estilos.
const CIRCULO: Record<Tamano, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-xs",
  lg: "size-14 text-sm",
};

export function TenantLogo({
  nombre,
  logoUrl,
  tamano = "md",
  tono = "claro",
  className,
}: {
  nombre: string;
  logoUrl: string | null;
  tamano?: Tamano;
  /** 'claro' = sobre superficies crema; 'invertido' = sobre la barra teal. */
  tono?: "claro" | "invertido";
  className?: string;
}) {
  const limpio = limpiarNombreTenant(nombre);

  if (logoUrl) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-full border",
          tono === "invertido" ? "border-crema/20 bg-crema" : "border-line bg-surface",
          CIRCULO[tamano],
          className
        )}
      >
        {/* <img> y no next/image: el host del logo es el de Supabase Storage, que
            cambia entre local, staging y producción; configurarlo como
            remotePattern por entorno es más frágil que servir el archivo tal
            cual, que además ya viene acotado a 400 px de ancho y 2 MB. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={`Logo de ${limpio}`}
          className="size-full object-contain p-1"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      title={limpio}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        tono === "invertido" ? "bg-crema/15 text-crema" : "bg-teal/10 text-teal",
        CIRCULO[tamano],
        className
      )}
    >
      {inicialesTenant(nombre)}
    </span>
  );
}
