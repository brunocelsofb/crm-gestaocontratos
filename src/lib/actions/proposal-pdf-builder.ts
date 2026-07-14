// Constrói a página de dados da proposta (a "Proposta padrão") usando
// pdf-lib — texto e tabela desenhados diretamente, não é um template
// visual bonito ainda, é a estrutura de dados correta. Dá pra evoluir o
// layout depois sem mexer na lógica de mesclagem.
//
// NOTA DE INCERTEZA: nunca gerei e abri um PDF de verdade produzido por
// esse código — a API do pdf-lib usada aqui é a que eu conheço, mas
// confirme o resultado visual (texto cortado, sobreposição, etc.) e me
// avise o que precisar de ajuste.

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
}: {
  proposal: ProposalRow
  items: ItemRow[]
  company: CompanyRow
  contact: ContactRow
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

  function drawText(text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; x?: number } = {}) {
    const size = opts.size ?? 10
    newPageIfNeeded(size + 6)
    page.drawText(text || '—', {
      x: opts.x ?? margin,
      y,
      size,
      font: opts.bold ? fontBold : font,
      color: opts.color ? rgb(...opts.color) : rgb(0.1, 0.1, 0.1),
    })
    y -= size + 6
  }

  function drawSectionTitle(title: string) {
    y -= 6
    newPageIfNeeded(20)
    page.drawRectangle({ x: margin, y: y - 2, width: pageWidth - margin * 2, height: 16, color: rgb(0.11, 0.33, 0.42) })
    page.drawText(title, { x: margin + 6, y: y + 2, size: 10, font: fontBold, color: rgb(1, 1, 1) })
    y -= 22
  }

  drawText('PROPOSTA COMERCIAL', { size: 18, bold: true })
  drawText(`${proposal.control_code} · versão ${proposal.version}`, { size: 10, color: [0.4, 0.4, 0.4] })
  y -= 8

  drawSectionTitle('Dados da Proposta')
  drawText(`Moeda: ${proposal.currency}`)
  drawText(`Data de criação: ${fmtDate(proposal.created_at)}`)
  drawText(`Data de validade: ${fmtDate(proposal.valid_until)}`)
  drawText(`Nº OC do cliente: ${proposal.client_po_number ?? '—'}`)

  drawSectionTitle('Dados da Empresa')
  drawText(`Nome: ${company?.name ?? '—'}${company?.trade_name ? ` (${company.trade_name})` : ''}`)
  drawText(`Razão Social: ${company?.legal_name ?? company?.name ?? '—'}`)
  drawText(`CNPJ: ${company?.cnpj ?? '—'}`)
  drawText(`E-mail NF: ${company?.nf_email ?? '—'}`)
  drawText(`Endereço: ${company?.address ?? '—'}`)

  drawSectionTitle('Dados do Contato')
  drawText(`Nome: ${contact?.name ?? '—'}`)
  drawText(`CPF: ${contact?.cpf ?? '—'}`)
  drawText(`E-mail: ${contact?.email ?? '—'}`)
  drawText(`Telefone: ${contact?.phone ?? '—'}`)
  drawText(`Endereço: ${contact?.address ?? '—'}`)

  drawSectionTitle('Produtos / Serviços')

  const colX = { qty: margin, cat: margin + 35, item: margin + 100, type: margin + 240, unit: margin + 300, disc: margin + 370, sub: margin + 440 }
  newPageIfNeeded(20)
  page.drawText('Qtd', { x: colX.qty, y, size: 8, font: fontBold })
  page.drawText('Categoria', { x: colX.cat, y, size: 8, font: fontBold })
  page.drawText('Item', { x: colX.item, y, size: 8, font: fontBold })
  page.drawText('Tipo', { x: colX.type, y, size: 8, font: fontBold })
  page.drawText('Vlr. Unit.', { x: colX.unit, y, size: 8, font: fontBold })
  page.drawText('Desc.', { x: colX.disc, y, size: 8, font: fontBold })
  page.drawText('Subtotal', { x: colX.sub, y, size: 8, font: fontBold })
  y -= 14

  let total = 0
  for (const it of items) {
    newPageIfNeeded(28)
    page.drawText(String(it.quantity), { x: colX.qty, y, size: 8, font })
    page.drawText((it.category ?? '—').slice(0, 12), { x: colX.cat, y, size: 8, font })
    page.drawText(it.item.slice(0, 28), { x: colX.item, y, size: 8, font })
    page.drawText((it.type ?? '—').slice(0, 10), { x: colX.type, y, size: 8, font })
    page.drawText(fmtCurrency(it.unit_value, proposal.currency), { x: colX.unit, y, size: 8, font })
    page.drawText(fmtCurrency(it.discount, proposal.currency), { x: colX.disc, y, size: 8, font })
    page.drawText(fmtCurrency(it.subtotal, proposal.currency), { x: colX.sub, y, size: 8, font })
    y -= 12
    if (it.characteristics) {
      page.drawText(`  ${it.characteristics.slice(0, 90)}`, { x: colX.item, y, size: 7, font, color: rgb(0.4, 0.4, 0.4) })
      y -= 10
    }
    if (it.delivery_forecast) {
      page.drawText(`  Previsão de entrega: ${it.delivery_forecast}`, { x: colX.item, y, size: 7, font, color: rgb(0.4, 0.4, 0.4) })
      y -= 10
    }
    y -= 4
    total += it.subtotal
  }

  y -= 8
  newPageIfNeeded(20)
  page.drawText(`TOTAL: ${fmtCurrency(total, proposal.currency)}`, { x: colX.sub - 60, y, size: 12, font: fontBold })

  return doc.save()
}
