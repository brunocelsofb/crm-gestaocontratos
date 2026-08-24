'use client'

import { useState, useEffect } from 'react'
import { WhatsAppConversationPanel } from './whatsapp-conversation-panel'

type Profile = { id: string; full_name: string; job_title?: string | null }

function MessagesSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse p-4 gap-3">
      <div className="shrink-0 rounded-lg border border-gray-100 bg-white p-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-gray-200" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-36 rounded bg-gray-200" />
            <div className="h-3 w-24 rounded bg-gray-100" />
          </div>
        </div>
      </div>
      <div className="flex-1 bg-[#e5ddd5] rounded-lg p-4 space-y-3">
        {[80, 55, 70, 45, 85].map((w, i) => (
          <div key={i} className={`flex ${i % 2 ? 'justify-end' : ''}`}>
            <div className="h-10 rounded-lg bg-white/60" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
      <div className="shrink-0 rounded-lg border border-gray-100 bg-white p-3 h-16" />
    </div>
  )
}

export function WhatsAppConversationLoader({
  phone, currentUserId, users, isArchivedInitial,
}: {
  phone: string; currentUserId: string; users: Profile[]; isArchivedInitial: boolean
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    setError(null)

    fetch(`/api/whatsapp/conversation?phone=${encodeURIComponent(phone)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [phone])

  if (loading) return <MessagesSkeleton />
  if (error) return (
    <div className="flex items-center justify-center h-full text-sm text-red-500">
      Erro ao carregar: {error}
    </div>
  )
  if (!data) return null

  return (
    <WhatsAppConversationPanel
      phone={phone}
      displayName={data.displayName ?? null}
      leadId={data.leadId ?? null}
      messages={data.messages ?? []}
      searchContracts={async () => []}
      currentUserId={currentUserId}
      users={users}
      assignment={data.assignment ?? null}
      instanceName={data.instanceName ?? null}
      initialIsArchived={isArchivedInitial}
    />
  )
}
