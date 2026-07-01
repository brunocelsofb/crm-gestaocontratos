import type { LucideIcon } from 'lucide-react'

const ACCENTS = {
  brand: { border: 'border-l-brand-700', icon: 'text-brand-700' },
  positive: { border: 'border-l-positive-600', icon: 'text-positive-700' },
  warn: { border: 'border-l-warn-600', icon: 'text-warn-700' },
  negative: { border: 'border-l-negative-600', icon: 'text-negative-700' },
} as const

export function MetricCard({
  icon: Icon,
  accent,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  accent: keyof typeof ACCENTS
  label: string
  value: string
  hint?: string
}) {
  const colors = ACCENTS[accent]

  return (
    <div className={`rounded-xl border-l-[3px] bg-white p-4 ${colors.border}`}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon size={15} strokeWidth={1.75} className={colors.icon} />
        <span className="text-xs text-foreground/60">{label}</span>
      </div>
      <p className="text-[22px] font-medium text-foreground tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-positive-700">{hint}</p>}
    </div>
  )
}
