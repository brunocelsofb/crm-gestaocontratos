import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEvoTextMessage } from '@/lib/whatsapp/evolution'
import { revalidatePath } from 'next/cache'

async function doArchive(phone: string, userId: string, sendClosing: boolean, instanceName: string | null) {
  const admin = createAdminClient()
  const cleanPhone = String(phone).replace(/\D/g, '')
  const last8 = cleanPhone.slice(-8)
  
  // A correção: Garantimos a instância correta (seja Matheus, Pedro, ou vazio)
  const targetInstance = instanceName ?? ''
  
  console.log('[archive] phone:', phone, '→ last8:', last8, '| instance:', targetInstance)

  let dbError: any = null
  let success = false

  // 1. Busca variações do número PARA ESTA INSTÂNCIA
  let query = admin
    .from('whatsapp_conversation_status')
    .select('phone')
    .ilike('phone', `%${last8}`)
    
  if (targetInstance) {
    query = query.eq('instance_name', targetInstance)
  } else {
    query = query.or('instance_name.is.null,instance_name.eq.""')
  }

  const { data: existing } = await query

  if (existing && existing.length > 0) {
    // 2. Atualiza a conversa desta instância específica
    for (const row of existing) {
      let updateQuery = admin
        .from('whatsapp_conversation_status')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('phone', row.phone)

      if (targetInstance) {
        updateQuery = updateQuery.eq('instance_name', targetInstance)
      } else {
        updateQuery = updateQuery.or('instance_name.is.null,instance_name.eq.""')
      }

      const { error } = await updateQuery
      if (error) dbError = error
      else success = true
    }
  } else {
    // 3. SE NÃO EXISTIR, INSERE COM A INSTÂNCIA CORRETA (o meu erro estava aqui!)
    const { error } = await admin
      .from('whatsapp_conversation_status')
      .insert({
        phone: cleanPhone,
        instance_name: targetInstance === '' ? null : targetInstance, // Salva corretamente!
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by: userId,
        updated_at: new Date().toISOString(),
      })
      
    if (error) dbError = error
    else success = true
  }

  if (!success) {
    console.error('[archive] Erro do Supabase:', dbError)
    return { ok: false, error: `Erro do Banco: ${dbError?.message || dbError?.details || 'Desconhecido'}` }
  }

  revalidatePath('/whatsapp')

  if (sendClosing) {
    const { data: org } = await admin
      .from('organization_settings')
      .select('evo_server_url, evo_api_key, evo_instance_name, evo_instance_aliases')
      .eq('id', 'default')
      .maybeSingle()

    if (org?.evo_server_url && org?.evo_api_key) {
      const aliases = (org as any)?.evo_instance_aliases ?? {}
      const inst = instanceName ? aliases[instanceName] : null
      const msg = (typeof inst === 'object' ? inst?.closingMessage : null)
        ?? '*Atendimento finalizado.* Se precisar de mais alguma coisa, basta enviar uma nova mensagem por aqui! 😊'
      try {
        await sendEvoTextMessage({
          serverUrl: org.evo_server_url,
          apiKey: org.evo_api_key,
          instanceName: instanceName ?? org.evo_instance_name,
          phone: cleanPhone,
          message: msg,
        })
      } catch (e) { console.warn('[archive] falha ao enviar:', e) }
    }
  }

  return { ok: true }
}

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') ?? 'finalize'
  const { phone, instanceName } = await req.json()
  if (!phone) return NextResponse.json({ error: 'phone obrigatório' }, { status: 400 })

  const result = await doArchive(phone, user.id, mode === 'finalize', instanceName ?? null)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
