import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params

  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const [
    { data: contract },
    { data: proposal },
    { data: templates },
    { data: orgSettings },
  ] = await Promise.all([
    admin.from('contracts').select('client_name, title, process_number, cnpj, company_id, contact_id').eq('id', contractId).maybeSingle(),
    admin.from('proposal_status').select('*').eq('contract_id', contractId).maybeSingle(),
    admin.from('proposal_templates').select('*').order('created_at'),
    admin.from('company_settings').select('company_name, cnpj, address, email, phone, proposal_header_text').maybeSingle(),
  ])

  if (!proposal?.technical_snapshot) {
    return NextResponse.json({ error: 'Snapshot do Price nao encontrado. Reenvie o valor do Price.' }, { status: 400 })
  }

  // Busca empresa e contato do contrato
  const [companyRes, contactRes] = await Promise.all([
    contract?.company_id ? admin.from('companies').select('name, cnpj, address').eq('id', contract.company_id).maybeSingle() : Promise.resolve({ data: null }),
    contract?.contact_id ? admin.from('contacts').select('name, email').eq('id', contract.contact_id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  // Busca também o usuário responsável pelo contrato para código da proposta
  const proposalCode = `ORB.${contract?.process_number ?? contractId.slice(0, 8).toUpperCase()}`

  try {
    const { PDFDocument } = await import('pdf-lib')
    const { buildPriceProposalPage } = await import('@/lib/actions/proposal-pdf-from-price')

    const mergedPdf = await PDFDocument.create()

    const capas = (templates ?? []).filter((t: any) => !t.name.toLowerCase().startsWith('final'))
    const finais = (templates ?? []).filter((t: any) => t.name.toLowerCase().startsWith('final'))

    async function addTemplate(t: any) {
      if (!t?.file_storage_path) return
      try {
        const { data: fileData } = await admin.storage.from('proposal-files').download(t.file_storage_path)
        if (!fileData) return
        const bytes = new Uint8Array(await fileData.arrayBuffer())
        const doc = await PDFDocument.load(bytes)
        const copied = await mergedPdf.copyPages(doc, doc.getPageIndices())
        copied.forEach(p => mergedPdf.addPage(p))
      } catch { /* ignora templates corrompidos */ }
    }

    // 1. Capas
    for (const t of capas) await addTemplate(t)

    // 2. Miolo
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
      contract: contract ? {
        client_name: contract.client_name,
        process_number: contract.process_number ?? null,
        cnpj: contract.cnpj ?? null,
      } : null,
      company: companyRes?.data ? {
        name: companyRes.data.name,
        cnpj: companyRes.data.cnpj ?? undefined,
        address: companyRes.data.address ?? undefined,
      } : { name: contract?.client_name ?? '' },
      contact: contactRes?.data ? {
        name: contactRes.data.name,
        email: contactRes.data.email ?? undefined,
      } : null,
      org: {
        companyName: orgSettings?.company_name ?? 'ORBIS GESTAO DE TECNOLOGIA EM SAUDE LTDA',
        cnpj: orgSettings?.cnpj ?? '23.129.279/0001-03',
        address: orgSettings?.address ?? undefined,
        proposalCode,
      },
      textoObjetivos: (proposal as any).texto_objetivos ?? null,
      textoAtividades: (proposal as any).texto_atividades ?? null,
      textoEstruturaApoio: (proposal as any).texto_estrutura_apoio ?? null,
    })

    const mioloDoc = await PDFDocument.load(mioloBytes)
    const mioloCopied = await mergedPdf.copyPages(mioloDoc, mioloDoc.getPageIndices())
    mioloCopied.forEach(p => mergedPdf.addPage(p))

    // 3. Finais
    for (const t of finais) await addTemplate(t)

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
