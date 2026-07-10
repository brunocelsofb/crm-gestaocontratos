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
  const note = (formData.get('note') as string) || null

  if (!toDepartment) return { error: 'Selecione o departamento de destino.' }

  const { data: contract } = await supabase
    .from('contracts')
    .select('current_department')
    .eq('id', contractId)
    .single()

  const fromLabel = departmentLabel(contract?.current_department ?? null)
  const toLabel = departmentLabel(toDepartment)

  await supabase.from('contracts').update({ current_department: toDepartment }).eq('id', contractId)

  await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type: 'transfer',
    content: `Transferido de ${fromLabel} para ${toLabel}.${note ? ` Nota: ${note}` : ''}`,
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
