import { getValidityStatus, daysUntil, VALIDITY_STYLES } from '@/lib/utils/validity'

export function ValidityBadge({ validUntil }: { validUntil: string | null }) {
  const status = getValidityStatus(validUntil)
  if (status === 'unknown' || !validUntil) return null

  const days = daysUntil(validUntil)
  const dateStr = new Date(validUntil).toLocaleDateString('pt-BR')

  const text =
    status === 'expired'
      ? `Vencido em ${dateStr} · ${Math.abs(days)}d atrás`
      : `Vence ${dateStr} · ${days}d`

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${VALIDITY_STYLES[status]}`}>
      {text}
    </span>
  )
}
