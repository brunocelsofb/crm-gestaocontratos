'use client'

import { useState, useRef } from 'react'

type Template = {
  id: string
  name: string
  file_name: string
  page_count: number
  sort_order?: number
  is_miolo_after?: boolean
}

export function ProposalTemplatesManager({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState<Template[]>(
    [...initialTemplates].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  )
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState('')
  const [pageCount, setPageCount] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [mioloAfter, setMioloAfter] = useState<string | null>(
    initialTemplates.find(t => t.is_miolo_after)?.id ?? null
  )
  const dragIdx = useRef<number | null>(null)

  const inp = 'rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none'

  function onDragStart(i: number) { dragIdx.current = i }
  function onDrop(i: number) {
    if (dragIdx.current === null || dragIdx.current === i) return
    const arr = [...templates]
    const [moved] = arr.splice(dragIdx.current, 1)
    arr.splice(i, 0, moved)
    setTemplates(arr)
    dragIdx.current = null
  }

  async function saveOrder() {
    setSaving(true); setSaved(false)
    await fetch('/api/proposals/template-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: templates.map((t, i) => ({ id: t.id, sort_order: i + 1 })),
        miolo_after_id: mioloAfter,
      }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function addTemplate() {
    if (!file || !name.trim()) return
    setUploading(true)
    const fd = new FormData()
    fd.append('name', name)
    fd.append('page_count', String(pageCount))
    fd.append('file', file)
    await fetch('/api/proposals/templates', { method: 'POST', body: fd })
    setName(''); setPageCount(1); setFile(null)
    setUploading(false)
    window.location.reload()
  }

  async function removeTemplate(id: string) {
    await fetch(`/api/proposals/templates?id=${id}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const MioloSlot = ({ afterId }: { afterId: string }) => {
    if (mioloAfter === afterId) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 my-1 rounded-lg border-2 border-teal-500 bg-teal-50 text-xs font-medium text-teal-700">
          📋 MIOLO — dados do Price entram aqui
          <button onClick={() => setMioloAfter(null)} className="ml-auto text-teal-400 hover:text-teal-600 text-base leading-none">×</button>
        </div>
      )
    }
    if (mioloAfter !== null) return null
    return (
      <button
        onClick={() => setMioloAfter(afterId)}
        className="w-full text-xs text-gray-400 border border-dashed border-gray-200 rounded py-1 my-1 hover:border-teal-300 hover:text-teal-500">
        + Inserir miolo aqui
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
        <p className="text-sm font-medium text-gray-700 mb-3">+ Novo modelo de capa</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Capa institucional" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">N° de páginas</label>
            <input type="number" min={1} value={pageCount} onChange={e => setPageCount(Number(e.target.value))} className={`${inp} w-20`} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Arquivo PDF</label>
            <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <button onClick={addTemplate} disabled={!file || !name.trim() || uploading}
            className="px-4 py-1.5 text-sm font-medium bg-brand-700 text-white rounded-md disabled:opacity-50">
            {uploading ? 'Enviando...' : 'Adicionar'}
          </button>
        </div>
      </div>

      {templates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Ordem das páginas</p>
            <button onClick={saveOrder} disabled={saving}
              className={`px-3 py-1.5 text-xs font-medium rounded-md text-white ${saved ? 'bg-green-600' : 'bg-gray-800'} disabled:opacity-50`}>
              {saving ? 'Salvando...' : saved ? '✅ Salvo' : 'Salvar ordem'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">Arraste para reordenar · Defina onde o miolo entra</p>

          <MioloSlot afterId="start" />

          {templates.map((t, i) => (
            <div key={t.id}>
              <div
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(i)}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm cursor-grab active:cursor-grabbing hover:border-gray-300">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300">⠿</span>
                  <div>
                    <span className="font-medium text-gray-900">{t.name}</span>
                    <span className="ml-2 text-gray-400 text-xs">{t.file_name} · {t.page_count} pág.</span>
                  </div>
                </div>
                <button onClick={() => removeTemplate(t.id)} className="text-xs text-gray-400 hover:text-red-500">
                  Remover
                </button>
              </div>
              {i < templates.length - 1 && <MioloSlot afterId={t.id} />}
            </div>
          ))}

          <MioloSlot afterId="end" />
        </div>
      )}
    </div>
  )
}
