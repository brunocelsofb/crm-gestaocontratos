'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ActionState = { error?: string }

// ------------------------------------------------------------
// Catálogo de produtos/serviços — cadastra uma vez, escolhe na hora de
// montar a proposta, em vez de digitar tudo do zero sempre.
// ------------------------------------------------------------
export async function createCatalogItem(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const name = (formData.get('name') as string)?.trim()
  const category = (formData.get('category') as string) || null
  const type = (formData.get('type') as string) || null
  const characteristics = (formData.get('characteristics') as string) || null
  const unit_value = Number(formData.get('unit_value')) || 0

  if (!name) return { error: 'Nome do item é obrigatório.' }

  const { error } = await supabase.from('proposal_catalog_items').insert({
    name,
    category,
    type,
    characteristics,
    unit_value,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/proposals/catalog')
  return {}
}

export async function deleteCatalogItem(itemId: string) {
  const supabase = createAdminClient()
  await supabase.from('proposal_catalog_items').delete().eq('id', itemId)
  revalidatePath('/proposals/catalog')
}

// ------------------------------------------------------------
// Modelos de página (capas)
// ------------------------------------------------------------
export async function registerProposalTemplate(name: string, filePath: string, fileName: string, pageCount: number): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const { error } = await supabase.from('proposal_templates').insert({
    name,
    file_storage_path: filePath,
    file_name: fileName,
    page_count: pageCount,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/proposals/templates')
  return {}
}

export async function deleteProposalTemplate(templateId: string) {
  const supabase = createAdminClient()
  await supabase.from('proposal_templates').delete().eq('id', templateId)
  revalidatePath('/proposals/templates')
}

// ------------------------------------------------------------
// Criar proposta (rascunho)
// ------------------------------------------------------------
async function generateControlCode(): Promise<string> {
  const supabase = createAdminClient()
  const year = new Date().getFullYear()

  const { count } = await supabase
    .from('proposals')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`)
    .lt('created_at', `${year + 1}-01-01`)

  const next = (count ?? 0) + 1
  return `PROP-${year}-${String(next).padStart(4, '0')}`
}

export type ProposalItemInput = {
  quantity: number
  category: string
  item: string
  characteristics: string
  type: string
  delivery_forecast: string
  unit_value: number
  discount: number
}

export async function createProposal(
  contractId: string,
  currency: string,
  clientPoNumber: string | null,
  validUntil: string | null,
  items: ProposalItemInput[]
): Promise<{ error?: string; proposalId?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  if (items.length === 0) return { error: 'Adicione pelo menos um item à proposta.' }

  const controlCode = await generateControlCode()

  const { data: proposal, error } = await supabase
    .from('proposals')
    .insert({
      contract_id: contractId,
      control_code: controlCode,
      currency,
      client_po_number: clientPoNumber,
      valid_until: validUntil,
      created_by: user.id,
    })
    .select()
    .single()

  if (error || !proposal) return { error: error?.message ?? 'Falha ao criar proposta.' }

  const itemRows = items.map((it, i) => ({
    proposal_id: proposal.id,
    position: i,
    quantity: it.quantity,
    category: it.category,
    item: it.item,
    characteristics: it.characteristics,
    type: it.type,
    delivery_forecast: it.delivery_forecast,
    unit_value: it.unit_value,
    discount: it.discount,
    subtotal: it.quantity * it.unit_value - it.discount,
  }))

  const { error: itemsError } = await supabase.from('proposal_items').insert(itemRows)
  if (itemsError) return { error: itemsError.message }

  // Página única "Proposta padrão" por padrão — a ordem/capas são
  // ajustadas depois, na tela de montagem.
  await supabase.from('proposal_pages').insert({
    proposal_id: proposal.id,
    position: 0,
    is_standard_proposal: true,
  })

  await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type: 'system',
    content: `Proposta ${controlCode} criada (rascunho).`,
  })

  revalidatePath(`/contracts/${contractId}`)
  return { proposalId: proposal.id }
}

export async function deleteProposal(proposalId: string, contractId: string) {
  const supabase = createAdminClient()
  await supabase.from('proposals').delete().eq('id', proposalId)
  revalidatePath(`/contracts/${contractId}`)
}

// ------------------------------------------------------------
// Envio pra aprovação técnica (sai de rascunho)
// ------------------------------------------------------------
export async function submitForTechnicalApproval(proposalId: string, contractId: string): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  await supabase.from('proposals').update({ status: 'pending_technical', updated_at: new Date().toISOString() }).eq('id', proposalId)

  const { data: profilesInDept } = await supabase.from('profiles').select('id').eq('department', 'tecnico')
  if (profilesInDept) {
    await supabase.from('notifications').insert(
      profilesInDept.map((p) => ({
        user_id: p.id,
        contract_id: contractId,
        message: 'Uma proposta comercial precisa de pré-aprovação técnica.',
      }))
    )
  }

  await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type: 'system',
    content: 'Proposta enviada para pré-aprovação técnica.',
  })

  revalidatePath(`/contracts/${contractId}`)
  return {}
}

// ------------------------------------------------------------
// Decisão interna (técnico ou comercial) — comentário SEMPRE obrigatório
// ------------------------------------------------------------
export async function decideInternalApproval(
  proposalId: string,
  contractId: string,
  stage: 'technical' | 'commercial',
  decision: 'approved' | 'declined',
  comment: string
): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  if (!comment.trim()) {
    return { error: 'O comentário é obrigatório pra aprovar ou declinar.' }
  }

  const { error: approvalError } = await supabase.from('proposal_approvals').insert({
    proposal_id: proposalId,
    stage,
    decision,
    comment,
    decided_by: user.id,
  })
  if (approvalError) return { error: approvalError.message }

  const stageLabel = stage === 'technical' ? 'Pré-aprovação técnica' : 'Aprovação comercial'
  const decisionLabel = decision === 'approved' ? 'APROVADA' : 'DECLINADA'

  await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type: 'system',
    content: `${stageLabel}: ${decisionLabel}. Comentário: "${comment}"`,
  })

  if (decision === 'declined') {
    await supabase.from('proposals').update({ status: 'declined_internal', updated_at: new Date().toISOString() }).eq('id', proposalId)
    revalidatePath(`/contracts/${contractId}`)
    return {}
  }

  // Aprovado: técnico → passa pro comercial; comercial → gera o PDF e
  // abre pro cliente.
  if (stage === 'technical') {
    await supabase.from('proposals').update({ status: 'pending_commercial', updated_at: new Date().toISOString() }).eq('id', proposalId)

    const { data: commercialProfiles } = await supabase.from('profiles').select('id').eq('department', 'comercial')
    if (commercialProfiles) {
      await supabase.from('notifications').insert(
        commercialProfiles.map((p) => ({
          user_id: p.id,
          contract_id: contractId,
          message: 'Uma proposta comercial teve ciência técnica — aguardando sua aprovação.',
        }))
      )
    }
  } else {
    const result = await generateProposalPdf(proposalId, contractId)
    if (result.error) return { error: result.error }
  }

  revalidatePath(`/contracts/${contractId}`)
  return {}
}

// ------------------------------------------------------------
// Geração do PDF final: mescla capas + página da proposta padrão, na
// ordem configurada — e abre o link público pro cliente.
// ------------------------------------------------------------
export async function generateProposalPdf(proposalId: string, contractId: string): Promise<ActionState> {
  const { buildMergedProposalBytes } = await import('./proposal-pdf-merge')
  const supabase = createAdminClient()

  const { data: proposal } = await supabase.from('proposals').select('control_code, version').eq('id', proposalId).single()
  if (!proposal) return { error: 'Proposta não encontrada.' }

  const { bytes, error: buildError } = await buildMergedProposalBytes(proposalId)
  if (buildError || !bytes) return { error: buildError ?? 'Falha ao gerar PDF.' }

  const finalPath = `generated/${proposalId}-v${proposal.version}-${Date.now()}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('proposal-files')
    .upload(finalPath, bytes, { contentType: 'application/pdf' })

  if (uploadError) return { error: `Falha ao salvar PDF: ${uploadError.message}` }

  const token = crypto.randomUUID()

  await supabase
    .from('proposals')
    .update({
      status: 'pending_client',
      pdf_storage_path: finalPath,
      token,
      updated_at: new Date().toISOString(),
    })
    .eq('id', proposalId)

  await supabase.from('activities').insert({
    contract_id: contractId,
    type: 'system',
    content: `PDF da proposta ${proposal.control_code} gerado e link enviado pro cliente.`,
  })

  return {}
}

// ------------------------------------------------------------
// Montagem das páginas (ordem das capas + posição da proposta padrão)
// ------------------------------------------------------------
export async function setProposalPageOrder(
  proposalId: string,
  contractId: string,
  pages: { position: number; templateId: string | null; isStandardProposal: boolean }[]
): Promise<ActionState> {
  const supabase = await createClient()

  await supabase.from('proposal_pages').delete().eq('proposal_id', proposalId)

  const { error } = await supabase.from('proposal_pages').insert(
    pages.map((p) => ({
      proposal_id: proposalId,
      position: p.position,
      template_id: p.templateId,
      is_standard_proposal: p.isStandardProposal,
    }))
  )

  if (error) return { error: error.message }

  revalidatePath(`/contracts/${contractId}/proposals/${proposalId}`)
  return {}
}

// ------------------------------------------------------------
// Decisão do CLIENTE (link público, sem login)
// ------------------------------------------------------------
export async function submitClientDecision(
  token: string,
  decision: 'approved' | 'declined',
  comment: string,
  signer?: { name: string; email: string; role: string; phone: string; cpf: string }
): Promise<ActionState> {
  const { isValidCPF } = await import('@/lib/utils/cpf')
  const supabase = createAdminClient()

  if (!comment.trim()) {
    return { error: 'O comentário é obrigatório.' }
  }

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, contract_id, status')
    .eq('token', token)
    .maybeSingle()

  if (!proposal) return { error: 'Link inválido.' }
  if (proposal.status !== 'pending_client') return { error: 'Esta proposta já foi respondida ou não está mais disponível.' }

  if (decision === 'approved') {
    if (!signer) return { error: 'Preencha os dados do assinante.' }
    if (!signer.name || !signer.email || !signer.role || !signer.phone || !signer.cpf) {
      return { error: 'Preencha todos os campos do assinante.' }
    }
    // REGRA CRÍTICA: nunca aceitar aprovação com CPF inválido — checado
    // de novo aqui no servidor (o front-end também valida, mas isso
    // sozinho nunca é confiável).
    if (!isValidCPF(signer.cpf)) {
      return { error: 'CPF inválido. Confira o número informado.' }
    }
  }

  const { error } = await supabase.from('proposal_approvals').insert({
    proposal_id: proposal.id,
    stage: 'client',
    decision,
    comment,
    signer_name: signer?.name ?? null,
    signer_email: signer?.email ?? null,
    signer_role: signer?.role ?? null,
    signer_phone: signer?.phone ?? null,
    signer_cpf: signer?.cpf ?? null,
  })
  if (error) return { error: error.message }

  await supabase
    .from('proposals')
    .update({ status: decision === 'approved' ? 'approved' : 'declined_client', updated_at: new Date().toISOString() })
    .eq('id', proposal.id)

  await supabase.from('activities').insert({
    contract_id: proposal.contract_id,
    type: 'system',
    content:
      decision === 'approved'
        ? `Cliente APROVOU a proposta. Assinado por ${signer?.name} (${signer?.role}). Comentário: "${comment}"`
        : `Cliente DECLINOU a proposta. Comentário: "${comment}"`,
  })

  return {}
}
