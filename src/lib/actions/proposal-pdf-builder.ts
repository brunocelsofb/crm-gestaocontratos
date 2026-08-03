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
  const margin = 32
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
  // ---- Cabeçalho premium: Logo (esq) | Nome+Contato (dir) ----
  const headerTopY = y
  const logoH = 52
  let logoW = 0

  if (org.logoBytes) {
    try {
      const image = org.logoIsPng ? await doc.embedPng(org.logoBytes) : await doc.embedJpg(org.logoBytes)
      logoW = (image.width / image.height) * logoH
      page.drawImage(image, { x: margin, y: headerTopY - logoH, width: logoW, height: logoH })
    } catch { logoW = 0 }
  }

  // Bloco direito: Nome da empresa + Contato, alinhado à direita
  const rightBlockX = pageWidth - margin - 200
  const rightBlockW = 200

  // Nome Orbis em destaque
  const orgName = org.companyName ?? 'Empresa'
  text(orgName, rightBlockX, headerTopY - 10, { size: 10, bold: true })

  // Separador fino
  page.drawLine({
    start: { x: rightBlockX, y: headerTopY - 18 },
    end: { x: pageWidth - margin, y: headerTopY - 18 },
    thickness: 0.3, color: rgb(0.8, 0.8, 0.8)
  })

  // Contato abaixo
  let cY = headerTopY - 28
  text('Contato interno:', rightBlockX, cY, { size: 7.5, bold: true, color: [0.5, 0.5, 0.5] })
  cY -= 12
  if (org.createdByName) {
    text(org.createdByName, rightBlockX, cY, { size: 8.5 })
    cY -= 12
  }
  if (org.createdByEmail) {
    text(org.createdByEmail, rightBlockX, cY, { size: 7.5, color: [0.4, 0.4, 0.4] })
  }

  // Linha colorida da marca — abaixo de TODA a altura do logo
  y = headerTopY - logoH - 14
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1.5, color: rgb(...brandRgb) })
  y -= 22

  // ---- Duas caixas: Dados da pessoa | Dados da empresa ----
  const boxW = (pageWidth - margin * 2 - 10) / 2
  const boxH = 120
  const boxTop = y

  // Desenha as duas caixas com borda radius simulada via bordas coloridas no topo
  ;[
    { x: margin, label: 'Dados da pessoa', lines: [
      contact?.name ?? '—',
      `CPF: ${contact?.cpf ?? '—'}`,
      `E-mail: ${contact?.email ?? '—'}`,
      `Telefone: ${contact?.phone ?? '—'}`,
      `Endereço: ${(contact?.address ?? '—').slice(0, 48)}`,
    ], bold0: true },
    { x: margin + boxW + 10, label: 'Dados da empresa', lines: [
      company?.legal_name ?? company?.name ?? '—',
      `Nome fantasia: ${company?.trade_name ?? '—'}`,
      `CNPJ: ${company?.cnpj ?? '—'}`,
      `E-mail NF: ${company?.nf_email ?? '—'}`,
      `Endereço: ${(company?.address ?? '—').slice(0, 48)}`,
    ], bold0: true },
  ].forEach(box => {
    // Fundo
    page.drawRectangle({ x: box.x, y: boxTop - boxH, width: boxW, height: boxH, color: rgb(0.975, 0.978, 0.985) })
    // Borda colorida no topo
    page.drawRectangle({ x: box.x, y: boxTop - 3, width: boxW, height: 3, color: rgb(...brandRgb) })
    // Borda cinza ao redor
    page.drawLine({ start: { x: box.x, y: boxTop }, end: { x: box.x, y: boxTop - boxH }, thickness: 0.4, color: rgb(0.82, 0.84, 0.88) })
    page.drawLine({ start: { x: box.x + boxW, y: boxTop }, end: { x: box.x + boxW, y: boxTop - boxH }, thickness: 0.4, color: rgb(0.82, 0.84, 0.88) })
    page.drawLine({ start: { x: box.x, y: boxTop - boxH }, end: { x: box.x + boxW, y: boxTop - boxH }, thickness: 0.4, color: rgb(0.82, 0.84, 0.88) })

    // Label
    let bY = boxTop - 14
    text(box.label, box.x + 10, bY, { size: 7.5, bold: true, color: [0.45, 0.45, 0.55] })
    bY -= 15

    // Linhas de conteúdo
    box.lines.forEach((line, i) => {
      text(line, box.x + 10, bY, { size: i === 0 ? 9 : 7.5, bold: i === 0 && box.bold0, color: i === 0 ? [0.1, 0.12, 0.2] : [0.3, 0.32, 0.38] })
      bY -= i === 0 ? 14 : 12
    })
  })

  y = boxTop - boxH - 18

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

  const tableW = pageWidth - margin * 2  // 531pt
  // Proporções: Qtd 5% | Cat 18% | Item 35% | Tipo 8% | Unit 12% | Desc 10% | Sub 12%
  const colQty  = { x: margin,                        w: tableW * 0.05 }  // ~26
  const colCat  = { x: margin + tableW * 0.05,        w: tableW * 0.18 }  // ~95
  const colItem = { x: margin + tableW * 0.23,        w: tableW * 0.35 }  // ~186
  const colType = { x: margin + tableW * 0.58,        w: tableW * 0.08 }  // ~42
  const colUnit = { x: margin + tableW * 0.66,        w: tableW * 0.12 }  // ~64
  const colDisc = { x: margin + tableW * 0.78,        w: tableW * 0.10 }  // ~53
  const colSub  = { x: margin + tableW * 0.88,        w: tableW * 0.12 }  // ~64
  const col = { qty: colQty, cat: colCat, item: colItem, type: colType, unit: colUnit, disc: colDisc, sub: colSub }

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

    // Dados da linha — cada coluna restrita à sua largura
    text(String(it.quantity), col.qty.x + 2, y, { size: 8 })

    // Categoria: até 2 linhas de 14 chars (~90pt col)
    const catFull = it.category ?? '—'
    text(catFull.slice(0, 14), col.cat.x + 2, y, { size: 7.5, color: [0.35, 0.38, 0.48] })
    if (catFull.length > 14) text(catFull.slice(14, 28), col.cat.x + 2, y - 10, { size: 7.5, color: [0.35, 0.38, 0.48] })

    // Item: até 2 linhas de 30 chars (~186pt col)
    const itemFull = it.item
    text(itemFull.slice(0, 30), col.item.x + 2, y, { size: 8, bold: true })
    if (itemFull.length > 30) text(itemFull.slice(30, 60), col.item.x + 2, y - 10, { size: 8, bold: true })

    // Tipo, valores — alinhados verticalmente no topo da linha
    text((it.type ?? '—').slice(0, 5), col.type.x + 2, y, { size: 8 })
    text(fmtCurrency(it.unit_value, proposal.currency), col.unit.x + 2, y, { size: 7.5 })
    text(fmtCurrency(it.discount, proposal.currency), col.disc.x + 2, y, { size: 7.5, color: [0.5, 0.5, 0.5] })
    text(fmtCurrency(it.subtotal, proposal.currency), col.sub.x + 2, y, { size: 7.5, bold: true })
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
