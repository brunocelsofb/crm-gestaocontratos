import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

function sanitize(s: string | null | undefined): string {
  if (!s) return ''
  const map: Record<string, string> = {
    '\u00e1':'a','\u00e0':'a','\u00e3':'a','\u00e2':'a','\u00e4':'a',
    '\u00c1':'A','\u00c0':'A','\u00c3':'A','\u00c2':'A',
    '\u00e9':'e','\u00e8':'e','\u00ea':'e','\u00eb':'e',
    '\u00c9':'E','\u00c8':'E','\u00ca':'E',
    '\u00ed':'i','\u00ec':'i','\u00ee':'i','\u00ef':'i','\u00cd':'I',
    '\u00f3':'o','\u00f2':'o','\u00f5':'o','\u00f4':'o','\u00f6':'o',
    '\u00d3':'O','\u00d4':'O','\u00d5':'O',
    '\u00fa':'u','\u00f9':'u','\u00fb':'u','\u00fc':'u','\u00da':'U',
    '\u00e7':'c','\u00c7':'C','\u00f1':'n','\u00d1':'N',
    '\u2019':"'",'`':"'"
  }
  return Array.from(s).map(c => map[c] ?? (c.charCodeAt(0) > 127 ? '' : c)).join('')
}

function fmtMoney(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

// Quebra texto em linhas de largura máxima
function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? current + ' ' + word : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

// Quebra textarea em linhas respeitando \n e wrap
function wrapParagraphs(text: string, font: any, size: number, maxWidth: number): string[] {
  if (!text?.trim()) return []
  const paragraphs = sanitize(text).split('\n')
  const lines: string[] = []
  for (const para of paragraphs) {
    if (!para.trim()) { lines.push(''); continue }
    const wrapped = wrapText(para, font, size, maxWidth)
    lines.push(...wrapped)
  }
  return lines
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
  const { snapshot: s, proposalValue, validityDays, contract, textoObjetivos, textoAtividades, textoEstruturaApoio } = params
  const org = params.org

  const pdfDoc = await PDFDocument.create()
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const W = 595.28, H = 841.89
  const ml = 50, mr = 50
  const contentW = W - ml - mr

  const TEAL  = rgb(0.08, 0.33, 0.41)
  const DARK  = rgb(0.10, 0.12, 0.21)
  const GRAY  = rgb(0.45, 0.46, 0.55)
  const WHITE = rgb(1, 1, 1)
  const LIGHT = rgb(0.96, 0.97, 0.98)
  const MINT  = rgb(0.20, 0.69, 0.62)

  let pageNum = 0

  function newPage() {
    pageNum++
    const page = pdfDoc.addPage([W, H])

    // Header linha teal
    page.drawRectangle({ x: 0, y: H - 2, width: W, height: 2, color: TEAL })

    // Footer
    page.drawLine({ start: { x: ml, y: 28 }, end: { x: W - mr, y: 28 }, thickness: 0.3, color: GRAY })
    const today = new Date().toLocaleDateString('pt-BR')
    const validDate = new Date(Date.now() + validityDays * 86400000).toLocaleDateString('pt-BR')
    page.drawText(`${today} - Validade: ${validDate}`, { x: ml, y: 16, size: 7, font: reg, color: GRAY })
    const propCode = sanitize(org?.proposalCode ?? '')
    page.drawText(propCode, { x: W - mr - bold.widthOfTextAtSize(propCode, 7), y: 16, size: 7, font: bold, color: GRAY })
    page.drawText(String(pageNum), { x: W / 2, y: 16, size: 7, font: reg, color: GRAY })

    return { page, y: H - 20 }
  }

  function drawSectionTitle(page: any, title: string, y: number): number {
    page.drawText(sanitize(title), { x: ml, y: y - 10, size: 8, font: bold, color: DARK })
    page.drawRectangle({ x: ml, y: y - 14, width: 30, height: 1.5, color: TEAL })
    return y - 24
  }

  function drawText(page: any, text: string, x: number, y: number, size = 9, font = reg, color = DARK): number {
    page.drawText(sanitize(text), { x, y, size, font, color })
    return y - size - 4
  }

  function drawParagraphs(page: any, text: string | null | undefined, y: number, size = 8.5): { y: number; page: any } {
    if (!text?.trim()) return { y, page }
    const lines = wrapParagraphs(text, reg, size, contentW)
    for (const line of lines) {
      if (y < 50) {
        const np = newPage()
        page = np.page
        y = np.y
      }
      if (line === '') {
        y -= size + 2
      } else {
        page.drawText(line, { x: ml, y, size, font: reg, color: DARK })
        y -= size + 3
      }
    }
    return { y: y - 4, page }
  }

  function drawBulletLines(page: any, text: string | null | undefined, y: number): { y: number; page: any } {
    if (!text?.trim()) return { y, page }
    const lines = sanitize(text).split('\n').filter(l => l.trim())
    for (const line of lines) {
      if (y < 50) {
        const np = newPage()
        page = np.page
        y = np.y
      }
      const wrapped = wrapText(line.replace(/^[-•*]\s*/, ''), reg, 8.5, contentW - 12)
      for (let i = 0; i < wrapped.length; i++) {
        page.drawText(i === 0 ? '-' : ' ', { x: ml + 2, y, size: 8.5, font: bold, color: TEAL })
        page.drawText(wrapped[i], { x: ml + 12, y, size: 8.5, font: reg, color: DARK })
        y -= 13
      }
    }
    return { y: y - 4, page }
  }

  // ── PÁGINA 1: Cabeçalho + Empresa + Cliente ─────────────────────────────
  {
    let { page, y } = newPage()
    y -= 10

    // Bloco Orbis
    page.drawRectangle({ x: ml, y: y - 80, width: contentW, height: 80, color: LIGHT })
    // Logo placeholder
    page.drawRectangle({ x: ml + 8, y: y - 68, width: 80, height: 56, color: TEAL })
    page.drawText('ORBIS', { x: ml + 20, y: y - 38, size: 12, font: bold, color: WHITE })
    page.drawText('Engenharia', { x: ml + 12, y: y - 52, size: 7, font: reg, color: WHITE })

    // Dados Orbis
    const companyName = sanitize(org?.companyName ?? 'ORBIS GESTAO DE TECNOLOGIA EM SAUDE LTDA')
    page.drawText(companyName, { x: ml + 100, y: y - 16, size: 9, font: bold, color: DARK })
    if (org?.cnpj) page.drawText(`CNPJ: ${sanitize(org.cnpj)}`, { x: ml + 100, y: y - 28, size: 8, font: reg, color: DARK })
    if (org?.address) {
      const addrLines = wrapText(sanitize(org.address), reg, 8, 250)
      addrLines.forEach((l, i) => page.drawText(l, { x: ml + 100, y: y - 40 - i * 11, size: 8, font: reg, color: DARK }))
    }

    // Contato comercial (lado direito)
    const contactName = sanitize(params.contact?.name ?? '')
    const contactEmail = sanitize(params.contact?.email ?? '')
    page.drawText('Contato', { x: W - mr - 150, y: y - 16, size: 8, font: bold, color: DARK })
    page.drawText(contactName, { x: W - mr - 150, y: y - 28, size: 8, font: reg, color: DARK })
    if (contactEmail) page.drawText(contactEmail, { x: W - mr - 150, y: y - 40, size: 7, font: reg, color: GRAY })

    y -= 92

    // Box dados da pessoa + empresa
    const boxH = 70
    page.drawRectangle({ x: ml, y: y - boxH, width: contentW / 2 - 4, height: boxH, color: WHITE })
    page.drawRectangle({ x: ml, y: y - boxH, width: contentW / 2 - 4, height: boxH, color: rgb(0, 0, 0) })
    // Usa border trick com linha
    ;[
      [ml, y, contentW / 2 - 4],
      [ml + contentW / 2 + 4, y, contentW / 2 - 4],
    ].forEach(([x, yy, w]) => {
      page.drawRectangle({ x, y: yy - boxH, width: w, height: boxH, color: LIGHT })
      page.drawLine({ start: { x, y: yy }, end: { x: x + w, y: yy }, thickness: 0.5, color: GRAY })
      page.drawLine({ start: { x, y: yy - boxH }, end: { x: x + w, y: yy - boxH }, thickness: 0.5, color: GRAY })
      page.drawLine({ start: { x, y: yy }, end: { x, y: yy - boxH }, thickness: 0.5, color: GRAY })
      page.drawLine({ start: { x: x + w, y: yy }, end: { x: x + w, y: yy - boxH }, thickness: 0.5, color: GRAY })
    })

    // Dados da pessoa (contratante)
    page.drawText('Dados da pessoa', { x: ml + 6, y: y - 12, size: 7, font: reg, color: GRAY })
    const personName = sanitize(params.contact?.name ?? '')
    page.drawText(personName, { x: ml + 6, y: y - 24, size: 9, font: bold, color: DARK })
    if (params.contact?.email) {
      page.drawText(`E-mails: ${sanitize(params.contact.email)}`, { x: ml + 6, y: y - 38, size: 7.5, font: reg, color: DARK })
    }

    // Dados da empresa
    const x2 = ml + contentW / 2 + 4
    page.drawText('Dados da empresa', { x: x2 + 6, y: y - 12, size: 7, font: reg, color: GRAY })
    const compName = sanitize(params.company?.name ?? contract?.client_name ?? '')
    page.drawText(compName, { x: x2 + 6, y: y - 24, size: 9, font: bold, color: DARK })
    if (params.company?.cnpj || contract?.cnpj) {
      page.drawText(`CNPJ: ${sanitize(params.company?.cnpj ?? contract?.cnpj ?? '')}`, { x: x2 + 6, y: y - 38, size: 7.5, font: reg, color: DARK })
    }
    if (params.company?.address) {
      const addrL = wrapText(sanitize(params.company.address), reg, 7.5, contentW / 2 - 20)
      addrL.slice(0, 2).forEach((l, i) => page.drawText(l, { x: x2 + 6, y: y - 50 - i * 10, size: 7.5, font: reg, color: DARK }))
    }

    y -= boxH + 20

    // OBJETIVOS
    y = drawSectionTitle(page, 'OBJETIVOS', y)
    const res1 = drawParagraphs(page, textoObjetivos, y)
    page = res1.page; y = res1.y

    y -= 8

    // ATIVIDADES A SEREM DESENVOLVIDAS
    if (y < 150) { const np = newPage(); page = np.page; y = np.y }
    y = drawSectionTitle(page, 'ATIVIDADES A SEREM DESENVOLVIDAS', y)
    const res2 = drawBulletLines(page, textoAtividades, y)
    page = res2.page; y = res2.y
  }

  // ── PÁGINA seguinte: Equipe + Estrutura de Apoio + Escopo ───────────────
  {
    let { page, y } = newPage()
    y -= 10

    // EQUIPE ALOCADA
    const profs = (s.professionals ?? []).filter((p: any) => p.role?.trim())
    if (profs.length > 0) {
      y = drawSectionTitle(page, 'EQUIPE ALOCADA', y)

      // Header tabela
      page.drawRectangle({ x: ml, y: y - 14, width: contentW, height: 14, color: TEAL })
      page.drawText('QUANT.', { x: ml + 4, y: y - 10, size: 6.5, font: bold, color: WHITE })
      page.drawText('PROFISSIONAL', { x: ml + 44, y: y - 10, size: 6.5, font: bold, color: WHITE })
      page.drawText('ESCALA DE TRABALHO', { x: ml + 240, y: y - 10, size: 6.5, font: bold, color: WHITE })
      page.drawText('OBSERVACAO', { x: ml + 370, y: y - 10, size: 6.5, font: bold, color: WHITE })
      y -= 14

      profs.forEach((p: any, i: number) => {
        const rowH = 20
        if (i % 2 === 0) page.drawRectangle({ x: ml, y: y - rowH, width: contentW, height: rowH, color: LIGHT })
        page.drawText(`0${p.quantity}`, { x: ml + 4, y: y - 13, size: 8, font: reg, color: DARK })
        page.drawText(sanitize(p.role), { x: ml + 44, y: y - 13, size: 8, font: reg, color: DARK })
        const carga = p.hoursPerMonth === 220 ? '44h semanais' : p.hoursPerMonth === 180 ? '12x36' : `${p.hoursPerMonth}h/mes`
        page.drawText(carga, { x: ml + 240, y: y - 13, size: 8, font: reg, color: DARK })
        y -= rowH
      })
      y -= 16
    }

    // ESTRUTURA DE APOIO
    if (textoEstruturaApoio?.trim()) {
      if (y < 120) { const np = newPage(); page = np.page; y = np.y }
      y = drawSectionTitle(page, 'ESTRUTURA DE APOIO', y)
      const res = drawBulletLines(page, textoEstruturaApoio, y)
      page = res.page; y = res.y
      y -= 8
    }

    // ESCOPO DE SERVIÇO
    const escopo: string[] = s.escopoSanitizado ?? s.escopoServicos ?? []
    if (escopo.length > 0) {
      if (y < 120) { const np = newPage(); page = np.page; y = np.y }
      y = drawSectionTitle(page, 'ESCOPO DE SERVICO', y)

      escopo.forEach(item => {
        if (y < 50) { const np = newPage(); page = np.page; y = np.y }
        page.drawText('-', { x: ml + 2, y, size: 8.5, font: bold, color: TEAL })
        page.drawText(sanitize(item), { x: ml + 12, y, size: 8.5, font: reg, color: DARK })
        y -= 14
      })
      y -= 8
    }
  }

  // ── PÁGINA: Itens MRR + Resumo Financeiro ───────────────────────────────
  {
    let { page, y } = newPage()
    y -= 10

    // Título itens
    page.drawRectangle({ x: ml, y: y - 16, width: contentW, height: 16, color: DARK })
    page.drawText('Mensalidade (MRR):', { x: ml + 8, y: y - 11, size: 8, font: bold, color: WHITE })
    y -= 16

    // Header tabela
    const cols = [
      { label: 'Qtd.', x: ml, w: 28 },
      { label: 'Cat.', x: ml + 30, w: 70 },
      { label: 'Duracao', x: ml + 102, w: 44 },
      { label: 'Cobranca', x: ml + 148, w: 50 },
      { label: 'Item', x: ml + 200, w: 80 },
      { label: 'Valor unit.', x: ml + 282, w: 80 },
      { label: 'Tipo', x: ml + 364, w: 40 },
      { label: 'Subtotal', x: ml + 406, w: 89 },
    ]
    page.drawRectangle({ x: ml, y: y - 14, width: contentW, height: 14, color: LIGHT })
    cols.forEach(c => page.drawText(c.label, { x: c.x + 2, y: y - 10, size: 6, font: bold, color: GRAY }))
    y -= 14

    // Linha do item
    const dur = s.contractDuration ?? 12
    const itemNome = sanitize(s.tituloItemServico ?? 'Servico de Engenharia')
    const catNome = sanitize(s.tipoEngenharia === 'Hospitalar' ? 'Eng. Hospitalar' : 'Engenharia Clinica')
    const rowH = 36
    page.drawRectangle({ x: ml, y: y - rowH, width: contentW, height: rowH, color: rgb(0.99, 0.99, 1.0) })
    page.drawLine({ start: { x: ml, y }, end: { x: W - mr, y }, thickness: 0.3, color: LIGHT })
    page.drawLine({ start: { x: ml, y: y - rowH }, end: { x: W - mr, y: y - rowH }, thickness: 0.3, color: LIGHT })

    page.drawText('1 UN', { x: ml + 2, y: y - 10, size: 8, font: reg, color: DARK })
    page.drawText(catNome, { x: ml + 30, y: y - 10, size: 7.5, font: reg, color: DARK })
    page.drawText(`${dur} meses`, { x: ml + 102, y: y - 10, size: 7.5, font: reg, color: DARK })
    page.drawText('Mensal', { x: ml + 148, y: y - 10, size: 7.5, font: reg, color: DARK })
    page.drawText(itemNome, { x: ml + 200, y: y - 10, size: 7.5, font: bold, color: DARK })
    page.drawText(fmtMoney(proposalValue), { x: ml + 282, y: y - 10, size: 7.5, font: reg, color: DARK })
    page.drawText('MRR', { x: ml + 364, y: y - 10, size: 7.5, font: reg, color: DARK })
    page.drawText(fmtMoney(proposalValue), { x: ml + 406, y: y - 10, size: 7.5, font: bold, color: DARK })

    // Características
    const chars = (s.escopoSanitizado ?? s.escopoServicos ?? []).join(' - ')
    const charLines = wrapText(`Caracteristicas: ${chars}`, reg, 7, contentW - 4)
    charLines.slice(0, 2).forEach((l, i) => {
      page.drawText(l, { x: ml + 2, y: y - 22 - i * 9, size: 7, font: reg, color: GRAY })
    })
    y -= rowH + 20

    // Resumo
    page.drawText('Resumo da proposta', { x: ml, y, size: 9, font: bold, color: DARK })
    y -= 14

    const resumoItems = [
      { label: 'Contrato', value: `${sanitize(s.tipoEngenharia)} - ${dur} meses` },
      { label: 'Tipo de cobranca', value: 'Mensal' },
    ]
    resumoItems.forEach(item => {
      page.drawText(item.label, { x: ml, y, size: 8, font: reg, color: GRAY })
      page.drawText(item.value, { x: ml + 120, y, size: 8, font: reg, color: DARK })
      y -= 13
    })
    y -= 8

    // Parcelas
    const totalContrato = proposalValue * dur
    for (let i = 1; i <= Math.min(dur, 12); i++) {
      if (y < 50) { const np = newPage(); page = np.page; y = np.y }
      if (i % 2 === 0) page.drawRectangle({ x: ml, y: y - 11, width: contentW, height: 11, color: LIGHT })
      page.drawText(`${i}a parc.:`, { x: ml, y, size: 7.5, font: reg, color: DARK })
      page.drawText(fmtMoney(proposalValue), { x: ml + 70, y, size: 7.5, font: bold, color: DARK })
      page.drawText('A combinar', { x: ml + 180, y, size: 7.5, font: reg, color: GRAY })
      page.drawText('Boleto', { x: ml + 260, y, size: 7.5, font: reg, color: GRAY })
      y -= 12
    }
    y -= 12

    // Total
    page.drawLine({ start: { x: ml, y: y + 4 }, end: { x: W - mr, y: y + 4 }, thickness: 0.5, color: GRAY })
    page.drawText('Valor total do contrato:', { x: ml, y, size: 9, font: bold, color: DARK })
    page.drawText(fmtMoney(totalContrato), { x: W - mr - bold.widthOfTextAtSize(fmtMoney(totalContrato), 11), y, size: 11, font: bold, color: TEAL })
    y -= 30

    // Aprovações internas (auditoria)
    const aprovs = [
      params.submittedByName && { l: 'Enviada para aprovacao tecnica', by: params.submittedByName, at: null },
      params.technicalApprovedByName && { l: 'Aprovada tecnicamente', by: params.technicalApprovedByName, at: params.technicalApprovedAt, comment: params.technicalComment },
      params.commercialApprovedByName && { l: 'Aprovada comercialmente', by: params.commercialApprovedByName, at: params.commercialApprovedAt },
    ].filter(Boolean) as any[]

    if (aprovs.length) {
      if (y < 100) { const np = newPage(); page = np.page; y = np.y }
      page.drawLine({ start: { x: ml, y: y + 4 }, end: { x: W - mr, y: y + 4 }, thickness: 0.3, color: LIGHT })
      page.drawText('Aprovacoes internas:', { x: ml, y, size: 8, font: bold, color: GRAY })
      y -= 14
      aprovs.forEach((a: any) => {
        page.drawText(`- ${sanitize(a.l)} por ${sanitize(a.by)}${a.at ? ` em ${fmtDate(a.at)}` : ''}`, { x: ml + 8, y, size: 7.5, font: reg, color: GRAY })
        y -= 12
        if (a.comment) {
          const cl = wrapText(`  "${sanitize(a.comment)}"`, reg, 7, contentW - 20)
          cl.forEach(l => { page.drawText(l, { x: ml + 12, y, size: 7, font: reg, color: GRAY }); y -= 10 })
        }
      })
    }
  }

  return pdfDoc.save()
}
