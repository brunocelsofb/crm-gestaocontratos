'use client'

// NOTA DE INCERTEZA: o upload vai direto do navegador pro Supabase
// Storage (supabase.storage.from(...).upload(...)), em vez de passar
// pelo nosso servidor — isso evita limite de tamanho de Server Action,
// mas é a parte que eu tenho menos confiança de ter acertado de primeira
// (não tive como testar com um arquivo real). Se o upload falhar, me
// mande a mensagem de erro exata que aparecer.

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { registerContractFile, deleteContractFile, getFileDownloadUrl } from '@/lib/actions/files'

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
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const supabase = createClient()
    // Caminho único por contrato + timestamp, pra evitar colisão de nomes
    const storagePath = `${contractId}/${Date.now()}-${file.name}`

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
              <div>
                <button onClick={() => handleDownload(f.storage_path)} className="font-medium text-brand-700 hover:underline">
                  {f.file_name}
                </button>
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
