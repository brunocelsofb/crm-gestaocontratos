import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const admin = createAdminClient()

  // Busca proposta pelo client_review_token (sem join para debug)
  const { data: proposal, error: proposalError } = await admin
    .from('proposal_status')
    .select('*')
    .eq('client_review_token', token)
    .maybeSingle()

  if (proposalError) {
    return NextResponse.json({ error: `DB error: ${proposalError.message}` }, { status: 500 })
  }

  if (!proposal) {
    return NextResponse.json({ error: 'Token invalido', token_received: token.slice(0, 8) + '...' }, { status: 404 })
  }

  // Busca contrato separadamente
  const { data: contractData } = await admin
    .from('contracts')
    .select('id, client_name, title, process_number, cnpj, company_id, contact_id')
    .eq('id', proposal.contract_id)
    .maybeSingle()

  const contract = contractData
  const contractId = contract?.id

  if (!proposal.technical_snapshot) {
    return NextResponse.json({ error: 'Snapshot nao encontrado. Reenvie o valor do Price.' }, { status: 400 })
  }

  // Busca empresa, contato e templates
  const [companyRes, contactRes, { data: templates }, { data: orgSettings }] = await Promise.all([
    contract?.company_id ? admin.from('companies').select('name, cnpj, trade_name, street, street_number, neighborhood, city, state, zip_code, email, phone').eq('id', contract.company_id).maybeSingle() : Promise.resolve({ data: null }),
    contract?.contact_id ? admin.from('contacts').select('name, email, phone, cpf').eq('id', contract.contact_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from('proposal_templates').select('*').order('created_at'),
    admin.from('organization_settings').select('company_name, company_cnpj, logo_storage_path, proposal_brand_color, proposal_header_text, proposal_footer_text').maybeSingle(),
  ])

  const proposalCode = `ORB.${contract?.process_number ?? contractId?.slice(0, 8).toUpperCase() ?? ''}`

  try {
    const { PDFDocument } = await import('pdf-lib')
    const { buildPriceProposalPage } = await import('@/lib/actions/proposal-pdf-from-price')

    const mergedPdf = await PDFDocument.create()
    const ordered = [...(templates ?? [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const mioloAfterIdx = ordered.findIndex((t: any) => t.is_miolo_after)

    async function addTemplate(t: any) {
      if (!t?.file_storage_path) return
      try {
        const { data: fileData } = await admin.storage.from('proposal-files').download(t.file_storage_path)
        if (!fileData) return
        const bytes = new Uint8Array(await fileData.arrayBuffer())
        const doc = await PDFDocument.load(bytes)
        const copied = await mergedPdf.copyPages(doc, doc.getPageIndices())
        copied.forEach(p => mergedPdf.addPage(p))
      } catch {}
    }

    if (mioloAfterIdx === -1) {
      const capas = ordered.filter((t: any) => !t.name.toLowerCase().startsWith('final'))
      for (const t of capas) await addTemplate(t)
    } else {
      for (let i = 0; i <= mioloAfterIdx; i++) await addTemplate(ordered[i])
    }

    const mioloBytes = await buildPriceProposalPage({
      snapshot: proposal.technical_snapshot as any,
      proposalValue: Number(proposal.proposal_value) || 0,
      validityDays: proposal.proposal_validity_days ?? 30,
      submittedByName: proposal.submitted_by_name ?? null,
      technicalApprovedByName: proposal.technical_approved_by_name ?? null,
      technicalApprovedAt: proposal.technical_approved_at ?? null,
      technicalComment: proposal.technical_comment ?? null,
      commercialApprovedByName: proposal.commercial_approved_by_name ?? null,
      commercialApprovedAt: proposal.commercial_approved_at ?? null,
      contract: contract ? { client_name: contract.client_name, process_number: contract.process_number ?? null, cnpj: contract.cnpj ?? null } : null,
      company: companyRes?.data ? {
        name: companyRes.data.name,
        cnpj: companyRes.data.cnpj ?? undefined,
        tradeName: companyRes.data.trade_name ?? undefined,
        address: [
          companyRes.data.street && `${companyRes.data.street}${companyRes.data.street_number ? ', ' + companyRes.data.street_number : ''}`,
          companyRes.data.neighborhood,
          companyRes.data.city && companyRes.data.state ? `${companyRes.data.city}/${companyRes.data.state}` : companyRes.data.city,
          companyRes.data.zip_code,
        ].filter(Boolean).join(' - ') || undefined,
        email: companyRes.data.email ?? undefined,
        phone: companyRes.data.phone ?? undefined,
      } : { name: contractData?.client_name ?? '' },
      contact: contactRes?.data ? {
        name: contactRes.data.name,
        email: contactRes.data.email ?? undefined,
        phone: contactRes.data.phone ?? undefined,
        cpf: contactRes.data.cpf ?? undefined,
      } : null,
      org: { companyName: orgSettings?.company_name ?? 'ORBIS GESTAO DE TECNOLOGIA EM SAUDE LTDA', cnpj: orgSettings?.company_cnpj ?? '23.129.279/0001-03', proposalCode },
      textoObjetivos: (proposal as any).texto_objetivos ?? null,
      textoAtividades: (proposal as any).texto_atividades ?? null,
      textoEstruturaApoio: (proposal as any).texto_estrutura_apoio ?? null,
    })

    const mioloDoc = await PDFDocument.load(mioloBytes)
    const copied = await mergedPdf.copyPages(mioloDoc, mioloDoc.getPageIndices())
    copied.forEach(p => mergedPdf.addPage(p))
    if (mioloAfterIdx === -1) {
      const finais = ordered.filter((t: any) => t.name.toLowerCase().startsWith('final'))
      for (const t of finais) await addTemplate(t)
    } else {
      for (let i = mioloAfterIdx + 1; i < ordered.length; i++) await addTemplate(ordered[i])
    }

    const pdfBytes = await mergedPdf.save()
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="proposta.pdf"' }
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 })
  }
}
