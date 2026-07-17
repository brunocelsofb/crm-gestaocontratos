// Integração com o WhatsApp via Z-API (API não-oficial, conecta pelo
// número real da empresa via QR Code).
//
// NOTA DE INCERTEZA: nunca testei isso contra a Z-API de verdade —
// o formato de envio (URL, corpo, headers) segue a documentação
// pública deles, mas o formato exato do webhook de RECEBIMENTO
// (nomes dos campos no JSON que eles mandam pra gente) eu não
// consegui confirmar 100% — pode precisar de ajuste assim que
// virmos o primeiro payload real chegando.

const ZAPI_BASE_URL = 'https://api.z-api.io'

export async function sendZApiTextMessage({
  instanceId,
  token,
  clientToken,
  phone,
  message,
}: {
  instanceId: string
  token: string
  clientToken: string
  phone: string
  message: string
}): Promise<{ messageId: string }> {
  const cleanPhone = phone.replace(/\D/g, '')

  const response = await fetch(`${ZAPI_BASE_URL}/instances/${instanceId}/token/${token}/send-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': clientToken,
    },
    body: JSON.stringify({ phone: cleanPhone, message }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha ao enviar WhatsApp: ${text}`)
  }

  const data = await response.json()
  return { messageId: data.messageId ?? data.zaapId ?? '' }
}

// Envia imagem ou documento — a Z-API pede a URL pública do arquivo
// (não faz upload direto), por isso a gente sobe pro nosso Storage
// primeiro e manda o link.
export async function sendZApiImageMessage({
  instanceId,
  token,
  clientToken,
  phone,
  imageUrl,
  caption,
}: {
  instanceId: string
  token: string
  clientToken: string
  phone: string
  imageUrl: string
  caption?: string
}): Promise<{ messageId: string }> {
  const cleanPhone = phone.replace(/\D/g, '')
  const response = await fetch(`${ZAPI_BASE_URL}/instances/${instanceId}/token/${token}/send-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
    body: JSON.stringify({ phone: cleanPhone, image: imageUrl, caption: caption ?? '' }),
  })
  if (!response.ok) throw new Error(`Falha ao enviar imagem: ${await response.text()}`)
  const data = await response.json()
  return { messageId: data.messageId ?? data.zaapId ?? '' }
}

export async function sendZApiDocumentMessage({
  instanceId,
  token,
  clientToken,
  phone,
  documentUrl,
  fileName,
}: {
  instanceId: string
  token: string
  clientToken: string
  phone: string
  documentUrl: string
  fileName: string
}): Promise<{ messageId: string }> {
  const cleanPhone = phone.replace(/\D/g, '')
  const ext = fileName.split('.').pop() ?? 'pdf'
  const response = await fetch(`${ZAPI_BASE_URL}/instances/${instanceId}/token/${token}/send-document/${ext}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
    body: JSON.stringify({ phone: cleanPhone, document: documentUrl, fileName }),
  })
  if (!response.ok) throw new Error(`Falha ao enviar documento: ${await response.text()}`)
  const data = await response.json()
  return { messageId: data.messageId ?? data.zaapId ?? '' }
}

export type ZApiChat = {
  phone: string
  name: string | null
  unread: number
  lastMessageTime: string | null
  isGroup: boolean
}

// Lista as conversas que já existem no WhatsApp conectado — inclusive
// as de ANTES da gente conectar o CRM. É isso que permite "importar"
// o histórico todo de uma vez, igual o WaLeads faz automaticamente.
//
// NOTA DE INCERTEZA: nunca testei esse endpoint ao vivo — os campos
// (phone, name, unread, lastMessageTime, isGroup) seguem a doc
// pública, mas o formato exato da resposta (array direto vs objeto
// com propriedade "chats") pode precisar de ajuste.
export async function getZApiChats({
  instanceId,
  token,
  clientToken,
}: {
  instanceId: string
  token: string
  clientToken: string
}): Promise<ZApiChat[]> {
  const response = await fetch(`${ZAPI_BASE_URL}/instances/${instanceId}/token/${token}/chats`, {
    headers: { 'Client-Token': clientToken },
  })
  if (!response.ok) throw new Error(`Falha ao listar conversas: ${await response.text()}`)
  const data = await response.json()
  const list = Array.isArray(data) ? data : (data.chats ?? [])
  return list.map((c: any) => ({
    phone: c.phone,
    name: c.name ?? null,
    unread: Number(c.unread ?? 0),
    lastMessageTime: c.lastMessageTime ?? null,
    isGroup: !!c.isGroup,
  }))
}

export async function verifyZApiConnection({
  instanceId,
  token,
  clientToken,
}: {
  instanceId: string
  token: string
  clientToken: string
}): Promise<{ ok: boolean; error?: string; connectedPhone?: string }> {
  try {
    const response = await fetch(`${ZAPI_BASE_URL}/instances/${instanceId}/token/${token}/status`, {
      headers: { 'Client-Token': clientToken },
    })
    if (!response.ok) {
      const text = await response.text()
      return { ok: false, error: text }
    }
    const data = await response.json()
    if (data.connected === false) {
      return { ok: false, error: 'Instância criada, mas o WhatsApp ainda não está conectado (escaneie o QR Code no painel do Z-API).' }
    }
    return { ok: true, connectedPhone: data.smartphoneConnected ?? undefined }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha ao conectar com o Z-API.' }
  }
}
