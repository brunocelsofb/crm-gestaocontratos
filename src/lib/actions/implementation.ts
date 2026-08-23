'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ---- Criar cronograma a partir de template ----
export async function createImplementationSchedule(
  contractId: string,
  templateId: string,
  startDate: string
): Promise<{ error?: string; scheduleId?: string }> {
  try {
    console.log('[impl] iniciando | contractId:', contractId, 'templateId:', templateId, 'startDate:', startDate)

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[impl] auth error:', authError)
      return { error: 'Não autenticado.' }
    }
    console.log('[impl] user:', user.id)

    const admin = createAdminClient()

    const { data: tasks, error: tasksError } = await admin
      .from('implementation_template_tasks')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order')

    console.log('[impl] tarefas do template:', tasks?.length ?? 0, 'erro:', tasksError?.message)
    if (tasksError) return { error: `Erro ao buscar tarefas: ${tasksError.message}` }
    if (!tasks?.length) return { error: `Template não possui tarefas cadastradas (id: ${templateId}).` }

    const { data: schedule, error: scheduleError } = await admin
      .from('implementation_schedules')
      .insert({
        contract_id: contractId,
        template_id: templateId,
        start_date: startDate,
        created_by: user.id,
        owner_id: user.id,
      })
      .select('id').single()

    console.log('[impl] schedule criado:', schedule?.id, 'erro:', scheduleError?.message)
    if (scheduleError || !schedule) return { error: `Erro ao criar cronograma: ${scheduleError?.message ?? 'resposta vazia'}` }

    const taskRows = tasks.map(t => ({
      schedule_id: schedule.id,
      title: t.title,
      reference_doc: t.reference_doc,
      start_week: t.start_week,
      end_week: t.end_week,
      sort_order: t.sort_order,
    }))

    const { error: insertError } = await admin.from('implementation_tasks').insert(taskRows)
    console.log('[impl] tarefas inseridas:', taskRows.length, 'erro:', insertError?.message)
    if (insertError) return { error: `Erro ao inserir tarefas: ${insertError.message}` }

    revalidatePath(`/contracts/${contractId}`)
    console.log('[impl] sucesso! scheduleId:', schedule.id)
    return { scheduleId: schedule.id }

  } catch (e: any) {
    console.error('[impl] ERRO CRÍTICO:', e?.message, e?.stack)
    return { error: `Erro crítico: ${e?.message ?? 'Erro desconhecido'}` }
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
