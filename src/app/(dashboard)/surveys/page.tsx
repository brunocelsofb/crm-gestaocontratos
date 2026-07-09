import { createClient } from '@/lib/supabase/server'
import { SurveyTemplateForm } from '@/components/surveys/survey-template-form'
import { ConfirmDeleteButton } from '@/components/pipelines/confirm-delete-button'
import { deleteSurveyTemplate } from '@/lib/actions/custom-surveys'
import type { Question } from '@/lib/actions/custom-surveys'

export default async function SurveysPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('survey_templates')
    .select('id, name, questions, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Formulários de Pesquisa</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Crie formulários customizados (além do NPS) para enviar aos seus clientes a partir de um contrato.
        </p>
      </div>

      <SurveyTemplateForm />

      <div className="space-y-2">
        {templates?.map((t) => {
          const questions = (t.questions ?? []) as Question[]
          return (
            <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{questions.length} pergunta(s)</p>
                </div>
                <form action={deleteSurveyTemplate.bind(null, t.id)}>
                  <ConfirmDeleteButton confirmMessage={`Excluir o formulário "${t.name}"?`} />
                </form>
              </div>
              <ul className="mt-2 space-y-1">
                {questions.map((q) => (
                  <li key={q.id} className="text-xs text-gray-500">• {q.label}</li>
                ))}
              </ul>
            </div>
          )
        })}
        {templates?.length === 0 && (
          <p className="text-sm text-gray-400">Nenhum formulário criado ainda.</p>
        )}
      </div>
    </div>
  )
}
