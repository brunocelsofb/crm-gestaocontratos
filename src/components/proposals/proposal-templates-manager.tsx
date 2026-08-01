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
  const dragRef = useRef<number | null>(null)

  const inp = 'rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none'

  function handleDragStart(i: number) { dragRef.current = i }
  async function handleSaveOrder() {
  function handleDrop(i: number) {
    if (dragRef.current === null || dragRef.current === i) return
    const arr = [...templates]
    const [moved] = arr.splice(dragRef.current, 1)
    arr.splice(i, 0, moved)
    setTemplates(arr)
    dragRef.current = null
  }

  const inp = 'rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none'

  function handleDragStart(i: number) { dragRef.current = i }
  function handleDrop(i: number) {
    if (dragRef.current === null || dragRef.current === i) return
    const arr = [...templates]
    const [moved] = arr.splice(dragRef.current, 1)
    arr.splice(i, 0, moved)
    setTemplates(arr)
    dragRef.current = null
  }

  async function handleSaveOrder() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/proposals/template-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: templates.map((t, i) => ({ id: t.id, sort_order: i + 1 })),
        miolo_after_id: mioloAfter,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleAdd() {
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

  return (
    <div className="space-y-6">
      {/* Formulário de upload */}
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
          <button
            onClick={handleAdd}
            disabled={!file || !name.trim() || uploading}
            className="px-4 py-1.5 text-sm font-medium bg-brand-700 text-white rounded-md disabled:opacity-50">
            {uploading ? 'Enviando...' : 'Adicionar'}
          </button>
        </div>
      </div>

      {/* Lista com drag-and-drop */}
      {templates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Ordem das páginas</p>
            <button
              onClick={handleSaveOrder}
              disabled={saving}
              className={`px-3 py-1.5 text-xs font-medium rounded-md text-white ${saved ? 'bg-green-600' : 'bg-gray-800'} disabled:opacity-50`}>
              {saving ? 'Salvando...' : saved ? '✅ Salvo' : 'Salvar ordem'}
            </button>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Arraste para reordenar · Clique em "Miolo aqui" para definir onde os dados do Price entram
          </p>

          {/* Indicador de miolo ANTES do primeiro */}
          {mioloAfter === 'start' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-teal-500 bg-teal-50 text-teal-700 text-xs font-medium">
              📋 MIOLO (dados do Price entra aqui)
              <button onClick={() => setMioloAfter(null)} className="ml-auto text-teal-400 hover:text-teal-600">✕</button>
            </div>
          )}
          {!mioloAfter && (
            <button
              onClick={() => setMioloAfter('start')}
              className="w-full text-xs text-gray-400 border border-dashed border-gray-200 rounded py-1 hover:border-teal-300 hover:text-teal-500">
              + Inserir miolo aqui (antes de tudo)
            </button>
          )}

          {templates.map((t, i) => (
            <div key={t.id}>
              <div
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(i)}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm cursor-grab active:cursor-grabbing hover:border-gray-300">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 text-base">⠿</span>
                  <div>
                    <span className="font-medium text-gray-900">{t.name}</span>
                    <span className="ml-2 text-gray-400 text-xs">{t.file_name} · {t.page_count} pág.</span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await fetch(`/api/proposals/templates?id=${t.id}`, { method: 'DELETE' })
                    setTemplates(prev => prev.filter(x => x.id !== t.id))
                  }}
                  className="text-xs text-gray-400 hover:text-red-500">
                  Remover
                </button>
              </div>

              {/* Botão inserir miolo após esta página */}
              {mioloAfter === t.id ? (
                <div className="flex items-center gap-2 px-3 py-2 mt-1 rounded-lg border-2 border-teal-500 bg-teal-50 text-teal-700 text-xs font-medium">
                  📋 MIOLO (dados do Price entra aqui)
                  <button onClick={() => setMioloAfter(null)} className="ml-auto text-teal-400 hover:text-teal-600">✕</button>
                </div>
              ) : (
                !mioloAfter && i < templates.length - 1 && (
                  <button
                    onClick={() => setMioloAfter(t.id)}
                    className="w-full text-xs text-gray-400 border border-dashed border-gray-200 rounded py-1 mt-1 hover:border-teal-300 hover:text-teal-500">
                    + Inserir miolo aqui
                  </button>
                )
              )}
            </div>
          ))}

          {/* Miolo no final */}
          {mioloAfter === 'end' ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-teal-500 bg-teal-50 text-teal-700 text-xs font-medium">
              📋 MIOLO (dados do Price entra aqui)
              <button onClick={() => setMioloAfter(null)} className="ml-auto text-teal-400 hover:text-teal-600">✕</button>
            </div>
          ) : (
            !mioloAfter && (
              <button
                onClick={() => setMioloAfter('end')}
                className="w-full text-xs text-gray-400 border border-dashed border-gray-200 rounded py-1 hover:border-teal-300 hover:text-teal-500">
                + Inserir miolo aqui (após tudo)
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
