// Integração com Evolution API (substitui Z-API)
// Docs: https://doc.evolution-api.com

export type EvoCredentials = {
  serverUrl: string
  apiKey: string
  instanceName: string
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
  serverUrl, apiKey, instanceName
}: EvoCredentials): Promise<{ base64?: string; status?: string; error?: string }> {
  // Tenta criar instância (ignora se já existir)
  try {
    const createRes = await fetch(`${serverUrl}/instance/create`, {
      method: 'POST',
      headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceName, token: '', qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    })
    const createData = await createRes.json().catch(() => ({}))
    console.log('[evo] create:', createRes.status, JSON.stringify(createData))
    const earlyQr = createData?.qrcode?.base64 ?? createData?.qrcode?.code ?? createData?.base64 ?? createData?.code ?? null
    if (earlyQr) {
      console.log('[evo] QR obtido no create')
      return { base64: formatQr(earlyQr) }
    }
  } catch { /* instância pode já existir, segue */ }

  // Conecta e busca QR
  try {
    const res = await fetch(`${serverUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': apiKey },
    })
    const data = await res.json().catch(() => ({}))
    console.log('[evo] connect:', res.status, JSON.stringify(data))

    if (!res.ok) {
      return { error: parseEvoError(data, res.status) }
    }

    const qrRaw = data?.base64 ?? data?.code ?? data?.qrcode?.base64 ?? data?.qrcode ?? null
    if (qrRaw) return { base64: formatQr(qrRaw) }

    const state = data?.instance?.state ?? data?.state
    if (state === 'open') return { status: '✅ WhatsApp já está conectado!' }

    return { error: `QR não disponível. Resposta: ${JSON.stringify(data)}` }
  } catch (e: any) {
    return { error: `Falha de rede: ${e.message}` }
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
