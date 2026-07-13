import { NextResponse } from 'next/server'
import { checkAndTriggerRenewals } from '@/lib/actions/pipeline'

// NOTA DE INCERTEZA: essa rota é pensada pra ser chamada pela Vercel Cron
// (configurada em vercel.json), não é algo que eu tenha testado ao vivo.
// Se o cron não disparar sozinho, confira em Vercel → Project → Settings
// → Cron Jobs se ele aparece configurado e rodando.
export async function GET() {
  await checkAndTriggerRenewals()
  return NextResponse.json({ ok: true, checked_at: new Date().toISOString() })
}
