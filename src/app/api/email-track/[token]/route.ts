import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Pixel transparente 1x1 — o método clássico de "e-mail foi aberto".
// LIMITAÇÃO REAL que é importante saber: o Gmail costuma pré-carregar
// imagens através do proxy dele MESMO ANTES da pessoa abrir o e-mail
// de verdade (ou às vezes nem carrega, se a pessoa usa outro cliente
// com bloqueio de imagem) — então isso é um indício útil, mas não uma
// certeza absoluta de que a pessoa LEU o e-mail.
const TRANSPARENT_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7',
  'base64'
)

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: email } = await supabase.from('contract_emails').select('id, opened_at').eq('tracking_token', token).maybeSingle()
  if (email && !email.opened_at) {
    await supabase.from('contract_emails').update({ opened_at: new Date().toISOString() }).eq('id', email.id)
  }

  return new NextResponse(TRANSPARENT_PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    },
  })
}
