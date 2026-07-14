import { createClient } from '@/lib/supabase/server'
import { ProposalTemplatesManager } from '@/components/proposals/proposal-templates-manager'

export default async function ProposalTemplatesPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('proposal_templates')
    .select('id, name, file_name, page_count')
    .order('name')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Modelos de Capa (Propostas)</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          PDFs de apresentação/capa reutilizáveis — na hora de montar uma proposta, você escolhe a ordem delas e onde a página de dados entra.
        </p>
      </div>
      <ProposalTemplatesManager initialTemplates={templates ?? []} />
    </div>
  )
}
