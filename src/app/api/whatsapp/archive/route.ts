import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEvoTextMessage } from '@/lib/whatsapp/evolution'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { phone, instanceName } = await req.json()
  if (!phone) return NextResponse.json({ error: 'phone obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  // 1. Salva no banco
  const { error } = await admin
    .from('whatsapp_conversation_status')
    .upsert({
      phone,
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'phone' })

  if (error) {
    console.error('[archive] erro ao salvar:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[archive] conversa arquivada:', phone)

  // 2. Busca mensagem personalizada da instância
  const { data: org } = await admin
    .from('organization_settings')
    .select('evo_server_url, evo_api_key, evo_instance_name, evo_instance_aliases')
    .eq('id', 'default')
    .maybeSingle()

  const aliases = (org as any)?.evo_instance_aliases ?? {}
  const instAlias = instanceName ? aliases[instanceName] : null
  const closingMsg =
    (typeof instAlias === 'object' ? instAlias?.closingMessage : null) ??
    '*Atendimento finalizado.* Se precisar de mais alguma coisa, basta enviar uma nova mensagem por aqui! 😊'

  // 3. Envia mensagem de encerramento
  if (org?.evo_server_url && org?.evo_api_key) {
    const creds = {
      serverUrl: org.evo_server_url,
      apiKey: org.evo_api_key,
      instanceName: instanceName ?? org.evo_instance_name,
    }
    try {
      await sendEvoTextMessage({ ...creds, phone, message: closingMsg })
      console.log('[archive] mensagem de encerramento enviada')
    } catch (e) {
      console.warn('[archive] falha ao enviar mensagem:', e)
    }
  }

  return NextResponse.json({ ok: true })
}
