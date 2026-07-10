import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { sendCustomSurvey } from '@/lib/actions/custom-surveys'
import { CopyLinkButton } from '@/components/nps/copy-link-button'
import { calculateResponseScore } from '@/lib/utils/survey-score'
import type { Question } from '@/lib/actions/custom-surveys'

export async function CustomSurveysSection({ contractId }: { contractId: string }) {
  const supabase = await createClient()

  const [{ data: allTemplates }, { data: sentSurveys }, { data: contractTagRows }] = await Promise.all([
    supabase.from('survey_templates').select('id, name, tag_id, questions').order('name'),
    supabase
      .from('custom_surveys')
      .select('id, token, status, sent_at, answered_at, respondent_name, template_id, responses')
      .eq('contract_id', contractId)
      .order('sent_at', { ascending: false }),
    supabase.from('contract_tags').select('tag_id').eq('contract_id', contractId),
  ])

  const contractTagId = contractTagRows?.[0]?.tag_id ?? null

  // Só mostra formulários sem tag (gerais) ou da MESMA tag do contrato —
  // é isso que garante que "Engenharia Clínica" não veja formulário de
  // "Engenharia Hospitalar" e vice-versa.
  const templates = (allTemplates ?? []).filter((t) => !t.tag_id || t.tag_id === contractTagId)

  const templateById = new Map((allTemplates ?? []).map((t) => [t.id, t]))

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'

  if (!templates || templates.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-gray-900">Formulários de Pesquisa</h2>
        <p className="text-sm text-gray-400">
          Nenhum formulário criado ainda — crie um em &quot;Formulários&quot; no menu lateral.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-gray-900">Formulários de Pesquisa</h2>

      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <form key={t.id} action={sendCustomSurvey.bind(null, contractId, t.id)}>
            <button
              type="submit"
              className="rounded-md border border-brand-700 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              + Enviar &quot;{t.name}&quot;
            </button>
          </form>
        ))}
      </div>

      <div className="space-y-2">
        {sentSurveys?.map((s) => {
          const link = `${protocol}://${host}/survey/${s.token}`
          const template = templateById.get(s.template_id)
          const templateName = template?.name ?? 'Formulário'
          const score =
            s.status === 'answered'
              ? calculateResponseScore((template?.questions ?? []) as Question[], s.responses as Record<string, string | string[]> | null)
              : null
          return (
            <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{templateName}</span>
                <div className="flex items-center gap-2">
                  {score !== null && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                      Nota {score}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      s.status === 'answered' ? 'bg-positive-100 text-positive-700' : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {s.status === 'answered' ? `Respondido por ${s.respondent_name}` : 'Pendente'}
                  </span>
                </div>
              </div>
              {s.status === 'pending' && (
                <div className="mt-2 flex items-center gap-2">
                  <input readOnly value={link} className="flex-1 truncate rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500" />
                  <CopyLinkButton link={link} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
