// Constrói a página de dados da proposta (a "Proposta padrão") usando
// pdf-lib. Layout em duas colunas pra ficar mais perto do modelo de
// referência (logo + dados da contratada em cima, "Dados da pessoa" e
// "Dados da empresa" do CLIENTE lado a lado, embaixo).
//
// NOTA DE INCERTEZA: nunca gerei e abri um PDF de verdade produzido por
// esse código — a API do pdf-lib usada aqui é a que eu conheço, mas
// confirme o resultado visual e me avise o que precisar de ajuste.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

type ProposalRow = {
  control_code: string
  currency: string
  client_po_number: string | null
  valid_until: string | null
  created_at: string
  version: number
}

type ItemRow = {
  quantity: number
  category: string | null
  item: string
  characteristics: string | null
  type: string | null
  delivery_forecast: string | null
  unit_value: number
  discount: number
  subtotal: number
}

type CompanyRow = {
  name: string
  trade_name: string | null
  cnpj: string | null
  legal_name: string | null
  nf_email: string | null
  address: string | null
} | null

type ContactRow = {
  name: string
  cpf: string | null
  email: string | null
  phone: string | null
  address: string | null
} | null

type OrgInfo = {
  companyName: string | null
  logoBytes: Uint8Array | null
  logoIsPng: boolean
  createdByName: string | null
  createdByEmail: string | null
}

function fmtCurrency(v: number, currency: string) {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v)
  } catch {
    return `${currency} ${v.toFixed(2)}`
  }
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export async function buildStandardProposalPage({
  proposal,
  items,
  company,
  contact,
  org,
}: {
  proposal: ProposalRow
  items: ItemRow[]
  company: CompanyRow
  contact: ContactRow
  org: OrgInfo
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595
  const pageHeight = 842
  const margin = 40
  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function newPageIfNeeded(spaceNeeded: number) {
    if (y - spaceNeeded < margin) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  function text(str: string, x: number, yPos: number, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) {
    page.drawText(str || '—', {
      x,
      y: yPos,
      size: opts.size ?? 9,
      font: opts.bold ? fontBold : font,
      color: opts.color ? rgb(...opts.color) : rgb(0.15, 0.15, 0.15),
    })
  }

  // ---- Linha 1: data / validade — sigla da proposta ----
  text(`${fmtDate(proposal.created_at)} - Validade: ${fmtDate(proposal.valid_until)}`, margin, y, { size: 9, color: [0.4, 0.4, 0.4] })
  text(`Proposta ${proposal.control_code}`, pageWidth - margin - 140, y, { size: 11, bold: true })
  y -= 24

  // ---- Cabeçalho: logo + empresa contratada | contato interno ----
  let logoDrawn = false
  if (org.logoBytes) {
    try {
      const image = org.logoIsPng ? await doc.embedPng(org.logoBytes) : await doc.embedJpg(org.logoBytes)
      const logoHeight = 40
      const logoWidth = (image.width / image.height) * logoHeight
      page.drawImage(image, { x: margin, y: y - logoHeight + 6, width: logoWidth, height: logoHeight })
      logoDrawn = true
    } catch {
      // Se o logo não carregar (formato inesperado), segue sem ele —
      // não quebra a geração do PDF por causa disso.
    }
  }

  const headerTextX = logoDrawn ? margin + 90 : margin
  text(org.companyName ?? 'Empresa', headerTextX, y, { size: 13, bold: true })
  y -= 26

  text('Contato', pageWidth - margin - 140, y + 26, { size: 11, bold: true })
  if (org.createdByName) {
    text(org.createdByName, pageWidth - margin - 140, y + 10, { size: 9 })
    text(org.createdByEmail ?? '', pageWidth - margin - 140, y - 2, { size: 8, color: [0.4, 0.4, 0.4] })
  }

  y -= 4
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
  y -= 24

  // ---- Duas caixas lado a lado: Dados da pessoa | Dados da empresa (cliente) ----
  const boxWidth = (pageWidth - margin * 2 - 16) / 2
  const boxHeight = 110
  const boxTop = y

  page.drawRectangle({ x: margin, y: boxTop - boxHeight, width: boxWidth, height: boxHeight, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 1 })
  page.drawRectangle({ x: margin + boxWidth + 16, y: boxTop - boxHeight, width: boxWidth, height: boxHeight, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 1 })

  let ly = boxTop - 16
  text('Dados da pessoa', margin + 8, ly, { size: 9, bold: true, color: [0.4, 0.4, 0.4] })
  ly -= 16
  text(contact?.name ?? '—', margin + 8, ly, { size: 9, bold: true })
  ly -= 14
  text(`CPF: ${contact?.cpf ?? '—'}`, margin + 8, ly, { size: 8 })
  ly -= 12
  text(`E-mail: ${contact?.email ?? '—'}`, margin + 8, ly, { size: 8 })
  ly -= 12
  text(`Telefone: ${contact?.phone ?? '—'}`, margin + 8, ly, { size: 8 })
  ly -= 12
  text(`Endereço: ${(contact?.address ?? '—').slice(0, 45)}`, margin + 8, ly, { size: 8 })

  let ry = boxTop - 16
  const rx = margin + boxWidth + 16 + 8
  text('Dados da empresa', rx, ry, { size: 9, bold: true, color: [0.4, 0.4, 0.4] })
  ry -= 16
  text(`Razão social: ${(company?.legal_name ?? company?.name ?? '—').slice(0, 42)}`, rx, ry, { size: 8, bold: true })
  ry -= 14
  text(`Nome fantasia: ${company?.trade_name ?? '—'}`, rx, ry, { size: 8 })
  ry -= 12
  text(`CNPJ: ${company?.cnpj ?? '—'}`, rx, ry, { size: 8 })
  ry -= 12
  text(`E-mail NF: ${company?.nf_email ?? '—'}`, rx, ry, { size: 8 })
  ry -= 12
  text(`Endereço: ${(company?.address ?? '—').slice(0, 45)}`, rx, ry, { size: 8 })

  y = boxTop - boxHeight - 24

  // ---- Dados da proposta ----
  newPageIfNeeded(60)
  text('Dados da Proposta', margin, y, { size: 10, bold: true })
  y -= 16
  text(`Moeda: ${proposal.currency}   ·   Nº OC do cliente: ${proposal.client_po_number ?? '—'}`, margin, y, { size: 8 })
  y -= 24

  // ---- Tabela de itens ----
  newPageIfNeeded(40)
  text('Produtos / Serviços', margin, y, { size: 10, bold: true })
  y -= 18

  const colX = { qty: margin, cat: margin + 35, item: margin + 100, type: margin + 240, unit: margin + 300, disc: margin + 370, sub: margin + 440 }
  newPageIfNeeded(16)
  text('Qtd', colX.qty, y, { size: 8, bold: true })
  text('Categoria', colX.cat, y, { size: 8, bold: true })
  text('Item', colX.item, y, { size: 8, bold: true })
  text('Tipo', colX.type, y, { size: 8, bold: true })
  text('Vlr. Unit.', colX.unit, y, { size: 8, bold: true })
  text('Desc.', colX.disc, y, { size: 8, bold: true })
  text('Subtotal', colX.sub, y, { size: 8, bold: true })
  y -= 14

  let total = 0
  for (const it of items) {
    newPageIfNeeded(28)
    text(String(it.quantity), colX.qty, y, { size: 8 })
    text((it.category ?? '—').slice(0, 12), colX.cat, y, { size: 8 })
    text(it.item.slice(0, 28), colX.item, y, { size: 8 })
    text((it.type ?? '—').slice(0, 10), colX.type, y, { size: 8 })
    text(fmtCurrency(it.unit_value, proposal.currency), colX.unit, y, { size: 8 })
    text(fmtCurrency(it.discount, proposal.currency), colX.disc, y, { size: 8 })
    text(fmtCurrency(it.subtotal, proposal.currency), colX.sub, y, { size: 8 })
    y -= 12
    if (it.characteristics) {
      text(`  ${it.characteristics.slice(0, 90)}`, colX.item, y, { size: 7, color: [0.45, 0.45, 0.45] })
      y -= 10
    }
    if (it.delivery_forecast) {
      text(`  Previsão de entrega: ${it.delivery_forecast}`, colX.item, y, { size: 7, color: [0.45, 0.45, 0.45] })
      y -= 10
    }
    y -= 4
    total += it.subtotal
  }

  y -= 8
  newPageIfNeeded(20)
  text(`TOTAL: ${fmtCurrency(total, proposal.currency)}`, colX.sub - 60, y, { size: 12, bold: true })

  return doc.save()
}
