import { sendCustomSurvey } from '@/lib/actions/custom-surveys'
import { CopyLinkButton } from '@/components/nps/copy-link-button'
import { ExpandableRow } from '@/components/surveys/expandable-row'
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
  respondent_email?: string | null
  respondent_phone?: string | null
  template_id: string
  responses: Record<string, string | string[]> | null
}

function formatAnswer(value: string | string[] | undefined) {
  if (!value) return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  return value
}

// PERFORMANCE: também virou apresentacional — mesma lógica do NpsSection.
export function CustomSurveysSection({
  contractId,
  templates,
  allTemplates,
  sentSurveys,
  linkBase,
}: {
  contractId: string
  templates: Template[]
  allTemplates: Template[]
  sentSurveys: SentSurvey[]
  linkBase: string
}) {
  // IMPORTANTE: o mapa usado para EXIBIR respostas já enviadas usa a
  // lista COMPLETA de formulários (allTemplates), não a lista filtrada
  // por tag (templates) — senão, se a tag do contrato mudar depois que
  // uma pesquisa foi respondida, o formulário "some" da exibição mesmo
  // a resposta já existindo. O filtro por tag só vale pra decidir quais
  // botões de "+ Enviar" aparecem, nunca pra esconder histórico.
  const templateById = new Map(allTemplates.map((t) => [t.id, t]))

  if (templates.length === 0 && sentSurveys.length === 0) {
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
          const questions = template?.questions ?? []
          const score = s.status === 'answered' ? calculateResponseScore(questions, s.responses) : null

          if (s.status === 'pending') {
            return (
              <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{templateName}</span>
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800">Pendente</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input readOnly value={link} className="flex-1 truncate rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500" />
                  <CopyLinkButton link={link} />
                </div>
              </div>
            )
          }

          return (
            <ExpandableRow
              key={s.id}
              summary={
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{templateName}</span>
                    {score !== null && (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                        Nota {score}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Respondido por <span className="font-medium text-gray-700">{s.respondent_name}</span> em{' '}
                    {s.answered_at ? new Date(s.answered_at).toLocaleDateString('pt-BR') : '—'}
                  </p>
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-400">Respondente</p>
                  <p className="text-gray-700">{s.respondent_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">E-mail / Telefone</p>
                  <p className="text-gray-700">{[s.respondent_email, s.respondent_phone].filter(Boolean).join(' · ') || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Enviada em</p>
                  <p className="text-gray-700">{new Date(s.sent_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-gray-400">Respondida em</p>
                  <p className="text-gray-700">{s.answered_at ? new Date(s.answered_at).toLocaleDateString('pt-BR') : '—'}</p>
                </div>
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-2">
                {questions.map((q) => (
                  <div key={q.id}>
                    <p className="text-xs font-medium text-gray-500">{q.label}</p>
                    <p className="text-sm text-gray-700">{formatAnswer(s.responses?.[q.id])}</p>
                  </div>
                ))}
              </div>
            </ExpandableRow>
          )
        })}
      </div>
    </div>
  )
}
