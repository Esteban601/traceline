/**
 * Franja de emisora de demostración. Se renderiza cuando la sesión pertenece a
 * un tenant con `es_demo = true` —lo decide quien la monta, no una variable de
 * ambiente—, porque en el mismo despliegue conviven la demo y clientes con datos
 * reales: una franja global le diría "datos ilustrativos" a Grupo Carso encima
 * de su información real.
 *
 * Crema sobre teal (tokens de DESIGN.md), no invasiva.
 */
export function BannerDemo() {
  return (
    <div
      role="note"
      className="flex items-center justify-center gap-2 border-b border-teal-dark/40 bg-teal px-4 py-1.5 text-center text-xs font-medium text-crema"
    >
      <span
        aria-hidden
        className="inline-block size-1.5 shrink-0 rounded-full bg-crema/70"
      />
      <span>
        <span className="font-semibold uppercase tracking-wide text-crema">
          Entorno de demostración
        </span>{" "}
        <span className="text-crema/80">— datos ilustrativos</span>
      </span>
    </div>
  );
}
