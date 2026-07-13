'use client'

// NOTA DE INCERTEZA: o upload vai direto do navegador pro Supabase
// Storage (supabase.storage.from(...).upload(...)), em vez de passar
// pelo nosso servidor — isso evita limite de tamanho de Server Action,
// mas é a parte que eu tenho menos confiança de ter acertado de primeira
// (não tive como testar com um arquivo real). Se o upload falhar, me
// mande a mensagem de erro exata que aparecer.

import { useState, useRef } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { registerContractFile, deleteContractFile, getFileDownloadUrl, renameContractFile } from '@/lib/actions/files'
import { sanitizeStorageFileName } from '@/lib/utils/storage'

type ContractFile = {
  id: string
  file_name: string
  storage_path: string
  file_size: number | null
  mime_type: string | null
  created_at: string
}

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FilesSection({ contractId, initialFiles }: { contractId: string; initialFiles: ContractFile[] }) {
  const [files, setFiles] = useState(initialFiles)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEditing(f: ContractFile) {
    setEditingId(f.id)
    setEditValue(f.file_name)
  }

  async function saveRename(fileId: string) {
    const newName = editValue.trim()
    if (!newName) {
      setError('O nome não pode ficar vazio.')
      return
    }
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, file_name: newName } : f)))
    setEditingId(null)
    const result = await renameContractFile(fileId, contractId, newName)
    if (result && 'error' in result) setError(result.error ?? 'Falha ao renomear.')
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const supabase = createClient()
    // Caminho único por contrato + timestamp, pra evitar colisão de nomes
    const storagePath = `${contractId}/${Date.now()}-${sanitizeStorageFileName(file.name)}`

    const { error: uploadError } = await supabase.storage
      .from('contract-files')
      .upload(storagePath, file)

    if (uploadError) {
      setError(`Falha no upload: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const result = await registerContractFile(contractId, file.name, storagePath, file.size, file.type)

    if ('error' in result) {
      setError(result.error ?? 'Falha ao registrar o arquivo.')
      setUploading(false)
      return
    }

    setFiles((prev) => [
      { id: crypto.randomUUID(), file_name: file.name, storage_path: storagePath, file_size: file.size, mime_type: file.type, created_at: new Date().toISOString() },
      ...prev,
    ])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleDownload(storagePath: string) {
    const result = await getFileDownloadUrl(storagePath)
    if ('error' in result) {
      setError(result.error ?? 'Falha ao gerar link de download.')
      return
    }
    window.open(result.url, '_blank')
  }

  async function handleDelete(fileId: string, storagePath: string) {
    if (!confirm('Remover este arquivo?')) return
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    await deleteContractFile(fileId, contractId, storagePath)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">Arquivos</h2>
        <label className="cursor-pointer rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800">
          {uploading ? 'Enviando...' : '+ Anexar arquivo'}
          <input ref={inputRef} type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {files.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum arquivo anexado ainda.</p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm">
              <div className="flex-1">
                {editingId === f.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(f.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1 rounded-md border border-brand-700 px-2 py-1 text-sm focus:outline-none"
                    />
                    <button onClick={() => saveRename(f.id)} className="text-positive-600 hover:text-positive-700" title="Salvar">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600" title="Cancelar">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleDownload(f.storage_path)} className="font-medium text-brand-700 hover:underline">
                      {f.file_name}
                    </button>
                    <button onClick={() => startEditing(f)} className="text-gray-300 hover:text-gray-600" title="Renomear">
                      <Pencil size={13} />
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  {fmtSize(f.file_size)} · {new Date(f.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button onClick={() => handleDelete(f.id, f.storage_path)} className="text-xs text-gray-400 hover:text-negative-600">
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
