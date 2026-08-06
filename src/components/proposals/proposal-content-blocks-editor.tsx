'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addImageBlock, addTableBlock, deleteContentBlock, updateBlockIntroduction } from '@/lib/actions/proposals'
import { sanitizeStorageFileName } from '@/lib/utils/storage'

type ContentBlock = {
  id: string
  block_type: string
  image_storage_path: string | null
  table_data: { rows: string[][] } | null
  header_color?: string | null
  image_size?: string | null
  introduction?: string | null
}

const PRESET_COLORS = [
  { label: 'Orbis', value: '#1B556B' },
  { label: 'Verde', value: '#1a7c3e' },
  { label: 'Cinza', value: '#374151' },
  { label: 'Azul', value: '#1e40af' },
  { label: 'Preto', value: '#111827' },
]

const IMAGE_SIZES = [
  { label: 'Pequena', value: 'small' },
  { label: 'Média', value: 'medium' },
  { label: 'Grande', value: 'large' },
  { label: 'Total', value: 'full' },
]

export function ProposalContentBlocksEditor({
  proposalId, contractId, initialBlocks, canEdit,
}: {
  proposalId: string
  contractId: string
  initialBlocks: ContentBlock[]
  canEdit: boolean
}) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialBlocks)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableRows, setTableRows] = useState<string[][]>([['', ''], ['', '']])
  const [headerColor, setHeaderColor] = useState('#1B556B')
  const [imageSize, setImageSize] = useState('medium')
  const [showTotals, setShowTotals] = useState(false)
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left')
  const [savingIntro, setSavingIntro] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAddImage() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setUploadingImage(true); setError(null)
    const supabase = createClient()
    const storagePath = `proposal-content/${proposalId}/${Date.now()}-${sanitizeStorageFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from('proposal-files').upload(storagePath, file)
    if (uploadError) { setError(`Falha no upload: ${uploadError.message}`); setUploadingImage(false); return }
    const result = await addImageBlock(proposalId, contractId, storagePath, imageSize)
    setUploadingImage(false)
    if (result.error) { setError(result.error) }
    else {
      setBlocks(prev => [...prev, { id: result.id ?? crypto.randomUUID(), block_type: 'image', image_storage_path: storagePath, table_data: null, image_size: imageSize, introduction: null }])
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function updateCell(r: number, c: number, value: string) {
    setTableRows(prev => prev.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? value : cell) : row))
  }
  function addRow() { setTableRows(prev => [...prev, prev[0].map(() => '')]) }
  function addCol() { setTableRows(prev => prev.map(row => [...row, ''])) }

  async function handleAddTable() {
    setError(null)
    const result = await addTableBlock(proposalId, contractId, tableRows, headerColor, showTotals, textAlign)
    if (result.error) { setError(result.error) }
    else {
      setBlocks(prev => [...prev, { id: result.id ?? crypto.randomUUID(), block_type: 'table', image_storage_path: null, table_data: { rows: tableRows }, header_color: headerColor, introduction: null }])
      setTableRows([['', ''], ['', '']])
    }
  }

  async function handleDelete(blockId: string) {
    setBlocks(prev => prev.filter(b => b.id !== blockId))
    await deleteContentBlock(blockId, contractId, proposalId)
  }

  async function saveIntro(blockId: string, intro: string) {
    setSavingIntro(blockId)
    await updateBlockIntroduction(blockId, intro)
    setSavingIntro(null)
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, introduction: intro } : b))
  }

  const inp = 'border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-700'

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-gray-900">Conteúdo extra (imagens e tabelas)</h2>
        <p className="text-xs text-gray-400 mt-0.5">Cada item pode ter um texto de introdução que aparece antes dele no PDF.</p>
      </div>

      {/* Lista dinâmica de blocks com introdução */}
      <div className="space-y-4">
        {blocks.map((b, idx) => (
          <div key={b.id} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            {/* Header do block */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {b.block_type === 'image' ? `🖼️ Imagem ${blocks.filter(x => x.block_type === 'image').indexOf(b) + 1}` : `▦ Tabela ${blocks.filter(x => x.block_type === 'table').indexOf(b) + 1}`}
                {b.block_type === 'image' && b.image_size ? ` · ${IMAGE_SIZES.find(s => s.value === b.image_size)?.label}` : ''}
              </span>
              {canEdit && (
                <button onClick={() => handleDelete(b.id)} className="text-xs text-gray-400 hover:text-red-500">🗑️ Remover</button>
              )}
            </div>

            {/* Campo de introdução */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Texto de introdução para este item</label>
              <div className="flex gap-2">
                <textarea
                  defaultValue={b.introduction ?? ''}
                  onBlur={e => saveIntro(b.id, e.target.value)}
                  rows={2}
                  placeholder="Digite o contexto ou introdução para este item..."
                  disabled={!canEdit}
                  className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-brand-700 resize-none disabled:bg-gray-50"
                />
                {savingIntro === b.id && <span className="text-xs text-gray-400 self-center">Salvando...</span>}
              </div>
            </div>

            {/* Preview do block */}
            {b.block_type === 'table' && b.table_data && (
              <div className="overflow-x-auto rounded border border-gray-100">
                <table className="text-xs border-collapse w-full">
                  {b.table_data.rows.map((row, r) => (
                    <tr key={r} style={{ background: r === 0 ? (b.header_color ?? '#1B556B') : r % 2 === 0 ? '#f9fafb' : '#fff' }}>
                      {row.map((cell, c) => (
                        <td key={c} className="border border-gray-100 px-2 py-1"
                          style={{ color: r === 0 ? '#fff' : '#111', fontWeight: r === 0 ? 600 : 400 }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </table>
              </div>
            )}
            {b.block_type === 'image' && b.image_storage_path && (
              <p className="text-xs text-gray-400">📎 {b.image_storage_path.split('/').pop()}</p>
            )}
          </div>
        ))}
      </div>

      {/* Formulários de adição */}
      {canEdit && (
        <div className="grid grid-cols-2 gap-3">
          {/* Imagem */}
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3 space-y-2">
            <p className="text-xs font-medium text-gray-700">+ Adicionar imagem</p>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="text-xs" />
            <div>
              <p className="text-xs text-gray-500 mb-1">Tamanho:</p>
              <div className="flex gap-1 flex-wrap">
                {IMAGE_SIZES.map(s => (
                  <button key={s.value} onClick={() => setImageSize(s.value)}
                    className={`px-2 py-0.5 text-xs rounded border ${imageSize === s.value ? 'bg-brand-700 text-white border-brand-700' : 'border-gray-300 text-gray-600'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleAddImage} disabled={uploadingImage}
              className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50">
              {uploadingImage ? 'Enviando...' : 'Adicionar imagem'}
            </button>
          </div>

          {/* Tabela */}
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3 space-y-2">
            <p className="text-xs font-medium text-gray-700">+ Adicionar tabela</p>
            <div>
              <p className="text-xs text-gray-500 mb-1">Cor do cabeçalho:</p>
              <div className="flex gap-1 flex-wrap items-center">
                {PRESET_COLORS.map(c => (
                  <button key={c.value} onClick={() => setHeaderColor(c.value)} title={c.label}
                    style={{ width: 20, height: 20, borderRadius: 4, background: c.value, border: headerColor === c.value ? '2px solid #000' : '2px solid transparent' }} />
                ))}
                <input type="color" value={headerColor} onChange={e => setHeaderColor(e.target.value)}
                  style={{ width: 20, height: 20, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 4 }} title="Personalizado" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                {tableRows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} className="border border-gray-200 p-0.5">
                        <input value={cell} onChange={e => updateCell(r, c, e.target.value)}
                          className="w-16 px-1 py-0.5 outline-none text-xs"
                          style={{ background: r === 0 ? headerColor + '22' : '#fff' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </table>
            </div>
            <div className="flex gap-2">
              <button onClick={addRow} className={inp}>+ Linha</button>
              <button onClick={addCol} className={inp}>+ Coluna</button>
            </div>
            {/* Alinhamento */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Alinhamento:</p>
              <div className="flex gap-1">
                {(['left','center','right'] as const).map(a => (
                  <button key={a} onClick={() => setTextAlign(a)}
                    className={`px-2 py-0.5 text-xs rounded border ${textAlign === a ? 'bg-brand-700 text-white border-brand-700' : 'border-gray-300 text-gray-600'}`}>
                    {a === 'left' ? '⬅ Esq' : a === 'center' ? '↔ Centro' : '➡ Dir'}
                  </button>
                ))}
              </div>
            </div>
            {/* Linha de total */}
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showTotals} onChange={e => setShowTotals(e.target.checked)} className="rounded" />
              Adicionar linha de total (soma automática de colunas numéricas)
            </label>
            <button onClick={handleAddTable} className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800">
              Adicionar tabela
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
