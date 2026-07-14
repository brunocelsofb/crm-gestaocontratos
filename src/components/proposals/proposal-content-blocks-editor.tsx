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
}

export function ProposalContentBlocksEditor({
  proposalId,
  contractId,
  initialBlocks,
  canEdit,
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAddImage() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setUploadingImage(true)
    setError(null)

    const supabase = createClient()
    const storagePath = `proposal-content/${proposalId}/${Date.now()}-${sanitizeStorageFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from('proposal-files').upload(storagePath, file)

    if (uploadError) {
      setError(`Falha no upload: ${uploadError.message}`)
      setUploadingImage(false)
      return
    }

    const result = await addImageBlock(proposalId, contractId, storagePath)
    setUploadingImage(false)
    if (result.error) {
      setError(result.error)
    } else {
      setBlocks((prev) => [...prev, { id: crypto.randomUUID(), block_type: 'image', image_storage_path: storagePath, table_data: null }])
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function updateCell(r: number, c: number, value: string) {
    setTableRows((prev) => prev.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row)))
  }

  function addRow() {
    setTableRows((prev) => [...prev, prev[0].map(() => '')])
  }
  function addCol() {
    setTableRows((prev) => prev.map((row) => [...row, '']))
  }

  async function handleAddTable() {
    setError(null)
    const result = await addTableBlock(proposalId, contractId, tableRows)
    if (result.error) {
      setError(result.error)
    } else {
      setBlocks((prev) => [...prev, { id: crypto.randomUUID(), block_type: 'table', image_storage_path: null, table_data: { rows: tableRows } }])
      setTableRows([['', ''], ['', '']])
    }
  }

  async function handleDelete(blockId: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
    await deleteContentBlock(blockId, contractId, proposalId)
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-gray-900">Conteúdo extra (imagens e tabelas)</h2>
      <p className="text-xs text-gray-400">Entram na página de dados da proposta, depois dos itens — não precisa ser uma capa fixa pra incluir uma imagem ou tabela.</p>

      <div className="space-y-2">
        {blocks.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <span className="text-gray-700">
              {b.block_type === 'image' ? '🖼️ Imagem' : '▦ Tabela'} {b.block_type === 'table' && b.table_data ? `(${b.table_data.rows.length}×${b.table_data.rows[0]?.length ?? 0})` : ''}
            </span>
            {canEdit && (
              <button onClick={() => handleDelete(b.id)} className="text-xs text-negative-600 hover:underline">
                Remover
              </button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3">
            <p className="text-xs font-medium text-gray-700">+ Adicionar imagem</p>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="mt-2 text-xs" />
            <button
              onClick={handleAddImage}
              disabled={uploadingImage}
              className="mt-2 rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {uploadingImage ? 'Enviando...' : 'Adicionar imagem'}
            </button>
          </div>

          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3">
            <p className="text-xs font-medium text-gray-700">+ Adicionar tabela</p>
            <div className="mt-2 space-y-1">
              {tableRows.map((row, ri) => (
                <div key={ri} className="flex gap-1">
                  {row.map((cell, ci) => (
                    <input
                      key={ci}
                      value={cell}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      className="w-16 rounded border border-gray-300 px-1 py-0.5 text-xs"
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1">
              <button onClick={addRow} className="text-[10px] text-brand-700 hover:underline">+ linha</button>
              <button onClick={addCol} className="text-[10px] text-brand-700 hover:underline">+ coluna</button>
            </div>
            <button
              onClick={handleAddTable}
              className="mt-2 rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800"
            >
              Adicionar tabela
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
