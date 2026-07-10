import { createClient } from '@/lib/supabase/server'
import { PeriodSelector } from '@/components/dashboard/period-selector'
import { calculateResponseScore, calculateAverageScore } from '@/lib/utils/survey-score'
import type { Question } from '@/lib/actions/custom-surveys'

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
  searchParams: Promise<{ template?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const defaultRange = currentQuarterRange()
  const from = params.from ?? defaultRange.from
  const to = params.to ?? defaultRange.to

  const supabase = await createClient()

  const { data: templates } = await supabase
    .from('survey_templates')
    .select('id, name, questions')
    .order('name')

  const selectedTemplateId = params.template ?? templates?.[0]?.id
  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId)

  const { data: responses } = selectedTemplateId
    ? await supabase
        .from('custom_surveys')
        .select('id, respondent_name, respondent_email, contract_id, responses, answered_at')
        .eq('template_id', selectedTemplateId)
        .eq('status', 'answered')
        .gte('answered_at', `${from}T00:00:00`)
        .lte('answered_at', `${to}T23:59:59`)
        .order('answered_at', { ascending: false })
    : { data: [] as { id: string; respondent_name: string | null; respondent_email: string | null; contract_id: string; responses: unknown; answered_at: string | null }[] }

  const contractIds = [...new Set((responses ?? []).map((r) => r.contract_id))]
  const { data: contracts } = contractIds.length
    ? await supabase.from('contracts').select('id, client_name, process_number').in('id', contractIds)
    : { data: [] as { id: string; client_name: string; process_number: string }[] }
  const contractById = new Map((contracts ?? []).map((c) => [c.id, c]))

  const questions = (selectedTemplate?.questions ?? []) as Question[]
  const hasRatingQuestion = questions.some((q) => q.type === 'rating')

  const responsesWithScore = (responses ?? []).map((r) => ({
    ...r,
    score: calculateResponseScore(questions, r.responses as Record<string, string | string[]> | null),
  }))

  const averageScore = calculateAverageScore(responsesWithScore.map((r) => r.score))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Dashboard de Pesquisas</h1>
        <p className="mt-0.5 text-sm text-gray-500">Consolidado dos formulários de pesquisa, por período.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {templates?.map((t) => (
          <a
            key={t.id}
            href={`/surveys-dashboard?template=${t.id}&from=${from}&to=${to}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              t.id === selectedTemplateId ? 'bg-brand-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.name}
          </a>
        ))}
        {(!templates || templates.length === 0) && (
          <p className="text-sm text-gray-400">Nenhum formulário criado ainda — crie um em &quot;Formulários&quot;.</p>
        )}
      </div>

      {selectedTemplateId && (
        <>
          <PeriodSelector
            from={from}
            to={to}
            basePath="/surveys-dashboard"
            extraParams={{ template: selectedTemplateId }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">Pontuação média do período</p>
              {hasRatingQuestion ? (
                <p className="text-3xl font-semibold text-brand-700">{averageScore ?? '—'}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">Este formulário não tem pergunta de nota — sem pontuação numérica pra calcular.</p>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">Respostas no período</p>
              <p className="text-3xl font-semibold text-gray-900">{responsesWithScore.length}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Respondente</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Contrato</th>
                  {hasRatingQuestion && <th className="px-4 py-3 text-left font-medium text-gray-500">Pontuação</th>}
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {responsesWithScore.map((r) => {
                  const contract = contractById.get(r.contract_id)
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{r.respondent_name}</div>
                        <div className="text-xs text-gray-400">{r.respondent_email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {contract ? `${contract.client_name} · ${contract.process_number}` : '—'}
                      </td>
                      {hasRatingQuestion && (
                        <td className="px-4 py-3">
                          {r.score !== null ? (
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">{r.score}</span>
                          ) : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right text-gray-500">
                        {r.answered_at ? new Date(r.answered_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  )
                })}
                {responsesWithScore.length === 0 && (
                  <tr>
                    <td colSpan={hasRatingQuestion ? 4 : 3} className="px-4 py-8 text-center text-gray-400">
                      Nenhuma resposta neste período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
