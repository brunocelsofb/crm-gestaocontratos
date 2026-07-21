'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActivityType = 'note' | 'call' | 'email' | 'whatsapp' | 'meeting' | 'task' | 'internal' | 'reminder'

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  note:     '📝 Nota',
  call:     '📞 Ligação',
  email:    '✉ E-mail',
  whatsapp: '💬 WhatsApp',
  meeting:  '🤝 Reunião',
  task:     '✅ Tarefa',
  internal: '🔧 Atividade Interna',
  reminder: '🔔 Lembrete',
}

export type CreateActivityInput = {
  contractId?: string | null
  companyId?: string | null
  pipelineRunId?: string | null
  title: string
  content: string
  activityType: ActivityType
  status: 'planned' | 'done'
  activityDate?: string | null
  activityTime?: string | null
  durationMinutes?: number | null
  reminderMinutes?: number | null
  assignedTo?: string | null
  participants?: string[]
}

export async function createActivity(input: CreateActivityInput): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  if (!input.contractId && !input.companyId) return { error: 'Informe uma oportunidade ou empresa.' }
  if (!input.title?.trim() && !input.content?.trim()) return { error: 'Título ou descrição são obrigatórios.' }

  const { data, error } = await supabase.from('activities').insert({
    contract_id:       input.contractId ?? null,
    company_id:        input.companyId ?? null,
    pipeline_run_id:   input.pipelineRunId ?? null,
    user_id:           user.id,
    type:              input.activityType === 'note' ? 'note' : 'task',
    activity_type:     input.activityType,
    title:             input.title?.trim() || null,
    content:           input.content?.trim() || '',
    status:            input.status,
    activity_date:     input.activityDate || null,
    activity_time:     input.activityTime || null,
    duration_minutes:  input.durationMinutes ?? null,
    reminder_minutes:  input.reminderMinutes ?? null,
    assigned_to:       input.assignedTo ?? user.id,
    participants:      input.participants?.length ? input.participants : null,
    completed:         input.status === 'done',
  }).select('id').single()

  if (error) return { error: error.message }

  if (input.contractId) revalidatePath(`/contracts/${input.contractId}`)
  if (input.companyId) revalidatePath(`/companies/${input.companyId}`)
  return { id: data.id }
}

export async function updateActivityStatus(
  id: string,
  status: 'planned' | 'done'
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('activities')
    .update({ status, completed: status === 'done' })
    .eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function deleteActivity(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: act } = await supabase.from('activities').select('contract_id, company_id').eq('id', id).maybeSingle()
  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) return { error: error.message }
  if (act?.contract_id) revalidatePath(`/contracts/${act.contract_id}`)
  if (act?.company_id) revalidatePath(`/companies/${act.company_id}`)
  return {}
}

// Compatibilidade retroativa com NoteForm
export type ActivityActionState = { error?: string }

export async function createNote(
  _prev: ActivityActionState,
  formData: FormData
): Promise<ActivityActionState> {
  const contractId = formData.get('contract_id') as string
  const content = formData.get('content') as string
  if (!content?.trim()) return { error: 'Escreva algo antes de salvar.' }
  const result = await createActivity({
    contractId, content, title: '', activityType: 'note', status: 'done',
  })
  return result.error ? { error: result.error } : {}
}
