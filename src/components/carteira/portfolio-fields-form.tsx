'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Profile = { id: string; full_name: string }

type PortfolioData = {
  contract_number?: string | null
  sankhya_code?: string | null
  cnpj_billing?: string | null
  contract_type?: string | null
  monthly_value?: number | null
  validity_months?: number | null
  valid_until?: string | null
  engineer_id?: string | null
  coordinator_id?: string | null
  abc_curve?: string | null
  sphere?: string | null
  nature?: string | null
  region?: string | null
  score_billing?: number | null
  score_visit?: number | null
  score_loyalty?: number | null
  has_measurement?: boolean
  has_audit?: boolean
  has_management_plan?: boolean
  has_parts_included?: boolean
  municipality?: string | null
  state?: string | null
  internal_notes?: string | null
}

export function PortfolioFieldsForm({
  contractId,
  initial,
  profiles,
}: {
  contractId: string
  initial: PortfolioData
  profiles: Profile[]
}) {
  const router = useRouter()
  const [data, setData] = useState<PortfolioData>(initial)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: keyof PortfolioData, value: any) {
    setData(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setBusy(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch(`/api/carteira/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Erro ao salvar')
      setSaved(true)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const inputStyle = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#f8f9fb', color: '#1a1f36', outline: 'none' }
  const labelStyle = { display: 'block', fontSize: 10, color: '#8892a4', textTransform: 'uppercase' as const, letterSpacing: '0.7px', marginBottom: 4 }
  const sectionStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Identificação */}
      <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1f36', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Identificação</p>
      <div style={sectionStyle}>
        <div>
          <label style={labelStyle}>Nº Contrato</label>
          <input style={inputStyle} value={data.contract_number ?? ''} onChange={e => set('contract_number', e.target.value)} placeholder="Ex: CT-2024-001" />
        </div>
        <div>
          <label style={labelStyle}>Cód. Sankhya</label>
          <input style={inputStyle} value={data.sankhya_code ?? ''} onChange={e => set('sankhya_code', e.target.value)} placeholder="Código no Sankhya" />
        </div>
        <div>
          <label style={labelStyle}>CNPJ Faturamento</label>
          <input style={inputStyle} value={data.cnpj_billing ?? ''} onChange={e => set('cnpj_billing', e.target.value)} placeholder="00.000.000/0000-00" />
        </div>
      </div>

      {/* Tipo e Valor */}
      <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1f36', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo e Valor</p>
      <div style={sectionStyle}>
        <div>
          <label style={labelStyle}>Tipo de Contrato</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={data.contract_type ?? ''} onChange={e => set('contract_type', e.target.value || null)}>
            <option value="">Selecione...</option>
            <option value="fixo">Fixo</option>
            <option value="medicao">Por Medição</option>
            <option value="avanco_obra">Avanço de Obra</option>
            <option value="spot">Spot</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Valor Mensal (R$)</label>
          <input style={inputStyle} type="number" value={data.monthly_value ?? ''} onChange={e => set('monthly_value', e.target.value ? Number(e.target.value) : null)} placeholder="0,00" />
        </div>
        <div>
          <label style={labelStyle}>Vigência (meses)</label>
          <input style={inputStyle} type="number" value={data.validity_months ?? ''} onChange={e => set('validity_months', e.target.value ? Number(e.target.value) : null)} placeholder="12" />
        </div>
        <div>
          <label style={labelStyle}>Data de Vencimento</label>
          <input style={inputStyle} type="date" value={data.valid_until ?? ''} onChange={e => set('valid_until', e.target.value || null)} />
        </div>
        <div>
          <label style={labelStyle}>Curva ABC</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={data.abc_curve ?? ''} onChange={e => set('abc_curve', e.target.value || null)}>
            <option value="">Selecione...</option>
            <option value="A">A — Alta prioridade</option>
            <option value="B">B — Média prioridade</option>
            <option value="C">C — Baixa prioridade</option>
          </select>
        </div>
      </div>

      {/* Responsáveis */}
      <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1f36', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Responsáveis</p>
      <div style={{ ...sectionStyle, gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <label style={labelStyle}>Coordenador</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={data.coordinator_id ?? ''} onChange={e => set('coordinator_id', e.target.value || null)}>
            <option value="">Selecione...</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Engenheiro</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={data.engineer_id ?? ''} onChange={e => set('engineer_id', e.target.value || null)}>
            <option value="">Selecione...</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Localização e Classificação */}
      <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1f36', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Localização e Classificação</p>
      <div style={sectionStyle}>
        <div>
          <label style={labelStyle}>Município</label>
          <input style={inputStyle} value={data.municipality ?? ''} onChange={e => set('municipality', e.target.value)} placeholder="Goiânia" />
        </div>
        <div>
          <label style={labelStyle}>UF</label>
          <input style={inputStyle} value={data.state ?? ''} onChange={e => set('state', e.target.value)} placeholder="GO" maxLength={2} />
        </div>
        <div>
          <label style={labelStyle}>Região</label>
          <input style={inputStyle} value={data.region ?? ''} onChange={e => set('region', e.target.value)} placeholder="Centro-Oeste" />
        </div>
        <div>
          <label style={labelStyle}>Esfera</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={data.sphere ?? ''} onChange={e => set('sphere', e.target.value || null)}>
            <option value="">Selecione...</option>
            <option value="federal">Federal</option>
            <option value="estadual">Estadual</option>
            <option value="municipal">Municipal</option>
            <option value="privado">Privado</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Natureza</label>
          <input style={inputStyle} value={data.nature ?? ''} onChange={e => set('nature', e.target.value)} placeholder="Manutenção, Obra..." />
        </div>
      </div>

      {/* Notas de saúde */}
      <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1f36', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notas de Saúde (0–10)</p>
      <div style={{ ...sectionStyle, gridTemplateColumns: '1fr 1fr 1fr' }}>
        {[
          { key: 'score_billing', label: 'Nota Faturamento' },
          { key: 'score_visit', label: 'Nota Visita' },
          { key: 'score_loyalty', label: 'Nota Fidelidade' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label style={labelStyle}>{label}</label>
            <input style={inputStyle} type="number" min="0" max="10" step="0.1"
              value={(data as any)[key] ?? ''}
              onChange={e => set(key as keyof PortfolioData, e.target.value ? Number(e.target.value) : null)}
              placeholder="0–10" />
          </div>
        ))}
      </div>

      {/* Checklist */}
      <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1f36', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Itens do Contrato</p>
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'has_measurement', label: 'Medição incluída' },
          { key: 'has_audit', label: 'Auditoria incluída' },
          { key: 'has_management_plan', label: 'Plano Gerencial' },
          { key: 'has_parts_included', label: 'Peças incluídas' },
        ].map(({ key, label }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#52514e', cursor: 'pointer' }}>
            <input type="checkbox" checked={(data as any)[key] ?? false}
              onChange={e => set(key as keyof PortfolioData, e.target.checked)} />
            {label}
          </label>
        ))}
      </div>

      {/* Observação */}
      <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1f36', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Observação Interna</p>
      <textarea
        style={{ ...inputStyle, minHeight: 72, resize: 'vertical', marginBottom: 16, fontFamily: 'inherit' }}
        value={data.internal_notes ?? ''}
        onChange={e => set('internal_notes', e.target.value)}
        placeholder="Notas internas sobre o contrato..." />

      {error && <p style={{ fontSize: 12, color: '#b91c1c', marginBottom: 8 }}>{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleSave} disabled={busy}
          style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1a1f36', color: '#fff', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Salvando...' : 'Salvar dados da carteira'}
        </button>
        {saved && <span style={{ fontSize: 12, color: '#1a7c3e' }}>✅ Salvo com sucesso</span>}
      </div>
    </div>
  )
}
