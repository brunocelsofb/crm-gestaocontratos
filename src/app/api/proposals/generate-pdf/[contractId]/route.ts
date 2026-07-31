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
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const [{ data: contract }, { data: proposal }, { data: templates }] = await Promise.all([
    admin.from('contracts').select('client_name, title, process_number, cnpj').eq('id', contractId).maybeSingle(),
    admin.from('proposal_status').select('*').eq('contract_id', contractId).maybeSingle(),
    admin.from('proposal_templates').select('*').order('created_at'),
  ])

  if (!proposal?.technical_snapshot) {
    return NextResponse.json({ error: 'Snapshot do Price não encontrado. Reenvie o valor do Price.' }, { status: 400 })
  }

  try {
    const { PDFDocument } = await import('pdf-lib')
    const { buildPriceProposalPage } = await import('@/lib/actions/proposal-pdf-from-price')

    const mergedPdf = await PDFDocument.create()

    // Separa capas e finais
    const capas = (templates ?? []).filter(t => !t.name.toLowerCase().startsWith('final'))
    const finais = (templates ?? []).filter(t => t.name.toLowerCase().startsWith('final'))

    async function addTemplate(t: any) {
      if (!t?.file_storage_path) return
      const { data: fileData } = await admin.storage.from('proposal-files').download(t.file_storage_path)
      if (!fileData) return
      const bytes = new Uint8Array(await fileData.arrayBuffer())
      const doc = await PDFDocument.load(bytes)
      const copied = await mergedPdf.copyPages(doc, doc.getPageIndices())
      copied.forEach(p => mergedPdf.addPage(p))
    }

    // 1. Todas as capas
    for (const t of capas) await addTemplate(t)

    // 2. Miolo gerado do Price
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
    })

    const mioloDoc = await PDFDocument.load(mioloBytes)
    const mioloCopied = await mergedPdf.copyPages(mioloDoc, mioloDoc.getPageIndices())
    mioloCopied.forEach(p => mergedPdf.addPage(p))

    // 3. Páginas finais
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
