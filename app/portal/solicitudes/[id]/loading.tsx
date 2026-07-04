export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando solicitud">
      <div className="h-4 w-32 animate-pulse rounded bg-line/60" />
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="h-6 w-28 animate-pulse rounded-pill bg-line/60" />
          <div className="h-6 w-20 animate-pulse rounded-pill bg-line/60" />
        </div>
        <div className="h-10 w-3/4 animate-pulse rounded bg-line/60" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-line/60" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-card border border-line bg-surface" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-card border border-line bg-surface" />
      </div>
    </div>
  );
}
