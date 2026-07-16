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
