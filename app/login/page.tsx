import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { APP_NAME } from "@/lib/app";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

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
            Evidencia ESG · NIIF S1/S2
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight">
            Trazabilidad de la evidencia de sostenibilidad, de principio a fin.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-crema/80">
            Consulta tus solicitudes de información, carga evidencia versionada y
            da seguimiento a su validación para el Informe Anual Sustentable.
          </p>
        </div>

        <p className="relative text-xs text-crema/60">
          Elaborado con IRStrat · Vert
        </p>
      </section>

      {/* Panel de formulario */}
      <section className="flex min-h-dvh items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="font-display text-xl font-semibold tracking-tight text-teal">
              {APP_NAME}
            </span>
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            Bienvenido
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Ingresa para acceder a tu portal de evidencia.
          </p>
          <div className="mt-8">
            <LoginForm next={next ?? "/portal"} />
          </div>
        </div>
      </section>
    </main>
  );
}
