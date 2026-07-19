import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CarteiraSelectFilters } from '@/components/carteira/carteira-select-filters'

const TYPE_LABEL: Record<string, string> = { fixo: 'Fixo', medicao: 'Por Medição', avanco_obra: 'Avanço Obra', spot: 'Spot' }
const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  fixo:       { bg: '#eaf5ee', color: '#1a7c3e' },
  medicao:    { bg: '#eef3ff', color: '#3b5bdb' },
  avanco_obra:{ bg: '#fff8e6', color: '#92400e' },
  spot:       { bg: '#f1f3f8', color: '#8892a4' },
}
const ABC_STYLE: Record<string, { bg: string; color: string }> = {
  A: { bg: '#fdecea', color: '#b91c1c' },
  B: { bg: '#fff8e6', color: '#92400e' },
  C: { bg: '#f1f3f8', color: '#8892a4' },
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

function diasAVencer(validUntil: string | null): number | null {
  if (!validUntil) return null
  const diff = new Date(validUntil).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

function alertaStyle(dias: number | null): { bg: string; color: string; label: string } {
  if (dias === null) return { bg: '#f1f3f8', color: '#8892a4', label: 'Sem vigência' }
  if (dias < 0)   return { bg: '#fdecea', color: '#b91c1c', label: 'Vencido' }
  if (dias <= 30)  return { bg: '#fdecea', color: '#b91c1c', label: `${dias}d` }
  if (dias <= 60)  return { bg: '#fff8e6', color: '#92400e', label: `${dias}d` }
  if (dias <= 90)  return { bg: '#fff8e6', color: '#92400e', label: `${dias}d` }
  return { bg: '#eaf5ee', color: '#1a7c3e', label: `${dias}d` }
}

export default async function CarteirPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; alerta?: string; q?: string; coord?: string; eng?: string }>
}) {
  const { tipo, alerta, q, coord: coordFilter, eng: engFilter } = await searchParams
  const supabase = await createClient()

  // Busca todos os contratos do funil de Gestão de Contratos
  const { data: portfolioPipelines } = await supabase
    .from('pipelines')
    .select('id')
    .eq('type', 'gestao_contratos')

  const pipelineIds = (portfolioPipelines ?? []).map(p => p.id)

  // Contratos ativos nesses pipelines
  const { data: activeRuns } = pipelineIds.length
    ? await supabase
        .from('pipeline_runs')
        .select('contract_id, value, stage_id, pipeline_id')
        .in('pipeline_id', pipelineIds)
        .eq('status', 'open')
    : { data: [] as any[] }

  const contractIds = [...new Set((activeRuns ?? []).map((r: any) => r.contract_id))]

  let contractQuery = supabase
    .from('contracts')
    .select(`
      id, process_number, title, client_name, contract_number, sankhya_code,
      cnpj_billing, contract_type, monthly_value, validity_months, valid_until,
      engineer_id, coordinator_id, abc_curve, sphere, nature, region,
      score_billing, score_visit, score_loyalty, has_measurement, has_audit,
      has_management_plan, has_parts_included, municipality, state, internal_notes,
      company_id
    `)
    .in('id', contractIds.length ? contractIds : ['00000000-0000-0000-0000-000000000000'])

  if (tipo)        contractQuery = contractQuery.eq('contract_type', tipo)
  if (coordFilter) contractQuery = contractQuery.eq('coordinator_id', coordFilter)
  if (engFilter)   contractQuery = contractQuery.eq('engineer_id', engFilter)
  if (q?.trim())   contractQuery = contractQuery.or(`client_name.ilike.%${q.trim()}%,contract_number.ilike.%${q.trim()}%,process_number.ilike.%${q.trim()}%`)

  const { data: contracts } = await contractQuery.order('client_name')

  // Busca perfis pra coordenadores e engenheiros
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').order('full_name')
  const profileById = new Map((profiles ?? []).map(p => [p.id, p.full_name]))

  // Enriquece com valor do pipeline_run
  const valueByContract = new Map((activeRuns ?? []).map((r: any) => [r.contract_id, Number(r.value || 0)]))

  const enriched = (contracts ?? []).map(c => ({
    ...c,
    pipelineValue: valueByContract.get(c.id) ?? 0,
    dias: diasAVencer(c.valid_until),
  }))

  // Filtra por alerta de vencimento
  const filtered = alerta
    ? enriched.filter(c => {
        const d = c.dias
        if (alerta === 'vencido') return d !== null && d < 0
        if (alerta === '30')      return d !== null && d >= 0 && d <= 30
        if (alerta === '60')      return d !== null && d > 30 && d <= 60
        if (alerta === '90')      return d !== null && d > 60 && d <= 90
        return true
      })
    : enriched

  // KPIs
  const totalValorMensal = filtered.reduce((s, c) => s + (c.monthly_value ?? c.pipelineValue ?? 0), 0)
  const totalContratos = filtered.length
  const fixos = filtered.filter(c => c.contract_type === 'fixo').length
  const medicoes = filtered.filter(c => c.contract_type === 'medicao').length
  const vencendo30 = enriched.filter(c => c.dias !== null && c.dias >= 0 && c.dias <= 30).length
  const vencendo60 = enriched.filter(c => c.dias !== null && c.dias > 30 && c.dias <= 60).length

  // Ranking por coordenador
  const valueByCoord = new Map<string, number>()
  const countByCoord = new Map<string, number>()
  for (const c of enriched) {
    if (!c.coordinator_id) continue
    valueByCoord.set(c.coordinator_id, (valueByCoord.get(c.coordinator_id) ?? 0) + (c.monthly_value ?? 0))
    countByCoord.set(c.coordinator_id, (countByCoord.get(c.coordinator_id) ?? 0) + 1)
  }

  // Ranking por engenheiro
  const valueByEng = new Map<string, number>()
  const countByEng = new Map<string, number>()
  for (const c of enriched) {
    if (!c.engineer_id) continue
    valueByEng.set(c.engineer_id, (valueByEng.get(c.engineer_id) ?? 0) + (c.monthly_value ?? 0))
    countByEng.set(c.engineer_id, (countByEng.get(c.engineer_id) ?? 0) + 1)
  }

  const rankCoord = [...valueByCoord.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const rankEng = [...valueByEng.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxCoord = rankCoord[0]?.[1] ?? 1
  const maxEng = rankEng[0]?.[1] ?? 1

  const ALERTS = [
    { label: 'Todos', value: '' },
    { label: '⚠ Vencido', value: 'vencido' },
    { label: '🔴 30 dias', value: '30' },
    { label: '🟡 60 dias', value: '60' },
    { label: '🟢 90 dias', value: '90' },
  ]
  const TIPOS = [
    { label: 'Todos', value: '' },
    { label: 'Fixo', value: 'fixo' },
    { label: 'Por Medição', value: 'medicao' },
    { label: 'Avanço Obra', value: 'avanco_obra' },
    { label: 'Spot', value: 'spot' },
  ]

  function buildHref(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      ...(tipo ? { tipo } : {}),
      ...(alerta ? { alerta } : {}),
      ...(q ? { q } : {}),
      ...(coordFilter ? { coord: coordFilter } : {}),
      ...(engFilter ? { eng: engFilter } : {}),
      ...overrides,
    })
    const str = params.toString()
    return `/carteira${str ? '?' + str : ''}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Gestão de Carteira</h1>
          <p style={{ fontSize: 12, color: '#8892a4', marginTop: 3 }}>Contratos ativos no funil de Gestão de Contratos.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/pipeline" style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', textDecoration: 'none' }}>
            Ver no Kanban
          </Link>
          <Link href="/contracts/new?type=gestao_contratos" style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, background: '#1a1f36', color: '#fff', textDecoration: 'none', fontWeight: 500 }}>
            + Novo contrato
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: 'Valor mensal total', value: fmt(totalValorMensal), sub: `${totalContratos} contratos ativos` },
          { label: 'Contratos fixos', value: String(fixos), sub: 'receita previsível' },
          { label: 'Por medição', value: String(medicoes), sub: 'variável por entrega' },
          { label: 'Vencendo em 30d', value: String(vencendo30), sub: 'ação necessária', alert: vencendo30 > 0 },
          { label: 'Vencendo em 60d', value: String(vencendo60), sub: 'monitorar', alert: vencendo60 > 0 },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: `0.5px solid ${(k as any).alert ? '#fca5a5' : '#e8edf5'}` }}>
            <p style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 20, fontWeight: 500, color: (k as any).alert ? '#b91c1c' : '#1a1f36', letterSpacing: '-0.5px', margin: 0 }}>{k.value}</p>
            <p style={{ fontSize: 11, color: (k as any).alert ? '#b91c1c' : '#8892a4', marginTop: 3 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Rankings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Ranking Coordenadores */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 16 }}>Carteira por Coordenador</p>
          {rankCoord.length === 0 && <p style={{ fontSize: 12, color: '#8892a4' }}>Nenhum coordenador atribuído ainda.</p>}
          {rankCoord.map(([id, val]) => (
            <div key={id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#1a1f36', fontWeight: 500 }}>{profileById.get(id) ?? 'Sem nome'}</span>
                <span style={{ fontSize: 12, color: '#52514e' }}>{fmt(val)} · {countByCoord.get(id)} contratos</span>
              </div>
              <div style={{ height: 6, background: '#f1f3f8', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((val / maxCoord) * 100)}%`, background: 'linear-gradient(90deg, #4f86f7, #7c3aed)', borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Ranking Engenheiros */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 16 }}>Carteira por Engenheiro</p>
          {rankEng.length === 0 && <p style={{ fontSize: 12, color: '#8892a4' }}>Nenhum engenheiro atribuído ainda.</p>}
          {rankEng.map(([id, val]) => (
            <div key={id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#1a1f36', fontWeight: 500 }}>{profileById.get(id) ?? 'Sem nome'}</span>
                <span style={{ fontSize: 12, color: '#52514e' }}>{fmt(val)} · {countByEng.get(id)} contratos</span>
              </div>
              <div style={{ height: 6, background: '#f1f3f8', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((val / maxEng) * 100)}%`, background: 'linear-gradient(90deg, #1a7c3e, #32af9d)', borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>

        {/* Filtros */}
        <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f1f3f8', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Tipo:</span>
            {TIPOS.map(t => (
              <Link key={t.value} href={buildHref({ tipo: t.value })}
                style={{ padding: '4px 10px', fontSize: 11, borderRadius: 20, textDecoration: 'none', border: '0.5px solid', borderColor: (tipo ?? '') === t.value ? '#1a1f36' : '#d1d8e8', background: (tipo ?? '') === t.value ? '#1a1f36' : '#fff', color: (tipo ?? '') === t.value ? '#fff' : '#8892a4' }}>
                {t.label}
              </Link>
            ))}
            <span style={{ width: 1, height: 16, background: '#e8edf5', margin: '0 4px' }} />
            <span style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Vencimento:</span>
            {ALERTS.map(a => (
              <Link key={a.value} href={buildHref({ alerta: a.value })}
                style={{ padding: '4px 10px', fontSize: 11, borderRadius: 20, textDecoration: 'none', border: '0.5px solid', borderColor: (alerta ?? '') === a.value ? '#1a1f36' : '#d1d8e8', background: (alerta ?? '') === a.value ? '#1a1f36' : '#fff', color: (alerta ?? '') === a.value ? '#fff' : '#8892a4' }}>
                {a.label}
              </Link>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <form method="GET" style={{ display: 'flex', gap: 6 }}>
              {tipo && <input type="hidden" name="tipo" value={tipo} />}
              {alerta && <input type="hidden" name="alerta" value={alerta} />}
              <input type="text" name="q" defaultValue={q ?? ''} placeholder="Buscar cliente, nº contrato..."
                style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#f8f9fb', color: '#1a1f36', outline: 'none', width: 240 }} />
              <button type="submit" style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer' }}>Buscar</button>
              {q && <Link href="/carteira" style={{ padding: '6px 10px', fontSize: 11, color: '#8892a4', textDecoration: 'none', alignSelf: 'center' }}>Limpar</Link>}
            </form>
            <CarteiraSelectFilters
              coords={[...valueByCoord.keys()].map(id => ({ id, name: profileById.get(id) ?? id }))}
              engs={[...valueByEng.keys()].map(id => ({ id, name: profileById.get(id) ?? id }))}
              currentCoord={coordFilter}
              currentEng={engFilter}
              baseUrl="/carteira"
            />
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Cliente', 'Nº Contrato', 'Tipo', 'Valor/mês', 'Coordenador', 'Engenheiro', 'ABC', 'Vencimento', 'Alerta', ''].map((h, i) => (
                <th key={h + i} style={{ padding: '10px 12px', fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 500, textAlign: i >= 3 && i <= 3 ? 'right' : 'left', borderBottom: '0.5px solid #f1f3f8', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const alert = alertaStyle(c.dias)
              const typeSt = c.contract_type ? TYPE_STYLE[c.contract_type] : null
              const abcSt = c.abc_curve ? ABC_STYLE[c.abc_curve] : null
              return (
                <tr key={c.id} style={{ borderBottom: '0.5px solid #f8f9fb' }}>
                  <td style={{ padding: '12px 12px' }}>
                    <Link href={`/contracts/${c.id}`} style={{ textDecoration: 'none' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>{c.client_name}</p>
                      {c.municipality && <p style={{ fontSize: 11, color: '#8892a4', marginTop: 2 }}>{c.municipality}{c.state ? ` · ${c.state}` : ''}</p>}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 12px', fontSize: 11, fontFamily: 'monospace', color: '#8892a4' }}>
                    {c.contract_number ?? c.process_number}
                    {c.sankhya_code && <p style={{ fontSize: 10, color: '#b0b8c8', marginTop: 1 }}>{c.sankhya_code}</p>}
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    {typeSt ? (
                      <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: typeSt.bg, color: typeSt.color }}>
                        {TYPE_LABEL[c.contract_type!]}
                      </span>
                    ) : <span style={{ fontSize: 11, color: '#d1d8e8' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#1a1f36' }}>
                    {c.monthly_value ? fmt(c.monthly_value) : <span style={{ color: '#d1d8e8', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 12px', fontSize: 12, color: '#52514e' }}>
                    {c.coordinator_id ? profileById.get(c.coordinator_id) ?? '—' : <span style={{ color: '#d1d8e8' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 12px', fontSize: 12, color: '#52514e' }}>
                    {c.engineer_id ? profileById.get(c.engineer_id) ?? '—' : <span style={{ color: '#d1d8e8' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    {abcSt ? (
                      <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: abcSt.bg, color: abcSt.color }}>{c.abc_curve}</span>
                    ) : <span style={{ color: '#d1d8e8', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 12px', fontSize: 11, color: '#52514e' }}>
                    {c.valid_until ? new Date(c.valid_until).toLocaleDateString('pt-BR') : <span style={{ color: '#d1d8e8' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: alert.bg, color: alert.color, whiteSpace: 'nowrap' }}>
                      {alert.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <Link href={`/contracts/${c.id}`} style={{ fontSize: 11, color: '#4f86f7', textDecoration: 'none' }}>Ver</Link>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ padding: '48px 16px', textAlign: 'center', fontSize: 13, color: '#8892a4' }}>
                {contractIds.length === 0
                  ? 'Nenhum contrato no funil de Gestão de Contratos ainda. Cadastre pelo Kanban ou clique em "+ Novo contrato".'
                  : 'Nenhum contrato com esses filtros.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
