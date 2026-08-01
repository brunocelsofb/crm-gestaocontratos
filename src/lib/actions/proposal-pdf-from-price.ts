// Adaptador: converte snapshot do Price + textos em formato do buildStandardProposalPage de julho
import { buildStandardProposalPage } from './proposal-pdf-builder'

function s(text: string | null | undefined): string {
  if (!text) return ''
  const map: Record<string, string> = {
    '\u00e1':'a','\u00e0':'a','\u00e3':'a','\u00e2':'a',
    '\u00c1':'A','\u00c0':'A','\u00c3':'A','\u00c2':'A',
    '\u00e9':'e','\u00e8':'e','\u00ea':'e',
    '\u00c9':'E','\u00ca':'E',
    '\u00ed':'i','\u00ee':'i','\u00cd':'I',
    '\u00f3':'o','\u00f5':'o','\u00f4':'o',
    '\u00d3':'O','\u00d4':'O','\u00d5':'O',
    '\u00fa':'u','\u00fb':'u','\u00da':'U',
    '\u00e7':'c','\u00c7':'C',
    '\u2019':"'",'`':"'"
  }
  return Array.from(text).map(c => map[c] ?? (c.charCodeAt(0) > 127 ? '' : c)).join('')
}

export async function buildPriceProposalPage(params: {
  snapshot: any
  proposalValue: number
  validityDays: number
  submittedByName: string | null
  technicalApprovedByName: string | null
  technicalApprovedAt: string | null
  technicalComment: string | null
  commercialApprovedByName: string | null
  commercialApprovedAt: string | null
  contract: { client_name: string; process_number: string | null; cnpj: string | null } | null
  company?: { name?: string; cnpj?: string; address?: string } | null
  contact?: { name?: string; email?: string } | null
  org?: { companyName?: string; cnpj?: string; address?: string; proposalCode?: string } | null
  textoObjetivos?: string | null
  textoAtividades?: string | null
  textoEstruturaApoio?: string | null
}): Promise<Uint8Array> {
  const { snapshot: snap, proposalValue, validityDays, params: _p, ...rest } = params as any
  const dur = snap.contractDuration ?? 12

  // Monta itens no formato do builder de julho
  const profs = (snap.professionals ?? []).filter((p: any) => p.role?.trim())
  const escopo = (snap.escopoSanitizado ?? snap.escopoServicos ?? []).join(' - ')

  // Texto da equipe para características
  const equipeTxt = profs.map((p: any) => {
    const carga = p.hoursPerMonth === 220 ? '44h sem.' : p.hoursPerMonth === 180 ? '12x36' : `${p.hoursPerMonth}h/mes`
    return `0${p.quantity} ${s(p.role)} - ${s(p.contractType)} ${carga}`
  }).join(', ')

  const characteristics = [
    escopo && `Escopo: ${s(escopo)}`,
    equipeTxt && `Equipe: ${equipeTxt}`,
    snap.dimensionamento?.totalEquipamentos > 0 && `${snap.dimensionamento.totalEquipamentos} equipamentos gerenciados`,
  ].filter(Boolean).join(' | ')

  const items = [{
    quantity: 1,
    category: s(snap.tipoEngenharia === 'Hospitalar' ? 'Engenharia Hospitalar' : 'Engenharia Clinica'),
    item: s(snap.tituloItemServico ?? 'Servico Continuo de Engenharia'),
    characteristics: characteristics.slice(0, 400),
    type: 'MRR',
    delivery_forecast: null,
    unit_value: proposalValue,
    discount: 0,
    subtotal: proposalValue,
  }]

  // ContentBlocks com os textos personalizados
  const contentBlocks: any[] = []

  if (params.textoObjetivos?.trim()) {
    contentBlocks.push({
      block_type: 'text',
      image_storage_path: null,
      table_data: { rows: [['OBJETIVOS'], [s(params.textoObjetivos)]] },
    })
  }

  if (params.textoAtividades?.trim()) {
    contentBlocks.push({
      block_type: 'text',
      image_storage_path: null,
      table_data: { rows: [['ATIVIDADES A SEREM DESENVOLVIDAS'], [s(params.textoAtividades)]] },
    })
  }

  if (params.textoEstruturaApoio?.trim()) {
    contentBlocks.push({
      block_type: 'text',
      image_storage_path: null,
      table_data: { rows: [['ESTRUTURA DE APOIO'], [s(params.textoEstruturaApoio)]] },
    })
  }

  // Aprovações como bloco de texto
  const aprovLines = [
    params.submittedByName && `Enviada p/ aprovacao tecnica por ${s(params.submittedByName)}`,
    params.technicalApprovedByName && `Aprovada tecnicamente por ${s(params.technicalApprovedByName)}${params.technicalApprovedAt ? ` em ${new Date(params.technicalApprovedAt).toLocaleDateString('pt-BR')}` : ''}`,
    params.technicalComment && `Parecer: ${s(params.technicalComment)}`,
    params.commercialApprovedByName && `Aprovada comercialmente por ${s(params.commercialApprovedByName)}${params.commercialApprovedAt ? ` em ${new Date(params.commercialApprovedAt).toLocaleDateString('pt-BR')}` : ''}`,
  ].filter(Boolean)

  if (aprovLines.length > 0) {
    contentBlocks.push({
      block_type: 'text',
      image_storage_path: null,
      table_data: { rows: [['APROVACOES INTERNAS'], ...aprovLines.map(l => [l as string])] },
    })
  }

  const validUntil = new Date(Date.now() + validityDays * 86400000).toISOString().split('T')[0]
  const propCode = s(params.org?.proposalCode ?? params.contract?.process_number ?? 'PROP')

  return buildStandardProposalPage({
    proposal: {
      control_code: propCode,
      currency: 'BRL',
      client_po_number: null,
      valid_until: validUntil,
      created_at: new Date().toISOString(),
      version: 1,
      discount_type: null,
      discount_value: 0,
      payment_terms: `${dur} parcelas mensais`,
      installments: dur,
      is_recurring: true,
    },
    items,
    company: params.company ? {
      name: s(params.company.name ?? ''),
      trade_name: null,
      cnpj: s(params.company.cnpj ?? params.contract?.cnpj ?? null),
      legal_name: s(params.company.name ?? params.contract?.client_name ?? null),
      nf_email: null,
      address: s(params.company.address ?? null),
    } : null,
    contact: params.contact ? {
      name: s(params.contact.name ?? ''),
      cpf: null,
      email: s(params.contact.email ?? null),
      phone: null,
      address: null,
    } : null,
    org: {
      companyName: s(params.org?.companyName ?? 'ORBIS GESTAO DE TECNOLOGIA EM SAUDE LTDA'),
      logoBytes: null,
      logoIsPng: false,
      createdByName: null,
      createdByEmail: null,
      headerText: null,
      footerText: null,
      brandColor: '#1B556B',
    },
    contentBlocks,
  })
}
