import type { LucideIcon } from 'lucide-react'

const ACCENTS = {
  brand: { badge: 'bg-brand-100', icon: 'text-brand-700' },
  positive: { badge: 'bg-positive-100', icon: 'text-positive-700' },
  warn: { badge: 'bg-warn-100', icon: 'text-warn-700' },
  negative: { badge: 'bg-negative-100', icon: 'text-negative-700' },
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
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] ${colors.badge}`}>
        <Icon size={17} strokeWidth={1.75} className={colors.icon} />
      </div>
      <p className="mb-1 text-xs text-foreground/60">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-[26px] font-medium text-foreground tabular-nums">{value}</p>
        {hint && (
          <span className="rounded-full bg-positive-100 px-1.5 py-0.5 text-[11px] text-positive-700">{hint}</span>
        )}
      </div>
    </div>
  )
}
