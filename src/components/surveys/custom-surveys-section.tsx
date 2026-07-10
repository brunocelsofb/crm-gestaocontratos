import { sendCustomSurvey } from '@/lib/actions/custom-surveys'
import { CopyLinkButton } from '@/components/nps/copy-link-button'
import { calculateResponseScore } from '@/lib/utils/survey-score'
import type { Question } from '@/lib/actions/custom-surveys'

type Template = { id: string; name: string; tag_id: string | null; questions: Question[] }
type SentSurvey = {
  id: string
  token: string
  status: string
  sent_at: string
  answered_at: string | null
  respondent_name: string | null
  template_id: string
  responses: Record<string, string | string[]> | null
}

// PERFORMANCE: também virou apresentacional — mesma lógica do NpsSection.
export function CustomSurveysSection({
  contractId,
  templates,
  sentSurveys,
  linkBase,
}: {
  contractId: string
  templates: Template[]
  sentSurveys: SentSurvey[]
  linkBase: string
}) {
  const templateById = new Map(templates.map((t) => [t.id, t]))

  if (templates.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-gray-900">Formulários de Pesquisa</h2>
        <p className="text-sm text-gray-400">
          Nenhum formulário disponível para este contrato — crie um em &quot;Formulários&quot; no menu lateral (ou confira se a tag do contrato bate com a do formulário).
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
        {sentSurveys.map((s) => {
          const link = `${linkBase}/survey/${s.token}`
          const template = templateById.get(s.template_id)
          const templateName = template?.name ?? 'Formulário'
          const score = s.status === 'answered' ? calculateResponseScore(template?.questions ?? [], s.responses) : null
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
