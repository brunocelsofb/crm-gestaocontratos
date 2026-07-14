import { createClient } from '@/lib/supabase/server'
import { createCompany } from '@/lib/actions/companies'
import { moveContractStage } from '@/lib/actions/pipeline'

export async function executeWriteTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ summary: string; error?: string; contractId?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { summary: '', error: 'Usuário não autenticado.' }

  if (name === 'create_company') {
    const formData = new FormData()
    formData.set('name', String(input.name ?? ''))
    if (input.trade_name) formData.set('trade_name', String(input.trade_name))
    if (input.cnpj) formData.set('cnpj', String(input.cnpj))

    const result = await createCompany({}, formData)
    if (result.error) return { summary: '', error: result.error }
    return { summary: `Empresa "${input.name}" criada.` }
  }

  if (name === 'add_note') {
    const contractId = String(input.contract_id ?? '')
    const content = String(input.content ?? '')

    const { error } = await supabase.from('activities').insert({
      contract_id: contractId,
      user_id: user.id,
      type: 'note',
      content,
    })
    if (error) return { summary: '', error: error.message }
    return { summary: 'Nota adicionada ao histórico do contrato.', contractId }
  }

  if (name === 'move_contract_stage') {
    const contractId = String(input.contract_id ?? '')
    const stageName = String(input.stage_name ?? '')

    const { data: run } = await supabase
      .from('pipeline_runs')
      .select('pipeline_id')
      .eq('contract_id', contractId)
      .eq('status', 'open')
      .maybeSingle()

    if (!run) return { summary: '', error: 'Este contrato não tem passagem de funil em aberto.' }

    const { data: stage } = await supabase
      .from('stages')
      .select('id')
      .eq('pipeline_id', run.pipeline_id)
      .ilike('name', stageName)
      .maybeSingle()

    if (!stage) return { summary: '', error: `Não encontrei uma etapa chamada "${stageName}" nesse funil.` }

    const result = await moveContractStage(contractId, stage.id)
    if (result.error) return { summary: '', error: result.error }
    return { summary: `Contrato movido para a etapa "${stageName}".`, contractId }
  }

  return { summary: '', error: 'Ferramenta desconhecida.' }
}
