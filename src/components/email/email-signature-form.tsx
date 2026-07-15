'use client'

import { useState, useRef, useEffect } from 'react'
import { updateEmailSignature } from '@/lib/actions/email'

export function EmailSignatureForm({ currentSignature }: { currentSignature: string }) {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  // Carrega o conteúdo salvo (com formatação) só uma vez, na primeira
  // renderização — depois disso o contentEditable cuida do próprio
  // estado, sem re-renderizar em cima do que a pessoa está digitando.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = currentSignature || ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        Anexada automaticamente no fim de todo e-mail que você enviar pelo CRM. <strong>Cole aqui sua assinatura já pronta</strong> (copiada do Gmail, Word, etc.) — a formatação, cores e imagens são mantidas.
      </p>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[120px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
      />
      <button onClick={handleSave} disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
        {busy ? 'Salvando...' : 'Salvar assinatura'}
      </button>
      {saved && <span className="ml-2 text-xs text-positive-700">Salvo!</span>}
    </div>
  )
}
