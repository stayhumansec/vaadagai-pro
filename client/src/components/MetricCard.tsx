interface MetricCardProps {
  label: string;
  value: string;
  colorClass?: string;
}

export function MetricCard({ label, value, colorClass = 'text-navy' }: MetricCardProps) {
  return (
    <div className="tilt-hover min-w-[120px] rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft hover:shadow-elevated">
      <p className="text-xs text-gray">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight ${colorClass}`}>{value}</p>
    </div>
  );
}
