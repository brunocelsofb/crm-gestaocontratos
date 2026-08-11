'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Tag = { id: string; name: string; color: string }

export function ContractTagSelect({
  tags,
  currentTagIds,
  contractId,
}: {
  tags: Tag[]
  currentTagIds: string[]
  contractId: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(currentTagIds)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function toggle(tagId: string) {
    const next = selected.includes(tagId)
      ? selected.filter(id => id !== tagId)
      : [...selected, tagId]
    setSelected(next)
    setSaving(true)
    await fetch(`/api/contracts/${contractId}/tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_ids: next }),
    })
    setSaving(false)
    router.refresh()
  }

  const selectedTags = tags.filter(t => selected.includes(t.id))
  const MAX_VISIBLE = 2

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {/* Badges das tags selecionadas */}
      {selectedTags.length === 0 ? (
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
            background: '#f1f3f8', color: '#8892a4', border: 'none', cursor: 'pointer',
          }}>
          + Tag
        </button>
      ) : (
        <>
          {selectedTags.slice(0, MAX_VISIBLE).map(t => (
            <button
              key={t.id}
              onClick={() => setOpen(o => !o)}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: t.color, color: '#fff', border: 'none', cursor: 'pointer',
                opacity: saving ? 0.7 : 1,
              }}>
              {t.name}
            </button>
          ))}
          {selectedTags.length > MAX_VISIBLE && (
            <button
              onClick={() => setOpen(o => !o)}
              style={{
                padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: '#e8edf5', color: '#52514e', border: 'none', cursor: 'pointer',
              }}>
              +{selectedTags.length - MAX_VISIBLE}
            </button>
          )}
        </>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 999,
          background: '#fff', borderRadius: 10, border: '0.5px solid #e8edf5',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 180, overflow: 'hidden',
        }}>
          {tags.length === 0 && (
            <p style={{ fontSize: 12, color: '#b0b8c8', padding: '10px 14px' }}>Nenhuma tag cadastrada</p>
          )}
          {tags.map(t => {
            const isSelected = selected.includes(t.id)
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '9px 14px', fontSize: 12, fontWeight: 500,
                  background: isSelected ? '#f8f9fb' : '#fff',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}>
                <span style={{
                  width: 12, height: 12, borderRadius: '50%', background: t.color,
                  flexShrink: 0, border: isSelected ? '2px solid #1B556B' : '2px solid transparent',
                }} />
                <span style={{ flex: 1, color: '#1a1f36' }}>{t.name}</span>
                {isSelected && <span style={{ color: '#1B556B', fontSize: 14 }}>✓</span>}
              </button>
            )
          })}
          {selectedTags.length > 0 && (
            <>
              <div style={{ height: '0.5px', background: '#f1f3f8' }} />
              <button
                onClick={() => { setSelected([]); toggle('__clear__') }}
                style={{
                  display: 'block', width: '100%', padding: '8px 14px', fontSize: 11,
                  color: '#b0b8c8', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}>
                Limpar seleção
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
