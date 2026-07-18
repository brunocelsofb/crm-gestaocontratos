import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ValidityBadge } from '@/components/contracts/validity-badge'

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open:   { bg: '#eef3ff', color: '#3b5bdb' },
  won:    { bg: '#eaf5ee', color: '#1a7c3e' },
  lost:   { bg: '#fdecea', color: '#b91c1c' },
  paused: { bg: '#fff8e6', color: '#92400e' },
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Em andamento', won: 'Ganho', lost: 'Perdido', paused: 'Pausado',
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('contracts_with_current_run')
    .select('id, process_number, title, client_name, value, run_status, stage_id')
    .order('created_at', { ascending: false })

  if (q?.trim()) {
    const term = q.trim().replace(/[%_]/g, '')
    query = query.or(`process_number.ilike.%${term}%,title.ilike.%${term}%,client_name.ilike.%${term}%`)
  }

  const { data: contracts, error } = await query
  const stageIds = [...new Set((contracts ?? []).map((c) => c.stage_id).filter(Boolean))]
  const contractIds = (contracts ?? []).map((c) => c.id)

  const [{ data: stages }, { data: validityData }] = await Promise.all([
    stageIds.length
      ? supabase.from('stages').select('id, name, color').in('id', stageIds)
      : Promise.resolve({ data: [] as { id: string; name: string; color: string | null }[] }),
    contractIds.length
      ? supabase.from('contracts').select('id, valid_until').in('id', contractIds)
      : Promise.resolve({ data: [] as { id: string; valid_until: string | null }[] }),
  ])

  const stageById = new Map((stages ?? []).map((s) => [s.id, s]))
  const validUntilById = new Map((validityData ?? []).map((c) => [c.id, c.valid_until]))

  const total = (contracts ?? []).reduce((s, c) => s + Number(c.value || 0), 0)
  const open  = (contracts ?? []).filter(c => c.run_status === 'open').length
  const won   = (contracts ?? []).filter(c => c.run_status === 'won').length
  const lost  = (contracts ?? []).filter(c => c.run_status === 'lost').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Oportunidades</h1>
          <p style={{ fontSize: 12, color: '#8892a4', marginTop: 3 }}>Todas as oportunidades e contratos ativos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/contracts/new" style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, background: '#1a1f36', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
            + Nova oportunidade
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Valor total', value: fmt(total), sub: `${(contracts ?? []).length} oportunidades` },
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

      {/* Card principal */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>

        {/* Filtros + busca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '0.5px solid #f1f3f8', flexWrap: 'wrap' }}>
          {['Todas', 'Em andamento', 'Ganhas', 'Perdidas'].map((f, i) => (
            <span key={f} style={{ padding: '4px 12px', fontSize: 11, borderRadius: 20, border: '0.5px solid', borderColor: i === 0 ? '#1a1f36' : '#d1d8e8', background: i === 0 ? '#1a1f36' : '#fff', color: i === 0 ? '#fff' : '#8892a4', cursor: 'pointer' }}>{f}</span>
          ))}
          <div style={{ flex: 1 }} />
          <form method="GET" style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              name="q"
              defaultValue={q ?? ''}
              placeholder="Buscar empresa ou processo…"
              style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#f8f9fb', color: '#1a1f36', outline: 'none', width: 220 }}
            />
            <button type="submit" style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer' }}>Buscar</button>
            {q && <Link href="/contracts" style={{ padding: '6px 10px', fontSize: 11, color: '#8892a4', textDecoration: 'none', alignSelf: 'center' }}>Limpar</Link>}
          </form>
        </div>

        {error && <p style={{ padding: '12px 16px', fontSize: 12, color: '#b91c1c' }}>Erro ao carregar: {error.message}</p>}

        {/* Tabela */}
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Nº processo', 'Empresa / oportunidade', 'Etapa', 'Validade', 'Status', 'Valor'].map((h, i) => (
                <th key={h} style={{ padding: '10px 16px', fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 500, textAlign: i === 5 ? 'right' : 'left', borderBottom: '0.5px solid #f1f3f8', width: i === 0 ? '12%' : i === 1 ? '26%' : i === 2 ? '18%' : i === 3 ? '14%' : i === 4 ? '14%' : '16%' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(contracts ?? []).map((c) => {
              const stage = c.stage_id ? stageById.get(c.stage_id) : null
              const st = STATUS_STYLE[c.run_status ?? 'open'] ?? STATUS_STYLE.open
              const stLabel = STATUS_LABEL[c.run_status ?? 'open'] ?? c.run_status
              return (
                <tr key={c.id} style={{ borderBottom: '0.5px solid #f8f9fb' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafbfd')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '12px 16px', fontSize: 11, fontFamily: 'monospace', color: '#8892a4' }}>
                    <Link href={`/contracts/${c.id}`} style={{ color: '#4f86f7', textDecoration: 'none' }}>{c.process_number}</Link>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/contracts/${c.id}`} style={{ textDecoration: 'none' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>{c.client_name}</p>
                      <p style={{ fontSize: 11, color: '#8892a4', marginTop: 2 }}>{c.title}</p>
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {stage ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: (stage.color ?? '#8892a4') + '20', color: stage.color ?? '#8892a4' }}>
                        {stage.name}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#c8cdd8' }}>Sem funil</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <ValidityBadge validUntil={validUntilById.get(c.id) ?? null} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: st.bg, color: st.color }}>
                      {stLabel}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#1a1f36' }}>
                    {fmt(Number(c.value || 0))}
                  </td>
                </tr>
              )
            })}
            {(contracts ?? []).length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', fontSize: 13, color: '#8892a4' }}>
                  {q ? `Nenhuma oportunidade encontrada para "${q}".` : 'Nenhuma oportunidade cadastrada ainda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
