import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: s } = await admin.from('organization_settings').select('evo_server_url, evo_api_key, evo_instance_name').eq('id', 'default').maybeSingle()
  if (!s?.evo_server_url) return NextResponse.json({ error: 'Credenciais não configuradas' })

  const { evo_server_url: url, evo_api_key: key, evo_instance_name: instance } = s
  const results: Record<string, any> = {}

  // 1. Tenta criar instância
  try {
    const r = await fetch(`${url}/instance/create`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceName: instance, token: '', qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    })
    results.create = { status: r.status, body: await r.json().catch(() => r.text()) }
  } catch (e: any) { results.create = { error: e.message } }

  // 2. Tenta connect
  try {
    const r = await fetch(`${url}/instance/connect/${instance}`, {
      headers: { apikey: key },
    })
    results.connect = { status: r.status, body: await r.json().catch(() => r.text()) }
  } catch (e: any) { results.connect = { error: e.message } }

  // 3. fetchInstances
  try {
    const r = await fetch(`${url}/instance/fetchInstances`, {
      headers: { apikey: key },
    })
    results.fetchInstances = { status: r.status, body: await r.json().catch(() => r.text()) }
  } catch (e: any) { results.fetchInstances = { error: e.message } }

  return NextResponse.json({ instance, url, results })
}
