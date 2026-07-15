'use client'

import { useState, useRef, useEffect } from 'react'
import { updateEmailSignature } from '@/lib/actions/email'
import { createClient } from '@/lib/supabase/client'
import { sanitizeStorageFileName } from '@/lib/utils/storage'

export function EmailSignatureForm({ currentSignature }: { currentSignature: string }) {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carrega o conteúdo salvo (com formatação) só uma vez, na primeira
  // renderização — depois disso o contentEditable cuida do próprio
  // estado, sem re-renderizar em cima do que a pessoa está digitando.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = currentSignature || ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleImageUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setUploadingImage(true)
    setUploadError(null)

    const supabase = createClient()
    const storagePath = `signatures/${Date.now()}-${sanitizeStorageFileName(file.name)}`
    const { error: uploadErr } = await supabase.storage.from('proposal-files').upload(storagePath, file)

    if (uploadErr) {
      setUploadError(`Falha no upload: ${uploadErr.message}`)
      setUploadingImage(false)
      return
    }

    // URL pública de verdade — precisa carregar mesmo pra quem abre o
    // e-mail fora do CRM, sem estar logado.
    const publicUrl = `${window.location.origin}/api/email-assets/${storagePath}`

    // Insere a imagem no ponto onde o cursor estava no editor.
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, `<img src="${publicUrl}" style="max-width:300px;display:block" />`)

    setUploadingImage(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSave() {
    setBusy(true)
    setSaved(false)
    const html = editorRef.current?.innerHTML ?? ''
    await updateEmailSignature(html)
    setBusy(false)
    setSaved(true)
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-medium text-gray-900">✍️ Assinatura de e-mail</h3>
      <p className="text-xs text-gray-400">
        Anexada automaticamente no fim de todo e-mail que você enviar pelo CRM. Cole sua assinatura já pronta (mantém formatação, cores e links), ou use o botão abaixo pra subir uma imagem/logo direto.
      </p>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[120px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="text-xs" />
        <button
          type="button"
          onClick={handleImageUpload}
          disabled={uploadingImage}
          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {uploadingImage ? 'Enviando...' : '+ Inserir imagem/logo'}
        </button>
      </div>
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      <button onClick={handleSave} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
        {busy ? 'Salvando...' : 'Salvar assinatura'}
      </button>
      {saved && <span className="ml-2 text-xs text-positive-700">Salvo!</span>}
    </div>
  )
}
