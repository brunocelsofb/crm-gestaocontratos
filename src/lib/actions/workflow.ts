'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { departmentLabel } from '@/lib/constants/departments'

export type ActionState = { error?: string }

// ------------------------------------------------------------
// Transferência entre departamentos
// ------------------------------------------------------------
export async function transferContract(
  contractId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const toDepartment = formData.get('department') as string
  const toAssigneeId = (formData.get('assignee_id') as string) || null
  const note = (formData.get('note') as string) || null

  if (!toDepartment) return { error: 'Selecione o departamento de destino.' }

  const { data: contract } = await supabase
    .from('contracts')
    .select('current_department, current_assignee_id')
    .eq('id', contractId)
    .single()

  const fromLabel = departmentLabel(contract?.current_department ?? null)
  const toLabel = departmentLabel(toDepartment)

  let toAssigneeName: string | null = null
  if (toAssigneeId) {
    const { data: assignee } = await supabase.from('profiles').select('full_name').eq('id', toAssigneeId).maybeSingle()
    toAssigneeName = assignee?.full_name ?? null
  }

  // Guarda o estado ANTERIOR antes de sobrescrever — é isso que permite
  // o botão "Devolver" funcionar depois, sem precisar vasculhar histórico.
  await supabase
    .from('contracts')
    .update({
      current_department: toDepartment,
      current_assignee_id: toAssigneeId,
      previous_department: contract?.current_department ?? null,
      previous_assignee_id: contract?.current_assignee_id ?? null,
    })
    .eq('id', contractId)

  const destinationText = toAssigneeName ? `${toLabel} (${toAssigneeName})` : toLabel

  await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type: 'transfer',
    content: `Transferido de ${fromLabel} para ${destinationText}.${note ? ` Nota: ${note}` : ''}`,
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/pipeline')
  revalidatePath('/contracts')
  return {}
}

// "Devolver": manda de volta pra quem estava responsável ANTES da
// última transferência — o "ele trata e retorna pra nós" de um clique só.
// Aceita uma nota descrevendo o que foi tratado, pra ficar registrado
// junto do pedido original (feito na hora de transferir).
export async function returnContract(contractId: string, note: string): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const { data: contract } = await supabase
    .from('contracts')
    .select('current_department, current_assignee_id, previous_department, previous_assignee_id')
    .eq('id', contractId)
    .single()

  if (!contract?.previous_department) {
    return { error: 'Não há um responsável anterior registrado para devolver.' }
  }

  const fromLabel = departmentLabel(contract.current_department)
  const toLabel = departmentLabel(contract.previous_department)

  let toAssigneeName: string | null = null
  if (contract.previous_assignee_id) {
    const { data: assignee } = await supabase.from('profiles').select('full_name').eq('id', contract.previous_assignee_id).maybeSingle()
    toAssigneeName = assignee?.full_name ?? null
  }

  await supabase
    .from('contracts')
    .update({
      current_department: contract.previous_department,
      current_assignee_id: contract.previous_assignee_id,
      previous_department: contract.current_department,
      previous_assignee_id: contract.current_assignee_id,
    })
    .eq('id', contractId)

  const destinationText = toAssigneeName ? `${toLabel} (${toAssigneeName})` : toLabel

  await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type: 'transfer',
    content: `Devolvido de ${fromLabel} para ${destinationText}.${note ? ` Tratativa: ${note}` : ''}`,
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/pipeline')
  revalidatePath('/contracts')
  return {}
}

// ------------------------------------------------------------
// Plano de Ação
// ------------------------------------------------------------
export async function createActionPlanItem(
  contractId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const description = (formData.get('description') as string)?.trim()
  const responsible_department = (formData.get('responsible_department') as string) || null

  if (!description) return { error: 'Descreva a ação.' }

  const { error } = await supabase.from('action_plan_items').insert({
    contract_id: contractId,
    description,
    responsible_department,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type: 'system',
    content: `Item adicionado ao plano de ação: "${description}"`,
  })

  revalidatePath(`/contracts/${contractId}`)
  return {}
}

export async function updateActionPlanItemStatus(itemId: string, contractId: string, status: string) {
  const supabase = await createClient()
  await supabase
    .from('action_plan_items')
    .update({ status, resolved_at: status === 'done' ? new Date().toISOString() : null })
    .eq('id', itemId)
  revalidatePath(`/contracts/${contractId}`)
}

export async function deleteActionPlanItem(itemId: string, contractId: string) {
  const supabase = await createClient()
  await supabase.from('action_plan_items').delete().eq('id', itemId)
  revalidatePath(`/contracts/${contractId}`)
}

// ------------------------------------------------------------
// Aprovação de dimensionamento (funil de vendas)
// ------------------------------------------------------------
export async function sendDimensioningReview(
  contractId: string,
  filePath: string,
  fileName: string
): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const { error } = await supabase.from('dimensioning_reviews').insert({
    contract_id: contractId,
    file_storage_path: filePath,
    file_name: fileName,
    sent_by: user.id,
  })

  if (error) return { error: error.message }

  await supabase.from('contracts').update({ current_department: 'tecnico' }).eq('id', contractId)

  await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type: 'transfer',
    content: `Dimensionamento enviado para o time técnico (arquivo: ${fileName}). Transferido de Comercial para Técnico / Operação.`,
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/pipeline')
  return {}
}

export async function reviewDimensioning(
  reviewId: string,
  contractId: string,
  decision: 'acknowledged_ok' | 'acknowledged_disagree',
  notes: string
): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const { error } = await supabase
    .from('dimensioning_reviews')
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: notes || null,
    })
    .eq('id', reviewId)

  if (error) return { error: error.message }

  const label = decision === 'acknowledged_ok' ? 'DE ACORDO' : 'NÃO DE ACORDO'

  await supabase.from('contracts').update({ current_department: 'comercial' }).eq('id', contractId)

  await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type: 'transfer',
    content: `Time técnico deu ciência do dimensionamento: ${label}.${notes ? ` Observação: ${notes}` : ''} Transferido de volta para Comercial.`,
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/pipeline')
  return {}
}
