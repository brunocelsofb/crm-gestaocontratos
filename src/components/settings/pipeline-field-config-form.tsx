'use client'

import { useState } from 'react'
import { savePipelineFieldConfigs } from '@/lib/actions/pipeline-field-config'
import type { PipelineFieldConfig, FieldVisibility } from '@/lib/pipeline-field-config'

const VISIBILITY_OPTIONS: { value: FieldVisibility; label: string; color: string; bg: string }[] = [
  { value: 'required', label: 'Obrigatório', color: '#b91c1c', bg: '#fdecea' },
  { value: 'optional', label: 'Opcional',    color: '#3b5bdb', bg: '#eef3ff' },
  { value: 'hidden',   label: 'Oculto',      color: '#8892a4', bg: '#f1f3f8' },
]

// Campos que nunca podem ser ocultos ou removidos
const ALWAYS_REQUIRED = ['title']

export function PipelineFieldConfigForm({
  pipelineId,
  initialConfigs,
}: {
  pipelineId: string
  initialConfigs: PipelineFieldConfig[]
}) {
  const [configs, setConfigs] = useState<PipelineFieldConfig[]>(initialConfigs)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setVisibility(fieldKey: string, visibility: FieldVisibility) {
    if (ALWAYS_REQUIRED.includes(fieldKey)) return
    setConfigs(prev => prev.map(c => c.field_key === fieldKey ? { ...c, visibility } : c))
    setSaved(false)
  }

  async function handleSave() {
    setBusy(true)
    setSaved(false)
    setError(null)
    const result = await savePipelineFieldConfigs(pipelineId, configs)
    setBusy(false)
    if (result.error) setError(result.error)
    else setSaved(true)
  }

  const required = configs.filter(c => c.visibility === 'required')
  const optional = configs.filter(c => c.visibility === 'optional')
  const hidden = configs.filter(c => c.visibility === 'hidden')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {VISIBILITY_OPTIONS.map(v => (
          <span key={v.value} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 10px', borderRadius: 20, background: v.bg, color: v.color }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: v.color }} />
            {v.label}
          </span>
        ))}
        <span style={{ fontSize: 11, color: '#8892a4', alignSelf: 'center' }}>— Clique no badge pra alternar</span>
      </div>

      {/* Tabela de campos */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Campo', 'Visibilidade', ''].map((h, i) => (
                <th key={h + i} style={{ padding: '10px 16px', fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 500, textAlign: 'left', borderBottom: '0.5px solid #f1f3f8' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {configs.map(c => {
              const vis = VISIBILITY_OPTIONS.find(v => v.value === c.visibility)!
              const locked = ALWAYS_REQUIRED.includes(c.field_key)
              return (
                <tr key={c.field_key} style={{ borderBottom: '0.5px solid #f8f9fb', opacity: c.visibility === 'hidden' ? 0.5 : 1 }}>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>{c.field_label}</p>
                    <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#b0b8c8', marginTop: 2 }}>{c.field_key}</p>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: vis.bg, color: vis.color, cursor: locked ? 'not-allowed' : 'pointer' }}
                      onClick={() => {
                        if (locked) return
                        const opts: FieldVisibility[] = ['required', 'optional', 'hidden']
                        const next = opts[(opts.indexOf(c.visibility) + 1) % opts.length]
                        setVisibility(c.field_key, next)
                      }}>
                      {vis.label}
                      {locked && ' 🔒'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', display: 'flex', gap: 4 }}>
                    {VISIBILITY_OPTIONS.map(v => (
                      <button key={v.value} onClick={() => setVisibility(c.field_key, v.value)} disabled={locked}
                        style={{ padding: '3px 8px', fontSize: 10, borderRadius: 6, border: '0.5px solid', cursor: locked ? 'not-allowed' : 'pointer', borderColor: c.visibility === v.value ? v.color : '#e8edf5', background: c.visibility === v.value ? v.bg : '#fff', color: c.visibility === v.value ? v.color : '#b0b8c8', fontWeight: c.visibility === v.value ? 600 : 400 }}>
                        {v.label}
                      </button>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Resumo */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#8892a4' }}>
        <span>🔴 {required.length} obrigatório{required.length !== 1 ? 's' : ''}</span>
        <span>🔵 {optional.length} opcional{optional.length !== 1 ? 'is' : ''}</span>
        <span>⚫ {hidden.length} oculto{hidden.length !== 1 ? 's' : ''}</span>
      </div>

      {error && <p style={{ fontSize: 12, color: '#b91c1c' }}>{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleSave} disabled={busy}
          style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1a1f36', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Salvando...' : 'Salvar configuração'}
        </button>
        {saved && <span style={{ fontSize: 12, color: '#1a7c3e' }}>✅ Configuração salva — o formulário de nova oportunidade já reflete as mudanças</span>}
      </div>
    </div>
  )
}
