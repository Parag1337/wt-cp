export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-xl bg-forest-800/10 ${className}`} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-forest-800/10 bg-white">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="flex flex-1 flex-col p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2.5 h-5 w-3/4" />
        <Skeleton className="mt-2.5 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-2/3" />
        <div className="mt-4 flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="mt-4 h-10 w-full rounded-full" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Skeleton className="aspect-[4/3] rounded-2xl" />
      <div>
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="mt-4 h-9 w-3/4" />
        <Skeleton className="mt-4 h-4 w-24" />
        <div className="mt-6 border-t border-forest-800/10 pt-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
        <Skeleton className="mt-6 h-28 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 rounded-2xl border border-forest-800/10 bg-white p-4 shadow-sm"
        >
          <Skeleton className="size-20 shrink-0 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-3 h-3 w-1/3" />
            <Skeleton className="mt-4 h-8 w-36 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageLoadingSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl px-4 py-16 md:px-6"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-9 w-2/3" />
      <Skeleton className="mt-4 h-4 w-1/2" />
      <div className="mt-10 space-y-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-forest-800/10 bg-white p-5 shadow-sm"
          >
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="mt-3 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
