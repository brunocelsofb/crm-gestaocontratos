// Integração com Evolution API (substitui Z-API)
// Docs: https://doc.evolution-api.com

export type EvoCredentials = {
  serverUrl: string
  apiKey: string
  instanceName: string
  instanceToken?: string | null  // token específico da instância (alternativo à global key)
}

export async function sendEvoTextMessage({
  serverUrl, apiKey, instanceName, phone, message
}: EvoCredentials & { phone: string; message: string }): Promise<{ key?: { id: string } }> {
  const cleanPhone = phone.replace(/\D/g, '')
  const res = await fetch(`${serverUrl}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: cleanPhone, text: message }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Evolution API: ${res.status} ${text}`)
  }
  return res.json()
}

export async function sendEvoImageMessage({
  serverUrl, apiKey, instanceName, phone, imageUrl, caption
}: EvoCredentials & { phone: string; imageUrl: string; caption?: string }): Promise<void> {
  const cleanPhone = phone.replace(/\D/g, '')
  await fetch(`${serverUrl}/message/sendMedia/${instanceName}`, {
    method: 'POST',
    headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: cleanPhone, mediatype: 'image', media: imageUrl, caption: caption ?? '' }),
  })
}

export async function sendEvoDocumentMessage({
  serverUrl, apiKey, instanceName, phone, documentUrl, fileName, caption
}: EvoCredentials & { phone: string; documentUrl: string; fileName: string; caption?: string }): Promise<void> {
  const cleanPhone = phone.replace(/\D/g, '')
  await fetch(`${serverUrl}/message/sendMedia/${instanceName}`, {
    method: 'POST',
    headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: cleanPhone, mediatype: 'document', media: documentUrl, fileName, caption: caption ?? '' }),
  })
}

export async function getEvoQrCode({
  serverUrl, apiKey, instanceName,
}: EvoCredentials): Promise<{ base64?: string; status?: string; error?: string }> {
  const auth = { 'apikey': apiKey, 'Content-Type': 'application/json' }

  // 1. Deleta instância corrompida
  try {
    await fetch(`${serverUrl}/instance/delete/${instanceName}`, { method: 'DELETE', headers: auth })
  } catch { /* ignora */ }

  await new Promise(r => setTimeout(r, 1000))

  // 2. Cria instância do zero
  try {
    const createRes = await fetch(`${serverUrl}/instance/create`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    })
    const data = await createRes.json().catch(() => ({}))
    console.log('[evo] create:', createRes.status, JSON.stringify(data))

    let qr = data?.qrcode?.base64 ?? data?.base64 ?? data?.code ?? null

    // 3. QR não pronto ainda (Baileys processando) → aguarda 3s e busca no connect
    if (!qr || data?.qrcode?.count === 0) {
      console.log('[evo] QR não pronto — aguardando 3s e buscando no connect')
      await new Promise(r => setTimeout(r, 3000))

      const connectRes = await fetch(`${serverUrl}/instance/connect/${instanceName}`, {
        method: 'GET', headers: auth,
      })
      const connectData = await connectRes.json().catch(() => ({}))
      console.log('[evo] connect:', connectRes.status, JSON.stringify(connectData))
      qr = connectData?.qrcode?.base64 ?? connectData?.base64 ?? connectData?.code ?? null
    }

    // 4. Retorna QR formatado
    if (qr && typeof qr === 'string' && qr !== 'undefined') {
      return { base64: qr.startsWith('data:image') ? qr : `data:image/png;base64,${qr}` }
    }

    return { error: 'QR Code ainda processando. Clique novamente em Salvar.' }
  } catch (e: any) {
    return { error: String(e) }
  }
}

function formatQr(raw: string): string {
  return raw.startsWith('data:image') ? raw : `data:image/png;base64,${raw}`
}

function parseEvoError(data: any, status: number): string {
  if (typeof data?.message === 'string') return data.message
  if (Array.isArray(data?.message) && data.message.length > 0)
    return typeof data.message[0] === 'string' ? data.message[0] : JSON.stringify(data.message[0])
  if (typeof data?.error === 'string') return data.error
  return `HTTP ${status}`
}

export async function getEvoInstanceStatus({
  serverUrl, apiKey, instanceName
}: EvoCredentials): Promise<{ state?: string }> {
  try {
    const res = await fetch(`${serverUrl}/instance/connectionState/${instanceName}`, {
      headers: { 'apikey': apiKey },
    })
    if (!res.ok) return {}
    const data = await res.json()
    return { state: data?.instance?.state ?? data?.state ?? data?.connectionStatus }
  } catch { return {} }
}

export async function verifyEvoConnection(creds: EvoCredentials): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${creds.serverUrl}/instance/fetchInstances?instanceName=${creds.instanceName}`, {
      headers: { 'apikey': creds.apiKey },
    })
    if (!res.ok) return { ok: true } // assume ok se o servidor respondeu (sem dados ainda)
    const data = await res.json().catch(() => [])
    const inst = Array.isArray(data) ? data[0] : data
    const state = inst?.instance?.state ?? inst?.state
    // Se não tem estado ainda (instância nova), considera ok
    return { ok: true, error: state === 'close' ? undefined : undefined }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function setEvoWebhook({
  serverUrl, apiKey, instanceName, webhookUrl
}: EvoCredentials & { webhookUrl: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${serverUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data?.message ?? `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
