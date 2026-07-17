import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ContractWhatsAppSection } from '@/components/whatsapp/contract-whatsapp-section'
import { UnlinkedWhatsAppConversation } from '@/components/whatsapp/unlinked-whatsapp-conversation'
import { getUnlinkedWhatsAppConversations, getUnlinkedMessagesByPhone, searchContractsForLinking } from '@/lib/actions/whatsapp'
import { WhatsAppInboxRealtimeWatcher } from '@/components/whatsapp/whatsapp-inbox-realtime-watcher'

export default async function WhatsAppInboxPage({ searchParams }: { searchParams: Promise<{ contract?: string; phone?: string }> }) {
  const { contract: selectedContractId, phone: selectedPhone } = await searchParams
  const supabase = await createClient()

  const [{ data: recentMessages }, unlinkedConversations, { data: leadMessages }] = await Promise.all([
    supabase
      .from('contract_whatsapp_messages')
      .select('contract_id, message, media_type, direction, created_at')
      .not('contract_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200),
    getUnlinkedWhatsAppConversations(),
    supabase
      .from('contract_whatsapp_messages')
      .select('lead_id, message, media_type, direction, created_at')
      .not('lead_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const latestByLead = new Map<string, { message: string; media_type: string | null; direction: string; created_at: string }>()
  for (const m of leadMessages ?? []) {
    if (!m.lead_id) continue
    if (!latestByLead.has(m.lead_id)) latestByLead.set(m.lead_id, m)
  }
  const leadIds = Array.from(latestByLead.keys())
  const { data: leadsData } = leadIds.length ? await supabase.from('leads').select('id, name, company_name').in('id', leadIds) : { data: [] }
  const leadConversations = (leadsData ?? [])
    .map((l) => ({ ...l, latest: latestByLead.get(l.id)! }))
    .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime())

  const latestByContract = new Map<string, { message: string; media_type: string | null; direction: string; created_at: string }>()
  for (const m of recentMessages ?? []) {
    if (!m.contract_id) continue
    if (!latestByContract.has(m.contract_id)) latestByContract.set(m.contract_id, m)
  }

  const contractIds = Array.from(latestByContract.keys())
  const { data: contracts } = contractIds.length
    ? await supabase.from('contracts').select('id, title, client_name').in('id', contractIds)
    : { data: [] }

  const conversations = (contracts ?? [])
    .map((c) => ({ ...c, latest: latestByContract.get(c.id)! }))
    .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime())

  const { data: zapiSettings } = await supabase.from('organization_settings').select('zapi_instance_id').eq('id', 'default').maybeSingle()
  const isConnected = !!zapiSettings?.zapi_instance_id

  // Métricas do fluxo de captação — sem isso não dá pra saber se está
  // funcionando ou só incomodando gente.
  const [{ count: promptsTotal }, { count: promptsConverted }, { count: remindersSent }, { count: optOuts }] = await Promise.all([
    supabase.from('whatsapp_capture_prompts').select('phone', { count: 'exact', head: true }),
    supabase.from('whatsapp_capture_prompts').select('phone', { count: 'exact', head: true }).not('lead_id', 'is', null),
    supabase.from('whatsapp_capture_prompts').select('phone', { count: 'exact', head: true }).not('reminder_sent_at', 'is', null),
    supabase.from('whatsapp_opt_outs').select('phone', { count: 'exact', head: true }),
  ])
  const conversionRate = promptsTotal && promptsTotal > 0 ? Math.round(((promptsConverted ?? 0) / promptsTotal) * 100) : 0

  let selectedData = null
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

    selectedData = {
      contract: selectedContract,
      templates: whatsappTemplates ?? [],
      messages: (whatsappMessages ?? []).map((m: any) => ({ ...m, sent_by_name: m.profiles?.full_name ?? null })),
      defaultPhone: contactPhone?.phone ?? null,
    }
  }

  let selectedUnlinked = null
  if (selectedPhone) {
    const messages = await getUnlinkedMessagesByPhone(selectedPhone)
    const conv = unlinkedConversations.find((c) => c.phone === selectedPhone)
    selectedUnlinked = { phone: selectedPhone, senderName: conv?.senderName ?? null, messages }
  }

  return (
    <div className="space-y-3">
      {(promptsTotal ?? 0) > 0 && (
        <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs">
          <span className="text-gray-500">📊 Fluxo de captação:</span>
          <span><strong>{promptsTotal}</strong> link{promptsTotal === 1 ? '' : 's'} mandado{promptsTotal === 1 ? '' : 's'}</span>
          <span className="text-gray-300">·</span>
          <span><strong className="text-positive-700">{conversionRate}%</strong> preencheram</span>
          <span className="text-gray-300">·</span>
          <span><strong>{remindersSent}</strong> lembrete{remindersSent === 1 ? '' : 's'} enviado{remindersSent === 1 ? '' : 's'}</span>
          <span className="text-gray-300">·</span>
          <span><strong>{optOuts}</strong> pediram pra sair</span>
        </div>
      )}
      <div className="flex h-[calc(100vh-11rem)] gap-4">
      <WhatsAppInboxRealtimeWatcher />
      <div className="w-72 shrink-0 space-y-3 overflow-y-auto">
        <h1 className="px-1 text-lg font-semibold text-gray-900">Central de Atendimento</h1>

        {unlinkedConversations.length > 0 && (
          <div className="space-y-1">
            <p className="px-1 text-xs font-semibold uppercase text-yellow-700">⚠️ Não vinculadas ({unlinkedConversations.length})</p>
            {unlinkedConversations.map((c) => (
              <Link
                key={c.phone}
                href={`/whatsapp?phone=${encodeURIComponent(c.phone)}`}
                className={`block rounded-md border px-3 py-2 text-sm hover:bg-yellow-50 ${selectedPhone === c.phone ? 'border-yellow-400 bg-yellow-50' : 'border-transparent bg-yellow-50/50'}`}
              >
                <p className="font-medium text-gray-900">{c.senderName || c.phone}</p>
                <p className="truncate text-xs text-gray-500">{c.lastMediaType ? `[${c.lastMediaType}]` : c.lastMessage}</p>
                <p className="text-[10px] text-gray-400">{new Date(c.lastMessageAt).toLocaleString('pt-BR')}</p>
              </Link>
            ))}
          </div>
        )}

        {leadConversations.length > 0 && (
          <div className="space-y-1">
            <p className="px-1 text-xs font-semibold uppercase text-purple-700">🎯 Leads em qualificação ({leadConversations.length})</p>
            {leadConversations.map((l) => (
              <Link
                key={l.id}
                href={`/leads/${l.id}`}
                className="block rounded-md border border-transparent bg-purple-50/50 px-3 py-2 text-sm hover:bg-purple-50"
              >
                <p className="font-medium text-gray-900">{l.name}{l.company_name ? ` · ${l.company_name}` : ''}</p>
                <p className="truncate text-xs text-gray-500">{l.latest.media_type ? `[${l.latest.media_type}]` : l.latest.message}</p>
                <p className="text-[10px] text-gray-400">{new Date(l.latest.created_at).toLocaleString('pt-BR')}</p>
              </Link>
            ))}
          </div>
        )}

        <div className="space-y-1">
          {unlinkedConversations.length > 0 && <p className="px-1 text-xs font-semibold uppercase text-gray-400">Contas</p>}
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/whatsapp?contract=${c.id}`}
              className={`block rounded-md px-3 py-2 text-sm hover:bg-gray-100 ${selectedContractId === c.id ? 'border border-brand-200 bg-brand-50' : 'border border-transparent'}`}
            >
              <p className="font-medium text-gray-900">{c.client_name || c.title}</p>
              <p className="truncate text-xs text-gray-500">
                {c.latest.direction === 'enviado' ? '📤 ' : '📥 '}
                {c.latest.media_type ? `[${c.latest.media_type}]` : c.latest.message}
              </p>
              <p className="text-[10px] text-gray-400">{new Date(c.latest.created_at).toLocaleString('pt-BR')}</p>
            </Link>
          ))}
          {conversations.length === 0 && <p className="px-1 text-sm text-gray-400">Nenhuma conta com conversa ainda.</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedUnlinked ? (
          <UnlinkedWhatsAppConversation
            phone={selectedUnlinked.phone}
            senderName={selectedUnlinked.senderName}
            messages={selectedUnlinked.messages}
            searchContracts={searchContractsForLinking}
          />
        ) : selectedData?.contract ? (
          <div className="space-y-2">
            <div>
              <Link href={`/contracts/${selectedData.contract.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                {selectedData.contract.client_name || selectedData.contract.title} →
              </Link>
            </div>
            <ContractWhatsAppSection
              contractId={selectedData.contract.id}
              isConnected={isConnected}
              templates={selectedData.templates}
              defaultPhone={selectedData.defaultPhone}
              messageLog={selectedData.messages}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Selecione uma conversa à esquerda.
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
