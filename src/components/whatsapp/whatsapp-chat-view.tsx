'use client'

type ChatMessage = {
  id: string
  direction: string
  message: string
  media_url: string | null
  media_type: string | null
  media_filename: string | null
  sender_photo_url: string | null
  delivery_status: string | null
  status: string
  error_message: string | null
  triggered_automatically: boolean
  created_at: string
}

const DELIVERY_TICK: Record<string, string> = {
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
}

function MediaContent({ mediaUrl, mediaType, mediaFilename }: { mediaUrl: string; mediaType: string; mediaFilename: string | null }) {
  if (mediaType === 'image') {
    return <img src={mediaUrl} alt="Imagem enviada" className="max-w-[240px] rounded-md" />
  }
  if (mediaType === 'audio') {
    return <audio controls src={mediaUrl} className="max-w-[240px]" />
  }
  if (mediaType === 'video') {
    return <video controls src={mediaUrl} className="max-w-[240px] rounded-md" />
  }
  return (
    <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm underline">
      📎 {mediaFilename ?? 'Arquivo'}
    </a>
  )
}

export function WhatsAppChatView({ messages }: { messages: ChatMessage[] }) {
  const chronological = [...messages].reverse()

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-[#e5ddd5] p-4">
      {chronological.map((m) => {
        const isSent = m.direction === 'enviado'
        return (
          <div key={m.id} className={`flex items-end gap-2 ${isSent ? 'flex-row-reverse' : ''}`}>
            {!isSent && (
              m.sender_photo_url ? (
                <img src={m.sender_photo_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-7 w-7 shrink-0 rounded-full bg-gray-300" />
              )
            )}
            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${isSent ? 'bg-[#dcf8c6] text-gray-900' : 'bg-white text-gray-900'}`}>
              {m.media_url && m.media_type ? (
                <MediaContent mediaUrl={m.media_url} mediaType={m.media_type} mediaFilename={m.media_filename} />
              ) : (
                <p className="whitespace-pre-wrap">{m.message}</p>
              )}
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500">
                {m.triggered_automatically && <span title="Enviado por automação">🤖</span>}
                <span>{new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                {isSent && m.status === 'falhou' && <span className="text-red-600" title={m.error_message ?? ''}>Falhou</span>}
                {isSent && m.status === 'enviado' && m.delivery_status && (
                  <span className={m.delivery_status === 'read' ? 'text-blue-500' : 'text-gray-400'} title={m.delivery_status}>
                    {DELIVERY_TICK[m.delivery_status] ?? ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
      {chronological.length === 0 && <p className="py-8 text-center text-sm text-gray-500">Nenhuma mensagem ainda.</p>}
    </div>
  )
}
