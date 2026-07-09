import { getValidityStatus, VALIDITY_LABELS, VALIDITY_STYLES } from '@/lib/utils/validity'

export function ValidityBadge({ validUntil }: { validUntil: string | null }) {
  const status = getValidityStatus(validUntil)
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${VALIDITY_STYLES[status]}`}>
      {VALIDITY_LABELS[status]}
    </span>
  )
}
