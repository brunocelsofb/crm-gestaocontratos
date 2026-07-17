'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Não renderiza nada — só fica escutando qualquer mensagem nova (de
// qualquer conversa) pra atualizar a lista da esquerda (última
// mensagem, ordem, conversas não vinculadas novas). O chat em si
// (quando uma conversa está aberta) tem sua própria inscrição em
// tempo real, mais direta.
export function WhatsAppInboxRealtimeWatcher() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('whatsapp-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'contract_crm', table: 'contract_whatsapp_messages' }, () => {
        router.refresh()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
