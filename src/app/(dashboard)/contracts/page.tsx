import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ContractsTable } from '@/components/contracts/contracts-table'

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams
  const supabase = await createClient()

  // Busca só pipelines de tipo 'vendas' — Oportunidades são exclusivamente
  // negócios em negociação, não contratos de gestão de carteira.
  const { data: salesPipelines } = await supabase
    .from('pipelines').select('id, is_default').eq('type', 'vendas')
  const salesPipelineIds = (salesPipelines ?? []).map(p => p.id)
  const defaultSalesPipeline = salesPipelines?.find(p => p.is_default)?.id ?? salesPipelineIds[0]

  let query = salesPipelineIds.length
    ? supabase
        .from('contracts_with_current_run')
        .select('id, process_number, title, client_name, value, run_status, stage_id, pipeline_id')
        .in('pipeline_id', salesPipelineIds)
        .order('created_at', { ascending: false })
    : supabase
        .from('contracts_with_current_run')
        .select('id, process_number, title, client_name, value, run_status, stage_id, pipeline_id')
        .eq('pipeline_id', '00000000-0000-0000-0000-000000000000') // retorna vazio se não tem funil de vendas

  if (q?.trim()) {
    const term = q.trim().replace(/[%_]/g, '')
    query = query.or(`process_number.ilike.%${term}%,title.ilike.%${term}%,client_name.ilike.%${term}%`)
  }
  if (status && status !== 'all') query = query.eq('run_status', status)

  const { data: contracts, error } = await query
  const stageIds = [...new Set((contracts ?? []).map((c) => c.stage_id).filter(Boolean))]
  const contractIds = (contracts ?? []).map((c) => c.id)

  const [{ data: stages }, { data: validityData }] = await Promise.all([
    stageIds.length ? supabase.from('stages').select('id, name, color').in('id', stageIds) : Promise.resolve({ data: [] as any[] }),
    contractIds.length ? supabase.from('contracts').select('id, valid_until').in('id', contractIds) : Promise.resolve({ data: [] as any[] }),
  ])

  const stageById = new Map((stages ?? []).map((s: any) => [s.id, s]))
  const validUntilById = new Map((validityData ?? []).map((c: any) => [c.id, c.valid_until]))

  const enriched = (contracts ?? []).map(c => ({
    ...c,
    stage: c.stage_id ? stageById.get(c.stage_id) ?? null : null,
    valid_until: validUntilById.get(c.id) ?? null,
  }))

  const total = enriched.reduce((s, c) => s + Number(c.value || 0), 0)
  const open = enriched.filter(c => c.run_status === 'open').length
  const won = enriched.filter(c => c.run_status === 'won').length
  const lost = enriched.filter(c => c.run_status === 'lost').length

  const FILTERS = [
    { label: 'Todas', value: 'all' },
    { label: 'Em andamento', value: 'open' },
    { label: 'Ganhas', value: 'won' },
    { label: 'Perdidas', value: 'lost' },
  ]
  const activeFilter = status ?? 'all'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Oportunidades</h1>
          <p style={{ fontSize: 12, color: '#8892a4', marginTop: 3 }}>Todas as oportunidades e contratos ativos</p>
        </div>
        <Link href={`/contracts/new${defaultSalesPipeline ? `?pipeline=${defaultSalesPipeline}` : ''}`}
          style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, background: '#1a1f36', color: '#fff', textDecoration: 'none', fontWeight: 500 }}>
          + Nova oportunidade
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Valor total', value: fmt(total), sub: `${enriched.length} oportunidades` },
          { label: 'Em andamento', value: String(open), sub: 'oportunidades abertas' },
          { label: 'Ganhas', value: String(won), sub: 'oportunidades fechadas' },
          { label: 'Perdidas', value: String(lost), sub: 'oportunidades perdidas' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '0.5px solid #e8edf5' }}>
            <p style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 20, fontWeight: 500, color: '#1a1f36', letterSpacing: '-0.5px' }}>{k.value}</p>
            <p style={{ fontSize: 11, color: '#8892a4', marginTop: 3 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '0.5px solid #f1f3f8', flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <Link key={f.value} href={`/contracts?status=${f.value}${q ? `&q=${q}` : ''}`}
              style={{ padding: '4px 12px', fontSize: 11, borderRadius: 20, border: '0.5px solid', textDecoration: 'none',
                borderColor: activeFilter === f.value ? '#1a1f36' : '#d1d8e8',
                background: activeFilter === f.value ? '#1a1f36' : '#fff',
                color: activeFilter === f.value ? '#fff' : '#8892a4' }}>
              {f.label}
            </Link>
          ))}
          <div style={{ flex: 1 }} />
          <form method="GET" style={{ display: 'flex', gap: 6 }}>
            {status && <input type="hidden" name="status" value={status} />}
            <input type="text" name="q" defaultValue={q ?? ''} placeholder="Buscar empresa ou processo…"
              style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#f8f9fb', color: '#1a1f36', outline: 'none', width: 220 }} />
            <button type="submit" style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer' }}>Buscar</button>
            {q && <Link href="/contracts" style={{ padding: '6px 10px', fontSize: 11, color: '#8892a4', textDecoration: 'none', alignSelf: 'center' }}>Limpar</Link>}
          </form>
        </div>

        {error && <p style={{ padding: '12px 16px', fontSize: 12, color: '#b91c1c' }}>Erro: {error.message}</p>}
        <ContractsTable contracts={enriched} q={q} />
      </div>
    </div>
  )
}
