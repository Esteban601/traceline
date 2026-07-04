export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando">
      <div className="space-y-3">
        <div className="h-3 w-56 animate-pulse rounded bg-line/60" />
        <div className="h-9 w-64 animate-pulse rounded bg-line/60" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-card border border-line bg-surface"
          />
        ))}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-card border border-line bg-surface"
          />
        ))}
      </div>
    </div>
  );
}
