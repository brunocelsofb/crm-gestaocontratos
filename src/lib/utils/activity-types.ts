// Tipos e labels de atividade — arquivo sem 'use server', importável em qualquer lugar

export type ActivityType = 'note' | 'call' | 'email' | 'whatsapp' | 'meeting' | 'task' | 'internal' | 'reminder'

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  note:     '📝 Nota',
  call:     '📞 Ligação',
  email:    '✉ E-mail',
  whatsapp: '💬 WhatsApp',
  meeting:  '🤝 Reunião',
  task:     '✅ Tarefa',
  internal: '🔧 Atividade Interna',
  reminder: '🔔 Lembrete',
}

export const ACTIVITY_TYPE_ICON: Record<string, string> = {
  note: '📝', call: '📞', email: '✉', whatsapp: '💬',
  meeting: '🤝', task: '✅', internal: '🔧', reminder: '🔔',
  system: '⚙', stage_change: '🔀', pipeline_change: '🔀',
  automation_triggered: '⚡', transfer: '↔',
}
