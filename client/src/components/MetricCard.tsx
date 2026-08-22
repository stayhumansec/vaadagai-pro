interface MetricCardProps {
  label: string;
  value: string;
  colorClass?: string;
  /** Signed change vs. the comparison period (e.g. +12 or -5). Omit when there's nothing to compare against. */
  delta?: number | null;
  /** Unit shown after the delta number. Defaults to '%'. */
  deltaSuffix?: string;
  /** Whether a positive delta should read as good (green) or bad (red). Defaults to true -- e.g. false for a balance/dues card, where less is better. */
  deltaGoodWhenPositive?: boolean;
}

export function MetricCard({ label, value, colorClass = 'text-navy', delta, deltaSuffix = '%', deltaGoodWhenPositive = true }: MetricCardProps) {
  const showDelta = delta !== undefined && delta !== null;
  const deltaIsGood = showDelta && (delta === 0 ? null : (delta > 0) === deltaGoodWhenPositive);

  return (
    <div className="tilt-hover min-w-[120px] rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft hover:shadow-elevated">
      <p className="text-xs text-gray">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className={`text-xl font-semibold tracking-tight ${colorClass}`}>{value}</p>
        {showDelta && (
          <span className={`text-xs font-medium ${deltaIsGood === null ? 'text-gray' : deltaIsGood ? 'text-brand-green' : 'text-brand-red'}`}>
            {delta! > 0 ? '▲' : delta! < 0 ? '▼' : '–'} {Math.abs(delta!)}{deltaSuffix}
          </span>
        )}
      </div>
    </div>
  );
}
