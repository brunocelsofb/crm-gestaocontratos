'use client'

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
  // O telefone "da conversa" (pra saber quem é a pessoa de verdade no
  // cabeçalho) é o da mensagem mais recente já trocada — não o
  // contato principal do contrato, que pode ser outra pessoa.
  const conversationPhone = messageLog[0]?.phone ?? defaultPhone ?? ''
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
    setBusy(true)
    setError(null)
    const result = await sendContractWhatsApp(contractId, phone, message, templateId || null)
    setBusy(false)
    if (result.error) {
      setError(result.error)
    } else {
      setMessage('')
      setTemplateId('')
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
    const chronological = [...messageLog].reverse()
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{messageLog.length} mensage{messageLog.length === 1 ? 'm' : 'ns'} nessa conversa</p>
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

      <WhatsAppChatView messages={messageLog} contactName={resolvedName ?? 'Sem contato cadastrado'} contactPhone={conversationPhone} />

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
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
        <div>
          <label className="block text-xs text-gray-500">Telefone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="62999999999" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Mensagem</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
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
