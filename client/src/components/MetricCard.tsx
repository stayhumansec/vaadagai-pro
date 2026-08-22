interface MetricCardProps {
  label: string;
  value: string;
  icon?: string;
  colorClass?: string;
  /** Signed change vs. the comparison period (e.g. +12 or -5). Omit when there's nothing to compare against. */
  delta?: number | null;
  /** Unit shown after the delta number. Defaults to '%'. */
  deltaSuffix?: string;
  /** Whether a positive delta should read as good (green) or bad (red). Defaults to true -- e.g. false for a balance/dues card, where less is better. */
  deltaGoodWhenPositive?: boolean;
  /** 0-100. When set, renders a simple progress bar instead of showing a delta -- for metrics that are naturally a percentage (e.g. collection rate). */
  progressPct?: number;
  /** Tailwind bg-* class for the progress bar fill. Defaults to matching colorClass's hue. */
  progressColorClass?: string;
}

export function MetricCard({
  label,
  value,
  icon,
  colorClass = 'text-navy',
  delta,
  deltaSuffix = '%',
  deltaGoodWhenPositive = true,
  progressPct,
  progressColorClass = 'bg-brand-purple',
}: MetricCardProps) {
  const showDelta = progressPct === undefined && delta !== undefined && delta !== null;
  const deltaIsGood = showDelta && (delta === 0 ? null : (delta! > 0) === deltaGoodWhenPositive);

  return (
    <div className="tilt-hover min-w-[130px] rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft hover:shadow-elevated">
      <p className="flex items-center gap-1 text-xs text-gray">
        {icon && <span aria-hidden="true">{icon}</span>}
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className={`text-xl font-semibold tracking-tight ${colorClass}`}>{value}</p>
        {showDelta && (
          <span className={`text-xs font-medium ${deltaIsGood === null ? 'text-gray' : deltaIsGood ? 'text-brand-green' : 'text-brand-red'}`}>
            {delta! > 0 ? '▲' : delta! < 0 ? '▼' : '–'} {Math.abs(delta!)}{deltaSuffix}
          </span>
        )}
      </div>
      {progressPct !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-3">
          <div className={`h-full rounded-full ${progressColorClass}`} style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
        </div>
      )}
    </div>
  );
}
