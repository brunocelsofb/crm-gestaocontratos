'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ---- Criar cronograma a partir de template ----
export async function createImplementationSchedule(
  contractId: string,
  templateId: string,
  startDate: string // ISO date
): Promise<{ error?: string; scheduleId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const admin = createAdminClient()

  // Busca tarefas do template
  const { data: tasks } = await admin
    .from('implementation_template_tasks')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order')

  if (!tasks?.length) return { error: 'Template sem tarefas.' }

  // Cria o cronograma
  const { data: schedule, error } = await admin
    .from('implementation_schedules')
    .insert({ contract_id: contractId, template_id: templateId, start_date: startDate, created_by: user.id })
    .select('id').single()

  if (error || !schedule) return { error: error?.message ?? 'Erro ao criar cronograma.' }

  // Clona as tarefas do template
  const taskRows = tasks.map(t => ({
    schedule_id: schedule.id,
    title: t.title,
    reference_doc: t.reference_doc,
    start_week: t.start_week,
    end_week: t.end_week,
    sort_order: t.sort_order,
  }))
  await admin.from('implementation_tasks').insert(taskRows)

  revalidatePath(`/contracts/${contractId}`)
  return { scheduleId: schedule.id }
}

// ---- Completar tarefa ----
export async function completeImplementationTask(
  taskId: string,
  completionNote: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  await admin.from('implementation_tasks').update({
    is_completed: true,
    completed_at: now,
    completed_by: user.id,
    completion_note: completionNote,
    updated_at: now,
  }).eq('id', taskId)

  await admin.from('task_comments').insert({
    task_id: taskId,
    text: completionNote,
    author_id: user.id,
    is_completion_note: true,
  })

  revalidatePath('/')
  return {}
}

// ---- Atribuir responsável ----
export async function assignImplementationTask(
  taskId: string,
  userId: string | null
): Promise<void> {
  const admin = createAdminClient()
  await admin.from('implementation_tasks').update({ assigned_to: userId, updated_at: new Date().toISOString() }).eq('id', taskId)
  revalidatePath('/')
}

// ---- Adicionar comentário ----
export async function addTaskComment(
  taskId: string,
  text: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const admin = createAdminClient()
  await admin.from('task_comments').insert({ task_id: taskId, text, author_id: user.id })
  revalidatePath('/')
  return {}
}

// ---- Buscar cronograma do contrato ----
export async function getContractSchedule(contractId: string) {
  const admin = createAdminClient()
  const { data: schedule } = await admin
    .from('implementation_schedules')
    .select(`
      *,
      implementation_templates(name),
      implementation_tasks(
        *,
        profiles!implementation_tasks_assigned_to_fkey(id, full_name),
        completed_by_profile:profiles!implementation_tasks_completed_by_fkey(id, full_name),
        task_comments(*, profiles(id, full_name))
      )
    `)
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return schedule
}

// ---- Buscar templates disponíveis ----
export async function getImplementationTemplates() {
  const admin = createAdminClient()
  const { data } = await admin.from('implementation_templates').select('id, name, trigger_tags, description').order('name')
  return data ?? []
}
