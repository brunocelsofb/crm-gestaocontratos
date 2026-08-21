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
  const h = { 'apikey': apiKey, 'Content-Type': 'application/json' }

  // Passo 1: cria instância (ignora se já existe)
  try {
    const r = await fetch(`${serverUrl}/instance/create`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ instanceName, token: '', qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    })
    const d = await r.json().catch(() => ({}))
    console.log('[evo] create:', r.status, JSON.stringify(d))
    const earlyQr = d?.qrcode?.base64 ?? d?.qrcode?.code ?? d?.base64 ?? d?.code ?? null
    if (earlyQr) return { base64: formatQr(earlyQr) }
  } catch { /* ignora */ }

  // Passo 2: GET connect
  const tryConnect = async () => {
    const r = await fetch(`${serverUrl}/instance/connect/${instanceName}`, {
      headers: { 'apikey': apiKey },
    })
    const d = await r.json().catch(() => ({}))
    console.log('[evo] connect:', r.status, JSON.stringify(d))
    return d
  }

  let d1 = await tryConnect()

  // count:0 → deleta, recria e conecta
  const noQr = (d: any) => !d || d.count === 0 || (!d.base64 && !d.code && !d?.qrcode?.base64 && !d?.qrcode?.code)
  if (noQr(d1)) {
    console.log('[evo] count:0 — delete + recreate')
    try {
      const dr = await fetch(`${serverUrl}/instance/delete/${instanceName}`, {
        method: 'DELETE', headers: { 'apikey': apiKey },
      })
      console.log('[evo] delete:', dr.status)
    } catch { /* ignora */ }
    await new Promise(r => setTimeout(r, 800))
    try {
      const cr = await fetch(`${serverUrl}/instance/create`, {
        method: 'POST', headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, token: '', qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
      })
      const cd = await cr.json().catch(() => ({}))
      console.log('[evo] recreate:', cr.status, JSON.stringify(cd))
      const freshQr = cd?.qrcode?.base64 ?? cd?.qrcode?.code ?? cd?.base64 ?? cd?.code ?? null
      if (freshQr) return { base64: formatQr(freshQr) }
    } catch { /* ignora */ }
    await new Promise(r => setTimeout(r, 1500))
    d1 = await tryConnect()
  }

  const qrRaw = d1?.base64 ?? d1?.code ?? d1?.qrcode?.base64 ?? d1?.qrcode?.code ?? null
  if (qrRaw) return { base64: formatQr(qrRaw) }

  const state = d1?.instance?.state ?? d1?.state
  if (state === 'open') return { status: '✅ WhatsApp já está conectado!' }

  return { error: `QR não disponível. Última resposta: ${JSON.stringify(d1)}` }
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
