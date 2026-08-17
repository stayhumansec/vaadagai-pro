interface MetricCardProps {
  label: string;
  value: string;
  colorClass?: string;
}

export function MetricCard({ label, value, colorClass = 'text-navy' }: MetricCardProps) {
  return (
    <div className="min-w-[120px] rounded-xl border border-gray-3 bg-white p-4">
      <p className="text-xs text-gray">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}
