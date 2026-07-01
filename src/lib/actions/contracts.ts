'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { contractSchema } from '@/lib/validations/contract'

export type ActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function createContract(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Usuário não autenticado.' }
  }

  const raw = {
    process_number: formData.get('process_number') as string,
    title: formData.get('title') as string,
    client_name: formData.get('client_name') as string,
    company_id: (formData.get('company_id') as string) || undefined,
    value: Number(formData.get('value') || 0),
    stage_id: formData.get('stage_id') as string,
    description: (formData.get('description') as string) || undefined,
    expected_close_date: (formData.get('expected_close_date') as string) || undefined,
  }

  const parsed = contractSchema.safeParse(raw)

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { stage_id, value, expected_close_date, ...contractFields } = parsed.data
  const normalizedContractFields = {
    ...contractFields,
    company_id: contractFields.company_id || null,
  }

  // Descobre a qual pipeline a etapa escolhida pertence, para já
  // criar a pipeline_run inicial no lugar certo.
  const { data: stage, error: stageError } = await supabase
    .from('stages')
    .select('id, pipeline_id')
    .eq('id', stage_id)
    .single()

  if (stageError || !stage) {
    return { error: 'Etapa selecionada é inválida.' }
  }

  // 1. Cria o contrato (identidade permanente, sem dados de posição em funil)
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .insert({ ...normalizedContractFields, owner_id: user.id })
    .select()
    .single()

  if (contractError) {
    if (contractError.code === '23505') {
      return { error: 'Já existe um contrato com esse Número do Processo.' }
    }
    return { error: contractError.message }
  }

  const now = new Date().toISOString()

  // 2. Cria a primeira pipeline_run, já na etapa escolhida
  const { data: run, error: runError } = await supabase
    .from('pipeline_runs')
    .insert({
      contract_id: contract.id,
      pipeline_id: stage.pipeline_id,
      stage_id: stage.id,
      stage_entered_at: now,
      value: value ?? 0,
      expected_close_date: expected_close_date || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (runError || !run) {
    // Contrato foi criado mas a run falhou — não deixamos órfão sem contexto:
    // removemos o contrato para manter consistência (não há transação
    // multi-tabela simples via supabase-js; se isso for crítico, mova essa
    // lógica para uma função de banco de dados com transação real).
    await supabase.from('contracts').delete().eq('id', contract.id)
    return { error: 'Falha ao iniciar o contrato no funil. Tente novamente.' }
  }

  // 3. Abre o primeiro registro de stage_history
  await supabase.from('stage_history').insert({
    pipeline_run_id: run.id,
    stage_id: stage.id,
    entered_at: now,
    changed_by: user.id,
  })

  // 4. Registra a criação na timeline
  await supabase.from('activities').insert({
    contract_id: contract.id,
    pipeline_run_id: run.id,
    user_id: user.id,
    type: 'system',
    content: 'Contrato cadastrado.',
  })

  revalidatePath('/contracts')
  redirect('/contracts')
}

// Edita os dados de identidade do contrato (contracts) e, se houver uma
// pipeline_run aberta, também atualiza valor e previsão de fechamento nela.
// Não mexe em etapa/pipeline aqui — isso continua sendo feito só pela
// barra de etapas ou pelo Kanban, para manter o histórico consistente.
export async function updateContract(
  contractId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Usuário não autenticado.' }
  }

  const process_number = formData.get('process_number') as string
  const title = formData.get('title') as string
  const client_name = formData.get('client_name') as string
  const description = (formData.get('description') as string) || null
  const value = Number(formData.get('value') || 0)
  const expected_close_date = (formData.get('expected_close_date') as string) || null

  if (!process_number?.trim()) {
    return { fieldErrors: { process_number: ['Número do processo é obrigatório'] } }
  }

  const { error: contractError } = await supabase
    .from('contracts')
    .update({
      process_number,
      title,
      client_name,
      description,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  if (contractError) {
    if (contractError.code === '23505') {
      return { error: 'Já existe outro contrato com esse Número do Processo.' }
    }
    return { error: contractError.message }
  }

  // Atualiza valor/previsão só na run aberta, se existir (contrato
  // já encerrado/movido não tem uma run "atual" editável aqui).
  const { data: openRun } = await supabase
    .from('pipeline_runs')
    .select('id')
    .eq('contract_id', contractId)
    .eq('status', 'open')
    .maybeSingle()

  if (openRun) {
    await supabase
      .from('pipeline_runs')
      .update({ value, expected_close_date })
      .eq('id', openRun.id)
  }

  await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type: 'system',
    content: 'Dados do contrato editados.',
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/contracts')
  redirect(`/contracts/${contractId}`)
}
