import { Suspense } from 'react'
import { getConversationByPhone, getWhatsAppAssignments, searchContractsForLinking } from '@/lib/actions/whatsapp'
import { getImplementationTemplates } from '@/lib/actions/implementation'
import { WhatsAppConversationPanel } from './whatsapp-conversation-panel'
import { createAdminClient } from '@/lib/supabase/admin'

// Skeleton mostrado enquanto mensagens carregam
function MessagesSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="shrink-0 rounded-lg border border-gray-200 bg-white p-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-gray-200" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-36 rounded bg-gray-200" />
            <div className="h-3 w-24 rounded bg-gray-100" />
          </div>
        </div>
      </div>
      <div className="flex-1 bg-[#e5ddd5] rounded-lg p-4 space-y-3">
        {[80, 60, 75, 50, 90].map((w, i) => (
          <div key={i} className={`flex ${i % 2 ? 'justify-end' : ''}`}>
            <div className="h-10 rounded-lg bg-white/60" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
      <div className="shrink-0 rounded-lg border border-gray-200 bg-white p-3 mt-2">
        <div className="h-10 w-full rounded bg-gray-100" />
      </div>
    </div>
  )
}

// Busca dados e renderiza o painel — este é o componente "lento"
async function ConversationData({
  phone, currentUserId, users, isArchivedInitial,
}: {
  phone: string; currentUserId: string; users: { id: string; full_name: string }[]; isArchivedInitial: boolean
}) {
  const admin = createAdminClient()
  const [conv, assignments, { data: orgData }] = await Promise.all([
    getConversationByPhone(phone),
    getWhatsAppAssignments([phone]),
    admin.from('organization_settings').select('evo_instance_aliases').eq('id', 'default').maybeSingle(),
  ])

  const aliases = (orgData as any)?.evo_instance_aliases ?? {}
  const getLabel = (name: string) => {
    const v = aliases[name]
    if (!v) return name
    return typeof v === 'string' ? v : (v as any).label || name
  }
  const instanceName = conv.messages.find((m: any) => m.instance_name)?.instance_name ?? null

  return (
    <WhatsAppConversationPanel
      phone={phone}
      displayName={conv.displayName}
      leadId={conv.leadId}
      messages={conv.messages as any}
      searchContracts={searchContractsForLinking}
      currentUserId={currentUserId}
      users={users}
      assignment={assignments[phone] ?? null}
      instanceName={instanceName}
      initialIsArchived={isArchivedInitial}
    />
  )
}

export function WhatsAppConversationLoader({
  phone, currentUserId, users, isArchivedInitial,
}: {
  phone: string; currentUserId: string; users: { id: string; full_name: string }[]; isArchivedInitial: boolean
}) {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <ConversationData
        phone={phone}
        currentUserId={currentUserId}
        users={users}
        isArchivedInitial={isArchivedInitial}
      />
    </Suspense>
  )
}
