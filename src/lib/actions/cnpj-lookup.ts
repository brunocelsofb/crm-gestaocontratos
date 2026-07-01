'use server'

// Consulta dados públicos de CNPJ via BrasilAPI (brasilapi.com.br) —
// projeto open source, comunitário, sem necessidade de chave de API.
// NOTA: essa é uma API pública mantida pela comunidade, não um serviço
// oficial da Receita Federal. Os dados vêm de fontes públicas, mas não
// tenho garantia de disponibilidade/SLA — trate falhas como esperadas
// (o usuário pode sempre preencher manualmente).

export type CnpjLookupResult =
  | { success: true; razaoSocial: string; nomeFantasia: string | null }
  | { success: false; error: string }

export async function lookupCnpj(rawCnpj: string): Promise<CnpjLookupResult> {
  const cnpj = rawCnpj.replace(/\D/g, '')

  if (cnpj.length !== 14) {
    return { success: false, error: 'CNPJ precisa ter 14 dígitos.' }
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: 'application/json' },
    })

    if (res.status === 404) {
      return { success: false, error: 'CNPJ não encontrado na base pública.' }
    }
    if (!res.ok) {
      return { success: false, error: `Falha ao consultar (status ${res.status}). Preencha manualmente.` }
    }

    const data = await res.json()

    return {
      success: true,
      razaoSocial: data.razao_social ?? '',
      nomeFantasia: data.nome_fantasia || null,
    }
  } catch {
    return { success: false, error: 'Não foi possível consultar agora. Preencha manualmente.' }
  }
}
