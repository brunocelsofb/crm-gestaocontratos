'use client'

import { useState } from 'react'
import Link from 'next/link'

type Conv = {
  phone: string
  latest: {
    unlinked_sender_name: string | null
    message: string
    media_type: string | null
    direction: string
    created_at: string
    lead_id: string | null
    instance_name: string | null
  }
  lead?: { id: string; name: string } | null
}

export function WhatsAppSidebar({
  open, archived, selectedPhone, assignments, currentUserId, instanceAliases,
}: {
  open: Conv[]; archived: Conv[]; selectedPhone: string | null
  assignments: Record<string, { assigned_to: string; assigned_to_name: string }>
  currentUserId: string; instanceAliases: Record<string, any>
}) {
  const [tab, setTab] = useState<'open' | 'archived'>('open')

  const getLabel = (name: string) => {
    const v = instanceAliases[name]
    if (!v) return name
    if (typeof v === 'string') return v
    return (v as any).label || name
  }

  const list = tab === 'open' ? open : archived

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-200 mb-2 flex-shrink-0">
        <button onClick={() => setTab('open')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === 'open' ? 'border-b-2 border-[#1B556B] text-[#1B556B]' : 'text-gray-400 hover:text-gray-600'}`}>
          Em aberto ({open.length})
        </button>
        <button onClick={() => setTab('archived')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === 'archived' ? 'border-b-2 border-[#1B556B] text-[#1B556B]' : 'text-gray-400 hover:text-gray-600'}`}>
          Arquivados ({archived.length})
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {list.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-gray-400">
            {tab === 'open' ? 'Nenhuma conversa em aberto.' : 'Nenhuma conversa arquivada.'}
          </p>
        )}
        {list.map((c) => (
          <Link key={c.phone} href={`/whatsapp?phone=${encodeURIComponent(c.phone)}`}
            className={`block rounded-md border px-3 py-2 text-sm hover:bg-gray-50 ${
              selectedPhone === c.phone ? 'border-brand-300 bg-brand-50'
              : tab === 'archived' ? 'border-gray-200 bg-gray-50/60'
              : c.lead ? 'border-purple-100 bg-purple-50/40' : 'border-yellow-100 bg-yellow-50/40'
            }`}>
            <div className="flex items-center justify-between gap-1">
              <p className="truncate font-medium text-gray-900">{c.lead?.name || c.latest.unlinked_sender_name || c.phone}</p>
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                tab === 'archived' ? 'bg-gray-100 text-gray-500' : c.lead ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'
              }`}>{tab === 'archived' ? '🗃️' : c.lead ? 'Lead' : 'Novo'}</span>
            </div>
            <p className="truncate text-xs text-gray-500">
              {c.latest.direction === 'enviado' ? '📤 ' : '📥 '}
              {c.latest.media_type ? `[${c.latest.media_type}]` : c.latest.message}
            </p>
            {c.latest.instance_name && (
              <span className="mt-0.5 inline-block rounded-full bg-[#1B556B]/10 px-2 py-0.5 text-[10px] font-medium text-[#1B556B]">
                via {getLabel(c.latest.instance_name)}
              </span>
            )}
            <div className="mt-0.5 flex items-center justify-between">
              <p className="text-[10px] text-gray-400">{new Date(c.latest.created_at).toLocaleString('pt-BR')}</p>
              {assignments[c.phone] && tab === 'open' && (
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-600">
                  👤 {assignments[c.phone].assigned_to === currentUserId ? 'Você' : assignments[c.phone].assigned_to_name}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
