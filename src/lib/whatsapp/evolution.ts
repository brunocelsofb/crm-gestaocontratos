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
}: EvoCredentials): Promise<{ base64?: string; pairingCode?: string; status?: string }> {
  const res = await fetch(`${serverUrl}/instance/connect/${instanceName}`, {
    headers: { 'apikey': apiKey },
  })
  if (!res.ok) return { status: 'error' }
  return res.json()
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
