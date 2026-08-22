import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEvoTextMessage } from '@/lib/whatsapp/evolution'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const phone = body.phone
  const instanceName = body.instanceName ?? null

  if (!phone) return NextResponse.json({ error: 'phone obrigatório' }, { status: 400 })

  // Normaliza o telefone — remove tudo que não é dígito
  const cleanPhone = String(phone).replace(/\D/g, '')
  console.log('[archive] iniciando para phone:', phone, '→ cleanPhone:', cleanPhone, '| instance:', instanceName)

  const admin = createAdminClient()

  // Upsert na tabela de status
  console.log('[archive] executando upsert...')
  const { data: upsertData, error: upsertError } = await admin
    .from('whatsapp_conversation_status')
    .upsert({
      phone: cleanPhone,
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'phone' })
    .select()

  if (upsertError) {
    console.error('[archive] ERRO no upsert:', JSON.stringify(upsertError))
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }
  console.log('[archive] upsert OK:', JSON.stringify(upsertData))

  // Verifica se foi salvo
  const { data: check } = await admin
    .from('whatsapp_conversation_status')
    .select('phone, is_archived')
    .eq('phone', cleanPhone)
    .maybeSingle()
  console.log('[archive] verificação pós-upsert:', JSON.stringify(check))

  // Busca credenciais e mensagem personalizada
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

  if (org?.evo_server_url && org?.evo_api_key) {
    const creds = {
      serverUrl: org.evo_server_url,
      apiKey: org.evo_api_key,
      instanceName: instanceName ?? org.evo_instance_name,
    }
    try {
      await sendEvoTextMessage({ ...creds, phone: cleanPhone, message: closingMsg })
      console.log('[archive] mensagem de encerramento enviada para:', cleanPhone)
    } catch (e) {
      console.warn('[archive] falha ao enviar mensagem (não bloqueia):', e)
    }
  }

  return NextResponse.json({ ok: true, phone: cleanPhone, archived: true })
}
