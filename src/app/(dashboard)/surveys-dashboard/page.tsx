import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PeriodSelector } from '@/components/dashboard/period-selector'
import { BulkSendNpsButton } from '@/components/nps/bulk-send-nps-button'
import { ExpandableRow } from '@/components/surveys/expandable-row'
import { calculateNps, categorizeScore } from '@/lib/utils/nps'
import { calculateResponseScore, calculateAverageScore } from '@/lib/utils/survey-score'
import type { Question } from '@/lib/actions/custom-surveys'

const NPS_CATEGORY_LABELS = { promoter: 'Promotor', passive: 'Neutro', detractor: 'Detrator' } as const
const NPS_CATEGORY_STYLES = {
  promoter: 'bg-positive-100 text-positive-700',
  passive: 'bg-yellow-100 text-yellow-800',
  detractor: 'bg-negative-100 text-negative-700',
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
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Pesquisas de Satisfação</h1>
        <p className="mt-0.5 text-sm text-gray-500">NPS e formulários customizados, consolidados por período.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <Link
          href={`/surveys-dashboard?tab=nps&from=${from}&to=${to}`}
          className={`px-4 py-2 text-sm font-medium ${tab === 'nps' ? 'border-b-2 border-brand-700 text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          NPS
        </Link>
        <Link
          href={`/surveys-dashboard?tab=surveys&from=${from}&to=${to}`}
          className={`px-4 py-2 text-sm font-medium ${tab === 'surveys' ? 'border-b-2 border-brand-700 text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Pesquisas Customizadas
        </Link>
      </div>

      {tab === 'nps' ? (
        <NpsTab supabase={supabase} from={from} to={to} selectedTagId={params.tag ?? 'all'} />
      ) : (
        <SurveysTab supabase={supabase} from={from} to={to} selectedTemplateId={params.template} />
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Aba NPS
// ------------------------------------------------------------
async function NpsTab({
  supabase,
  from,
  to,
  selectedTagId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  from: string
  to: string
  selectedTagId: string
}) {
  const [{ data: surveysRaw }, { data: allTags }] = await Promise.all([
    supabase
      .from('nps_surveys')
      .select('id, contract_id, score, comment, answered_at, respondent_name, respondent_email, respondent_phone')
      .eq('status', 'answered')
      .gte('answered_at', `${from}T00:00:00`)
      .lte('answered_at', `${to}T23:59:59`)
      .order('answered_at', { ascending: false }),
    supabase.from('tags').select('id, name, color').order('name'),
  ])

  const allContractIds = [...new Set((surveysRaw ?? []).map((s) => s.contract_id))]

  const [{ data: contracts }, { data: contractTagRows }] = await Promise.all([
    allContractIds.length
      ? supabase.from('contracts').select('id, client_name, company_id, contact_id').in('id', allContractIds)
      : Promise.resolve({ data: [] as { id: string; client_name: string; company_id: string | null; contact_id: string | null }[] }),
    allContractIds.length
      ? supabase.from('contract_tags').select('contract_id, tag_id').in('contract_id', allContractIds)
      : Promise.resolve({ data: [] as { contract_id: string; tag_id: string }[] }),
  ])

  const contractById = new Map((contracts ?? []).map((c) => [c.id, c]))
  const tagIdByContract = new Map((contractTagRows ?? []).map((r) => [r.contract_id, r.tag_id]))
  const tagById = new Map((allTags ?? []).map((t) => [t.id, t]))

  const surveys = (surveysRaw ?? []).filter((s) => {
    if (selectedTagId === 'all') return true
    const contractTagId = tagIdByContract.get(s.contract_id) ?? null
    if (selectedTagId === 'none') return !contractTagId
    return contractTagId === selectedTagId
  })

  const contractIds = [...new Set(surveys.map((s) => s.contract_id))]
  const companyIds = [...new Set(contractIds.map((id) => contractById.get(id)?.company_id).filter((v): v is string => !!v))]
  const contactIds = [...new Set(contractIds.map((id) => contractById.get(id)?.contact_id).filter((v): v is string => !!v))]

  const [{ data: companies }, { data: contacts }] = await Promise.all([
    companyIds.length
      ? supabase.from('companies').select('id, name, trade_name, cnpj').in('id', companyIds)
      : Promise.resolve({ data: [] as { id: string; name: string; trade_name: string | null; cnpj: string | null }[] }),
    contactIds.length
      ? supabase.from('contacts').select('id, name').in('id', contactIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const companyById = new Map((companies ?? []).map((c) => [c.id, c]))
  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]))

  const scores = surveys.map((s) => s.score).filter((s): s is number => s !== null)
  const { nps, promoters, passives, detractors, total } = calculateNps(scores)

  function tagFilterHref(tagId: string) {
    return `/surveys-dashboard?tab=nps&from=${from}&to=${to}&tag=${tagId}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <a href={tagFilterHref('all')} className={`rounded-md px-3 py-1.5 text-sm font-medium ${selectedTagId === 'all' ? 'bg-brand-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            Todas as tags
          </a>
          {allTags?.map((t) => (
            <a
              key={t.id}
              href={tagFilterHref(t.id)}
              className="rounded-full px-3 py-1.5 text-sm font-medium"
              style={selectedTagId === t.id ? { backgroundColor: t.color, color: '#fff' } : { border: '1px solid #D1D5DB', color: '#374151' }}
            >
              {t.name}
            </a>
          ))}
          <a href={tagFilterHref('none')} className={`rounded-md px-3 py-1.5 text-sm font-medium ${selectedTagId === 'none' ? 'bg-brand-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            Sem tag
          </a>
        </div>
        <BulkSendNpsButton />
      </div>

      <PeriodSelector from={from} to={to} basePath="/surveys-dashboard" extraParams={{ tab: 'nps', tag: selectedTagId }} />

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">NPS do período</p>
          <p className={`text-3xl font-semibold ${nps === null ? 'text-gray-300' : nps >= 50 ? 'text-positive-700' : nps >= 0 ? 'text-yellow-700' : 'text-negative-700'}`}>
            {nps === null ? '—' : nps}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Promotores</p>
          <p className="text-3xl font-semibold text-positive-700">{promoters}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Neutros</p>
          <p className="text-3xl font-semibold text-yellow-700">{passives}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Detratores</p>
          <p className="text-3xl font-semibold text-negative-700">{detractors}</p>
        </div>
      </div>

      <p className="text-xs text-gray-400">{total} resposta{total === 1 ? '' : 's'} no período · NPS = % Promotores − % Detratores</p>

      <div className="space-y-2">
        {surveys.map((s) => {
          const contract = contractById.get(s.contract_id)
          const company = contract?.company_id ? companyById.get(contract.company_id) : null
          const contact = contract?.contact_id ? contactById.get(contract.contact_id) : null
          const category = s.score !== null ? categorizeScore(s.score) : null
          const tag = tagById.get(tagIdByContract.get(s.contract_id) ?? '')

          return (
            <ExpandableRow
              key={s.id}
              summary={
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{company?.name ?? contract?.client_name ?? '—'}</span>
                      {tag && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: tag.color }}>
                          {tag.name}
                        </span>
                      )}
                      {category && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${NPS_CATEGORY_STYLES[category]}`}>
                          {NPS_CATEGORY_LABELS[category]} — {s.score}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Respondido por {s.respondent_name ?? contact?.name ?? '—'} em {s.answered_at ? new Date(s.answered_at).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </div>
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-400">CNPJ</p>
                  <p className="font-mono text-gray-700">{company?.cnpj ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">E-mail / Telefone</p>
                  <p className="text-gray-700">{[s.respondent_email, s.respondent_phone].filter(Boolean).join(' · ') || '—'}</p>
                </div>
              </div>
              {s.comment && (
                <div>
                  <p className="text-xs text-gray-400">Comentário</p>
                  <p className="text-sm text-gray-600">&ldquo;{s.comment}&rdquo;</p>
                </div>
              )}
            </ExpandableRow>
          )
        })}
        {surveys.length === 0 && (
          <p className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            Nenhuma resposta de NPS neste período{selectedTagId !== 'all' ? ' com esse filtro' : ''}.
          </p>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Aba Pesquisas Customizadas
// ------------------------------------------------------------
async function SurveysTab({
  supabase,
  from,
  to,
  selectedTemplateId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  from: string
  to: string
  selectedTemplateId?: string
}) {
  const { data: templates } = await supabase
    .from('survey_templates')
    .select('id, name, questions')
    .order('name')

  const templateId = selectedTemplateId ?? templates?.[0]?.id
  const selectedTemplate = templates?.find((t) => t.id === templateId)
  const questions = (selectedTemplate?.questions ?? []) as Question[]

  const { data: responses } = templateId
    ? await supabase
        .from('custom_surveys')
        .select('id, respondent_name, respondent_email, respondent_phone, contract_id, responses, answered_at')
        .eq('template_id', templateId)
        .eq('status', 'answered')
        .gte('answered_at', `${from}T00:00:00`)
        .lte('answered_at', `${to}T23:59:59`)
        .order('answered_at', { ascending: false })
    : { data: [] as { id: string; respondent_name: string | null; respondent_email: string | null; respondent_phone: string | null; contract_id: string; responses: unknown; answered_at: string | null }[] }

  const contractIds = [...new Set((responses ?? []).map((r) => r.contract_id))]
  const { data: contracts } = contractIds.length
    ? await supabase.from('contracts').select('id, client_name, process_number').in('id', contractIds)
    : { data: [] as { id: string; client_name: string; process_number: string }[] }
  const contractById = new Map((contracts ?? []).map((c) => [c.id, c]))

  const responsesWithScore = (responses ?? []).map((r) => ({
    ...r,
    score: calculateResponseScore(questions, r.responses as Record<string, string | string[]> | null),
  }))

  const averageScore = calculateAverageScore(responsesWithScore.map((r) => r.score))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {templates?.map((t) => (
          <a
            key={t.id}
            href={`/surveys-dashboard?tab=surveys&template=${t.id}&from=${from}&to=${to}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${t.id === templateId ? 'bg-brand-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t.name}
          </a>
        ))}
        {(!templates || templates.length === 0) && (
          <p className="text-sm text-gray-400">Nenhum formulário criado ainda — crie um em &quot;Formulários&quot;.</p>
        )}
      </div>

      {templateId && (
        <>
          <PeriodSelector from={from} to={to} basePath="/surveys-dashboard" extraParams={{ tab: 'surveys', template: templateId }} />

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">Pontuação média do período</p>
              {averageScore ? (
                <p className="text-3xl font-semibold text-brand-700">{averageScore.value} <span className="text-base font-normal text-gray-400">/ {averageScore.max}</span></p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">Sem perguntas de nota/satisfação neste formulário, ou sem respostas no período.</p>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">Respostas no período</p>
              <p className="text-3xl font-semibold text-gray-900">{responsesWithScore.length}</p>
            </div>
          </div>

          <div className="space-y-2">
            {responsesWithScore.map((r) => {
              const contract = contractById.get(r.contract_id)
              return (
                <ExpandableRow
                  key={r.id}
                  summary={
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{r.respondent_name}</span>
                        {r.score && (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                            {r.score.scale === 'likert' ? 'Satisfação' : 'Nota'} {r.score.value}/{r.score.max}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {contract ? `${contract.client_name} · ${contract.process_number}` : '—'} · {r.answered_at ? new Date(r.answered_at).toLocaleDateString('pt-BR') : '—'}
                      </p>
                    </div>
                  }
                >
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-400">E-mail / Telefone</p>
                      <p className="text-gray-700">{[r.respondent_email, r.respondent_phone].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-gray-100 pt-2">
                    {questions.map((q) => {
                      const answer = (r.responses as Record<string, string | string[]> | null)?.[q.id]
                      const display = Array.isArray(answer) ? (answer.length ? answer.join(', ') : '—') : (answer || '—')
                      return (
                        <div key={q.id}>
                          <p className="text-xs font-medium text-gray-500">{q.label}</p>
                          <p className="text-sm text-gray-700">{display}</p>
                        </div>
                      )
                    })}
                  </div>
                </ExpandableRow>
              )
            })}
            {responsesWithScore.length === 0 && (
              <p className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
                Nenhuma resposta neste período.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
