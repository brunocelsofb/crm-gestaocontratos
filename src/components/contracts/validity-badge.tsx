import { getValidityStatus, daysUntil, VALIDITY_STYLES } from '@/lib/utils/validity'

export function ValidityBadge({ validUntil }: { validUntil: string | null }) {
  const status = getValidityStatus(validUntil)
  if (status === 'unknown' || !validUntil) return null

  const days = daysUntil(validUntil)
  const dateStr = new Date(validUntil).toLocaleDateString('pt-BR')
  const daysLabel = days >= 0 ? `${days}d` : `${Math.abs(days)}d atrás`

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${VALIDITY_STYLES[status]}`}>
      Vence {dateStr} · {daysLabel}
    </span>
  )
}
