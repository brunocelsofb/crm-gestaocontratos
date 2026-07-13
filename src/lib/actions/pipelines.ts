'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCurrentUserAdmin } from '@/lib/auth/role'

export type ActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function createPipeline(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string) || null
  const type = (formData.get('type') as string) === 'vendas' ? 'vendas' : 'gestao_contratos'

  if (!name) return { fieldErrors: { name: ['Nome é obrigatório'] } }

  const { error } = await supabase.from('pipelines').insert({ name, description, type, is_default: false })
  if (error) return { error: error.message }

  revalidatePath('/pipelines')
  return {}
}

export async function updatePipelineInfo(pipelineId: string, formData: FormData) {
  const supabase = await createClient()
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string) || null
  const typeRaw = formData.get('type') as string
  const type = typeRaw === 'vendas' || typeRaw === 'servico_avulso' ? typeRaw : 'gestao_contratos'
  const won_label = (formData.get('won_label') as string)?.trim() || 'Ganho'
  const lost_label = (formData.get('lost_label') as string)?.trim() || 'Perdido'
  const won_target_pipeline_id = (formData.get('won_target_pipeline_id') as string) || null
  const renewal_trigger_days_raw = formData.get('renewal_trigger_days') as string
  const renewal_trigger_days = renewal_trigger_days_raw ? Number(renewal_trigger_days_raw) : null
  const renewal_target_stage_id = (formData.get('renewal_target_stage_id') as string) || null

  if (!name) return // nome vazio não é salvo — mantém o anterior

  await supabase
    .from('pipelines')
    .update({
      name,
      description,
      type,
      won_label,
      lost_label,
      won_target_pipeline_id,
      renewal_trigger_days,
      renewal_target_stage_id,
    })
    .eq('id', pipelineId)
  revalidatePath('/pipelines')
}

export async function deletePipeline(pipelineId: string) {
  if (!(await isCurrentUserAdmin())) return
  // Uso o cliente com service_role aqui (em vez do cliente normal, que
  // depende de RLS) porque a checagem de "é admin?" já aconteceu na
  // linha acima — não precisamos repetir essa verificação via política
  // de banco, e isso evita depender de uma regra de RLS mais frágil
  // (que consulta outra tabela dentro dela mesma).
  const supabase = createAdminClient()
  await supabase.from('pipelines').delete().eq('id', pipelineId)
  revalidatePath('/pipelines')
  // NOTA: erros aqui (ex: pipeline com contratos ativos, bloqueado por FK)
  // não têm como ser mostrados nesta função simples de form action sem
  // estado — a exclusão simplesmente não acontece e a tela recarrega
  // mostrando o funil ainda ali. Se isso for confuso na prática, vale
  // evoluir para useActionState com mensagem de erro explícita.
}

export async function createStage(pipelineId: string, formData: FormData) {
  const supabase = await createClient()
  const name = (formData.get('name') as string)?.trim()
  if (!name) return

  const { data: existing } = await supabase
    .from('stages')
    .select('order_index')
    .eq('pipeline_id', pipelineId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (existing?.order_index ?? 0) + 1

  await supabase.from('stages').insert({
    pipeline_id: pipelineId,
    name,
    order_index: nextOrder,
    color: '#6B7280',
  })

  revalidatePath('/pipelines')
}

export async function updateStage(stageId: string, formData: FormData) {
  const supabase = await createClient()
  const name = (formData.get('name') as string)?.trim()
  const color = (formData.get('color') as string) || '#6B7280'
  const slaRaw = formData.get('sla_days') as string
  const sla_days = slaRaw ? Number(slaRaw) : null
  const is_won = formData.get('is_won') === 'on'
  const is_lost = formData.get('is_lost') === 'on'

  if (!name) return

  await supabase
    .from('stages')
    .update({ name, color, sla_days, is_won, is_lost })
    .eq('id', stageId)

  revalidatePath('/pipelines')
}

export type DeleteStageState = { error?: string; success?: boolean }

export async function deleteStage(
  stageId: string,
  _prevState: DeleteStageState,
  _formData: FormData
): Promise<DeleteStageState> {
  const isAdmin = await isCurrentUserAdmin()
  if (!isAdmin) return { error: 'Você não tem permissão de administrador para excluir etapas.' }

  const supabase = createAdminClient()

  const { data: openRun } = await supabase
    .from('pipeline_runs')
    .select('id')
    .eq('stage_id', stageId)
    .eq('status', 'open')
    .maybeSingle()

  if (openRun) {
    return { error: 'Existe um contrato ativo nesta etapa agora. Mova-o antes de excluir.' }
  }

  const { error } = await supabase.from('stages').delete().eq('id', stageId)

  if (error) {
    return { error: `Falha ao excluir: ${error.message} (código: ${error.code ?? 'desconhecido'})` }
  }

  revalidatePath('/pipelines')
  return { success: true }
}

export async function moveStage(stageId: string, direction: 'up' | 'down') {
  const supabase = await createClient()

  const { data: stage } = await supabase
    .from('stages')
    .select('id, pipeline_id, order_index')
    .eq('id', stageId)
    .single()

  if (!stage) return

  const { data: neighbor } = await supabase
    .from('stages')
    .select('id, order_index')
    .eq('pipeline_id', stage.pipeline_id)
    .order('order_index', { ascending: direction === 'up' ? false : true })
    .lt('order_index', direction === 'up' ? stage.order_index : Number.MAX_SAFE_INTEGER)
    .gt('order_index', direction === 'down' ? stage.order_index : -1)
    .limit(1)
    .maybeSingle()

  if (!neighbor) return

  // Troca as posições (swap simples de order_index entre os dois vizinhos)
  await supabase.from('stages').update({ order_index: neighbor.order_index }).eq('id', stage.id)
  await supabase.from('stages').update({ order_index: stage.order_index }).eq('id', neighbor.id)

  revalidatePath('/pipelines')
}
