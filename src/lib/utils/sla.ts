export type SlaStatus = 'ok' | 'atencao' | 'vencido' | 'sem_prazo'

export function getSlaStatus(slaDueAt: string | null, resolvedAt: string | null): SlaStatus {
  if (!slaDueAt) return 'sem_prazo'
  if (resolvedAt) return 'ok' // já foi resolvido, não importa mais o prazo

  const due = new Date(slaDueAt).getTime()
  const now = Date.now()
  const hoursLeft = (due - now) / 3600_000

  if (hoursLeft < 0) return 'vencido'
  if (hoursLeft < 4) return 'atencao'
  return 'ok'
}

export const SLA_LABELS: Record<SlaStatus, string> = {
  ok: 'Dentro do prazo',
  atencao: 'Vencendo em breve',
  vencido: 'SLA vencido',
  sem_prazo: 'Sem prazo definido',
}

export const SLA_STYLES: Record<SlaStatus, string> = {
  ok: 'bg-positive-100 text-positive-700',
  atencao: 'bg-yellow-100 text-yellow-800',
  vencido: 'bg-negative-100 text-negative-700',
  sem_prazo: 'bg-gray-100 text-gray-500',
}
