import { createClient } from '@/lib/supabase/server'
import { ProposalCatalogManager } from '@/components/proposals/proposal-catalog-manager'

export default async function ProposalCatalogPage() {
  const supabase = await createClient()
  const { data: items } = await supabase
    .from('proposal_catalog_items')
    .select('id, name, category, type, characteristics, unit_value')
    .order('name')

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Catálogo de Produtos e Serviços</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Cadastre uma vez, escolha na hora de montar uma proposta — sem precisar digitar tudo do zero cada vez.
        </p>
      </div>
      <ProposalCatalogManager initialItems={items ?? []} />
    </div>
  )
}
