'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

// Client-side: chama API route para setar tag
export function CompanyTagSelect({ companyId, currentTagId, tags }: {
  companyId: string
  currentTagId: string | null
  tags: { id: string; name: string; color: string }[]
}) {
  const router = useRouter()
  const [value, setValue] = useState(currentTagId ?? '')
  const [busy, setBusy] = useState(false)

  async function handleChange(tagId: string) {
    setValue(tagId)
    setBusy(true)
    await fetch(`/api/companies/${companyId}/tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId || null }),
    })
    setBusy(false)
    router.refresh()
  }

  const current = tags.find(t => t.id === value)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {current && (
        <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, color: '#fff', background: current.color }}>
          {current.name}
        </span>
      )}
      <select value={value} onChange={e => handleChange(e.target.value)} disabled={busy}
        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
        <option value="">Sem tag</option>
        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </div>
  )
}
