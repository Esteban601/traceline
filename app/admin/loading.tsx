export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true">
      <div className="space-y-3">
        <div className="h-3 w-48 rounded bg-line/60" />
        <div className="h-9 w-72 rounded bg-line/60" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-card bg-line/50" />
        ))}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-card bg-line/50" />
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
