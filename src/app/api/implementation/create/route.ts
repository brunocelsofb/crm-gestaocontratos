import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function POST(req: Request) {
  try {
    const { contractId, templateId, startDate } = await req.json()
    console.log('[impl/api] recebido:', { contractId, templateId, startDate })

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    console.log('[impl/api] user:', user.id)

    const admin = createAdminClient()

    // 1. Busca tarefas do template
    const { data: tasks, error: tasksErr } = await admin
      .from('implementation_template_tasks')
      .select('title, reference_doc, start_week, end_week, sort_order')
      .eq('template_id', templateId)
      .order('sort_order')

    console.log('[impl/api] tarefas:', tasks?.length, 'err:', tasksErr?.message)
    if (tasksErr) return NextResponse.json({ error: `Erro ao buscar tarefas: ${tasksErr.message}` }, { status: 500 })
    if (!tasks?.length) return NextResponse.json({ error: `Template sem tarefas (id: ${templateId})` }, { status: 400 })

    // 2. Cria o cronograma
    const { data: schedule, error: schedErr } = await admin
      .from('implementation_schedules')
      .insert({ contract_id: contractId, template_id: templateId, start_date: startDate, created_by: user.id, owner_id: user.id })
      .select('id')
      .single()

    console.log('[impl/api] schedule:', schedule?.id, 'err:', schedErr?.message)
    if (schedErr || !schedule) return NextResponse.json({ error: `Erro ao criar cronograma: ${schedErr?.message}` }, { status: 500 })

    // 3. Clona tarefas
    const { error: taskInsertErr } = await admin
      .from('implementation_tasks')
      .insert(tasks.map(t => ({
        schedule_id: schedule.id,
        title: t.title,
        reference_doc: t.reference_doc,
        start_week: t.start_week,
        end_week: t.end_week,
        sort_order: t.sort_order,
      })))

    console.log('[impl/api] tasks inseridas, err:', taskInsertErr?.message)
    if (taskInsertErr) return NextResponse.json({ error: `Erro ao inserir tarefas: ${taskInsertErr.message}` }, { status: 500 })

    revalidatePath(`/contracts/${contractId}`)
    return NextResponse.json({ ok: true, scheduleId: schedule.id })

  } catch (e: any) {
    console.error('[impl/api] CRÍTICO:', e?.message, e?.stack)
    return NextResponse.json({ error: e?.message ?? 'Erro interno' }, { status: 500 })
  }
}
