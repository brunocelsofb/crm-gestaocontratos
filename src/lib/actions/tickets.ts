'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PRIORITY_SLA_DAYS, gravityForCategory, type PriorityTier } from '@/lib/utils/gut-matrix'

export type ActionState = { error?: string }

async function generateTicketNumber(): Promise<string> {
  const supabase = createAdminClient()
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`)
    .lt('created_at', `${year + 1}-01-01`)
  const next = (count ?? 0) + 1
  return `TICKET-${year}-${String(next).padStart(4, '0')}`
}

// Criação de ticket — usada tanto pelo formulário público de suporte
// quanto pelo cadastro manual da equipe. Sem exigir login.
export async function createTicket(formData: FormData): Promise<ActionState & { ticketId?: string; publicToken?: string }> {
  const supabase = await createClient()

  const subject = (formData.get('subject') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const priority = ((formData.get('priority') as string) || 'pouco_critica') as PriorityTier
  const category = (formData.get('category') as string) || null
  const requester_name = (formData.get('requester_name') as string)?.trim()
  const requester_email = (formData.get('requester_email') as string)?.trim()
  const requester_phone = (formData.get('requester_phone') as string)?.trim()
  const requester_cnpj = ((formData.get('requester_cnpj') as string) || '').replace(/\D/g, '')
  const source = (formData.get('source') as string) || 'manual'
  let contract_id = (formData.get('contract_id') as string) || null

  // Todos esses campos são obrigatórios — checados aqui de novo mesmo
  // que o front já valide, porque só o front nunca é confiável sozinho.
  if (!requester_name || requester_name.trim().split(/\s+/).length < 2) {
    return { error: 'Informe nome e sobrenome do solicitante.' }
  }
  if (!requester_email) return { error: 'E-mail é obrigatório.' }
  if (!requester_phone) return { error: 'Telefone é obrigatório.' }
  if (!subject) return { error: 'Assunto é obrigatório.' }
  if (!description) return { error: 'Descreva o problema.' }
  if (!requester_cnpj || requester_cnpj.length !== 14) return { error: 'Informe um CNPJ válido (o vinculado ao contrato).' }

  // Suporte é só pra CLIENTE — contrato de gestão ou serviço avulso.
  // Se não veio um contrato já escolhido (caso do formulário público),
  // tenta achar pelo CNPJ automaticamente.
  if (!contract_id) {
    const adminClient = createAdminClient()
    const { data: company } = await adminClient.from('companies').select('id').eq('cnpj', requester_cnpj).maybeSingle()

    if (company) {
      const { data: matchingContracts } = await adminClient.from('contracts').select('id').eq('company_id', company.id)
      if (matchingContracts && matchingContracts.length === 1) {
        contract_id = matchingContracts[0].id
      }
      // Se achou 0 ou mais de 1 contrato pra esse CNPJ, deixa sem
      // vincular — a equipe resolve na triagem (tela do ticket mostra
      // o aviso e o CNPJ informado pra facilitar).
    }
  }

  const ticketNumber = await generateTicketNumber()
  const slaDays = PRIORITY_SLA_DAYS[priority] ?? PRIORITY_SLA_DAYS.pouco_critica
  const slaDueAt = new Date(Date.now() + slaDays * 86_400_000).toISOString()
  const gravity = gravityForCategory(category)

  const { data, error } = await supabase
    .from('tickets')
    .insert({
      ticket_number: ticketNumber,
      subject,
      description,
      priority,
      category,
      requester_name,
      requester_email,
      requester_phone,
      requester_cnpj,
      source,
      contract_id,
      gravity,
      sla_due_at: slaDueAt,
    })
    .select('id, public_token')
    .single()

  if (error) return { error: error.message }

  if (description) {
    await supabase.from('ticket_messages').insert({
      ticket_id: data.id,
      author_type: 'cliente',
      author_name: requester_name,
      message: description,
    })
  }

  // Avisa o time COMERCIAL — é onde o atendimento fica, segundo a
  // estrutura de vocês.
  const adminClient = createAdminClient()
  const { data: supportProfiles } = await adminClient.from('profiles').select('id').eq('department', 'comercial')
  if (supportProfiles && supportProfiles.length > 0) {
    await adminClient.from('notifications').insert(
      supportProfiles.map((p) => ({ user_id: p.id, message: `Novo ticket ${ticketNumber}: ${subject} (prioridade ${priority}).` }))
    )
  }

  revalidatePath('/tickets')
  if (contract_id) revalidatePath(`/contracts/${contract_id}`)
  return { ticketId: data.id, publicToken: data.public_token }
}

// Vincula (ou corrige) o contrato de um ticket já existente — usado
// principalmente pra tickets que chegaram pelo formulário público, onde
// a pessoa não escolhe o contrato na hora (só descreve a empresa) e
// alguém da equipe vincula depois de triar.
export async function linkTicketToContract(ticketId: string, contractId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('tickets').update({ contract_id: contractId, updated_at: new Date().toISOString() }).eq('id', ticketId)
  if (error) return { error: error.message }
  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath(`/contracts/${contractId}`)
  return {}
}

export async function updateTicketStatus(ticketId: string, status: string): Promise<ActionState> {
  const supabase = await createClient()
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'resolvido' || status === 'fechado') update.resolved_at = new Date().toISOString()

  const { error } = await supabase.from('tickets').update(update).eq('id', ticketId)
  if (error) return { error: error.message }
  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function updateTicketPriority(ticketId: string, priority: string): Promise<ActionState> {
  const supabase = await createClient()
  const slaDays = PRIORITY_SLA_DAYS[priority as PriorityTier] ?? PRIORITY_SLA_DAYS.pouco_critica
  const slaDueAt = new Date(Date.now() + slaDays * 86_400_000).toISOString()

  const { error } = await supabase
    .from('tickets')
    .update({ priority, sla_due_at: slaDueAt, updated_at: new Date().toISOString() })
    .eq('id', ticketId)
  if (error) return { error: error.message }
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function updateTicketTrend(ticketId: string, trend: number): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('tickets').update({ trend, updated_at: new Date().toISOString() }).eq('id', ticketId)
  if (error) return { error: error.message }
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function assignTicket(ticketId: string, userId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('tickets').update({ assigned_to: userId, updated_at: new Date().toISOString() }).eq('id', ticketId)
  if (error) return { error: error.message }
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

// Resposta INTERNA (equipe) — pode ser visível pro cliente ou só uma
// nota interna, dependendo do isInternalNote.
export async function addTicketMessage(ticketId: string, message: string, isInternalNote: boolean): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }
  if (!message.trim()) return { error: 'Escreva algo antes de enviar.' }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()

  const { error } = await supabase.from('ticket_messages').insert({
    ticket_id: ticketId,
    author_type: 'interno',
    author_id: user.id,
    author_name: profile?.full_name ?? 'Equipe',
    message,
    is_internal_note: isInternalNote,
  })
  if (error) return { error: error.message }

  await supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId)

  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

// Resposta do CLIENTE via link público (token, sem login).
export async function addPublicTicketReply(token: string, authorName: string, message: string): Promise<ActionState> {
  const supabase = createAdminClient()
  if (!message.trim()) return { error: 'Escreva algo antes de enviar.' }

  const { data: ticket } = await supabase.from('tickets').select('id').eq('public_token', token).maybeSingle()
  if (!ticket) return { error: 'Link inválido.' }

  const { error } = await supabase.from('ticket_messages').insert({
    ticket_id: ticket.id,
    author_type: 'cliente',
    author_name: authorName || 'Cliente',
    message,
  })
  if (error) return { error: error.message }

  await supabase.from('tickets').update({ status: 'aberto', updated_at: new Date().toISOString() }).eq('id', ticket.id)
  return {}
}

export async function deleteTicket(ticketId: string) {
  const supabase = createAdminClient()
  await supabase.from('tickets').delete().eq('id', ticketId)
  revalidatePath('/tickets')
}

export async function searchContractsForTicket(query: string): Promise<{ id: string; client_name: string; process_number: string }[]> {
  if (!query || query.length < 2) return []
  const supabase = await createClient()

  const cleanedForCnpj = query.replace(/\D/g, '')
  if (cleanedForCnpj.length >= 8) {
    // Parece um CNPJ (ou pedaço dele) — busca pela empresa primeiro.
    const { data: companies } = await supabase.from('companies').select('id').ilike('cnpj', `%${cleanedForCnpj}%`)
    if (companies && companies.length > 0) {
      const { data: byCompany } = await supabase
        .from('contracts')
        .select('id, client_name, process_number')
        .in('company_id', companies.map((c) => c.id))
        .limit(8)
      if (byCompany && byCompany.length > 0) return byCompany
    }
  }

  const { data } = await supabase
    .from('contracts')
    .select('id, client_name, process_number')
    .or(`client_name.ilike.%${query}%,process_number.ilike.%${query}%`)
    .limit(8)
  return data ?? []
}
