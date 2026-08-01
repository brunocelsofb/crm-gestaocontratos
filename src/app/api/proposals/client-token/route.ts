import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { contract_id } = await req.json()
  const admin = createAdminClient()

  // Verifica se já existe proposta gerada com PDF para esse contrato
  const { data: proposal } = await admin
    .from('proposals')
    .select('id, token, status, pdf_storage_path')
    .eq('contract_id', contract_id)
    .eq('status', 'pending_client')
    .maybeSingle()

  if (proposal?.token && proposal?.pdf_storage_path) {
    // Retorna URL da proposta existente (rota de julho)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-gestaocontratos-pi.vercel.app'
    return NextResponse.json({ proposal_url: `${baseUrl}/proposal/${proposal.token}` })
  }

  // Gera client_review_token e garante que o registro existe
  const token = randomBytes(24).toString('hex')
  await admin.from('proposal_status').upsert(
    { contract_id, client_review_token: token, status: 'aprovado_comercial', updated_at: new Date().toISOString() },
    { onConflict: 'contract_id' }
  )
  return NextResponse.json({ token })
}
