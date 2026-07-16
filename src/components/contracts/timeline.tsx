// Timeline de atividades — Server Component (a maioria só leitura),
// mas usa ExpandableRow (client) pros cards de e-mail, que precisam
// abrir/fechar.

import { ExpandableRow } from '@/components/surveys/expandable-row'

type EventMetadata = {
  kind?: 'sent' | 'received' | 'opened'
  subject?: string
  from_email?: string
  to_email?: string
  body?: string
  phone?: string
  message?: string
}

type Activity = {
  id: string
  type: string
  content: string
  created_at: string
  due_date: string | null
  completed: boolean | null
  profiles: { full_name: string } | null
  metadata: EventMetadata | null
}

const TYPE_LABEL: Record<string, string> = {
  note: 'Nova nota adicionada',
  task: 'Atividade criada',
  call: 'Ligação',
  email: 'E-mail',
  stage_change: 'Etapa alterada',
  pipeline_change: 'Funil alterado',
  automation_triggered: 'Automação disparada',
  system: 'Evento do sistema',
  transfer: 'Transferência entre times',
}

const EMAIL_KIND_LABEL: Record<string, string> = {
  sent: 'E-mail Enviado',
  received: 'E-mail Recebido',
  opened: 'Um e-mail enviado foi visualizado',
}

const WHATSAPP_KIND_LABEL: Record<string, string> = {
  sent: 'WhatsApp Enviado',
  received: 'WhatsApp Recebido',
  opened: 'WhatsApp Enviado',
}

// Cores por categoria de evento, não por sequência — ver design system.
const TYPE_COLOR: Record<string, string> = {
  note: 'bg-amber-100 text-amber-700',
  task: 'bg-emerald-100 text-emerald-700',
  call: 'bg-emerald-100 text-emerald-700',
  email: 'bg-blue-100 text-blue-700',
  whatsapp: 'bg-emerald-100 text-emerald-700',
  stage_change: 'bg-blue-100 text-blue-700',
  pipeline_change: 'bg-purple-100 text-purple-700',
  automation_triggered: 'bg-purple-100 text-purple-700',
  system: 'bg-gray-100 text-gray-600',
  transfer: 'bg-orange-100 text-orange-700',
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `${days} dias atrás`
}

export function Timeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Nenhuma atividade registrada ainda.</p>
  }

  return (
    <div className="space-y-4">
      {activities.map((a) => {
        if ((a.type === 'email' || a.type === 'whatsapp') && a.metadata?.kind) {
          const kind = a.metadata.kind
          const isWhatsApp = a.type === 'whatsapp'
          const icon = kind === 'sent' ? (isWhatsApp ? '💬' : '📤') : kind === 'received' ? '📥' : '👁️'
          const kindLabel = isWhatsApp ? WHATSAPP_KIND_LABEL[kind] : EMAIL_KIND_LABEL[kind]
          const badgeColor = isWhatsApp ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
          const title = isWhatsApp ? a.metadata.message : a.metadata.subject
          return (
            <ExpandableRow
              key={a.id}
              summary={
                <div className="flex items-start gap-3">
                  <span className={`h-fit shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${badgeColor}`}>
                    {icon} {kindLabel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                      <span>{relativeTime(a.created_at)}</span>
                      <span>·</span>
                      <span>{new Date(a.created_at).toLocaleString('pt-BR')}</span>
                      {a.profiles?.full_name && (
                        <>
                          <span>·</span>
                          <span>{a.profiles.full_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              }
            >
              <div className="space-y-1 text-sm text-gray-700">
                {isWhatsApp ? (
                  <>
                    <p><strong>Data:</strong> {new Date(a.created_at).toLocaleString('pt-BR')}</p>
                    {a.metadata.phone && <p><strong>Telefone:</strong> {a.metadata.phone}</p>}
                    {a.metadata.message && <p className="mt-2 whitespace-pre-wrap rounded-md border border-gray-100 bg-gray-50 p-3">{a.metadata.message}</p>}
                  </>
                ) : (
                  <>
                    {a.metadata.subject && <p><strong>Assunto:</strong> {a.metadata.subject}</p>}
                    <p><strong>Data:</strong> {new Date(a.created_at).toLocaleString('pt-BR')}</p>
                    {a.metadata.from_email && <p><strong>De:</strong> {a.metadata.from_email}</p>}
                    {a.metadata.to_email && <p><strong>Para:</strong> {a.metadata.to_email}</p>}
                    {a.metadata.body && (
                      <div className="mt-2 rounded-md border border-gray-100 bg-gray-50 p-3" dangerouslySetInnerHTML={{ __html: a.metadata.body }} />
                    )}
                  </>
                )}
              </div>
            </ExpandableRow>
          )
        }

        return (
          <div key={a.id} className="flex gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <span className={`h-fit shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${TYPE_COLOR[a.type] ?? 'bg-gray-100 text-gray-600'}`}>
              {TYPE_LABEL[a.type] ?? a.type}
            </span>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-wrap text-sm text-gray-800">{a.content}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <span>{relativeTime(a.created_at)}</span>
                <span>·</span>
                <span>{new Date(a.created_at).toLocaleString('pt-BR')}</span>
                {a.profiles?.full_name && (
                  <>
                    <span>·</span>
                    <span>{a.profiles.full_name}</span>
                  </>
                )}
                {a.type === 'task' && (
                  <>
                    <span>·</span>
                    <span className={a.completed ? 'text-emerald-600' : 'text-amber-600'}>
                      {a.completed ? 'Concluída' : 'Pendente'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
