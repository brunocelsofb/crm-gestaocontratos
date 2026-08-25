'use client'

// NOTA DE INCERTEZA: a parte de tempo real (supabase.channel(...).on(
// 'postgres_changes', ...)) segue o mesmo padrão já usado no sino de
// notificações deste projeto — se as mensagens não aparecerem
// sozinhas (só ao recarregar a página), confira em Database →
// Replication → supabase_realtime no painel do Supabase se a tabela
// contract_whatsapp_messages está habilitada lá (a migração já tenta
// habilitar isso via SQL, mas o painel é o jeito mais confiável de
// confirmar).

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { sendContractWhatsApp, buildWhatsAppFromTemplate, sendContractWhatsAppMedia, resolveContactNameByPhone, saveWhatsAppConversationAsNote } from '@/lib/actions/whatsapp'
import { WhatsAppChatView } from '@/components/whatsapp/whatsapp-chat-view'
import { createClient } from '@/lib/supabase/client'
import { sanitizeStorageFileName } from '@/lib/utils/storage'

type Template = { id: string; name: string }
type WhatsAppLog = {
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
  sent_by_name?: string | null
}

export function ContractWhatsAppSection({
  contractId,
  isConnected,
  templates,
  defaultPhone,
  messageLog,
}: {
  contractId: string
  isConnected: boolean
  templates: Template[]
  defaultPhone: string | null
  messageLog: WhatsAppLog[]
}) {
  const router = useRouter()
  // Mantém as mensagens em estado local (não só a prop) — é isso que
  // permite mensagem nova aparecer sozinha via tempo real, sem
  // precisar de router.refresh() (que recarrega a página inteira).
  const [messages, setMessages] = useState<WhatsAppLog[]>([...messageLog].reverse())

  const [availableInstances, setAvailableInstances] = useState<{ name: string; label: string }[]>([])
  const [selectedInstance, setSelectedInstance] = useState('')

  // Carrega instâncias com aliases (mesma lógica da Central)
  useEffect(() => {
    Promise.all([
      fetch('/api/settings/evo-instances', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/settings/evo-aliases', { credentials: 'include' }).then(r => r.json()).catch(() => ({ aliases: {} })),
    ]).then(([instData, aliasData]) => {
      const aliases: Record<string, any> = aliasData.aliases ?? {}
      const list = (instData.instances ?? []).map((i: any) => {
        const name = i.instance?.instanceName ?? i.instanceName ?? i.name ?? ''
        const v = aliases[name]
        const label = !v ? name : typeof v === 'string' ? v : (v as any).label || name
        return { name, label }
      }).filter((i: any) => i.name)
      setAvailableInstances(list)
      if (list[0]) setSelectedInstance(list[0].name)
    }).catch(console.error)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`whatsapp:${contractId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'contract_crm', table: 'contract_whatsapp_messages', filter: `contract_id=eq.${contractId}` },
        (payload) => {
          setMessages((prev) => {
            // Evita duplicar se a própria pessoa acabou de enviar (já
            // está no estado local pelo router.refresh do handleSend).
            if (prev.some((m) => m.id === (payload.new as any).id)) return prev
            return [...prev, payload.new as WhatsAppLog]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'contract_crm', table: 'contract_whatsapp_messages', filter: `contract_id=eq.${contractId}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === (payload.new as any).id ? { ...m, ...(payload.new as WhatsAppLog) } : m)))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [contractId])

  // O telefone "da conversa" (pra saber quem é a pessoa de verdade no
  // cabeçalho) é o da mensagem mais recente já trocada — não o
  // contato principal do contrato, que pode ser outra pessoa.
  const conversationPhone = messages[0]?.phone ?? defaultPhone ?? ''
  const [phone, setPhone] = useState(defaultPhone ?? conversationPhone)
  const [message, setMessage] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolvedName, setResolvedName] = useState<string | null>(null)
  const [showNoteBox, setShowNoteBox] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (conversationPhone) resolveContactNameByPhone(conversationPhone).then(setResolvedName)
  }, [conversationPhone])

  async function handleTemplateChange(id: string) {
    setTemplateId(id)
    if (!id) return
    const filled = await buildWhatsAppFromTemplate(id, contractId)
    if (filled) {
      setMessage(filled.message)
      if (filled.phone) setPhone(filled.phone)
    }
  }

  async function handleSend() {
    if (!message.trim()) return
    setBusy(true); setError(null)

    const result = await sendContractWhatsApp(contractId, phone, message, templateId || null, selectedInstance || null)
    setBusy(false)

    if (result.error) {
      setError(result.error)
    } else {
      setMessage('')
      setTemplateId('')
      const newMsg = (result as any).message
      console.log('[ContractWhatsApp] MENSAGEM INJETADA:', newMsg?.id, '| sent_by_name:', newMsg?.sent_by_name)
      if (newMsg?.id) {
        // Estado em ASC → WhatsAppChatView reverte → mais recente na base
        setMessages(prev => [...prev.filter((m: any) => m.id !== newMsg.id), newMsg])
      }
      // Sempre faz refresh para garantir sincronismo
      router.refresh()
    }
  }

  async function handleFileUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file || !phone) {
      if (!phone) setError('Informe o telefone antes de enviar um arquivo.')
      return
    }
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const storagePath = `whatsapp-media/${contractId}/${Date.now()}-${sanitizeStorageFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from('proposal-files').upload(storagePath, file)

    if (uploadError) {
      setBusy(false)
      setError(`Falha no upload: ${uploadError.message}`)
      return
    }

    const publicUrl = `${window.location.origin}/api/email-assets/${storagePath}`
    const mediaType = file.type.startsWith('image/') ? 'image' : 'document'
    const result = await sendContractWhatsAppMedia(contractId, phone, publicUrl, mediaType, file.name)

    setBusy(false)
    if (result.error) setError(result.error)
    else {
      if (fileInputRef.current) fileInputRef.current.value = ''
      router.refresh()
    }
  }

  function buildConversationSummary(): string {
    const chronological = [...messages].reverse()
    return chronological
      .map((m) => `${m.direction === 'enviado' ? 'Nós' : resolvedName ?? phone}: ${m.message}`)
      .join('\n')
  }

  async function handleSaveNote() {
    setBusy(true)
    const text = noteText.trim() || buildConversationSummary()
    await saveWhatsAppConversationAsNote(contractId, `[Conversa de WhatsApp salva]\n\n${text}`)
    setBusy(false)
    setNoteSaved(true)
    setShowNoteBox(false)
    setNoteText('')
    router.refresh()
  }

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
        WhatsApp ainda não está conectado — vá em{' '}
        <a href="/settings" className="underline">Configurações</a> e conecte o Z-API.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 p-2">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pb-2">
        <p className="text-xs text-gray-400">{messages.length} mensage{messages.length === 1 ? 'm' : 'ns'}</p>
        <div>
          <button onClick={() => setShowNoteBox((v) => !v)} className="text-xs text-brand-700 hover:underline">
            📝 Salvar conversa como nota
          </button>
          {noteSaved && <span className="ml-2 text-xs text-positive-700">Salvo no histórico!</span>}
        </div>
      </div>

      {showNoteBox && (
        <div className="space-y-2 rounded-lg border border-brand-200 bg-brand-50 p-3">
          <p className="text-xs text-gray-600">Deixa em branco pra salvar a conversa inteira, ou escreve um resumo:</p>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="Ex: Cliente confirmou interesse, aguardando aprovação do jurídico." className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          <button onClick={handleSaveNote} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50">
            {busy ? 'Salvando...' : 'Salvar nota'}
          </button>
        </div>
      )}

      {/* Histórico de mensagens — scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <WhatsAppChatView messages={messages} contactName={resolvedName ?? 'Sem contato cadastrado'} contactPhone={conversationPhone} />
      </div>

      {/* Input fixo no bottom */}
      <div className="shrink-0 space-y-2 rounded-lg border border-gray-200 bg-white p-3 mt-2">
        <p className="text-sm font-medium text-gray-900">Enviar WhatsApp</p>
        {templates.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500">Usar template (opcional)</label>
            <select value={templateId} onChange={(e) => handleTemplateChange(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
              <option value="">Escrever do zero...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        {availableInstances.length > 1 && (
          <div>
            <label className="block text-xs text-gray-500">Remetente</label>
            <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
              {availableInstances.map(i => <option key={i.name} value={i.name}>{i.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500">Telefone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="62999999999" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Mensagem</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 160) + 'px'
            }}
            rows={1}
            className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none resize-none overflow-y-auto"
            style={{ minHeight: '38px', maxHeight: '160px' }}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-2">
          <button onClick={handleSend} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
            {busy ? 'Enviando...' : 'Enviar'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="text-xs" />
          <button type="button" onClick={handleFileUpload} disabled={busy} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            📎 Anexar
          </button>
        </div>
      </div>
    </div>
  )
}
