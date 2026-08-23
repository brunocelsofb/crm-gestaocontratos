'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Template = { id: string; name: string; trigger_tags: string[]; description: string | null }

export function StartImplementationModal({
  contractId, contractTags, templates, onClose,
}: {
  contractId: string; contractTags: string[]; templates: Template[]; onClose: () => void
}) {
  const router = useRouter()

  // Filtro de templates pelas tags do contrato
  const filtered = templates.filter(t =>
    t.trigger_tags.some(tag =>
      contractTags.some(ct =>
        ct.toLowerCase().includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(ct.toLowerCase())
      )
    )
  )
  const displayTemplates = filtered.length > 0 ? filtered : templates
  const matched = displayTemplates.find(t =>
    t.trigger_tags.some(tag =>
      contractTags.some(ct => ct.toLowerCase().includes(tag.toLowerCase()))
    )
  )

  const [templateId, setTemplateId] = useState(matched?.id ?? displayTemplates[0]?.id ?? '')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    if (!templateId || !startDate) {
      setError('Selecione o template e a data.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      console.log('[impl-modal] iniciando fetch...', { contractId, templateId, startDate })

      const res = await fetch('/api/implementation/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId, templateId, startDate }),
      })

      console.log('[impl-modal] status:', res.status, res.statusText)

      // Parse seguro — evita falhar se resposta não for JSON
      const text = await res.text()
      console.log('[impl-modal] resposta raw:', text.slice(0, 300))

      let data: any = {}
      try { data = JSON.parse(text) } catch { data = { error: `Resposta inválida do servidor: ${text.slice(0, 100)}` } }

      if (!res.ok || data.error) {
        const msg = data.error || `Erro HTTP ${res.status}`
        console.error('[impl-modal] erro:', msg)
        alert(`ERRO DA API: ${msg}`)
        setError(msg)
        return
      }

      console.log('[impl-modal] sucesso:', data)
      alert('✅ Cronograma de implantação gerado com sucesso!')
      onClose()
      router.refresh()

    } catch (e: any) {
      console.error('[impl-modal] catch:', e)
      alert(`ERRO DE REDE: ${e?.message ?? 'Falha desconhecida'}`)
      setError(e?.message ?? 'Erro de rede')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-bold text-[#1B556B]">🚀 Iniciar Implantação</h2>
          <p className="text-xs text-gray-400 mt-0.5">Gera o cronograma a partir do template selecionado.</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#1B556B] mb-1">
              Modelo de Implantação
            </label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none">
              {displayTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {matched && (
              <p className="mt-1 text-xs text-green-600">✓ Detectado automaticamente pelas tags do contrato</p>
            )}
            {filtered.length === 0 && templates.length > 0 && (
              <p className="mt-1 text-xs text-gray-400">Nenhuma tag compatível — exibindo todos os modelos.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1B556B] mb-1">
              Data de Início da Implantação
            </label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
            <p className="mt-1 text-xs text-gray-400">Permite datas retroativas para contratos já iniciados.</p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={handleStart} disabled={saving}
              className="flex-1 rounded-lg bg-[#1B556B] py-2.5 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
              {saving ? '⏳ Gerando cronograma...' : '🚀 Gerar Cronograma'}
            </button>
            <button onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
