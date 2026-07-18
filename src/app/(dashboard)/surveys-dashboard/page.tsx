import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PeriodSelector } from '@/components/dashboard/period-selector'
import { BulkSendNpsButton } from '@/components/nps/bulk-send-nps-button'
import { ExpandableRow } from '@/components/surveys/expandable-row'
import { NpsCharts } from '@/components/dashboard/nps-charts'
import { calculateNps, categorizeScore } from '@/lib/utils/nps'
import { calculateResponseScore, calculateAverageScore } from '@/lib/utils/survey-score'
import type { Question } from '@/lib/actions/custom-surveys'

const NPS_CATEGORY_LABELS = { promoter: 'Promotor', passive: 'Neutro', detractor: 'Detrator' } as const
const NPS_CATEGORY_STYLE = {
  promoter: { bg: '#eaf5ee', color: '#1a7c3e' },
  passive:  { bg: '#fff8e6', color: '#92400e' },
  detractor:{ bg: '#fdecea', color: '#b91c1c' },
} as const

function currentQuarterRange() {
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3)
  const from = new Date(now.getFullYear(), quarter * 3, 1)
  const to = new Date(now.getFullYear(), quarter * 3 + 3, 0)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export default async function SurveysDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; template?: string; from?: string; to?: string; tag?: string }>
}) {
  const params = await searchParams
  const tab = params.tab === 'surveys' ? 'surveys' : 'nps'
  const defaultRange = currentQuarterRange()
  const from = params.from ?? defaultRange.from
  const to = params.to ?? defaultRange.to
  const supabase = await createClient()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Pesquisas & NPS</h1>
          <p style={{ fontSize: 12, color: '#8892a4', marginTop: 3 }}>Satisfação dos clientes consolidada por período.</p>
        </div>
        <BulkSendNpsButton />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '0.5px solid #e8edf5' }}>
        {[{ label: 'NPS', value: 'nps' }, { label: 'Pesquisas Customizadas', value: 'surveys' }].map(t => (
          <Link key={t.value} href={`/surveys-dashboard?tab=${t.value}&from=${from}&to=${to}`}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: tab === t.value ? 500 : 400, textDecoration: 'none',
              color: tab === t.value ? '#1a1f36' : '#8892a4',
              borderBottom: tab === t.value ? '2px solid #1a1f36' : '2px solid transparent',
              marginBottom: -0.5 }}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'nps' ? (
        <NpsTab supabase={supabase} from={from} to={to} selectedTagId={params.tag ?? 'all'} />
      ) : (
        <SurveysTab supabase={supabase} from={from} to={to} selectedTemplateId={params.template} />
      )}
    </div>
  )
}

async function NpsTab({ supabase, from, to, selectedTagId }: {
  supabase: Awaited<ReturnType<typeof createClient>>; from: string; to: string; selectedTagId: string
}) {
  const [{ data: surveysRaw }, { data: allTags }] = await Promise.all([
    supabase.from('nps_surveys').select('id, contract_id, score, comment, answered_at, respondent_name, respondent_email, respondent_phone').eq('status', 'answered').gte('answered_at', `${from}T00:00:00`).lte('answered_at', `${to}T23:59:59`).order('answered_at', { ascending: false }),
    supabase.from('tags').select('id, name, color').order('name'),
  ])

  const allContractIds = [...new Set((surveysRaw ?? []).map(s => s.contract_id))]
  const [{ data: contracts }, { data: contractTagRows }] = await Promise.all([
    allContractIds.length ? supabase.from('contracts').select('id, client_name, company_id, contact_id').in('id', allContractIds) : Promise.resolve({ data: [] as any[] }),
    allContractIds.length ? supabase.from('contract_tags').select('contract_id, tag_id').in('contract_id', allContractIds) : Promise.resolve({ data: [] as any[] }),
  ])

  const contractById = new Map((contracts ?? []).map((c: any) => [c.id, c]))
  const tagIdByContract = new Map((contractTagRows ?? []).map((r: any) => [r.contract_id, r.tag_id]))
  const tagById = new Map((allTags ?? []).map(t => [t.id, t]))

  const surveys = (surveysRaw ?? []).filter(s => {
    if (selectedTagId === 'all') return true
    const contractTagId = tagIdByContract.get(s.contract_id) ?? null
    if (selectedTagId === 'none') return !contractTagId
    return contractTagId === selectedTagId
  })

  const contractIds = [...new Set(surveys.map(s => s.contract_id))]
  const companyIds = [...new Set(contractIds.map(id => contractById.get(id)?.company_id).filter((v): v is string => !!v))]
  const contactIds = [...new Set(contractIds.map(id => contractById.get(id)?.contact_id).filter((v): v is string => !!v))]

  const [{ data: companies }, { data: contacts }] = await Promise.all([
    companyIds.length ? supabase.from('companies').select('id, name, trade_name, cnpj').in('id', companyIds) : Promise.resolve({ data: [] as any[] }),
    contactIds.length ? supabase.from('contacts').select('id, name').in('id', contactIds) : Promise.resolve({ data: [] as any[] }),
  ])

  const companyById = new Map((companies ?? []).map((c: any) => [c.id, c]))
  const contactById = new Map((contacts ?? []).map((c: any) => [c.id, c]))

  const scores = surveys.map(s => s.score).filter((s): s is number => s !== null)
  const { nps, promoters, passives, detractors, total } = calculateNps(scores)

  // Histórico dos últimos 6 meses para o gráfico de evolução
  const history = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const mFrom = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
    const mTo = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
    const { data: mSurveys } = await supabase.from('nps_surveys').select('score').eq('status', 'answered').gte('answered_at', `${mFrom}T00:00:00`).lte('answered_at', `${mTo}T23:59:59`)
    const mScores = (mSurveys ?? []).map((s: any) => s.score).filter((s: any): s is number => s !== null)
    const { nps: mNps } = calculateNps(mScores)
    history.push({ month: d.toLocaleDateString('pt-BR', { month: 'short' }), nps: mNps, total: mScores.length })
  }

  function tagFilterHref(tagId: string) {
    return `/surveys-dashboard?tab=nps&from=${from}&to=${to}&tag=${tagId}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filtros de período e tag */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <a href={tagFilterHref('all')} style={{ padding: '4px 12px', fontSize: 11, borderRadius: 20, textDecoration: 'none', border: '0.5px solid', borderColor: selectedTagId === 'all' ? '#1a1f36' : '#d1d8e8', background: selectedTagId === 'all' ? '#1a1f36' : '#fff', color: selectedTagId === 'all' ? '#fff' : '#8892a4' }}>Todas as tags</a>
          {allTags?.map(t => (
            <a key={t.id} href={tagFilterHref(t.id)} style={{ padding: '4px 12px', fontSize: 11, borderRadius: 20, textDecoration: 'none', border: '0.5px solid', borderColor: selectedTagId === t.id ? t.color : '#d1d8e8', background: selectedTagId === t.id ? t.color : '#fff', color: selectedTagId === t.id ? '#fff' : '#8892a4' }}>{t.name}</a>
          ))}
          <a href={tagFilterHref('none')} style={{ padding: '4px 12px', fontSize: 11, borderRadius: 20, textDecoration: 'none', border: '0.5px solid', borderColor: selectedTagId === 'none' ? '#1a1f36' : '#d1d8e8', background: selectedTagId === 'none' ? '#1a1f36' : '#fff', color: selectedTagId === 'none' ? '#fff' : '#8892a4' }}>Sem tag</a>
        </div>
        <PeriodSelector from={from} to={to} basePath="/surveys-dashboard" extraParams={{ tab: 'nps', tag: selectedTagId }} />
      </div>

      {/* Gráficos premium */}
      <NpsCharts nps={nps} promoters={promoters} passives={passives} detractors={detractors} total={total} history={history} />

      {/* Lista de respostas */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f1f3f8' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Respostas individuais</p>
          <p style={{ fontSize: 11, color: '#8892a4', marginTop: 2 }}>{total} resposta{total !== 1 ? 's' : ''} no período selecionado</p>
        </div>
        <div style={{ padding: '0 16px 8px' }}>
          {surveys.map(s => {
            const contract = contractById.get(s.contract_id)
            const company = contract?.company_id ? companyById.get(contract.company_id) : null
            const contact = contract?.contact_id ? contactById.get(contract.contact_id) : null
            const category = s.score !== null ? categorizeScore(s.score) : null
            const tag = tagById.get(tagIdByContract.get(s.contract_id) ?? '')
            const catSt = category ? NPS_CATEGORY_STYLE[category] : null
            return (
              <ExpandableRow
                key={s.id}
                summary={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36' }}>{company?.name ?? contract?.client_name ?? '—'}</span>
                        {tag && <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: tag.color, color: '#fff' }}>{tag.name}</span>}
                        {category && catSt && <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: catSt.bg, color: catSt.color }}>{NPS_CATEGORY_LABELS[category]} — {s.score}</span>}
                      </div>
                      <p style={{ marginTop: 3, fontSize: 11, color: '#8892a4' }}>
                        {s.respondent_name ?? contact?.name ?? '—'} · {s.answered_at ? new Date(s.answered_at).toLocaleDateString('pt-BR') : '—'}
                      </p>
                    </div>
                  </div>
                }
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                  <div><p style={{ color: '#8892a4', marginBottom: 2 }}>CNPJ</p><p style={{ fontFamily: 'monospace', color: '#52514e' }}>{company?.cnpj ?? '—'}</p></div>
                  <div><p style={{ color: '#8892a4', marginBottom: 2 }}>E-mail / Telefone</p><p style={{ color: '#52514e' }}>{[s.respondent_email, s.respondent_phone].filter(Boolean).join(' · ') || '—'}</p></div>
                </div>
                {s.comment && (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ fontSize: 10, color: '#8892a4', marginBottom: 4 }}>Comentário</p>
                    <p style={{ fontSize: 13, color: '#52514e', fontStyle: 'italic' }}>&ldquo;{s.comment}&rdquo;</p>
                  </div>
                )}
              </ExpandableRow>
            )
          })}
          {surveys.length === 0 && (
            <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: '#8892a4' }}>
              Nenhuma resposta de NPS neste período{selectedTagId !== 'all' ? ' com esse filtro' : ''}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

async function SurveysTab({ supabase, from, to, selectedTemplateId }: {
  supabase: Awaited<ReturnType<typeof createClient>>; from: string; to: string; selectedTemplateId?: string
}) {
  const { data: templates } = await supabase.from('survey_templates').select('id, name, questions').order('name')
  const templateId = selectedTemplateId ?? templates?.[0]?.id
  const selectedTemplate = templates?.find(t => t.id === templateId)
  const questions = (selectedTemplate?.questions ?? []) as Question[]

  const { data: responses } = templateId
    ? await supabase.from('custom_surveys').select('id, respondent_name, respondent_email, respondent_phone, contract_id, responses, answered_at').eq('template_id', templateId).eq('status', 'answered').gte('answered_at', `${from}T00:00:00`).lte('answered_at', `${to}T23:59:59`).order('answered_at', { ascending: false })
    : { data: [] as any[] }

  const contractIds = [...new Set((responses ?? []).map((r: any) => r.contract_id))]
  const { data: contracts } = contractIds.length ? await supabase.from('contracts').select('id, client_name, process_number').in('id', contractIds) : { data: [] as any[] }
  const contractById = new Map((contracts ?? []).map((c: any) => [c.id, c]))

  const responsesWithScore = (responses ?? []).map((r: any) => ({ ...r, score: calculateResponseScore(questions, r.responses as Record<string, string | string[]> | null) }))
  const averageScore = calculateAverageScore(responsesWithScore.map((r: any) => r.score))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {templates?.map(t => (
          <a key={t.id} href={`/surveys-dashboard?tab=surveys&template=${t.id}&from=${from}&to=${to}`}
            style={{ padding: '4px 12px', fontSize: 11, borderRadius: 20, textDecoration: 'none', border: '0.5px solid', borderColor: t.id === templateId ? '#1a1f36' : '#d1d8e8', background: t.id === templateId ? '#1a1f36' : '#fff', color: t.id === templateId ? '#fff' : '#8892a4' }}>
            {t.name}
          </a>
        ))}
        {(!templates || templates.length === 0) && <p style={{ fontSize: 12, color: '#8892a4' }}>Nenhum formulário criado ainda.</p>}
      </div>

      {templateId && (
        <>
          <PeriodSelector from={from} to={to} basePath="/surveys-dashboard" extraParams={{ tab: 'surveys', template: templateId }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Pontuação média', value: averageScore ? `${averageScore.value} / ${averageScore.max}` : '—', sub: 'do período' },
              { label: 'Respostas', value: String(responsesWithScore.length), sub: 'no período' },
              { label: 'Formulário', value: selectedTemplate?.name ?? '—', sub: `${questions.length} pergunta${questions.length !== 1 ? 's' : ''}` },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '0.5px solid #e8edf5' }}>
                <p style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{k.label}</p>
                <p style={{ fontSize: 18, fontWeight: 500, color: '#1a1f36', letterSpacing: '-0.5px' }}>{k.value}</p>
                <p style={{ fontSize: 11, color: '#8892a4', marginTop: 3 }}>{k.sub}</p>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f1f3f8' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Respostas individuais</p>
            </div>
            <div style={{ padding: '0 16px 8px' }}>
              {responsesWithScore.map((r: any) => {
                const contract = contractById.get(r.contract_id)
                return (
                  <ExpandableRow key={r.id}
                    summary={
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36' }}>{r.respondent_name}</span>
                          {r.score && <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: '#eef3ff', color: '#3b5bdb' }}>{r.score.scale === 'likert' ? 'Satisfação' : 'Nota'} {r.score.value}/{r.score.max}</span>}
                        </div>
                        <p style={{ marginTop: 3, fontSize: 11, color: '#8892a4' }}>
                          {contract ? `${contract.client_name} · ${contract.process_number}` : '—'} · {r.answered_at ? new Date(r.answered_at).toLocaleDateString('pt-BR') : '—'}
                        </p>
                      </div>
                    }
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                      <div><p style={{ color: '#8892a4', marginBottom: 2 }}>E-mail / Telefone</p><p style={{ color: '#52514e' }}>{[r.respondent_email, r.respondent_phone].filter(Boolean).join(' · ') || '—'}</p></div>
                    </div>
                    <div style={{ borderTop: '0.5px solid #f1f3f8', marginTop: 8, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {questions.map((q: Question) => {
                        const answer = (r.responses as Record<string, string | string[]> | null)?.[q.id]
                        const display = Array.isArray(answer) ? (answer.length ? answer.join(', ') : '—') : (answer || '—')
                        return (
                          <div key={q.id}>
                            <p style={{ fontSize: 10, color: '#8892a4', marginBottom: 2 }}>{q.label}</p>
                            <p style={{ fontSize: 13, color: '#52514e' }}>{display}</p>
                          </div>
                        )
                      })}
                    </div>
                  </ExpandableRow>
                )
              })}
              {responsesWithScore.length === 0 && (
                <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: '#8892a4' }}>Nenhuma resposta neste período.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
