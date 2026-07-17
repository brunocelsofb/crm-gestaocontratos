import { createAdminClient } from '@/lib/supabase/admin'

const OPT_OUT_KEYWORDS = ['sair', 'parar', 'stop', 'cancelar', 'descadastrar', 'não quero mais']

export function isOptOutMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  return OPT_OUT_KEYWORDS.some((k) => normalized === k || normalized === k + '.')
}

export async function recordWhatsAppOptOut(phone: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('whatsapp_opt_outs').upsert({ phone })
}

export async function isWhatsAppOptedOut(phone: string): Promise<boolean> {
  const supabase = createAdminClient()
  const cleanPhone = phone.replace(/\D/g, '')
  const { data } = await supabase.from('whatsapp_opt_outs').select('phone').ilike('phone', `%${cleanPhone.slice(-8)}%`).maybeSingle()
  return !!data
}

// Checa opt-out E limite diário de uma vez — usar isso antes de
// qualquer envio AUTOMÁTICO (boas-vindas, lembrete, automação por
// gatilho). Envio manual, feito por uma pessoa, não passa por aqui.
export async function canSendAutomatedWhatsApp(phone: string): Promise<{ ok: boolean; reason?: string }> {
  const supabase = createAdminClient()

  const optedOut = await isWhatsAppOptedOut(phone)
  if (optedOut) return { ok: false, reason: 'opted_out' }

  const { data: settings } = await supabase.from('organization_settings').select('whatsapp_daily_auto_limit').eq('id', 'default').maybeSingle()
  const limit = settings?.whatsapp_daily_auto_limit ?? 3

  const cleanPhone = phone.replace(/\D/g, '')
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('contract_whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .ilike('phone', `%${cleanPhone.slice(-8)}%`)
    .eq('triggered_automatically', true)
    .gte('created_at', oneDayAgo)

  if ((count ?? 0) >= limit) return { ok: false, reason: 'daily_limit' }

  return { ok: true }
}
