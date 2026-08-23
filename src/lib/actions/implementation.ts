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

  try {
    // Cria o cronograma com o usuário atual como owner
    const { data: schedule, error } = await admin
      .from('implementation_schedules')
      .insert({ contract_id: contractId, template_id: templateId, start_date: startDate, created_by: user.id, owner_id: user.id })
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
  } catch (e: any) {
    console.error('[createImplementationSchedule] erro:', e)
    return { error: e?.message ?? 'Erro inesperado.' }
  }
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

  // Log na aba Visão Geral do contrato
  const { data: task } = await admin
    .from('implementation_tasks')
    .select('title, schedule_id')
    .eq('id', taskId)
    .maybeSingle()
  if (task) {
    const { data: schedule } = await admin
      .from('implementation_schedules')
      .select('contract_id')
      .eq('id', task.schedule_id)
      .maybeSingle()
    if (schedule) {
      const { data: profile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      await admin.from('contract_activities').insert({
        contract_id: schedule.contract_id,
        user_id: user.id,
        type: 'note',
        content: `✅ Fase de implantação concluída: **${task.title}**\n\nNota técnica por ${profile?.full_name ?? 'usuário'}: ${completionNote}`,
      })
    }
  }

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
  text: string,
  delegatedTo?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const admin = createAdminClient()
  await admin.from('task_comments').insert({
    task_id: taskId, text, author_id: user.id,
    ...(delegatedTo ? { delegated_to: delegatedTo } : {}),
  })
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
      owner:profiles!implementation_schedules_owner_id_fkey(id, full_name),
      implementation_templates(name),
      implementation_tasks(
        *,
        profiles!implementation_tasks_assigned_to_fkey(id, full_name),
        completed_by_profile:profiles!implementation_tasks_completed_by_fkey(id, full_name),
        task_comments(*, profiles(id, full_name), delegated:profiles!task_comments_delegated_to_fkey(id, full_name))
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
