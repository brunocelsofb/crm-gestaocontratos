'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ActionState = { error?: string }

// SLA padrão por prioridade (em horas) — usado só pra calcular o prazo
// no momento da criação. Se quiser deixar configurável depois, dá pra
// mover isso pra organization_settings sem mudar o resto da lógica.
const SLA_HOURS: Record<string, number> = {
  urgente: 4,
  alta: 24,
  media: 48,
  baixa: 120,
}

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
  const description = (formData.get('description') as string)?.trim() || null
  const priority = (formData.get('priority') as string) || 'media'
  const category = (formData.get('category') as string) || null
  const requester_name = (formData.get('requester_name') as string)?.trim()
  const requester_email = (formData.get('requester_email') as string)?.trim() || null
  const requester_phone = (formData.get('requester_phone') as string)?.trim() || null
  const source = (formData.get('source') as string) || 'manual'
  const contract_id = (formData.get('contract_id') as string) || null

  if (!subject) return { error: 'Assunto é obrigatório.' }
  if (!requester_name) return { error: 'Nome é obrigatório.' }

  const ticketNumber = await generateTicketNumber()
  const slaHours = SLA_HOURS[priority] ?? SLA_HOURS.media
  const slaDueAt = new Date(Date.now() + slaHours * 3600_000).toISOString()

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
      source,
      contract_id,
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
  const slaHours = SLA_HOURS[priority] ?? SLA_HOURS.media
  const slaDueAt = new Date(Date.now() + slaHours * 3600_000).toISOString()

  const { error } = await supabase
    .from('tickets')
    .update({ priority, sla_due_at: slaDueAt, updated_at: new Date().toISOString() })
    .eq('id', ticketId)
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
  const { data } = await supabase
    .from('contracts')
    .select('id, client_name, process_number')
    .or(`client_name.ilike.%${query}%,process_number.ilike.%${query}%`)
    .limit(8)
  return data ?? []
}
