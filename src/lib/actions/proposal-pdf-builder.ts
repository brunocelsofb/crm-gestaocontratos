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
  headerText: string | null
  footerText: string | null
  brandColor: string
}

type ContentBlock = {
  block_type: string
  image_storage_path: string | null
  table_data: { rows: string[][] } | null
  imageBytes?: Uint8Array | null
  imageIsPng?: boolean
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

// Converte "#1B556B" pro formato 0–1 que o pdf-lib espera.
function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return [Number.isNaN(r) ? 0.11 : r, Number.isNaN(g) ? 0.33 : g, Number.isNaN(b) ? 0.42 : b]
}

export async function buildStandardProposalPage({
  proposal,
  items,
  company,
  contact,
  org,
  contentBlocks,
}: {
  proposal: ProposalRow & {
    discount_type: 'percentage' | 'fixed' | null
    discount_value: number
    payment_terms: string | null
    installments: number
    is_recurring: boolean
  }
  items: ItemRow[]
  company: CompanyRow
  contact: ContactRow
  org: OrgInfo
  contentBlocks: ContentBlock[]
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

  const brandRgb = hexToRgb01(org.brandColor)

  // ---- Faixa colorida do cabeçalho (cor da marca, não só texto) ----
  const headerBarHeight = org.headerText ? 26 : 0
  if (org.headerText) {
    page.drawRectangle({ x: 0, y: pageHeight - headerBarHeight, width: pageWidth, height: headerBarHeight, color: rgb(...brandRgb) })
    page.drawText(org.headerText, { x: margin, y: pageHeight - headerBarHeight + 8, size: 9, font: fontBold, color: rgb(1, 1, 1) })
    y = pageHeight - headerBarHeight - margin + 10
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
      const logoHeight = 72
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
  y -= 6

  // Linha decorativa abaixo do título
  page.drawLine({ start: { x: margin, y: y }, end: { x: pageWidth - margin, y: y }, thickness: 0.5, color: rgb(...brandRgb) })
  y -= 14

  const tableW = pageWidth - margin * 2
  // Colunas: Qtd | Categoria | Item (maior) | Tipo | Vlr.Unit. | Desc. | Subtotal
  const col = {
    qty:  { x: margin,            w: 26 },
    cat:  { x: margin + 28,       w: 70 },
    item: { x: margin + 100,      w: 165 },
    type: { x: margin + 267,      w: 38 },
    unit: { x: margin + 307,      w: 72 },
    disc: { x: margin + 381,      w: 52 },
    sub:  { x: margin + 435,      w: tableW - 435 },
  }

  // Header com fundo cinza
  newPageIfNeeded(16)
  page.drawRectangle({ x: margin, y: y - 14, width: tableW, height: 16, color: rgb(0.95, 0.96, 0.97) })
  const headers = [
    { label: 'Qtd',      x: col.qty.x },
    { label: 'Categoria',x: col.cat.x },
    { label: 'Item',     x: col.item.x },
    { label: 'Tipo',     x: col.type.x },
    { label: 'Vlr. Unit.',x: col.unit.x },
    { label: 'Desc.',    x: col.disc.x },
    { label: 'Subtotal', x: col.sub.x },
  ]
  headers.forEach(h => text(h.label, h.x + 3, y - 10, { size: 7.5, bold: true, color: [0.25, 0.28, 0.38] }))
  y -= 16

  // Linha separadora do header
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.3, color: rgb(0.85, 0.87, 0.90) })
  y -= 2

  let total = 0
  for (const [idx, it] of items.entries()) {
    // Calcula altura necessária para o item
    const charLines = it.characteristics
      ? Math.ceil(it.characteristics.length / 80)
      : 0
    const rowH = 16 + (charLines > 0 ? charLines * 10 + 4 : 0) + (it.delivery_forecast ? 10 : 0)
    newPageIfNeeded(rowH + 8)

    // Fundo alternado
    if (idx % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - rowH + 4, width: tableW, height: rowH - 4, color: rgb(0.985, 0.988, 0.992) })
    }

    // Dados da linha
    text(String(it.quantity), col.qty.x + 3, y, { size: 8.5 })
    // Categoria com wrap suave
    const catStr = (it.category ?? '—').slice(0, 16)
    text(catStr, col.cat.x + 3, y, { size: 8, color: [0.35, 0.38, 0.48] })
    // Item — permite até 2 linhas
    const itemStr = it.item
    const itemLine1 = itemStr.slice(0, 40)
    const itemLine2 = itemStr.length > 40 ? itemStr.slice(40, 76) : null
    text(itemLine1, col.item.x + 3, y, { size: 8.5, bold: true })
    if (itemLine2) {
      text(itemLine2, col.item.x + 3, y - 10, { size: 8.5, bold: true })
      y -= 10
    }
    text((it.type ?? '—'), col.type.x + 3, y, { size: 8 })
    text(fmtCurrency(it.unit_value, proposal.currency), col.unit.x + 3, y, { size: 8.5 })
    text(fmtCurrency(it.discount, proposal.currency), col.disc.x + 3, y, { size: 8, color: [0.5, 0.5, 0.5] })
    text(fmtCurrency(it.subtotal, proposal.currency), col.sub.x + 3, y, { size: 8.5, bold: true })
    y -= 14

    // Características em até 3 linhas
    if (it.characteristics) {
      const maxCharsPerLine = 80
      const chars = it.characteristics
      for (let i = 0; i < chars.length && i < maxCharsPerLine * 3; i += maxCharsPerLine) {
        text(`  ${chars.slice(i, i + maxCharsPerLine)}`, col.item.x + 3, y, { size: 7, color: [0.45, 0.48, 0.55] })
        y -= 10
      }
      y -= 2
    }
    if (it.delivery_forecast) {
      text(`  Previsão: ${it.delivery_forecast}`, col.item.x + 3, y, { size: 7, color: [0.45, 0.45, 0.45] })
      y -= 10
    }

    // Linha divisória entre itens
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.2, color: rgb(0.88, 0.90, 0.93) })
    y -= 4
    total += it.subtotal
  }

  // Total com destaque
  y -= 4
  newPageIfNeeded(24)
  page.drawRectangle({ x: col.unit.x, y: y - 18, width: tableW - (col.unit.x - margin), height: 20, color: rgb(...brandRgb) })
  text('TOTAL:', col.unit.x + 8, y - 12, { size: 9, bold: true, color: [1, 1, 1] })
  text(fmtCurrency(total, proposal.currency), col.sub.x + 3, y - 12, { size: 9, bold: true, color: [1, 1, 1] })
  y -= 26

  // ---- Desconto, condição de pagamento e parcelas ----
  newPageIfNeeded(60)
  if (proposal.discount_type) {
    const discountLabel = proposal.discount_type === 'percentage' ? `${proposal.discount_value}%` : fmtCurrency(proposal.discount_value, proposal.currency)
    text(`Desconto: ${discountLabel}`, margin, y, { size: 9 })
    y -= 14
  }
  if (proposal.payment_terms) {
    text(`Condição de pagamento: ${proposal.payment_terms}`, margin, y, { size: 9 })
    y -= 14
  }
  const netTotal = proposal.discount_type === 'percentage'
    ? total * (1 - proposal.discount_value / 100)
    : proposal.discount_type === 'fixed'
      ? total - proposal.discount_value
      : total
  if (proposal.is_recurring) {
    text(`Receita recorrente (MRR): ${fmtCurrency(netTotal, proposal.currency)}/mês`, margin, y, { size: 9, bold: true })
    y -= 14
  } else if (proposal.installments > 1) {
    text(`Parcelamento: ${proposal.installments}x de ${fmtCurrency(netTotal / proposal.installments, proposal.currency)}`, margin, y, { size: 9, bold: true })
    y -= 14
  } else {
    text(`Pagamento único: ${fmtCurrency(netTotal, proposal.currency)}`, margin, y, { size: 9, bold: true })
    y -= 14
  }

  // ---- Blocos de conteúdo extra (imagens e tabelas coladas pelo usuário) ----
  for (const block of contentBlocks) {
    if (block.block_type === 'image' && block.imageBytes) {
      try {
        const image = block.imageIsPng ? await doc.embedPng(block.imageBytes) : await doc.embedJpg(block.imageBytes)
        const maxWidth = pageWidth - margin * 2
        const scale = Math.min(1, maxWidth / image.width)
        const imgWidth = image.width * scale
        const imgHeight = image.height * scale
        newPageIfNeeded(imgHeight + 16)
        y -= imgHeight
        page.drawImage(image, { x: margin, y, width: imgWidth, height: imgHeight })
        y -= 16
      } catch {
        // Imagem que não carregou é pulada, não trava o resto do PDF.
      }
    } else if (block.block_type === 'table' && block.table_data) {
      const rows = block.table_data.rows
      const numCols = rows[0]?.length ?? 1
      const colWidth = (pageWidth - margin * 2) / numCols
      for (const row of rows) {
        newPageIfNeeded(16)
        row.forEach((cell, ci) => {
          text(cell.slice(0, 30), margin + ci * colWidth, y, { size: 8 })
        })
        page.drawLine({ start: { x: margin, y: y - 4 }, end: { x: pageWidth - margin, y: y - 4 }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) })
        y -= 16
      }
      y -= 8
    }
  }

  // ---- Rodapé customizado (faixa colorida), repetido em TODAS as páginas ----
  if (org.footerText) {
    const footerBarHeight = 22
    for (const p of doc.getPages()) {
      p.drawRectangle({ x: 0, y: 0, width: pageWidth, height: footerBarHeight, color: rgb(...brandRgb) })
      p.drawText(org.footerText, { x: margin, y: 7, size: 7, font, color: rgb(1, 1, 1) })
    }
  }

  return doc.save()
}
