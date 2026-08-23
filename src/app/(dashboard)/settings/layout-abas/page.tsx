import { createAdminClient } from '@/lib/supabase/admin'
import { TabOrderEditor } from '@/components/settings/tab-order-editor'

export const ALL_CONTRACT_TABS = [
  { id: 'visao-geral', label: 'Visão Geral' },
  { id: 'atividades', label: 'Atividades' },
  { id: 'arquivos', label: 'Arquivos' },
  { id: 'implantacao', label: '🚀 Implantação' },
  { id: 'emails', label: 'Emails' },
  { id: 'pesquisas', label: 'Pesquisas' },
  { id: 'carteira', label: 'Carteira' },
]

export default async function LayoutAbasPage() {
  const admin = createAdminClient()
  const { data } = await admin.from('organization_settings').select('contract_tab_order').eq('id', 'default').maybeSingle()
  const currentOrder: string[] = (data as any)?.contract_tab_order ?? ALL_CONTRACT_TABS.map(t => t.id)

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Layout das Abas</h1>
        <p className="mt-0.5 text-sm text-gray-500">Defina a ordem de exibição das abas na página de Contratos.</p>
      </div>
      <TabOrderEditor allTabs={ALL_CONTRACT_TABS} currentOrder={currentOrder} />
    </div>
  )
}
