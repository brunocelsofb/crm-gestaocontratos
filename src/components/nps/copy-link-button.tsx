'use client'

import { useState } from 'react'

export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Alguns navegadores/contextos bloqueiam a Clipboard API (ex: sem
      // HTTPS). Se isso acontecer, o link continua visível na tela pra
      // copiar manualmente — não travamos nada por causa disso.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
    >
      {copied ? 'Copiado!' : 'Copiar link'}
    </button>
  )
}
