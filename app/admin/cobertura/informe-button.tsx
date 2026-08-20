import Link from "next/link";

/**
 * "Exportar PDF" — abre el informe de cobertura maquetado para impresión, que se
 * manda a imprimir solo al cargar (`?imprimir=1`).
 *
 * Es un enlace y no un botón con `window.open`: un clic del usuario sobre un
 * `<a target="_blank">` no lo bloquea el navegador, y si alguien prefiere revisar
 * antes de imprimir, la vista queda abierta y usable. El PDF lo produce el propio
 * navegador ("Guardar como PDF"), que es lo que evita cargar un motor de PDF en el
 * servidor para un documento que ya sabemos maquetar en HTML.
 */
export function InformeButton({
  tenantId,
  reporteId,
}: {
  tenantId: string | null;
  reporteId: string | null;
}) {
  const params = new URLSearchParams({ imprimir: "1" });
  if (tenantId) params.set("tenant", tenantId);
  if (reporteId) params.set("reporte", reporteId);

  return (
    <Link
      href={`/admin/cobertura/informe?${params.toString()}`}
      target="_blank"
      rel="noopener"
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition duration-150 hover:border-teal/40 hover:text-teal"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9V4h12v5" />
        <path d="M6 18H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2" />
        <rect x="6" y="14" width="12" height="7" rx="1" />
      </svg>
      Exportar PDF
    </Link>
  );
}
