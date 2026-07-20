'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NoteForm({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    if (!text.trim()) return
    setBusy(true)
    await fetch(`/api/companies/${companyId}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'note', content: text.trim() }),
    })
    setText('')
    setBusy(false)
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={2}
        placeholder="Registrar nota, ligação, visita..."
        style={{ flex: 1, padding: '7px 10px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#f8f9fb', color: '#1a1f36', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
      <button onClick={handleSubmit} disabled={busy || !text.trim()}
        style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, border: 'none', background: '#1a1f36', color: '#fff', cursor: 'pointer', alignSelf: 'flex-start', opacity: !text.trim() ? 0.4 : 1 }}>
        {busy ? '...' : 'Registrar'}
      </button>
    </div>
  )
}
