import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ContractWhatsAppSection } from '@/components/whatsapp/contract-whatsapp-section'
import { UnlinkedWhatsAppConversation } from '@/components/whatsapp/unlinked-whatsapp-conversation'
import { getUnlinkedWhatsAppConversations, getUnlinkedMessagesByPhone, searchContractsForLinking } from '@/lib/actions/whatsapp'
import { WhatsAppInboxRealtimeWatcher } from '@/components/whatsapp/whatsapp-inbox-realtime-watcher'

export default async function WhatsAppInboxPage({ searchParams }: { searchParams: Promise<{ contract?: string; phone?: string }> }) {
  const { contract: selectedContractId, phone: selectedPhone } = await searchParams
  const supabase = await createClient()

  const [{ data: recentMessages }, unlinkedConversations] = await Promise.all([
    supabase
      .from('contract_whatsapp_messages')
      .select('contract_id, message, media_type, direction, created_at')
      .not('contract_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200),
    getUnlinkedWhatsAppConversations(),
  ])

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

  let selectedData = null
  if (selectedContractId) {
    const [{ data: selectedContract }, { data: whatsappTemplates }, { data: whatsappMessages }] = await Promise.all([
      supabase.from('contracts').select('id, title, client_name, contact_id').eq('id', selectedContractId).maybeSingle(),
      supabase.from('email_templates').select('id, name').eq('context', 'contract').eq('channel', 'whatsapp').order('name'),
      supabase
        .from('contract_whatsapp_messages')
        .select('id, phone, message, direction, status, triggered_automatically, error_message, created_at, media_url, media_type, media_filename, sender_photo_url, delivery_status')
        .eq('contract_id', selectedContractId)
        .order('created_at', { ascending: false }),
    ])

    const { data: contactPhone } = selectedContract?.contact_id
      ? await supabase.from('contacts').select('phone').eq('id', selectedContract.contact_id).maybeSingle()
      : { data: null }

    selectedData = {
      contract: selectedContract,
      templates: whatsappTemplates ?? [],
      messages: whatsappMessages ?? [],
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
    <div className="flex h-[calc(100vh-8rem)] gap-4">
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
  )
}
