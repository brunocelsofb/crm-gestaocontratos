import { createAdminClient } from '@/lib/supabase/admin'
import { TabOrderEditorByPipeline } from '@/components/settings/tab-order-editor'

export const ALL_CONTRACT_TABS = [
  { id: 'visao-geral', label: 'Visão Geral' },
  { id: 'atividades', label: 'Atividades' },
  { id: 'emails', label: 'E-mails' },
  { id: 'arquivos', label: 'Arquivos' },
  { id: 'implantacao', label: '🚀 Implantação' },
  { id: 'pesquisas', label: 'Pesquisas' },
  { id: 'carteira', label: 'Carteira' },
]

// Detecta o perfil de um pipeline pelo nome
function getPipelineProfile(name: string): 'contratos' | 'vendas' | 'avulso' {
  const n = name.toLowerCase()
  if (n.includes('contrato') || n.includes('gestão')) return 'contratos'
  if (n.includes('avulso')) return 'avulso'
  return 'vendas' // Mercado Privado, Mercado Público, Novos Negócios etc.
}

export function getDefaultHidden(pipelineName: string): string[] {
  const profile = getPipelineProfile(pipelineName)
  if (profile === 'contratos') return [] // tudo visível
  if (profile === 'avulso') return ['implantacao', 'pesquisas', 'carteira', 'emails']
  return ['implantacao', 'carteira', 'pesquisas'] // vendas: sem implantação, carteira, pesquisas
}

export default async function LayoutAbasPage() {
  const admin = createAdminClient()
  const [{ data: settings }, { data: pipelines }] = await Promise.all([
    admin.from('organization_settings').select('pipeline_tab_config').eq('id', 'default').maybeSingle(),
    admin.from('pipelines').select('id, name').order('name'),
  ])

  const config = (settings as any)?.pipeline_tab_config ?? {}

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Layout das Abas por Funil</h1>
        <p className="mt-0.5 text-sm text-gray-500">Configure a ordem e visibilidade das abas para cada funil de Contratos.</p>
      </div>
      <TabOrderEditorByPipeline
        allTabs={ALL_CONTRACT_TABS}
        pipelines={(pipelines ?? []) as { id: string; name: string }[]}
        savedConfig={config}
        getDefaultHidden={getDefaultHidden}
      />
    </div>
  )
}
