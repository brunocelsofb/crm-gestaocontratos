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
    admin.from('contracts').select('client_name, title, process_number, cnpj, company_id, contact_id').eq('id', contractId).maybeSingle(),
    admin.from('proposal_status').select('*').eq('contract_id', contractId).maybeSingle(),
    admin.from('proposal_templates').select('*').order('created_at').limit(10),
  ])

  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })

  const snapshot = proposal.technical_snapshot as any
  if (!snapshot) return NextResponse.json({ error: 'Snapshot do Price não encontrado. Reenvie o valor do Price.' }, { status: 400 })

  // Tenta usar o pdf-lib para mesclar capa + miolo
  try {
    const { PDFDocument } = await import('pdf-lib')
    const { buildPriceProposalPage } = await import('@/lib/actions/proposal-pdf-from-price')

    const mergedPdf = await PDFDocument.create()

    // 1. Adiciona capas do template (se houver)
    const template = templates?.[0]
    if (template?.file_storage_path) {
      const { data: fileData } = await admin.storage.from('proposal-files').download(template.file_storage_path)
      if (fileData) {
        const templateBytes = new Uint8Array(await fileData.arrayBuffer())
        const templateDoc = await PDFDocument.load(templateBytes)
        const copied = await mergedPdf.copyPages(templateDoc, templateDoc.getPageIndices())
        copied.forEach(p => mergedPdf.addPage(p))
      }
    }

    // 2. Gera o miolo com dados do Price
    const mioloBytes = await buildPriceProposalPage({
      snapshot,
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
    const copied = await mergedPdf.copyPages(mioloDoc, mioloDoc.getPageIndices())
    copied.forEach(p => mergedPdf.addPage(p))

    // 3. Retorna o PDF
    const pdfBytes = await mergedPdf.save()
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="proposta-${contract?.client_name?.replace(/\s+/g, '-') ?? contractId}.pdf"`,
      }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao gerar PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
