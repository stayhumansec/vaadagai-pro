export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-3/70 ${className}`} />;
}

export function MetricCardSkeleton() {
  return (
    <div className="min-w-[120px] rounded-xl border border-gray-3 bg-white p-4">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-2 h-6 w-20" />
    </div>
  );
}

export function HouseCardSkeleton() {
  return (
    <div className="min-w-[110px] rounded-xl border border-gray-3 bg-white p-3">
      <Skeleton className="h-3 w-10" />
      <Skeleton className="mt-2 h-4 w-16" />
      <Skeleton className="mt-2 h-4 w-14" />
      <Skeleton className="mt-2 h-4 w-12 rounded-full" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-gray-3 last:border-0">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-3.5 w-full max-w-[80px]" />
        </td>
      ))}
    </tr>
  );
}
