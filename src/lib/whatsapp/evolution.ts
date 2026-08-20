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
}: EvoCredentials): Promise<{ base64?: string; pairingCode?: string; status?: string; error?: string }> {
  // 1. Tenta criar a instância (ignora 409 se já existir)
  try {
    const createRes = await fetch(`${serverUrl}/instance/create`, {
      method: 'POST',
      headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceName,
        token: apiKey,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    })
    const createData = await createRes.json().catch(() => ({}))
    console.log('[evo] instance/create status:', createRes.status, JSON.stringify(createData))
    // 409 = já existe — ok, segue para connect
    if (!createRes.ok && createRes.status !== 409) {
      return { error: `Erro ao criar instância: HTTP ${createRes.status} — ${JSON.stringify(createData)}` }
    }
  } catch (e: any) {
    return { error: `Falha de rede ao criar instância: ${e.message}` }
  }

  // 2. Conecta e busca QR Code
  try {
    const connectRes = await fetch(`${serverUrl}/instance/connect/${instanceName}`, {
      headers: { 'apikey': apiKey },
    })
    const connectData = await connectRes.json().catch(() => ({}))
    console.log('[evo] instance/connect status:', connectRes.status, JSON.stringify(connectData))

    if (!connectRes.ok) {
      return { error: `Erro ao conectar instância: HTTP ${connectRes.status} — ${JSON.stringify(connectData)}` }
    }

    // Tenta extrair base64 do QR em diferentes formatos da Evolution v1/v2
    const base64 =
      connectData.base64 ??
      connectData.qrcode?.base64 ??
      connectData.qrcode ??
      null

    if (base64) return { base64 }

    const state = connectData.instance?.state ?? connectData.state
    if (state === 'open') return { status: '✅ Instância já conectada!' }

    return { error: `QR Code não disponível. Resposta: ${JSON.stringify(connectData)}` }
  } catch (e: any) {
    return { error: `Falha de rede ao conectar: ${e.message}` }
  }
}

export async function getEvoInstanceStatus({
  serverUrl, apiKey, instanceName
}: EvoCredentials): Promise<{ state?: string }> {
  try {
    const res = await fetch(`${serverUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
      headers: { 'apikey': apiKey },
    })
    if (!res.ok) return {}
    const data = await res.json()
    const inst = Array.isArray(data) ? data[0] : data
    return { state: inst?.instance?.state ?? inst?.state }
  } catch { return {} }
}

export async function verifyEvoConnection(creds: EvoCredentials): Promise<{ ok: boolean; error?: string }> {
  try {
    const status = await getEvoInstanceStatus(creds)
    return { ok: !!status.state }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
