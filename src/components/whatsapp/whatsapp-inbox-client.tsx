'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { WhatsAppSidebar } from './whatsapp-sidebar'
import { WhatsAppInboxRealtimeWatcher } from './whatsapp-inbox-realtime-watcher'
import { ContractWhatsAppSection } from './contract-whatsapp-section'
import { WhatsAppConversationLoader } from './whatsapp-conversation-loader'

export function WhatsAppInboxClient({
  open, archived, selectedPhone, selectedContractId,
  assignments, currentUserId, instanceAliases,
  selectedOpenData, selectedContractData, teamUsers,
  isConnected, contractConversations,
}: {
  open: any[]; archived: any[]; selectedPhone: string | null; selectedContractId: string | null
  assignments: Record<string, any>; currentUserId: string; instanceAliases: Record<string, any>
  selectedOpenData: any; selectedContractData: any; teamUsers: any[]; isConnected: boolean
  contractConversations: any[]
}) {
  const router = useRouter()
  const [isPending] = useTransition()

  function handleArchived(phone: string) {
    router.push('/whatsapp')
    router.refresh()
  }

  return (
    <div className="flex flex-1 min-h-0 gap-3">
      <WhatsAppInboxRealtimeWatcher />

      {/* Sidebar esquerda: lista com scroll + contas fixas no rodapé */}
      <div className="w-72 shrink-0 flex flex-col min-h-0 border-r border-gray-100 pr-2">

        {/* Lista Em aberto / Arquivados — scroll interno */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <WhatsAppSidebar
            open={open}
            archived={archived}
            selectedPhone={selectedPhone}
            assignments={assignments}
            currentUserId={currentUserId}
            instanceAliases={instanceAliases}
          />
        </div>

        {/* Contas — fixas no rodapé com max-height próprio */}
        {contractConversations.length > 0 && (
          <div className="shrink-0 border-t border-gray-100 pt-2 mt-2 space-y-1 overflow-y-auto max-h-52">
            <p className="px-1 text-xs font-semibold uppercase text-gray-400">Contas</p>
            {contractConversations.map((c: any) => (
              <Link key={c.id} href={`/whatsapp?contract=${c.id}`}
                className={`block rounded-md px-3 py-2 text-sm hover:bg-gray-100 ${selectedContractId === c.id ? 'border border-brand-200 bg-brand-50' : 'border border-transparent'}`}>
                <p className="font-medium text-gray-900 truncate">{c.contactName || c.client_name || c.title}</p>
                <p className="truncate text-xs text-gray-500">
                  {c.latest?.direction === 'enviado' ? '📤 ' : '📥 '}
                  {c.latest?.media_type ? `[${c.latest.media_type}]` : c.latest?.message}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Área direita */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {selectedPhone && selectedOpenData ? (
          <WhatsAppConversationLoader
            phone={selectedPhone}
            currentUserId={currentUserId}
            users={teamUsers}
            isArchivedInitial={archived.some((c: any) => c.phone === selectedPhone)}
          />
        ) : selectedContractData?.contract ? (
          <div className="flex flex-col h-full min-h-0">
            <div className="shrink-0 px-2 pt-2 pb-1 border-b border-gray-100">
              <Link href={`/contracts/${selectedContractData.contract.id}`}
                className="text-sm font-medium text-brand-700 hover:underline">
                {selectedContractData.contract.client_name || selectedContractData.contract.title} →
              </Link>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <ContractWhatsAppSection
                contractId={selectedContractData.contract.id}
                isConnected={isConnected}
                templates={selectedContractData.templates}
                defaultPhone={selectedContractData.defaultPhone}
                messageLog={selectedContractData.messages}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Selecione uma conversa à esquerda.
          </div>
        )}
      </div>
    </div>
  )
}
