export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContractWhatsAppSection } from '@/components/whatsapp/contract-whatsapp-section'
import { WhatsAppConversationPanel } from '@/components/whatsapp/whatsapp-conversation-panel'
import { getConversationByPhone, searchContractsForLinking, getWhatsAppAssignments } from '@/lib/actions/whatsapp'
import { WhatsAppInboxRealtimeWatcher } from '@/components/whatsapp/whatsapp-inbox-realtime-watcher'
import { ImportWhatsAppChatsButton } from '@/components/whatsapp/import-whatsapp-chats-button'
import { WhatsAppSidebar } from '@/components/whatsapp/whatsapp-sidebar'
import { WhatsAppInboxClient } from '@/components/whatsapp/whatsapp-inbox-client'

export default async function WhatsAppInboxPage({ searchParams }: { searchParams: Promise<{ contract?: string; phone?: string }> }) {
  const { contract: selectedContractId, phone: selectedPhone } = await searchParams
  const supabase = await createClient()
  const adminForStatus = createAdminClient()
  const normalizePhone = (p: string) => String(p).replace(/\D/g, '')

  // Queries paralelas — reduz latência de sequencial para paralela
  const [
    { data: archivedRows },
    { data: openMessages },
    { data: { user: currentUser } },
    { data: teamUsers },
    { data: recentMessages },
  ] = await Promise.all([
    adminForStatus.from('whatsapp_conversation_status').select('phone').eq('is_archived', true),
    supabase.from('contract_whatsapp_messages')
      .select('phone, unlinked_sender_name, message, media_type, direction, created_at, lead_id, instance_name')
      .is('contract_id', null)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.auth.getUser(),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase.from('contract_whatsapp_messages')
      .select('contract_id, phone, message, media_type, direction, created_at')
      .not('contract_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const archivedPhonesList = (archivedRows ?? []).map((r: any) => normalizePhone(r.phone))
  const archivedPhones = new Set(archivedPhonesList)
  const isArchived = (phone: string) => archivedPhones.has(normalizePhone(phone))

  const latestByPhone = new Map<string, { unlinked_sender_name: string | null; message: string; media_type: string | null; direction: string; created_at: string; lead_id: string | null; instance_name: string | null }>()
  for (const m of openMessages ?? []) {
    if (!latestByPhone.has(m.phone)) latestByPhone.set(m.phone, m)
  }

  const openPhones = Array.from(latestByPhone.entries()).filter(([phone]) => !isArchived(phone))
  const archivedConvList = Array.from(latestByPhone.entries())
    .filter(([phone]) => isArchived(phone))
    .map(([phone, m]) => ({ phone, latest: m }))
    .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime())

  const leadIds = openPhones.map(([, m]) => m.lead_id).filter((id): id is string => !!id)
  const [{ data: zapiSettings }, { data: leadsData }, assignments] = await Promise.all([
    supabase.from('organization_settings').select('evo_instance_name, evo_instance_aliases').eq('id', 'default').maybeSingle(),
    leadIds.length ? supabase.from('leads').select('id, name, company_name').in('id', leadIds) : Promise.resolve({ data: [] as any[] }),
    getWhatsAppAssignments(openPhones.map(([phone]) => phone)),
  ])
  const isConnected = !!(zapiSettings as any)?.evo_instance_name
  const instanceAliases = (zapiSettings as any)?.evo_instance_aliases ?? {}
  const leadById = new Map((leadsData ?? []).map((l) => [l.id, l]))

  const openConversations = openPhones
    .map(([phone, m]) => ({ phone, latest: m, lead: m.lead_id ? leadById.get(m.lead_id) : null }))
    .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime())

  const latestByContract = new Map<string, { phone: string; message: string; media_type: string | null; direction: string; created_at: string }>()
  for (const m of recentMessages ?? []) {
    if (!m.contract_id) continue
    if (!latestByContract.has(m.contract_id)) latestByContract.set(m.contract_id, m)
  }
  const contractIds = Array.from(latestByContract.keys())
  const { data: contracts } = contractIds.length
    ? await supabase.from('contracts').select('id, title, client_name').in('id', contractIds)
    : { data: [] }

  const conversationPhones = Array.from(latestByContract.values()).map((m) => m.phone)
  const contactNameByPhone = new Map<string, string>()
  if (conversationPhones.length > 0) {
    const { data: allContacts } = await supabase.from('contacts').select('name, phone').not('phone', 'is', null)
    for (const phone of conversationPhones) {
      const last8 = phone.replace(/\D/g, '').slice(-8)
      const match = (allContacts ?? []).find((c) => c.phone && c.phone.replace(/\D/g, '').includes(last8))
      if (match) contactNameByPhone.set(phone, match.name)
    }
  }

  const contractConversations = (contracts ?? [])
    .map((c) => {
      const latest = latestByContract.get(c.id)!
      return { ...c, latest, contactName: contactNameByPhone.get(latest.phone) ?? null }
    })
    .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime())

  // Métricas do funil de WhatsApp — tudo em contagens de TELEFONES
  // únicos, nunca mensagens individuais (uma conversa tem muitas
  // mensagens, contar mensagem inflaria os números).
  const [
    { count: totalEntradas },      // prompts enviados = 1 por telefone por definição (PK)
    { count: totalLeadsWpp },      // prompts que viraram lead
    { count: totalOptOut },        // opt-outs
    { data: vinculadosData },      // mensagens vinculadas a contrato — precisa desduplicar por telefone
    { count: totalConvertidos },   // leads WhatsApp convertidos em oportunidade
  ] = await Promise.all([
    supabase.from('whatsapp_capture_prompts').select('phone', { count: 'exact', head: true }),
    supabase.from('whatsapp_capture_prompts').select('phone', { count: 'exact', head: true }).not('lead_id', 'is', null),
    supabase.from('whatsapp_opt_outs').select('phone', { count: 'exact', head: true }),
    supabase.from('contract_whatsapp_messages').select('phone').not('contract_id', 'is', null).is('lead_id', null),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'convertido'),
  ])

  // Desduplicar por telefone — quantas CONVERSAS distintas foram vinculadas
  const totalVinculados = new Set((vinculadosData ?? []).map(m => m.phone)).size

  // Histórico diário dos últimos 14 dias
  const historyData: { day: string; entradas: number; leads: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dayStr = d.toISOString().slice(0, 10)
    const [{ count: entradas }, { count: leads }] = await Promise.all([
      supabase.from('contract_whatsapp_messages').select('phone', { count: 'exact', head: true }).eq('direction', 'recebido').gte('created_at', `${dayStr}T00:00:00`).lte('created_at', `${dayStr}T23:59:59`).is('contract_id', null),
      supabase.from('whatsapp_capture_prompts').select('phone', { count: 'exact', head: true }).gte('sent_at', `${dayStr}T00:00:00`).lte('sent_at', `${dayStr}T23:59:59`),
    ])
    historyData.push({ day: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), entradas: entradas ?? 0, leads: leads ?? 0 })
  }

  const funnelData = [
    { label: 'Entradas', value: totalEntradas ?? 0, color: '#4f86f7' },
    { label: 'Leads gerados', value: totalLeadsWpp ?? 0, color: '#6366f1' },
    { label: 'Vinculados a conta', value: totalVinculados ?? 0, color: '#7c3aed' },
    { label: 'Convertidos', value: totalConvertidos ?? 0, color: '#1a7c3e' },
  ]

  let selectedContractData = null
  if (selectedContractId) {
    const [{ data: selectedContract }, { data: whatsappTemplates }, { data: whatsappMessages }] = await Promise.all([
      supabase.from('contracts').select('id, title, client_name, contact_id').eq('id', selectedContractId).maybeSingle(),
      supabase.from('email_templates').select('id, name').eq('context', 'contract').eq('channel', 'whatsapp').order('name'),
      supabase
        .from('contract_whatsapp_messages')
        .select('id, phone, message, direction, status, triggered_automatically, error_message, created_at, media_url, media_type, media_filename, sender_photo_url, delivery_status, sent_by, profiles(full_name)')
        .eq('contract_id', selectedContractId)
        .order('created_at', { ascending: false }),
    ])
    const { data: contactPhone } = selectedContract?.contact_id
      ? await supabase.from('contacts').select('phone').eq('id', selectedContract.contact_id).maybeSingle()
      : { data: null }

    selectedContractData = {
      contract: selectedContract,
      templates: whatsappTemplates ?? [],
      messages: (whatsappMessages ?? []).map((m: any) => ({ ...m, sent_by_name: m.profiles?.full_name ?? null })),
      defaultPhone: contactPhone?.phone ?? null,
    }
  }

  let selectedOpenData = null
  if (selectedPhone) {
    const conv = await getConversationByPhone(selectedPhone)
    selectedOpenData = conv
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header compacto */}
      <div className="flex items-center justify-between px-1 py-2 flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Central de Atendimento</h1>
          <p className="text-xs text-gray-400">WhatsApp · {openConversations.length} conversa(s) ativa(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/whatsapp/relatorios"
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            📊 Relatórios
          </Link>
        </div>
      </div>

      {/* Inbox — ocupa todo o espaço restante */}
      <WhatsAppInboxClient
        open={openConversations as any}
        archived={archivedConvList as any}
        selectedPhone={selectedPhone ?? null}
        selectedContractId={selectedContractId ?? null}
        assignments={assignments}
        currentUserId={currentUser?.id ?? ''}
        instanceAliases={instanceAliases as any}
        selectedOpenData={selectedOpenData}
        selectedContractData={selectedContractData}
        teamUsers={teamUsers ?? []}
        isConnected={isConnected}
        contractConversations={contractConversations as any}
      />
    </div>
  )
}
