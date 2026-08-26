import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    if (!phone) return NextResponse.json({ error: 'phone obrigatório' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const admin = createAdminClient()
    const cleanPhone = phone.replace(/\D/g, '')
    
    // CORREÇÃO: Pegando apenas os últimos 8 dígitos (ignora DDD e 9º dígito)
    const last8 = cleanPhone.slice(-8)

    // Busca TODAS as mensagens do phone (com e sem contract_id)
    let messages: any[] = []
    for (const phoneFilter of [
      (q: any) => q.eq('phone', cleanPhone),
      (q: any) => q.ilike('phone', `%${last8}`),
    ]) {
      const { data } = await phoneFilter(
        admin.from('contract_whatsapp_messages')
          .select('id, phone, message, direction, status, triggered_automatically, error_message, created_at, media_url, media_type, media_filename, sender_photo_url, delivery_status, lead_id, unlinked_sender_name, instance_name')
          .order('created_at', { ascending: true })
          .limit(500)
      )
      if (data?.length) {
        // Deduplica: remove registros espelhados (mesmo message+created_at+direction)
        const seen = new Set<string>()
        messages = data.filter((m: any) => {
          const key = `${m.direction}:${m.message}:${m.created_at?.slice(0, 19)}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        break
      }
    }

    const leadId = messages.find(m => m.lead_id)?.lead_id ?? null
    const instanceName = messages.find(m => m.instance_name)?.instance_name ?? null

    // Busca nome manual e aliases
    const { data: orgData } = await admin
      .from('organization_settings')
      .select('evo_instance_aliases, evo_instance_name, whatsapp_contact_names')
      .eq('id', 'default').maybeSingle()

    const contactNames = (orgData as any)?.whatsapp_contact_names ?? {}
    const manualName = contactNames[cleanPhone] ?? contactNames[last8] ?? contactNames[`55${cleanPhone}`] ?? null

    const aliases = (orgData as any)?.evo_instance_aliases ?? {}
    const instanceLabels = new Set<string>(
      [orgData?.evo_instance_name, ...Object.values(aliases).map((v: any) => typeof v === 'string' ? v : v?.label)]
        .filter(Boolean).map((s: string) => s.toLowerCase())
    )

    let displayName = manualName
    if (!displayName) {
      displayName = messages
        .filter(m => m.direction === 'recebido' && m.unlinked_sender_name)
        .find(m => !instanceLabels.has((m.unlinked_sender_name ?? '').toLowerCase()))
        ?.unlinked_sender_name ?? null
    }

    // Busca atribuição
    const { data: assignment } = await admin
      .from('whatsapp_conversation_assignments')
      .select('assigned_to, profiles!whatsapp_conversation_assignments_assigned_to_fkey(full_name)')
      .eq('phone', phone)
      .maybeSingle()

    const assignmentData = assignment ? {
      assigned_to: assignment.assigned_to,
      assigned_to_name: (assignment as any).profiles?.full_name ?? '',
    } : null

    return NextResponse.json({
      messages, leadId, displayName, instanceName, assignment: assignmentData,
    })
  } catch (e: any) {
    console.error('[api/whatsapp/conversation]', e?.message)
    return NextResponse.json({ error: e?.message ?? 'Erro interno' }, { status: 500 })
  }
}
