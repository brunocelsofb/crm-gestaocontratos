// Integração com a API do ZapSign.
//
// NOTA DE INCERTEZA: os endpoints e campos abaixo seguem a documentação
// pública da ZapSign (docs.zapsign.com.br). Não testei ao vivo ainda —
// valida assim que usar pela primeira vez.

const ZAPSIGN_BASE_URL = 'https://api.zapsign.com.br/api/v1'

export type ZapSignSigner = {
  name: string
  email: string
  phone_country?: string
  phone_number?: string
  send_automatic_email?: boolean
  send_automatic_whatsapp?: boolean
  auth_mode?: 'assinaturaTela' | 'assinaturaDigital' | 'tokenEmail'
  qualify?: string
}

export type ZapSignCreateFromTemplateParams = {
  apiToken: string
  templateToken: string
  documentName: string
  data: Record<string, string>
  signers: ZapSignSigner[]
  lang?: 'pt-br' | 'en' | 'es'
}

export type ZapSignDocumentResponse = {
  token: string
  status: string
  name: string
  original_file: string
  signed_file: string | null
  signers: Array<{
    token: string
    name: string
    email: string
    status: string
    sign_url: string
  }>
}

export async function createZapSignDocumentFromTemplate({
  apiToken,
  templateToken,
  documentName,
  data,
  signers,
  lang = 'pt-br',
}: ZapSignCreateFromTemplateParams): Promise<ZapSignDocumentResponse> {
  const dynamicFields = Object.entries(data).map(([key, value]) => ({
    de: `{{${key}}}`,
    para: value,
  }))

  const response = await fetch(`${ZAPSIGN_BASE_URL}/models/${templateToken}/create-doc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      sandbox: false,
      name: documentName,
      lang,
      data: dynamicFields,
      signers: signers.map((s) => ({
        name: s.name,
        email: s.email,
        phone_country: s.phone_country ?? '55',
        phone_number: s.phone_number ?? '',
        send_automatic_email: s.send_automatic_email ?? true,
        send_automatic_whatsapp: s.send_automatic_whatsapp ?? false,
        auth_mode: s.auth_mode ?? 'assinaturaTela',
        qualify: s.qualify ?? '',
      })),
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`ZapSign: falha ao criar documento (${response.status}): ${text}`)
  }

  return response.json()
}

export async function getZapSignDocument(apiToken: string, docToken: string): Promise<ZapSignDocumentResponse> {
  const response = await fetch(`${ZAPSIGN_BASE_URL}/docs/${docToken}/`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })
  if (!response.ok) throw new Error(`ZapSign: falha ao buscar documento: ${await response.text()}`)
  return response.json()
}
