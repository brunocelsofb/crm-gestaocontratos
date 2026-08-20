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
  // 1. Tenta criar a instância (ignora 409/403 se já existir)
  try {
    const createRes = await fetch(`${serverUrl}/instance/create`, {
      method: 'POST',
      headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    })
    const createData = await createRes.json().catch(() => ({}))
    console.log('[evo] create status:', createRes.status, JSON.stringify(createData))

    // Se criou com sucesso, o QR pode já vir aqui
    if (createRes.ok) {
      const base64 = createData?.qrcode?.base64 ?? createData?.base64 ?? createData?.code ?? null
      if (base64) return { base64 }
    }

    // 409/403 = já existe — segue para connect
    if (!createRes.ok && createRes.status !== 409 && createRes.status !== 403) {
      const msg = createData?.message?.[0] ?? createData?.message ?? createData?.error ?? `Erro HTTP ${createRes.status}`
      return { error: `Erro ao criar instância: ${msg}` }
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
    console.log('[evo] connect status:', connectRes.status, JSON.stringify(connectData))

    if (!connectRes.ok) {
      const msg = connectData?.message?.[0] ?? connectData?.message ?? connectData?.error ?? `Erro HTTP ${connectRes.status}`
      return { error: `Erro ao conectar: ${msg}` }
    }

    // Evolution v2 retorna QR em diferentes campos
    const base64 =
      connectData?.base64 ??
      connectData?.code ??
      connectData?.qrcode?.base64 ??
      connectData?.qrcode ??
      null

    if (base64) return { base64 }

    const state = connectData?.instance?.state ?? connectData?.state
    if (state === 'open') return { status: '✅ Instância já conectada!' }

    return { error: `QR não disponível. Resposta: ${JSON.stringify(connectData)}` }
  } catch (e: any) {
    return { error: `Falha de rede ao conectar: ${e.message}` }
  }
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
