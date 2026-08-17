import { APP_NAME } from "@/lib/app";

// =============================================================================
// Marco de las pantallas sin sesión (ingreso, invitación, recuperación y
// restablecimiento): panel de marca editorial a la izquierda y el formulario a
// la derecha. Se extrajo del login para que las pantallas nuevas de acceso no
// inventen su propio aspecto.
// =============================================================================

export function AuthShell({
  encabezado,
  titulo,
  descripcion,
  children,
  marca,
}: {
  /** Cintillo dorado sobre el titular del panel de marca. */
  encabezado?: string;
  /** Titular del formulario (columna derecha). */
  titulo: string;
  descripcion?: React.ReactNode;
  children: React.ReactNode;
  /** Titular y bajada del panel de marca (columna izquierda). */
  marca: { titulo: string; texto: string };
}) {
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Panel de marca (editorial) */}
      <section className="relative hidden overflow-hidden bg-teal px-12 py-16 text-crema lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-gold/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-crema/5 blur-3xl"
        />
        <div className="relative flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-gold/90 font-display text-lg font-bold text-teal-dark">
            {APP_NAME.charAt(0)}
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            {APP_NAME}
          </span>
        </div>

        <div className="relative max-w-md">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold">
            {encabezado ?? "IRStrat · Vert"}
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight">
            {marca.titulo}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-crema/80">{marca.texto}</p>
        </div>

        <p className="relative text-xs text-crema/60">Elaborado con IRStrat · Vert</p>
      </section>

      {/* Panel de formulario */}
      <section className="flex min-h-dvh items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="font-display text-xl font-semibold tracking-tight text-teal">
              {APP_NAME}
            </span>
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink">{titulo}</h2>
          {descripcion && (
            <div className="mt-1.5 text-sm leading-relaxed text-muted">{descripcion}</div>
          )}
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
