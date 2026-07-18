import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SurveyTemplateForm } from '@/components/surveys/survey-template-form'
import { ConfirmDeleteButton } from '@/components/pipelines/confirm-delete-button'
import { deleteSurveyTemplate, duplicateSurveyTemplate } from '@/lib/actions/custom-surveys'
import type { Question } from '@/lib/actions/custom-surveys'

export default async function SurveysPage() {
  const supabase = await createClient()
  const [{ data: templates }, { data: tags }] = await Promise.all([
    supabase.from('survey_templates').select('id, name, questions, tag_id, created_at').order('created_at', { ascending: false }),
    supabase.from('tags').select('id, name, color').order('name'),
  ])

  const tagById = new Map((tags ?? []).map((t) => [t.id, t]))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: "#1a1f36", margin: 0 }}>Formulários de Pesquisa</h1>
        <p style={{ fontSize: 12, color: "#8892a4", marginTop: 3 }}>
          Crie formulários customizados (além do NPS) para enviar aos seus clientes a partir de um contrato.
        </p>
      </div>

      <SurveyTemplateForm tags={tags ?? []} />

      <div className="space-y-2">
        {templates?.map((t) => {
          const questions = (t.questions ?? []) as Question[]
          const tag = t.tag_id ? tagById.get(t.tag_id) : null
          return (
            <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    {tag && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: tag.color }}>
                        {tag.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{questions.length} pergunta(s)</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/surveys/${t.id}/edit`} className="text-xs text-gray-500 hover:underline">
                    Editar
                  </Link>
                  <form action={duplicateSurveyTemplate.bind(null, t.id)}>
                    <button type="submit" className="text-xs text-brand-700 hover:underline">
                      Duplicar
                    </button>
                  </form>
                  <form action={deleteSurveyTemplate.bind(null, t.id)}>
                    <ConfirmDeleteButton confirmMessage={`Excluir o formulário "${t.name}"?`} />
                  </form>
                </div>
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
