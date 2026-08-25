'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Instance = { name: string; label: string }

export function NewConversationModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [instances, setInstances] = useState<Instance[]>([])
  const [instance, setInstance] = useState('')
  const [phone, setPhone] = useState('+55 ')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/evo-instances', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list: Instance[] = (d.instances ?? []).map((i: any) => {
          const name = i.instance?.instanceName ?? i.instanceName ?? i.name ?? ''
          return { name, label: name }
        }).filter((i: Instance) => i.name)
        setInstances(list)
        if (list[0]) setInstance(list[0].name)
      })
      .catch(console.error)
  }, [])

  async function handleSend() {
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 10) { setError('Telefone inválido.'); return }
    if (!message.trim()) { setError('Digite uma mensagem.'); return }
    if (!instance) { setError('Selecione a instância.'); return }
    setSending(true); setError(null)

    const res = await fetch('/api/whatsapp/new-conversation', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone, message: message.trim(), instance }),
    })
    const data = await res.json()
    setSending(false)
    if (data.error) { setError(data.error); return }
    onClose()
    router.push(`/whatsapp?phone=${encodeURIComponent(cleanPhone)}`)
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-bold text-[#1B556B]">💬 Nova Conversa</h2>
          <p className="text-xs text-gray-400 mt-0.5">Inicia um novo chat com qualquer número</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Remetente (Instância)</label>
            <select value={instance} onChange={e => setInstance(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none">
              {instances.map(i => <option key={i.name} value={i.name}>{i.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Telefone (com DDI)</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+55 62 99999-9999"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Primeira mensagem</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              placeholder="Olá, tudo bem?"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-[#1B556B] focus:outline-none" />
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <button onClick={handleSend} disabled={sending}
              className="flex-1 rounded-lg bg-[#1B556B] py-2.5 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
              {sending ? 'Enviando...' : '📤 Enviar e Abrir Chat'}
            </button>
            <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
