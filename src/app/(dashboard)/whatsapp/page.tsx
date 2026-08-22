import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ContractWhatsAppSection } from '@/components/whatsapp/contract-whatsapp-section'
import { WhatsAppConversationPanel } from '@/components/whatsapp/whatsapp-conversation-panel'
import { getConversationByPhone, searchContractsForLinking, getWhatsAppAssignments } from '@/lib/actions/whatsapp'
import { WhatsAppInboxRealtimeWatcher } from '@/components/whatsapp/whatsapp-inbox-realtime-watcher'
import { ImportWhatsAppChatsButton } from '@/components/whatsapp/import-whatsapp-chats-button'
import { WhatsAppSidebar } from '@/components/whatsapp/whatsapp-sidebar'

export default async function WhatsAppInboxPage({ searchParams }: { searchParams: Promise<{ contract?: string; phone?: string }> }) {
  const { contract: selectedContractId, phone: selectedPhone } = await searchParams
  const supabase = await createClient()

  // Conversas SEM contrato (podem ou não já ser um Lead) — agrupadas
  // por telefone, com a última mensagem de cada uma.
  const { data: openMessages } = await supabase
    .from('contract_whatsapp_messages')
    .select('phone, unlinked_sender_name, sender_photo_url, message, media_type, direction, created_at, lead_id, instance_name')
    .is('contract_id', null)
    .order('created_at', { ascending: false })
    .limit(300)

  // Busca conversas arquivadas
  const { data: archivedRows } = await supabase
    .from('whatsapp_conversation_status')
    .select('phone')
    .eq('is_archived', true)
  const archivedPhones = new Set((archivedRows ?? []).map((r: any) => r.phone))

  const latestByPhone = new Map<string, { unlinked_sender_name: string | null; sender_photo_url: string | null; message: string; media_type: string | null; direction: string; created_at: string; lead_id: string | null; instance_name: string | null }>()
  for (const m of openMessages ?? []) {
    if (!latestByPhone.has(m.phone)) latestByPhone.set(m.phone, m)
  }
  const openPhones = Array.from(latestByPhone.entries()).filter(([phone]) => !archivedPhones.has(phone))
  const archivedConvList = Array.from(latestByPhone.entries())
    .filter(([phone]) => archivedPhones.has(phone))
    .map(([phone, m]) => ({ phone, latest: m }))
    .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime())

  const leadIds = openPhones.map(([, m]) => m.lead_id).filter((id): id is string => !!id)
  const { data: leadsData } = leadIds.length ? await supabase.from('leads').select('id, name, company_name').in('id', leadIds) : { data: [] }
  const leadById = new Map((leadsData ?? []).map((l) => [l.id, l]))

  const openConversations = openPhones
    .map(([phone, m]) => ({
      phone,
      latest: m,
      lead: m.lead_id ? leadById.get(m.lead_id) : null,
    }))
    .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime())

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()
  const { data: teamUsers } = await supabase.from('profiles').select('id, full_name').order('full_name')
  const assignments = await getWhatsAppAssignments(openConversations.map((c) => c.phone))

  // Conversas JÁ vinculadas a um contrato.
  const { data: recentMessages } = await supabase
    .from('contract_whatsapp_messages')
    .select('contract_id, phone, message, media_type, direction, created_at')
    .not('contract_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)

  const latestByContract = new Map<string, { phone: string; message: string; media_type: string | null; direction: string; created_at: string }>()
  for (const m of recentMessages ?? []) {
    if (!m.contract_id) continue
    if (!latestByContract.has(m.contract_id)) latestByContract.set(m.contract_id, m)
  }
  const contractIds = Array.from(latestByContract.keys())
  const { data: contracts } = contractIds.length ? await supabase.from('contracts').select('id, title, client_name').in('id', contractIds) : { data: [] }

  // O nome que aparece é sempre o do CONTATO (pessoa) que está na
  // conversa de verdade — nunca o nome da empresa/conta, mesmo que a
  // conversa esteja vinculada a um contrato.
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

  const { data: zapiSettings } = await supabase.from('organization_settings').select('evo_instance_name, evo_instance_aliases').eq('id', 'default').maybeSingle()
  const isConnected = !!(zapiSettings as any)?.evo_instance_name
  const instanceAliases = (zapiSettings as any)?.evo_instance_aliases ?? {}

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
          <ImportWhatsAppChatsButton />
        </div>
      </div>

      {/* Inbox — ocupa todo o espaço restante */}
      <div className="flex flex-1 min-h-0 gap-3">
        <WhatsAppInboxRealtimeWatcher />
        <div className="w-72 shrink-0 flex flex-col min-h-0 border-r border-gray-100 pr-2">
          <WhatsAppSidebar
            open={openConversations as any}
            archived={archivedConvList as any}
            selectedPhone={selectedPhone}
            assignments={assignments}
            currentUserId={currentUser?.id ?? ''}
            instanceAliases={instanceAliases as any}
          />
          <div className="mt-2 flex-shrink-0 space-y-1">
            {contractConversations.length > 0 && <p className="px-1 text-xs font-semibold uppercase text-gray-400">Contas</p>}
            {contractConversations.map((c) => (
              <Link
                key={c.id}
                href={`/whatsapp?contract=${c.id}`}
                className={`block rounded-md px-3 py-2 text-sm hover:bg-gray-100 ${selectedContractId === c.id ? 'border border-brand-200 bg-brand-50' : 'border border-transparent'}`}
              >
                <p className="font-medium text-gray-900">{c.contactName || `${c.client_name || c.title} (contato não identificado)`}</p>
                <p className="truncate text-xs text-gray-500">
                  {c.latest.direction === 'enviado' ? '📤 ' : '📥 '}
                  {c.latest.media_type ? `[${c.latest.media_type}]` : c.latest.message}
                </p>
                <p className="text-[10px] text-gray-400">{new Date(c.latest.created_at).toLocaleString('pt-BR')}</p>
              </Link>
            ))}
          </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {selectedOpenData ? (
            <WhatsAppConversationPanel
              phone={selectedPhone!}
              displayName={selectedOpenData.displayName}
              leadId={selectedOpenData.leadId}
              messages={selectedOpenData.messages}
              searchContracts={searchContractsForLinking}
              currentUserId={currentUser?.id ?? ''}
              users={teamUsers ?? []}
              assignment={assignments[selectedPhone!] ?? null}
              instanceName={latestByPhone.get(selectedPhone!)?.instance_name ?? null}
              initialIsArchived={archivedPhones.has(selectedPhone!)}
            />
          ) : selectedContractData?.contract ? (
            <div className="space-y-2">
              <div>
                <Link href={`/contracts/${selectedContractData.contract.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                  {selectedContractData.contract.client_name || selectedContractData.contract.title} →
                </Link>
              </div>
              <ContractWhatsAppSection
                contractId={selectedContractData.contract.id}
                isConnected={isConnected}
                templates={selectedContractData.templates}
                defaultPhone={selectedContractData.defaultPhone}
                messageLog={selectedContractData.messages}
              />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#b0b8c8' }}>
              Selecione uma conversa à esquerda.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
