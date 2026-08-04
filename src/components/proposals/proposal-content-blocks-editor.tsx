'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addImageBlock, addTableBlock, deleteContentBlock } from '@/lib/actions/proposals'
import { sanitizeStorageFileName } from '@/lib/utils/storage'

type ContentBlock = {
  id: string
  block_type: string
  image_storage_path: string | null
  table_data: { rows: string[][] } | null
  header_color?: string | null
  image_size?: string | null
}

const PRESET_COLORS = [
  { label: 'Orbis', value: '#1B556B' },
  { label: 'Verde', value: '#1a7c3e' },
  { label: 'Cinza', value: '#374151' },
  { label: 'Azul', value: '#1e40af' },
  { label: 'Preto', value: '#111827' },
]

const IMAGE_SIZES = [
  { label: 'Pequena', value: 'small', w: 200 },
  { label: 'Média', value: 'medium', w: 350 },
  { label: 'Grande', value: 'large', w: 500 },
  { label: 'Total', value: 'full', w: 0 },
]

export function ProposalContentBlocksEditor({
  proposalId, contractId, initialBlocks, canEdit,
}: {
  proposalId: string
  contractId: string
  initialBlocks: ContentBlock[]
  canEdit: boolean
}) {
  const [blocks, setBlocks] = useState(initialBlocks)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableRows, setTableRows] = useState<string[][]>([['', ''], ['', '']])
  const [headerColor, setHeaderColor] = useState('#1B556B')
  const [imageSize, setImageSize] = useState('medium')
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
      setBlocks(prev => [...prev, { id: crypto.randomUUID(), block_type: 'image', image_storage_path: storagePath, table_data: null, image_size: imageSize }])
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
    const result = await addTableBlock(proposalId, contractId, tableRows, headerColor)
    if (result.error) { setError(result.error) }
    else {
      setBlocks(prev => [...prev, { id: crypto.randomUUID(), block_type: 'table', image_storage_path: null, table_data: { rows: tableRows }, header_color: headerColor }])
      setTableRows([['', ''], ['', '']])
    }
  }

  async function handleDelete(blockId: string) {
    setBlocks(prev => prev.filter(b => b.id !== blockId))
    await deleteContentBlock(blockId, contractId, proposalId)
  }

  const inp = 'rounded-md border border-gray-300 px-2 py-1 text-xs'

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-gray-900">Conteúdo extra (imagens e tabelas)</h2>
      <p className="text-xs text-gray-400">Entram na página de dados da proposta, depois dos itens.</p>

      <div className="space-y-2">
        {blocks.map(b => (
          <div key={b.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <span className="text-gray-700">
              {b.block_type === 'image' ? '🖼️ Imagem' : '▦ Tabela'}
              {b.block_type === 'table' && b.table_data ? ` (${b.table_data.rows.length}×${b.table_data.rows[0]?.length ?? 0})` : ''}
              {b.block_type === 'image' && b.image_size ? ` · ${IMAGE_SIZES.find(s => s.value === b.image_size)?.label ?? b.image_size}` : ''}
              {b.block_type === 'table' && b.header_color ? (
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: b.header_color, marginLeft: 6, verticalAlign: 'middle' }} />
              ) : null}
            </span>
            {canEdit && (
              <button onClick={() => handleDelete(b.id)} className="text-xs text-negative-600 hover:underline">Remover</button>
            )}
          </div>
        ))}
      </div>

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
              <div className="flex gap-1 flex-wrap">
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
              <button onClick={handleAddTable} className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800">
                Adicionar tabela
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-negative-600">{error}</p>}
    </div>
  )
}
