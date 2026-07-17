import { NextResponse } from 'next/server'
import { checkAndTriggerTimeBasedAutomations, checkAndTriggerExpirationAutomations } from '@/lib/actions/automations'
import { checkAndSendWhatsAppCaptureReminders } from '@/lib/actions/whatsapp'

// NOTA DE INCERTEZA: pensada pra ser chamada pela Vercel Cron
// (configurada em vercel.json) — não testada ao vivo. Se não disparar
// sozinha, confira em Vercel → Project → Settings → Cron Jobs.
export async function GET() {
  const [progressResult, expirationResult, captureReminderResult] = await Promise.all([
    checkAndTriggerTimeBasedAutomations(),
    checkAndTriggerExpirationAutomations(),
    checkAndSendWhatsAppCaptureReminders(),
  ])
  return NextResponse.json({ ok: true, checked_at: new Date().toISOString(), progress: progressResult, expiration: expirationResult, captureReminders: captureReminderResult })
}
