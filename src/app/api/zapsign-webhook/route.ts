import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = createAdminClient()
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  try {
    const event: string = body.event_action ?? ''
    const docToken: string = body.document?.token ?? ''
    if (!docToken) return NextResponse.json({ ok: true, skipped: 'sem token' })

    const { data: doc } = await supabase.from('zapsign_documents').select('id, contract_id, name').eq('zapsign_doc_token', docToken).maybeSingle()
    if (!doc) return NextResponse.json({ ok: true, skipped: 'documento não encontrado' })

    if (event === 'document-signed') {
      await supabase.from('zapsign_documents').update({
        status: 'assinado',
        signed_pdf_url: body.document?.signed_file ?? null,
        signed_at: new Date().toISOString(),
      }).eq('id', doc.id)

      await supabase.from('activities').insert({
        contract_id: doc.contract_id,
        type: 'system',
        content: `✅ Contrato "${doc.name}" assinado por todos os signatários.`,
        metadata: { zapsign_doc_token: docToken, signed_pdf_url: body.document?.signed_file },
      })
    } else if (event === 'document-refused') {
      await supabase.from('zapsign_documents').update({ status: 'recusado' }).eq('id', doc.id)
      await supabase.from('activities').insert({
        contract_id: doc.contract_id,
        type: 'system',
        content: `❌ Contrato "${doc.name}" foi recusado por um dos signatários.`,
        metadata: { zapsign_doc_token: docToken },
      })
    } else if (event === 'signer-signed') {
      const signerName: string = body.signer?.name ?? 'Signatário'
      await supabase.from('activities').insert({
        contract_id: doc.contract_id,
        type: 'system',
        content: `Contrato "${doc.name}": ${signerName} assinou.`,
        metadata: { zapsign_doc_token: docToken },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Erro no webhook do ZapSign:', e)
    return NextResponse.json({ ok: true, error: 'internal' })
  }
}
