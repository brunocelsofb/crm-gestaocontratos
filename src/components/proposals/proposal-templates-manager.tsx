'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { registerProposalTemplate, deleteProposalTemplate } from '@/lib/actions/proposals'
import { sanitizeStorageFileName } from '@/lib/utils/storage'

type Template = { id: string; name: string; file_name: string; page_count: number }

export function ProposalTemplatesManager({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [name, setName] = useState('')
  const [pageCount, setPageCount] = useState('1')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setError('Escolha um arquivo PDF.')
      return
    }
    if (!name.trim()) {
      setError('Dê um nome pra essa capa.')
      return
    }
    setError(null)
    setUploading(true)

    const supabase = createClient()
    const storagePath = `templates/${Date.now()}-${sanitizeStorageFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from('proposal-files').upload(storagePath, file)

    if (uploadError) {
      setError(`Falha no upload: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const result = await registerProposalTemplate(name, storagePath, file.name, Number(pageCount) || 1)
    setUploading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setTemplates((prev) => [...prev, { id: crypto.randomUUID(), name, file_name: file.name, page_count: Number(pageCount) || 1 }])
      setName('')
      setPageCount('1')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este modelo de capa?')) return
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    await deleteProposalTemplate(id)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">+ Novo modelo de capa</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] text-gray-500">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Capa institucional"
              className="mt-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500">Nº de páginas</label>
            <input
              type="number"
              min="1"
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value)}
              className="mt-1 w-20 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500">Arquivo PDF</label>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="mt-1 text-xs" />
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {uploading ? 'Enviando...' : 'Adicionar'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="space-y-1.5">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <div>
              <span className="font-medium text-gray-900">{t.name}</span>
              <span className="ml-2 text-xs text-gray-400">{t.file_name} · {t.page_count} pág.</span>
            </div>
            <button onClick={() => handleDelete(t.id)} className="text-xs text-gray-400 hover:text-negative-600">
              Remover
            </button>
          </div>
        ))}
        {templates.length === 0 && <p className="text-sm text-gray-400">Nenhum modelo de capa cadastrado ainda.</p>}
      </div>
    </div>
  )
}
