// Lógica de montagem do PDF, compartilhada entre:
// 1. generateProposalPdf (o PDF "oficial", salvo e vinculado ao link do
//    cliente, gerado só depois das aprovações internas)
// 2. a pré-visualização (gera na hora, não salva nada, disponível desde
//    o rascunho — pra conferir antes de mandar pra aprovação)
import { createAdminClient } from '@/lib/supabase/admin'

export async function buildMergedProposalBytes(proposalId: string): Promise<{ bytes?: Uint8Array; error?: string }> {
  const { PDFDocument } = await import('pdf-lib')
  const { buildStandardProposalPage } = await import('./proposal-pdf-builder')

  const supabase = createAdminClient()

  const { data: proposal } = await supabase.from('proposals').select('*').eq('id', proposalId).single()
  if (!proposal) return { error: 'Proposta não encontrada.' }

  const { data: pages } = await supabase
    .from('proposal_pages')
    .select('position, template_id, is_standard_proposal')
    .eq('proposal_id', proposalId)
    .order('position')

  const { data: items } = await supabase
    .from('proposal_items')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('position')

  const { data: contract } = await supabase.from('contracts').select('*').eq('id', proposal.contract_id).single()
  const { data: company } = contract?.company_id
    ? await supabase.from('companies').select('*').eq('id', contract.company_id).maybeSingle()
    : { data: null }
  const { data: contact } = contract?.contact_id
    ? await supabase.from('contacts').select('*').eq('id', contract.contact_id).maybeSingle()
    : { data: null }

  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('company_name, logo_storage_path, proposal_header_text, proposal_footer_text, proposal_brand_color')
    .eq('id', 'default')
    .maybeSingle()

  let logoBytes: Uint8Array | null = null
  let logoIsPng = true
  if (orgSettings?.logo_storage_path) {
    const { data: logoFile } = await supabase.storage.from('proposal-files').download(orgSettings.logo_storage_path)
    if (logoFile) {
      logoBytes = new Uint8Array(await logoFile.arrayBuffer())
      logoIsPng = orgSettings.logo_storage_path.toLowerCase().endsWith('.png')
    }
  }

  const { data: createdByProfile } = proposal.created_by
    ? await supabase.from('profiles').select('full_name, email').eq('id', proposal.created_by).maybeSingle()
    : { data: null }

  const { data: rawContentBlocks } = await supabase
    .from('proposal_content_blocks')
    .select('block_type, image_storage_path, table_data')
    .eq('proposal_id', proposalId)
    .order('position')

  const contentBlocks = await Promise.all(
    (rawContentBlocks ?? []).map(async (b) => {
      if (b.block_type === 'image' && b.image_storage_path) {
        const { data: imgFile } = await supabase.storage.from('proposal-files').download(b.image_storage_path)
        return {
          ...b,
          imageBytes: imgFile ? new Uint8Array(await imgFile.arrayBuffer()) : null,
          imageIsPng: b.image_storage_path.toLowerCase().endsWith('.png'),
        }
      }
      return { ...b, imageBytes: null, imageIsPng: true }
    })
  )

  if (!pages || pages.length === 0) {
    return { error: 'Monte a ordem das páginas antes de visualizar (mesmo que só com a Proposta padrão).' }
  }

  try {
    const mergedPdf = await PDFDocument.create()

    for (const page of pages) {
      if (page.is_standard_proposal) {
        const standardPageBytes = await buildStandardProposalPage({
          proposal,
          items: items ?? [],
          company,
          contact,
          org: {
            companyName: orgSettings?.company_name ?? null,
            logoBytes,
            logoIsPng,
            createdByName: createdByProfile?.full_name ?? null,
            createdByEmail: createdByProfile?.email ?? null,
            headerText: orgSettings?.proposal_header_text ?? null,
            footerText: orgSettings?.proposal_footer_text ?? null,
            brandColor: orgSettings?.proposal_brand_color ?? '#1B556B',
          },
          contentBlocks,
        })
        const standardDoc = await PDFDocument.load(standardPageBytes)
        const copied = await mergedPdf.copyPages(standardDoc, standardDoc.getPageIndices())
        copied.forEach((p) => mergedPdf.addPage(p))
      } else if (page.template_id) {
        const { data: template } = await supabase
          .from('proposal_templates')
          .select('file_storage_path')
          .eq('id', page.template_id)
          .maybeSingle()

        if (template) {
          const { data: fileData } = await supabase.storage.from('proposal-files').download(template.file_storage_path)
          if (fileData) {
            const templateBytes = new Uint8Array(await fileData.arrayBuffer())
            const templateDoc = await PDFDocument.load(templateBytes)
            const copied = await mergedPdf.copyPages(templateDoc, templateDoc.getPageIndices())
            copied.forEach((p) => mergedPdf.addPage(p))
          }
        }
      }
    }

    const bytes = await mergedPdf.save()
    return { bytes }
  } catch (e) {
    return { error: e instanceof Error ? `Falha ao montar PDF: ${e.message}` : 'Falha ao montar PDF.' }
  }
}
