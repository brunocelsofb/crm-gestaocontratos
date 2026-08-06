import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params
  const { searchParams } = new URL(req.url)
  const proposalId = searchParams.get('proposal_id')

  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Busca proposta — preferência pelo novo modelo (proposals) com proposal_id
  let proposal: any = null
  let serviceType = 'clinica'

  if (proposalId) {
    const { data } = await admin.from('proposals')
      .select('*')
      .eq('id', proposalId)
      .maybeSingle()
    proposal = data
    serviceType = data?.template_service_type ?? 'clinica'
  }

  // Fallback para proposal_status (legado)
  if (!proposal) {
    const { data } = await admin.from('proposal_status')
      .select('*')
      .eq('contract_id', contractId)
      .maybeSingle()
    proposal = data
  }

  if (!proposal?.technical_snapshot) {
    return NextResponse.json({ error: 'Snapshot do Price nao encontrado. Reenvie o valor do Price.' }, { status: 400 })
  }

  const [
    { data: contract },
    { data: templates },
    { data: orgSettings },
  ] = await Promise.all([
    admin.from('contracts').select('client_name, title, process_number, cnpj, company_id, contact_id').eq('id', contractId).maybeSingle(),
    // Filtra templates pelo service_type da proposta
    admin.from('proposal_templates').select('*')
      .eq('service_type', serviceType)
      .order('sort_order'),
    admin.from('organization_settings').select('company_name, company_cnpj, logo_storage_path, proposal_brand_color, proposal_header_text, proposal_footer_text').maybeSingle(),
  ])

  const [companyRes, contactRes] = await Promise.all([
    contract?.company_id ? admin.from('companies').select('name, cnpj, trade_name, street, street_number, neighborhood, city, state, zip_code, email, phone, address, nf_email, legal_name').eq('id', contract.company_id).maybeSingle() : Promise.resolve({ data: null }),
    contract?.contact_id ? admin.from('contacts').select('name, email, phone, cpf').eq('id', contract.contact_id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const proposalCode = `ORB.${contract?.process_number ?? contractId.slice(0, 8).toUpperCase()}`

  try {
    const { PDFDocument } = await import('pdf-lib')
    const { buildMergedProposalBytes } = await import('@/lib/actions/proposal-pdf-merge')

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
      } catch { /* ignora template corrompido */ }
    }

    // Templates antes do miolo
    if (mioloAfterIdx === -1) {
      const capas = ordered.filter((t: any) => !t.name.toLowerCase().startsWith('final'))
      for (const t of capas) await addTemplate(t)
    } else {
      for (let i = 0; i <= mioloAfterIdx; i++) await addTemplate(ordered[i])
    }

    // Miolo — usa buildMergedProposalBytes se tiver proposalId, senão builder legado
    let mioloBytes: Uint8Array | null = null

    if (proposalId) {
      const result = await buildMergedProposalBytes(proposalId)
      if (result.bytes) mioloBytes = result.bytes
    }

    // Fallback: builder do Price (legado)
    if (!mioloBytes) {
      const { buildPriceProposalPage } = await import('@/lib/actions/proposal-pdf-from-price')
      mioloBytes = await buildPriceProposalPage({
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
          address: (companyRes.data as any).address ?? undefined,
        } : { name: contract?.client_name ?? '' },
        contact: contactRes?.data ? { name: contactRes.data.name, email: contactRes.data.email ?? undefined, phone: contactRes.data.phone ?? undefined, cpf: contactRes.data.cpf ?? undefined } : null,
        org: {
          companyName: orgSettings?.company_name ?? 'ORBIS',
          cnpj: orgSettings?.company_cnpj ?? '',
          logoStoragePath: orgSettings?.logo_storage_path ?? null,
          brandColor: orgSettings?.proposal_brand_color ?? '#1B556B',
          headerText: orgSettings?.proposal_header_text ?? null,
          footerText: orgSettings?.proposal_footer_text ?? null,
          proposalCode,
        },
        textoObjetivos: (proposal as any).texto_objetivos ?? null,
        textoAtividades: (proposal as any).texto_atividades ?? null,
        textoEstruturaApoio: (proposal as any).texto_estrutura_apoio ?? null,
      })
    }

    const mioloDoc = await PDFDocument.load(mioloBytes)
    const mioloCopied = await mergedPdf.copyPages(mioloDoc, mioloDoc.getPageIndices())
    mioloCopied.forEach(p => mergedPdf.addPage(p))

    // Templates após o miolo
    if (mioloAfterIdx === -1) {
      const finais = ordered.filter((t: any) => t.name.toLowerCase().startsWith('final'))
      for (const t of finais) await addTemplate(t)
    } else {
      for (let i = mioloAfterIdx + 1; i < ordered.length; i++) await addTemplate(ordered[i])
    }

    const pdfBytes = await mergedPdf.save()
    const clientName = contract?.client_name?.replace(/\s+/g, '-') ?? contractId

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="proposta-${clientName}.pdf"`,
      }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao gerar PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
