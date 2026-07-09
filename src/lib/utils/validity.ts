export type ValidityStatus = 'valid' | 'expiring_soon' | 'expired' | 'unknown'

export function daysUntil(validUntil: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(validUntil)
  return Math.floor((end.getTime() - today.getTime()) / 86_400_000)
}

export function getValidityStatus(validUntil: string | null): ValidityStatus {
  if (!validUntil) return 'unknown'
  const diffDays = daysUntil(validUntil)
  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'expiring_soon'
  return 'valid'
}

export const VALIDITY_LABELS: Record<ValidityStatus, string> = {
  valid: 'Ativo',
  expiring_soon: 'A vencer',
  expired: 'Vencido',
  unknown: 'Sem data definida',
}

export const VALIDITY_STYLES: Record<ValidityStatus, string> = {
  valid: 'bg-positive-100 text-positive-700',
  expiring_soon: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-negative-100 text-negative-700',
  unknown: 'bg-gray-100 text-gray-500',
}
