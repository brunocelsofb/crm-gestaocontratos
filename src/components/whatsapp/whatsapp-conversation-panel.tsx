'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { linkUnlinkedWhatsAppConversation, sendUnlinkedWhatsAppMessage, assignWhatsAppConversation, unassignWhatsAppConversation, archiveWhatsAppConversation, saveUnlinkedContactName, deleteWhatsAppConversation } from '@/lib/actions/whatsapp'
import { WhatsAppChatView } from '@/components/whatsapp/whatsapp-chat-view'
import { ConvertLeadModal } from '@/components/whatsapp/convert-lead-modal'

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
  unlinked_sender_name?: string | null
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
  onArchiveSuccess,
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
  onArchiveSuccess?: (phone: string) => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [isArchived, setIsArchived] = useState(initialIsArchived ?? false)
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null)
  const [localMessages, setLocalMessages] = useState<Message[]>(messages)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(displayName ?? '')
  const [localDisplayName, setLocalDisplayName] = useState(displayName)

  // Sincroniza quando dados frescos chegam do servidor
  useEffect(() => {
    setLocalDisplayName(displayName)
    setNameInput(displayName ?? '')
  }, [displayName])
  const [showAssignPicker, setShowAssignPicker] = useState(false)
  const [showLinkSearch, setShowLinkSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContractOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [availableInstances, setAvailableInstances] = useState<{ name: string; label: string }[]>([])
  const [selectedInstance, setSelectedInstance] = useState<string>(instanceName ?? '')

  // Sincroniza props com estado local
  useEffect(() => { setIsArchived(initialIsArchived ?? false) }, [initialIsArchived])
  // Sincroniza com dados frescos do servidor, preservando mensagens optimistas pendentes
  useEffect(() => {
    setLocalMessages(prev => {
      const pendingOpt = prev.filter(m => m.id.startsWith('opt-'))
      if (pendingOpt.length === 0) return messages
      // Mantém optimistas que ainda não foram substituídos pelo Realtime
      return [...messages, ...pendingOpt]
    })
  }, [messages])

  // Auto-scroll para mensagem mais recente
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages])

  // Supabase Realtime — escuta novas mensagens para este telefone
  useEffect(() => {
    const channel = supabase
      .channel(`wpp-${phone}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'contract_crm',
        table: 'contract_whatsapp_messages',
        filter: `phone=eq.${phone}`,
      }, (payload) => {
        const newMsg = payload.new as Message
        setLocalMessages(prev => {
          // Já existe com esse ID real — ignora
          if (prev.some(m => m.id === newMsg.id)) return prev

          // Procura mensagem optimista (id começa com 'opt-') com texto contido na msg real
          // A assinatura *Nome:* é adicionada pelo backend, então o texto real contém o texto local
          const optIdx = prev.findIndex(m =>
            m.id.startsWith('opt-') &&
            m.direction === newMsg.direction &&
            newMsg.message.includes(m.message.trim())
          )

          if (optIdx !== -1) {
            // Substitui o optimista pela mensagem real
            const next = [...prev]
            next[optIdx] = newMsg
            return next
          }

          return [...prev, newMsg]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [phone])

  // Foto de perfil
  useEffect(() => {
    fetch(`/api/whatsapp/profile-pic?phone=${encodeURIComponent(phone)}`)
      .then(r => r.json())
      .then(d => { if (d.url) setProfilePicUrl(d.url) })
      .catch(() => {})
  }, [phone])

  // Instâncias disponíveis
  const loadInstances = useCallback(async () => {
    try {
      const [instRes, aliasRes] = await Promise.all([
        fetch('/api/settings/evo-instances'),
        fetch('/api/settings/evo-aliases'),
      ])
      const instData = await instRes.json()
      const aliasData = await aliasRes.json()
      const aliases: Record<string, any> = aliasData.aliases ?? {}
      const names = (instData.instances ?? [])
        .map((i: any) => i.name ?? i.instance?.instanceName ?? i.instanceName)
        .filter(Boolean)
        .map((name: string) => {
          const v = aliases[name]
          const label = !v ? name : typeof v === 'string' ? v : (v as any).label || name
          return { name, label }
        })
      setAvailableInstances(names)
      if (!selectedInstance && names.length > 0) setSelectedInstance(instanceName ?? names[0].name)
    } catch { }
  }, [instanceName])
  useEffect(() => { loadInstances() }, [loadInstances])
  useEffect(() => { setSelectedInstance(instanceName ?? '') }, [instanceName])

  async function handleClaim() {
    setBusy(true)
    await assignWhatsAppConversation(phone, currentUserId)
    setBusy(false)
    router.refresh()
  }

  async function handleReply() {
    if (!replyText.trim()) return
    // Optimistic update — adiciona imediatamente na tela
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      phone, message: replyText, direction: 'enviado',
      status: 'enviado', triggered_automatically: false,
      error_message: null, created_at: new Date().toISOString(),
      media_url: null, media_type: null, media_filename: null,
      sender_photo_url: null, delivery_status: null,
    }
    setLocalMessages(prev => [...prev, optimistic])
    setReplyText('')
    // Reset auto-resize
    const ta = document.querySelector('textarea[placeholder="Responder..."]') as HTMLTextAreaElement | null
    if (ta) ta.style.height = '38px'
    setBusy(true)
    const result = await sendUnlinkedWhatsAppMessage(phone, replyText, selectedInstance || instanceName || undefined)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      setLocalMessages(prev => prev.filter(m => m.id !== optimistic.id))
    }
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

  const [showConvertModal, setShowConvertModal] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const timeout = setTimeout(() => {
      fetch(`/api/whatsapp/link-account?q=${encodeURIComponent(query)}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => setResults(d.results ?? []))
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  async function handleLink(contractId: string) {
    setBusy(true)
    setError(null)
    const result = await linkUnlinkedWhatsAppConversation(phone, contractId)
    setBusy(false)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 rounded-lg border border-gray-200 bg-white p-3 space-y-2">
        {/* Avatar + nome + badges */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {profilePicUrl ? (
              <img src={profilePicUrl} alt="" className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                onError={() => setProfilePicUrl(null)} />
            ) : (
              <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0">
                {(displayName ?? phone).charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              {editingName ? (
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  if (!nameInput.trim()) { setEditingName(false); return }
                  await saveUnlinkedContactName(phone, nameInput.trim())
                  setLocalDisplayName(nameInput.trim())
                  setEditingName(false)
                  router.refresh()
                }} className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onBlur={async () => {
                      if (nameInput.trim() && nameInput.trim() !== (localDisplayName ?? '')) {
                        await saveUnlinkedContactName(phone, nameInput.trim())
                        setLocalDisplayName(nameInput.trim())
                        router.refresh()
                      }
                      setEditingName(false)
                    }}
                    placeholder={phone}
                    className="rounded border border-[#1B556B] px-2 py-0.5 text-sm font-semibold focus:outline-none w-44"
                  />
                  <button type="submit" className="text-[#1B556B] text-xs font-semibold hover:underline">✓</button>
                  <button type="button" onClick={() => setEditingName(false)} className="text-gray-400 text-xs">✕</button>
                </form>
              ) : (
                <button
                  onClick={() => { setNameInput(localDisplayName ?? ''); setEditingName(true) }}
                  className="flex items-center gap-1.5 text-left hover:bg-gray-100 rounded px-1 -mx-1 py-0.5 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-900">
                    {localDisplayName ?? <span className="text-gray-400 italic font-normal text-xs">Sem nome — clique para editar</span>}
                  </span>
                  <span className="text-[10px] text-gray-300">✏️</span>
                </button>
              )}
              <p className="text-[10px] text-gray-400">{phone}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 justify-end">
            {leadId && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700">
                🎯 Lead
              </span>
            )}
            {availableInstances.length > 0 && (
              <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)}
                className="rounded-full border border-[#1B556B]/30 bg-[#1B556B]/5 px-2 py-0.5 text-[10px] font-medium text-[#1B556B] focus:outline-none">
                {availableInstances.map(i => (
                  <option key={i.name} value={i.name}>📱 {i.label}</option>
                ))}
              </select>
            )}
            {assignment ? (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-medium">
                  👤 {assignment.assigned_to === currentUserId ? 'Você' : assignment.assigned_to_name}
                </span>
                <div className="relative">
                  <button onClick={() => setShowAssignPicker(v => !v)}
                    className="rounded-full border border-gray-300 px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-50">
                    🔄
                  </button>
                  {showAssignPicker && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowAssignPicker(false)} />
                      <div className="absolute right-0 top-6 z-20 min-w-[160px] rounded-md border border-gray-200 bg-white shadow-lg">
                      <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase">Transferir para</p>
                      {users.filter(u => u.id !== assignment.assigned_to).map(u => (
                        <button key={u.id}
                          onClick={async () => { setShowAssignPicker(false); setBusy(true); await handleAssignTo(u.id); setBusy(false) }}
                          className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-50">
                          {u.full_name}
                        </button>
                      ))}
                      <button onClick={async () => { setShowAssignPicker(false); setBusy(true); await handleUnassign(); setBusy(false) }}
                        className="block w-full border-t px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50">
                        Liberar conversa
                      </button>
                    </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button onClick={async () => { setBusy(true); await handleClaim(); setBusy(false) }}
                disabled={busy}
                className="rounded-full bg-[#1B556B] px-3 py-1 text-[10px] font-semibold text-white hover:bg-[#164659] disabled:opacity-50 flex-shrink-0">
                🙋‍♂️ Assumir
              </button>
            )}
          </div>
        </div>
        {/* Botões de ação */}
          <div className="flex flex-wrap gap-2">
            {isArchived ? (
              <button
                onClick={async () => {
                  setBusy(true)
                  await fetch('/api/whatsapp/unarchive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone }),
                  })
                  setBusy(false)
                  setIsArchived(false)
                  router.push('/whatsapp')
                  router.refresh()
                }}
                disabled={busy}
                className="rounded-md border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                📤 Desarquivar
              </button>
            ) : (
            <>
            <button
              onClick={async () => {
                if (!confirm('Arquivar esta conversa? Ela sairá da lista sem enviar mensagem ao cliente.')) return
                setBusy(true)
                const res = await fetch('/api/whatsapp/archive?mode=archive', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phone, instanceName }),
                })
                const data = await res.json()
                setBusy(false)
                if (!res.ok || data.error) { alert(`Erro: ${data.error}`); return }
                setIsArchived(true)
                onArchiveSuccess?.(phone)
                router.push('/whatsapp'); router.refresh()
              }}
              disabled={busy}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              🗃️ Arquivar
            </button>
            <button
              onClick={async () => {
                if (!confirm('Finalizar? Enviará mensagem de encerramento ao cliente e arquivará a conversa.')) return
                setBusy(true)
                const res = await fetch('/api/whatsapp/archive?mode=finalize', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phone, instanceName }),
                })
                const data = await res.json()
                setBusy(false)
                if (!res.ok || data.error) { alert(`Erro: ${data.error}`); return }
                setIsArchived(true)
                onArchiveSuccess?.(phone)
                router.push('/whatsapp'); router.refresh()
              }}
              disabled={busy}
              className="rounded-md border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              ✅ Finalizar
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
                if (!confirm('⚠️ Excluir TODA esta conversa? Isso remove todas as mensagens do banco. Não pode ser desfeito.')) return
                setBusy(true)
                await deleteWhatsAppConversation(phone)
                setBusy(false)
                router.push('/whatsapp')
                router.refresh()
              }}
              disabled={busy}
              className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
            >
              🗑️ Excluir chat
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
                <button onClick={() => setShowConvertModal(true)} disabled={busy}
                  className="rounded-md bg-positive-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-positive-700 disabled:opacity-50">
                  ✅ Converter em oportunidade
                </button>
              </>
            )}
            <button onClick={() => setShowLinkSearch((v) => !v)} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              🔍 Vincular a conta existente
            </button>
            <button onClick={() => setShowConvertModal(true)}
              className="rounded-md border border-green-300 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50">
              ➕ Criar oportunidade nova
            </button>
            </>
            )}
          </div>

        {showLinkSearch && (
          <div className="relative mt-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conta pelo nome... (mín. 2 caracteres)"
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
              autoFocus
            />
            {query.length >= 2 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md max-h-48 overflow-y-auto">
                {results.length > 0 ? results.map((r) => (
                  <button key={r.id} onClick={() => handleLink(r.id)} disabled={busy}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 border-b border-gray-50 last:border-0">
                    {r.label}
                  </button>
                )) : (
                  <p className="px-3 py-2 text-xs text-gray-400">Nenhuma conta encontrada para "{query}"</p>
                )}
              </div>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <WhatsAppChatView messages={[...localMessages].reverse()} contactName={displayName} contactPhone={phone} />
        <div ref={messagesEndRef} />
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
          {/* Seletor de instância */}
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
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 160) + 'px'
            }}
            rows={1}
            placeholder="Responder..."
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none resize-none overflow-y-auto"
            style={{ minHeight: '38px', maxHeight: '160px' }}
          />
          <button onClick={handleReply} disabled={busy || !replyText.trim()} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
            {busy ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      )}
      {showConvertModal && (
        <ConvertLeadModal phone={phone} leadId={leadId} displayName={localDisplayName} onClose={() => setShowConvertModal(false)} />
      )}
    </div>
  )
}
