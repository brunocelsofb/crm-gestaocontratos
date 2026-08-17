import { createClient } from '@/lib/supabase/server'
import { FormsEditor } from '@/components/surveys/forms-editor'

export default async function FormsSettingsPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('survey_templates')
    .select('id, name, category, questions, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Editor de Formulários</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Crie e edite formulários de pesquisa (NPS, Likert, Texto, Sim/Não).
          Use em contratos ou mini-pesquisas de serviços avulsos.
        </p>
      </div>
      <FormsEditor initialTemplates={templates ?? []} />
    </div>
  )
}
