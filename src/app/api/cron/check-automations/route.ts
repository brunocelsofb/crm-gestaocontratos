import { NextResponse } from 'next/server'
import { checkAndTriggerTimeBasedAutomations } from '@/lib/actions/automations'

// NOTA DE INCERTEZA: pensada pra ser chamada pela Vercel Cron
// (configurada em vercel.json) — não testada ao vivo. Se não disparar
// sozinha, confira em Vercel → Project → Settings → Cron Jobs.
export async function GET() {
  const result = await checkAndTriggerTimeBasedAutomations()
  return NextResponse.json({ ok: true, checked_at: new Date().toISOString(), ...result })
}
