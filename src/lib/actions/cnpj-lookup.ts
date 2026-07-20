'use server'

export type CnpjData = {
  razaoSocial: string
  nomeFantasia: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  municipio: string | null
  uf: string | null
  cep: string | null
  telefone: string | null
  email: string | null
  capitalSocial: number | null
  porte: string | null
  cnaeDescricao: string | null
}

export type CnpjLookupResult =
  | ({ success: true } & CnpjData)
  | { success: false; error: string }

export async function lookupCnpj(rawCnpj: string): Promise<CnpjLookupResult> {
  const cnpj = rawCnpj.replace(/\D/g, '')
  if (cnpj.length !== 14) return { success: false, error: 'CNPJ precisa ter 14 dígitos.' }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'OrbisGestao/1.0' },
      next: { revalidate: 86400 }, // cache 24h
    })
    if (res.status === 404) return { success: false, error: 'CNPJ não encontrado.' }
    if (!res.ok) return { success: false, error: `Erro ao consultar (${res.status}). Preencha manualmente.` }

    const d = await res.json()

    // Tamanho da empresa
    const porteMap: Record<string, string> = {
      'MICRO EMPRESA': 'ME',
      'EMPRESA DE PEQUENO PORTE': 'EPP',
      'DEMAIS': 'MEDIO',
    }

    return {
      success: true,
      razaoSocial: d.razao_social ?? '',
      nomeFantasia: d.nome_fantasia || null,
      logradouro: d.logradouro || null,
      numero: d.numero || null,
      bairro: d.bairro || null,
      municipio: d.municipio || null,
      uf: d.uf || null,
      cep: d.cep || null,
      telefone: d.ddd_telefone_1 ? d.ddd_telefone_1.replace(/\D/g, '') : null,
      email: d.email || null,
      capitalSocial: d.capital_social ? Number(d.capital_social) : null,
      porte: porteMap[d.porte] ?? d.porte ?? null,
      cnaeDescricao: d.cnae_fiscal_descricao || null,
    }
  } catch {
    return { success: false, error: 'Não foi possível consultar agora. Preencha manualmente.' }
  }
}
