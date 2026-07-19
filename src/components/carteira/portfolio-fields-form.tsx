'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Opções de múltipla escolha
const REGIOES = ['Norte', 'Centro-Oeste', 'Sudeste', 'Sul', 'Nordeste']
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const ESFERAS = ['Pública Federal','Pública Estadual','Pública Municipal','Privado','Privado sem fins lucrativos']
const SEGMENTOS = ['Grupo Hospitalar (Geral e especializado)','Grupo Diagnóstico (imagem e laboratório)','Grupo Clínicas e Outros (Prestadores de Serviço / Comércio)']

// Fórmula ABC
// Conta = (Faturamento × 0,5) + (Visibilidade × 0,3) + (Fidelidade × 0,2)
// A ≥ 2,4 · B = 1,6–2,3 · C ≤ 1,5
function calcABC(fat: number, vis: number, fid: number): { weight: number; curve: 'A' | 'B' | 'C' | null } {
  if (!fat || !vis || !fid) return { weight: 0, curve: null }
  const w = fat * 0.5 + vis * 0.3 + fid * 0.2
  const weight = Math.round(w * 100) / 100
  const curve = weight >= 2.4 ? 'A' : weight >= 1.6 ? 'B' : 'C'
  return { weight, curve }
}

// Notas de faturamento por segmento
const FAT_OPTIONS_ENGCLINICA = [
  { value: 1, label: 'Até R$ 20K' },
  { value: 2, label: 'R$ 20K – R$ 60K' },
  { value: 3, label: 'Acima de R$ 60K' },
]
const FAT_OPTIONS_ENGHOSPITALAR = [
  { value: 1, label: 'Até R$ 50K' },
  { value: 2, label: 'R$ 50K – R$ 150K' },
  { value: 3, label: 'Acima de R$ 150K' },
]
const VIS_OPTIONS = [
  { value: 3, label: 'Ótima' },
  { value: 2, label: 'Média' },
  { value: 1, label: 'Indiferente' },
]
const FID_OPTIONS = [
  { value: 3, label: '2+ anos' },
  { value: 2, label: '1–2 anos' },
  { value: 1, label: '0–1 ano' },
]

type PortfolioData = {
  contract_number?: string | null
  sankhya_code?: string | null
  cnpj_billing?: string | null
  contract_type?: string | null
  monthly_value?: number | null
  validity_months?: number | null
  valid_until?: string | null
  engineer_name?: string | null     // nome livre, não FK
  coordinator_name?: string | null  // nome livre, não FK
  abc_curve?: string | null
  sphere?: string | null
  segment?: string | null
  economic_group?: string | null
  nature?: string | null
  region?: string | null
  uf?: string | null
  score_billing?: number | null
  score_visit?: number | null
  score_loyalty?: number | null
  score_weight?: number | null
  has_measurement?: boolean
  has_audit?: boolean
  has_parts?: boolean
  team_type?: string | null
  municipality?: string | null
  state?: string | null
  internal_notes?: string | null
}

function MultiSelect({ options, value, onChange, placeholder }: { options: string[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          style={{ padding: '4px 10px', fontSize: 11, borderRadius: 20, border: '0.5px solid', cursor: 'pointer',
            borderColor: value.includes(opt) ? '#1a1f36' : '#d1d8e8',
            background: value.includes(opt) ? '#1a1f36' : '#fff',
            color: value.includes(opt) ? '#fff' : '#52514e' }}>
          {opt}
        </button>
      ))}
    </div>
  )
}

export function PortfolioFieldsForm({ contractId, initial, contractNature }: {
  contractId: string
  initial: PortfolioData
  contractNature?: string | null  // 'eng_clinica' | 'eng_hospitalar'
}) {
  const router = useRouter()
  const [data, setData] = useState<PortfolioData>(initial)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fatNota, setFatNota] = useState<number>(0)
  const [visNota, setVisNota] = useState<number>(0)
  const [fidNota, setFidNota] = useState<number>(0)

  const { weight, curve } = calcABC(fatNota, visNota, fidNota)

  // Quando as notas mudam, atualiza automaticamente o peso e a curva
  useEffect(() => {
    if (curve) {
      setData(prev => ({ ...prev, score_weight: weight, abc_curve: curve }))
    }
  }, [weight, curve])

  function set(key: keyof PortfolioData, value: any) {
    setData(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function parseMulti(val: string | null | undefined): string[] {
    if (!val) return []
    try { return JSON.parse(val) } catch { return [val] }
  }

  function toMulti(arr: string[]): string {
    return JSON.stringify(arr)
  }

  async function handleSave() {
    setBusy(true); setSaved(false); setError(null)
    try {
      const res = await fetch(`/api/carteira/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, score_billing: fatNota || data.score_billing, score_visit: visNota || data.score_visit, score_loyalty: fidNota || data.score_loyalty }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Erro ao salvar')
      setSaved(true); router.refresh()
    } catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#f8f9fb', color: '#1a1f36', outline: 'none' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }
  const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }
  const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#1a1f36', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', paddingTop: 8 }

  const isHospitalar = contractNature === 'eng_hospitalar' || (data.nature ?? '').toLowerCase().includes('hospitalar')
  const fatOptions = isHospitalar ? FAT_OPTIONS_ENGHOSPITALAR : FAT_OPTIONS_ENGCLINICA

  const ABC_STYLE: Record<string, { bg: string; color: string }> = {
    A: { bg: '#fdecea', color: '#b91c1c' },
    B: { bg: '#fff8e6', color: '#92400e' },
    C: { bg: '#f1f3f8', color: '#52514e' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Identificação */}
      <p style={sectionTitle}>Identificação</p>
      <div style={grid3}>
        <div><label style={labelStyle}>Nº Contrato</label><input style={inputStyle} value={data.contract_number ?? ''} onChange={e => set('contract_number', e.target.value)} placeholder="CT-2024-001" /></div>
        <div><label style={labelStyle}>Cód. Sankhya</label><input style={inputStyle} value={data.sankhya_code ?? ''} onChange={e => set('sankhya_code', e.target.value)} /></div>
        <div><label style={labelStyle}>CNPJ Faturamento</label><input style={inputStyle} value={data.cnpj_billing ?? ''} onChange={e => set('cnpj_billing', e.target.value)} placeholder="00.000.000/0000-00" /></div>
        <div><label style={labelStyle}>Grupo Econômico</label><input style={inputStyle} value={data.economic_group ?? ''} onChange={e => set('economic_group', e.target.value)} placeholder="Ex: Grupo Saúde XYZ" /></div>
      </div>

      {/* Tipo e Valor */}
      <p style={sectionTitle}>Tipo e Valor</p>
      <div style={grid3}>
        <div>
          <label style={labelStyle}>Tipo de Contrato</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={data.contract_type ?? ''} onChange={e => set('contract_type', e.target.value || null)}>
            <option value="">Selecione...</option>
            <option value="fixo">Fixo</option>
            <option value="medicao">Por Medição</option>
          </select>
        </div>
        <div><label style={labelStyle}>Valor Mensal (R$)</label><input style={inputStyle} type="number" value={data.monthly_value ?? ''} onChange={e => set('monthly_value', e.target.value ? Number(e.target.value) : null)} /></div>
        <div><label style={labelStyle}>Vigência (meses)</label><input style={inputStyle} type="number" value={data.validity_months ?? ''} onChange={e => set('validity_months', e.target.value ? Number(e.target.value) : null)} /></div>
        <div><label style={labelStyle}>Data de Vencimento</label><input style={inputStyle} type="date" value={data.valid_until ?? ''} onChange={e => set('valid_until', e.target.value || null)} /></div>
        <div>
          <label style={labelStyle}>Natureza</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={data.nature ?? ''} onChange={e => set('nature', e.target.value || null)}>
            <option value="">Selecione...</option>
            <option value="eng_clinica">Engenharia Clínica</option>
            <option value="eng_hospitalar">Engenharia Hospitalar</option>
          </select>
        </div>
      </div>

      {/* Itens do contrato */}
      <p style={sectionTitle}>Itens do Contrato</p>
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'has_parts', label: '✅ Com peças incluídas' },
          { key: 'has_audit', label: '🔍 Auditoria incluída' },
        ].map(({ key, label }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#52514e', cursor: 'pointer' }}>
            <input type="checkbox" checked={(data as any)[key] ?? false} onChange={e => set(key as keyof PortfolioData, e.target.checked)} />
            {label}
          </label>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 12, color: '#8892a4' }}>Equipe:</label>
          {[{ value: 'fixo_unidade', label: '📍 Fixa na Unidade' }, { value: 'remota', label: '🌐 Remota' }].map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#52514e', cursor: 'pointer' }}>
              <input type="radio" name="team_type" value={opt.value} checked={data.team_type === opt.value} onChange={() => set('team_type', opt.value)} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Responsáveis */}
      <p style={sectionTitle}>Responsáveis</p>
      <div style={grid2}>
        <div><label style={labelStyle}>Coordenador</label><input style={inputStyle} value={data.coordinator_name ?? ''} onChange={e => set('coordinator_name', e.target.value)} placeholder="Nome do coordenador" /></div>
        <div><label style={labelStyle}>Engenheiro</label><input style={inputStyle} value={data.engineer_name ?? ''} onChange={e => set('engineer_name', e.target.value)} placeholder="Nome do engenheiro" /></div>
      </div>

      {/* Localização */}
      <p style={sectionTitle}>Localização</p>
      <div style={{ marginBottom: 12 }}>
        <div style={grid2}>
          <div><label style={labelStyle}>Município</label><input style={inputStyle} value={data.municipality ?? ''} onChange={e => set('municipality', e.target.value)} placeholder="Goiânia" /></div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>UF</label>
          <MultiSelect options={UFS} value={parseMulti(data.uf)} onChange={v => set('uf', toMulti(v))} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Região</label>
          <MultiSelect options={REGIOES} value={parseMulti(data.region)} onChange={v => set('region', toMulti(v))} />
        </div>
      </div>

      {/* Classificação */}
      <p style={sectionTitle}>Classificação</p>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Esfera</label>
        <MultiSelect options={ESFERAS} value={parseMulti(data.sphere)} onChange={v => set('sphere', toMulti(v))} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Segmento</label>
        <MultiSelect options={SEGMENTOS} value={parseMulti(data.segment)} onChange={v => set('segment', toMulti(v))} />
      </div>

      {/* Cálculo ABC */}
      <p style={sectionTitle}>Cálculo da Curva ABC</p>
      <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 16, marginBottom: 16, border: '0.5px solid #e8edf5' }}>
        <p style={{ fontSize: 11, color: '#8892a4', marginBottom: 12 }}>
          Conta = (Faturamento × 0,5) + (Visibilidade × 0,3) + (Fidelidade × 0,2) · <strong>A ≥ 2,4 · B = 1,6–2,3 · C ≤ 1,5</strong>
        </p>
        <div style={grid3}>
          <div>
            <label style={labelStyle}>Faturamento {isHospitalar ? '(Eng. Hospitalar)' : '(Eng. Clínica)'}</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={fatNota} onChange={e => setFatNota(Number(e.target.value))}>
              <option value={0}>Selecione...</option>
              {fatOptions.map(o => <option key={o.value} value={o.value}>{o.label} = {o.value}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Visibilidade</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={visNota} onChange={e => setVisNota(Number(e.target.value))}>
              <option value={0}>Selecione...</option>
              {VIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} = {o.value}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Fidelidade</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={fidNota} onChange={e => setFidNota(Number(e.target.value))}>
              <option value={0}>Selecione...</option>
              {FID_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} = {o.value}</option>)}
            </select>
          </div>
        </div>

        {weight > 0 && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#fff', border: '0.5px solid #e8edf5' }}>
            <p style={{ fontSize: 11, color: '#8892a4', marginBottom: 4 }}>Memória de cálculo</p>
            <p style={{ fontSize: 12, color: '#52514e', fontFamily: 'monospace' }}>
              ({fatNota} × 0,5) + ({visNota} × 0,3) + ({fidNota} × 0,2) = <strong>{weight}</strong>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 12, color: '#52514e' }}>Conta / Peso:</span>
              <strong style={{ fontSize: 15 }}>{weight}</strong>
              <span style={{ fontSize: 12, color: '#8892a4' }}>→</span>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, ...(curve ? ABC_STYLE[curve] : {}) }}>
                Curva {curve}
              </span>
            </div>
          </div>
        )}

        {/* Se não calculou agora, mostra o último salvo */}
        {weight === 0 && data.abc_curve && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#8892a4' }}>Último cálculo:</span>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, ...ABC_STYLE[data.abc_curve] }}>Curva {data.abc_curve}</span>
            {data.score_weight && <span style={{ fontSize: 11, color: '#b0b8c8' }}>Peso {data.score_weight}</span>}
          </div>
        )}
      </div>

      {/* Observação */}
      <p style={sectionTitle}>Observação Interna</p>
      <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical', marginBottom: 16, fontFamily: 'inherit' }}
        value={data.internal_notes ?? ''} onChange={e => set('internal_notes', e.target.value)} placeholder="Notas internas..." />

      {error && <p style={{ fontSize: 12, color: '#b91c1c', marginBottom: 8 }}>{error}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleSave} disabled={busy}
          style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1a1f36', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Salvando...' : 'Salvar dados da carteira'}
        </button>
        {saved && <span style={{ fontSize: 12, color: '#1a7c3e' }}>✅ Salvo</span>}
      </div>
    </div>
  )
}
