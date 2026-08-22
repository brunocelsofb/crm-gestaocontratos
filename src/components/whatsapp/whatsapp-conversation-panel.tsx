'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { linkUnlinkedWhatsAppConversation, sendUnlinkedWhatsAppMessage, assignWhatsAppConversation, unassignWhatsAppConversation, archiveWhatsAppConversation } from '@/lib/actions/whatsapp'
import { convertLeadToOpportunity } from '@/lib/actions/leads'
import { WhatsAppChatView } from '@/components/whatsapp/whatsapp-chat-view'

type Message = {
  id: string
  phone: string
  message: string
  direction: string
  status: string
  triggered_automatically: boolean
  error_message: string | null
  created_at: string
  media_url: string | null
  media_type: string | null
  media_filename: string | null
  sender_photo_url: string | null
  delivery_status: string | null
}

type ContractOption = { id: string; label: string }

export function WhatsAppConversationPanel({
  phone,
  displayName,
  leadId,
  messages,
  searchContracts,
  currentUserId,
  users,
  assignment,
  instanceName,
  initialIsArchived,
}: {
  phone: string
  displayName: string | null
  leadId: string | null
  messages: Message[]
  searchContracts: (query: string) => Promise<ContractOption[]>
  currentUserId: string
  users: { id: string; full_name: string }[]
  assignment: { assigned_to: string; assigned_to_name: string } | null
  instanceName?: string | null
  initialIsArchived?: boolean
}) {
  const router = useRouter()
  const [isArchived, setIsArchived] = useState(initialIsArchived ?? false)
  const [showLinkSearch, setShowLinkSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContractOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [showAssignPicker, setShowAssignPicker] = useState(false)
  const [availableInstances, setAvailableInstances] = useState<{ name: string; label: string }[]>([])
  const [selectedInstance, setSelectedInstance] = useState<string>(instanceName ?? '')

  const loadInstances = useCallback(async () => {
    try {
      const [instRes, aliasRes] = await Promise.all([
        fetch('/api/settings/evo-instances'),
        fetch('/api/settings/evo-aliases'),
      ])
      const instData = await instRes.json()
      const aliasData = await aliasRes.json()
      const aliases: Record<string, string> = aliasData.aliases ?? {}
      const names = (instData.instances ?? [])
        .map((i: any) => i.name ?? i.instance?.instanceName ?? i.instanceName)
        .filter(Boolean)
        .map((name: string) => {
          const v = aliases[name]
          const label = !v ? name : typeof v === 'string' ? v : (v as any).label || name
          return { name, label }
        })
      setAvailableInstances(names)
      if (!selectedInstance && names.length > 0) {
        setSelectedInstance(instanceName ?? names[0].name)
      }
    } catch { /* ignora */ }
  }, [instanceName])

  useEffect(() => { loadInstances() }, [loadInstances])

  // Atualiza quando a conversa muda
  useEffect(() => {
    setSelectedInstance(instanceName ?? '')
  }, [instanceName])

  async function handleClaim() {
    setBusy(true)
    await assignWhatsAppConversation(phone, currentUserId)
    setBusy(false)
    router.refresh()
  }

  async function handleAssignTo(userId: string) {
    setBusy(true)
    await assignWhatsAppConversation(phone, userId)
    setBusy(false)
    setShowAssignPicker(false)
    router.refresh()
  }

  async function handleUnassign() {
    setBusy(true)
    await unassignWhatsAppConversation(phone)
    setBusy(false)
    router.refresh()
  }

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const timeout = setTimeout(() => searchContracts(query).then(setResults), 300)
    return () => clearTimeout(timeout)
  }, [query, searchContracts])

  async function handleLink(contractId: string) {
    setBusy(true)
    setError(null)
    const result = await linkUnlinkedWhatsAppConversation(phone, contractId)
    setBusy(false)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  async function handleConvert() {
    if (!leadId) return
    if (!confirm('Converter esse lead em oportunidade agora? Ele entra no funil de Novos Negócios.')) return
    setBusy(true)
    setError(null)
    const result = await convertLeadToOpportunity(leadId)
    setBusy(false)
    if (result.error) setError(result.error)
    else if (result.contractId) router.push(`/contracts/${result.contractId}`)
  }

  async function handleReply() {
    setBusy(true)
    setError(null)
    const result = await sendUnlinkedWhatsAppMessage(phone, replyText, selectedInstance || instanceName || undefined)
    setBusy(false)
    if (result.error) setError(result.error)
    else {
      setReplyText('')
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-2.5">
        {assignment ? (
          <>
            <span className="text-xs text-gray-600">
              👤 Atendendo: <strong>{assignment.assigned_to === currentUserId ? 'Você' : assignment.assigned_to_name}</strong>
            </span>
            {assignment.assigned_to === currentUserId && (
              <button onClick={handleUnassign} disabled={busy} className="text-xs text-gray-500 hover:underline disabled:opacity-50">
                Liberar conversa
              </button>
            )}
          </>
        ) : (
          <>
            <span className="text-xs text-gray-400">Ninguém está atendendo ainda</span>
            <div className="relative flex gap-2">
              <button onClick={handleClaim} disabled={busy} className="rounded-md bg-brand-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50">
                Assumir conversa
              </button>
              <button onClick={() => setShowAssignPicker((v) => !v)} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                Atribuir a...
              </button>
              {showAssignPicker && (
                <div className="absolute right-0 top-8 z-10 w-48 rounded-md border border-gray-200 bg-white shadow-md">
                  {users.map((u) => (
                    <button key={u.id} onClick={() => handleAssignTo(u.id)} className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-50">
                      {u.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${leadId ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {leadId ? '🎯 Já é um Lead' : '⚠️ Sem conta vinculada'}
            </span>
            {instanceName && (
              <span className="rounded-full bg-[#1B556B]/10 px-2 py-0.5 text-[11px] font-medium text-[#1B556B]">
                📱 via {instanceName}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => {
                if (!confirm('Finalizar este atendimento? Uma mensagem de encerramento será enviada ao cliente.')) return
                setBusy(true)
                const res = await fetch('/api/whatsapp/archive', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phone, instanceName }),
                })
                const data = await res.json()
                setBusy(false)
                if (data.error) {
                  alert(`Erro ao finalizar: ${data.error}`)
                  return
                }
                setIsArchived(true)
                window.location.href = '/whatsapp'
              }}
              disabled={busy}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              🗃️ Finalizar
            </button>
            <button
              onClick={async () => {
                setBusy(true)
                const res = await fetch('/api/whatsapp/import-history', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phone, instanceName: instanceName ?? undefined }),
                })
                const data = await res.json()
                setBusy(false)
                if (data.error) alert(`Erro: ${data.error}`)
                else { alert(`✅ ${data.imported} mensagens importadas!`); router.refresh() }
              }}
              disabled={busy}
              className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              📥 Importar histórico
            </button>
            <button
              onClick={async () => {
                if (!confirm(`Marcar ${phone} como opt-out? Esta pessoa não receberá mais mensagens automáticas.`)) return
                setBusy(true)
                await fetch('/api/whatsapp/optout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phone }),
                })
                setBusy(false)
              }}
              disabled={busy}
              className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              🚫 Opt-out
            </button>
            {leadId && (
              <>
                <Link href={`/leads/${leadId}`} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  Ver Lead completo
                </Link>
                <button onClick={handleConvert} disabled={busy} className="rounded-md bg-positive-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-positive-700 disabled:opacity-50">
                  ✅ Converter em oportunidade
                </button>
              </>
            )}
            <button onClick={() => setShowLinkSearch((v) => !v)} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              🔍 Vincular a conta existente
            </button>
            <Link href={`/contracts/new`} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              ➕ Criar oportunidade nova
            </Link>
          </div>
        </div>

        {showLinkSearch && (
          <div className="relative mt-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conta pelo nome..."
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
              autoFocus
            />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md">
                {results.map((r) => (
                  <button key={r.id} onClick={() => handleLink(r.id)} disabled={busy} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50">
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <WhatsAppChatView messages={messages} contactName={displayName} contactPhone={phone} />
      </div>

      {isArchived ? (
        <div className="flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-center">
          <p className="text-sm text-gray-500">
            🔒 Atendimento finalizado. Se o cliente enviar uma nova mensagem, a conversa será reaberta automaticamente.
          </p>
          <button
            onClick={async () => {
              await fetch('/api/whatsapp/unarchive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone }),
              })
              setIsArchived(false)
            }}
            className="mt-2 text-xs text-[#1B556B] hover:underline"
          >
            Reabrir conversa
          </button>
        </div>
      ) : (
        <div className="flex-shrink-0 space-y-2 rounded-lg border border-gray-200 bg-white p-3">
          {/* Instância travada na original da conversa */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Responder via:</span>
            {instanceName ? (
              <span className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-[#1B556B] font-medium">
                📱 {availableInstances.find(i => i.name === instanceName)?.label ?? instanceName}
                <span className="ml-1 text-gray-400 font-normal">(fixo)</span>
              </span>
            ) : (
              <select
                value={selectedInstance}
                onChange={e => setSelectedInstance(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-[#1B556B] focus:outline-none"
              >
                {availableInstances.length === 0 && (
                  <option value="">Selecione a instância</option>
                )}
                {availableInstances.map(inst => (
                  <option key={inst.name} value={inst.name}>{inst.label}</option>
                ))}
              </select>
            )}
          </div>
          <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder="Responder..." className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          <button onClick={handleReply} disabled={busy || !replyText.trim()} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
            {busy ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      )}
    </div>
  )
}
