'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCurrentUserAdmin } from '@/lib/auth/role'
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

  // ------------------------------------------------------------
  // 1. Resolve a EMPRESA (existente, escolhida via CNPJ já
  //    cadastrado, ou nova, criada aqui mesmo)
  // ------------------------------------------------------------
  const existingCompanyId = (formData.get('existing_company_id') as string) || null
  let companyId: string
  let companyName: string

  if (existingCompanyId) {
    companyId = existingCompanyId
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()
    companyName = company?.name ?? ''
  } else {
    const newCompanyCnpj = (formData.get('new_company_cnpj') as string) || null
    const newCompanyName = (formData.get('new_company_name') as string)?.trim()
    const newCompanyTradeName = (formData.get('new_company_trade_name') as string) || null

    if (!newCompanyName) {
      return {
        error: 'Empresa é obrigatória: informe o CNPJ e clique em "Verificar" antes de salvar.',
      }
    }

    const { data: newCompany, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: newCompanyName,
        trade_name: newCompanyTradeName,
        cnpj: newCompanyCnpj,
        owner_id: user.id,
      })
      .select()
      .single()

    if (companyError || !newCompany) {
      if (companyError?.code === '23505') {
        return { error: 'Já existe uma empresa com esse CNPJ. Clique em "Verificar" de novo para encontrá-la e usá-la.' }
      }
      return { error: `Falha ao criar empresa: ${companyError?.message}` }
    }

    companyId = newCompany.id
    companyName = newCompany.name
  }

  // ------------------------------------------------------------
  // 2. Resolve o CONTATO (existente, da empresa escolhida, ou
  //    novo, criado junto)
  // ------------------------------------------------------------
  const existingContactId = (formData.get('existing_contact_id') as string) || null
  let contactId: string

  if (existingContactId) {
    contactId = existingContactId
  } else {
    const newContactName = (formData.get('new_contact_name') as string)?.trim()

    if (!newContactName) {
      // Empresa já foi criada acima (se era nova) — não desfazemos isso
      // aqui; o usuário pode reaproveitar essa empresa ao tentar de novo.
      return { error: 'Contato responsável é obrigatório: preencha ao menos o nome.' }
    }

    const newContactRole = (formData.get('new_contact_role') as string) || null
    const newContactEmail = (formData.get('new_contact_email') as string) || null
    const newContactPhone = (formData.get('new_contact_phone') as string) || null

    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        company_id: companyId,
        name: newContactName,
        role: newContactRole,
        email: newContactEmail,
        phone: newContactPhone,
      })
      .select()
      .single()

    if (contactError || !newContact) {
      return { error: `Falha ao criar contato: ${contactError?.message}` }
    }

    contactId = newContact.id
  }

  // ------------------------------------------------------------
  // 3. Segue o fluxo original de criação do contrato, agora com
  //    empresa e contato já resolvidos
  // ------------------------------------------------------------
  const raw = {
    process_number: formData.get('process_number') as string,
    title: formData.get('title') as string,
    client_name: companyName,
    value: Number(formData.get('value') || 0),
    stage_id: formData.get('stage_id') as string,
    description: (formData.get('description') as string) || undefined,
    expected_close_date: (formData.get('expected_close_date') as string) || undefined,
  }

  const parsed = contractSchema.safeParse(raw)

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { stage_id, value, expected_close_date, company_id: _ignored, ...contractFields } = parsed.data

  const { data: stage, error: stageError } = await supabase
    .from('stages')
    .select('id, pipeline_id')
    .eq('id', stage_id)
    .single()

  if (stageError || !stage) {
    return { error: 'Etapa selecionada é inválida.' }
  }

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .insert({
      ...contractFields,
      company_id: companyId,
      contact_id: contactId,
      owner_id: user.id,
      current_assignee_id: user.id,
      valid_from: (formData.get('valid_from') as string) || null,
      valid_until: (formData.get('valid_until') as string) || null,
      auto_renewal: formData.get('auto_renewal') === 'on',
    })
    .select()
    .single()

  if (contractError) {
    if (contractError.code === '23505') {
      return { error: 'Já existe um contrato com esse Número do Processo.' }
    }
    return { error: contractError.message }
  }

  const now = new Date().toISOString()

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
    await supabase.from('contracts').delete().eq('id', contract.id)
    return { error: 'Falha ao iniciar o contrato no funil. Tente novamente.' }
  }

  await supabase.from('stage_history').insert({
    pipeline_run_id: run.id,
    stage_id: stage.id,
    entered_at: now,
    changed_by: user.id,
  })

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
// Não mexe em etapa/pipeline/empresa/contato aqui — isso continua sendo
// feito só pela barra de etapas ou por telas específicas, para manter o
// histórico consistente.
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
  const valid_from = (formData.get('valid_from') as string) || null
  const valid_until = (formData.get('valid_until') as string) || null
  const auto_renewal = formData.get('auto_renewal') === 'on'

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
      valid_from,
      valid_until,
      auto_renewal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  if (contractError) {
    if (contractError.code === '23505') {
      return { error: 'Já existe outro contrato com esse Número do Processo.' }
    }
    return { error: contractError.message }
  }

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

export type DeleteState = { error?: string }

// "Chave mãe" de exclusão — só admin. Exclui de verdade (sem manter
// histórico) — pedido explícito pra fase de testes. O banco já está
// configurado com "on delete cascade" em tudo que referencia o
// contrato (funil, atividades, arquivos, pesquisas, faturamento etc.),
// então uma exclusão aqui limpa tudo relacionado de uma vez.
export async function deleteContract(contractId: string, redirectTo?: string): Promise<DeleteState> {
  const isAdmin = await isCurrentUserAdmin()
  if (!isAdmin) return { error: 'Só administradores podem excluir contratos.' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('contracts').delete().eq('id', contractId)

  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  revalidatePath('/contracts')
  if (redirectTo) redirect(redirectTo)
  return {}
}
